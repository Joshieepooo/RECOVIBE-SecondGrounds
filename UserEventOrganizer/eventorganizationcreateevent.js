import {
  auth,
  db,
  isFirebaseConfigured,
} from "../UserStudent/firebaseConfig.js";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { checkPhilippineHoliday } from "../holidayService.js";

const root = document.getElementById("createEventRoot");
if (!root) {
  throw new Error("Organizer event form container was not found.");
}

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

function readProfile() {
  try {
    return JSON.parse(localStorage.getItem("recovibeOrganizerProfile") || "{}");
  } catch (error) {
    console.error("Unable to read organizer profile:", error);
    return {};
  }
}

const profile = readProfile();
const organizerId = localStorage.getItem("recovibeOrganizerId") || "";
const organizerName = String(
  profile.name || profile.fullName || profile.organization || "Event Organizer",
);
const organizerEmail = String(
  profile.email || (organizerId.includes("@") ? organizerId : ""),
);
const organizerPhone = String(profile.contactNumber || "");

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

function input(
  id,
  label,
  type,
  placeholder = "",
  attrs = "",
  value = "",
  suffix = "",
) {
  return `<div class="ce-field" id="wrap-${id}"><label for="${id}">${label}</label><input id="${id}" name="${id}" type="${type}" placeholder="${escapeHTML(placeholder)}" value="${escapeHTML(value)}" ${attrs}>${suffix}<p class="ce-error" id="error-${id}" hidden></p></div>`;
}

function dropdown(id, label, options, selected = "") {
  const optionMarkup = options
    .map(
      (option) =>
        `<button class="ce-option${option === selected ? " is-selected" : ""}" type="button" role="option" aria-selected="${option === selected}" data-value="${escapeHTML(option)}" tabindex="-1">${escapeHTML(option)}</button>`,
    )
    .join("");
  return `<div class="ce-field" id="wrap-${id}"><label id="label-${id}" for="${id}-button">${label}</label><div class="ce-dropdown" data-dropdown="${id}"><button class="ce-select" id="${id}-button" type="button" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="label-${id} ${id}-button"><span class="ce-select-value">${escapeHTML(selected || "Select...")}</span><span class="ce-chevron" aria-hidden="true"></span></button><div class="ce-options" id="${id}-options" role="listbox" aria-labelledby="label-${id}" tabindex="-1">${optionMarkup}</div><input id="${id}" name="${id}" type="hidden" value="${escapeHTML(selected)}"></div><p class="ce-error" id="error-${id}" hidden></p></div>`;
}

function area(id, label, hint = "", maxLength = 10000) {
  const placeholder =
    id === "description" ? "Describe the event..." : "One item per line";
  return `<div class="ce-field ce-field--textarea" id="wrap-${id}"><label for="${id}">${label}</label><textarea id="${id}" name="${id}" rows="4" maxlength="${maxLength}" placeholder="${placeholder}"></textarea>${hint ? `<small class="ce-hint">${hint}</small>` : ""}${id === "description" ? '<small class="ce-hint" id="descriptionCounter">0/1500</small>' : ""}<p class="ce-error" id="error-${id}" hidden></p></div>`;
}

function documentGroup(id, title, emptyText) {
  return `<section class="ce-document-group" id="wrap-${id}"><header><h3>${title}</h3><button class="ce-add-file" type="button" data-file-list="${id}" aria-label="Add ${title.toLowerCase()}">+</button></header><input class="ce-file-input" id="file-picker-${id}" type="file" data-file-input="${id}" accept=".doc,.docx,.pdf" multiple hidden><ul class="ce-document-list" id="${id}List"></ul><p class="ce-hint ce-doc-empty" id="${id}Empty">${emptyText}</p></section>`;
}

