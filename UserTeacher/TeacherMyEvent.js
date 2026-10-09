(() => {
  const storageKey = "recovibeTeacherEvents";
  const tableBody = document.getElementById("eventTableBody");
  const searchInput = document.getElementById("eventSearch");
  const statusFilter = document.getElementById("eventStatusFilter");
  const dateFilter = document.getElementById("eventDateFilter");
  const resultsCount = document.getElementById("eventResultsCount");
  const modal = document.getElementById("eventDetailsModal");

  const escapeHTML = (value) =>
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

  function readEvents() {
    try {
      const events = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(events) ? events : [];
    } catch (error) {
      console.warn("Unable to read teacher events:", error);
      return [];
    }
  }

  function saveEvents(events) {
    localStorage.setItem(storageKey, JSON.stringify(events));
  }

  function getStatus(event) {
    const status = String(event.status || "Pending")
      .toLowerCase()
      .replace(/[ _-]+/g, " ");
    if (status === "draft") return "Draft";
    if (status === "pending approval" || status === "pending") return "Pending";
    if (status === "needs revision") return "Needs Revision";
    if (status === "approved") return "Approved";
    if (status === "published") return "Published";
    if (status === "rejected") return "Rejected";
    return event.status || "Pending";
  }

  function formatDate(value, fallback = "Date TBA") {
    if (!value) return fallback;
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? fallback
      : date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
  }

  function renderStatistics(events) {
    document.getElementById("totalEventsCount").textContent = events.length;
    document.getElementById("pendingEventsCount").textContent = events.filter(
      (event) => getStatus(event) === "Pending",
    ).length;
    document.getElementById("approvedEventsCount").textContent = events.filter(
      (event) => ["Approved", "Published"].includes(getStatus(event)),
    ).length;
    document.getElementById("needsRevisionCount").textContent = events.filter(
      (event) => getStatus(event) === "Needs Revision",
    ).length;
  }

  function getFilteredEvents(events) {
    const query = searchInput.value.trim().toLowerCase();
    const selectedStatus = statusFilter.value;
    const selectedDate = dateFilter.value;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return events
      .filter((event) => {
        const text =
          `${event.title || ""} ${event.location || ""} ${event.category || ""}`.toLowerCase();
        const date = event.dateISO
          ? new Date(`${event.dateISO}T00:00:00`)
          : null;
        const validDate = date && !Number.isNaN(date.getTime());
        const matchesDate =
          selectedDate === "all" ||
          (validDate &&
            (selectedDate === "upcoming" ? date >= today : date < today));
        return (
          (!query || text.includes(query)) &&
          (selectedStatus === "all" || getStatus(event) === selectedStatus) &&
          matchesDate
        );
      })
      .sort((first, second) =>
        String(first.dateISO || "").localeCompare(String(second.dateISO || "")),
      );
  }

  function openDetails(event) {
    const teacherId = localStorage.getItem("recovibeTeacherId");
    const canReviewDocuments =
      teacherId &&
      String(
        event.createdBy || event.teacherId || event.organizerId || "",
      ).toLowerCase() === String(teacherId).toLowerCase();
    window.RecovibeEventDetails?.open(event, {
      showApprovalDocuments: Boolean(canReviewDocuments),
    });
  }

  function render() {
    const allEvents = readEvents();
    const events = getFilteredEvents(allEvents);
    renderStatistics(allEvents);
    resultsCount.textContent = `Showing ${events.length} of ${allEvents.length} events`;

    if (!events.length) {
      tableBody.innerHTML =
        '<tr><td colspan="9"><div class="event-table-empty"><strong>No teacher events yet</strong><span>Submit an event to see its approval status here.</span><a class="organizer-button" href="TeacherCreate.html">Create Event</a></div></td></tr>';
      return;
    }

    tableBody.innerHTML = events
      .map((event) => {
        const id = escapeHTML(event.eventId || event.id);
        const status = getStatus(event);
        const canRemove = status === "Draft";
        const canEdit = ["Draft", "Rejected", "Needs Revision"].includes(
          status,
        );
        return `<tr data-event-id="${id}">
        <td data-label="Event"><strong>${escapeHTML(event.title || "Untitled event")}</strong><small>${escapeHTML(event.category || "General")}</small></td>
        <td data-label="Date Created">${formatDate(event.createdAt, "Date unavailable")}</td>
        <td data-label="HAP 1">—</td><td data-label="HAP 2">—</td><td data-label="HAP 3">—</td>
        <td data-label="Schedule">${escapeHTML(event.time || "Time TBA")}</td>
        <td data-label="Location">${escapeHTML(event.location || "Location TBA")}</td>
        <td data-label="Status"><span class="organizer-status ${status.toLowerCase().replace(/[^a-z0-9_-]/g, "-")}">${escapeHTML(status)}</span></td>
        <td data-label="Actions"><div class="event-actions"><button type="button" class="event-action" data-action="view" data-event-id="${id}">View</button>${canEdit ? `<button type="button" class="event-action" data-action="edit" data-event-id="${id}">Edit</button>` : ""}${canRemove ? `<button type="button" class="event-action event-action-danger" data-action="delete" data-event-id="${id}">Delete</button>` : status !== "Cancelled" ? `<button type="button" class="event-action event-action-danger" data-action="cancel" data-event-id="${id}">Cancel</button>` : ""}</div></td>
      </tr>`;
      })
      .join("");
  }

  tableBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const events = readEvents();
    const record = events.find(
      (item) => String(item.eventId || item.id) === button.dataset.eventId,
    );
    if (!record) return;
    if (button.dataset.action === "view") {
      openDetails(record);
      return;
    }
    if (button.dataset.action === "edit") {
      window.location.href = `TeacherCreate.html?eventId=${encodeURIComponent(button.dataset.eventId)}`;
      return;
    }
    const action =
      button.dataset.action === "delete"
        ? "delete this draft"
        : "cancel this event";
    if (!window.confirm(`Are you sure you want to ${action}?`)) return;
    const updated =
      button.dataset.action === "delete"
        ? events.filter(
            (item) =>
              String(item.eventId || item.id) !== button.dataset.eventId,
          )
        : events.map((item) =>
            String(item.eventId || item.id) === button.dataset.eventId
              ? { ...item, status: "Cancelled", published: false }
              : item,
          );
    saveEvents(updated);
    render();
  });

  function setupTeacherFilterDropdowns() {
    const wrappers = [];
    function closeMenus(except) {
      wrappers.forEach(({ wrapper, button, menu }) => {
        if (wrapper === except) return;
        menu.classList.remove("show");
        button.setAttribute("aria-expanded", "false");
      });
    }

    [statusFilter, dateFilter].forEach((select) => {
      const wrapper = document.createElement("div");
      const button = document.createElement("button");
      const menu = document.createElement("div");
      const menuId = `${select.id}Dropdown`;
      wrapper.className = "filter-dropdown";
      button.className = "filter-button";
      button.type = "button";
      button.id = `${menuId}Button`;
      button.setAttribute("aria-haspopup", "listbox");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute(
        "aria-label",
        select.previousElementSibling?.textContent || "Filter events",
      );
      button.setAttribute("aria-controls", menuId);
      menu.className = "filter-menu";
      menu.id = menuId;
      menu.setAttribute("role", "listbox");
      menu.setAttribute("aria-labelledby", button.id);

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
      select.parentElement.classList.add("teacher-has-custom-filter");
      select.parentNode.insertBefore(wrapper, select);
      wrapper.append(button, menu, select);
      wrappers.push({ wrapper, button, menu });

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
        event.stopPropagation();
        select.value = item.dataset.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        syncSelection();
        closeMenus();
        button.focus();
      });
      select.addEventListener("change", syncSelection);
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".my-events-filter .filter-dropdown"))
        closeMenus();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenus();
    });
  }

  setupTeacherFilterDropdowns();

  [searchInput, statusFilter, dateFilter].forEach((element) => {
    element.addEventListener("input", render);
    element.addEventListener("change", render);
  });
  modal.addEventListener("click", (event) => {
    if (event.target.hasAttribute("data-modal-close")) {
      modal.hidden = true;
      document.body.classList.remove("modal-open");
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      modal.hidden = true;
      document.body.classList.remove("modal-open");
    }
  });

  let teacher = null;
  try {
    teacher = JSON.parse(
      localStorage.getItem("recovibeCurrentTeacher") || "null",
    );
  } catch (error) {
    console.warn("Unable to read teacher account:", error);
  }
  if (teacher) {
    const name = teacher.name || teacher.fullName || "Teacher";
    document.getElementById("userName").textContent = name;
    document.getElementById("userRole").textContent =
      teacher.department ||
      teacher.organization ||
      teacher.role ||
      "Faculty account";
    document.getElementById("userAvatar").textContent = name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  document.getElementById("organizerLogout").addEventListener("click", () => {
    localStorage.removeItem("recovibeCurrentTeacher");
    localStorage.removeItem("recovibeTeacherId");
  });
  render();
})();
