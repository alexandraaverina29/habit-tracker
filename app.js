(function () {
  "use strict";

  var STORAGE_KEY = "budget-tracker-data";

  var DEFAULT_CATEGORIES = [
    { id: "halyk_transfer", name: "Переводы по Halyk SuperApp", color: "#1e9e8f", icon: "💳", quickAmounts: [2000, 5000, 10000, 20000] },
    { id: "transport", name: "Транспорт", color: "#4f8cf7", icon: "🚗", quickAmounts: [100, 200, 1000, 2000] },
    { id: "coffee", name: "Кофе", color: "#8a5a34", icon: "☕", quickAmounts: [500, 700, 1000, 1500] },
    { id: "food", name: "Еда", color: "#f2994a", icon: "🍽️", quickAmounts: [1000, 2000, 3000, 5000] },
    { id: "shop", name: "Магазин", color: "#9b6bde", icon: "🛍️", quickAmounts: [1000, 2000, 5000, 10000] }
  ];

  var DEFAULT_QUICK_AMOUNTS = [500, 1000, 2000, 5000];
  var DEFAULT_ICON = "🏷️";

  var EXTRA_COLORS = ["#2fb4a3", "#e0588b", "#6b7280", "#c9a227", "#5b7fd6"];

  function normalizeCategories(categories, expenses) {
    var remaining = categories.slice();
    var ordered = [];

    DEFAULT_CATEGORIES.forEach(function (defCat) {
      var idx = -1;
      for (var i = 0; i < remaining.length; i++) {
        var c = remaining[i];
        if (c.id === defCat.id || c.name.trim().toLowerCase() === defCat.name.toLowerCase()) {
          idx = i;
          break;
        }
      }
      if (idx !== -1) {
        var existing = remaining[idx];
        remaining.splice(idx, 1);
        if (existing.id !== defCat.id) {
          remapExpenseCategoryId(expenses, existing.id, defCat.id);
        }
        ordered.push(defCat);
      } else {
        ordered.push(defCat);
      }
    });

    remaining.forEach(function (c) {
      if (!c.quickAmounts) c.quickAmounts = DEFAULT_QUICK_AMOUNTS;
      ordered.push(c);
    });

    return ordered;
  }

  function remapExpenseCategoryId(expenses, oldId, newId) {
    if (oldId === newId) return;
    Object.keys(expenses).forEach(function (dateKey) {
      var day = expenses[dateKey];
      if (day && day[oldId] !== undefined) {
        day[newId] = (day[newId] || 0) + day[oldId];
        delete day[oldId];
      }
    });
  }

  var MONTHS_FULL = [
    "январь", "февраль", "март", "апрель", "май", "июнь",
    "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"
  ];
  var MONTHS_GEN = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function shiftDate(dateKey, days) {
    var d = new Date(dateKey + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  var JULY_2026_START = "2026-07-01";
  var JULY_2026_BUDGET = 10000;

  var JULY_DAY_TOTALS = {
    1: 8500, 2: 12300, 3: 7700, 4: 6200, 5: 14000, 6: 5000, 7: 11500, 8: 8000,
    9: 9800, 10: 13200, 11: 6800, 12: 9000, 13: 15600, 14: 4000, 15: 10800, 16: 7200
  };

  var JULY_WEIGHT_PATTERNS = [
    [0.30, 0.20, 0.10, 0.25, 0.15],
    [0.15, 0.35, 0.15, 0.20, 0.15],
    [0.40, 0.10, 0.15, 0.15, 0.20],
    [0.20, 0.15, 0.25, 0.10, 0.30]
  ];

  function splitJulyAmount(total, patternIndex) {
    var ids = ["halyk_transfer", "transport", "coffee", "food", "shop"];
    var weights = JULY_WEIGHT_PATTERNS[patternIndex % JULY_WEIGHT_PATTERNS.length];
    var parts = weights.map(function (w) {
      return Math.round(total * w);
    });
    var sum = parts.reduce(function (a, b) { return a + b; }, 0);
    parts[0] += total - sum;
    var obj = {};
    ids.forEach(function (id, i) {
      if (parts[i] > 0) obj[id] = parts[i];
    });
    return obj;
  }

  function loadData() {
    var raw = localStorage.getItem(STORAGE_KEY);
    var parsed;
    if (!raw) {
      parsed = { dailyBudget: null, budgetSetDate: null, categories: DEFAULT_CATEGORIES.slice(), expenses: {} };
    } else {
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        parsed = { dailyBudget: null, budgetSetDate: null, categories: DEFAULT_CATEGORIES.slice(), expenses: {} };
      }
    }

    if (!parsed.categories) parsed.categories = DEFAULT_CATEGORIES.slice();
    if (!parsed.expenses) parsed.expenses = {};
    if (parsed.dailyBudget === undefined) parsed.dailyBudget = null;
    if (parsed.budgetSetDate === undefined) parsed.budgetSetDate = null;
    parsed.categories = normalizeCategories(parsed.categories, parsed.expenses);

    if (!parsed._julyBudgetApplied) {
      if (!parsed.dailyBudget || (parsed.budgetSetDate && parsed.budgetSetDate > JULY_2026_START)) {
        parsed.dailyBudget = JULY_2026_BUDGET;
        parsed.budgetSetDate = JULY_2026_START;
      }
      parsed._julyBudgetApplied = true;
    }

    if (!parsed._julyExpensesApplied) {
      Object.keys(JULY_DAY_TOTALS).forEach(function (dayStr, idx) {
        var day = parseInt(dayStr, 10);
        var dateKey = "2026-07-" + pad(day);
        if (!parsed.expenses[dateKey]) {
          parsed.expenses[dateKey] = splitJulyAmount(JULY_DAY_TOTALS[day], idx);
        }
      });
      parsed._julyExpensesApplied = true;
    }

    return parsed;
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function uid() {
    return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function formatNumber(n) {
    return Math.round(n).toLocaleString("ru-RU");
  }

  function formatMoney(n) {
    return formatNumber(n) + " ₸";
  }

  function dayTotal(dateKey) {
    var day = state.expenses[dateKey];
    if (!day) return 0;
    var sum = 0;
    Object.keys(day).forEach(function (catId) {
      sum += day[catId] || 0;
    });
    return sum;
  }

  var effectiveCache = {};

  function effectiveBudget(dateKey) {
    if (!state.dailyBudget || !state.budgetSetDate) return 0;
    if (dateKey <= state.budgetSetDate) return state.dailyBudget;
    if (effectiveCache[dateKey] !== undefined) return effectiveCache[dateKey];
    var prevDate = shiftDate(dateKey, -1);
    var prevEff = effectiveBudget(prevDate);
    var prevSpent = dayTotal(prevDate);
    var diff = prevEff - prevSpent;
    var result = diff < 0 ? Math.max(0, state.dailyBudget + diff) : state.dailyBudget;
    effectiveCache[dateKey] = result;
    return result;
  }

  function monthlySavings(year, month) {
    if (!state.budgetSetDate) return 0;
    var total = 0;
    var today = todayKey();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    for (var d = 1; d <= daysInMonth; d++) {
      var dateKey = year + "-" + pad(month + 1) + "-" + pad(d);
      if (dateKey >= today) break;
      if (dateKey < state.budgetSetDate) continue;
      var eff = effectiveBudget(dateKey);
      var spent = dayTotal(dateKey);
      var diff = eff - spent;
      if (diff > 0) total += diff;
    }
    return total;
  }

  function setBudget(amount) {
    if (!amount || amount <= 0) return;
    state.dailyBudget = amount;
    if (!state.budgetSetDate) state.budgetSetDate = todayKey();
    effectiveCache = {};
    saveData();
    render();
  }

  var lastAddedCategoryId = null;

  function addExpense(catId, amount) {
    if (!amount || amount <= 0) return;
    var today = todayKey();
    if (!state.expenses[today]) state.expenses[today] = {};
    state.expenses[today][catId] = (state.expenses[today][catId] || 0) + amount;
    lastAddedCategoryId = catId;
    saveData();
    render();
  }

  function addCategory(name) {
    var trimmed = name.trim();
    if (!trimmed) return;
    var color = EXTRA_COLORS[state.categories.length % EXTRA_COLORS.length];
    state.categories.push({ id: uid(), name: trimmed, color: color, icon: DEFAULT_ICON, quickAmounts: DEFAULT_QUICK_AMOUNTS });
    saveData();
    render();
  }

  function formatDateLabel() {
    var d = new Date();
    return d.getDate() + " " + MONTHS_GEN[d.getMonth()];
  }

  function renderRing(spent, budget, pct) {
    var svg = document.getElementById("ringSvg");
    svg.innerHTML = "";

    var r = 50, cx = 60, cy = 60, sw = 14;
    var circumference = 2 * Math.PI * r;

    function makeCircle() {
      return document.createElementNS("http://www.w3.org/2000/svg", "circle");
    }

    var group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("transform", "rotate(-90 " + cx + " " + cy + ")");

    var track = makeCircle();
    track.setAttribute("cx", cx);
    track.setAttribute("cy", cy);
    track.setAttribute("r", r);
    track.setAttribute("stroke-width", sw);
    track.setAttribute("class", "ring-track");
    group.appendChild(track);

    var overBudget = spent > budget && budget > 0;
    var fillRatio = budget > 0 ? Math.min(spent / budget, 1) : 0;
    var totalFillLength = circumference * fillRatio;

    var today = todayKey();
    var dayExpenses = state.expenses[today] || {};
    var cumulative = 0;

    if (spent > 0 && totalFillLength > 0) {
      state.categories.forEach(function (cat) {
        var amt = dayExpenses[cat.id] || 0;
        if (amt <= 0) return;
        var segLen = (amt / spent) * totalFillLength;
        var circle = makeCircle();
        circle.setAttribute("cx", cx);
        circle.setAttribute("cy", cy);
        circle.setAttribute("r", r);
        circle.setAttribute("stroke-width", sw);
        circle.setAttribute("stroke", cat.color);
        circle.setAttribute("fill", "none");
        circle.setAttribute("stroke-dasharray", segLen + " " + (circumference - segLen));
        circle.setAttribute("stroke-dashoffset", -cumulative);
        circle.setAttribute("class", "ring-segment");
        group.appendChild(circle);
        cumulative += segLen;
      });
    }

    svg.appendChild(group);

    var percentEl = document.getElementById("ringPercent");
    var subEl = document.getElementById("ringSub");
    percentEl.textContent = pct + "%";
    percentEl.classList.toggle("over", overBudget);
    percentEl.classList.remove("anim-pop");

    if (lastAddedCategoryId) {
      void percentEl.offsetWidth;
      percentEl.classList.add("anim-pop");
    }

    if (overBudget) {
      subEl.textContent = "Превышено на " + formatMoney(spent - budget);
      subEl.classList.add("over");
    } else {
      subEl.textContent = "Осталось " + formatMoney(budget - spent);
      subEl.classList.remove("over");
    }
  }

  function renderCategories(today) {
    var listEl = document.getElementById("categoryList");
    listEl.innerHTML = "";
    var dayExpenses = state.expenses[today] || {};

    if (state.categories.length === 0) {
      var empty = document.createElement("li");
      empty.className = "empty-state";
      empty.textContent = "Нет категорий. Добавьте первую.";
      listEl.appendChild(empty);
      return;
    }

    state.categories.forEach(function (cat) {
      var amt = dayExpenses[cat.id] || 0;

      var li = document.createElement("li");
      li.className = "category-item";

      var row = document.createElement("div");
      row.className = "category-row";
      row.style.setProperty("--cat-color", cat.color);

      var icon = document.createElement("span");
      icon.className = "cat-icon";
      icon.textContent = cat.icon || DEFAULT_ICON;

      var name = document.createElement("span");
      name.className = "cat-name";
      name.textContent = cat.name;

      var spentEl = document.createElement("span");
      spentEl.className = "cat-spent" + (cat.id === lastAddedCategoryId ? " anim-pop" : "");
      spentEl.textContent = amt > 0 ? formatMoney(amt) : "";

      var closeBtn = document.createElement("button");
      closeBtn.className = "cat-close hidden";
      closeBtn.type = "button";
      closeBtn.setAttribute("aria-label", "Закрыть");
      closeBtn.textContent = "×";

      row.appendChild(icon);
      row.appendChild(name);
      row.appendChild(spentEl);
      row.appendChild(closeBtn);

      var form = document.createElement("form");
      form.className = "cat-expense-form hidden";

      var quickWrap = document.createElement("div");
      quickWrap.className = "quick-amounts";
      var quickAmounts = cat.quickAmounts || DEFAULT_QUICK_AMOUNTS;
      quickAmounts.forEach(function (amount) {
        var quickBtn = document.createElement("button");
        quickBtn.type = "button";
        quickBtn.className = "quick-amount-btn";
        quickBtn.textContent = formatNumber(amount);
        quickBtn.style.setProperty("--qa-color", cat.color);
        quickBtn.addEventListener("click", function () {
          addExpense(cat.id, amount);
        });
        quickWrap.appendChild(quickBtn);
      });

      var inputRow = document.createElement("div");
      inputRow.className = "cat-expense-input-row";

      var input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "1";
      input.inputMode = "decimal";
      input.placeholder = "Своя сумма";
      input.className = "cat-expense-input";

      var submitBtn = document.createElement("button");
      submitBtn.type = "submit";
      submitBtn.className = "cat-expense-submit";
      submitBtn.textContent = "Добавить";

      inputRow.appendChild(input);
      inputRow.appendChild(submitBtn);

      form.appendChild(quickWrap);
      form.appendChild(inputRow);

      function closeForm() {
        form.classList.add("hidden");
        closeBtn.classList.add("hidden");
      }

      function openForm() {
        listEl.querySelectorAll(".cat-expense-form").forEach(function (f) {
          f.classList.add("hidden");
        });
        listEl.querySelectorAll(".cat-close").forEach(function (b) {
          b.classList.add("hidden");
        });
        form.classList.remove("hidden");
        closeBtn.classList.remove("hidden");
        input.focus();
      }

      row.addEventListener("click", function () {
        if (form.classList.contains("hidden")) {
          openForm();
        } else {
          closeForm();
        }
      });

      closeBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        closeForm();
      });

      form.addEventListener("click", function (e) {
        e.stopPropagation();
      });

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var val = parseFloat(input.value);
        if (val > 0) {
          addExpense(cat.id, val);
        }
      });

      li.appendChild(row);
      li.appendChild(form);
      listEl.appendChild(li);
    });
  }

  var now0 = new Date();
  var calendarViewYear = now0.getFullYear();
  var calendarViewMonth = now0.getMonth();

  function renderCalendar() {
    var titleEl = document.getElementById("calTitle");
    var gridEl = document.getElementById("calendarGrid");
    gridEl.innerHTML = "";

    var monthName = MONTHS_FULL[calendarViewMonth];
    titleEl.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1) + " " + calendarViewYear;

    var firstOfMonth = new Date(calendarViewYear, calendarViewMonth, 1);
    var jsWeekday = firstOfMonth.getDay();
    var mondayIndex = (jsWeekday + 6) % 7;
    var daysInMonth = new Date(calendarViewYear, calendarViewMonth + 1, 0).getDate();
    var today = todayKey();

    for (var i = 0; i < mondayIndex; i++) {
      var blank = document.createElement("div");
      blank.className = "cal-cell empty";
      gridEl.appendChild(blank);
    }

    for (var d = 1; d <= daysInMonth; d++) {
      let dateKey = calendarViewYear + "-" + pad(calendarViewMonth + 1) + "-" + pad(d);
      var cell = document.createElement("div");
      cell.className = "cal-cell";

      var numEl = document.createElement("div");
      numEl.className = "cal-day-num";
      numEl.textContent = d;
      cell.appendChild(numEl);

      if (dateKey === today) {
        cell.classList.add("today");
      }

      if (dateKey < today && state.budgetSetDate && dateKey >= state.budgetSetDate) {
        var spent = dayTotal(dateKey);
        var eff = effectiveBudget(dateKey);
        var amtEl = document.createElement("div");
        amtEl.className = "cal-amount";
        amtEl.textContent = formatNumber(spent);
        cell.appendChild(amtEl);
        cell.classList.add(spent <= eff ? "cal-under" : "cal-over");
        cell.classList.add("clickable");
        cell.addEventListener("click", function () {
          showDayDetail(dateKey);
        });
      } else if (dateKey > today) {
        cell.classList.add("cal-future");
      }

      gridEl.appendChild(cell);
    }
  }

  function showDayDetail(dateKey) {
    var spent = dayTotal(dateKey);
    var eff = effectiveBudget(dateKey);
    var over = spent > eff;

    var d = new Date(dateKey + "T00:00:00");
    document.getElementById("dayModalDate").textContent =
      d.getDate() + " " + MONTHS_GEN[d.getMonth()] + " " + d.getFullYear();

    var summaryEl = document.getElementById("dayModalSummary");
    summaryEl.innerHTML = "";

    var spentLine = document.createElement("div");
    spentLine.className = "day-modal-spent" + (over ? " over" : "");
    spentLine.textContent = "Потрачено: " + formatMoney(spent);

    var budgetLine = document.createElement("div");
    budgetLine.className = "day-modal-budget";
    budgetLine.textContent = "Бюджет на день: " + formatMoney(eff);

    var diffLine = document.createElement("div");
    diffLine.className = "day-modal-diff" + (over ? " over" : "");
    diffLine.textContent = over
      ? "Превышено на " + formatMoney(spent - eff)
      : "Осталось " + formatMoney(eff - spent);

    summaryEl.appendChild(spentLine);
    summaryEl.appendChild(budgetLine);
    summaryEl.appendChild(diffLine);

    var listEl = document.getElementById("dayModalList");
    listEl.innerHTML = "";
    var dayExpenses = state.expenses[dateKey] || {};
    var hasAny = false;

    state.categories.forEach(function (cat) {
      var amt = dayExpenses[cat.id] || 0;
      if (amt <= 0) return;
      hasAny = true;

      var li = document.createElement("li");
      li.className = "day-modal-item";
      li.style.setProperty("--cat-color", cat.color);

      var icon = document.createElement("span");
      icon.className = "day-modal-icon";
      icon.textContent = cat.icon || DEFAULT_ICON;

      var name = document.createElement("span");
      name.className = "day-modal-name";
      name.textContent = cat.name;

      var amount = document.createElement("span");
      amount.className = "day-modal-amount";
      amount.textContent = formatMoney(amt);

      li.appendChild(icon);
      li.appendChild(name);
      li.appendChild(amount);
      listEl.appendChild(li);
    });

    if (!hasAny) {
      var empty = document.createElement("li");
      empty.className = "empty-state";
      empty.textContent = "В этот день расходов не было.";
      listEl.appendChild(empty);
    }

    document.getElementById("dayModal").classList.remove("hidden");
  }

  function hideDayDetail() {
    document.getElementById("dayModal").classList.add("hidden");
  }

  function render() {
    effectiveCache = {};
    document.getElementById("dateLabel").textContent = formatDateLabel();

    var setupEl = document.getElementById("budgetSetup");
    var mainEl = document.getElementById("mainView");

    if (!state.dailyBudget) {
      setupEl.classList.remove("hidden");
      mainEl.classList.add("hidden");
      return;
    }
    setupEl.classList.add("hidden");
    mainEl.classList.remove("hidden");

    var today = todayKey();
    var budget = effectiveBudget(today);
    var spent = dayTotal(today);
    var pct = budget > 0 ? Math.round((spent / budget) * 100) : (spent > 0 ? 100 : 0);

    renderRing(spent, budget, pct);

    document.getElementById("budgetAmount").textContent = formatMoney(budget);

    var now = new Date();
    var savings = monthlySavings(now.getFullYear(), now.getMonth());
    var badge = document.getElementById("savingsBadge");
    if (savings > 0) {
      document.getElementById("savingsAmount").textContent = "+" + formatMoney(savings);
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }

    renderCategories(today);
    renderCalendar();

    lastAddedCategoryId = null;
  }

  var state = loadData();
  saveData();

  document.addEventListener("DOMContentLoaded", function () {
    render();

    var setupForm = document.getElementById("setupForm");
    var setupInput = document.getElementById("setupInput");
    setupForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var val = parseFloat(setupInput.value);
      if (val > 0) {
        setBudget(val);
      }
    });

    var addBtn = document.getElementById("addBtn");
    var addForm = document.getElementById("addForm");
    var addInput = document.getElementById("addInput");

    addBtn.addEventListener("click", function () {
      addForm.classList.remove("hidden");
      addBtn.classList.add("hidden");
      addInput.focus();
    });

    addForm.addEventListener("submit", function (e) {
      e.preventDefault();
      addCategory(addInput.value);
      addInput.value = "";
      addForm.classList.add("hidden");
      addBtn.classList.remove("hidden");
    });

    document.getElementById("editBudgetBtn").addEventListener("click", function () {
      var val = window.prompt("Дневной бюджет, ₸", state.dailyBudget || "");
      if (val === null) return;
      var num = parseFloat(val);
      if (num > 0) {
        setBudget(num);
      }
    });

    document.getElementById("calPrev").addEventListener("click", function () {
      calendarViewMonth--;
      if (calendarViewMonth < 0) {
        calendarViewMonth = 11;
        calendarViewYear--;
      }
      renderCalendar();
    });

    document.getElementById("calNext").addEventListener("click", function () {
      calendarViewMonth++;
      if (calendarViewMonth > 11) {
        calendarViewMonth = 0;
        calendarViewYear++;
      }
      renderCalendar();
    });

    document.getElementById("dayModalClose").addEventListener("click", hideDayDetail);
    document.getElementById("dayModalBackdrop").addEventListener("click", hideDayDetail);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hideDayDetail();
    });
  });
})();
