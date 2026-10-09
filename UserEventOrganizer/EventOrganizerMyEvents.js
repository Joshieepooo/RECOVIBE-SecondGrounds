import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  auth,
  db,
  isFirebaseConfigured,
} from "../UserStudent/firebaseConfig.js";

(() => {
  const eventTableBody = document.getElementById("eventTableBody");
  const todayElement = document.getElementById("organizerToday");
  let organizerId = "";
  let organizerEvents = [];
  let unsubscribeEvents;
  const searchInput = document.getElementById("eventSearch");
  const statusFilter = document.getElementById("eventStatusFilter");
  const dateFilter = document.getElementById("eventDateFilter");
  const eventResultsCount = document.getElementById("eventResultsCount");
  const eventDetailsModal = document.getElementById("eventDetailsModal");
  const eventDetailsTitle = document.getElementById("eventDetailsTitle");
  const eventDetailsHeadingMeta = document.getElementById(
    "eventDetailsHeadingMeta",
  );
  const eventDetailsContent = document.getElementById("eventDetailsContent");
  const eventDetailsDescription = document.getElementById(
    "eventDetailsDescription",
  );
  const eventDetailsSections = document.getElementById("eventDetailsSections");

  const escapeHtml = (value) =>
    String(value ?? "").replace(
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

  function getOrganizerEventsForCurrentUser() {
    return organizerEvents;
  }

  function normalizeStatus(status) {
    const normalized = String(status ?? "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, " ");
    return normalized === "pending" ? "pending approval" : normalized;
  }

  function updateOrganizerAccount() {
    const storedProfile = localStorage.getItem("recovibeOrganizerProfile");

    if (!storedProfile) {
      return;
    }

    try {
      const profile = JSON.parse(storedProfile);
      const name = String(profile.name || "Event Organizer");
      const organization = String(profile.organization || "IBITS");
      const initials =
        name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0].toUpperCase())
          .join("") || "EO";

      document.getElementById("userName").textContent = name;
      document.getElementById("userRole").textContent =
        `${organization} account`;
      document.getElementById("userAvatar").textContent = initials;
    } catch (error) {
      console.error("Unable to read organizer profile:", error);
    }
  }

  function getFilteredEvents() {
    const query = searchInput.value.trim().toLowerCase();
    const selectedStatus = statusFilter.value;
    const selectedDate = dateFilter.value;
    const currentDate = new Date();

    return getOrganizerEventsForCurrentUser().filter((event) => {
      const searchableText =
        `${event.title || ""} ${event.location || ""} ${event.category || ""} ${event.eventType || ""}`.toLowerCase();
      const eventDateValue = event.dateISO || event.eventDate;
      const eventDate = eventDateValue
        ? new Date(`${String(eventDateValue).slice(0, 10)}T00:00:00`)
        : null;

      const matchesSearch = !query || searchableText.includes(query);
      const matchesStatus =
        selectedStatus === "all" ||
        normalizeStatus(event.status) === normalizeStatus(selectedStatus);
      const matchesDate =
        selectedDate === "all" ||
        (eventDate &&
          !Number.isNaN(eventDate.getTime()) &&
          (selectedDate === "upcoming"
            ? eventDate >= currentDate
            : eventDate < currentDate));

      return matchesSearch && matchesStatus && matchesDate;
    });
  }

  function formatDate(dateValue, fallback = "Date TBA") {
    if (!dateValue) {
      return fallback;
    }

    const dateText = String(dateValue);
    const date = new Date(
      dateText.includes("T") ? dateText : `${dateText}T00:00:00`,
    );

    if (Number.isNaN(date.getTime())) {
      return fallback;
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function getStatus(event) {
    const status = String(event.status || "Draft")
      .trim()
      .toLowerCase()
      .replace(/[ _-]+/g, " ");
    if (status === "draft") return "Draft";
    if (status === "pending approval" || status === "pending")
      return "Pending Approval";
    if (status === "needs revision") return "Needs Revision";
    if (status === "approved") return "Approved";
    if (status === "published") return "Published";
    if (status === "rejected") return "Rejected";
    return String(event.status || "Upcoming");
  }

  function getStatusClass(status) {
    return status.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  }

  function openEventDetails(event) {
    if (!eventDetailsModal) return;
    window.RecovibeEventDetails?.open(event, { showApprovalDocuments: true });
  }

  function closeEventDetails() {
    if (!eventDetailsModal) return;
    eventDetailsModal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  function canPublish(event) {
    return canPublishOrganizerEvent(event);
  }

  function getActionMarkup(event) {
    const eventId = escapeHtml(event.eventId);
    const status = getStatus(event);
    const cancelled = status === "Cancelled";
    const published = status === "Published";
    const publishDisabled = !canPublish(event);

    return `
      <div class="event-actions">
        <button type="button" class="event-action" data-action="view" data-event-id="${eventId}">
          View
        </button>
        ${
          !published && !cancelled
            ? `
          ${
            ["Rejected", "Needs Revision"].includes(status)
              ? `<button type="button" class="event-action" data-action="draft" data-event-id="${eventId}">
            Draft
          </button>`
              : ""
          }
          ${
            ["Draft", "Rejected", "Needs Revision"].includes(status)
              ? `<button type="button" class="event-action" data-action="update" data-event-id="${eventId}">
            Update
          </button>`
              : ""
          }
          <button
            type="button"
            class="event-action event-action-primary"
            data-action="publish"
            data-event-id="${eventId}"
            ${publishDisabled ? "disabled" : ""}
          >
            Publish
          </button>
          <button type="button" class="event-action event-action-danger" data-action="cancel" data-event-id="${eventId}">
            Cancel
          </button>
        `
            : ""
        }
      </div>`;
  }

  function getHapMarkup(event, hapNumber) {
    const approved = isOrganizerEventHapApproved(event, hapNumber);

    return `
      <input
        type="checkbox"
        class="hap-status"
        aria-label="HAP ${hapNumber} approval"
        data-hap="${hapNumber}"
        data-event-id="${escapeHtml(event.eventId)}"
        ${approved ? "checked" : ""}
        disabled
      />`;
  }

  function renderEmptyState() {
    const hasOrganizerEvents = getOrganizerEventsForCurrentUser().length > 0;
    const selectedStatus = statusFilter.value;
    const selectedStatusLabel =
      statusFilter.selectedOptions[0]?.textContent.trim() || selectedStatus;
    const heading = !hasOrganizerEvents
      ? "No events created yet."
      : selectedStatus !== "all"
        ? `No events found with status: ${selectedStatusLabel}`
        : "No events match your filters.";
    const message = hasOrganizerEvents
      ? "Try changing or clearing your filters."
      : "Click 'Create Event' to get started.";
    eventTableBody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="event-table-empty">
            <strong>${escapeHtml(heading)}</strong>
            <span>${escapeHtml(message)}</span>
            ${!hasOrganizerEvents ? '<a class="organizer-button" href="EventOrganizerCreateEvent.html">+ Create Event</a>' : ""}
          </div>
        </td>
      </tr>`;
  }

  function renderStatistics(events) {
    const total = events.length;
    const pending = events.filter((event) =>
      ["Pending", "Pending Approval"].includes(getStatus(event)),
    ).length;
    const approved = events.filter((event) =>
      ["Approved", "Published"].includes(getStatus(event)),
    ).length;
    const needsRevision = events.filter(
      (event) => getStatus(event) === "Needs Revision",
    ).length;

    document.getElementById("totalEventsCount").textContent = total;
    document.getElementById("pendingEventsCount").textContent = pending;
    document.getElementById("approvedEventsCount").textContent = approved;
    document.getElementById("needsRevisionCount").textContent = needsRevision;
  }

  function renderEvents() {
    const allEvents = getOrganizerEventsForCurrentUser();
    const events = getFilteredEvents();

    renderStatistics(allEvents);
    eventResultsCount.textContent = `Showing ${events.length} of ${allEvents.length} events`;

    if (!events.length) {
      renderEmptyState();
      return;
    }

    eventTableBody.innerHTML = events
      .map((event) => {
        const eventId = escapeHtml(event.eventId);
        const status = getStatus(event);
        const statusClass = getStatusClass(status);
        const eventDate = event.dateISO || event.eventDate;
        const schedule =
          event.time ||
          [event.startTime, event.endTime].filter(Boolean).join(" - ") ||
          "Time TBA";
        const venue = event.location || event.venue || "Location TBA";
        const category =
          event.category || event.eventType || "Category not specified";

        return `
        <tr data-event-id="${eventId}">
          <td data-label="Event">
            <strong>${escapeHtml(event.eventName || event.title || "Untitled")}</strong>
            <small class="event-category-badge">${escapeHtml(category)}</small>
          </td>
          <td data-label="Date Created">
            ${formatDate(event.createdAt, "Date unavailable")}
          </td>
          <td>${getHapMarkup(event, 1)}</td>
          <td>${getHapMarkup(event, 2)}</td>
          <td>${getHapMarkup(event, 3)}</td>
          <td data-label="Schedule">${escapeHtml(formatDate(eventDate))}<small>${escapeHtml(schedule)}</small></td>
          <td data-label="Location">${escapeHtml(venue)}</td>
          <td data-label="Status">
            <span class="organizer-status ${statusClass}">
              ${escapeHtml(status)}
            </span>
          </td>
          <td data-label="Actions">${getActionMarkup(event)}</td>
        </tr>`;
      })
      .join("");
  }

  function findEvent(eventId) {
    return getOrganizerEventsForCurrentUser().find(
      (event) => String(event.eventId) === String(eventId),
    );
  }

  function handleEventAction(action, eventId) {
    const event = findEvent(eventId);

    if (!event) {
      return;
    }

    if (action === "view") {
      openEventDetails(event);
      return;
    }

    if (action === "update") {
      window.location.href = `EventOrganizerCreateEvent.html?eventId=${encodeURIComponent(eventId)}`;
      return;
    }

    if (action === "draft") {
      updateOrganizerEvent(eventId, {
        status: "Draft",
        published: false,
        cancelled: false,
      });
      renderEvents();
      return;
    }

    if (action === "publish") {
      if (!canPublish(event)) {
        return;
      }

      const result = publishOrganizerEvent(eventId, organizerId);

      if (result.success) {
        renderEvents();
      } else {
        console.error(result.message);
      }
      return;
    }

    if (action === "cancel") {
      const confirmed = window.confirm(
        "Are you sure you want to cancel this event?",
      );

      if (!confirmed) {
        return;
      }

      updateOrganizerEvent(eventId, {
        status: "Cancelled",
        cancelled: true,
        published: false,
      });
      renderEvents();
    }
  }

  eventTableBody.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");

    if (!actionButton || actionButton.disabled) {
      return;
    }

    handleEventAction(
      actionButton.dataset.action,
      actionButton.dataset.eventId,
    );
  });

  window.enhanceDropdownSelects?.("#eventStatusFilter, #eventDateFilter");
  [searchInput, statusFilter, dateFilter].forEach((element) => {
    element.addEventListener("input", renderEvents);
    element.addEventListener("change", renderEvents);
  });

  if (todayElement) {
    todayElement.textContent = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  updateOrganizerAccount();

  document.getElementById("organizerLogout").addEventListener("click", async (event) => {
    event.preventDefault();
    try {
      if (auth) await signOut(auth);
    } finally {
      localStorage.removeItem("recovibeOrganizerId");
      localStorage.removeItem("recovibeCurrentOrganizer");
      window.location.assign("EventOrganizerLogin.html");
    }
  });

  if (eventDetailsModal) {
    eventDetailsModal.addEventListener("click", (event) => {
      if (event.target.hasAttribute("data-modal-close")) closeEventDetails();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !eventDetailsModal.hidden)
        closeEventDetails();
    });
  }

  eventTableBody.innerHTML = '<tr><td colspan="9">Loading your events...</td></tr>';

  if (!isFirebaseConfigured || !auth || !db) {
    eventTableBody.innerHTML = '<tr><td colspan="9">Event data is unavailable. Please contact support.</td></tr>';
  } else {
    onAuthStateChanged(auth, (user) => {
      unsubscribeEvents?.();
      if (!user) {
        window.location.replace("EventOrganizerLogin.html");
        return;
      }

      organizerId = user.uid;
      const organizerQuery = query(
        collection(db, "events"),
        where("organizerId", "==", user.uid),
      );
      unsubscribeEvents = onSnapshot(
        organizerQuery,
        (snapshot) => {
          organizerEvents = snapshot.docs.map((eventDocument) => {
            const data = eventDocument.data();
            const createdAt = data.createdAt?.toDate
              ? data.createdAt.toDate().toISOString()
              : data.createdAt || "";
            const eventDate = data.eventDate || data.dateISO || data.date || "";
            return {
              ...data,
              id: eventDocument.id,
              eventId: eventDocument.id,
              eventName: data.eventName || data.title || "Untitled",
              title: data.eventName || data.title || "Untitled",
              eventDate,
              dateISO: eventDate,
              startTime: data.startTime || "",
              endTime: data.endTime || "",
              time:
                data.time ||
                [data.startTime, data.endTime].filter(Boolean).join(" - "),
              venue: data.venue || data.location || "",
              location: data.venue || data.location || "",
              category: data.category || data.eventType || "",
              organizerId: user.uid,
              createdAt,
            };
          });
          organizerEvents.sort(
            (first, second) =>
              new Date(second.createdAt || 0).getTime() -
              new Date(first.createdAt || 0).getTime(),
          );
          renderEvents();
        },
        (error) => {
          console.error("Unable to load organizer events:", error);
          eventTableBody.innerHTML = '<tr><td colspan="9">Could not load events. Please try again later.</td></tr>';
          eventResultsCount.textContent = "";
        },
      );
    });
  }
})();
