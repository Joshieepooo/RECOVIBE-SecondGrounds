(() => {
  "use strict";

  const events = Array.isArray(window.RECOVIBE_EVENTS)
    ? [...window.RECOVIBE_EVENTS]
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
          if (!events.some((existing) => String(existing.id) === String(id))) {
            events.push({
              ...event,
              id,
              source: event.source || "PUP Biñan Campus",
              desc: event.description || "",
            });
          }
        });
    }
  } catch (error) {
    console.warn("Teacher event records could not be loaded.", error);
  }
  const state = {
    query: "",
    type: "all",
    source: "all",
    category: "all",
    date: "all",
    status: "all",
    availability: "all",
  };
  const currentEvents = document.getElementById("teacherCurrentEvents");
  const upcomingEvents = document.getElementById("teacherUpcomingEvents");
  const resultCount = document.getElementById("teacherResultCount");
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const escapeHTML = (value) =>
    String(value ?? "").replace(
      /[&<>'"]/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[char],
    );
  const dateFor = (event) => new Date(`${event.dateISO}T00:00:00`);
  const formatDate = (event) =>
    dateFor(event).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const isCurrent = (event) => event.dateISO === todayISO;
  const categoryMatches = {
    "Academic & Learning": ["academic", "learning"],
    "Tech & Innovation": ["tech", "innovation"],
    "Leadership & Career": ["leadership", "career", "student development"],
    "Sports & Fitness": ["sport", "fitness"],
    "Music & Entertainment": ["music", "entertainment"],
    "Orgs & Student Acts": ["org", "organization", "student act"],
    "Social Events": ["social"],
    "Community & Outreach": ["community", "outreach"],
    Competitions: ["competition", "hackathon"],
    "Seminars & Workshops": ["seminar", "workshop"],
    "Arts & Culture": ["art", "culture"],
    "University & Campuses": ["university", "campus"],
  };
  function normalizeSource(source) {
    const value = String(source || "").trim().toLowerCase();
    if (/\bcsc\b/.test(value)) return "CSC";
    if (/teacher|faculty/.test(value)) return "Teacher / Faculty";
    if (/organization|organizational|ibits|event organizer/.test(value))
      return "Organizational";
    if (/external|admin|other/.test(value)) return "Others / External";
    if (/pup|campus|cite/.test(value)) return "PUP Official";
    return "Others / External";
  }
  events.forEach((event) => {
    event.source = normalizeSource(event.source || event.eventSource);
  });
  function eventStatus(event) {
    const raw = String(event.status || "").trim().toLowerCase();
    if (raw === "cancelled" || raw === "canceled") return "Cancelled";
    if (raw === "rescheduled") return "Rescheduled";
    const openSlots = event.slotsOpen ?? event.availableSlots ?? event.slots;
    if (raw === "registration closed" || (openSlots != null && Number(openSlots) <= 0))
      return "Registration Closed";
    return "Available to Join";
  }

  function matches(event) {
    const query = state.query.trim().toLowerCase();
    const text =
      `${event.title} ${event.location} ${event.room} ${event.source} ${event.category}`.toLowerCase();
    const categoryTerms = categoryMatches[state.category] || [];
    const categoryMatch =
      state.category === "all" ||
      categoryTerms.some((term) =>
        String(event.category || "")
          .toLowerCase()
          .includes(term),
      );
    const source = String(event.source || "").toLowerCase();
    const organizationEvent =
      /organization|organizer|ibits|club|association/.test(source);
    const eventDate = event.dateISO
      ? new Date(`${event.dateISO}T00:00:00`)
      : null;
    const validDate = eventDate && !Number.isNaN(eventDate.getTime());
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const dateMatch =
      state.date === "all" ||
      (validDate &&
        state.date === "today" &&
        eventDate.getTime() === todayStart.getTime()) ||
      (validDate &&
        state.date === "week" &&
        eventDate >= todayStart &&
        eventDate < weekEnd) ||
      (validDate &&
        state.date === "month" &&
        eventDate.getFullYear() === todayStart.getFullYear() &&
        eventDate.getMonth() === todayStart.getMonth()) ||
      (validDate && state.date === "upcoming" && eventDate >= todayStart) ||
      (validDate && state.date === "past" && eventDate < todayStart);
    const statusMatch =
      state.status === "all" || eventStatus(event) === state.status;
    const openSlots = event.slotsOpen ?? event.availableSlots;
    const availabilityMatch =
      state.availability === "all" ||
      (state.availability === "available" &&
        openSlots !== undefined &&
        Number(openSlots) > 0) ||
      (state.availability === "full" &&
        openSlots !== undefined &&
        Number(openSlots) <= 0) ||
      (state.availability === "unknown" && openSlots === undefined);
    const sourceMatches =
      state.source === "all" || normalizeSource(event.source) === state.source;
    const typeMatch =
      state.type === "all" ||
      (state.type === "organization" && organizationEvent) ||
      (state.type === "campus" && !organizationEvent);
    return (
      (!query || text.includes(query)) &&
      typeMatch &&
      sourceMatches &&
      categoryMatch &&
      dateMatch &&
      statusMatch &&
      availabilityMatch
    );
  }

  function isHappeningNow(event) {
    if (!isCurrent(event)) return false;
    const range =
      event.startTime && event.endTime
        ? [event.startTime, event.endTime]
        : String(event.time || "").split(/\s+-\s+/);
    if (range.length < 2) return true;
    const toMinutes = (value) => {
      const text = String(value).trim();
      const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(text);
      if (!match) return null;
      let hour = Number(match[1]);
      if (match[3])
        hour = (hour % 12) + (match[3].toUpperCase() === "PM" ? 12 : 0);
      return hour * 60 + Number(match[2]);
    };
    const start = toMinutes(range[0]);
    const end = toMinutes(range[1]);
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    return (
      start !== null && end !== null && nowMinutes >= start && nowMinutes <= end
    );
  }

  function eventCard(event) {
    const date = dateFor(event);
    return `<article class="teacher-event-card" data-event-id="${escapeHTML(event.id)}" id="teacher-event-card-${escapeHTML(event.id)}">
			<div class="teacher-date" id="teacher-event-date-${escapeHTML(event.id)}" data-event-field="date"><span id="teacher-event-month-${escapeHTML(event.id)}">${date.toLocaleDateString("en-US", { month: "short" })}</span><strong id="teacher-event-day-${escapeHTML(event.id)}">${date.getDate()}</strong><small>${date.getFullYear()}</small></div>
			<div class="teacher-event-content" id="teacher-event-content-${escapeHTML(event.id)}"><h3 class="teacher-event-title" id="teacher-event-title-${escapeHTML(event.id)}" data-event-field="title">${escapeHTML(event.title)}</h3><p class="teacher-event-source" id="teacher-event-source-${escapeHTML(event.id)}" data-event-field="source">${escapeHTML(normalizeSource(event.source || event.location))}</p><div class="teacher-event-meta" id="teacher-event-meta-${escapeHTML(event.id)}" data-event-field="schedule"><span id="teacher-event-time-${escapeHTML(event.id)}" data-event-field="time"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.4"/><path d="M10 6v4l2.5 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>${escapeHTML(event.time || "Schedule to be announced")}</span><span id="teacher-event-location-${escapeHTML(event.id)}" data-event-field="location"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 17.5S15.5 12.8 15.5 8.5a5.5 5.5 0 1 0-11 0c0 4.3 5.5 9 5.5 9Z" stroke="currentColor" stroke-width="1.4"/><circle cx="10" cy="8.3" r="2" stroke="currentColor" stroke-width="1.4"/></svg>${escapeHTML(event.location || "Location to be announced")} · ${escapeHTML(event.room || "Room TBD")}</span></div><span class="teacher-tag" id="teacher-event-category-${escapeHTML(event.id)}" data-event-field="category">${escapeHTML(event.tag || event.category || "University Event")}</span><p class="teacher-event-slots">${event.slotsOpen !== undefined ? `${escapeHTML(event.slotsOpen)} of ${escapeHTML(event.maxSlots ?? event.capacity ?? event.slotsOpen)} Slots Open` : "Availability not specified"}</p></div>
			<div class="teacher-event-actions" id="teacher-event-actions-${escapeHTML(event.id)}"><button type="button" class="teacher-details-button" id="teacher-event-details-button-${escapeHTML(event.id)}" data-event-details="${escapeHTML(event.id)}" aria-controls="teacherEventOverlay">View Details</button></div>
		</article>`;
  }

  function render() {
    const visible = events
      .filter(matches)
      .sort((first, second) =>
        String(first.dateISO || "").localeCompare(String(second.dateISO || "")),
      );
    const current = visible.filter(isHappeningNow);
    currentEvents.innerHTML = current.length
      ? current.map(eventCard).join("")
      : '<div class="teacher-empty">No events match your filters.</div>';
    upcomingEvents.innerHTML = visible.length
      ? visible.map(eventCard).join("")
      : '<div class="teacher-empty">No events match your filters.</div>';
    resultCount.textContent = `${visible.length} event${visible.length === 1 ? "" : "s"}`;
  }

  function openDetails(id) {
    const event = events.find((item) => item.id === id);
    if (!event) return;
    const teacherId = localStorage.getItem("recovibeTeacherId");
    const canReviewDocuments =
      teacherId &&
      String(event.createdBy || event.teacherId || event.organizerId || "") ===
        String(teacherId);
    window.RecovibeEventDetails?.open(event, {
      showApprovalDocuments: Boolean(canReviewDocuments),
    });
  }

  function closeDetails() {
    document.getElementById("teacherEventOverlay").hidden = true;
  }

  function setupTeacherFilterDropdowns() {
    const selects = [...document.querySelectorAll(".teacher-toolbar select")];
    const wrappers = [];

    function closeMenus(except) {
      wrappers.forEach(({ wrapper, button, menu }) => {
        if (wrapper === except) return;
        menu.classList.remove("show");
        button.setAttribute("aria-expanded", "false");
      });
    }

    selects.forEach((select) => {
      const wrapper = document.createElement("div");
      const button = document.createElement("button");
      const menu = document.createElement("div");
      const dropdownId = `${select.id}Dropdown`;
      wrapper.className = "filter-dropdown";
      button.className = "filter-button";
      button.type = "button";
      button.setAttribute("aria-haspopup", "listbox");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute(
        "aria-label",
        select.getAttribute("aria-label") || "Filter events",
      );
      button.id = `${dropdownId}Button`;
      menu.className = "filter-menu";
      menu.id = dropdownId;
      menu.setAttribute("role", "listbox");
      menu.setAttribute("aria-labelledby", button.id);
      button.setAttribute("aria-controls", menu.id);

      [...select.options].forEach((option) => {
        const item = document.createElement("button");
        item.className = `filter-option${option.selected ? " active" : ""}`;
        item.type = "button";
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", String(option.selected));
        item.dataset.value = option.value;
        item.textContent = option.textContent.trim();
        menu.appendChild(item);
      });

      function syncSelection() {
        const selected = select.options[select.selectedIndex];
        button.childNodes[0]?.remove();
        button.insertBefore(
          document.createTextNode(selected ? selected.textContent.trim() : ""),
          button.firstChild,
        );
        menu.querySelectorAll(".filter-option").forEach((item) => {
          const active = item.dataset.value === select.value;
          item.classList.toggle("active", active);
          item.setAttribute("aria-selected", String(active));
        });
      }
      syncSelection();
      select.classList.add("teacher-native-filter-select");
      select.setAttribute("aria-hidden", "true");
      select.tabIndex = -1;
      select.hidden = true;
      select.parentNode.insertBefore(wrapper, select);
      wrapper.append(button, menu, select);
      wrappers.push({ wrapper, button, menu, select, syncSelection });

      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const wasOpen = menu.classList.contains("show");
        closeMenus();
        if (!wasOpen) {
          menu.classList.add("show");
          button.setAttribute("aria-expanded", "true");
        }
      });
      menu.addEventListener("click", (event) => {
        const item = event.target.closest(".filter-option");
        if (!item) return;
        select.value = item.dataset.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        syncSelection();
        closeMenus();
        button.focus();
      });
      select.addEventListener("change", syncSelection);
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".teacher-toolbar .filter-dropdown"))
        closeMenus();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenus();
    });
  }

  setupTeacherFilterDropdowns();

  document
    .getElementById("teacherEventSearch")
    .addEventListener("input", (event) => {
      state.query = event.target.value;
      render();
    });
  const filterBindings = [
    ["teacherEventTypeFilter", "type"],
    ["teacherSourceFilter", "source"],
    ["teacherCategoryFilter", "category"],
    ["teacherDateFilter", "date"],
    ["teacherStatusFilter", "status"],
    ["teacherAvailabilityFilter", "availability"],
  ];
  filterBindings.forEach(([id, key]) =>
    document.getElementById(id).addEventListener("change", (event) => {
      state[key] = event.target.value;
      render();
    }),
  );
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-event-details]");
    if (button) openDetails(button.dataset.eventDetails);
  });
  document
    .getElementById("teacherModalClose")
    .addEventListener("click", closeDetails);
  document
    .getElementById("teacherEventOverlay")
    .addEventListener("click", (event) => {
      if (event.target.id === "teacherEventOverlay") closeDetails();
    });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDetails();
  });
  document.getElementById("teacherMenuToggle").addEventListener("click", () => {
    const sidebar = document.getElementById("teacherSidebar");
    const open = sidebar.classList.toggle("is-open");
    document
      .getElementById("teacherMenuToggle")
      .setAttribute("aria-expanded", String(open));
  });
  let teacher = null;
  try {
    teacher = JSON.parse(
      localStorage.getItem("recovibeCurrentTeacher") || "null",
    );
  } catch (error) {
    console.warn("Unable to read teacher account.", error);
  }
  if (teacher) {
    const teacherName = teacher.name || teacher.fullName || "Mr. Miguel";
    document.getElementById("teacherName").textContent = teacherName;
    document.getElementById("teacherAvatar").textContent = teacherName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
    document.getElementById("teacherRole").textContent =
      teacher.department ||
      teacher.organization ||
      teacher.role ||
      "Faculty account";
  }
  document.getElementById("teacherLogout").addEventListener("click", () => {
    localStorage.removeItem("recovibeCurrentTeacher");
    localStorage.removeItem("recovibeTeacherId");
  });
  render();
  const requestedEventId = new URLSearchParams(window.location.search).get(
    "eventId",
  );
  if (requestedEventId) openDetails(requestedEventId);
})();
