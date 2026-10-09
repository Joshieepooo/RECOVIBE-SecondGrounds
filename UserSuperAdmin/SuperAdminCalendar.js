import { loadApprovedFirestoreEvents } from "../calendarDataService.js";
import { fetchMonthHolidays } from "../holidayService.js";

(() => {
  "use strict";

  function readProfile() {
    try {
      return JSON.parse(localStorage.getItem("recovibeAdminProfile") || "null");
    } catch {
      return null;
    }
  }

  const profile = readProfile();
  const identity = localStorage.getItem("recovibeAdminId");
  const role = String(profile?.role || profile?.userRole || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  if (!profile || role !== "superadmin" || !identity) {
    location.replace("SuperAdminLogin.html");
    return;
  }

  const monthSelect = document.getElementById("calendar-month");
  const yearSelect = document.getElementById("calendar-year");
  const calendarGrid = document.getElementById("calendar-month-grid");
  const upcomingItems = document.getElementById("calendar-upcoming-items");
  const modalHost = document.getElementById("calendar-modal-host");
  const filters = [...document.querySelectorAll("[data-calendar-source]")];
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
  }).format(new Date());
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
  const selectedSources = new Set(
    filters.map((filter) => filter.dataset.calendarSource),
  );
  let viewed = new Date();
  let firestoreEvents = [];
  let holidays = [];
  let loadedMonthKey = "";
  let loadSequence = 0;
  let activePopup = null;

  monthSelect.innerHTML = monthNames
    .map((month, index) => `<option value="${index}">${month}</option>`)
    .join("");

  const fullName =
    profile.fullName ||
    profile.name ||
    [profile.firstName, profile.middleName, profile.lastName]
      .filter(Boolean)
      .join(" ") ||
    identity;
  document.getElementById("calendar-user-name").textContent = fullName;
  document.getElementById("calendar-user-role").textContent =
    profile.roleName || profile.role || "Super Admin";
  document.getElementById("calendar-avatar").textContent =
    fullName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "SA";

  function escapeHtml(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  }

  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
    } catch {
      return fallback;
    }
  }

  function isVisibleEvent(event, allowUnmarked = false) {
    const status = String(event.status || "")
      .trim()
      .toLowerCase()
      .replace(/[ _-]+/g, " ");
    if (
      [
        "draft",
        "unpublished",
        "pending",
        "rejected",
        "canceled",
        "cancelled",
        "private",
        "deleted",
      ].includes(status)
    )
      return false;
    if (event.published === false) return false;
    if (
      ["approved", "published", "rescheduled", "completed"].includes(status) ||
      event.published === true
    )
      return true;
    return allowUnmarked && !status;
  }

  function allEvents() {
    const saved = ["recovibeTeacherEvents", "recovibeOrganizerEvents"].flatMap(
      (key) => {
        const value = read(key, []);
        return Array.isArray(value) ? value : [];
      },
    );
    const demo = Array.isArray(window.RECOVIBE_EVENTS)
      ? window.RECOVIBE_EVENTS
      : [];
    const seen = new Set();
    return [...saved, ...demo, ...firestoreEvents].filter((event) => {
      const id = String(event.eventId || event.id || "");
      if (
        !id ||
        id.startsWith("demo-event-") ||
        seen.has(id) ||
        !isVisibleEvent(event, true)
      )
        return false;
      seen.add(id);
      return true;
    });
  }

  function sourceName(event) {
    const value = [
      event.source,
      event.eventSource,
      event.category,
      event.organization,
      event.organizerName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim()
      .toLowerCase();
    if (value.includes("holiday")) return "Philippine Holiday";
    if (/\bcsc\b|central student council|student council/.test(value))
      return "CSC";
    if (value.includes("teacher") || value.includes("faculty"))
      return "Teachers / Faculty";
    if (
      value.includes("organization") ||
      value.includes("organizer") ||
      /\b(ibits|aces|jpcs|pice|iie|jma|jphia|pasoa|chrms|cites)\b/.test(value)
    )
      return "Organizational";
    if (
      value.includes("pup") ||
      value.includes("official") ||
      value.includes("campus")
    )
      return "PUP Official";
    return "Others / External";
  }

  function colorFor(source) {
    return (
      {
        "PUP Official": "#6b1220",
        CSC: "#31845b",
        "Teachers / Faculty": "#c64a52",
        Organizational: "#765092",
        "Others / External": "#64748b",
        "Philippine Holiday": "#d97706",
      }[source] || "#64748b"
    );
  }

  function visibleEvents() {
    return allEvents().filter((event) =>
      selectedSources.has(sourceName(event)),
    );
  }

  function dateOf(event) {
    return String(event.dateISO || event.eventDate || event.date || "").slice(
      0,
      10,
    );
  }

  function renderYearOptions() {
    const selectedYear = viewed.getFullYear();
    yearSelect.innerHTML = Array.from(
      { length: 21 },
      (_, index) => selectedYear - 10 + index,
    )
      .map((year) => `<option value="${year}">${year}</option>`)
      .join("");
  }

  function renderCell(day, iso, dayEvents = []) {
    const dots = dayEvents
      .slice(0, 4)
      .map((event) => {
        const source = sourceName(event);
        return `<i class="calendar-event-dot" style="background:${colorFor(source)}" title="${escapeHtml(event.title || event.eventName || "Untitled event")}"></i>`;
      })
      .join("");
    const label = iso
      ? `${iso}, ${dayEvents.length} events`
      : "Empty calendar cell";
    return `<div class="calendar-day ${iso ? (iso === today ? "is-today" : "") : "is-muted"}" ${iso ? `data-iso="${iso}"` : ""}><button type="button" ${iso ? `aria-label="${escapeHtml(label)}"` : "disabled"}>${day}</button>${dayEvents.length ? `<div class="calendar-day-dots" aria-hidden="true">${dots}</div>` : iso ? '<small class="calendar-day-empty">No events</small>' : ""}</div>`;
  }

  function renderUpcoming(events) {
    const upcoming = events
      .filter((event) => dateOf(event) >= today)
      .sort((first, second) => dateOf(first).localeCompare(dateOf(second)))
      .slice(0, 5);
    upcomingItems.innerHTML = upcoming.length
      ? upcoming
          .map((event) => {
            const iso = dateOf(event);
            const date = new Date(`${iso}T00:00:00`);
            return `<div class="upcoming-item" data-iso="${iso}" data-event-id="${escapeHtml(event.eventId || event.id)}" role="button" tabindex="0"><span class="upcoming-date"><strong>${date.getDate()}</strong><small>${date.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}</small></span><span class="upcoming-copy"><strong>${escapeHtml(event.title || event.eventName || "Untitled event")}</strong><small>${escapeHtml(sourceName(event))}</small></span></div>`;
          })
          .join("")
      : '<p class="upcoming-empty">No upcoming events.</p>';
  }

  function renderHolidayBadges() {
    const holidaysByDate = new Map();
    holidays.forEach((holiday) => {
      const names = holidaysByDate.get(holiday.date) || [];
      names.push(holiday.title || holiday.name);
      holidaysByDate.set(holiday.date, names);
    });
    calendarGrid.querySelectorAll(".calendar-day[data-iso]").forEach((day) => {
      const names = selectedSources.has("Philippine Holiday")
        ? holidaysByDate.get(day.dataset.iso) || []
        : [];
      day.classList.toggle("is-holiday", names.length > 0);
      day.querySelectorAll(".holiday-badge").forEach((badge) => badge.remove());
      names.forEach((name) => {
        const badge = document.createElement("span");
        badge.className = "holiday-badge";
        badge.textContent = name;
        badge.title = name;
        day.append(badge);
      });
    });
  }

  async function loadMonthData(year, month) {
    const key = `${year}-${month}`;
    if (loadedMonthKey === key) return;
    const sequence = ++loadSequence;
    try {
      const [events, monthHolidays] = await Promise.all([
        loadApprovedFirestoreEvents(),
        fetchMonthHolidays(year, month),
      ]);
      if (sequence !== loadSequence) return;
      firestoreEvents = events;
      holidays = monthHolidays;
      loadedMonthKey = key;
      render();
    } catch (error) {
      console.error("Unable to load Super Admin calendar data:", error);
    }
  }

  function render() {
    const year = viewed.getFullYear();
    const month = viewed.getMonth();
    const first = new Date(year, month, 1);
    const offset = first.getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const events = visibleEvents();
    const cells = [];
    renderYearOptions();
    monthSelect.value = String(month);
    yearSelect.value = String(year);
    for (let index = 0; index < offset; index += 1)
      cells.push(renderCell("", ""));
    for (let day = 1; day <= totalDays; day += 1) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push(
        renderCell(
          day,
          iso,
          events.filter((event) => dateOf(event) === iso),
        ),
      );
    }
    while (cells.length % 7) cells.push(renderCell("", ""));
    calendarGrid.innerHTML = cells.join("");
    renderUpcoming(events);
    renderHolidayBadges();
    loadMonthData(year, month);
  }

  function openDay(iso) {
    const events = visibleEvents().filter((event) => dateOf(event) === iso);
    const holiday = selectedSources.has("Philippine Holiday")
      ? holidays.find((item) => item.date === iso)
      : null;
    if (!events.length && !holiday) return;
    const date = new Date(`${iso}T00:00:00`);
    const overlay = document.createElement("div");
    overlay.className = "calendar-day-overlay";
    overlay.innerHTML = `<section class="calendar-day-dialog" role="dialog" aria-modal="true" aria-labelledby="calendar-day-title" tabindex="-1"><button type="button" class="calendar-day-close" aria-label="Close day details">×</button><h2 id="calendar-day-title">${date.toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "long", day: "numeric", year: "numeric" })}</h2>${holiday ? `<p class="calendar-holiday-note">${escapeHtml(holiday.title || holiday.name)} · Philippine Holiday</p>` : ""}<div class="calendar-day-list">${events
      .map((event) => {
        const source = sourceName(event);
        const id = String(event.eventId || event.id || "");
        const time =
          event.time ||
          [event.startTime, event.endTime].filter(Boolean).join(" - ") ||
          "Time TBA";
        return `<article class="calendar-day-card" style="--event-source:${colorFor(source)}"><h3>${escapeHtml(event.title || event.eventName || "Untitled event")}</h3><p>${escapeHtml(source)} · ${escapeHtml(time)}</p><p>${escapeHtml(event.location || event.venue || event.venueOther || "Venue to be announced")}</p><p>${escapeHtml(event.description || event.eventDescription || event.desc || "")}</p><button type="button" data-details-id="${escapeHtml(id)}">View details</button></article>`;
      })
      .join("")}</div></section>`;
    modalHost.append(overlay);
    activePopup = overlay;
    document.body.style.overflow = "hidden";
    overlay
      .querySelector(".calendar-day-close")
      .addEventListener("click", closePopup);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closePopup();
    });
    overlay.querySelectorAll("[data-details-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = events.find(
          (event) =>
            String(event.eventId || event.id || "") ===
            button.dataset.detailsId,
        );
        closePopup();
        window.RecovibeEventDetails?.open(item);
      });
    });
    overlay.querySelector(".calendar-day-dialog").focus();
  }

  function closePopup() {
    if (!activePopup) return;
    activePopup.remove();
    activePopup = null;
    document.body.style.overflow = "";
  }

  function moveMonth(amount) {
    viewed = new Date(viewed.getFullYear(), viewed.getMonth() + amount, 1);
    render();
  }

  monthSelect.addEventListener("change", () => {
    viewed = new Date(viewed.getFullYear(), Number(monthSelect.value), 1);
    render();
  });
  yearSelect.addEventListener("change", () => {
    viewed = new Date(Number(yearSelect.value), viewed.getMonth(), 1);
    render();
  });
  document
    .getElementById("calendar-previous")
    .addEventListener("click", () => moveMonth(-1));
  document
    .getElementById("calendar-next")
    .addEventListener("click", () => moveMonth(1));
  document.getElementById("calendar-today").addEventListener("click", () => {
    viewed = new Date();
    render();
  });
  document
    .getElementById("calendar-filter-reset")
    .addEventListener("click", () => {
      filters.forEach((filter) => {
        filter.checked = true;
        selectedSources.add(filter.dataset.calendarSource);
      });
      render();
    });
  filters.forEach((filter) =>
    filter.addEventListener("change", () => {
      if (filter.checked) selectedSources.add(filter.dataset.calendarSource);
      else selectedSources.delete(filter.dataset.calendarSource);
      render();
    }),
  );
  calendarGrid.addEventListener("click", (event) => {
    const day = event.target.closest("[data-iso]");
    if (day) openDay(day.dataset.iso);
  });
  calendarGrid.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const day = event.target.closest("[data-iso]");
    if (!day) return;
    event.preventDefault();
    openDay(day.dataset.iso);
  });
  upcomingItems.addEventListener("click", (event) => {
    const item = event.target.closest("[data-iso]");
    if (item) openDay(item.dataset.iso);
  });
  upcomingItems.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const item = event.target.closest("[data-iso]");
    if (!item) return;
    event.preventDefault();
    openDay(item.dataset.iso);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activePopup) closePopup();
  });
  window.addEventListener("storage", (event) => {
    if (!event.key || event.key.includes("Events")) render();
  });
  window.addEventListener("focus", render);
  window.addEventListener("online", () => {
    loadedMonthKey = "";
    render();
  });
  render();
})();