root.innerHTML = `
  <header class="ce-heading"><div><h1 id="createHeading">Create Event</h1><p>Create an event and submit it for approval.</p></div></header>
  <form id="organizerEventForm" novalidate>
    <section class="ce-section"><h2>Event Information</h2>
      <div class="ce-grid ce-grid--4">
        ${input("eventName", "Event Name", "text", "Enter the event name", 'minlength="3" maxlength="100" required')}
        ${input("eventOrganizer", "Event Organizer", "text", "Name of the organizer", "required", organizerName)}
        ${dropdown("eventSource", "Event Source", SOURCE)}
        <div class="ce-field" id="wrap-categories"><span class="ce-label" id="label-categories">Event Category <small>(select up to 3)</small></span><div class="ce-dropdown" data-dropdown="categories"><button class="ce-select" id="categories-button" type="button" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="label-categories categories-button"><span class="ce-select-value">Select categories...</span><span class="ce-chevron" aria-hidden="true"></span></button><div class="ce-options ce-options--checks" id="categories-options" role="listbox" aria-labelledby="label-categories" aria-multiselectable="true">${CATEGORIES.map((category) => `<label class="ce-option ce-check-option" role="option" aria-selected="false"><input type="checkbox" value="${escapeHTML(category)}"><span>${escapeHTML(category)}</span></label>`).join("")}</div></div><p class="ce-error" id="error-categories" hidden></p></div>
      </div>
      <div class="ce-grid ce-grid--4 ce-grid--space">${dropdown("eventType", "Event Type", EVENT_TYPES, "Seminar")}${dropdown("targetDepartment", "Target Department", TARGET_DEPARTMENTS, "All Departments")}${dropdown("targetYear", "Target Year", TARGET_YEARS, "All Years")}</div>
      <div class="ce-grid ce-grid--4 ce-grid--space">${input("eventDate", "Date", "date", "", "required", "", '<p id="holidayNotice" class="ce-holiday-notice" role="status" aria-live="polite" hidden></p>')}${dropdown("venue", "Venue", VENUES)}${dropdown("timeStart", "Time Start", TIMES, "08:00 AM")}${dropdown("timeEnd", "Time End", TIMES, "09:00 AM")}</div>
      <div class="ce-grid ce-grid--4 ce-grid--space">${input("registrationDeadline", "Registration Deadline", "datetime-local", "", "required")}${dropdown("capacityMode", "Capacity", ["N/A", "Max Cap Depends", "Both Cap and Weather"], "N/A")}<div class="ce-field"><label for="weatherContingency">Weather Contingency</label><p class="ce-hint" id="weatherContingencyText">Select a venue to determine rain contingency.</p><input id="weatherContingency" name="weatherContingency" type="hidden"></div>${dropdown("attendanceRequired", "Attendance Required", ["Yes", "No"], "Yes")}</div>
      <div id="capacityDetails" class="ce-grid ce-grid--4 ce-grid--space ce-dependent" hidden>
        <div id="maxCapacityWrap">${input("maxCapacity", "Max Capacity", "number", "Positive whole number", 'min="1" step="1"')}</div>
        <div class="ce-field" id="alternateVenueWrap" hidden><label id="label-alternateVenue" for="alternateVenue-button">Alternate Venue</label><div class="ce-dropdown" data-dropdown="alternateVenue"><button class="ce-select" id="alternateVenue-button" type="button" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="label-alternateVenue alternateVenue-button"><span class="ce-select-value">Select...</span><span class="ce-chevron" aria-hidden="true"></span></button><div class="ce-options" id="alternateVenue-options" role="listbox" aria-labelledby="label-alternateVenue" tabindex="-1">${VENUES.map((venue) => `<button class="ce-option" type="button" role="option" aria-selected="false" data-value="${escapeHTML(venue)}" tabindex="-1">${escapeHTML(venue)}</button>`).join("")}</div><input id="alternateVenue" name="alternateVenue" type="hidden"></div><p class="ce-error" id="error-alternateVenue" hidden></p></div>
      </div>
    </section>
    <section class="ce-section"><h2>Event Details</h2>
      <div class="ce-grid ce-grid--2">
        ${area("description", "Event Description", "", 1500)}
        ${area("keyDetails", "Event Key Details", "One item per line")}
        ${area("requirements", "Requirements & Reminders", "One item per line")}
        ${area("participationRules", "Participation Rules", "One item per line")}
        <section class="ce-field ce-contact-box" id="wrap-contact"><h3>Contact Person</h3><div class="ce-grid ce-grid--2">
          ${input("contactName", "Name", "text", "Contact name", "", organizerName)}
          ${input("contactRole", "Role", "text", "Event contact", "", String(profile.roleName || profile.role || "Event Organizer"))}
          ${input("contactEmail", "Email", "email", "name@example.com", "", organizerEmail)}
          ${input("contactPhone", "Contact Number", "tel", "09XXXXXXXXX or +639XXXXXXXXX", 'inputmode="tel"', organizerPhone)}
        </div></section>
        <section class="ce-field ce-field--textarea"><label for="recipientSearch">Invitation Recipients <small>(optional)</small></label><div class="ce-recipient-box"><input id="recipientSearch" type="search" autocomplete="off" placeholder="Search by name or email"><div id="recipientSuggestions" class="ce-suggestions" role="listbox" hidden></div><ol id="recipientList" class="ce-recipient-list"></ol><small class="ce-hint" id="recipientEmpty">Search existing users to add recipients.</small></div></section>
      </div>
    </section>
    <section class="ce-section"><h2>Documents</h2><div class="ce-grid ce-grid--2">${documentGroup("participantDocuments", "Participant Documents", "No participant files attached.")}${documentGroup("approvalDocuments", "Approval Documents", "No approval files attached. (Optional)")}</div></section>
    <div id="formError" class="ce-form-error" role="alert" hidden></div>
    <div class="ce-actions"><button class="ce-button ce-button--quiet" id="saveDraft" type="button">Save as Draft</button><button class="ce-button" id="submitForApproval" type="button">Submit for Approval</button><button class="ce-button" id="cancelCreate" type="button">Cancel</button></div>
  </form>
  <div class="ce-toast" id="createToast" role="status" aria-live="polite" hidden></div>
  <div class="ce-dialog-layer" id="confirmLayer" hidden><section class="ce-confirm" role="dialog" aria-modal="true" aria-labelledby="confirmTitle"><h2 id="confirmTitle"></h2><p id="confirmText"></p><div class="ce-confirm-actions"><button class="ce-confirm-primary" id="confirmAccept" type="button"></button><button class="ce-confirm-cancel" id="confirmCancel" type="button"></button></div></section></div>`;

