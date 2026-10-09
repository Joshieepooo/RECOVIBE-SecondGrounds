(function () {
  "use strict";

  /* ---------------------------------------------------------
     DATA
  --------------------------------------------------------- */
  const EVENTS = Array.isArray(window.RECOVIBE_EVENTS)
    ? window.RECOVIBE_EVENTS
    : [];
  try {
    const teacherEvents = JSON.parse(
      localStorage.getItem("recovibeTeacherEvents") || "[]",
    );
    if (Array.isArray(teacherEvents)) {
      teacherEvents
        .filter((event) => ["Approved", "Published"].includes(event.status))
        .forEach((event) => {
          const id = event.eventId || event.id;
          if (!EVENTS.some((existing) => String(existing.id) === String(id))) {
            EVENTS.push({
              ...event,
              id,
              source: event.source || "PUP Biñan Campus",
              desc: event.description || "Event details will be posted soon.",
            });
          }
        });
    }
  } catch (error) {
    console.warn("Teacher event records could not be loaded.", error);
  }

  const RECOMMENDED = [
    {
      id: "leadership-seminar",
      source: "PUP Official",
      tagLabel: "PUP Biñan Campus",
      tagClass: "tag-campus",
      title: "PUP Biñan Leadership Seminar",
      when: "Mar 15 | 1:00 PM",
      match: "Matches Your Interest In Academic Events",
    },
    {
      id: "intramurals-opening",
      source: "PUP Official",
      tagLabel: "Sports",
      tagClass: "tag-sports",
      title: "Intramurals Opening Program",
      when: "Apr 2 | 7:00 AM",
      match: "Matches Your Interest In Sports",
    },
    {
      id: "cite-hackathon",
      source: "PUP Official",
      tagLabel: "PUP CITE",
      tagClass: "tag-academic",
      title: "CITE Mini Hackathon",
      when: "Apr 18 | 9:00 AM",
      match: "Matches Your Interest In Academic Events",
    },
    {
      id: "ibits-general-assembly",
      source: "Organizational",
      tagLabel: "IBITS",
      tagClass: "tag-campus",
      title: "IBITS General Assembly",
      when: "May 5 | 2:00 PM",
      match: "Matches Your Interest In Org Activities",
    },
  ];

  const NOTIFICATIONS = [
    {
      text: 'Your participation for <b>"IBITS General Assembly"</b> was confirmed.',
      time: "2 Hours Ago",
    },
    {
      text: '<b>"IBITS General Assembly"</b> was cancelled due to internal reasons.',
      time: "40 Hours Ago",
    },
  ];

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
    sidebarCollapsed: false,
  };
  let activeModalEventId = null;

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
            <span class="slots" id="event-slots-${ev.id}" data-event-field="participants">${ev.slotsOpen} of ${ev.maxSlots} Slots Open</span>
            <button class="btn-outline" id="event-details-button-${ev.id}" data-event-id="${ev.id}" aria-controls="modalContent">View Details</button>
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
        return `
      <article class="rec-card" id="recommended-card-${id}" data-event-id="${id}">
        <h3 id="recommended-title-${id}" data-event-field="title">${escapeHTML(event.title || "Untitled event")}</h3>
        <div class="rec-source" id="recommended-source-${id}" data-event-field="source">${escapeHTML(event.source || "PUP Biñan Campus")}</div>
        <div class="rec-when" id="recommended-time-${id}" data-event-field="time">${escapeHTML(event.time || "Time TBA")}</div>
        <div class="rec-match" id="recommended-location-${id}" data-event-field="location">${escapeHTML(event.location ? `${event.location} · ${event.room || ""}` : "Location TBA")}</div>
        <span class="rec-tag tag-academic" id="recommended-category-${id}" data-event-field="category">${escapeHTML(event.category || event.tag || "Academic & Learning")}</span>
        <button type="button" class="btn-outline event-details-trigger" id="recommended-details-button-${id}" data-event-id="${id}" aria-controls="detailsDialog">View Details</button>
      </article>`;
      })
      .join("");
  }

  /* ---------------------------------------------------------
     RENDER: notifications
  --------------------------------------------------------- */
  function renderNotifications() {
    const list = document.getElementById("notifList");
    list.innerHTML = NOTIFICATIONS.map(
      (n) => `
      <li class="notif-item">
        ${n.text}
        <span class="notif-time">${escapeHTML(n.time)}</span>
      </li>`,
    ).join("");
  }

  /* ---------------------------------------------------------
     RENDER: calendar
  --------------------------------------------------------- */
  function renderCalendar() {
    const label = document.getElementById("calMonthLabel");
    label.textContent = `${MONTH_NAMES[state.calMonth]} ${state.calYear}`;

    const firstOfMonth = new Date(state.calYear, state.calMonth, 1);
    const startWeekday = firstOfMonth.getDay(); // 0 = Sun
    const daysInMonth = new Date(
      state.calYear,
      state.calMonth + 1,
      0,
    ).getDate();
    const daysInPrevMonth = new Date(
      state.calYear,
      state.calMonth,
      0,
    ).getDate();

    const isCurrentRealMonth =
      state.calMonth === today.getMonth() &&
      state.calYear === today.getFullYear();

    const cells = [];

    // leading days from previous month
    for (let i = startWeekday - 1; i >= 0; i--) {
      cells.push({
        num: daysInPrevMonth - i,
        muted: true,
        hasEvent: false,
        isToday: false,
        eventIds: [],
      });
    }
    // days of current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateISO = `${state.calYear}-${String(state.calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const eventIds = EVENTS.filter((event) => event.dateISO === dateISO).map(
        (event) => event.id,
      );
      cells.push({
        num: d,
        muted: false,
        hasEvent: eventIds.length > 0,
        isToday: isCurrentRealMonth && d === today.getDate(),
        eventIds,
      });
    }
    // trailing days to complete the grid to a multiple of 7
    let trailing = 1;
    while (cells.length % 7 !== 0) {
      cells.push({
        num: trailing++,
        muted: true,
        hasEvent: false,
        isToday: false,
        eventIds: [],
      });
    }

    const grid = document.getElementById("calDays");
    grid.innerHTML = cells
      .map((c) => {
        const classes = ["cal-day"];
        if (c.muted) classes.push("is-muted");
        if (c.hasEvent) classes.push("has-event");
        if (c.isToday) classes.push("is-today");
        const eventId = c.eventIds[0] || "";
        const dayEvents = EVENTS.filter((event) =>
          c.eventIds.includes(event.id),
        );
        const preview = dayEvents.length
          ? `
          <span class="dashboard-calendar-preview" role="tooltip">
            <strong>${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}</strong>
            ${dayEvents.map((event) => `<span><b>${escapeHTML(event.title)}</b><small>${escapeHTML(event.time)}</small></span>`).join("")}
          </span>`
          : "";
        const cellId = `dashboard-calendar-day-${state.calYear}-${String(state.calMonth + 1).padStart(2, "0")}-${String(c.num).padStart(2, "0")}`;
        return `<button type="button" id="${cellId}" class="${classes.join(" ")}"${eventId ? ` data-event-id="${eventId}" aria-label="View event on ${MONTH_NAMES[state.calMonth]} ${c.num}"` : ""} data-calendar-field="date"><span id="${cellId}-number">${c.num}</span>${preview}</button>`;
      })
      .join("");
  }

  function shiftMonth(delta) {
    let m = state.calMonth + delta;
    let y = state.calYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    if (m > 11) {
      m = 0;
      y += 1;
    }
    state.calMonth = m;
    state.calYear = y;
    renderCalendar();
  }

  /* ---------------------------------------------------------
     MODAL
  --------------------------------------------------------- */
  function openEventModal(id) {
    const ev = EVENTS.find((e) => e.id === id) || eventFromRecommended(id);
    if (!ev) return;
    activeModalEventId = id;
    window.RecovibeEventDetails?.open(ev);
  }

  function eventFromRecommended(id) {
    return EVENTS.find((e) => e.id === id);
  }

  function closeModal() {
    document.getElementById("modalOverlay").classList.remove("is-open");
    activeModalEventId = null;
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
        localStorage.removeItem("recovibeCurrentTeacher");
        localStorage.removeItem("recovibeTeacherId");
      });
  }

  function wireSeeAllLinks() {
    document.querySelectorAll(".link-see-all[data-view]").forEach((link) => {
      link.addEventListener("click", (e) => {
        const target = document.querySelector(
          `.nav-item[data-view="${link.dataset.view}"]`,
        );
        if (target) {
          e.preventDefault();
          target.click();
        }
      });
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
  }

  function wireCardClicks() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-event-id]:not(.modal)");
      if (btn) {
        openEventModal(btn.dataset.eventId);
      }
    });
  }

  function wireModal() {
    document.getElementById("modalClose").addEventListener("click", closeModal);
    document.getElementById("modalOverlay").addEventListener("click", (e) => {
      if (e.target.id === "modalOverlay") closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
    document.getElementById("modalRegister").addEventListener("click", () => {
      if (activeModalEventId) {
        const event = EVENTS.find((item) => item.id === activeModalEventId);
        if (event) window.RecovibeEventDetails?.open(event);
      }
    });
  }

  /* ---------------------------------------------------------
     INIT
  --------------------------------------------------------- */
  function init() {
    const teacherEvents = (() => {
      try {
        const records = JSON.parse(
          localStorage.getItem("recovibeTeacherEvents") || "[]",
        );
        return Array.isArray(records) ? records : [];
      } catch (error) {
        console.warn("Teacher event records could not be loaded.", error);
        return [];
      }
    })();
    let teacher = null;
    try {
      teacher = JSON.parse(
        localStorage.getItem("recovibeCurrentTeacher") || "null",
      );
    } catch (error) {
      console.warn("Unable to read teacher account.", error);
    }

    const teacherEmail = String(
      (teacher && teacher.email) ||
        localStorage.getItem("recovibeTeacherId") ||
        "",
    ).toLowerCase();
    const events = teacherEmail
      ? teacherEvents.filter(
          (event) =>
            !event.organizerId ||
            String(event.organizerId).toLowerCase() === teacherEmail,
        )
      : teacherEvents;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const actionRows = document.getElementById("teacherActionRows");
    const upcomingEventsList = document.getElementById("upcomingEventsList");
    const eventDetailsModal = document.getElementById("eventDetailsModal");

    const getStatus = (event) => {
      const status = String(event.status || "Pending")
        .toLowerCase()
        .replace(/[ _-]+/g, " ");
      if (status === "draft") return "Draft";
      if (status === "pending approval" || status === "pending")
        return "Pending Approval";
      if (status === "approved") return "Approved";
      if (status === "published") return "Published";
      if (status === "needs revision") return "Needs Revision";
      return String(event.status || "Pending");
    };
    const getStatusClass = (status) =>
      status.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    const formatDate = (value, fallback = "Date TBA") => {
      if (!value) return fallback;
      const date = new Date(
        String(value).includes("T")
          ? value
          : `${String(value).slice(0, 10)}T00:00:00`,
      );
      return Number.isNaN(date.getTime())
        ? fallback
        : date.toLocaleDateString("en-US", {
            month: "2-digit",
            day: "2-digit",
            year: "2-digit",
          });
    };
    const dateParts = (value) => {
      const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
      return Number.isNaN(date.getTime())
        ? { month: "TBA", day: "", year: "" }
        : {
            month: date
              .toLocaleDateString("en-US", { month: "short" })
              .toUpperCase(),
            day: String(date.getDate()).padStart(2, "0"),
            year: String(date.getFullYear()),
          };
    };
    const hapApproved = (event, number) =>
      event[`hap${number}Approved`] === true ||
      String(event[`hap_${number}_status`] || "").toLowerCase() ===
        "approved" ||
      event[`hap${number}`] === true;

    function updateTeacherAccount() {
      const name = String(
        (teacher && (teacher.name || teacher.fullName)) || "Teacher",
      );
      const department = String(
        (teacher &&
          (teacher.department || teacher.organization || teacher.role)) ||
          "Faculty account",
      );
      document.getElementById("userName").textContent = name;
      document.getElementById("userRole").textContent = department;
      document.getElementById("userAvatar").textContent =
        name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0].toUpperCase())
          .join("") || "T";
      const hour = new Date().getHours();
      const greeting = hour < 12 ? "Morning" : hour < 18 ? "Noon" : "Evening";
      document.getElementById("teacherDashboardHeading").textContent =
        `Good ${greeting}, ${name}!`;
      document.getElementById("teacherToday").textContent =
        new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
    }

    function renderStatistics() {
      const statusCounts = events.map(getStatus);
      document.getElementById("activeEventsCount").textContent =
        statusCounts.filter((status) =>
          ["Draft", "Pending", "Pending Approval", "Approved"].includes(status),
        ).length;
      document.getElementById("pendingApprovalCount").textContent =
        statusCounts.filter((status) =>
          ["Pending", "Pending Approval", "Needs Revision"].includes(status),
        ).length;
      document.getElementById("approvedEventsCount").textContent =
        statusCounts.filter((status) =>
          ["Approved", "Published"].includes(status),
        ).length;
      document.getElementById("completedEventsCount").textContent =
        statusCounts.filter((status) => status === "Completed").length;
    }

    function renderActionRequired() {
      if (!events.length) {
        actionRows.innerHTML = `<tr><td colspan="7"><div class="dashboard-empty-state"><strong>No events created yet</strong><span>Your submitted events and approval status will appear here.</span><a class="organizer-button" href="TeacherCreate.html">+ Create an Event</a></div></td></tr>`;
        return;
      }
      actionRows.innerHTML = [...events]
        .sort((first, second) =>
          String(second.createdAt || "").localeCompare(
            String(first.createdAt || ""),
          ),
        )
        .map((event) => {
          const id = escapeHTML(event.eventId || event.id || "");
          const status = getStatus(event);
          return `<tr>
          <td><strong>${escapeHTML(event.title || "Untitled event")}</strong><small>${escapeHTML(event.category || "General")}</small></td>
          <td>${escapeHTML(formatDate(event.createdAt, "Today"))}</td>
          <td><input type="checkbox" aria-label="HAP 1" ${hapApproved(event, 1) ? "checked" : ""} disabled></td>
          <td><input type="checkbox" aria-label="HAP 2" ${hapApproved(event, 2) ? "checked" : ""} disabled></td>
          <td><input type="checkbox" aria-label="HAP 3" ${hapApproved(event, 3) ? "checked" : ""} disabled></td>
          <td><span class="organizer-status ${getStatusClass(status)}">${escapeHTML(status)}</span></td>
          <td><button class="event-view-button" type="button" data-event-id="${id}">View</button></td>
        </tr>`;
        })
        .join("");
    }

    function renderUpcomingEvents() {
      const upcoming = events
        .filter(
          (event) =>
            event.dateISO &&
            String(event.dateISO).slice(0, 10) >= todayISO &&
            getStatus(event) !== "Cancelled",
        )
        .sort((first, second) =>
          String(first.dateISO).localeCompare(String(second.dateISO)),
        )
        .slice(0, 4);
      if (!upcoming.length) {
        upcomingEventsList.innerHTML = `<div class="dashboard-empty-state compact"><strong>No upcoming events</strong><span>Future events you create will appear here.</span></div>`;
        return;
      }
      upcomingEventsList.innerHTML = upcoming
        .map((event) => {
          const parts = dateParts(event.dateISO);
          return `<article class="upcoming-event"><div class="upcoming-event-date"><span class="upcoming-event-month">${escapeHTML(parts.month)}</span><strong>${escapeHTML(parts.day)}</strong><small>${escapeHTML(parts.year)}</small></div><div class="upcoming-event-content"><strong>${escapeHTML(event.title || "Untitled event")}</strong><span>${escapeHTML(event.time || "Time TBA")}</span><span>${escapeHTML(event.location || "Location TBA")}</span></div></article>`;
        })
        .join("");
    }

    function openEventDetails(event) {
      if (window.RecovibeEventDetails) {
        window.RecovibeEventDetails.open(event);
        return;
      }
      document.getElementById("eventDetailsTitle").textContent =
        event.title || "Untitled event";
      document.getElementById("eventDetailsHeadingMeta").textContent =
        `${getStatus(event)} · ${event.category || "General"}`;
      document.getElementById("eventDetailsContent").innerHTML = [
        ["Date", formatDate(event.dateISO)],
        ["Time", event.time || "Time TBA"],
        ["Location", event.location || "Location TBA"],
        ["Organizer", event.organizerName || "Teacher"],
        [
          "Capacity",
          event.capacity ? `${event.capacity} people` : "Not specified",
        ],
        [
          "Registration deadline",
          formatDate(event.registrationDeadline, "Not specified"),
        ],
      ]
        .map(
          ([label, value]) =>
            `<div class="event-detail-item"><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`,
        )
        .join("");
      document.getElementById("eventDetailsDescription").innerHTML =
        `<h3>Event Description</h3><p>${escapeHTML(event.description || "No event description provided.")}</p>`;
      const listSection = (title, values) =>
        `<section class="event-details-section"><h3>${title}</h3>${values.length ? `<ul>${values.map((value) => `<li>${escapeHTML(value)}</li>`).join("")}</ul>` : `<p>Not provided.</p>`}</section>`;
      const lines = (value) =>
        Array.isArray(value)
          ? value
          : String(value || "")
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter(Boolean);
      document.getElementById("eventDetailsSections").innerHTML = [
        listSection("Event Key Details", lines(event.keyDetails)),
        listSection("Requirements &amp; Reminders", lines(event.requirements)),
        listSection("Invitation Recipients", lines(event.invitees)),
        listSection("Participation Rules", lines(event.participationRules)),
        listSection("Participant Documents", lines(event.participantDocuments)),
        listSection("Approval Documents", lines(event.approvalDocuments)),
        listSection("Contact Person", lines(event.contactPerson)),
      ].join("");
      eventDetailsModal.hidden = false;
      document.body.classList.add("modal-open");
      eventDetailsModal.querySelector(".event-details-close").focus();
    }

    updateTeacherAccount();
    renderStatistics();
    renderActionRequired();
    renderUpcomingEvents();

    actionRows.addEventListener("click", (event) => {
      const button = event.target.closest("[data-event-id]");
      if (!button) return;
      const selected = events.find(
        (item) =>
          String(item.eventId || item.id || "") === button.dataset.eventId,
      );
      if (selected) openEventDetails(selected);
    });
    eventDetailsModal.addEventListener("click", (event) => {
      if (event.target.hasAttribute("data-modal-close")) {
        eventDetailsModal.hidden = true;
        document.body.classList.remove("modal-open");
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !eventDetailsModal.hidden) {
        eventDetailsModal.hidden = true;
        document.body.classList.remove("modal-open");
      }
    });
    document.getElementById("teacherLogout").addEventListener("click", () => {
      localStorage.removeItem("recovibeCurrentTeacher");
      localStorage.removeItem("recovibeTeacherId");
    });
    window.addEventListener("storage", (event) => {
      if (event.key === "recovibeTeacherEvents") window.location.reload();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
