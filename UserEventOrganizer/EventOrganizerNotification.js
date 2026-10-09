const notificationStorageKey = "recovibeOrganizerNotifications";
const deletedNotificationStorageKey = "recovibeOrganizerDeletedNotifications";
const deletedNotificationLifetime = 7 * 24 * 60 * 60 * 1000;
const organizerId = localStorage.getItem("recovibeOrganizerId");
const savedNotifications = JSON.parse(
  localStorage.getItem(notificationStorageKey) || "[]",
);
let deletedNotifications = JSON.parse(
  localStorage.getItem(deletedNotificationStorageKey) || "[]",
).map((item) => ({
  ...item,
  expiresAt: item.expiresAt || Date.now() + deletedNotificationLifetime,
}));
const belongsToCurrentOrganizer = (item) =>
  !item.organizerId ||
  !organizerId ||
  String(item.organizerId) === String(organizerId);
let notifications = Array.isArray(savedNotifications)
  ? savedNotifications.filter(
      (item) =>
        item.eventId &&
        ["Approved", "Rejected"].includes(item.eventStatus) &&
        belongsToCurrentOrganizer(item),
    )
  : [];
deletedNotifications = deletedNotifications.filter(
  (item) =>
    item.eventId &&
    ["Approved", "Rejected"].includes(item.eventStatus) &&
    belongsToCurrentOrganizer(item),
);

let activeFilter = "all";
let pendingDeleteId = null;

