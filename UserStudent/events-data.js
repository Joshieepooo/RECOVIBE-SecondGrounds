window.enhanceDropdownSelects =
  window.enhanceDropdownSelects ||
  function (selector) {
    const selects = [...document.querySelectorAll(selector)].filter(
      (select) => !select.dataset.dropdownEnhanced,
    );
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
      const menuId = `${select.id || "dropdown"}Menu`;
      const originalStyle = getComputedStyle(select);
      wrapper.className =
        `filter-dropdown native-filter-dropdown ${select.classList.contains("cal-select") ? "cal-filter-dropdown" : ""} ${select.classList.contains("cal-year-select") ? "year-filter-dropdown" : ""}`.trim();
      button.className = "filter-button";
      button.type = "button";
      button.id = `${menuId}Button`;
      button.setAttribute("aria-haspopup", "listbox");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute(
        "aria-label",
        select.getAttribute("aria-label") ||
          select.labels?.[0]?.textContent.trim() ||
          "Choose an option",
      );
      button.setAttribute("aria-controls", menuId);
      const associatedLabel = select.labels?.[0];
      if (associatedLabel) {
        if (!associatedLabel.id) associatedLabel.id = `${menuId}Label`;
        button.setAttribute("aria-labelledby", associatedLabel.id);
      }
      button.style.minWidth = originalStyle.minWidth;
      menu.className = "filter-menu";
      menu.id = menuId;
      menu.setAttribute("role", "listbox");
      menu.setAttribute("aria-labelledby", button.id);

      function syncOptions() {
        const selected = select.options[select.selectedIndex];
        button.childNodes[0]?.remove();
        button.insertBefore(
          document.createTextNode(selected ? selected.textContent.trim() : ""),
          button.firstChild,
        );
        menu.replaceChildren();
        if (select.getAttribute("aria-invalid") === "true")
          button.setAttribute("aria-invalid", "true");
        else button.removeAttribute("aria-invalid");
        [...select.options].forEach((option) => {
          const item = document.createElement("button");
          item.className = `filter-option${option.selected ? " active" : ""}`;
          item.type = "button";
          item.disabled = option.disabled;
          item.setAttribute("role", "option");
          item.setAttribute("aria-selected", String(option.selected));
          item.dataset.value = option.value;
          item.textContent = option.textContent.trim();
          menu.appendChild(item);
        });
      }

      syncOptions();
      select.dataset.dropdownEnhanced = "true";
      select.hidden = true;
      select.setAttribute("aria-hidden", "true");
      select.tabIndex = -1;
      if (select.parentElement.matches(".my-events-filter"))
        select.parentElement.classList.add("native-filter-parent");
      select.parentNode.insertBefore(wrapper, select);
      wrapper.append(button, menu, select);
      wrappers.push({ wrapper, button, menu });
      associatedLabel?.addEventListener("click", (event) => {
        if (event.target.closest(".native-filter-dropdown")) return;
        event.preventDefault();
        button.focus();
      });
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
        if (!item || item.disabled) return;
        event.stopPropagation();
        select.value = item.dataset.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        syncOptions();
        closeMenus();
        button.focus();
      });
      select.addEventListener("change", syncOptions);
      new MutationObserver(syncOptions).observe(select, {
        childList: true,
        attributes: true,
        attributeFilter: ["aria-invalid"],
      });
    });

    if (!window.dropdownMenusCloseHandler) {
      window.dropdownMenusCloseHandler = true;
      document.addEventListener("click", (event) => {
        if (event.target.closest(".native-filter-dropdown")) return;
        document
          .querySelectorAll(".native-filter-dropdown .filter-menu.show")
          .forEach((menu) => menu.classList.remove("show"));
        document
          .querySelectorAll(
            '.native-filter-dropdown .filter-button[aria-expanded="true"]',
          )
          .forEach((button) => button.setAttribute("aria-expanded", "false"));
      });
      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        document
          .querySelectorAll(".native-filter-dropdown .filter-menu.show")
          .forEach((menu) => menu.classList.remove("show"));
        document
          .querySelectorAll(
            '.native-filter-dropdown .filter-button[aria-expanded="true"]',
          )
          .forEach((button) => button.setAttribute("aria-expanded", "false"));
      });
    }
  };

window.RECOVIBE_EVENTS = [];