const form = document.getElementById("organizerEventForm");
if (!form) {
  throw new Error("Organizer event form was not found.");
}

const toast = document.getElementById("createToast");
const formError = document.getElementById("formError");
const selectedRecipients = new Map();
const attachedDocuments = {
  participantDocuments: [],
  approvalDocuments: [],
};
let toastTimer;
let pendingConfirmation = null;
let fileDatabasePromise;
let storageModulePromise;

function element(id) {
  return document.getElementById(id);
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 4500);
}

let holidayLookupSequence = 0;

async function updateHolidayNotice() {
  const date = value("eventDate");
  const notice = element("holidayNotice");
  const sequence = ++holidayLookupSequence;
  notice.hidden = true;
  notice.textContent = "";
  notice.classList.remove("is-warning", "is-unavailable");

  if (!date) return;

  try {
    const result = await checkPhilippineHoliday(date);
    if (sequence !== holidayLookupSequence || value("eventDate") !== date)
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
    if (sequence !== holidayLookupSequence || value("eventDate") !== date)
      return;

    notice.textContent =
      "Holiday information is unavailable. You can still submit this event.";
    notice.classList.add("is-unavailable");
    notice.hidden = false;
  }
}

function value(id) {
  return String(element(id)?.value || "");
}

function normalizeSource(source) {
  const value = String(source || "")
    .trim()
    .toLowerCase();
  if (!value) return "";
  if (/\bcsc\b/.test(value)) return "CSC";
  if (/teacher|faculty/.test(value)) return "Teacher / Faculty";
  if (/organization|organizational|ibits|event organizer/.test(value))
    return "Organizational";
  if (/external|admin|other/.test(value)) return "Others / External";
  if (/pup|campus|cite/.test(value)) return "PUP Official";
  return "Others / External";
}

function updateWeatherContingency() {
  const venueText = `${value("venue")} ${value("venueOther")}`.toLowerCase();
  const weather = /open field|outside|outdoor/.test(venueText)
    ? "Outside – Might Rain."
    : "No rain concerns.";
  element("weatherContingency").value = weather;
  element("weatherContingencyText").textContent = weather;
  element("weatherContingency").dispatchEvent(
    new Event("change", { bubbles: true }),
  );
}

function selectedCategories() {
  return [...root.querySelectorAll("#categories-options input:checked")].map(
    (checkbox) => checkbox.value,
  );
}

