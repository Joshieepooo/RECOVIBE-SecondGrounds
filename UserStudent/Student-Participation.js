(function () {
  "use strict";

  function initCommon() {
    const sidebar = document.getElementById("sidebar");
    const collapseBtn = document.getElementById("collapseBtn");
    const todayDate = document.getElementById("todayDate");

    if (todayDate) {
      todayDate.textContent = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    if (sidebar && collapseBtn) {
      function setCollapsed(collapsed) {
        sidebar.classList.toggle("is-collapsed", collapsed);
        collapseBtn.setAttribute("aria-expanded", String(!collapsed));
        collapseBtn.setAttribute(
          "aria-label",
          collapsed ? "Expand sidebar" : "Collapse sidebar",
        );
        collapseBtn.setAttribute(
          "title",
          collapsed ? "Expand sidebar" : "Collapse sidebar",
        );
        localStorage.setItem("sidebarCollapsed", String(collapsed));
      }

      const mobileSidebar = window.matchMedia("(max-width: 860px)");
      setCollapsed(
        mobileSidebar.matches
          ? false
          : localStorage.getItem("sidebarCollapsed") === "true",
      );
      requestAnimationFrame(() => sidebar.classList.add("is-ready"));
      collapseBtn.addEventListener("click", () => {
        if (!mobileSidebar.matches)
          setCollapsed(!sidebar.classList.contains("is-collapsed"));
      });
    }
  }

  const events = window.RECOVIBE_EVENTS || [];
  const participationStorageKey = "recovibeParticipations";
  const state = { filter: "all", query: "" };
  const modalOverlay = document.getElementById("modalOverlay");
  const modalClose = document.getElementById("modalClose");
  const modalTitle = document.getElementById("modalTitle");
  const modalTag = document.getElementById("modalTag");
  const modalLocation = document.getElementById("modalLocation");
  const modalTime = document.getElementById("modalTime");
  const modalRoom = document.getElementById("modalRoom");
  const modalDesc = document.getElementById("modalDesc");
  const modalSlots = document.getElementById("modalSlots");
  const modalRegister = document.getElementById("modalRegister");

  function escapeHTML(value) {
    return String(value).replace(
      /[&<>'"]/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[character],
    );
  }

  function eventDateParts(dateISO) {
    const date = new Date(`${dateISO}T00:00:00`);
    return {
      month: date.toLocaleDateString("en-US", { month: "short" }),
      day: date.getDate(),
      year: date.getFullYear(),
    };
  }

  function statusFor(event) {
    const eventStatus = String(event.status || "").trim().toLowerCase();
    if (eventStatus === "cancelled" || eventStatus === "canceled") {
      return "Cancelled";
    }
    if (
      eventStatus === "rescheduled" ||
      event.isRescheduled === true ||
      event.rescheduled === true ||
      Boolean(event.rescheduledDate) ||
      Boolean(event.rescheduledTime) ||
      (event.originalDate && event.dateISO && event.dateISO !== event.originalDate)
    ) {
      return "Rescheduled";
    }
    const eventDate = new Date(`${event.dateISO}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return !Number.isNaN(eventDate.getTime()) && eventDate < today
      ? "Completed"
      : "Participating";
  }

  function getParticipationIds() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(participationStorageKey) || "[]",
      );
      return new Set(Array.isArray(saved) ? saved.map(String) : []);
    } catch (error) {
      return new Set();
    }
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

  function matches(event) {
    if (!getParticipationIds().has(String(event.id))) return false;
    const query = state.query.trim().toLowerCase();
    const textMatch =
      !query ||
      `${event.title} ${event.location} ${event.source} ${event.tag}`
        .toLowerCase()
        .includes(query);
    const eventStatus = statusFor(event);
    const filterMatch = state.filter === "all" || eventStatus === state.filter;
    return textMatch && filterMatch;
  }

  function render() {
    const list = document.getElementById("participationList");
    const visible = events
      .filter(matches)
      .sort((a, b) => {
        const dateA = a.rescheduledDate || a.dateISO || "";
        const dateB = b.rescheduledDate || b.dateISO || "";
        return dateA.localeCompare(dateB);
      });
    document.getElementById("participationCount").textContent =
      `${visible.length} event${visible.length === 1 ? "" : "s"}`;
    if (!visible.length) {
      const emptyMsg =
        state.filter === "Rescheduled"
          ? "No rescheduled events."
          : state.filter !== "all"
            ? `No ${state.filter.toLowerCase()} events match your filters.`
            : "No participation records match your filters.";
      list.innerHTML = `<div class="empty-participation">${emptyMsg}</div>`;
      return;
    }

    list.innerHTML = visible
      .map((event) => {
        const effectiveDateISO = event.rescheduledDate || event.dateISO;
        const effectiveTime = event.rescheduledTime || event.time;
        const date = eventDateParts(effectiveDateISO);
        const isResched = statusFor(event) === "Rescheduled";
        return `
        <article class="participation-card ${isResched ? "is-rescheduled" : ""}" id="participation-card-${event.id}" data-event-id="${escapeHTML(event.id)}">
          <div class="participation-date" id="participation-date-${event.id}" data-event-field="date"><span class="month" id="participation-month-${event.id}">${date.month}</span><span class="day" id="participation-day-${event.id}">${date.day}</span><span class="year" id="participation-year-${event.id}">${date.year}</span></div>
          <div class="participation-body">
            <h3 class="participation-title" id="participation-title-${event.id}" data-event-field="title">${escapeHTML(event.title)} ${isResched ? '<span class="status-badge status-rescheduled" style="font-size:11px;font-weight:600;color:#b45309;background:#fef3c7;padding:2px 6px;border-radius:4px;margin-left:6px;">Rescheduled</span>' : ""}</h3>
            <p class="participation-source" id="participation-source-${event.id}" data-event-field="source">${escapeHTML(event.source)}</p>
            <div class="participation-meta" id="participation-meta-${event.id}">
              <span id="participation-time-${event.id}" data-event-field="time"><svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.4"/><path d="M10 6v4l2.5 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>${escapeHTML(effectiveTime)}</span>
              <span id="participation-location-${event.id}" data-event-field="location"><svg viewBox="0 0 20 20" fill="none"><path d="M10 17.5S15.5 12.8 15.5 8.5a5.5 5.5 0 1 0-11 0c0 4.3 5.5 9 5.5 9Z" stroke="currentColor" stroke-width="1.4"/><circle cx="10" cy="8.3" r="2" stroke="currentColor" stroke-width="1.4"/></svg>${escapeHTML(event.location)} · ${escapeHTML(event.room)}</span>
            </div>
            <span class="category participation-category" id="participation-category-${event.id}" data-event-field="category">${escapeHTML(preferredCategory(event.category))}</span>
          </div>
          <div class="participation-action"><button type="button" id="participation-details-button-${event.id}" data-event-id="${escapeHTML(event.id)}" aria-controls="studentEventDetailsDialog">View Details</button></div>
        </article>`;
      })
      .join("");
  }

  function openParticipationDetails(eventId) {
    const event = events.find((item) => String(item.id) === String(eventId));
    if (!event) return;
    window.RecovibeStudentEventDetails?.open(event);
  }

  function closeParticipationDetails() {
    modalOverlay.classList.remove("is-open");
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".nav-item").forEach((item) => {
      const label = item.querySelector(".nav-label");
      if (label) item.title = label.textContent.trim();
    });
    initCommon();

    document
      .getElementById("participationSearch")
      .addEventListener("input", (event) => {
        state.query = event.target.value;
        render();
      });

    window.enhanceDropdownSelects?.("#participationFilter");
    document
      .getElementById("participationFilter")
      .addEventListener("change", (event) => {
        state.filter = event.target.value;
        render();
      });

    document
      .getElementById("participationList")
      .addEventListener("click", (event) => {
        const button = event.target.closest("[data-event-id]");
        if (!button) return;
        const eventId = button.dataset.eventId;
        if (!eventId) return;
        openParticipationDetails(eventId);
      });

    document.addEventListener("recovibeParticipationChanged", () => render());
    window.addEventListener("storage", (event) => {
      if (event.key === participationStorageKey) render();
    });

    modalClose.addEventListener("click", closeParticipationDetails);
    modalOverlay.addEventListener("click", (event) => {
      if (event.target === modalOverlay) closeParticipationDetails();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeParticipationDetails();
    });

    render();
  });
})();
