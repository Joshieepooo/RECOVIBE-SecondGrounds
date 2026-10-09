(function () {
  "use strict";

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const legendSets = {
    student: [
      ["official", "PUP Official"],
      ["binan", "PUP Biñan"],
      ["cite", "PUP CITE"],
      ["ibits", "IBITS"],
      ["faculty", "Teachers/Faculty"],
      ["external", "Others/External"],
      ["holiday", "Philippine Holiday"],
    ],
    teacher: [
      ["official", "PUP Official"],
      ["binan", "PUP Biñan"],
      ["cite", "PUP CITE"],
      ["organizer", "Event Organizer"],
      ["external", "Others/External"],
      ["holiday", "Philippine Holiday"],
    ],
    organizer: [
      ["official", "PUP Official"],
      ["binan", "PUP Biñan"],
      ["cite", "PUP CITE"],
      ["organizer", "Event Organizer"],
      ["external", "Others/External"],
      ["holiday", "Philippine Holiday"],
    ],
  };

  let holidays = [];
  let holidayRequestKey = "";
  let holidayRequestSequence = 0;

  function holidayDiagnosticsEnabled() {
    try {
      return (
        new URLSearchParams(location.search).get("debugHolidays") === "1" ||
        localStorage.getItem("recovibeDebugHolidays") === "true"
      );
    } catch {
      return new URLSearchParams(location.search).get("debugHolidays") === "1";
    }
  }

  function renderLegends() {
    const calendar = document.querySelector(".calendar-page");
    const side = document.querySelector(".calendar-side");
    if (!calendar || !side) return;

    let legend = document.getElementById("calendarLegend");
    if (!legend) {
      legend = document.createElement("section");
      legend.id = "calendarLegend";
      legend.className = "calendar-side-panel cal-legend";
      side.appendChild(legend);
    }

    const kind = legend.dataset.calendarLegend || "student";
    const entries = legendSets[kind] || legendSets.student;
    legend.innerHTML = [
      '<span class="legend-title">Calendar legend</span>',
      ...entries.map(
        ([type, label]) =>
          `<span class="legend-item"><span class="dot dot-${type}" aria-hidden="true"></span>${label}</span>`,
      ),
    ].join("");
  }

  function renderGrid() {
    const monthSelect = document.getElementById("calMonthSelect");
    const yearSelect = document.getElementById("calYearSelect");
    const grid = document.getElementById("calFullDays");
    const list = document.getElementById("calendarListView");
    if (!monthSelect || !yearSelect || !grid || !list) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    if (!monthSelect.options.length) {
      monthSelect.innerHTML = months
        .map((name, index) => `<option value="${index}">${name}</option>`)
        .join("");
    }
    if (!yearSelect.options.length) {
      yearSelect.innerHTML = Array.from(
        { length: 21 },
        (_, index) => year - 10 + index,
      )
        .map(
          (optionYear) =>
            `<option value="${optionYear}">${optionYear}</option>`,
        )
        .join("");
    }
    monthSelect.value = String(month);
    yearSelect.value = String(year);

    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let index = 0; index < firstWeekday; index += 1) {
      cells.push(
        '<div class="cal-day-full is-muted" aria-hidden="true"></div>',
      );
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push(
        `<div class="cal-day-full" data-date="${iso}" data-iso="${iso}" tabindex="0" aria-label="${months[month]} ${day}, ${year}: no events"><span class="day-num">${day}</span><span class="calendar-day-empty">No events</span></div>`,
      );
    }
    while (cells.length % 7 !== 0) {
      cells.push(
        '<div class="cal-day-full is-muted" aria-hidden="true"></div>',
      );
    }

    grid.innerHTML = cells.join("");
    list.innerHTML =
      '<div class="calendar-list-empty">No events for this month.</div>';
  }

  function applyHolidayMarkers() {
    const holidaysByDate = new Map();
    holidays.forEach((holiday) => {
      const names = holidaysByDate.get(holiday.date) || [];
      names.push(holiday.title || holiday.name);
      holidaysByDate.set(holiday.date, names);
    });
    const cellsByDate = new Map();
    document.querySelectorAll("#calFullDays [data-date]").forEach((cell) => {
      cellsByDate.set(cell.dataset.date, cell);
      const names = holidaysByDate.get(cell.dataset.date) || [];
      cell.classList.toggle("is-holiday", names.length > 0);
      cell
        .querySelectorAll(".calendar-badge.badge-holiday")
        .forEach((badge) => badge.remove());
      const visibleEventCount =
        cell.querySelectorAll(".event-dots .dot").length;
      const overflowCount = Number(
        cell.querySelector(".event-dot-overflow")?.textContent.replace("+", ""),
      );
      const eventCount = visibleEventCount + (overflowCount || 0);
      const hasHolidayEvent = Boolean(cell.querySelector(".dot-holiday"));
      const day = cell.querySelector(".day-num")?.textContent || "";
      const labels = [
        `${months[Number(cell.dataset.date.slice(5, 7)) - 1]} ${day}`,
        eventCount
          ? `${eventCount} event${eventCount === 1 ? "" : "s"}`
          : "no events",
        ...names,
      ];
      cell.setAttribute("aria-label", labels.join("; "));
      names
        .filter(() => !hasHolidayEvent)
        .forEach((name) => {
          const badge = document.createElement("span");
          badge.className = "calendar-badge badge-holiday";
          badge.setAttribute("role", "note");
          badge.textContent = name;
          badge.title = name;
          cell.appendChild(badge);
        });
    });

    if (holidayDiagnosticsEnabled()) {
      holidays.forEach((holiday) => {
        if (!cellsByDate.has(holiday.date)) {
          console.log("[CalendarShell] Holiday date has no matching cell", {
            holiday,
            renderedDates: [...cellsByDate.keys()],
          });
        }
      });
      console.log("[CalendarShell] Holiday-to-cell mapping", {
        holidayCount: holidays.length,
        matchedCount: holidays.filter((holiday) =>
          cellsByDate.has(holiday.date),
        ).length,
        renderedCellCount: cellsByDate.size,
      });
    }
  }

  async function loadHolidays() {
    const monthSelect = document.getElementById("calMonthSelect");
    const yearSelect = document.getElementById("calYearSelect");
    if (!monthSelect || !yearSelect) return;

    const month = Number(monthSelect.value);
    const year = Number(yearSelect.value);
    const requestKey = `${year}-${month}`;
    if (requestKey === holidayRequestKey) return;
    holidayRequestKey = requestKey;
    const requestSequence = ++holidayRequestSequence;
    holidays = [];
    applyHolidayMarkers();

    try {
      const { getPhilippineHolidaysForMonth } =
        await import("./holidayService.js");
      const result = await getPhilippineHolidaysForMonth(year, month);
      if (requestSequence !== holidayRequestSequence) return;
      holidays = result;
      applyHolidayMarkers();
    } catch (error) {
      if (requestSequence !== holidayRequestSequence) return;
      holidayRequestKey = "";
      holidays = [];
      console.warn("Calendar holiday markers are unavailable:", error);
    }
  }

  function initCalendar() {
    renderLegends();
    renderGrid();

    const grid = document.getElementById("calFullDays");
    grid &&
      new MutationObserver(applyHolidayMarkers).observe(grid, {
        childList: true,
      });

    document
      .getElementById("calMonthSelect")
      ?.addEventListener("change", loadHolidays);
    document
      .getElementById("calYearSelect")
      ?.addEventListener("change", loadHolidays);
    ["calFullPrev", "calFullNext"].forEach((id) => {
      document.getElementById(id)?.addEventListener("click", () => {
        window.setTimeout(loadHolidays, 0);
      });
    });
    document.querySelector(".cal-toggle")?.addEventListener("click", () => {
      window.setTimeout(loadHolidays, 0);
    });
    window.addEventListener("online", () => {
      holidayRequestKey = "";
      loadHolidays();
    });
    loadHolidays();
  }

  window.RecoVibeCalendarShell = {
    initCalendar,
    loadHolidays,
    renderGrid,
    renderLegends,
    setHolidays(nextHolidays) {
      holidayRequestSequence += 1;
      holidays = Array.isArray(nextHolidays) ? nextHolidays : [];
      applyHolidayMarkers();
    },
  };

  if (document.getElementById("calFullDays")) {
    initCalendar();
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCalendar, { once: true });
  }
})();