function setDropdown(id, selected) {
  const field = element(id);
  const dropdownRoot = field?.closest(".ce-dropdown");
  if (!field || !dropdownRoot) return;
  if (id === "eventSource") selected = normalizeSource(selected);
  field.value = selected;
  dropdownRoot.querySelector(".ce-select-value").textContent =
    selected || "Select...";
  dropdownRoot.querySelectorAll(".ce-option").forEach((option) => {
    const isSelected = option.dataset.value === selected;
    option.classList.toggle("is-selected", isSelected);
    option.setAttribute("aria-selected", String(isSelected));
  });
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

function refreshCategoryLabel() {
  const categories = selectedCategories();
  element("categories-button").querySelector(".ce-select-value").textContent =
    categories.length > 1
      ? `${categories[0]} +${categories.length - 1}`
      : categories[0] || "Select categories...";
}

function closeDropdowns() {
  root.querySelectorAll(".ce-dropdown.is-open").forEach((dropdownRoot) => {
    dropdownRoot.classList.remove("is-open");
    dropdownRoot
      .querySelector(".ce-select")
      .setAttribute("aria-expanded", "false");
  });
}

function setupDropdowns() {
  root.querySelectorAll(".ce-dropdown").forEach((dropdownRoot) => {
    const button = dropdownRoot.querySelector(".ce-select");
    const menu = dropdownRoot.querySelector(".ce-options");
    if (dropdownRoot.dataset.dropdown === "categories") {
      button.addEventListener("click", () => {
        const shouldOpen = !dropdownRoot.classList.contains("is-open");
        closeDropdowns();
        dropdownRoot.classList.toggle("is-open", shouldOpen);
        button.setAttribute("aria-expanded", String(shouldOpen));
      });
      menu.addEventListener("change", (event) => {
        if (!event.target.matches('input[type="checkbox"]')) return;
        const checked = [...menu.querySelectorAll("input:checked")];
        if (checked.length > 3) {
          event.target.checked = false;
          showToast("Select up to three event categories.");
        }
        event.target
          .closest('[role="option"]')
          .setAttribute("aria-selected", String(event.target.checked));
        refreshCategoryLabel();
      });
      return;
    }

    const options = [...menu.querySelectorAll(".ce-option")];
    const openMenu = () => {
      closeDropdowns();
      dropdownRoot.classList.add("is-open");
      button.setAttribute("aria-expanded", "true");
      options[0]?.focus();
    };

    button.addEventListener("click", () => {
      if (dropdownRoot.classList.contains("is-open")) closeDropdowns();
      else openMenu();
    });
    button.addEventListener("keydown", (event) => {
      if (["ArrowDown", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openMenu();
      }
    });
    menu.addEventListener("click", (event) => {
      const option = event.target.closest(".ce-option");
      if (!option) return;
      setDropdown(dropdownRoot.dataset.dropdown, option.dataset.value);
      closeDropdowns();
      button.focus();
    });
    menu.addEventListener("keydown", (event) => {
      const index = options.indexOf(document.activeElement);
      if (event.key === "Escape") {
        event.preventDefault();
        closeDropdowns();
        button.focus();
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const offset = event.key === "ArrowDown" ? 1 : -1;
        options[
          Math.max(0, Math.min(options.length - 1, index + offset))
        ]?.focus();
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        options[event.key === "Home" ? 0 : options.length - 1]?.focus();
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        document.activeElement.click();
      } else if (event.key === "Tab") {
        closeDropdowns();
      }
    });
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".ce-dropdown")) closeDropdowns();
  });
}

function setupCapacity() {
  const mode = element("capacityMode");
  const details = element("capacityDetails");
  const maxCapacity = element("maxCapacity");
  const alternateWrap = element("alternateVenueWrap");
  const alternateVenue = element("alternateVenue");
  const alternateNeeded = () =>
    value("weatherContingency") === "Outside – Might Rain.";
  const update = () => {
    const capacityRequired = mode.value !== "N/A";
    details.hidden = !capacityRequired;
    maxCapacity.required = capacityRequired;
    alternateWrap.hidden = !(capacityRequired && alternateNeeded());
    alternateVenue.required = !alternateWrap.hidden;
  };
  mode.addEventListener("change", update);
  element("weatherContingency").addEventListener("change", update);
  update();
}

