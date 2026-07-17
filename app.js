(function () {
  "use strict";

  var STORAGE_KEY = "budget-tracker-data";

  var DEFAULT_CATEGORIES = [
    { id: "transport", name: "Транспорт", color: "#4f8cf7" },
    { id: "coffee", name: "Кофе", color: "#8a5a34" },
    { id: "food", name: "Еда", color: "#f2994a" },
    { id: "shop", name: "Магазин", color: "#9b6bde" }
  ];

  var EXTRA_COLORS = ["#2fb4a3", "#e0588b", "#6b7280", "#c9a227", "#5b7fd6"];

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

  function loadData() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { dailyBudget: null, budgetSetDate: null, categories: DEFAULT_CATEGORIES.slice(), expenses: {} };
    }
    try {
      var parsed = JSON.parse(raw);
      if (!parsed.categories) parsed.categories = DEFAULT_CATEGORIES.slice();
      if (!parsed.expenses) parsed.expenses = {};
      if (parsed.dailyBudget === undefined) parsed.dailyBudget = null;
      if (parsed.budgetSetDate === undefined) parsed.budgetSetDate = null;
      return parsed;
    } catch (e) {
      return { dailyBudget: null, budgetSetDate: null, categories: DEFAULT_CATEGORIES.slice(), expenses: {} };
    }
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
    state.categories.push({ id: uid(), name: trimmed, color: color });
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

      var dot = document.createElement("span");
      dot.className = "cat-dot";
      dot.style.background = cat.color;

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

      row.appendChild(dot);
      row.appendChild(name);
      row.appendChild(spentEl);
      row.appendChild(closeBtn);

      var form = document.createElement("form");
      form.className = "cat-expense-form hidden";

      var input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "1";
      input.inputMode = "decimal";
      input.placeholder = "Сумма";
      input.className = "cat-expense-input";

      var submitBtn = document.createElement("button");
      submitBtn.type = "submit";
      submitBtn.className = "cat-expense-submit";
      submitBtn.textContent = "Добавить";

      form.appendChild(input);
      form.appendChild(submitBtn);

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
      var dateKey = calendarViewYear + "-" + pad(calendarViewMonth + 1) + "-" + pad(d);
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
      } else if (dateKey > today) {
        cell.classList.add("cal-future");
      }

      gridEl.appendChild(cell);
    }
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
      badge.textContent = "+" + formatMoney(savings) + " сэкономлено в этом месяце";
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
  });
})();
