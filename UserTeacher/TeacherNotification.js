(() => {
  const notificationStorageKey = "recovibeTeacherNotifications";
  const deletedStorageKey = "recovibeTeacherDeletedNotifications";
  const deletedLifetime = 7 * 24 * 60 * 60 * 1000;
  const defaultNotifications = [];

  function safeReadArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function updateUnreadBadge() {
    const badge = document.getElementById("navNotifBadge");
    if (!badge) return;

    const saved = safeReadArray(notificationStorageKey);
    const current = saved.length
      ? saved
      : defaultNotifications.map((item) => ({ ...item }));
    const knownIds = new Set(current.map((item) => item.id));
    defaultNotifications.forEach((item) => {
      if (!knownIds.has(item.id)) current.push({ ...item });
    });
    const now = Date.now();
    const deletedIds = new Set(
      safeReadArray(deletedStorageKey)
        .filter((item) => !item.expiresAt || item.expiresAt > now)
        .map((item) => item.id),
    );
    const unreadCount = current.filter(
      (item) => !item.read && !deletedIds.has(item.id),
    ).length;

    badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
    badge.hidden = unreadCount === 0;
    badge.setAttribute(
      "aria-label",
      unreadCount
        ? `${unreadCount} unread notifications`
        : "No unread notifications",
    );
  }

  updateUnreadBadge();
  window.addEventListener("storage", (event) => {
    if (
      !event.key ||
      [notificationStorageKey, deletedStorageKey].includes(event.key)
    )
      updateUnreadBadge();
  });
  window.addEventListener("focus", updateUnreadBadge);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) updateUnreadBadge();
  });

  if (!document.getElementById("notificationList")) return;

  function readArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (error) {
      console.warn(`Unable to read ${key}:`, error);
      return [];
    }
  }

  function escapeHTML(value) {
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

  const savedNotifications = readArray(notificationStorageKey);
  let notifications = savedNotifications.length
    ? savedNotifications
    : defaultNotifications.map((item) => ({ ...item }));
  const knownIds = new Set(notifications.map((item) => item.id));
  defaultNotifications.forEach((item) => {
    if (!knownIds.has(item.id)) notifications.push({ ...item });
  });
  let deletedNotifications = readArray(deletedStorageKey).map((item) => ({
    ...item,
    expiresAt: item.expiresAt || Date.now() + deletedLifetime,
  }));
  let activeFilter = "all";
  let pendingDeleteId = null;

  const searchInput = document.getElementById("notificationSearch");
  const notificationList = document.getElementById("notificationList");
  const deletedList = document.getElementById("deletedNotificationList");
  const notificationPanels = document.getElementById("notificationPanels");
  const detailsOverlay = document.getElementById("notificationModalOverlay");
  const deleteOverlay = document.getElementById("deleteConfirmOverlay");

  function save() {
    localStorage.setItem(notificationStorageKey, JSON.stringify(notifications));
    localStorage.setItem(
      deletedStorageKey,
      JSON.stringify(deletedNotifications),
    );
  }

  function renderDeleted() {
    const now = Date.now();
    deletedNotifications = deletedNotifications.filter(
      (item) => item.expiresAt > now,
    );
    deletedList.innerHTML = deletedNotifications.length
      ? deletedNotifications
          .map(
            (item) => `
        <article class="notification-card deleted-notification-card type-${escapeHTML(item.type)}" data-deleted-notification-id="${escapeHTML(item.id)}">
          <h3 class="notification-title">${escapeHTML(item.title)}</h3>
          <p class="notification-message">${escapeHTML(item.message)}</p>
          <div class="notification-meta">${Math.max(1, Math.ceil((item.expiresAt - now) / 86400000))} day(s) left in trash</div>
          <div class="deleted-notification-actions">
            <button type="button" data-deleted-action="restore">Restore</button>
            <button type="button" data-deleted-action="delete-permanently">Delete Permanently</button>
          </div>
        </article>`,
          )
          .join("")
      : '<div class="empty-notifications">Trash bin is empty.</div>';
  }

  function renderNotifications() {
    const query = searchInput.value.trim().toLowerCase();
    const visible = notifications.filter((item) => {
      const stateMatches =
        activeFilter === "all" ||
        (activeFilter === "read" ? item.read : !item.read);
      return (
        stateMatches &&
        (!query ||
          `${item.title} ${item.message}`.toLowerCase().includes(query))
      );
    });

    notificationList.innerHTML = visible.length
      ? visible
          .map(
            (item) => `
        <article class="notification-card type-${escapeHTML(item.type)} ${item.read ? "is-read" : ""}" data-notification-id="${escapeHTML(item.id)}" tabindex="0" aria-label="${escapeHTML(item.title)}, ${item.read ? "read" : "unread"}">
          <div class="notification-actions">
            <button class="notification-menu-toggle" type="button" aria-label="More actions for ${escapeHTML(item.title)}" aria-expanded="false">
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><circle cx="4" cy="10" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="16" cy="10" r="1.5"/></svg>
            </button>
            <div class="notification-menu" hidden>
              <button type="button" data-notification-action="read">Mark as read</button>
              <button type="button" data-notification-action="unread">Mark as unread</button>
              <button type="button" data-notification-action="delete">Delete</button>
            </div>
          </div>
          <h3 class="notification-title">${escapeHTML(item.title)}</h3>
          <p class="notification-message">${escapeHTML(item.message)}</p>
          <div class="notification-meta"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.3"/><path d="M10 6v4l2.5 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>${escapeHTML(item.time)}</div>
        </article>`,
          )
          .join("")
      : '<div class="empty-notifications">No notifications match your filters.</div>';

    renderDeleted();
    save();
    updateUnreadBadge();
  }

  function updatePanelControls(showingDeleted) {
    const button = document.getElementById("showDeletedNotifications");
    document.getElementById("showDeletedNotificationsLabel").textContent =
      showingDeleted ? "All Notifications" : "Recently Deleted";
    document.getElementById("markAllRead").textContent = showingDeleted
      ? "Delete All"
      : "Mark All As Read";
    button.setAttribute("aria-pressed", String(showingDeleted));
    document.getElementById("showDeletedNotificationsIcon").innerHTML =
      showingDeleted
        ? '<path d="M3.5 5.5h13M5 5.5v10h10v-10M7.5 3.5h5l1 2h-7l1-2M8 8v5m4-5v5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>'
        : '<path d="M4 6h12M8 6V4.5h4V6m-6.5 0 .7 10h7.6l.7-10M8.5 9v4m3-4v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>';
  }

  function showingDeleted() {
    return (
      notificationPanels.querySelector(":scope > .notifications-panel").id ===
      "deletedNotificationsPanel"
    );
  }

  function showNotification(item) {
    const eventItem = (window.RECOVIBE_EVENTS || []).find(
      (event) => String(event.id) === String(item.eventId),
    );
    const modal = detailsOverlay.querySelector(".notification-modal");
    document.getElementById("notificationModalTitle").textContent = item.title;
    document.getElementById("notificationModalFrom").textContent = item.from
      ? `From ${item.from}`
      : "";
    document.getElementById("notificationModalTime").textContent = item.time;
    document.getElementById("notificationModalMessage").textContent =
      item.message;
    const reason = document.getElementById("notificationModalReason");
    reason.textContent = item.reason ? `Reason: ${item.reason}` : "";
    reason.hidden = !item.reason;
    const eventPanel = document.getElementById("notificationModalEvent");
    const viewButton = document.getElementById("notificationViewEvent");
    if (eventItem) {
      document.getElementById("notificationEventLocation").textContent =
        eventItem.location || "Location TBA";
      document.getElementById("notificationEventTime").textContent =
        eventItem.time || "Time TBA";
      document.getElementById("notificationEventRoom").textContent =
        eventItem.room || "Room TBA";
      document.getElementById("notificationEventSlots").textContent =
        eventItem.slotsOpen === undefined
          ? "Availability not specified"
          : `${eventItem.slotsOpen} of ${eventItem.maxSlots ?? eventItem.slotsOpen} slots open`;
      eventPanel.hidden = false;
      viewButton.hidden = false;
      viewButton.dataset.eventId = eventItem.id;
    } else {
      eventPanel.hidden = true;
      viewButton.hidden = true;
      delete viewButton.dataset.eventId;
    }
    detailsOverlay.hidden = false;
    modal.querySelector(".notification-modal-close").focus();
  }

  function closeDetails() {
    detailsOverlay.hidden = true;
  }

  function closeDeleteConfirmation() {
    pendingDeleteId = null;
    deleteOverlay.hidden = true;
  }

  function deletePendingNotification() {
    const item = notifications.find(
      (notification) => notification.id === pendingDeleteId,
    );
    if (!item) return closeDeleteConfirmation();
    notifications = notifications.filter(
      (notification) => notification.id !== item.id,
    );
    deletedNotifications.unshift({
      ...item,
      deletedAt: Date.now(),
      expiresAt: Date.now() + deletedLifetime,
    });
    closeDeleteConfirmation();
    renderNotifications();
  }

  const notificationFilter = document.getElementById("notificationFilter");
  const filterDropdown = document.createElement("div");
  const filterButton = document.createElement("button");
  const filterMenu = document.createElement("div");
  filterDropdown.className = "filter-dropdown";
  filterButton.className = "filter-button";
  filterButton.type = "button";
  filterButton.id = "notificationFilterDropdownButton";
  filterButton.setAttribute("aria-haspopup", "listbox");
  filterButton.setAttribute("aria-expanded", "false");
  filterButton.setAttribute(
    "aria-label",
    notificationFilter.getAttribute("aria-label") || "Filter notifications",
  );
  filterButton.setAttribute("aria-controls", "notificationFilterDropdown");
  filterMenu.className = "filter-menu";
  filterMenu.id = "notificationFilterDropdown";
  filterMenu.setAttribute("role", "listbox");
  filterMenu.setAttribute("aria-labelledby", filterButton.id);
  [...notificationFilter.options].forEach((option) => {
    const item = document.createElement("button");
    item.className = `filter-option${option.selected ? " active" : ""}`;
    item.type = "button";
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", String(option.selected));
    item.dataset.value = option.value;
    item.textContent = option.textContent.trim();
    filterMenu.appendChild(item);
  });

  function syncNotificationFilter() {
    const selected =
      notificationFilter.options[notificationFilter.selectedIndex];
    filterButton.childNodes[0]?.remove();
    filterButton.insertBefore(
      document.createTextNode(selected ? selected.textContent.trim() : ""),
      filterButton.firstChild,
    );
    filterMenu.querySelectorAll(".filter-option").forEach((item) => {
      const active = item.dataset.value === notificationFilter.value;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
    });
  }

  syncNotificationFilter();
  notificationFilter.classList.add("teacher-native-filter-select");
  notificationFilter.setAttribute("aria-hidden", "true");
  notificationFilter.tabIndex = -1;
  notificationFilter.hidden = true;
  notificationFilter.parentElement.classList.add("teacher-has-custom-filter");
  notificationFilter.parentNode.insertBefore(
    filterDropdown,
    notificationFilter,
  );
  filterDropdown.append(filterButton, filterMenu, notificationFilter);
  filterButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = filterMenu.classList.contains("show");
    filterMenu.classList.toggle("show", !isOpen);
    filterButton.setAttribute("aria-expanded", String(!isOpen));
  });
  filterMenu.addEventListener("click", (event) => {
    const item = event.target.closest(".filter-option");
    if (!item) return;
    event.stopPropagation();
    notificationFilter.value = item.dataset.value;
    notificationFilter.dispatchEvent(new Event("change", { bubbles: true }));
    syncNotificationFilter();
    filterMenu.classList.remove("show");
    filterButton.setAttribute("aria-expanded", "false");
    filterButton.focus();
  });
  notificationFilter.addEventListener("change", syncNotificationFilter);
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".filter-select-wrap .filter-dropdown")) {
      filterMenu.classList.remove("show");
      filterButton.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      filterMenu.classList.remove("show");
      filterButton.setAttribute("aria-expanded", "false");
    }
  });

  document
    .getElementById("notificationSearch")
    .addEventListener("input", renderNotifications);
  notificationFilter.addEventListener("change", (event) => {
    activeFilter = event.target.value;
    renderNotifications();
  });
  document.getElementById("markAllRead").addEventListener("click", () => {
    if (showingDeleted()) {
      if (
        !deletedNotifications.length ||
        !window.confirm(
          "Permanently delete all recently deleted notifications?",
        )
      )
        return;
      deletedNotifications = [];
    } else {
      notifications = notifications.map((item) => ({ ...item, read: true }));
    }
    renderNotifications();
  });
  document
    .getElementById("showDeletedNotifications")
    .addEventListener("click", () => {
      const allPanel = document.getElementById("allNotificationsPanel");
      const deletedPanel = document.getElementById("deletedNotificationsPanel");
      const isShowingDeleted = showingDeleted();
      notificationPanels.insertBefore(
        isShowingDeleted ? allPanel : deletedPanel,
        isShowingDeleted ? deletedPanel : allPanel,
      );
      updatePanelControls(!isShowingDeleted);
    });
  notificationList.addEventListener("click", (event) => {
    const card = event.target.closest("[data-notification-id]");
    if (!card) return;
    const item = notifications.find(
      (notification) => notification.id === card.dataset.notificationId,
    );
    const toggle = event.target.closest(".notification-menu-toggle");
    const action = event.target.closest("[data-notification-action]");
    if (toggle) {
      const menu = card.querySelector(".notification-menu");
      const open = menu.hidden;
      document.querySelectorAll(".notification-menu").forEach((element) => {
        element.hidden = true;
      });
      document
        .querySelectorAll(".notification-menu-toggle")
        .forEach((element) => element.setAttribute("aria-expanded", "false"));
      menu.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      return;
    }
    if (!item) return;
    if (action) {
      event.stopPropagation();
      if (action.dataset.notificationAction === "delete") {
        pendingDeleteId = item.id;
        deleteOverlay.hidden = false;
        document.getElementById("confirmDeleteNotification").focus();
      } else {
        item.read = action.dataset.notificationAction === "read";
        renderNotifications();
      }
      return;
    }
    item.read = true;
    renderNotifications();
    showNotification(item);
  });
  notificationList.addEventListener("keydown", (event) => {
    if (
      !["Enter", " "].includes(event.key) ||
      event.target.closest(".notification-menu")
    )
      return;
    const card = event.target.closest("[data-notification-id]");
    if (!card) return;
    event.preventDefault();
    const item = notifications.find(
      (notification) => notification.id === card.dataset.notificationId,
    );
    if (item) {
      item.read = true;
      renderNotifications();
      showNotification(item);
    }
  });
  deletedList.addEventListener("click", (event) => {
    const action = event.target.closest("[data-deleted-action]");
    const card = event.target.closest("[data-deleted-notification-id]");
    if (!action || !card) return;
    const item = deletedNotifications.find(
      (notification) => notification.id === card.dataset.deletedNotificationId,
    );
    if (!item) return;
    if (action.dataset.deletedAction === "restore") {
      const { deletedAt, expiresAt, ...restoredItem } = item;
      notifications.unshift(restoredItem);
    }
    deletedNotifications = deletedNotifications.filter(
      (notification) => notification.id !== item.id,
    );
    renderNotifications();
  });
  document
    .getElementById("notificationModalClose")
    .addEventListener("click", closeDetails);
  detailsOverlay.addEventListener("click", (event) => {
    if (event.target === detailsOverlay) closeDetails();
  });
  document
    .getElementById("notificationViewEvent")
    .addEventListener("click", (event) => {
      const eventId = event.currentTarget.dataset.eventId;
      const eventRecord = (window.RECOVIBE_EVENTS || []).find(
        (item) => String(item.id) === String(eventId),
      );
      if (!eventRecord) return;
      closeDetails();
      window.RecovibeEventDetails?.open(eventRecord);
    });
  document
    .getElementById("confirmDeleteNotification")
    .addEventListener("click", deletePendingNotification);
  document
    .getElementById("deleteConfirmClose")
    .addEventListener("click", closeDeleteConfirmation);
  document
    .getElementById("cancelDeleteNotification")
    .addEventListener("click", closeDeleteConfirmation);
  deleteOverlay.addEventListener("click", (event) => {
    if (event.target === deleteOverlay) closeDeleteConfirmation();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDetails();
      closeDeleteConfirmation();
      document.querySelectorAll(".notification-menu").forEach((menu) => {
        menu.hidden = true;
      });
      document
        .querySelectorAll(".notification-menu-toggle")
        .forEach((toggle) => toggle.setAttribute("aria-expanded", "false"));
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
  document.querySelector(".nav-item.logout").addEventListener("click", () => {
    localStorage.removeItem("recovibeCurrentTeacher");
    localStorage.removeItem("recovibeTeacherId");
  });

  renderNotifications();
  updatePanelControls(false);
})();