function setupRecipientSearch() {
  const search = element("recipientSearch");
  const suggestionBox = element("recipientSuggestions");
  const list = element("recipientList");
  const empty = element("recipientEmpty");
  const users = [];
  [
    "recovibeAccounts",
    "recovibeTeachers",
    "recovibeTeacherAccounts",
    "recovibeOrganizerAccounts",
    "recovibeUsers",
  ].forEach((key) => {
    try {
      const entries = JSON.parse(localStorage.getItem(key) || "[]");
      if (!Array.isArray(entries)) return;
      entries.forEach((item) => {
        const id = item.id || item.userId || item.studentId || item.email;
        if (!id) return;
        users.push({
          id: String(id),
          name: String(item.name || item.fullName || item.email || id),
          email: String(item.email || ""),
        });
      });
    } catch (error) {
      console.error(`Unable to read recipient directory "${key}":`, error);
    }
  });
  const uniqueUsers = [
    ...new Map(users.map((item) => [item.id.toLowerCase(), item])).values(),
  ];

  function renderRecipients() {
    list.innerHTML = [...selectedRecipients.values()]
      .map(
        (recipient) =>
          `<li class="ce-recipient-row"><span aria-hidden="true">✓</span><span>${escapeHTML(recipient.name)}</span><small>${escapeHTML(recipient.email)}</small><button type="button" data-remove-recipient="${escapeHTML(recipient.id)}" aria-label="Remove ${escapeHTML(recipient.name)}">×</button></li>`,
      )
      .join("");
    empty.hidden = selectedRecipients.size > 0;
  }

  search.addEventListener("input", () => {
    const query = search.value.trim().toLowerCase();
    const matches = query
      ? uniqueUsers
          .filter(
            (user) =>
              !selectedRecipients.has(user.id) &&
              `${user.name} ${user.email}`.toLowerCase().includes(query),
          )
          .slice(0, 8)
      : [];
    suggestionBox.innerHTML = matches
      .map(
        (user) =>
          `<button type="button" role="option" data-recipient-id="${escapeHTML(user.id)}">${escapeHTML(user.name)}${user.email ? ` <small>${escapeHTML(user.email)}</small>` : ""}</button>`,
      )
      .join("");
    suggestionBox.hidden = matches.length === 0;
  });
  suggestionBox.addEventListener("click", (event) => {
    const option = event.target.closest("[data-recipient-id]");
    if (!option) return;
    const recipient = uniqueUsers.find(
      (user) => user.id === option.dataset.recipientId,
    );
    if (recipient) selectedRecipients.set(recipient.id, recipient);
    search.value = "";
    suggestionBox.hidden = true;
    renderRecipients();
  });
  list.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-remove-recipient]");
    if (!remove) return;
    selectedRecipients.delete(remove.dataset.removeRecipient);
    renderRecipients();
  });
}

function openFileDatabase() {
  if (!fileDatabasePromise) {
    fileDatabasePromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(
          new Error("IndexedDB is unavailable; documents cannot be attached."),
        );
        return;
      }
      const request = indexedDB.open("RecoVibeEventDocuments", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("files")) {
          request.result.createObjectStore("files", { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error || new Error("Could not open document storage."));
    });
  }
  return fileDatabasePromise;
}

