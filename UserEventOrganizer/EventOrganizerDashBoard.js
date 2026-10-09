(() => {
  const allEvents = getOrganizerEvents();
  const organizerId = localStorage.getItem("recovibeOrganizerId");
  const today = new Date();
  const actionRows = document.getElementById("organizerActionRows");
  const upcomingEventsList = document.getElementById("upcomingEventsList");
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

  const organizerEvents = allEvents.filter(
    (event) => organizerId && String(event.organizerId) === String(organizerId),
  );

  function readOrganizerProfile() {
    const storedProfile = localStorage.getItem("recovibeOrganizerProfile");

    if (!storedProfile) {
      return null;
    }

    try {
      const profile = JSON.parse(storedProfile);
      return profile && typeof profile === "object" ? profile : null;
    } catch (error) {
      console.error("Unable to read organizer profile:", error);
      return null;
    }
  }

  function updateOrganizerAccount() {
    const profile = readOrganizerProfile();

    if (!profile) {
      return;
    }

    const name = String(profile.name || "Event Organizer");
    const organization = String(profile.organization || "IBITS");
    const initials =
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("") || "EO";

    const organizerName = document.getElementById("organizerName");
    const organizerRole = document.getElementById("organizerRole");
    const organizerAvatar = document.getElementById("organizerAvatar");
    const organizerDashboardHeading = document.getElementById(
      "organizerDashboardHeading",
    );

    if (organizerName) organizerName.textContent = name;
    if (organizerRole) organizerRole.textContent = `${organization} account`;
    if (organizerAvatar) organizerAvatar.textContent = initials;
    if (organizerDashboardHeading)
      organizerDashboardHeading.textContent = `Good ${getGreeting()}, ${name}!`;
  }

  function getGreeting() {
    const hour = today.getHours();

    if (hour < 12) {
      return "Morning";
    }

    if (hour < 18) {
      return "Noon";
    }

    return "Evening";
  }

  function formatDate(dateISO, fallback = "Date TBA") {
    if (!dateISO) {
      return fallback;
    }

    const dateValue = String(dateISO);
    const date = new Date(
      dateValue.includes("T") ? dateValue : `${dateValue}T00:00:00`,
    );

    if (Number.isNaN(date.getTime())) {
      return fallback;
    }

    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
  }

  function getDateParts(
    dateISO,
    fallback = { month: "TBA", day: "", year: "" },
  ) {
    if (!dateISO) {
      return fallback;
    }

    const dateValue = String(dateISO);
    const date = new Date(
      dateValue.includes("T") ? dateValue : `${dateValue}T00:00:00`,
    );

    if (Number.isNaN(date.getTime())) {
      return fallback;
    }

    return {
      month: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
      day: String(date.getDate()).padStart(2, "0"),
      year: String(date.getFullYear()),
    };
  }

  function getStatus(event) {
    return String(event.status || "Draft");
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

  function getCounts() {
    return {
      active: organizerEvents.filter((event) =>
        ["Draft", "Pending", "Approved"].includes(getStatus(event)),
      ).length,
      pending: organizerEvents.filter((event) =>
        ["Pending", "Needs Revision"].includes(getStatus(event)),
      ).length,
      approved: organizerEvents.filter(
        (event) => getStatus(event) === "Approved",
      ).length,
      completed: organizerEvents.filter(
        (event) => getStatus(event) === "Completed",
      ).length,
    };
  }

  function renderStatistics() {
    const counts = getCounts();

    document.getElementById("activeEventsCount").textContent = counts.active;
    document.getElementById("pendingApprovalCount").textContent =
      counts.pending;
    document.getElementById("approvedEventsCount").textContent =
      counts.approved;
    document.getElementById("completedEventsCount").textContent =
      counts.completed;
  }

  function renderActionRequired() {
    if (!organizerEvents.length) {
      actionRows.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="dashboard-empty-state">
              <strong>No events created yet</strong>
              <span>You haven't submitted any events. Create your first event to get started.</span>
              <a class="organizer-button" href="EventOrganizerCreateEvent.html">
                + Create an Event
              </a>
            </div>
          </td>
        </tr>`;
      return;
    }

    actionRows.innerHTML = organizerEvents
      .map((event) => {
        const status = getStatus(event);
        const statusClass = getStatusClass(status);
        const hap1Approved = isOrganizerEventHapApproved(event, 1);
        const hap2Approved = isOrganizerEventHapApproved(event, 2);
        const hap3Approved = isOrganizerEventHapApproved(event, 3);

        return `
        <tr>
          <td>
            <strong>${escapeHtml(event.title || "Untitled event")}</strong>
            <small>${escapeHtml(event.category || "General")}</small>
          </td>
          <td>${formatDate(event.createdAt, "Today")}</td>
          <td><input type="checkbox" aria-label="HAP 1" ${hap1Approved ? "checked" : ""} disabled></td>
          <td><input type="checkbox" aria-label="HAP 2" ${hap2Approved ? "checked" : ""} disabled></td>
          <td><input type="checkbox" aria-label="HAP 3" ${hap3Approved ? "checked" : ""} disabled></td>
          <td>
            <span class="organizer-status ${statusClass}">
              ${escapeHtml(status)}
            </span>
          </td>
          <td>
            <button class="event-view-button" type="button" data-event-id="${escapeHtml(event.eventId)}">View</button>
          </td>
        </tr>`;
      })
      .join("");
  }

  function renderUpcomingEvents() {
    const upcomingEvents = organizerEvents
      .filter((event) => {
        if (!event.dateISO) {
          return false;
        }

        const eventDate = new Date(`${event.dateISO}T00:00:00`);
        return !Number.isNaN(eventDate.getTime()) && eventDate >= today;
      })
      .sort((first, second) => first.dateISO.localeCompare(second.dateISO))
      .slice(0, 4);

    if (!upcomingEvents.length) {
      upcomingEventsList.innerHTML = `
        <div class="dashboard-empty-state compact">
          <strong>No upcoming events</strong>
          <span>Future events you create will appear here.</span>
        </div>`;
      return;
    }

    upcomingEventsList.innerHTML = upcomingEvents
      .map((event) => {
        const dateParts = getDateParts(event.dateISO);

        return `
        <article class="upcoming-event">
          <div class="upcoming-event-date">
            <span class="upcoming-event-month">${escapeHtml(dateParts.month)}</span>
            <strong>${escapeHtml(dateParts.day)}</strong>
            <small>${escapeHtml(dateParts.year)}</small>
          </div>
          <div class="upcoming-event-content">
            <strong>${escapeHtml(event.title || "Untitled event")}</strong>
            <span>${escapeHtml(event.time || "Time TBA")}</span>
            <span>${escapeHtml(event.location || "Location TBA")}</span>
          </div>
        </article>`;
      })
      .join("");
  }

  const organizerToday = document.getElementById("organizerToday");
  if (organizerToday) {
    organizerToday.textContent = today.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  updateOrganizerAccount();
  renderStatistics();
  renderActionRequired();
  renderUpcomingEvents();

  window.addEventListener("storage", (event) => {
    if (event.key === "recovibeOrganizerEvents") window.location.reload();
  });

  actionRows.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-event-id]");
    if (!viewButton) return;
    const selectedEvent = organizerEvents.find(
      (item) => String(item.eventId) === viewButton.dataset.eventId,
    );
    if (selectedEvent) openEventDetails(selectedEvent);
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

  document.getElementById("organizerLogout").addEventListener("click", () => {
    localStorage.removeItem("recovibeCurrentOrganizer");
  });
})();
