(function () {
  "use strict";

  /* ---------------------------------------------------------
     DATA
  --------------------------------------------------------- */
  const EVENTS = Array.isArray(window.RECOVIBE_EVENTS)
    ? window.RECOVIBE_EVENTS
    : [];
  let calendarEvents = [...EVENTS];
  let calendarDataLoading = false;
  let calendarDataError = false;
  let calendarRequestSequence = 0;

  const RECOMMENDED = [];
  const NOTIFICATIONS = [];

  const MONTH_NAMES = [
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

  /* ---------------------------------------------------------
     STATE
  --------------------------------------------------------- */
  const today = new Date();
  const state = {
    query: "",
    calMonth: today.getMonth(),
    calYear: today.getFullYear(),
    calSelectedDate: new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ),
    sidebarCollapsed: false,
  };
  const participationStorageKey = "recovibeParticipations";
  const eventSlotsStorageKey = "recovibeEventSlots";
  const modalState = {
    selectedEvent: null,
    isDetailsOpen: false,
    isJoinConfirmOpen: false,
    isCancelConfirmOpen: false,
    isPending: false,
  };
  let previousModalFocus = null;
  let previousBodyOverflow = "";

  /* ---------------------------------------------------------
     RENDER: header date
  --------------------------------------------------------- */
  function renderTodayDate() {
    const el = document.getElementById("todayDate");
    if (!el) return;
    const opts = { year: "numeric", month: "long", day: "numeric" };
    el.textContent = today.toLocaleDateString("en-US", opts);
  }

  /* ---------------------------------------------------------
     RENDER: events
  --------------------------------------------------------- */
  function eventMetaIconClock() {
    return '<svg width="13" height="13" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.4"/><path d="M10 6v4l2.5 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  }
  function eventMetaIconPin() {
    return '<svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M10 17.5S15.5 12.8 15.5 8.5a5.5 5.5 0 1 0-11 0c0 4.3 5.5 9 5.5 9Z" stroke="currentColor" stroke-width="1.4"/><circle cx="10" cy="8.3" r="2" stroke="currentColor" stroke-width="1.4"/></svg>';
  }

  function eventDateParts(dateISO) {
    const date = new Date(`${dateISO}T00:00:00`);
    return {
      month: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
      day: date.getDate(),
      year: date.getFullYear(),
    };
  }

  function matchesFilters(ev) {
    const q = state.query.trim().toLowerCase();
    return (
      q === "" ||
      ev.title.toLowerCase().includes(q) ||
      ev.location.toLowerCase().includes(q) ||
      ev.source.toLowerCase().includes(q) ||
      ev.category.toLowerCase().includes(q)
    );
  }

  function preferredCategory(category) {
    const value = String(category || "").toLowerCase();
    if (
      value.includes("leadership") ||
      value.includes("career") ||
      value.includes("student development")
    )
      return "Leadership & Career";
    if (value.includes("sport") || value.includes("fitness"))
      return "Sports & Fitness";
    if (value.includes("tech") || value.includes("innovation"))
      return "Tech & Innovation";
    if (value.includes("art") || value.includes("culture"))
      return "Arts & Culture";
    if (value.includes("academic")) return "Academic & Learning";
    return category || "Academic & Learning";
  }

  function categoryClass(category) {
    return preferredCategory(category)
      .toLowerCase()
      .replace(/[^a-z]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function renderEvents() {
    const list = document.getElementById("eventList");
    const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const visible = EVENTS.filter(
      (ev) => ev.dateISO >= todayISO && matchesFilters(ev),
    )
      .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
      .slice(0, 3);

    if (visible.length === 0) {
      list.innerHTML = `<div class="empty-state" style="padding:24px;text-align:center;color:var(--ink-500);font-size:13.5px;border:1px dashed var(--line);border-radius:12px;">No events match “${escapeHTML(state.query)}”.</div>`;
      return;
    }

    list.innerHTML = visible
      .map((ev) => {
        const date = eventDateParts(ev.dateISO);
        return `
      <article class="event-card" id="event-card-${ev.id}" data-event-id="${ev.id}">
        <div class="event-date" id="event-date-${ev.id}" data-event-field="date">
          <span class="mon" id="event-month-${ev.id}">${date.month}</span>
          <span class="day" id="event-day-${ev.id}">${date.day}</span>
          <span class="year" id="event-year-${ev.id}">${date.year}</span>
        </div>
        <div class="event-body">
          <h3 class="event-title" id="event-title-${ev.id}" data-event-field="title">${escapeHTML(ev.title)}</h3>
          <p class="event-source" id="event-source-${ev.id}" data-event-field="source">${escapeHTML(ev.source)}</p>
          <div class="event-meta" id="event-meta-${ev.id}" data-event-field="schedule">
            <span id="event-time-${ev.id}" data-event-field="time">${eventMetaIconClock()} ${escapeHTML(ev.time)}</span>
            <span id="event-location-${ev.id}" data-event-field="location">${eventMetaIconPin()} ${escapeHTML(ev.location)} · ${escapeHTML(ev.room)}</span>
          </div>
          <div class="event-category-row" id="event-category-row-${ev.id}"><span class="category category-${categoryClass(ev.category)}" id="event-category-${ev.id}" data-event-field="category">${escapeHTML(preferredCategory(ev.category))}</span></div>
          <div class="event-foot" id="event-footer-${ev.id}">
            <span class="slots" id="event-slots-${ev.id}" data-event-field="participants">${ev.capacityMode === "N/A" ? "No capacity limit" : `${ev.slotsOpen} of ${ev.maxSlots} Slots Open`}</span>
            <button type="button" class="btn-outline event-details-trigger" id="event-details-button-${ev.id}" data-event-id="${ev.id}" aria-controls="detailsDialog">View Details</button>
          </div>
        </div>
      </article>`;
      })
      .join("");
  }

  /* ---------------------------------------------------------
     RENDER: recommended
  --------------------------------------------------------- */
  function renderRecommended() {
    const grid = document.getElementById("recGrid");
    if (!grid) return;
    const recommendedList = EVENTS.filter((event) => {
      const status = String(event.status || "").trim().toLowerCase();
      const id = String(event.id || event.eventId || "");
      return !id.startsWith("demo-event-") && status !== "cancelled" && status !== "canceled" && status !== "draft";
    }).slice(0, 4);

    if (!recommendedList.length) {
      grid.innerHTML = '<p class="rec-empty" style="grid-column: 1 / -1; color: var(--ink-500); text-align: center; padding: 28px 0; font-size: 14px;">No recommended events at this time.</p>';
      return;
    }

    grid.innerHTML = recommendedList
      .map((event) => {
        const id = event.id || event.eventId;
        const tagClass = event.category
          ? "tag-" + String(event.category).toLowerCase().replace(/[^a-z0-9]/g, "")
          : "tag-academic";
        return `
      <article class="rec-card" id="recommended-card-${id}" data-event-id="${id}">
        <h3 id="recommended-title-${id}" data-event-field="title">${escapeHTML(event.title || "Untitled event")}</h3>
        <div class="rec-source" id="recommended-source-${id}" data-event-field="source">${escapeHTML(event.source || "PUP Biñan Campus")}</div>
        <div class="rec-when" id="recommended-time-${id}" data-event-field="time">${escapeHTML(event.time || "Time TBA")}</div>
        <div class="rec-match" id="recommended-location-${id}" data-event-field="location">${escapeHTML(event.location ? `${event.location} · ${event.room || ""}` : "Location TBA")}</div>
        <span class="rec-tag ${tagClass}" id="recommended-category-${id}" data-event-field="category">${escapeHTML(preferredCategory(event.category || event.tag || "Academic & Learning"))}</span>
        <div class="rec-match" id="recommended-participants-${id}" data-event-field="participants">${event.capacityMode === "N/A" ? "No capacity limit" : event.slotsOpen !== undefined && event.maxSlots ? `${event.slotsOpen} of ${event.maxSlots} Slots Open` : (event.capacity ? `${event.capacity} Slots` : "Open registration")}</div>
        <button type="button" class="btn-outline event-details-trigger" id="recommended-details-button-${id}" data-event-id="${id}" aria-controls="detailsDialog">View Details</button>
      </article>`;
      })
      .join("");
  }

  function renderNotifications() {
    const list = document.getElementById("notifList");
    if (!list) return;
    let saved = [];
    try {
      saved = JSON.parse(localStorage.getItem("recovibeNotifications") || "[]");
      if (!Array.isArray(saved)) saved = [];
    } catch {
      saved = [];
    }
    const realNotifs = saved.filter(
      (n) =>
        n &&
        !String(n.eventId || "").includes("leadership-seminar") &&
        !String(n.eventId || "").includes("ibits-general-assembly") &&
        !String(n.id || "").includes("leadership-seminar")
    );
    if (!realNotifs.length) {
      list.innerHTML =
        '<li class="notif-item notif-empty" style="color: var(--ink-500); font-size: 13px; padding: 12px 0;">No new notifications.</li>';
      return;
    }
    list.innerHTML = realNotifs
      .slice(0, 5)
      .map(
        (n) => `
      <li class="notif-item">
        ${n.message || n.text || ""}
        <span class="notif-time">${escapeHTML(n.time || "Recently")}</span>
      </li>`,
      )
      .join("");
  }

  function calendarISO(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function calendarDate(value) {
    if (!value) return null;
    if (typeof value === "object" && typeof value.toDate === "function") {
      return calendarDate(value.toDate());
    }
    if (typeof value === "object" && Number.isFinite(value.seconds)) {
      return new Date(value.seconds * 1000);
    }
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      return date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
        ? date
        : null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function calendarEventRange(event) {
    const start = [
      event.dateISO,
      event.eventDate,
      event.date,
      event.startDate,
    ]
      .map(calendarDate)
      .filter(Boolean)
      .map(calendarISO)[0] || "";
    const end = [
      event.endDateISO,
      event.eventEndDate,
      event.endDate,
      event.dateEnd,
      event.end,
    ]
      .map(calendarDate)
      .filter(Boolean)
      .map(calendarISO)[0] || start;
    return start ? { start, end: end >= start ? end : start } : null;
  }

  function calendarEventsOn(iso) {
    return calendarEvents.filter((event) => {
      const range = calendarEventRange(event);
      return Boolean(range && range.start <= iso && iso <= range.end);
    });
  }

  function calendarCategory(event) {
    const categories = {
      pupofficial: "PUP Official",
      official: "PUP Official",
      pupbinan: "PUP Biñan Campus",
      pupbinancampus: "PUP Biñan Campus",
      pupcite: "PUP CITE",
      cite: "PUP CITE",
      ibits: "IBITS",
      teachersfaculty: "Teachers/Faculty",
      teacherfaculty: "Teachers/Faculty",
      faculty: "Teachers/Faculty",
      othersexternal: "Others/External",
      otherexternal: "Others/External",
      eventorganizer: "Others/External",
      holiday: "Philippine Holiday",
      philippineholiday: "Philippine Holiday",
    };
    for (const source of [
      event.category,
      event.eventSource,
      event.source,
      event.organization,
    ]) {
      const key = String(source || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      if (categories[key]) return categories[key];
    }
    return "Others/External";
  }

  function calendarCategoryColor(event) {
    return (
      {
        "PUP Official": "#8f2536",
        "PUP Biñan Campus": "#3a76c4",
        "PUP CITE": "#c79a2b",
        IBITS: "#7c5cc4",
        "Teachers/Faculty": "#1e9a73",
        "Others/External": "#64748b",
        "Philippine Holiday": "#d97706",
      }[calendarCategory(event)] || "#7a1f2e"
    );
  }

  function renderSelectedCalendarDay() {
    const list = document.getElementById("calDayEvents");
    if (!list) return;
    const iso = calendarISO(state.calSelectedDate);
    const label = state.calSelectedDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const dayEvents = calendarEventsOn(iso);
    const message = calendarDataLoading
      ? '<p class="cal-day-status">Loading events…</p>'
      : calendarDataError
        ? '<p class="cal-day-status">Some calendar data could not be refreshed.</p>'
        : "";
    const eventList = dayEvents.length
      ? `<ul class="cal-selected-events">${dayEvents
          .map(
            (event) => `
              <li>
                <a href="Calendar.html" class="cal-selected-event">
                  <span class="cal-event-marker" aria-hidden="true" style="background:${calendarCategoryColor(event)}"></span>
                  <span class="cal-selected-event-copy">
                    <strong>${escapeHTML(event.title || "Untitled event")}</strong>
                    <small>${escapeHTML(event.time || "All day")} · ${escapeHTML(calendarCategory(event))}</small>
                  </span>
                </a>
              </li>`,
          )
          .join("")}</ul>`
      : calendarDataLoading
        ? ""
        : `<p class="cal-day-empty">No events on this day.</p>`;
    list.innerHTML = `
      <div class="cal-day-events-heading">${escapeHTML(label)}</div>
      ${message}
      ${eventList}
    `;
  }

  function renderCalendar() {
    const label = document.getElementById("calMonthLabel");
    label.textContent = `${MONTH_NAMES[state.calMonth]} ${state.calYear}`;

    const firstOfMonth = new Date(state.calYear, state.calMonth, 1);
    const gridStart = new Date(
      state.calYear,
      state.calMonth,
      1 - firstOfMonth.getDay(),
    );
    const todayISO = calendarISO(today);
    const selectedISO = calendarISO(state.calSelectedDate);
    const cells = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + index,
      );
      const iso = calendarISO(date);
      return {
        date,
        iso,
        events: calendarEventsOn(iso),
        muted: date.getMonth() !== state.calMonth,
        isToday: iso === todayISO,
        isSelected: iso === selectedISO,
      };
    });

    const grid = document.getElementById("calDays");
    grid.innerHTML = cells
      .map((cell) => {
        const classes = ["cal-day"];
        if (cell.muted) classes.push("is-muted");
        if (cell.events.length) classes.push("has-event");
        if (cell.isToday) classes.push("is-today");
        if (cell.isSelected) classes.push("is-selected");
        const dayLabel = cell.date.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
        const dots = cell.events
          .slice(0, 3)
          .map(
            (event) =>
              `<span class="cal-event-dot" aria-hidden="true" style="background:${calendarCategoryColor(event)}"></span>`,
          )
          .join("");
        const overflow = cell.events.length > 3
          ? '<span class="cal-event-overflow" aria-hidden="true">+</span>'
          : "";
        return `<button type="button" id="dashboard-calendar-day-${cell.iso}" class="${classes.join(" ")}" data-calendar-date="${cell.iso}" data-calendar-field="date" aria-label="${escapeHTML(dayLabel)}, ${cell.events.length} event${cell.events.length === 1 ? "" : "s"}" aria-pressed="${cell.isSelected}"><span class="cal-day-number">${cell.date.getDate()}</span>${cell.events.length ? `<span class="cal-day-indicators" aria-hidden="true">${dots}${overflow}</span>` : ""}</button>`;
      })
      .join("");
    renderSelectedCalendarDay();
  }

  function shiftMonth(delta) {
    const nextMonth = new Date(state.calYear, state.calMonth + delta, 1);
    state.calMonth = nextMonth.getMonth();
    state.calYear = nextMonth.getFullYear();
    const selectedDay = Math.min(
      state.calSelectedDate.getDate(),
      new Date(state.calYear, state.calMonth + 1, 0).getDate(),
    );
    state.calSelectedDate = new Date(state.calYear, state.calMonth, selectedDay);
    renderCalendar();
    refreshPreviewCalendarData();
  }

  async function refreshPreviewCalendarData() {
    const request = ++calendarRequestSequence;
    calendarDataLoading = true;
    calendarDataError = false;
    renderSelectedCalendarDay();
    try {
      const { loadCalendarData } = await import("../calendarDataService.js");
      const sourceEvents = Array.isArray(window.RECOVIBE_EVENTS)
        ? window.RECOVIBE_EVENTS
        : [];
      const { events, holidays } = await loadCalendarData(
        sourceEvents,
        state.calYear,
        state.calMonth,
      );
      if (request !== calendarRequestSequence) return;
      const holidayEvents = holidays.map((holiday) => ({
        id: `holiday:${holiday.date}:${holiday.title}`,
        eventId: `holiday:${holiday.date}:${holiday.title}`,
        title: holiday.title,
        dateISO: holiday.date,
        source: "Philippine Holiday",
        status: "published",
        time: "All day",
      }));
      calendarEvents = [...events, ...holidayEvents];
    } catch (error) {
      if (request !== calendarRequestSequence) return;
      console.error("Unable to refresh dashboard calendar preview:", error);
      calendarDataError = true;
    } finally {
      if (request === calendarRequestSequence) {
        calendarDataLoading = false;
        renderCalendar();
      }
    }
  }

  function selectCalendarDay(iso) {
    const date = calendarDate(iso);
    if (!date) return;
    state.calSelectedDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    const changedMonth =
      date.getMonth() !== state.calMonth || date.getFullYear() !== state.calYear;
    state.calMonth = date.getMonth();
    state.calYear = date.getFullYear();
    renderCalendar();
    if (changedMonth) refreshPreviewCalendarData();
  }

  /* ---------------------------------------------------------
     MODAL
  --------------------------------------------------------- */
  const modalOverlay = document.getElementById("modalOverlay");
  const detailsDialog = document.getElementById("detailsDialog");
  const modalContent = document.getElementById("modalContent");
  const modalAction = document.getElementById("modalAction");
  const modalActionNotice = document.getElementById("modalActionNotice");
  const confirmOverlay = document.getElementById("confirmOverlay");
  const confirmDialog = document.getElementById("confirmDialog");
  const confirmTitle = document.getElementById("confirmTitle");
  const confirmMessage = document.getElementById("confirmMessage");
  const confirmError = document.getElementById("confirmError");
  const confirmPrimary = document.getElementById("confirmPrimary");
  const confirmCancel = document.getElementById("confirmCancel");

  function readParticipationIds() {
    try {
      const stored = JSON.parse(
        localStorage.getItem(participationStorageKey) || "[]",
      );
      return new Set(Array.isArray(stored) ? stored.map(String) : []);
    } catch (error) {
      return new Set();
    }
  }

  function readStoredSlots() {
    try {
      const stored = JSON.parse(
        localStorage.getItem(eventSlotsStorageKey) || "{}",
      );
      return stored && typeof stored === "object" && !Array.isArray(stored)
        ? stored
        : {};
    } catch (error) {
      return {};
    }
  }

  function eventCapacity(event) {
    return Math.max(
      0,
      Number(event.maxSlots ?? event.capacity ?? event.slots ?? 0) || 0,
    );
  }

  function availableSlots(event, storedSlots = readStoredSlots()) {
    const saved = storedSlots[String(event.id)];
    const current =
      saved !== undefined
        ? saved
        : (event.slotsOpen ??
          event.availableSlots ??
          event.slots ??
          eventCapacity(event));
    return Math.max(0, Number(current) || 0);
  }

  function syncSavedSlots() {
    const storedSlots = readStoredSlots();
    EVENTS.forEach((event) => {
      if (storedSlots[String(event.id)] !== undefined)
        event.slotsOpen = availableSlots(event, storedSlots);
    });
  }

  function toItems(value) {
    if (value == null || value === "") return [];
    const values = Array.isArray(value) ? value : [value];
    return values.flatMap((item) =>
      typeof item === "string"
        ? item
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
        : item == null
          ? []
          : [item],
    );
  }

  function itemText(item) {
    return typeof item === "object"
      ? item.name ||
          item.title ||
          item.label ||
          item.filename ||
          item.fileName ||
          ""
      : item;
  }

  function renderBulletList(items, emptyText = "Not specified") {
    const values = toItems(items).map(itemText).filter(Boolean);
    return values.length
      ? `<ul class="dashboard-event-list">${values.map((value) => `<li>${escapeHTML(value)}</li>`).join("")}</ul>`
      : `<p>${escapeHTML(emptyText)}</p>`;
  }

  function formatEventDate(value) {
    if (!value) return "Not specified";
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? String(value)
      : `${String(date.getMonth() + 1).padStart(2, "0")} / ${String(date.getDate()).padStart(2, "0")} / ${date.getFullYear()}`;
  }

  function formatTime(value) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
    if (!match) return String(value || "").trim();
    const hour = Number(match[1]);
    const suffix = hour >= 12 ? "PM" : "AM";
    return `${String(hour % 12 || 12).padStart(2, "0")}:${match[2]} ${suffix}`;
  }

  function eventTimes(event) {
    if (event.startTime || event.endTime) {
      return [
        formatTime(event.startTime) || "Not specified",
        formatTime(event.endTime) || "Not specified",
      ];
    }
    const parts = String(event.time || "").split(/\s*[-–]\s*/);
    return [parts[0] || "Not specified", parts[1] || "Not specified"];
  }

  function categoryTone(category) {
    const value = String(category || "").toLowerCase();
    if (
      value.includes("social") ||
      value.includes("arts") ||
      value.includes("culture")
    )
      return "purple";
    if (
      value.includes("university") ||
      value.includes("campus") ||
      value.includes("community")
    )
      return "green";
    if (
      value.includes("academic") ||
      value.includes("tech") ||
      value.includes("innovation")
    )
      return "blue";
    if (value.includes("sport") || value.includes("fitness")) return "orange";
    return "maroon";
  }

  function contactDetails(event) {
    const raw = event.contactPerson || event.contactName || "";
    const parts = String(raw)
      .split(/[\n,|]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    const parsedEmail = parts.find((part) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(part),
    );
    const parsedPhone = parts.find(
      (part) => /\+?[\d() -]{7,}/.test(part) && /\d{7}/.test(part),
    );
    const name =
      event.contactName ||
      parts.find((part) => part !== parsedEmail && part !== parsedPhone) ||
      event.organizerName ||
      "Not specified";
    const role =
      event.contactRole ||
      parts.find(
        (part) => part !== name && part !== parsedEmail && part !== parsedPhone,
      ) ||
      "";
    return {
      name,
      role,
      email: event.contactEmail || parsedEmail || "",
      phone: event.contactPhone || parsedPhone || "",
    };
  }

  function attachmentMarkup(event) {
    const attachments = toItems(
      event.attachments ||
        event.participantDocuments ||
        event.participantDocs ||
        event.registrationDocuments,
    );
    if (!attachments.length) return `<p>No files attached.</p>`;
    return `<div class="dashboard-attachments">${attachments
      .map((item) => {
        const name = itemText(item);
        const href =
          typeof item === "object"
            ? item.url ||
              item.href ||
              item.downloadUrl ||
              item.fileUrl ||
              item.dataUrl ||
              ""
            : /^(https?:|blob:|data:|\.\.?\/|\/)/i.test(String(item))
              ? item
              : "";
        const safeHref = /^(https?:|blob:|data:|\.\.?\/|\/)/i.test(String(href))
          ? href
          : "";
        const fileId =
          typeof item === "object" && (item.fileId || item.id)
            ? item.fileId || item.id
            : "";
        const icon = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5v10m0 0 3.5-3.5M10 12.5 6.5 9M3.5 13.5v3h13v-3"/></svg>`;
        const download = safeHref
          ? `<a href="${escapeHTML(safeHref)}" download="${escapeHTML(name)}" aria-label="Download ${escapeHTML(name)}" title="Download ${escapeHTML(name)}">${icon}</a>`
          : fileId
            ? `<a href="#" data-dashboard-file-id="${escapeHTML(fileId)}" download="${escapeHTML(name)}" aria-label="Download ${escapeHTML(name)}" title="Download ${escapeHTML(name)}">${icon}</a>`
            : `<span title="Download link unavailable" aria-label="Download unavailable">${icon}</span>`;
        return `<div class="dashboard-attachment"><span>${escapeHTML(name)}</span>${download}</div>`;
      })
      .join("")}</div>`;
  }

  function eventHasStarted(event, now = new Date()) {
    const eventDate = String(event.dateISO || event.date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return false;
    const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (eventDate < todayDate) return true;
    if (eventDate > todayDate) return false;
    const [start] = eventTimes(event);
    const minutes = timeInMinutes(start);
    return (
      minutes !== null && now.getHours() * 60 + now.getMinutes() >= minutes
    );
  }

  function eventHasEnded(event, now = new Date()) {
    const eventDate = String(event.dateISO || event.date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return false;
    const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (eventDate < todayDate) return true;
    if (eventDate > todayDate) return false;
    const [, end] = eventTimes(event);
    const minutes = timeInMinutes(end);
    return (
      minutes !== null && now.getHours() * 60 + now.getMinutes() >= minutes
    );
  }

  function timeInMinutes(value) {
    const text = String(value || "").trim();
    const twelveHour = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(text);
    if (twelveHour) {
      let hour = Number(twelveHour[1]) % 12;
      if (twelveHour[3].toUpperCase() === "PM") hour += 12;
      return hour * 60 + Number(twelveHour[2]);
    }
    const twentyFourHour = /^(\d{1,2}):(\d{2})$/.exec(text);
    return twentyFourHour
      ? Number(twentyFourHour[1]) * 60 + Number(twentyFourHour[2])
      : null;
  }

  function actionBlockReason(event, action) {
    const deadline = event.registrationDeadline
      ? new Date(String(event.registrationDeadline).replace(/[—–]/g, " "))
      : null;
    if (
      deadline &&
      !Number.isNaN(deadline.getTime()) &&
      Date.now() > deadline.getTime()
    )
      return "The registration deadline has passed.";
    if (action === "join" && availableSlots(event) <= 0)
      return "This event is full.";
    if (eventHasStarted(event) || eventHasEnded(event))
      return "This event has already started or ended.";
    return "";
  }

  function renderEventDetails(event) {
    const categories = toItems(event.categories || event.category || event.tag);
    const categoryPills = categories.length
      ? categories
          .map(
            (category) =>
              `<span class="dashboard-category-pill dashboard-category-pill--${categoryTone(category)}">${escapeHTML(itemText(category))}</span>`,
          )
          .join("")
      : `<span class="dashboard-category-pill dashboard-category-pill--maroon">General</span>`;
    const [startTime, endTime] = eventTimes(event);
    const capacity = eventCapacity(event);
    const slots = availableSlots(event);
    const participants =
      capacity == null ? null : Math.max(0, capacity - slots);
    const weatherContingency =
      /open field|outside|outdoor/i.test(
        [event.venue, event.venueOther, event.location, event.room]
          .filter(Boolean)
          .join(" "),
      )
        ? "Outside – Might Rain."
        : "No rain concerns.";
    const venue = [event.location || event.venue || "Not specified", event.room]
      .filter(Boolean)
      .join(" · ");
    const description =
      event.description || event.desc || event.about || "Not specified";
    const descriptionParagraphs = String(description)
      .split(/\n\s*\n/)
      .map((text) => text.trim())
      .filter(Boolean);
    const requirementData =
      event.requirements &&
      typeof event.requirements === "object" &&
      !Array.isArray(event.requirements)
        ? [
            ...toItems(event.requirements.required),
            ...toItems(event.requirements.recommended),
            ...toItems(event.reminders),
          ]
        : [
            ...toItems(event.requirements || event.requirementsList),
            ...toItems(event.reminders),
          ];
    const contact = contactDetails(event);
    const contactMarkup = `<p><strong>${escapeHTML(contact.name)}</strong></p>${contact.role ? `<p>${escapeHTML(contact.role)}</p>` : ""}${contact.email ? `<p><a href="mailto:${escapeHTML(contact.email)}">${escapeHTML(contact.email)}</a></p>` : ""}${contact.phone ? `<p>${escapeHTML(contact.phone)}</p>` : ""}`;
    const infoIcon = (name) => {
      const paths = {
        date: '<rect x="3" y="4.5" width="14" height="13" rx="1.5"/><path d="M6 2.5v4M14 2.5v4M3 8h14"/>',
        time: '<circle cx="10" cy="10" r="7"/><path d="M10 6v4l2.5 2"/>',
        venue:
          '<path d="M10 17.5S15.5 12.8 15.5 8.5a5.5 5.5 0 1 0-11 0c0 4.3 5.5 9 5.5 9Z"/><circle cx="10" cy="8.3" r="2"/>',
        capacity:
          '<circle cx="7" cy="7" r="2.5"/><path d="M2.5 16a4.5 4.5 0 0 1 9 0M13 5a2.5 2.5 0 0 1 0 4.8M13 12a4 4 0 0 1 4.5 4"/>',
      }[name];
      return `<svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
    };

    modalContent.innerHTML = `
      <div class="dashboard-event-top">
        <div>
          <h2 class="dashboard-event-title" id="modalTitle">${escapeHTML(event.title || "Untitled event")}</h2>
          <p class="dashboard-event-organizer"><strong>Event Organizer:</strong> ${escapeHTML(event.organizerName || event.organizer || event.organization || event.source || "Not specified")}</p>
          <p class="dashboard-event-source"><strong>Source:</strong> ${escapeHTML(event.source || event.campus || event.office || "Not specified")}</p>
        </div>
        <div><p class="dashboard-category-label">Categories:</p><div class="dashboard-event-categories">${categoryPills}</div></div>
      </div>
      <div class="dashboard-event-info">
        <div class="dashboard-info-item">${infoIcon("date")}<strong>Date</strong>${escapeHTML(formatEventDate(event.dateISO || event.date))}</div>
        <div class="dashboard-info-item">${infoIcon("time")}<strong>Start time</strong>${escapeHTML(startTime)}</div>
        <div class="dashboard-info-item">${infoIcon("time")}<strong>End time</strong>${escapeHTML(endTime)}</div>
        <div class="dashboard-info-item">${infoIcon("venue")}<strong>Venue</strong>${escapeHTML(venue)}</div>
        <div class="dashboard-info-item">${infoIcon("capacity")}<strong>Max Capacity ${capacity}</strong>${slots} slots open<small>${participants} participants · ${slots} of ${capacity} slots open</small></div>
      </div>
      <div class="dashboard-event-facts">
        <div class="dashboard-event-fact"><strong>Registration Deadline</strong>${escapeHTML(event.registrationDeadline || "Not specified")}</div>
        <div class="dashboard-event-fact"><strong>Weather Contingency</strong>${escapeHTML(weatherContingency)}</div>
        <div class="dashboard-event-fact"><strong>Attendance Required</strong>${escapeHTML(event.attendanceRequired || "Not specified")}</div>
      </div>
      <section class="dashboard-event-section dashboard-event-description"><h3>Event Description</h3>${descriptionParagraphs.map((paragraph) => `<p>${escapeHTML(paragraph)}</p>`).join("")}</section>
      <div class="dashboard-event-two-col">
        <section class="dashboard-event-section"><h3>Event Key Details</h3>${renderBulletList(event.keyDetails || event.detailedInfo || event.focusAreas)}</section>
        <section class="dashboard-event-section"><h3>Requirements &amp; Reminders</h3>${renderBulletList(requirementData)}</section>
      </div>
      <div class="dashboard-event-two-col">
        <section class="dashboard-event-section"><h3>Participation Rules</h3>${renderBulletList(event.participationRules || event.rules)}</section>
        <section class="dashboard-event-section dashboard-contact"><h3>Contact Person</h3>${contactMarkup}</section>
      </div>
      <section class="dashboard-event-section"><h3>Participant Documents</h3><p>Participants should download and fill this up before joining the event.</p>${attachmentMarkup(event)}</section>`;
  }

  function updateDetailsAction() {
    const event = modalState.selectedEvent;
    if (!event) return;
    const isRegistered = readParticipationIds().has(String(event.id));
    const action = isRegistered ? "cancel" : "join";
    const reason = actionBlockReason(event, action);
    modalAction.textContent = modalState.isPending
      ? "Processing..."
      : isRegistered
        ? "Cancel Participation"
        : "Participate Now";
    modalAction.classList.toggle("is-cancel", isRegistered);
    modalAction.disabled = modalState.isPending || Boolean(reason);
    modalAction.title = reason || "";
    modalAction.setAttribute(
      "aria-label",
      reason
        ? `${modalAction.textContent}. ${reason}`
        : modalAction.textContent,
    );
    modalActionNotice.textContent = reason;
  }

  function openEventModal(id) {
    const ev =
      EVENTS.find((event) => String(event.id) === String(id)) ||
      eventFromRecommended(id);
    if (!ev) return;
    modalState.selectedEvent = ev;
    modalState.isDetailsOpen = true;
    modalState.isJoinConfirmOpen = false;
    modalState.isCancelConfirmOpen = false;
    modalState.isPending = false;
    previousModalFocus = document.activeElement;
    previousBodyOverflow = document.body.style.overflow;
    syncSavedSlots();
    renderEventDetails(ev);
    updateDetailsAction();
    document.body.style.overflow = "hidden";
    modalOverlay.setAttribute("aria-hidden", "false");
    modalOverlay.classList.add("is-open");
    detailsDialog.focus();
  }

  function eventFromRecommended(id) {
    return EVENTS.find((event) => String(event.id) === String(id));
  }

  function closeModal() {
    if (modalState.isJoinConfirmOpen || modalState.isCancelConfirmOpen)
      closeConfirmation(false);
    modalState.isDetailsOpen = false;
    modalState.selectedEvent = null;
    modalOverlay.classList.remove("is-open");
    modalOverlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = previousBodyOverflow;
    if (previousModalFocus && typeof previousModalFocus.focus === "function")
      previousModalFocus.focus();
  }

  function openConfirmation(action) {
    if (!modalState.selectedEvent || modalState.isPending) return;
    modalState.isJoinConfirmOpen = action === "join";
    modalState.isCancelConfirmOpen = action === "cancel";
    confirmTitle.textContent =
      action === "join" ? "Join Event?" : "Cancel Participation?";
    confirmMessage.textContent =
      action === "join"
        ? `Are you sure you want to join the ${modalState.selectedEvent.title}? By confirming, you will be registered as a participant for this event.`
        : `Are you sure you want to cancel your participation in the ${modalState.selectedEvent.title}? Your slot may be made available to another student.`;
    confirmPrimary.textContent = action === "join" ? "Participate" : "Yes";
    confirmCancel.textContent = action === "join" ? "Cancel" : "No";
    confirmError.textContent = "";
    confirmOverlay.setAttribute("aria-hidden", "false");
    confirmOverlay.classList.add("is-open");
    confirmPrimary.focus();
  }

  function closeConfirmation(restoreFocus = true) {
    modalState.isJoinConfirmOpen = false;
    modalState.isCancelConfirmOpen = false;
    confirmOverlay.classList.remove("is-open");
    confirmOverlay.setAttribute("aria-hidden", "true");
    confirmError.textContent = "";
    if (restoreFocus && modalState.isDetailsOpen) modalAction.focus();
  }

  async function saveParticipationChange(action) {
    const event = modalState.selectedEvent;
    if (!event || modalState.isPending) return;
    modalState.isPending = true;
    confirmPrimary.disabled = true;
    confirmCancel.disabled = true;
    confirmPrimary.textContent = "Saving...";
    confirmError.textContent = "";
    updateDetailsAction();

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const ids = readParticipationIds();
      const slots = readStoredSlots();
      const previousSlots = { ...slots };
      const key = String(event.id);
      const open = availableSlots(event, slots);
      const max = eventCapacity(event);
      if (action === "join") {
        if (ids.has(key))
          throw new Error("You are already registered for this event.");
        const blocked = actionBlockReason(event, "join");
        if (blocked) throw new Error(blocked);
        if (open <= 0)
          throw new Error("No slots are available for this event.");
        ids.add(key);
        slots[key] = open - 1;
      } else {
        if (!ids.has(key))
          throw new Error("You are not registered for this event.");
        ids.delete(key);
        slots[key] = Math.min(max || open + 1, open + 1);
      }

      localStorage.setItem(eventSlotsStorageKey, JSON.stringify(slots));
      try {
        localStorage.setItem(participationStorageKey, JSON.stringify([...ids]));
      } catch (error) {
        localStorage.setItem(
          eventSlotsStorageKey,
          JSON.stringify(previousSlots),
        );
        throw error;
      }

      event.slotsOpen = slots[key];
      renderEvents();
      renderRecommended();
      renderEventDetails(event);
      closeConfirmation(false);
      updateDetailsAction();
      showToast(
        action === "join"
          ? `You are registered for ${event.title}.`
          : `Your participation in ${event.title} was cancelled.`,
      );
    } catch (error) {
      confirmError.textContent = [
        "QuotaExceededError",
        "SecurityError",
      ].includes(error.name)
        ? "Your request could not be saved in this browser. Check storage availability and try again."
        : error.message || "Your request could not be saved. Please try again.";
    } finally {
      modalState.isPending = false;
      confirmPrimary.disabled = false;
      confirmCancel.disabled = false;
      confirmPrimary.textContent = modalState.isCancelConfirmOpen
        ? "Yes"
        : "Participate";
      updateDetailsAction();
    }
  }

  /* ---------------------------------------------------------
     TOAST
  --------------------------------------------------------- */
  let toastTimer = null;
  function showToast(msg) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2400);
  }

  /* ---------------------------------------------------------
     HELPERS
  --------------------------------------------------------- */
  function escapeHTML(str) {
    return String(str).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }

  /* ---------------------------------------------------------
     EVENT WIRING
  --------------------------------------------------------- */
  function setSidebarCollapsed(collapsed) {
    const sidebar = document.getElementById("sidebar");
    const btn = document.getElementById("collapseBtn");
    state.sidebarCollapsed = collapsed;
    sidebar.classList.toggle("is-collapsed", collapsed);
    localStorage.setItem("sidebarCollapsed", String(collapsed));
    if (btn) {
      btn.setAttribute("aria-expanded", String(!collapsed));
      btn.setAttribute(
        "aria-label",
        collapsed ? "Expand sidebar" : "Collapse sidebar",
      );
      btn.setAttribute(
        "title",
        collapsed ? "Expand sidebar" : "Collapse sidebar",
      );
    }
  }

  function wireSidebar() {
    const collapseBtn = document.getElementById("collapseBtn");
    if (collapseBtn) {
      collapseBtn.addEventListener("click", () => {
        if (!window.matchMedia("(max-width: 860px)").matches) {
          setSidebarCollapsed(!state.sidebarCollapsed);
        }
      });
    }

    document.querySelectorAll(".nav-item[data-view]").forEach((item) => {
      item.addEventListener("click", (e) => {
        if (item.getAttribute("href") === "#") e.preventDefault();
        document
          .querySelectorAll(".nav-item[data-view]")
          .forEach((n) => n.classList.remove("is-active"));
        item.classList.add("is-active");
        if (item.getAttribute("href") === "#") {
          showToast(`${item.dataset.label} — coming soon in this preview.`);
        }
      });
    });

    document
      .querySelector(".nav-item.logout")
      .addEventListener("click", (e) => {
        localStorage.removeItem("recovibeCurrentUser");
      });
  }

  function wireSearch() {
    const search = document.getElementById("searchInput");
    search.addEventListener("input", (e) => {
      state.query = e.target.value;
      renderEvents();
    });
  }

  function wireCalendar() {
    document
      .getElementById("calPrev")
      .addEventListener("click", () => shiftMonth(-1));
    document
      .getElementById("calNext")
      .addEventListener("click", () => shiftMonth(1));
    document.getElementById("calDays").addEventListener("click", (event) => {
      const day = event.target.closest("[data-calendar-date]");
      if (day) selectCalendarDay(day.dataset.calendarDate);
    });
    window.addEventListener("focus", refreshPreviewCalendarData);
    window.addEventListener("storage", (event) => {
      if (
        !["events", "recovibeOrganizerEvents", "recovibeTeacherEvents"].includes(
          event.key,
        )
      ) {
        return;
      }
      refreshPreviewCalendarData();
    });
  }

  function wireCardClicks() {
    document.addEventListener("click", (e) => {
      const trigger = e.target.closest(
        ".event-details-trigger, .cal-day[data-event-id]",
      );
      if (trigger) openEventModal(trigger.dataset.eventId);
    });
    modalContent.addEventListener("click", async (event) => {
      const link = event.target.closest("[data-dashboard-file-id]");
      if (!link) return;
      event.preventDefault();
      link.setAttribute("aria-busy", "true");
      try {
        const database = await new Promise((resolve, reject) => {
          const request = indexedDB.open("RecoVibeEventDocuments", 1);
          request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains("files"))
              request.result.createObjectStore("files", { keyPath: "id" });
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () =>
            reject(
              request.error || new Error("Document storage is unavailable."),
            );
        });
        const stored = await new Promise((resolve, reject) => {
          const request = database
            .transaction("files")
            .objectStore("files")
            .get(link.dataset.dashboardFileId);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () =>
            reject(
              request.error || new Error("Could not read the attached file."),
            );
        });
        database.close();
        if (!stored?.blob) throw new Error("This file is no longer available.");
        const url = URL.createObjectURL(stored.blob);
        const download = document.createElement("a");
        download.href = url;
        download.download = stored.name || link.download;
        download.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      } catch (error) {
        showToast(`Unable to download ${link.download}: ${error.message}`);
      } finally {
        link.removeAttribute("aria-busy");
      }
    });
  }

  function wireModal() {
    document.getElementById("modalClose").addEventListener("click", closeModal);
    modalAction.addEventListener("click", () => {
      const isRegistered =
        modalState.selectedEvent &&
        readParticipationIds().has(String(modalState.selectedEvent.id));
      openConfirmation(isRegistered ? "cancel" : "join");
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (modalState.isJoinConfirmOpen || modalState.isCancelConfirmOpen)
          closeConfirmation();
        else if (modalState.isDetailsOpen) closeModal();
        return;
      }
      if (e.key !== "Tab" || !modalState.isDetailsOpen) return;
      const topDialog =
        modalState.isJoinConfirmOpen || modalState.isCancelConfirmOpen
          ? confirmDialog
          : detailsDialog;
      const focusable = [
        ...topDialog.querySelectorAll(
          'button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) {
        e.preventDefault();
        topDialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !topDialog.contains(document.activeElement))
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !topDialog.contains(document.activeElement))
      ) {
        e.preventDefault();
        first.focus();
      }
    });
    confirmPrimary.addEventListener("click", () => {
      saveParticipationChange(
        modalState.isCancelConfirmOpen ? "cancel" : "join",
      );
    });
    confirmCancel.addEventListener("click", () => closeConfirmation());
    modalOverlay.addEventListener("click", (event) => {
      if (event.target === modalOverlay) closeModal();
    });
    confirmOverlay.addEventListener("click", (event) => {
      if (event.target === confirmOverlay && !modalState.isPending)
        closeConfirmation();
    });
  }

  /* ---------------------------------------------------------
     INIT
  --------------------------------------------------------- */
  function init() {
    const sidebar = document.getElementById("sidebar");
    if (
      localStorage.getItem("sidebarCollapsed") === "true" &&
      !window.matchMedia("(max-width: 860px)").matches
    )
      setSidebarCollapsed(true);
    requestAnimationFrame(() => sidebar.classList.add("is-ready"));
    renderTodayDate();
    syncSavedSlots();
    renderEvents();
    renderRecommended();
    renderNotifications();
    renderCalendar();
    refreshPreviewCalendarData();

    wireSidebar();
    wireSearch();
    wireCalendar();
    wireCardClicks();
    wireModal();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
