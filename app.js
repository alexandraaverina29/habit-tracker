(function () {
  "use strict";

  var STORAGE_KEY = "habit-tracker-data";

  var DEFAULT_HABITS = [
    { id: "water", name: "Выпить воду" },
    { id: "read", name: "Прочитать 20 страниц" },
    { id: "walk", name: "Прогулка" }
  ];

  function todayKey() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function shiftDate(dateKey, days) {
    var d = new Date(dateKey + "T00:00:00");
    d.setDate(d.getDate() + days);
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function loadData() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { habits: DEFAULT_HABITS.slice(), history: {} };
    }
    try {
      var parsed = JSON.parse(raw);
      if (!parsed.habits) parsed.habits = [];
      if (!parsed.history) parsed.history = {};
      return parsed;
    } catch (e) {
      return { habits: DEFAULT_HABITS.slice(), history: {} };
    }
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function uid() {
    return "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function computeStreak(habitId) {
    var streak = 0;
    var today = todayKey();
    var doneToday = !!(state.history[today] && state.history[today][habitId]);
    var cursor = doneToday ? today : shiftDate(today, -1);

    while (true) {
      var day = state.history[cursor];
      if (day && day[habitId]) {
        streak++;
        cursor = shiftDate(cursor, -1);
      } else {
        break;
      }
    }
    return streak;
  }

  var lastToggle = null;

  function toggleHabit(habitId) {
    var today = todayKey();
    if (!state.history[today]) state.history[today] = {};
    var nowDone = !state.history[today][habitId];
    state.history[today][habitId] = nowDone;
    lastToggle = { id: habitId, action: nowDone ? "check" : "uncheck" };
    saveData();
    render();
  }

  function deleteHabit(habitId) {
    state.habits = state.habits.filter(function (h) {
      return h.id !== habitId;
    });
    saveData();
    render();
  }

  function addHabit(name) {
    var trimmed = name.trim();
    if (!trimmed) return;
    state.habits.push({ id: uid(), name: trimmed });
    saveData();
    render();
  }

  var checkIconSvg =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="20 6 9 17 4 12"></polyline></svg>';

  var MONTHS = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];

  function formatDateLabel() {
    var d = new Date();
    return d.getDate() + " " + MONTHS[d.getMonth()];
  }

  function render() {
    var today = todayKey();
    var todayHistory = state.history[today] || {};

    document.getElementById("dateLabel").textContent = formatDateLabel();

    var toggledId = lastToggle ? lastToggle.id : null;
    var toggledAction = lastToggle ? lastToggle.action : null;
    lastToggle = null;

    var listEl = document.getElementById("habitList");
    listEl.innerHTML = "";

    if (state.habits.length === 0) {
      var empty = document.createElement("li");
      empty.className = "empty-state";
      empty.textContent = "Список привычек пуст. Добавьте первую привычку.";
      listEl.appendChild(empty);
    }

    var doneCount = 0;

    state.habits.forEach(function (habit) {
      var done = !!todayHistory[habit.id];
      if (done) doneCount++;
      var streak = computeStreak(habit.id);

      var item = document.createElement("li");
      item.className = "habit-item" + (done ? " done" : "");
      if (habit.id === toggledId) {
        item.className += toggledAction === "check" ? " anim-check" : " anim-uncheck";
      }

      var check = document.createElement("span");
      check.className = "habit-check";
      check.innerHTML = checkIconSvg;

      var name = document.createElement("span");
      name.className = "habit-name";
      name.textContent = habit.name;

      var streakEl = document.createElement("span");
      streakEl.className = "habit-streak" + (streak > 0 ? " active" : "");
      streakEl.textContent = streak > 0 ? "🔥 " + streak : "";

      var del = document.createElement("button");
      del.className = "habit-delete";
      del.type = "button";
      del.setAttribute("aria-label", "Удалить привычку");
      del.textContent = "×";
      del.addEventListener("click", function (e) {
        e.stopPropagation();
        deleteHabit(habit.id);
      });

      item.appendChild(check);
      item.appendChild(name);
      item.appendChild(streakEl);
      item.appendChild(del);

      item.addEventListener("click", function () {
        toggleHabit(habit.id);
      });

      listEl.appendChild(item);
    });

    document.getElementById("progressCount").textContent =
      doneCount + " из " + state.habits.length;

    var pct = state.habits.length
      ? Math.round((doneCount / state.habits.length) * 100)
      : 0;
    document.getElementById("progressFill").style.width = pct + "%";
  }

  var state = loadData();
  saveData();

  document.addEventListener("DOMContentLoaded", function () {
    render();

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
      addHabit(addInput.value);
      addInput.value = "";
      addForm.classList.add("hidden");
      addBtn.classList.remove("hidden");
    });
  });
})();