function getStudentPreferences() {
  try {
    const user =
      JSON.parse(localStorage.getItem("recovibeCurrentUser") || "null") || {};
    const preferenceKey = "recovibePreferences";
    const accountPreferenceKey = `recovibePreferences:${user.uid || user.email || "student"}`;
    const defaultSources = [
      "PUP Official",
      "CSC",
      "Teacher / Faculty",
      "Organizational",
      "Others / External",
    ];
    const defaults = {
      categories: ["Academic & Learning", "Tech & Innovation"],
      sources: defaultSources,
    };
    let preferences =
      user.preferences ||
      JSON.parse(localStorage.getItem(accountPreferenceKey) || "null") ||
      JSON.parse(localStorage.getItem(preferenceKey) || "null") ||
      defaults;
    if (
      !preferences ||
      !Array.isArray(preferences.categories) ||
      !Array.isArray(preferences.sources)
    ) {
      preferences = defaults;
    }
    return {
      categories: preferences.categories
        .map((c) => String(c).trim().toLowerCase())
        .filter(Boolean),
      sources: preferences.sources
        .map((s) => String(s).trim().toLowerCase())
        .filter(Boolean),
    };
  } catch {
    return {
      categories: ["academic & learning", "tech & innovation"],
      sources: [
        "pup official",
        "csc",
        "teacher / faculty",
        "organizational",
        "others / external",
      ],
    };
  }
}

function normalizeCategory(category) {
  const cat = String(category || "").trim().toLowerCase();
  if (cat.includes("academic") || cat.includes("learning"))
    return "Academic & Learning";
  if (cat.includes("tech") || cat.includes("innovation"))
    return "Tech & Innovation";
  if (
    cat.includes("leadership") ||
    cat.includes("career") ||
    cat.includes("student development")
  )
    return "Leadership & Career";
  if (cat.includes("sport") || cat.includes("fitness"))
    return "Sports & Fitness";
  if (cat.includes("music") || cat.includes("entertainment"))
    return "Music & Entertainment";
  if (cat.includes("org") || cat.includes("student act"))
    return "Orgs & Student Acts";
  if (cat.includes("social")) return "Social Events";
  if (cat.includes("community") || cat.includes("outreach"))
    return "Community & Outreach";
  if (cat.includes("competition") || cat.includes("hackathon"))
    return "Competitions";
  if (cat.includes("seminar") || cat.includes("workshop"))
    return "Seminars & Workshops";
  if (cat.includes("art") || cat.includes("culture")) return "Arts & Culture";
  if (cat.includes("university") || cat.includes("campus"))
    return "University & Campuses";
  return category || "Academic & Learning";
}

function normalizeSource(source) {
  const norm = String(source || "").trim().toLowerCase();
  if (norm.includes("holiday")) return "Philippine Holiday";
  if (
    norm === "csc" ||
    norm.includes("central student council") ||
    norm.includes("council")
  )
    return "CSC";
  if (norm.includes("teacher") || norm.includes("faculty"))
    return "Teacher / Faculty";
  if (
    norm.includes("organizer") ||
    norm.includes("organization") ||
    norm.includes("organizational") ||
    /^(ibits|aces|jpcs|pice|iie|jma|jphia|pasoa|chrms|cites)\b/i.test(norm)
  )
    return "Organizational";
  if (
    norm.includes("pup") ||
    norm.includes("official") ||
    norm.includes("campus") ||
    norm.includes("cite")
  )
    return "PUP Official";
  return "Others / External";
}

function matchesStudentPreferences(event, preferences) {
  const id = String(event.eventId || event.id || "");
  if (
    id.startsWith("holiday:") ||
    String(event.source || "").toLowerCase().includes("holiday") ||
    String(event.category || "").toLowerCase().includes("holiday")
  ) {
    return true;
  }
  const eventCat = String(
    event.category || event.categories || event.tag || "",
  )
    .trim()
    .toLowerCase();
  const normalizedCat = normalizeCategory(eventCat).toLowerCase();
  const catMatches =
    preferences.categories.length === 0 ||
    preferences.categories.some(
      (c) =>
        c === eventCat ||
        c === normalizedCat ||
        eventCat.includes(c) ||
        c.includes(eventCat),
    );

  const eventSrc = String(
    event.source || event.eventSource || "Organizational",
  )
    .trim()
    .toLowerCase();
  const normalizedSrc = normalizeSource(eventSrc).toLowerCase();
  const srcMatches =
    preferences.sources.length === 0 ||
    preferences.sources.some(
      (s) =>
        s === eventSrc ||
        s === normalizedSrc ||
        eventSrc.includes(s) ||
        s.includes(eventSrc),
    );

  return catMatches && srcMatches;
}

