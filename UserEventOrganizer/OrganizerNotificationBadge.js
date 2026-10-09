(() => {
  const eventsKey = "recovibeOrganizerEvents";
  const notificationsKey = "recovibeOrganizerNotifications";
  const statusSnapshotKey = "recovibeOrganizerEventStatusSnapshot";

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function currentOrganizerEvents() {
    const organizerId = localStorage.getItem("recovibeOrganizerId");
    const events = readJson(eventsKey, []);
    if (!Array.isArray(events)) return [];
    return events.filter(
      (event) =>
        !organizerId || String(event.organizerId) === String(organizerId),
    );
  }

  function notifyStatusChanges() {
    const events = readJson(eventsKey, []);
    if (!Array.isArray(events)) return;

    const previous = readJson(statusSnapshotKey, null);
    const next = {};
    const organizerId = localStorage.getItem("recovibeOrganizerId");

    events.forEach((event) => {
      if (!event || !event.eventId) return;
      const status = String(event.status || "Draft");
      const old = previous && previous[event.eventId];
      next[event.eventId] = {
        status,
        updatedAt: event.updatedAt || event.createdAt || "",
      };

      if (
        (old && old.status === status) ||
        !organizerId ||
        String(event.organizerId) !== String(organizerId)
      )
        return;
      if (!["Approved", "Rejected"].includes(status)) return;

      const notificationId = `event-status-${organizerId}-${event.eventId}-${status.toLowerCase()}-${event.updatedAt || Date.now()}`;
      const notifications = readJson(notificationsKey, []);
      if (
        !Array.isArray(notifications) ||
        notifications.some((item) => item.id === notificationId)
      )
        return;

      const decision = status === "Approved" ? "approved" : "rejected";
      notifications.unshift({
        id: notificationId,
        title: status === "Approved" ? "Event Approved" : "Event Rejected",
        message: `Your event "${event.title || "Untitled event"}" was ${decision}.`,
        time: new Date().toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }),
        type: status === "Approved" ? "green" : "red",
        organizerId,
        eventId: event.eventId,
        eventTitle: event.title || "Untitled event",
        eventStatus: status,
        reason: event.statusReason || event.rejectionReason || "",
        read: false,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(notificationsKey, JSON.stringify(notifications));
      window.dispatchEvent(new Event("recovibeOrganizerNotificationsChanged"));
    });

    localStorage.setItem(statusSnapshotKey, JSON.stringify(next));
  }

  function renderBadge() {
    const stored = readJson(notificationsKey, []);
    const organizerId = localStorage.getItem("recovibeOrganizerId");
    const notifications = Array.isArray(stored)
      ? stored.filter(
          (item) =>
            item.eventId && ["Approved", "Rejected"].includes(item.eventStatus),
        )
      : [];
    if (!Array.isArray(stored) || notifications.length !== stored.length) {
      localStorage.setItem(notificationsKey, JSON.stringify(notifications));
    }
    const unread = notifications.filter(
      (item) =>
        !item.read &&
        (!item.organizerId ||
          !organizerId ||
          String(item.organizerId) === String(organizerId)),
    ).length;

    document.querySelectorAll("#navNotifBadge").forEach((badge) => {
      badge.textContent = unread ? String(unread) : "";
      badge.hidden = unread === 0;
    });
  }

  function refresh() {
    notifyStatusChanges();
    renderBadge();
  }

  refresh();
  window.addEventListener("storage", (event) => {
    if ([eventsKey, "recovibeOrganizerId"].includes(event.key)) refresh();
    if (event.key === notificationsKey) {
      renderBadge();
      window.dispatchEvent(new Event("recovibeOrganizerNotificationsChanged"));
    }
  });
  window.addEventListener("recovibeOrganizerEventsChanged", refresh);
  window.addEventListener("recovibeOrganizerNotificationsChanged", renderBadge);
})();
