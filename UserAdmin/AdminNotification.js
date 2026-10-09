(() => {
  "use strict";
  const profile = read("recovibeAdminProfile", null),
    identity = localStorage.getItem("recovibeAdminId");
  if (
    !profile ||
    String(profile.role || "").toLowerCase() !== "admin" ||
    !identity
  ) {
    location.replace("AdminLogin.html");
    return;
  }
  const root = document.getElementById("notificationRoot"),
    key = "recovibeAdminNotifications",
    trashKey = "recovibeAdminDeletedNotifications",
    lifetime = 30 * 86400000;
  let filter = "all",
    deleted = false,
    search = "",
    undoSnapshot = null,
    undoTimer;
  document.querySelector("[data-name]").textContent = (
    profile.name || identity
  ).toUpperCase();
  document.querySelector("[data-avatar]").textContent = (profile.name || "HA")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  document.querySelector("[data-role]").textContent =
    "Head of Academic Programs";
  document.querySelector("[data-today]").textContent =
    new Date().toLocaleDateString("en-US", {
      timeZone: "Asia/Manila",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  document.querySelector(".admin-logout").onclick = () =>
    localStorage.removeItem("recovibeAdminId");
  function read(name, fallback) {
    try {
      return JSON.parse(localStorage.getItem(name) || "null") ?? fallback;
    } catch {
      return fallback;
    }
  }
  function esc(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (ch) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[ch],
    );
  }
  function getEvents() {
    return ["recovibeTeacherEvents", "recovibeOrganizerEvents"].flatMap(
      (storage) => {
        const list = read(storage, []);
        return Array.isArray(list)
          ? list.map((event) => ({ ...event, _store: storage }))
          : [];
      },
    );
  }
  function status(event) {
    return String(event.status || "")
      .toLowerCase()
      .replace(/[ _-]+/g, "_");
  }
  function snapshots() {
    const current = read(key, []),
      known = new Set(
        Array.isArray(current) ? current.map((item) => item.id) : [],
      ),
      next = Array.isArray(current) ? current : [];
    getEvents().forEach((event) => {
      const id = String(event.eventId || event.id);
      const add = (type, title, message) => {
        const stamp =
          event.updatedAt || event.submittedAt || event.createdAt || "";
        const noteId = `${type}-${id}-${stamp || status(event)}`;
        if (known.has(noteId)) return;
        next.unshift({
          id: noteId,
          eventId: id,
          type,
          title,
          message,
          createdAt: stamp || new Date().toISOString(),
          read: false,
          sourceStore: event._store,
        });
      };
      const state = status(event);
      if (["pending_approval", "pending"].includes(state))
        add(
          "approval",
          "New Event Submitted",
          `“${event.title || "Untitled event"}” was submitted for approval.`,
        );
      if (state === "final_documents_submitted")
        add(
          "final-documents",
          "Final Documents Submitted",
          `Final documents are ready for review for “${event.title || "Untitled event"}”.`,
        );
      if (event.rescheduleRequest?.status === "pending")
        add(
          "reschedule",
          "Reschedule Requested",
          `A reschedule was requested for “${event.title || "Untitled event"}”.`,
        );
      if (
        ["cancelled", "canceled"].includes(state) &&
        event.cancellation?.cancelledAt &&
        !event.cancellation?.acknowledgedAt
      )
        add(
          "cancellation",
          "Event Cancelled",
          `The organizer cancelled “${event.title || "Untitled event"}”.`,
        );
      if (["pending_approval", "pending"].includes(state) && hasConflict(event))
        add(
          "conflict",
          "Venue Conflict Detected",
          `“${event.title || "Untitled event"}” overlaps another event at the same venue.`,
        );
      (event.reviewHistory || [])
        .filter((entry) => String(entry.by) === String(identity))
        .forEach((entry) => {
          const entryId = `admin-decision-${id}-${entry.at}-${entry.action}`;
          if (!known.has(entryId))
            next.unshift({
              id: entryId,
              eventId: id,
              type: "decision",
              title: "Review Decision Recorded",
              message: `${entry.action.replaceAll("_", " ")} for “${event.title || "Untitled event"}”.`,
              createdAt: entry.at,
              read: false,
            });
        });
    });
    localStorage.setItem(key, JSON.stringify(next));
    return next;
  }
  function hasConflict(event) {
    const date = (event.dateISO || event.date || "").slice(0, 10),
      venue = event.venue || event.location;
    if (!date || !venue || venue.startsWith("Others |")) return false;
    const parse = (value) => {
      const text = String(value || "");
      let m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(text);
      if (m)
        return (
          ((+m[1] % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0)) * 60 + +m[2]
        );
      m = /^(\d{1,2}):(\d{2})$/.exec(text);
      return m ? +m[1] * 60 + +m[2] : null;
    };
    const rooms = [
      "AVR2-1Room | PUP Biñan",
      "AVR2-2Room | PUP Biñan",
      "AVR2-3Room | PUP Biñan",
    ];
    const same = (a, b) =>
      a === b ||
      (a === "AVR2 | PUP Biñan" && rooms.includes(b)) ||
      (b === "AVR2 | PUP Biñan" && rooms.includes(a));
    const parts = String(event.time || "").split(/\s*[-–]\s*/),
      start = parse(event.startTime || parts[0]),
      end = parse(event.endTime || parts[1]);
    return getEvents().some((other) => {
      if (
        String(other.eventId || other.id) ===
          String(event.eventId || event.id) ||
        ["draft", "rejected", "cancelled", "canceled"].includes(status(other))
      )
        return false;
      if (
        (other.dateISO || other.date || "").slice(0, 10) !== date ||
        !same(venue, other.venue || other.location)
      )
        return false;
      const times = String(other.time || "").split(/\s*[-–]\s*/),
        a = parse(other.startTime || times[0]),
        b = parse(other.endTime || times[1]);
      return (
        start !== null &&
        end !== null &&
        a !== null &&
        b !== null &&
        start < b &&
        end > a
      );
    });
  }
  function age(value) {
    const date = new Date(value || 0);
    if (!value || Number.isNaN(date.getTime())) return "Just now";
    const mins = Math.max(0, Math.floor((Date.now() - date) / 60000));
    if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  function render() {
    try {
      let live = snapshots(),
        trash = read(trashKey, []);
      trash = Array.isArray(trash)
        ? trash.filter((item) => item.expiresAt > Date.now())
        : [];
      localStorage.setItem(trashKey, JSON.stringify(trash));
      const source = deleted ? trash : live;
      const visible = source.filter(
        (item) =>
          (!search ||
            `${item.title} ${item.message}`
              .toLowerCase()
              .includes(search.toLowerCase())) &&
          (deleted ||
            filter === "all" ||
            (filter === "read" ? item.read : !item.read)),
      );
      root.innerHTML = `<div class="notification-controls"><input class="admin-search" id="notificationSearch" type="search" placeholder="Search notifications" aria-label="Search notifications" value="${esc(search)}"><div class="notification-filters">${[
        ["all", "All Notifs"],
        ["read", "Read"],
        ["unread", "Unread"],
      ]
        .map(
          ([value, label]) =>
            `<button type="button" data-filter="${value}" class="${filter === value ? "active" : ""}" aria-pressed="${filter === value}">${label}</button>`,
        )
        .join(
          "",
        )}</div><div class="notification-actions"><button type="button" id="toggleTrash">${deleted ? "All Notifications" : "Recently Deleted"}</button><button type="button" id="markRead">${deleted ? "Delete All Permanently" : "Mark All As Read"}</button></div></div><section class="admin-section"><div class="admin-section-heading"><h2>${deleted ? "Recently Deleted" : "All Notifications"}</h2></div><div class="admin-cards">${visible.map((item) => (deleted ? `<article class="admin-notification-card" data-notification="${esc(item.id)}"><h2>${esc(item.title)}</h2><p>${esc(item.message)}</p><small>${age(item.createdAt)}</small><div class="admin-card-actions"><button data-restore="${esc(item.id)}">Restore</button><button data-permanent="${esc(item.id)}">Delete permanently</button></div></article>` : `<article class="admin-notification-card ${item.read ? "is-read" : ""}" data-type="${esc(item.type)}" data-notification="${esc(item.id)}" tabindex="0"><h2>${esc(item.title)}</h2><p>${esc(item.message)}</p><div class="admin-notification-time" title="${esc(new Date(item.createdAt).toLocaleString("en-US", { timeZone: "Asia/Manila", dateStyle: "full", timeStyle: "short" }))}">${age(item.createdAt)}</div><div class="admin-card-actions"><button data-delete="${esc(item.id)}">Delete</button></div></article>`)).join("") || `<div class="admin-empty">${deleted ? "Recently Deleted is empty." : "You have no notifications."}</div>`}</div></section>`;
      document.querySelector("[data-notification-count]").textContent = String(
        live.filter((item) => !item.read).length,
      );
      document.querySelector("[data-notification-count]").hidden = !live.some(
        (item) => !item.read,
      );
      wire();
    } catch (error) {
      root.innerHTML =
        '<div class="admin-error">Could not load notifications. <button class="admin-row-action" id="retryNotifications">Retry</button></div>';
      root.querySelector("#retryNotifications").onclick = render;
    }
  }
  function save(list) {
    localStorage.setItem(key, JSON.stringify(list));
  }
  function saveTrash(list) {
    localStorage.setItem(trashKey, JSON.stringify(list));
  }
  function wire() {
    root.querySelector("#notificationSearch").oninput = (event) => {
      search = event.target.value;
      render();
    };
    root.querySelectorAll("[data-filter]").forEach(
      (button) =>
        (button.onclick = () => {
          filter = button.dataset.filter;
          render();
        }),
    );
    root.querySelector("#toggleTrash").onclick = () => {
      deleted = !deleted;
      render();
    };
    root.querySelector("#markRead").onclick = () => {
      if (deleted) {
        saveTrash([]);
        render();
        return;
      }
      const list = read(key, []);
      undoSnapshot = list.map((item) => ({ ...item }));
      save(
        key,
        list.map((item) => ({ ...item, read: true })),
      );
      toastUndo("All notifications marked as read.");
      render();
    };
    root.querySelectorAll("[data-delete]").forEach(
      (button) =>
        (button.onclick = (event) => {
          event.stopPropagation();
          const list = read(key, []),
            item = list.find((note) => note.id === button.dataset.delete);
          if (!item) return;
          save(
            key,
            list.filter((note) => note.id !== item.id),
          );
          const trash = read(trashKey, []);
          trash.unshift({
            ...item,
            deletedAt: Date.now(),
            expiresAt: Date.now() + lifetime,
          });
          saveTrash(trash);
          render();
        }),
    );
    root.querySelectorAll("[data-restore]").forEach(
      (button) =>
        (button.onclick = () => {
          const trash = read(trashKey, []),
            item = trash.find((note) => note.id === button.dataset.restore);
          if (!item) return;
          const { deletedAt, expiresAt, ...rest } = item;
          const list = read(key, []);
          list.unshift(rest);
          save(key, list);
          saveTrash(trash.filter((note) => note.id !== item.id));
          render();
        }),
    );
    root.querySelectorAll("[data-permanent]").forEach(
      (button) =>
        (button.onclick = () => {
          saveTrash(
            read(trashKey, []).filter(
              (item) => item.id !== button.dataset.permanent,
            ),
          );
          render();
        }),
    );
    root.querySelectorAll("[data-notification]").forEach((card) => {
      card.onclick = (event) => {
        if (event.target.closest("button")) return;
        const list = read(key, []),
          item = list.find((note) => note.id === card.dataset.notification);
        if (!item) return;
        item.read = true;
        save(key, list);
        if (item.eventId) {
          location.href = `AdminApproval.html?review=${encodeURIComponent(item.eventId)}&type=${encodeURIComponent(issueType(item.type))}`;
        } else render();
      };
      card.onkeydown = (event) => {
        if (["Enter", " "].includes(event.key)) {
          event.preventDefault();
          card.click();
        }
      };
    });
  }
  function issueType(type) {
    return (
      {
        approval: "pending_approval",
        "final-documents": "final_documents_submitted",
        reschedule: "reschedule_request",
        cancellation: "cancellation",
        conflict: "venue_conflict",
      }[type] || "pending_approval"
    );
  }
  function toastUndo(message) {
    const toast = document.querySelector(".admin-toast");
    toast.innerHTML = `${esc(message)} <button type="button">Undo</button>`;
    toast.hidden = false;
    clearTimeout(undoTimer);
    toast.querySelector("button").onclick = () => {
      if (undoSnapshot) {
        save(key, undoSnapshot);
        undoSnapshot = null;
        render();
      }
      toast.hidden = true;
    };
    undoTimer = setTimeout(() => (toast.hidden = true), 6000);
  }
  window.addEventListener("storage", (event) => {
    if (!event.key || event.key === key || event.key.includes("Events"))
      render();
  });
  window.addEventListener("focus", render);
  render();
})();