const currentStudentPreferences = getStudentPreferences();

// Only approved role-created records matching student preferences enter the student feed.
try {
  const rawOrganizer = localStorage.getItem("recovibeOrganizerEvents");
  if (rawOrganizer && rawOrganizer.includes("demo-event-")) {
    const cleaned = (JSON.parse(rawOrganizer) || []).filter(
      (e) => !String(e.eventId || e.id || "").startsWith("demo-event-"),
    );
    localStorage.setItem("recovibeOrganizerEvents", JSON.stringify(cleaned));
  }
  const organizerRecords = JSON.parse(
    localStorage.getItem("recovibeOrganizerEvents") || "[]",
  );
  const knownIds = new Set(window.RECOVIBE_EVENTS.map((event) => event.id));
  organizerRecords.forEach((event) => {
    const id = String(event.eventId || event.id || "");
    const status = String(event.status || "").toLowerCase();
    if (
      id &&
      !id.startsWith("demo-event-") &&
      ["approved", "published", "rescheduled"].includes(status) &&
      !knownIds.has(id)
    ) {
      const candidate = {
        ...event,
        id,
        dateISO: event.dateISO,
        title: event.title,
        location: event.location,
        room: event.room,
        time: event.time,
        source: event.source || "Event Organizer",
        tag: event.category,
        category: event.category,
        capacity:
          event.capacityMode === "N/A"
            ? null
            : Number(event.maxCapacity ?? event.capacity),
        maxSlots:
          event.capacityMode === "N/A"
            ? null
            : Number(event.maxCapacity ?? event.capacity),
        slots:
          event.capacityMode === "N/A"
            ? null
            : Number(event.openSlots ?? event.maxCapacity ?? event.capacity),
        slotsOpen:
          event.capacityMode === "N/A"
            ? null
            : Number(event.openSlots ?? event.maxCapacity ?? event.capacity),
        status: status === "rescheduled" ? "Rescheduled" : "Approved",
        desc: event.description,
        organizerId: event.organizerId,
      };
      if (matchesStudentPreferences(candidate, currentStudentPreferences)) {
        window.RECOVIBE_EVENTS.push(candidate);
        knownIds.add(id);
      }
    }
  });
} catch (error) {
  console.warn("Organizer event records could not be loaded.", error);
}

try {
  const teacherRecords = JSON.parse(
    localStorage.getItem("recovibeTeacherEvents") || "[]",
  );
  const knownIds = new Set(
    window.RECOVIBE_EVENTS.map((event) => String(event.id)),
  );
  teacherRecords.forEach((event) => {
    const id = String(event.eventId || event.id || "");
    const status = String(event.status || "").toLowerCase();
    if (
      id &&
      !id.startsWith("demo-event-") &&
      ["approved", "published", "rescheduled"].includes(status) &&
      !knownIds.has(id)
    ) {
      const candidate = {
        ...event,
        id,
        eventId: id,
        dateISO: event.dateISO || event.date,
        source: event.source || "Teacher / Faculty",
        category: event.categories || event.category || event.tag || "General",
        capacity: event.maxCapacity ?? event.capacity ?? 0,
        maxSlots: event.maxCapacity ?? event.maxSlots ?? event.capacity ?? 0,
        slotsOpen:
          event.openSlots ??
          event.slotsOpen ??
          event.maxCapacity ??
          event.capacity ??
          0,
        description: event.description || event.desc || "",
        desc: event.description || event.desc || "",
        status: status === "rescheduled" ? "Rescheduled" : "Approved",
        teacherId: event.teacherId || event.organizerId || event.createdBy,
      };
      if (matchesStudentPreferences(candidate, currentStudentPreferences)) {
        window.RECOVIBE_EVENTS.push(candidate);
        knownIds.add(id);
      }
    }
  });
} catch (error) {
  console.warn("Teacher event records could not be loaded.", error);
}