function escapeHtml(value) {
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

function refreshNotificationsFromStorage() {
  const stored = JSON.parse(
    localStorage.getItem(notificationStorageKey) || "[]",
  );
  notifications = Array.isArray(stored)
    ? stored.filter(
        (item) =>
          item.eventId &&
          ["Approved", "Rejected"].includes(item.eventStatus) &&
          belongsToCurrentOrganizer(item),
      )
    : [];
  renderNotifications();
}

function saveNotifications() {
  const stored = JSON.parse(
    localStorage.getItem(notificationStorageKey) || "[]",
  );
  const others = Array.isArray(stored)
    ? stored.filter(
        (item) =>
          item.organizerId &&
          organizerId &&
          String(item.organizerId) !== String(organizerId),
      )
    : [];
  localStorage.setItem(
    notificationStorageKey,
    JSON.stringify([...others, ...notifications]),
  );
  saveDeletedNotifications();
  window.dispatchEvent(new Event("recovibeOrganizerNotificationsChanged"));
}

function saveDeletedNotifications() {
  const stored = JSON.parse(
    localStorage.getItem(deletedNotificationStorageKey) || "[]",
  );
  const others = Array.isArray(stored)
    ? stored.filter(
        (item) =>
          item.organizerId &&
          organizerId &&
          String(item.organizerId) !== String(organizerId),
      )
    : [];
  localStorage.setItem(
    deletedNotificationStorageKey,
    JSON.stringify([...others, ...deletedNotifications]),
  );
}

function renderDeletedNotifications() {
  const now = Date.now();
  const activeDeleted = deletedNotifications.filter(
    (item) => !item.expiresAt || item.expiresAt > now,
  );
  if (activeDeleted.length !== deletedNotifications.length) {
    deletedNotifications = activeDeleted;
    saveDeletedNotifications();
  }

  const list = document.getElementById("deletedNotificationList");
  list.innerHTML = deletedNotifications.length
    ? deletedNotifications
        .map(
          (item) => `
    <article class="notification-card deleted-notification-card type-${item.type}" data-deleted-notification-id="${item.id}">
      <h3 class="notification-title">${item.title}</h3>
      <p class="notification-message">${item.message}</p>
      <div class="notification-meta">${item.expiresAt ? `${Math.max(1, Math.ceil((item.expiresAt - now) / 86400000))} day(s) left in trash` : "Deleted recently"}</div>
      <div class="deleted-notification-actions">
        <button type="button" data-deleted-action="restore">Restore</button>
        <button type="button" data-deleted-action="delete-permanently">Delete Permanently</button>
      </div>
    </article>
  `,
        )
        .join("")
    : '<div class="empty-notifications">Trash bin is empty.</div>';
}

function renderNotifications() {
  const query = document
    .getElementById("notificationSearch")
    .value.trim()
    .toLowerCase();
  const visible = notifications.filter((item) => {
    const filterMatch =
      activeFilter === "all" ||
      (activeFilter === "read" ? item.read : !item.read);
    const textMatch =
      !query || `${item.title} ${item.message}`.toLowerCase().includes(query);
    return filterMatch && textMatch;
  });

  const list = document.getElementById("notificationList");
  list.innerHTML = visible.length
    ? visible
        .map(
          (item) => `
    <article class="notification-card type-${item.type} ${item.read ? "is-read" : ""}" id="notification-card-${item.id}" data-notification-id="${item.id}" tabindex="0" aria-label="${item.title}, ${item.read ? "read" : "unread"}">
      <div class="notification-actions">
        <button class="notification-menu-toggle" type="button" aria-label="More actions for ${item.title}" aria-expanded="false">
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><circle cx="4" cy="10" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="16" cy="10" r="1.5"/></svg>
        </button>
        <div class="notification-menu" hidden>
          <button type="button" data-notification-action="read">Read</button>
          <button type="button" data-notification-action="unread">Unread</button>
          <button type="button" data-notification-action="delete">Delete</button>
        </div>
      </div>
      <h3 class="notification-title">${escapeHtml(item.title)}</h3>
      <p class="notification-message">${escapeHtml(item.message)}</p>
      <div class="notification-meta"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 3.5a4.5 4.5 0 0 0-4.5 4.5v2.4c0 .5-.2 1-.5 1.4L4 13h12l-1-1.2c-.3-.4-.5-.9-.5-1.4V8A4.5 4.5 0 0 0 10 3.5Z" stroke="currentColor" stroke-width="1.3"/><path d="M8.3 16a1.7 1.7 0 0 0 3.4 0" stroke="currentColor" stroke-width="1.3"/></svg>${escapeHtml(item.time)}</div>
    </article>
  `,
        )
        .join("")
    : '<div class="empty-notifications">No notifications match your filters.</div>';

  const unread = notifications.filter((item) => !item.read).length;
  const badge = document.getElementById("navNotifBadge");
  if (badge) {
    badge.textContent = unread;
    badge.hidden = unread === 0;
  }

  renderDeletedNotifications();
}

function markAllRead() {
  notifications = notifications.map((item) => ({ ...item, read: true }));
  saveNotifications();
  renderNotifications();
}

function deleteAllNotifications() {
  if (!deletedNotifications.length) return;
  if (!window.confirm("Permanently delete all recently deleted notifications?"))
    return;
  deletedNotifications = [];
  saveDeletedNotifications();
  renderDeletedNotifications();
}

function updateNotificationPanelControls(showingDeletedNotifications) {
  const toggle = document.getElementById("showDeletedNotifications");
  const label = document.getElementById("showDeletedNotificationsLabel");
  const icon = document.getElementById("showDeletedNotificationsIcon");
  const action = document.getElementById("markAllRead");

  if (!toggle || !label || !icon || !action) return;

  toggle.setAttribute("aria-pressed", String(showingDeletedNotifications));
  label.textContent = showingDeletedNotifications
    ? "All Notifications"
    : "Recently Deleted";
  action.textContent = showingDeletedNotifications
    ? "Delete All"
    : "Mark All As Read";
  icon.innerHTML = showingDeletedNotifications
    ? '<path d="M3.5 5.5h13M5 5.5v10h10v-10M7.5 3.5h5l1 2h-7l1-2M8 8v5m4-5v5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>'
    : '<path d="M4 6h12M8 6V4.5h4V6m-6.5 0 .7 10h7.6l.7-10M8.5 9v4m3-4v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>';
}

function swapNotificationPanels() {
  const panels = document.getElementById("notificationPanels");
  const allPanel = document.getElementById("allNotificationsPanel");
  const deletedPanel = document.getElementById("deletedNotificationsPanel");
  if (!panels || !allPanel || !deletedPanel) return;

  const firstPanel = panels.querySelector(":scope > .notifications-panel");
  const showingDeletedNotifications =
    firstPanel.id !== "deletedNotificationsPanel";
  if (showingDeletedNotifications) panels.insertBefore(deletedPanel, allPanel);
  else panels.insertBefore(allPanel, deletedPanel);
  updateNotificationPanelControls(showingDeletedNotifications);
}

function openDeleteConfirmation(id) {
  pendingDeleteId = id;
  const overlay = document.getElementById("deleteConfirmOverlay");
  if (overlay) overlay.hidden = false;
}

function closeDeleteConfirmation() {
  pendingDeleteId = null;
  const overlay = document.getElementById("deleteConfirmOverlay");
  if (overlay) overlay.hidden = true;
}

function deletePendingNotification() {
  if (!pendingDeleteId) return;
  const target = notifications.find((item) => item.id === pendingDeleteId);
  if (!target) return;

  const moved = {
    ...target,
    deletedAt: Date.now(),
    expiresAt: Date.now() + deletedNotificationLifetime,
  };
  notifications = notifications.filter((item) => item.id !== pendingDeleteId);
  deletedNotifications.unshift(moved);
  saveNotifications();
  closeDeleteConfirmation();
  renderNotifications();
}

function openNotificationDetails(item) {
  const eventItem =
    typeof getOrganizerEvents === "function"
      ? getOrganizerEvents().find(
          (event) => String(event.eventId) === String(item.eventId),
        )
      : null;
  const overlay = document.getElementById("notificationModalOverlay");
  const modal = overlay?.querySelector(".notification-modal");
  if (!overlay || !modal) return;

  const title = modal.querySelector('[data-notification-field="title"]');
  const from = modal.querySelector('[data-notification-field="from"]');
  const time = modal.querySelector('[data-notification-field="time"]');
  const message = modal.querySelector('[data-notification-field="message"]');

  if (title) title.textContent = item.title;
  if (from) from.textContent = item.from ? `From ${item.from}` : "";
  if (time) time.textContent = item.time;
  if (message) message.textContent = item.message;

  const reason = document.getElementById("notificationModalReason");
  if (reason) {
    reason.textContent = item.reason ? `Reason: ${item.reason}` : "";
    reason.hidden = !item.reason;
  }

  const eventDetails = document.getElementById("notificationModalEvent");
  const eventButton = document.getElementById("notificationViewEvent");
  if (eventItem) {
    document.getElementById("notificationEventLocation").textContent =
      eventItem.location;
    document.getElementById("notificationEventTime").textContent =
      eventItem.time;
    document.getElementById("notificationEventRoom").textContent =
      eventItem.room;
    document.getElementById("notificationEventSlots").textContent =
      `${eventItem.capacity ?? 0} total capacity`;
    if (eventDetails) eventDetails.hidden = false;
    if (eventButton) {
      eventButton.hidden = false;
      eventButton.dataset.eventId = eventItem.eventId;
    }
  } else {
    if (eventDetails) eventDetails.hidden = true;
    if (eventButton) {
      eventButton.hidden = true;
      delete eventButton.dataset.eventId;
    }
  }

  overlay.hidden = false;
}

function closeNotificationDetails() {
  const overlay = document.getElementById("notificationModalOverlay");
  if (overlay) overlay.hidden = true;
}

document.addEventListener("DOMContentLoaded", () => {
  const badge = document.getElementById("navNotifBadge");
  if (badge) badge.hidden = true;

  const searchInput = document.getElementById("notificationSearch");
  const filterSelect = document.getElementById("notificationFilter");
  window.enhanceDropdownSelects?.("#notificationFilter");
  const list = document.getElementById("notificationList");
  const deletedList = document.getElementById("deletedNotificationList");
  const toggle = document.getElementById("showDeletedNotifications");
  const markReadButton = document.getElementById("markAllRead");
  const closeButton = document.getElementById("notificationModalClose");
  const overlay = document.getElementById("notificationModalOverlay");
  const deleteOverlay = document.getElementById("deleteConfirmOverlay");

  window.addEventListener(
    "recovibeOrganizerNotificationsChanged",
    refreshNotificationsFromStorage,
  );
  window.addEventListener("storage", (event) => {
    if (
      event.key === notificationStorageKey ||
      event.key === deletedNotificationStorageKey
    ) {
      refreshNotificationsFromStorage();
    }
  });

  if (searchInput) searchInput.addEventListener("input", renderNotifications);
  if (filterSelect)
    filterSelect.addEventListener("change", (event) => {
      activeFilter = event.target.value;
      renderNotifications();
    });

  if (toggle)
    toggle.addEventListener("click", () => {
      swapNotificationPanels();
    });

  if (markReadButton)
    markReadButton.addEventListener("click", () => {
      const firstPanel = document
        .getElementById("notificationPanels")
        ?.querySelector(":scope > .notifications-panel");
      const showingDeletedNotifications =
        firstPanel?.id === "deletedNotificationsPanel";
      if (showingDeletedNotifications) deleteAllNotifications();
      else markAllRead();
    });

  if (list)
    list.addEventListener("click", (event) => {
      const card = event.target.closest("[data-notification-id]");
      if (!card) return;

      const menuToggle = event.target.closest(".notification-menu-toggle");
      const menuAction = event.target.closest("[data-notification-action]");
      const item = notifications.find(
        (notification) => notification.id === card.dataset.notificationId,
      );

      if (menuToggle) {
        const menu = card.querySelector(".notification-menu");
        if (!menu) return;
        const isOpen = !menu.hidden;
        document.querySelectorAll(".notification-menu").forEach((menuNode) => {
          menuNode.hidden = true;
        });
        document
          .querySelectorAll(".notification-menu-toggle")
          .forEach((button) => button.setAttribute("aria-expanded", "false"));
        menu.hidden = isOpen;
        menuToggle.setAttribute("aria-expanded", String(!isOpen));
        return;
      }

      if (menuAction) {
        event.stopPropagation();
        if (!item) return;
        if (menuAction.dataset.notificationAction === "delete") {
          document
            .querySelectorAll(".notification-menu")
            .forEach((menuNode) => {
              menuNode.hidden = true;
            });
          openDeleteConfirmation(item.id);
          return;
        }
        item.read = menuAction.dataset.notificationAction === "read";
        saveNotifications();
        renderNotifications();
        return;
      }

      if (item) {
        item.read = true;
        saveNotifications();
        renderNotifications();
        openNotificationDetails(item);
      }
    });

  if (deletedList)
    deletedList.addEventListener("click", (event) => {
      const action = event.target.closest("[data-deleted-action]");
      const card = event.target.closest("[data-deleted-notification-id]");
      if (!action || !card) return;

      const item = deletedNotifications.find(
        (notification) =>
          notification.id === card.dataset.deletedNotificationId,
      );
      if (!item) return;

      if (action.dataset.deletedAction === "restore") {
        const { deletedAt, expiresAt, ...restoredItem } = item;
        notifications.unshift(restoredItem);
        deletedNotifications = deletedNotifications.filter(
          (notification) => notification.id !== item.id,
        );
        saveNotifications();
      } else {
        deletedNotifications = deletedNotifications.filter(
          (notification) => notification.id !== item.id,
        );
      }

      saveDeletedNotifications();
      renderNotifications();
    });

  if (closeButton)
    closeButton.addEventListener("click", closeNotificationDetails);
  if (overlay)
    overlay.addEventListener("click", (event) => {
      if (event.target.id === "notificationModalOverlay")
        closeNotificationDetails();
    });

  if (deleteOverlay)
    deleteOverlay.addEventListener("click", (event) => {
      if (event.target.id === "deleteConfirmOverlay") closeDeleteConfirmation();
    });

  const confirmDeleteButton = document.getElementById(
    "confirmDeleteNotification",
  );
  if (confirmDeleteButton)
    confirmDeleteButton.addEventListener("click", deletePendingNotification);

  const cancelDeleteButton = document.getElementById(
    "cancelDeleteNotification",
  );
  if (cancelDeleteButton)
    cancelDeleteButton.addEventListener("click", closeDeleteConfirmation);

  const deleteCloseButton = document.getElementById("deleteConfirmClose");
  if (deleteCloseButton)
    deleteCloseButton.addEventListener("click", closeDeleteConfirmation);

  const viewEventButton = document.getElementById("notificationViewEvent");
  if (viewEventButton)
    viewEventButton.addEventListener("click", () => {
      const eventId = viewEventButton.dataset.eventId;
      const event =
        typeof getOrganizerEvents === "function"
          ? getOrganizerEvents().find(
              (item) => String(item.eventId || item.id) === String(eventId),
            )
          : null;
      if (!event) return;
      closeNotificationDetails();
      window.RecovibeEventDetails?.open(event);
    });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeNotificationDetails();
      closeDeleteConfirmation();
    }
  });

  saveNotifications();
  updateNotificationPanelControls(false);
  renderNotifications();
});
