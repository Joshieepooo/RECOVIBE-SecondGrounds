import { checkPhilippineHoliday } from "../holidayService.js";

(function () {
  "use strict";

  const organizer = /EventOrganizerCreateEvent\.html$/i.test(location.pathname);
  const storage = organizer
    ? {
        profile: "recovibeOrganizerProfile",
        id: "recovibeOrganizerId",
        events: "recovibeOrganizerEvents",
        list: "EventOrganizerMyEvents.html",
        login: "EventOrganizerLogin.html",
      }
    : {
        profile: "recovibeCurrentTeacher",
        id: "recovibeTeacherId",
        events: "recovibeTeacherEvents",
        list: "TeacherMyEvent.html",
        login: "TeacherLogin.html",
      };
  const profile = readJSON(storage.profile, null);
  const identity = String(
    localStorage.getItem(storage.id) || profile?.email || "",
  )
    .trim()
    .toLowerCase();
  const actorName = String(
    profile?.name ||
      profile?.fullName ||
      (
        identity.split("@")[0] || (organizer ? "Event Organizer" : "Teacher")
      ).replace(/[._-]+/g, " "),
  ).trim();
  const actorRole = String(
    profile?.role || (organizer ? "Event Organizer" : "Teacher"),
  );
  const query = new URLSearchParams(location.search);
  const editId = query.get("eventId") || query.get("id");
  const root = document.getElementById("createEventRoot");
  const SOURCE = [
    "PUP Official",
    "CSC",
    "Teacher / Faculty",
    "Organizational",
    "Others / External",
  ];
  const CATEGORIES = [
    "Academic & Learning",
    "Tech & Innovation",
    "Leadership & Career",
    "Sports & Fitness",
    "Music & Entertainment",
    "Orgs & Student Acts",
    "Social Events",
    "Community & Outreach",
    "Competitions",
    "Seminars & Workshops",
    "Arts & Culture",
    "University & Campuses",
  ];
  const EVENT_TYPES = [
    "Seminar",
    "Workshop",
    "General Assembly",
    "Competition",
    "Other",
  ];
  const TARGET_DEPARTMENTS = [
    "All Departments",
    "BSIT",
    "BSCPE",
    "BSBA",
    "BSOA",
    "BSHM",
  ];
  const TARGET_YEARS = [
    "All Years",
    "1st Year",
    "2nd Year",
    "3rd Year",
    "4th Year",
  ];
  const VENUES = [
    "Open Field | PUP Biñan",
    "AVR1 | PUP Biñan",
    "AVR2-1Room | PUP Biñan",
    "AVR2-2Room | PUP Biñan",
    "AVR2-3Room | PUP Biñan",
    "AVR2 | PUP Biñan",
    "Kiosk | PUP Biñan",
    "Open Field | PUP CITE",
    "4th Floor | PUP CITE",
    "Others | Inside PUP",
    "Others | Outside PUP",
    "Online / Virtual",
  ];
  const TIMES = Array.from({ length: 96 }, (_, index) => {
    const minute = index * 15;
    const hour = Math.floor(minute / 60);
    return `${String(hour % 12 || 12).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
  });
  const state = {
    id: null,
    event: null,
    dirty: false,
    pending: false,
    validateOnBlur: false,
    conflict: null,
    recipients: [],
    participantDocuments: [],
    approvalDocuments: [],
    createdFiles: new Set(),
    removedFiles: new Set(),
    errors: new Set(),
  };
  let toastTimer;

  function readJSON(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  }
  function escapeHTML(value) {
    return String(value ?? "").replace(
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
  }
  function attr(value) {
    return escapeHTML(value).replace(/`/g, "&#96;");
  }
  function input(
    id,
    label,
    type,
    placeholder = "",
    attrs = "",
    suffix = "",
  ) {
    return `<div class="ce-field" id="wrap-${id}"><label for="${id}">${label}</label><input id="${id}" name="${id}" type="${type}" placeholder="${attr(placeholder)}" ${attrs}>${suffix}<p class="ce-error" id="error-${id}" hidden></p></div>`;
  }
  function dropdown(id, label, options, value = "") {
    return `<div class="ce-field" id="wrap-${id}"><label id="label-${id}" for="${id}-button">${label}</label><div class="ce-dropdown" data-dropdown="${id}"><button class="ce-select" id="${id}-button" type="button" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="label-${id} ${id}-button"><span class="ce-select-value">${escapeHTML(value || "Select...")}</span><span class="ce-chevron" aria-hidden="true"></span></button><div class="ce-options" id="${id}-options" role="listbox" aria-labelledby="label-${id}" tabindex="-1">${options.map((option) => `<button class="ce-option" type="button" role="option" aria-selected="${option === value}" data-value="${attr(option)}" tabindex="-1">${escapeHTML(option)}</button>`).join("")}</div><input id="${id}" type="hidden" value="${attr(value)}"></div><p class="ce-error" id="error-${id}" hidden></p></div>`;
  }
  function area(id, label, hint = "", max = "") {
    return `<div class="ce-field ce-field--textarea" id="wrap-${id}"><label for="${id}">${label}</label><textarea id="${id}" rows="4" maxlength="${max || 10000}" placeholder="${id === "description" ? "Describe the event..." : "One item per line"}"></textarea>${hint ? `<small class="ce-hint">${hint}</small>` : ""}${id === "description" ? '<small class="ce-hint" id="descriptionCounter">0/1500</small>' : ""}<p class="ce-error" id="error-${id}" hidden></p></div>`;
  }

  if (!identity || (!organizer && !profile)) {
    location.replace(storage.login);
    return;
  }

  root.innerHTML = `
    <header class="ce-heading"><div><h1 id="createHeading">${editId ? "Edit Event" : "Create Event"}</h1><p>Create an event and submit it for approval.</p></div><span id="loadMessage" role="status"></span></header>
    <form id="createForm" novalidate>
      <section class="ce-section"><h2>Event Information</h2>
        <div class="ce-grid ce-grid--4">${input("eventName", "Event Name", "text", "Enter the event name", 'minlength="3" maxlength="100" required')}${input("eventOrganizer", "Event Organizer", "text", "Name of the organizer", "required")}${dropdown("eventSource", "Event Source", SOURCE)}
          <div class="ce-field" id="wrap-categories"><span class="ce-label" id="label-categories">Event Category <small>(select up to 3)</small></span><div class="ce-dropdown" data-dropdown="categories"><button class="ce-select" id="categories-button" type="button" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="label-categories categories-button"><span class="ce-select-value">Select categories...</span><span class="ce-chevron" aria-hidden="true"></span></button><div class="ce-options ce-options--checks" id="categories-options" role="listbox" aria-labelledby="label-categories" aria-multiselectable="true">${CATEGORIES.map((category) => `<label class="ce-option ce-check-option" role="option" aria-selected="false"><input type="checkbox" value="${attr(category)}"><span>${escapeHTML(category)}</span></label>`).join("")}</div></div><p class="ce-error" id="error-categories" hidden></p></div>
        </div>
        <div class="ce-grid ce-grid--4 ce-grid--space">${dropdown("eventType", "Event Type", EVENT_TYPES, "Seminar")}${dropdown("targetDepartment", "Target Department", TARGET_DEPARTMENTS, "All Departments")}${dropdown("targetYear", "Target Year", TARGET_YEARS, "All Years")}</div>
        <div class="ce-grid ce-grid--4 ce-grid--space">${input("eventDate", "Date", "date", "", "required", '<p id="holidayNotice" class="ce-holiday-notice" role="status" aria-live="polite" hidden></p>')}${dropdown("venue", "Venue", VENUES)}${dropdown("timeStart", "Time Start", TIMES, "08:00 AM")}${dropdown("timeEnd", "Time End", TIMES, "09:00 AM")}</div>
        <div id="venueOtherWrap" class="ce-dependent" hidden>${input("venueOther", "Specify location", "text", "Enter the location", "required")}</div><div id="sourceOtherWrap" class="ce-dependent" hidden>${input("sourceOther", "Specify organization", "text", "Enter the organization", "required")}</div>
        <div class="ce-grid ce-grid--4 ce-grid--space">${input("registrationDeadline", "Registration Deadline", "datetime-local", "", "required")}${dropdown("capacityMode", "Capacity", ["N/A", "Max Cap Depends", "Both Cap and Weather"], "N/A")}<div class="ce-field"><label for="weatherContingency">Weather Contingency</label><p class="ce-hint" id="weatherContingencyText">Select a venue to determine rain contingency.</p><input id="weatherContingency" name="weatherContingency" type="hidden"></div>${dropdown("attendanceRequired", "Attendance Required", ["Yes", "No"], "Yes")}</div>
        <div id="capacityDetails" class="ce-grid ce-grid--4 ce-grid--space ce-dependent" hidden><div id="maxCapacityWrap">${input("maxCapacity", "Max Capacity", "number", "Positive whole number", 'min="1" step="1"')}</div><div class="ce-field" id="alternateVenueWrap" hidden><label id="label-alternateVenue" for="alternateVenue-button">Alternate Venue</label><div class="ce-dropdown" data-dropdown="alternateVenue"><button class="ce-select" id="alternateVenue-button" type="button" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="label-alternateVenue alternateVenue-button"><span class="ce-select-value">Select...</span><span class="ce-chevron" aria-hidden="true"></span></button><div class="ce-options" id="alternateVenue-options" role="listbox" aria-labelledby="label-alternateVenue" tabindex="-1">${VENUES.map((option) => `<button class="ce-option" type="button" role="option" aria-selected="false" data-value="${attr(option)}" tabindex="-1">${escapeHTML(option)}</button>`).join("")}</div><input id="alternateVenue" type="hidden"></div><p class="ce-error" id="error-alternateVenue" hidden></p></div></div>
        <p id="venueConflict" class="ce-error ce-conflict" role="alert" hidden></p><p id="duplicateWarning" class="ce-warning" role="status" hidden></p>
      </section>
      <section class="ce-section"><h2>Event Details</h2><div class="ce-grid ce-grid--2">${area("description", "Event Description", "", 1500)}${area("keyDetails", "Event Key Details", "One item per line")}${area("requirements", "Requirements & Reminders", "One item per line")}${area("participationRules", "Participation Rules", "One item per line")}
        <section class="ce-field ce-contact-box" id="wrap-contact"><h3>Contact Person</h3><div class="ce-grid ce-grid--2">${input("contactName", "Name", "text", "Contact name")}${input("contactRole", "Role", "text", "Event contact")}${input("contactEmail", "Email", "email", "name@example.com")}${input("contactPhone", "Contact Number", "tel", "09XXXXXXXXX or +639XXXXXXXXX", 'inputmode="tel"')}</div></section>
        <section class="ce-field ce-field--textarea"><label for="recipientSearch">Invitation Recipients <small>(optional)</small></label><div class="ce-recipient-box"><input id="recipientSearch" type="search" autocomplete="off" placeholder="Search by name or email"><div id="recipientSuggestions" class="ce-suggestions" role="listbox" hidden></div><ol id="recipientList" class="ce-recipient-list"></ol><small class="ce-hint" id="recipientEmpty">Search existing users to add recipients.</small></div></section>
      </div></section>
      <section class="ce-section"><h2>Documents</h2><div class="ce-grid ce-grid--2">${documentGroup("participantDocuments", "Participant Documents", "No participant files attached.")}${documentGroup("approvalDocuments", "Approval Documents", "No approval files attached. (Optional)")}</div></section>
      <div id="formError" class="ce-form-error" role="alert" hidden></div><div class="ce-actions"><button class="ce-button" id="saveDraft" type="button">Save as Draft</button><button class="ce-button" id="submitForApproval" type="button">Submit for Approval</button><button class="ce-button" id="cancelCreate" type="button">Cancel</button></div>
    </form><div class="ce-toast" id="createToast" role="status" aria-live="polite" hidden></div>
    <div class="ce-dialog-layer" id="confirmLayer" hidden><section class="ce-confirm" role="dialog" aria-modal="true" aria-labelledby="confirmTitle"><h2 id="confirmTitle"></h2><p id="confirmText"></p><div class="ce-confirm-actions"><button class="ce-confirm-primary" id="confirmAccept" type="button"></button><button class="ce-confirm-cancel" id="confirmCancel" type="button"></button></div></section></div>`;

  function documentGroup(id, title, emptyText) {
    return `<section class="ce-document-group" id="wrap-${id}"><header><h3>${title}</h3><button class="ce-add-file" type="button" data-file-list="${id}" aria-label="Add ${title.toLowerCase()}">+</button></header><input class="ce-file-input" id="file-picker-${id}" type="file" data-file-input="${id}" accept=".doc,.docx,.pdf" multiple hidden><ul class="ce-document-list" id="${id}List"></ul><p class="ce-hint ce-doc-empty" id="${id}Empty">${emptyText}</p><p class="ce-error" id="error-${id}" hidden></p></section>`;
  }

  const allUsers = findUsers();
  function findUsers() {
    const users = [];
    [
      "recovibeAccounts",
      "recovibeTeachers",
      "recovibeTeacherAccounts",
      "recovibeOrganizerAccounts",
      "recovibeUsers",
    ].forEach((key) => {
      const items = readJSON(key, []);
      if (Array.isArray(items))
        items.forEach((item) => {
          const id = item.id || item.userId || item.studentId || item.email;
          if (id)
            users.push({
              id: String(id),
              name: String(item.name || item.fullName || item.email),
              email: String(item.email || ""),
            });
        });
    });
    ["recovibeCurrentTeacher", "recovibeOrganizerProfile"].forEach((key) => {
      const item = readJSON(key, null);
      const id =
        item && (item.id || item.userId || item.studentId || item.email);
      if (id)
        users.push({
          id: String(id),
          name: String(item.name || item.fullName || item.email),
          email: String(item.email || ""),
        });
    });
    const seen = new Set();
    return users.filter((item) => {
      const key = item.id.toLowerCase();
      if (seen.has(key) || key === identity) return false;
      seen.add(key);
      return true;
    });
  }

  const fileDB = openFileDatabase().catch((error) => ({ storageError: error }));
  function openFileDatabase() {
    return new Promise((resolve, reject) => {
      if (!indexedDB) {
        reject(new Error("IndexedDB is unavailable."));
        return;
      }
      const request = indexedDB.open("RecoVibeEventDocuments", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("files"))
          request.result.createObjectStore("files", { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(
          request.error || new Error("Could not access document storage."),
        );
    });
  }
  async function putFile(file) {
    const db = await fileDB;
    if (db.storageError) throw db.storageError;
    const id = `event-file-${crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random().toString(36).slice(2)}`;
    await new Promise((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").put({
        id,
        name: file.name,
        type: file.type,
        size: file.size,
        blob: file,
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    state.createdFiles.add(id);
    return {
      id,
      fileId: id,
      name: file.name,
      fileName: file.name,
      type: file.type,
      size: file.size,
      status: "ready",
    };
  }
  async function removeFile(id) {
    if (!id) return;
    try {
      const db = await fileDB;
      await new Promise((resolve, reject) => {
        const tx = db.transaction("files", "readwrite");
        tx.objectStore("files").delete(id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      state.createdFiles.delete(id);
    } catch (error) {
      showToast(`File cleanup failed: ${error.message}`);
    }
  }
  async function downloadFile(item) {
    try {
      const db = await fileDB;
      if (db.storageError) throw db.storageError;
      const stored = await new Promise((resolve, reject) => {
        const request = db
          .transaction("files")
          .objectStore("files")
          .get(item.fileId || item.id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (!stored) throw new Error("File is unavailable.");
      const url = URL.createObjectURL(stored.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = stored.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (error) {
      showToast(`Could not open the document. ${error.message}`);
    }
  }

  function escapeId(text) {
    return String(text).replace(/[^a-zA-Z0-9_-]/g, "");
  }
  function el(id) {
    return document.getElementById(id);
  }
  function value(id) {
    return el(id)?.value || "";
  }
  function readEvents(key = storage.events) {
    const events = readJSON(key, []);
    return Array.isArray(events) ? events : [];
  }
  function writeEvents(events) {
    localStorage.setItem(storage.events, JSON.stringify(events));
    if (organizer)
      window.dispatchEvent(new Event("recovibeOrganizerEventsChanged"));
  }
  let firebaseModulesPromise;
  function loadFirebaseModules() {
    if (!firebaseModulesPromise) {
      firebaseModulesPromise = Promise.all([
        import("../UserStudent/firebaseConfig.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"),
      ]);
    }
    return firebaseModulesPromise;
  }
  async function requireOrganizerAuth() {
    if (!organizer) return true;
    try {
      const [firebase] = await loadFirebaseModules();
      if (!firebase.isFirebaseConfigured || !firebase.auth || !firebase.db) {
        showToast("Event publishing is not configured. Contact support.");
        return false;
      }
      if (!firebase.auth.currentUser?.uid) {
        showToast("No authenticated session found. Please sign in again before publishing.");
        return false;
      }
      return true;
    } catch (error) {
      showToast(`Could not connect to Firebase. ${error.message}`);
      return false;
    }
  }
  async function createFirestoreEvent() {
    const [firebase, firestore] = await loadFirebaseModules();
    const auth = firebase.auth;
    const user = auth?.currentUser;
    if (!firebase.isFirebaseConfigured || !firebase.db)
      throw new Error("Event publishing is not configured. Contact support.");
    if (!user?.uid) throw new Error("No authenticated session found.");

    const approvalDocuments = state.approvalDocuments
      .filter((file) => file.status === "ready")
      .map(({ status: _status, ...file }) => file);
    const participantDocuments = state.participantDocuments
      .filter((file) => file.status === "ready")
      .map(({ status: _status, ...file }) => file);
    const categories = selectedCategories();
    const maxCapacity = value("maxCapacity")
      ? Number(value("maxCapacity"))
      : null;
    const eventData = {
      eventName: value("eventName").trim(),
      eventDescription: value("description").trim(),
      eventType: value("eventType"),
      source: normalizeSource(value("eventSource")),
      eventSource: normalizeSource(value("eventSource")),
      sourceOther: value("sourceOther").trim(),
      categories,
      category: categories.join(", "),
      eventDate: value("eventDate"),
      registrationDeadline: value("registrationDeadline"),
      startTime: value("timeStart"),
      endTime: value("timeEnd"),
      venue: value("venueOther").trim() || value("venue"),
      location: value("venueOther").trim() || value("venue"),
      capacityMode: value("capacityMode"),
      maxCapacity,
      capacity: maxCapacity,
      maxSlots: maxCapacity,
      slots: maxCapacity,
      slotsOpen: maxCapacity,
      openSlots: maxCapacity,
      alternateVenue: value("alternateVenue"),
      weatherContingency: value("weatherContingency"),
      weatherPlan: value("weatherContingency"),
      attendanceRequired: value("attendanceRequired") === "Yes",
      keyDetails: parseLines("keyDetails"),
      requirements: parseLines("requirements"),
      participationRules: parseLines("participationRules"),
      contactPerson: {
        name: value("contactName").trim(),
        role: value("contactRole").trim(),
        email: value("contactEmail").trim(),
        contactNumber: value("contactPhone").replace(/[\s-]/g, ""),
      },
      participantDocuments,
      attachments: participantDocuments,
      approvalDocuments,
      createdBy: user.uid,
      organizerId: user.uid,
      creatorEmail: user.email,
      organizerEmail: user.email,
      createdByName: user.displayName || "Event Organizer",
      status: "Pending",
      approvals: {
        adviser: { status: "Pending" },
        campusAdmin: { status: "Pending" },
        superAdmin: { status: "Pending" },
      },
      createdAt: firestore.serverTimestamp(),
    };
    const docRef = await firestore.addDoc(
      firestore.collection(firebase.db, "events"),
      eventData,
    );
    console.log(">> EVENT SAVED UNDER UID:", user.uid, "DOC ID:", docRef.id);
    return { eventData, eventId: docRef.id };
  }
  function markDirty() {
    state.dirty = true;
  }
  function showToast(message) {
    const toast = el("createToast");
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 3200);
  }
  let holidayLookupSequence = 0;
  async function updateHolidayNotice() {
    const date = el("eventDate").value;
    const notice = el("holidayNotice");
    const sequence = ++holidayLookupSequence;
    notice.hidden = true;
    notice.textContent = "";
    notice.classList.remove("is-warning", "is-unavailable");

    if (!date) return;

    try {
      const result = await checkPhilippineHoliday(date);
      if (sequence !== holidayLookupSequence || el("eventDate").value !== date)
        return;
      if (!result.isHoliday) return;

      notice.textContent = `Warning: Selected date falls on ${result.holidayName || "an official Philippine holiday"}.`;
      notice.classList.add("is-warning");
      notice.hidden = false;
    } catch (error) {
      console.warn(
        "Unable to check the selected date for a Philippine holiday:",
        error,
      );
      if (sequence !== holidayLookupSequence || el("eventDate").value !== date)
        return;

      notice.textContent =
        "Holiday information is unavailable. You can still submit this event.";
      notice.classList.add("is-unavailable");
      notice.hidden = false;
    }
  }
  function control(id) {
    if (id === "categories") return el("categories-button");
    return (
      el(id)?.closest(".ce-dropdown")?.querySelector(".ce-select") || el(id)
    );
  }
  function setError(id, message) {
    const target = control(id) || el(`wrap-${id}`);
    el(`wrap-${id}`)?.classList.add("invalid");
    const error = el(`error-${id}`);
    if (!error) return;
    if (target) {
      if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
      target.setAttribute("aria-invalid", "true");
    }
    error.textContent = message;
    error.hidden = false;
    state.errors.add(id);
  }
  function clearError(id) {
    control(id)?.removeAttribute("aria-invalid");
    el(`wrap-${id}`)?.classList.remove("invalid");
    el(`wrap-${id}`)?.removeAttribute("aria-invalid");
    const error = el(`error-${id}`);
    if (error) {
      error.hidden = true;
      error.textContent = "";
    }
    state.errors.delete(id);
  }
  function normalizeSource(source) {
    const text = String(source || "").trim().toLowerCase();
    if (!text) return "";
    if (/\bcsc\b/.test(text)) return "CSC";
    if (/teacher|faculty/.test(text)) return "Teacher / Faculty";
    if (/organization|organizational|ibits|event organizer/.test(text))
      return "Organizational";
    if (/external|admin|other/.test(text)) return "Others / External";
    if (/pup|campus|cite/.test(text)) return "PUP Official";
    return "Others / External";
  }
  function updateWeatherContingency() {
    const venue = `${value("venue")} ${value("venueOther")}`.toLowerCase();
    const weather = /open field|outside|outdoor/.test(venue)
      ? "Outside – Might Rain."
      : "No rain concerns.";
    el("weatherContingency").value = weather;
    el("weatherContingencyText").textContent = weather;
  }
  function setDropdown(id, next) {
    const input = el(id);
    if (!input) return;
    if (id === "eventSource") next = normalizeSource(next);
    input.value = next || "";
    const rootEl = input.closest(".ce-dropdown");
    if (!rootEl) return;
    rootEl.querySelector(".ce-select-value").textContent = next || "Select...";
    rootEl.querySelectorAll(".ce-option").forEach((option) => {
      const selected = option.dataset.value === next;
      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-selected", String(selected));
    });
  }
  function selectedCategories() {
    return [...root.querySelectorAll("#categories-options input:checked")].map(
      (input) => input.value,
    );
  }
  function categoryLabel() {
    const items = selectedCategories();
    el("categories-button").querySelector(".ce-select-value").textContent =
      items.length > 1
        ? `${items[0]} +${items.length - 1}`
        : items[0] || "Select categories...";
  }
  function setupDropdowns() {
    root.querySelectorAll(".ce-dropdown").forEach((drop) => {
      if (drop.dataset.dropdown === "categories") return;
      const button = drop.querySelector(".ce-select");
      const menu = drop.querySelector(".ce-options");
      const open = (state) => {
        drop.classList.toggle("is-open", state);
        button.setAttribute("aria-expanded", String(state));
      };
      const options = () => [...menu.querySelectorAll(".ce-option")];
      const focusBy = (step) => {
        const list = options();
        const index = list.indexOf(document.activeElement);
        list[Math.max(0, Math.min(list.length - 1, index + step))]?.focus();
      };
      button.addEventListener("click", () => {
        const wasOpen = drop.classList.contains("is-open");
        closeDropdowns();
        if (!wasOpen) {
          open(true);
          options()[0]?.focus();
        }
      });
      button.addEventListener("keydown", (event) => {
        if (["ArrowDown", "Enter", " "].includes(event.key)) {
          event.preventDefault();
          open(true);
          options()[0]?.focus();
        }
      });
      menu.addEventListener("click", (event) => {
        const option = event.target.closest(".ce-option");
        if (!option) return;
        setDropdown(drop.dataset.dropdown, option.dataset.value);
        markDirty();
        clearError(drop.dataset.dropdown);
        open(false);
        button.focus();
        conditionalFields();
        detectConflict();
        duplicateWarning();
      });
      menu.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          focusBy(1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          focusBy(-1);
        } else if (event.key === "Home") {
          event.preventDefault();
          options()[0]?.focus();
        } else if (event.key === "End") {
          event.preventDefault();
          options().at(-1)?.focus();
        } else if (event.key === "Escape") {
          event.preventDefault();
          open(false);
          button.focus();
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          document.activeElement.click();
        } else if (event.key === "Tab") open(false);
      });
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".ce-dropdown")) closeDropdowns();
    });
  }
  function closeDropdowns() {
    root.querySelectorAll(".ce-dropdown.is-open").forEach((drop) => {
      drop.classList.remove("is-open");
      drop.querySelector(".ce-select").setAttribute("aria-expanded", "false");
    });
  }
  function setupCategories() {
    const drop = root.querySelector('[data-dropdown="categories"]');
    const button = el("categories-button");
    button.addEventListener("click", () => {
      const opened = !drop.classList.contains("is-open");
      closeDropdowns();
      drop.classList.toggle("is-open", opened);
      button.setAttribute("aria-expanded", String(opened));
    });
    button.addEventListener("keydown", (event) => {
      if (["ArrowDown", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        drop.classList.add("is-open");
        button.setAttribute("aria-expanded", "true");
        el("categories-options").querySelector("input")?.focus();
      }
    });
    root.querySelectorAll("#categories-options input").forEach((input) =>
      input.addEventListener("change", () => {
        const selected = selectedCategories();
        if (selected.length > 3) input.checked = false;
        const option = input.closest('[role="option"]');
        option?.setAttribute("aria-selected", String(input.checked));
        categoryLabel();
        markDirty();
        clearError("categories");
      }),
    );
    root.querySelectorAll("#categories-options input").forEach((input) =>
      input.addEventListener("keydown", (event) => {
        const list = [...root.querySelectorAll("#categories-options input")];
        const index = list.indexOf(input);
        if (event.key === "Escape") {
          event.preventDefault();
          drop.classList.remove("is-open");
          button.setAttribute("aria-expanded", "false");
          button.focus();
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          list[
            Math.max(
              0,
              Math.min(
                list.length - 1,
                index + (event.key === "ArrowDown" ? 1 : -1),
              ),
            )
          ]?.focus();
        } else if (event.key === "Enter") {
          event.preventDefault();
          input.checked = !input.checked;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }),
    );
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && drop.classList.contains("is-open")) {
        drop.classList.remove("is-open");
        button.setAttribute("aria-expanded", "false");
        button.focus();
      }
    });
  }

  function conditionalFields() {
    const venue = value("venue");
    const source = value("eventSource");
    updateWeatherContingency();
    const capacity = value("capacityMode") !== "N/A";
    const weatherAlternate =
      value("weatherContingency") === "Outside – Might Rain.";
    const alternate = capacity || weatherAlternate;
    el("venueOtherWrap").hidden = ![
      "Others | Inside PUP",
      "Others | Outside PUP",
    ].includes(venue);
    el("sourceOtherWrap").hidden = source !== "Others / External";
    el("capacityDetails").hidden = !alternate;
    el("maxCapacityWrap").hidden = !capacity;
    el("alternateVenueWrap").hidden = !alternate;
    if (el("venueOtherWrap").hidden) {
      el("venueOther").value = "";
      clearError("venueOther");
    }
    if (el("sourceOtherWrap").hidden) {
      el("sourceOther").value = "";
      clearError("sourceOther");
    }
    if (!capacity) {
      el("maxCapacity").value = "";
      clearError("maxCapacity");
    }
    if (!alternate) {
      setDropdown("alternateVenue", "");
      clearError("alternateVenue");
    }
  }
  el("venueOther").addEventListener("input", () => {
    updateWeatherContingency();
    conditionalFields();
  });
  function timeMinutes(text) {
    const match = /^(\d{2}):(\d{2})\s(AM|PM)$/.exec(text || "");
    return match
      ? ((Number(match[1]) % 12) + (match[3] === "PM" ? 12 : 0)) * 60 +
          Number(match[2])
      : null;
  }
  function asTime12(text) {
    const match = /^(\d{2}):(\d{2})/.exec(text || "");
    if (!match) return "";
    const hour = Number(match[1]);
    return `${String(hour % 12 || 12).padStart(2, "0")}:${match[2]} ${hour < 12 ? "AM" : "PM"}`;
  }
  function asTime24(text) {
    const minutes = timeMinutes(text);
    return minutes === null
      ? ""
      : `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }
  function startDateTime() {
    const time = asTime24(value("timeStart"));
    return value("eventDate") && time
      ? new Date(`${value("eventDate")}T${time}:00+08:00`)
      : null;
  }
  function normalizeStatus(event) {
    return String(event.status || "")
      .toLowerCase()
      .replace(/[ _-]+/g, " ");
  }
  function venueMatches(a, b) {
    if (a === b) return true;
    const allRooms = [
      "AVR2-1Room | PUP Biñan",
      "AVR2-2Room | PUP Biñan",
      "AVR2-3Room | PUP Biñan",
    ];
    return (
      (a === "AVR2 | PUP Biñan" && allRooms.includes(b)) ||
      (b === "AVR2 | PUP Biñan" && allRooms.includes(a))
    );
  }
  function conflictEvents() {
    const list = [];
    [
      storage.events,
      organizer ? "recovibeTeacherEvents" : "recovibeOrganizerEvents",
    ].forEach((key) =>
      readEvents(key).forEach((event) => {
        if (
          [
            "approved",
            "published",
            "pending approval",
            "pending",
            "pending_approval",
          ].includes(normalizeStatus(event))
        )
          list.push(event);
      }),
    );
    return list;
  }
  function detectConflict() {
    const date = value("eventDate"),
      venue = value("venue"),
      start = timeMinutes(value("timeStart")),
      end = timeMinutes(value("timeEnd"));
    const box = el("venueConflict");
    if (
      !date ||
      !venue ||
      start === null ||
      end === null ||
      venue.startsWith("Others |")
    ) {
      box.hidden = true;
      box.textContent = "";
      state.conflict = null;
      return;
    }
    state.conflict =
      conflictEvents().find((event) => {
        const id = String(event.eventId || event.id || "");
        if (id === String(state.id || "")) return false;
        if (String(event.dateISO || event.date || "").slice(0, 10) !== date)
          return false;
        if (!venueMatches(venue, event.venue || event.location || ""))
          return false;
        const range = String(event.time || "").split(/\s*[-–]\s*/);
        const oldStart = timeMinutes(
          event.startTime ? asTime12(event.startTime) : range[0],
        );
        const oldEnd = timeMinutes(
          event.endTime ? asTime12(event.endTime) : range[1],
        );
        return (
          oldStart !== null &&
          oldEnd !== null &&
          start < oldEnd &&
          end > oldStart
        );
      }) || null;
    box.hidden = !state.conflict;
    box.textContent = state.conflict
      ? `Venue conflict with “${state.conflict.title || "another event"}” at ${venue}.`
      : "";
  }
  function duplicateWarning() {
    const title = value("eventName").trim().toLowerCase(),
      date = value("eventDate"),
      name = value("eventOrganizer").trim().toLowerCase();
    const duplicate =
      title &&
      date &&
      name &&
      readEvents().find(
        (event) =>
          String(event.eventId || event.id) !== String(state.id || "") &&
          String(event.title || "")
            .trim()
            .toLowerCase() === title &&
          String(event.dateISO || event.date || "").slice(0, 10) === date &&
          String(event.organizerName || event.organizer || "")
            .trim()
            .toLowerCase() === name,
      );
    const warning = el("duplicateWarning");
    warning.hidden = !duplicate;
    warning.textContent = duplicate
      ? `Possible duplicate: “${duplicate.title}” has the same organizer and date.`
      : "";
  }

  function renderRecipients() {
    const list = el("recipientList");
    list.replaceChildren();
    state.recipients.forEach((recipient, index) => {
      const row = document.createElement("li");
      row.className = "ce-recipient-row";
      const number = document.createElement("span");
      number.textContent = `${index + 1}.`;
      const name = document.createElement("span");
      name.textContent = recipient.displayName;
      const email = document.createElement("small");
      email.textContent = recipient.email;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove ${recipient.displayName}`);
      remove.addEventListener("click", () => {
        state.recipients.splice(index, 1);
        renderRecipients();
        markDirty();
      });
      row.append(number, name, email, remove);
      list.append(row);
    });
    el("recipientEmpty").hidden = state.recipients.length > 0;
  }
  function updateRecipientSuggestions() {
    const query = value("recipientSearch").trim().toLowerCase(),
      box = el("recipientSuggestions");
    box.replaceChildren();
    if (!query) {
      box.hidden = true;
      return;
    }
    allUsers
      .filter(
        (user) =>
          `${user.name} ${user.email}`.toLowerCase().includes(query) &&
          !state.recipients.some(
            (item) => String(item.id).toLowerCase() === user.id.toLowerCase(),
          ),
      )
      .slice(0, 8)
      .forEach((user) => {
        const option = document.createElement("button");
        option.type = "button";
        option.setAttribute("role", "option");
        option.textContent = `${user.name} · ${user.email}`;
        option.addEventListener("click", () => {
          state.recipients.push({
            id: user.id,
            displayName: user.name,
            email: user.email,
          });
          el("recipientSearch").value = "";
          box.hidden = true;
          renderRecipients();
          markDirty();
        });
        box.append(option);
      });
    box.hidden = !box.childElementCount;
  }

  function renderFiles(name) {
    const list = el(`${name}List`);
    list.replaceChildren();
    state[name].forEach((item, index) => {
      const row = document.createElement("li");
      row.className = `ce-document-row${item.status === "uploading" ? " is-uploading" : ""}${item.status === "failed" ? " is-failed" : ""}`;
      const open = document.createElement("button");
      open.type = "button";
      open.className = "ce-document-name";
      open.textContent = item.name || item.fileName;
      open.title = open.textContent;
      open.disabled = item.status === "uploading";
      open.addEventListener("click", () => downloadFile(item));
      const status = document.createElement("small");
      status.textContent =
        item.status === "uploading"
          ? "Uploading…"
          : item.status === "failed"
            ? "Upload failed"
            : `${Math.max(1, Math.round((item.size || 0) / 1024))} KB`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.disabled = item.status === "uploading";
      remove.setAttribute("aria-label", `Remove ${item.name || item.fileName}`);
      remove.addEventListener("click", () => {
        state[name].splice(index, 1);
        state.removedFiles.add(item.fileId || item.id);
        renderFiles(name);
        markDirty();
      });
      row.append(open, status, remove);
      list.append(row);
    });
    el(`${name}Empty`).hidden = state[name].length > 0;
  }
  async function processFiles(input) {
    const name = input.dataset.fileInput;
    const err = el(`error-${name}`);
    err.hidden = true;
    err.textContent = "";
    const accepted = [];
    for (const file of input.files || []) {
      const ext = file.name.split(".").pop().toLowerCase();
      if (!["doc", "docx", "pdf"].includes(ext)) {
        err.textContent = "Only .doc, .docx, and .pdf files are accepted.";
        err.hidden = false;
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        err.textContent = `${file.name} exceeds 10 MB.`;
        err.hidden = false;
        continue;
      }
      if (state[name].length + accepted.length >= 10) {
        err.textContent = "Maximum 10 files per list.";
        err.hidden = false;
        break;
      }
      if (
        state[name].some(
          (item) =>
            (item.name || item.fileName || "").toLowerCase() ===
            file.name.toLowerCase(),
        ) ||
        accepted.some(
          (item) => item.name.toLowerCase() === file.name.toLowerCase(),
        )
      ) {
        err.textContent = `${file.name} is already attached.`;
        err.hidden = false;
        continue;
      }
      accepted.push(file);
    }
    if (!accepted.length) {
      input.value = "";
      return;
    }
    markDirty();
    state.pending = true;
    buttonsBusy(true);
    try {
      for (const file of accepted) {
        const row = { name: file.name, size: file.size, status: "uploading" };
        state[name].push(row);
        renderFiles(name);
        try {
          Object.assign(row, await putFile(file));
        } catch (error) {
          row.status = "failed";
          err.textContent = `Upload failed for ${file.name}: ${error.message}`;
          err.hidden = false;
          showToast(`Could not upload ${file.name}. Remove it and retry.`);
        }
        renderFiles(name);
      }
    } finally {
      state.pending = false;
      buttonsBusy(false);
      input.value = "";
    }
  }

  function validateField(id) {
    const valueFor =
      id === "categories"
        ? selectedCategories()
        : [
              "eventSource",
              "venue",
              "timeStart",
              "timeEnd",
              "capacityMode",
              "weatherContingency",
              "attendanceRequired",
              "alternateVenue",
            ].includes(id)
          ? value(id)
          : value(id).trim();
    const required =
      [
        "eventName",
        "eventOrganizer",
        "eventSource",
        "categories",
        "eventDate",
        "venue",
        "timeStart",
        "timeEnd",
        "registrationDeadline",
        "attendanceRequired",
        "description",
        "keyDetails",
        "contactName",
        "contactEmail",
      ].includes(id) ||
      (id === "venueOther" && !el("venueOtherWrap").hidden) ||
      (id === "sourceOther" && !el("sourceOtherWrap").hidden) ||
      (id === "maxCapacity" && !el("maxCapacityWrap").hidden) ||
      (id === "alternateVenue" && !el("alternateVenueWrap").hidden);
    if (
      required &&
      (!valueFor || (Array.isArray(valueFor) && !valueFor.length))
    ) {
      setError(id, "This field is required.");
      return false;
    }
    if (id === "eventName" && (valueFor.length < 3 || valueFor.length > 100)) {
      setError(id, "Enter 3 to 100 characters.");
      return false;
    }
    if (id === "eventDate" && valueFor) {
      const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valueFor);
      const eventDate = new Date(`${valueFor}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const validCalendarDate =
        dateMatch &&
        !Number.isNaN(eventDate.getTime()) &&
        eventDate.getFullYear() === Number(dateMatch[1]) &&
        eventDate.getMonth() + 1 === Number(dateMatch[2]) &&
        eventDate.getDate() === Number(dateMatch[3]);
      if (!validCalendarDate || eventDate < today) {
        setError(id, "Date must be today or later.");
        return false;
      }
    }
    if (
      id === "timeEnd" &&
      timeMinutes(value("timeStart")) !== null &&
      timeMinutes(value("timeEnd")) <= timeMinutes(value("timeStart"))
    ) {
      setError(id, "End time must be after start time.");
      return false;
    }
    if (id === "registrationDeadline" && valueFor) {
      const deadline = new Date(valueFor);
      const now = new Date();
      const start = startDateTime();
      if (Number.isNaN(deadline.getTime()) || deadline <= now) {
        setError(id, "Deadline must be in the future.");
        return false;
      }
      if (start && deadline >= start) {
        setError(id, "Deadline must be before event start.");
        return false;
      }
    }
    if (
      id === "contactEmail" &&
      valueFor &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valueFor)
    ) {
      setError(id, "Enter a valid email address.");
      return false;
    }
    if (
      id === "contactPhone" &&
      valueFor &&
      !/^(09\d{9}|\+639\d{9})$/.test(valueFor.replace(/[\s-]/g, ""))
    ) {
      setError(id, "Use 09XXXXXXXXX or +639XXXXXXXXX.");
      return false;
    }
    if (
      id === "maxCapacity" &&
      !el("maxCapacityWrap").hidden &&
      (!/^\d+$/.test(valueFor) || Number(valueFor) < 1)
    ) {
      setError(id, "Enter a positive whole number.");
      return false;
    }
    if (
      id === "alternateVenue" &&
      !el("alternateVenueWrap").hidden &&
      valueFor === value("venue")
    ) {
      setError(id, "Alternate venue must differ from the main venue.");
      return false;
    }
    clearError(id);
    return true;
  }
  const validationFields = [
    "eventName",
    "eventOrganizer",
    "eventSource",
    "categories",
    "eventDate",
    "venue",
    "venueOther",
    "sourceOther",
    "timeStart",
    "timeEnd",
    "registrationDeadline",
    "maxCapacity",
    "alternateVenue",
    "attendanceRequired",
    "description",
    "keyDetails",
    "contactName",
    "contactEmail",
    "contactPhone",
  ];
  function validateAll() {
    state.validateOnBlur = true;
    detectConflict();
    let valid = true;
    validationFields.forEach((id) => {
      const shown =
        (id !== "venueOther" || !el("venueOtherWrap").hidden) &&
        (id !== "sourceOther" || !el("sourceOtherWrap").hidden) &&
        (id !== "maxCapacity" || !el("maxCapacityWrap").hidden) &&
        (id !== "alternateVenue" || !el("alternateVenueWrap").hidden);
      if (shown) valid = validateField(id) && valid;
    });
    if (state.conflict) {
      setError("venue", `Venue conflict with “${state.conflict.title}”.`);
      valid = false;
    }
    return valid;
  }

  function parseLines(id) {
    return value(id)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  function serialize(status) {
    const date = value("eventDate"),
      startTime = asTime24(value("timeStart")),
      endTime = asTime24(value("timeEnd")),
      categories = selectedCategories(),
      maxCapacity = value("maxCapacity") ? Number(value("maxCapacity")) : null;
    const participants = state.participantDocuments
      .filter((file) => file.status === "ready")
      .map(({ status: _status, ...file }) => file);
    const approvals = state.approvalDocuments
      .filter((file) => file.status === "ready")
      .map(({ status: _status, ...file }) => file);
    const now = new Date().toISOString();
    const description = value("description").trim();
    return {
      ...state.event,
      id: state.id,
      eventId: state.id,
      title: value("eventName").trim(),
      organizer: value("eventOrganizer").trim(),
      organizerName: value("eventOrganizer").trim(),
      source: value("eventSource"),
      sourceOther: value("sourceOther").trim(),
      categories,
      category: categories.join(", "),
      date,
      dateISO: date,
      startTime,
      endTime,
      time: `${value("timeStart")} - ${value("timeEnd")}`,
      venue: value("venue"),
      venueOther: value("venueOther").trim(),
      location: value("venueOther").trim() || value("venue"),
      room: "",
      capacityMode: value("capacityMode"),
      maxCapacity,
      openSlots: maxCapacity,
      capacity: maxCapacity,
      maxSlots: maxCapacity,
      slots: maxCapacity,
      slotsOpen: maxCapacity,
      alternateVenue: value("alternateVenue"),
      weatherContingency: value("weatherContingency"),
      weatherPlan: value("weatherContingency"),
      attendanceRequired: value("attendanceRequired") === "Yes",
      registrationDeadline: `${value("registrationDeadline")}:00+08:00`,
      description,
      desc: description,
      keyDetails: parseLines("keyDetails"),
      requirements: parseLines("requirements"),
      participationRules: parseLines("participationRules"),
      contactPerson: {
        name: value("contactName").trim(),
        role: value("contactRole").trim(),
        email: value("contactEmail").trim(),
        phone: value("contactPhone").replace(/[\s-]/g, ""),
      },
      contactName: value("contactName").trim(),
      contactRole: value("contactRole").trim(),
      contactEmail: value("contactEmail").trim(),
      contactPhone: value("contactPhone").replace(/[\s-]/g, ""),
      invitationRecipients: state.recipients.map(({ id, displayName }) => ({
        id,
        displayName,
      })),
      participantDocuments: participants,
      attachments: participants,
      approvalDocuments: approvals,
      status,
      createdBy: identity,
      organizerId: identity,
      createdAt: state.event?.createdAt || now,
      updatedAt: now,
      published: false,
      hap1Approved: false,
      hap2Approved: false,
      hap3Approved: false,
    };
  }
  function persist(event) {
    const events = readEvents();
    const index = events.findIndex(
      (item) => String(item.eventId || item.id) === String(event.eventId),
    );
    if (index < 0) events.unshift(event);
    else
      events[index] = {
        ...events[index],
        ...event,
        updatedAt: new Date().toISOString(),
      };
    writeEvents(events);
    state.event = events[index < 0 ? 0 : index];
    state.id = String(event.eventId);
    history.replaceState(
      {},
      "",
      `${location.pathname}?eventId=${encodeURIComponent(state.id)}`,
    );
    state.dirty = false;
    state.createdFiles.clear();
    state.removedFiles.forEach(removeFile);
    state.removedFiles.clear();
  }
  function newId() {
    return `${organizer ? "organizer" : "teacher"}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
  function buttonsBusy(busy) {
    ["saveDraft", "submitForApproval", "cancelCreate"].forEach((id) => {
      if (el(id)) el(id).disabled = busy;
    });
  }
  function confirm(title, text, yes, no, onYes, onNo) {
    const layer = el("confirmLayer"),
      accept = el("confirmAccept"),
      cancel = el("confirmCancel");
    el("confirmTitle").textContent = title;
    el("confirmText").textContent = text;
    accept.textContent = yes;
    cancel.textContent = no;
    layer.hidden = false;
    accept.focus();
    const close = () => {
      layer.hidden = true;
      accept.onclick = null;
      cancel.onclick = null;
    };
    cancel.onclick = () => {
      close();
      onNo?.();
    };
    accept.onclick = async () => {
      if (state.pending) return;
      state.pending = true;
      buttonsBusy(true);
      accept.disabled = true;
      accept.textContent = "Saving…";
      try {
        await onYes();
        close();
      } catch (error) {
        close();
        showToast(
          `Could not save. Your form data is still available. ${error.message}`,
        );
      } finally {
        state.pending = false;
        buttonsBusy(false);
        if (el("submitForApproval"))
          el("submitForApproval").textContent = "Submit for Approval";
        accept.textContent = yes;
      }
    };
    layer.onkeydown = (event) => {
      if (event.key === "Escape") {
        close();
        cancel.focus();
      }
    };
  }
  async function saveDraft() {
    const name = value("eventName").trim();
    if (name.length < 3 || name.length > 100) {
      setError("eventName", "Enter 3 to 100 characters to save a draft.");
      el("eventName").focus();
      return;
    }
    state.pending = true;
    buttonsBusy(true);
    try {
      if (!state.id) state.id = newId();
      persist(serialize("draft"));
      showToast("Draft saved.");
    } catch (error) {
      showToast(`Draft could not be saved: ${error.message}`);
    } finally {
      state.pending = false;
      buttonsBusy(false);
    }
  }
  async function submit() {
    if (!(await requireOrganizerAuth())) return;
    if (!validateAll()) {
      const count = [
        ...root.querySelectorAll(".ce-error:not([hidden])"),
      ].filter((error) => error.id.startsWith("error-")).length;
      el("formError").textContent =
        `${count} field${count === 1 ? "" : "s"} need attention. Fix the marked fields and try again.`;
      el("formError").hidden = false;
      const first = root.querySelector('[aria-invalid="true"]');
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      first?.focus();
      showToast(
        `Submission needs ${count} correction${count === 1 ? "" : "s"}.`,
      );
      return;
    }
    el("formError").hidden = true;
    confirm(
      "Submit for Approval?",
      "Once submitted, this event will be sent to the approvers for review. You won’t be able to edit it while it is pending.",
      "Submit",
      "Cancel",
      async () => {
        if (organizer) {
          el("submitForApproval").textContent = "Publishing Event...";
          const { eventData, eventId } = await createFirestoreEvent();
          const localEvent = {
            ...serialize("pending_approval"),
            ...eventData,
            id: eventId,
            eventId,
            createdAt: new Date().toISOString(),
          };
          persist(localEvent);
          targetForm?.reset();
          state.dirty = false;
        } else {
          if (!state.id) state.id = newId();
          persist(serialize("pending_approval"));
        }
        showToast("Event submitted for approval.");
        setTimeout(() => {
          location.href = storage.list;
        }, 900);
      },
    );
  }
  function cancel() {
    if (!state.dirty) {
      location.href = storage.list;
      return;
    }
    confirm(
      "Discard changes?",
      "You have unsaved changes. Leave this page and discard them?",
      "Discard",
      "Keep Editing",
      async () => {
        for (const id of state.createdFiles) await removeFile(id);
        state.dirty = false;
        location.href = storage.list;
      },
    );
  }
  function restore(event) {
    el("eventName").value = event.title || "";
    el("eventOrganizer").value =
      event.organizer || event.organizerName || actorName;
    setDropdown("eventSource", event.source || "");
    setDropdown("venue", event.venue || event.location || "");
    setDropdown(
      "timeStart",
      asTime12(event.startTime) ||
        String(event.time || "").split(/\s*[-–]\s*/)[0],
    );
    setDropdown(
      "timeEnd",
      asTime12(event.endTime) ||
        String(event.time || "").split(/\s*[-–]\s*/)[1],
    );
    el("eventDate").value = event.date || event.dateISO || "";
    setDropdown(
      "capacityMode",
      event.capacityMode || (event.maxCapacity ? "Max Cap Depends" : "N/A"),
    );
    el("maxCapacity").value = event.maxCapacity || "";
    updateWeatherContingency();
    setDropdown(
      "attendanceRequired",
      event.attendanceRequired === false || event.attendanceRequired === "No"
        ? "No"
        : "Yes",
    );
    setDropdown("alternateVenue", event.alternateVenue || "");
    el("registrationDeadline").value = String(event.registrationDeadline || "")
      .replace(/\+08:00$/, "")
      .slice(0, 16);
    el("description").value = event.description || event.desc || "";
    el("descriptionCounter").textContent =
      `${el("description").value.length}/1500`;
    el("keyDetails").value = Array.isArray(event.keyDetails)
      ? event.keyDetails.join("\n")
      : String(event.keyDetails || "");
    el("requirements").value = Array.isArray(event.requirements)
      ? event.requirements.join("\n")
      : String(event.requirements || "");
    el("participationRules").value = Array.isArray(event.participationRules)
      ? event.participationRules.join("\n")
      : String(event.participationRules || "");
    const contact =
      typeof event.contactPerson === "object" ? event.contactPerson : {};
    el("contactName").value = contact.name || event.contactName || "";
    el("contactRole").value = contact.role || event.contactRole || "";
    el("contactEmail").value = contact.email || event.contactEmail || "";
    el("contactPhone").value = contact.phone || event.contactPhone || "";
    state.recipients = Array.isArray(event.invitationRecipients)
      ? event.invitationRecipients
      : [];
    state.participantDocuments = event.participantDocuments || [];
    state.approvalDocuments = event.approvalDocuments || [];
    state.id = String(event.eventId || event.id);
    state.event = event;
    root.querySelectorAll("#categories-options input").forEach(
      (input) =>
        (input.checked = (
          event.categories ||
          String(event.category || "")
            .split(",")
            .map((item) => item.trim())
        ).includes(input.value)),
    );
    categoryLabel();
    conditionalFields();
    renderRecipients();
    renderFiles("participantDocuments");
    renderFiles("approvalDocuments");
    state.dirty = false;
    detectConflict();
    duplicateWarning();
  }

  setupDropdowns();
  setupCategories();
  setDropdown("timeStart", "08:00 AM");
  setDropdown("timeEnd", "09:00 AM");
  setDropdown("capacityMode", "N/A");
  updateWeatherContingency();
  setDropdown("attendanceRequired", "Yes");
  el("eventOrganizer").value = actorName;
  el("contactName").value = actorName;
  el("contactRole").value = actorRole;
  el("contactEmail").value = identity;
  root
    .querySelectorAll("input:not([type=hidden]),textarea")
    .forEach((input) => {
      input.addEventListener("input", () => {
        markDirty();
        if (state.errors.has(input.id) || state.validateOnBlur)
          validateField(input.id);
        if (input.id === "description")
          el("descriptionCounter").textContent = `${input.value.length}/1500`;
        conditionalFields();
        detectConflict();
        duplicateWarning();
      });
      input.addEventListener("change", () => {
        markDirty();
        if (state.errors.has(input.id) || state.validateOnBlur)
          validateField(input.id);
        conditionalFields();
        detectConflict();
        duplicateWarning();
      });
      input.addEventListener("blur", () => {
        validateField(input.id);
        detectConflict();
      });
    });
  root.querySelectorAll(".ce-select").forEach((button) =>
    button.addEventListener("blur", () => {
      const dropdown = button.closest(".ce-dropdown");
      if (dropdown) validateField(dropdown.dataset.dropdown);
    }),
  );
  root
    .querySelectorAll("[data-file-list]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        el(`file-picker-${button.dataset.fileList}`).click(),
      ),
    );
  root
    .querySelectorAll("[data-file-input]")
    .forEach((input) =>
      input.addEventListener("change", () => processFiles(input)),
    );
  el("recipientSearch").addEventListener("input", updateRecipientSuggestions);
  el("recipientSearch").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      el("recipientSuggestions").querySelector("button")?.click();
    }
    if (event.key === "Escape") el("recipientSuggestions").hidden = true;
  });
  el("saveDraft").addEventListener("click", saveDraft);
  el("submitForApproval").addEventListener("click", submit);
  el("cancelCreate").addEventListener("click", cancel);
  el("eventDate").addEventListener("change", updateHolidayNotice);
  window.addEventListener("beforeunload", (event) => {
    if (state.dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || !state.dirty || link.target === "_blank") return;
    const target = new URL(link.href, location.href);
    if (target.href === location.href) return;
    event.preventDefault();
    confirm(
      "Discard changes?",
      "You have unsaved changes. Leave this page and discard them?",
      "Discard",
      "Keep Editing",
      async () => {
        for (const id of state.createdFiles) await removeFile(id);
        state.dirty = false;
        location.href = target.href;
      },
    );
  });
  conditionalFields();
  const edit =
    editId &&
    readEvents().find(
      (event) => String(event.eventId || event.id) === String(editId),
    );
  if (editId) {
    if (
      !edit ||
      String(
        edit.createdBy || edit.organizerId || edit.teacherId || "",
      ).toLowerCase() !== identity ||
      !["draft", "rejected", "needs revision"].includes(normalizeStatus(edit))
    ) {
      showToast("This event is unavailable or you cannot edit it.");
      setTimeout(() => location.replace(storage.list), 900);
    } else {
      restore(edit);
      el("createHeading").textContent = "Edit Event";
    }
  }
  updateHolidayNotice();
})();