async function storeDocument(file) {
  const fileDb = await openFileDatabase();
  const id = `event-file-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  await new Promise((resolve, reject) => {
    const transaction = fileDb.transaction("files", "readwrite");
    transaction.objectStore("files").put({
      id,
      name: file.name,
      type: file.type,
      size: file.size,
      blob: file,
    });
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
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

async function deleteStoredDocument(id) {
  const fileDb = await openFileDatabase();
  await new Promise((resolve, reject) => {
    const transaction = fileDb.transaction("files", "readwrite");
    transaction.objectStore("files").delete(id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

function readStoredDocument(id) {
  return openFileDatabase().then(
    (fileDb) =>
      new Promise((resolve, reject) => {
        const request = fileDb
          .transaction("files")
          .objectStore("files")
          .get(id);
        request.onsuccess = () => {
          if (!request.result) {
            reject(
              new Error(`Attached file ${id} is missing from local storage.`),
            );
            return;
          }
          resolve(request.result);
        };
        request.onerror = () =>
          reject(
            request.error || new Error("Could not read attached document."),
          );
      }),
  );
}

async function uploadAttachedDocuments(userId) {
  const files = [
    ...attachedDocuments.participantDocuments,
    ...attachedDocuments.approvalDocuments,
  ];
  if (!files.length) return;

  if (!storageModulePromise) {
    storageModulePromise =
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");
  }
  const { getStorage, ref, uploadBytes, getDownloadURL } =
    await storageModulePromise;
  const storage = getStorage(auth.app);

  for (const metadata of files) {
    if (metadata.storagePath && metadata.downloadURL) continue;
    const storedFile = await readStoredDocument(metadata.id);
    const storagePath = `events/${userId}/attachments/${metadata.id}/${encodeURIComponent(metadata.name)}`;
    const fileRef = ref(storage, storagePath);
    await uploadBytes(fileRef, storedFile.blob, {
      contentType: storedFile.type || "application/octet-stream",
      customMetadata: {
        originalName: storedFile.name,
        uploadedBy: userId,
      },
    });
    metadata.storagePath = storagePath;
    metadata.downloadURL = await getDownloadURL(fileRef);
  }
}

function renderDocuments(group) {
  const list = element(`${group}List`);
  const empty = element(`${group}Empty`);
  list.innerHTML = attachedDocuments[group]
    .map(
      (file, index) =>
        `<li class="ce-document-row"><span class="ce-document-name">${escapeHTML(file.name)}</span><small>${Math.ceil(file.size / 1024)} KB</small><button type="button" data-remove-file="${index}" data-file-group="${group}" aria-label="Remove ${escapeHTML(file.name)}">×</button></li>`,
    )
    .join("");
  empty.hidden = attachedDocuments[group].length > 0;
}

function setupDocuments() {
  root.querySelectorAll("[data-file-list]").forEach((button) => {
    button.addEventListener("click", () => {
      element(`file-picker-${button.dataset.fileList}`).click();
    });
  });
  root.querySelectorAll("[data-file-input]").forEach((picker) => {
    picker.addEventListener("change", async () => {
      const group = picker.dataset.fileInput;
      const inputError = element("formError");
      inputError.hidden = true;
      for (const file of [...picker.files]) {
        if (file.size > 10 * 1024 * 1024) {
          inputError.textContent = `${file.name} exceeds the 10 MB document limit.`;
          inputError.hidden = false;
          continue;
        }
        try {
          const saved = await storeDocument(file);
          attachedDocuments[group].push(saved);
        } catch (error) {
          console.error(`Unable to attach ${file.name}:`, error);
          inputError.textContent = `Unable to attach ${file.name}: ${error.message}`;
          inputError.hidden = false;
        }
      }
      renderDocuments(group);
      picker.value = "";
    });
  });
  root.addEventListener("click", async (event) => {
    const remove = event.target.closest("[data-remove-file]");
    if (!remove) return;
    const group = remove.dataset.fileGroup;
    const [file] = attachedDocuments[group].splice(
      Number(remove.dataset.removeFile),
      1,
    );
    renderDocuments(group);
    try {
      await deleteStoredDocument(file.id);
    } catch (error) {
      console.error(`Unable to remove document ${file.name}:`, error);
      showToast(`Could not remove ${file.name}: ${error.message}`);
    }
  });
}

function getPayload(status) {
  const categories = selectedCategories();
  const eventDate = value("eventDate");
  const timeStart = value("timeStart");
  const timeEnd = value("timeEnd");
  const maxCapacity = value("maxCapacity")
    ? Number(value("maxCapacity"))
    : null;
  const contactPerson = {
    name: value("contactName").trim(),
    role: value("contactRole").trim(),
    email: value("contactEmail").trim(),
    contactNumber: value("contactPhone").trim(),
  };
  const participantDocuments = attachedDocuments.participantDocuments.map(
    ({ status: _status, ...file }) => file,
  );
  const approvalDocuments = attachedDocuments.approvalDocuments.map(
    ({ status: _status, ...file }) => file,
  );

  return {
    title: value("eventName").trim(),
    eventName: value("eventName").trim(),
    organizer: value("eventOrganizer").trim(),
    organizerName: value("eventOrganizer").trim(),
    source: normalizeSource(value("eventSource")),
    categories,
    category: categories.join(", "),
    eventType: value("eventType"),
    targetDepartment: value("targetDepartment"),
    targetYear: value("targetYear"),
    date: eventDate,
    dateISO: eventDate,
    eventDate,
    registrationDeadline: value("registrationDeadline"),
    timeStart,
    startTime: timeStart,
    endTime: timeEnd,
    time: `${timeStart} - ${timeEnd}`,
    venue: value("venue"),
    location: value("venue"),
    capacityMode: value("capacityMode"),
    maxCapacity,
    capacity: maxCapacity,
    openSlots: maxCapacity,
    maxSlots: maxCapacity,
    slots: maxCapacity,
    slotsOpen: maxCapacity,
    alternateVenue: value("alternateVenue"),
    weatherContingency: value("weatherContingency"),
    weatherPlan: value("weatherContingency"),
    attendanceRequired: value("attendanceRequired") === "Yes",
    description: value("description").trim(),
    eventDescription: value("description").trim(),
    desc: value("description").trim(),
    keyDetails: value("keyDetails")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
    requirements: value("requirements")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
    participationRules: value("participationRules")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
    contactPerson,
    contactName: contactPerson.name,
    contactRole: contactPerson.role,
    contactEmail: contactPerson.email,
    contactPhone: contactPerson.contactNumber,
    invitationRecipients: [...selectedRecipients.values()].map(
      ({ id, name, email }) => ({ id, displayName: name, email }),
    ),
    participantDocuments,
    attachments: participantDocuments,
    approvalDocuments,
    status,
    submittedByRole: "organizer",
  };
}

function getAuthenticatedOrganizer() {
  const user = auth?.currentUser;
  if (!isFirebaseConfigured || !db || !user?.uid) {
    throw new Error("Sign in again before saving this event.");
  }
  return user;
}

function validateForm() {
  formError.hidden = true;
  let isValid = true;
  form.querySelectorAll("[required]").forEach((field) => {
    if (field.type === "hidden") {
      const group = field.closest(".ce-dropdown");
      const valid = Boolean(field.value);
      group
        ?.querySelector(".ce-select")
        .setAttribute("aria-invalid", String(!valid));
      if (!valid) isValid = false;
      return;
    }
    field.setAttribute("aria-invalid", String(!field.checkValidity()));
    if (!field.checkValidity()) isValid = false;
  });
  const eventName = value("eventName").trim();
  const categories = selectedCategories();
  const date = value("eventDate");
  const start = value("timeStart");
  const end = value("timeEnd");
  const requiredDropdowns = [
    "eventSource",
    "venue",
    "timeStart",
    "timeEnd",
    "attendanceRequired",
  ];
  requiredDropdowns.forEach((id) => {
    const field = element(id);
    const valid = Boolean(field.value);
    field
      .closest(".ce-dropdown")
      .querySelector(".ce-select")
      .setAttribute("aria-invalid", String(!valid));
    if (!valid) isValid = false;
  });
  if (eventName.length < 3 || categories.length === 0) isValid = false;
  if (!date || !start || !end) isValid = false;
  if (value("contactEmail") && !element("contactEmail").checkValidity()) {
    isValid = false;
  }

  if (!isValid) {
    formError.hidden = false;
    formError.textContent =
      "Complete the required event details and select at least one event category.";
    showToast("Submission needs corrections. Review the required fields.");
    return false;
  }
  return true;
}

function closeConfirmation() {
  element("confirmLayer").hidden = true;
  pendingConfirmation = null;
}

function openConfirmation(
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
) {
  element("confirmTitle").textContent = title;
  element("confirmText").textContent = message;
  element("confirmAccept").textContent = confirmLabel;
  element("confirmCancel").textContent = cancelLabel;
  pendingConfirmation = onConfirm;
  element("confirmLayer").hidden = false;
  element("confirmAccept").focus();
}

function setButtonsDisabled(disabled) {
  ["saveDraft", "submitForApproval", "cancelCreate"].forEach((id) => {
    element(id).disabled = disabled;
  });
  element("confirmAccept").disabled = disabled;
  element("confirmCancel").disabled = disabled;
}

function setupDescriptionCounter() {
  const description = element("description");
  const counter = element("descriptionCounter");
  const update = () => {
    counter.textContent = `${description.value.length}/1500`;
  };
  description.addEventListener("input", update);
  form.addEventListener("reset", () => requestAnimationFrame(update));
}

setupDropdowns();
element("venue").addEventListener("change", updateWeatherContingency);
element("venueOther")?.addEventListener("input", updateWeatherContingency);
setupCapacity();
setupRecipientSearch();
setupDocuments();
setupDescriptionCounter();
element("eventDate").addEventListener("change", updateHolidayNotice);
updateWeatherContingency();
updateHolidayNotice();

element("saveDraft").addEventListener("click", async () => {
  setButtonsDisabled(true);
  formError.hidden = true;
  try {
    const user = getAuthenticatedOrganizer();
    await uploadAttachedDocuments(user.uid);
    await addDoc(collection(db, "events"), {
      ...getPayload("draft"),
      organizerId: user.uid,
      organizerUid: user.uid,
      createdBy: user.uid,
      creatorEmail: user.email || organizerEmail,
      organizerEmail: user.email || organizerEmail,
      createdByName: user.displayName || organizerName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      published: false,
    });
    showToast("Draft saved successfully.");
  } catch (error) {
    console.error("Unable to save organizer event draft:", error);
    formError.textContent = error.message || "Draft could not be saved.";
    formError.hidden = false;
  } finally {
    setButtonsDisabled(false);
  }
});

element("cancelCreate").addEventListener("click", () => {
  window.location.href = "EventOrganizerDashBoard.html";
});

element("submitForApproval").addEventListener("click", () => {
  if (!validateForm()) return;
  openConfirmation(
    "Submit for Approval?",
    "Once submitted, this event will be sent to the approvers for review.",
    "Submit",
    "Cancel",
    submitEvent,
  );
});

async function submitEvent() {
  setButtonsDisabled(true);
  formError.hidden = true;
  try {
    const user = getAuthenticatedOrganizer();
    await uploadAttachedDocuments(user.uid);
    const payload = getPayload("pending");
    await addDoc(collection(db, "events"), {
      ...payload,
      organizerId: user.uid,
      organizerUid: user.uid,
      createdBy: user.uid,
      creatorEmail: user.email || organizerEmail,
      organizerEmail: user.email || organizerEmail,
      createdByName: user.displayName || organizerName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      published: false,
      hap1Approved: false,
      hap2Approved: false,
      hap3Approved: false,
    });

    closeConfirmation();
    attachedDocuments.participantDocuments = [];
    attachedDocuments.approvalDocuments = [];
    selectedRecipients.clear();
    form.reset();
    renderDocuments("participantDocuments");
    renderDocuments("approvalDocuments");
    element("recipientList").replaceChildren();
    element("recipientEmpty").hidden = false;
    showToast("Event submitted for approval successfully!");
    setTimeout(() => {
      window.location.href = "EventOrganizerDashBoard.html";
    }, 900);
  } catch (error) {
    console.error("Unable to submit organizer event:", error);
    closeConfirmation();
    formError.textContent =
      error.message || "Could not submit the event. Please try again.";
    formError.hidden = false;
  } finally {
    setButtonsDisabled(false);
  }
}

element("confirmAccept").addEventListener("click", async () => {
  if (!pendingConfirmation) return;
  const confirmAction = pendingConfirmation;
  element("confirmAccept").disabled = true;
  try {
    await confirmAction();
  } catch (error) {
    console.error("Organizer confirmation action failed:", error);
    closeConfirmation();
    formError.textContent =
      error.message || "Could not complete this action. Please try again.";
    formError.hidden = false;
  } finally {
    element("confirmAccept").disabled = false;
    element("confirmCancel").disabled = false;
  }
});

element("confirmCancel").addEventListener("click", closeConfirmation);
element("confirmLayer").addEventListener("click", (event) => {
  if (event.target === element("confirmLayer")) closeConfirmation();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !element("confirmLayer").hidden) {
    closeConfirmation();
  }
});

form.addEventListener("reset", () => {
  selectedRecipients.clear();
  refreshCategoryLabel();
  setDropdown("eventSource", "");
  setDropdown("eventType", "Seminar");
  setDropdown("targetDepartment", "All Departments");
  setDropdown("targetYear", "All Years");
  setDropdown("venue", "");
  setDropdown("timeStart", "08:00 AM");
  setDropdown("timeEnd", "09:00 AM");
  setDropdown("capacityMode", "N/A");
  updateWeatherContingency();
  setDropdown("attendanceRequired", "Yes");
  setDropdown("alternateVenue", "");
  element("capacityDetails").hidden = true;
  element("maxCapacity").required = false;
  element("alternateVenueWrap").hidden = true;
});
