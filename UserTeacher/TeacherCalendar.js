import { loadCalendarData } from "../calendarDataService.js";

(() => {
  const monthNames = [
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
  const rawEvents = [
    ...(Array.isArray(window.RECOVIBE_EVENTS) ? window.RECOVIBE_EVENTS : []),
    ...(typeof getOrganizerEvents === "function"
      ? getOrganizerEvents().map((event) => ({
          ...event,
          id: event.eventId || event.id,
          source: "Event Organizer",
        }))
      : []),
  ];
  try {
    const teacherEvents = JSON.parse(
      localStorage.getItem("recovibeTeacherEvents") || "[]",
    );
    if (Array.isArray(teacherEvents)) {
      teacherEvents
        .filter((event) => ["Approved", "Published"].includes(event.status))
        .forEach((event) => {
          rawEvents.push({
            ...event,
            id: event.eventId || event.id,
            source: event.source || "PUP Biñan",
          });
        });
    }
  } catch (error) {
    console.warn("Teacher event records could not be loaded.", error);
  }

  const baseEvents = rawEvents.reduce((list, event) => {
    const uniqueKey = event.eventId || event.id;
    if (
      !uniqueKey ||
      list.some((item) => String(item.eventId || item.id) === String(uniqueKey))
    ) {
      return list;
    }
    list.push(event);
    return list;
  }, []);
  let events = baseEvents;

  const sourceFilters = [...document.querySelectorAll("[data-event-source]")];
  const state = {
    date: new Date(),
    selectedSources: new Set(
      sourceFilters.map((filter) => filter.dataset.eventSource),
    ),
  };
  const monthSelect = document.getElementById("calMonthSelect");
  const yearSelect = document.getElementById("calYearSelect");
  const calendarDays = document.getElementById("calFullDays");
  const modal = document.getElementById("organizerModalOverlay");
  const upcomingPanel = document.querySelector(".upcoming-panel");
  const todayButton = document.querySelector(".cal-toggle");

  const toDate = (value) => {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const escape = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  const eventSort = (first, second) =>
    String(first.dateISO || "").localeCompare(String(second.dateISO || ""));

  function normalizedSource(event) {
    const source = String(
      event.source || event.organizerName || "Others / External",
    );
    if (source === "PUP Biñan" || source === "PUP Biñan Campus")
      return "PUP Biñan";
    if (
      source === "PUP Official" ||
      source === "PUP CITE" ||
      source === "Event Organizer"
    )
      return source;
    return "Others / External";
  }

  function eventDotClass(event) {
    return (
      {
        "PUP Official": "official",
        "PUP Biñan": "binan",
        "PUP CITE": "cite",
        "Event Organizer": "organizer",
        "Others / External": "external",
      }[normalizedSource(event)] || "external"
    );
  }

  function visibleEvents() {
    return events.filter((event) =>
      state.selectedSources.has(normalizedSource(event)),
    );
  }

  function buildUpcomingList() {
    const now = new Date();
    const upcoming = visibleEvents()
      .filter((event) => {
        const date = toDate(event.dateISO || event.date);
        return (
          date &&
          date >= new Date(now.getFullYear(), now.getMonth(), now.getDate())
        );
      })
      .sort(eventSort)
      .slice(0, 5);

    if (!upcomingPanel) return;

    if (!upcoming.length) {
      upcomingPanel.innerHTML =
        '<h3>Upcoming</h3><div class="upcoming-empty">No upcoming events.</div>';
      return;
    }

    const html = [
      "<h3>Upcoming</h3>",
      ...upcoming.map((event) => {
        const date = toDate(event.dateISO || event.date);
        const month = date
          ? date.toLocaleDateString("en-US", { month: "short" }).toUpperCase()
          : "TBA";
        const day = date ? date.getDate() : "";
        const sourceLabel = event.source || "Event Organizer";
        return `
          <div class="upcoming-item" data-event-id="${escape(event.eventId || event.id)}" tabindex="0" role="button">
            <div class="upcoming-date"><span>${day}</span><small>${month}</small></div>
            <div class="upcoming-copy">
              <strong>${escape(event.title || "Untitled event")}</strong>
              <span>${escape(sourceLabel)}</span>
            </div>
          </div>
        `;
      }),
    ].join("");

    upcomingPanel.innerHTML = html;
  }

  function renderCalendar() {
    const year = state.date.getFullYear();
    const month = state.date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    renderYearOptions();
    monthSelect.value = String(month);
    yearSelect.value = String(year);

    const cells = [];
    for (let index = 0; index < firstDay; index += 1) {
      cells.push({ day: "", iso: "", muted: true, events: [] });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({
        day,
        iso,
        muted: false,
        events: visibleEvents().filter(
          (event) => (event.dateISO || event.date) === iso,
        ),
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ day: "", iso: "", muted: true, events: [] });
    }

    calendarDays.innerHTML = cells
      .map((cell) => {
        const currentDate = new Date();
        const todayIso = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;
        const today = cell.iso && cell.iso === todayIso;
        const eventCount =
          cell.events && cell.events.length ? cell.events.length : 0;
        const eventDots = cell.events
          .slice(0, 4)
          .map(
            (event) =>
              `<span class="dot dot-${eventDotClass(event)}" title="${escape(event.title || "Untitled event")}"></span>`,
          )
          .join("");
        return `
        <div class="cal-day-full ${cell.muted ? "is-muted" : ""} ${eventCount ? "has-event" : ""} ${today ? "is-today" : ""}" ${cell.iso ? `data-date="${cell.iso}" data-iso="${cell.iso}" tabindex="0" aria-label="${cell.iso}: ${eventCount ? `${eventCount} event${eventCount === 1 ? "" : "s"}` : "no events"}"` : ""}>
          <span class="day-num">${cell.day || ""}</span>
          ${eventCount ? `<span class="event-dots" aria-hidden="true">${eventDots}</span>` : '<span class="calendar-day-empty">No events</span>'}
          ${
            cell.events && cell.events.length
              ? `<span class="calendar-hover-preview"><strong>${eventCount} event${eventCount > 1 ? "s" : ""}</strong>${cell.events
                  .slice(0, 3)
                  .map(
                    (event) =>
                      `<span class="calendar-hover-event"><b>${escape(event.title || "Untitled event")}</b><small>${escape(event.time || "Time TBA")}</small></span>`,
                  )
                  .join("")}</span>`
              : ""
          }
        </div>
      `;
      })
      .join("");

    buildUpcomingList();
  }

  function openEventModal(eventId) {
    const event = events.find(
      (item) => String(item.eventId || item.id) === String(eventId),
    );
    if (!event) return;
    window.RecovibeEventDetails?.open(event);
  }

  function closeModal() {
    if (modal) modal.classList.remove("is-open");
  }

  function openDay(iso) {
    const dayEvents = visibleEvents().filter(
      (event) => (event.dateISO || event.date) === iso,
    );
    if (!dayEvents.length) return;
    if (dayEvents.length === 1) {
      openEventModal(dayEvents[0].eventId || dayEvents[0].id);
      return;
    }

    const dayTitle = document.getElementById("organizerDayTitle");
    const dayList = document.getElementById("organizerDayList");
    const date = toDate(iso);
    dayTitle.textContent = date
      ? date.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : iso;
    dayList.innerHTML = dayEvents
      .map(
        (event) =>
          `<button class="day-modal-row" type="button" data-event-id="${event.eventId || event.id}"><strong>${escape(event.title || "Untitled event")}</strong><small>${escape(event.time || "Time TBA")}</small></button>`,
      )
      .join("");
    document.getElementById("organizerDayOverlay").classList.add("is-open");
  }

  function renderYearOptions() {
    const currentYear = state.date.getFullYear();
    const years = Array.from(
      { length: 21 },
      (_, index) => currentYear - 10 + index,
    );
    yearSelect.innerHTML = years
      .map((year) => `<option value="${year}">${year}</option>`)
      .join("");
  }

  function setCalendarMonth(year, month) {
    const day = Math.min(
      state.date.getDate(),
      new Date(year, month + 1, 0).getDate(),
    );
    state.date = new Date(year, month, day);
    renderCalendar();
    refreshCalendarData();
  }

  let dataRequestSequence = 0;
  async function refreshCalendarData() {
    const sequence = ++dataRequestSequence;
    const year = state.date.getFullYear();
    const month = state.date.getMonth();
    try {
      const { events: loadedEvents, holidays } = await loadCalendarData(
        baseEvents,
        year,
        month,
      );
      if (sequence !== dataRequestSequence) return;
      events = loadedEvents;
      window.RecoVibeCalendarShell?.setHolidays(holidays);
      renderCalendar();
    } catch (error) {
      console.error("Unable to refresh teacher calendar data:", error);
    }
  }

  monthSelect.innerHTML = monthNames
    .map((month, index) => `<option value="${index}">${month}</option>`)
    .join("");
  renderYearOptions();

  monthSelect.addEventListener("change", () => {
    setCalendarMonth(state.date.getFullYear(), Number(monthSelect.value));
  });

  yearSelect.addEventListener("change", () => {
    setCalendarMonth(Number(yearSelect.value), state.date.getMonth());
  });

  document.getElementById("calFullPrev").addEventListener("click", () => {
    setCalendarMonth(state.date.getFullYear(), state.date.getMonth() - 1);
  });

  document.getElementById("calFullNext").addEventListener("click", () => {
    setCalendarMonth(state.date.getFullYear(), state.date.getMonth() + 1);
  });

  todayButton.addEventListener("click", () => {
    state.date = new Date();
    renderCalendar();
    refreshCalendarData();
  });

  sourceFilters.forEach((filter) => {
    filter.addEventListener("change", () => {
      if (filter.checked) state.selectedSources.add(filter.dataset.eventSource);
      else state.selectedSources.delete(filter.dataset.eventSource);
      renderCalendar();
    });
  });

  document
    .getElementById("resetCalendarFilters")
    .addEventListener("click", () => {
      sourceFilters.forEach((filter) => {
        filter.checked = true;
        state.selectedSources.add(filter.dataset.eventSource);
      });
      renderCalendar();
    });

  calendarDays.addEventListener("click", (event) => {
    const cell = event.target.closest("[data-iso]");
    if (!cell) return;
    openDay(cell.dataset.iso);
  });

  calendarDays.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      const cell = event.target.closest("[data-iso]");
      if (cell) {
        event.preventDefault();
        openDay(cell.dataset.iso);
      }
    }
  });

  upcomingPanel.addEventListener("click", (event) => {
    const item = event.target.closest("[data-event-id]");
    if (!item) return;
    openEventModal(item.dataset.eventId);
  });

  upcomingPanel.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      const item = event.target.closest("[data-event-id]");
      if (item) {
        event.preventDefault();
        openEventModal(item.dataset.eventId);
      }
    }
  });

  document
    .getElementById("organizerDayList")
    .addEventListener("click", (event) => {
      const button = event.target.closest("[data-event-id]");
      if (!button) return;
      openEventModal(button.dataset.eventId);
      document
        .getElementById("organizerDayOverlay")
        .classList.remove("is-open");
    });

  document
    .getElementById("organizerModalClose")
    .addEventListener("click", closeModal);
  document.getElementById("organizerDayClose").addEventListener("click", () => {
    document.getElementById("organizerDayOverlay").classList.remove("is-open");
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  document
    .getElementById("organizerModalEdit")
    .addEventListener("click", (event) => {
      event.preventDefault();
      const eventId = document
        .getElementById("organizerModalEdit")
        .getAttribute("data-event-id");
      if (!eventId) return;
      const selectedEvent = events.find(
        (item) => String(item.eventId || item.id) === String(eventId),
      );
      if (selectedEvent) window.RecovibeEventDetails?.open(selectedEvent);
    });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
      document
        .getElementById("organizerDayOverlay")
        .classList.remove("is-open");
    }
  });

  try {
    const teacher = JSON.parse(
      localStorage.getItem("recovibeCurrentTeacher") || "null",
    );
    if (teacher) {
      const name = teacher.name || teacher.fullName || "Teacher";
      document.getElementById("teacherCalendarName").textContent = name;
      document.getElementById("teacherCalendarRole").textContent =
        teacher.department ||
        teacher.organization ||
        teacher.role ||
        "Faculty account";
      document.getElementById("teacherCalendarAvatar").textContent = name
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
    }
  } catch (error) {
    console.warn("Unable to read teacher account.", error);
  }
  document
    .getElementById("teacherCalendarLogout")
    .addEventListener("click", () => {
      localStorage.removeItem("recovibeCurrentTeacher");
      localStorage.removeItem("recovibeTeacherId");
    });

  window.addEventListener("online", refreshCalendarData);
  renderCalendar();
  refreshCalendarData();
})();
