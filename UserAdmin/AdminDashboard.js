import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, isFirebaseConfigured } from "../UserStudent/firebaseConfig.js";

(() => {
  "use strict";
  const profile = read("recovibeAdminProfile", null);
  const identity = localStorage.getItem("recovibeAdminId");
  if (
    !profile ||
    String(profile.role || "").toLowerCase() !== "admin" ||
    !identity
  ) {
    location.replace("AdminLogin.html");
    return;
  }
  const root = document.getElementById("dashboardRoot");
  let firestoreEvents = [];
  let unsubscribeEvents;
  let unsubscribeNotifications;
  let toastTimer;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
  }).format(new Date());
  const name =
    profile.name ||
    [profile.firstName, profile.middleName, profile.lastName]
      .filter(Boolean)
      .join(" ") ||
    identity;
  const lastName = profile.lastName || name.trim().split(/\s+/).at(-1) || name;
  const title = profile.title || "Administrator";
  document.getElementById("greeting").textContent =
    `${greeting()}, ${[title, lastName].filter(Boolean).join(" ")}!`;
  document.querySelector("[data-today]").textContent =
    new Date().toLocaleDateString("en-US", {
      timeZone: "Asia/Manila",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  document.querySelector("[data-name]").textContent = name.toUpperCase();
  document.querySelector("[data-role]").textContent =
    "Head of Academic Programs";
  document.querySelector("[data-avatar]").textContent = initials(name);
  document.querySelector(".admin-logout").addEventListener("click", () => {
    localStorage.removeItem("recovibeAdminId");
  });
  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
    } catch {
      return fallback;
    }
  }
  function greeting() {
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila",
        hour: "numeric",
        hourCycle: "h23",
      }).format(new Date()),
    );
    return hour < 12
      ? "Good Morning"
      : hour < 18
        ? "Good Afternoon"
        : "Good Evening";
  }
  function initials(value) {
    return (
      value
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "HA"
    );
  }
  function records() {
    return firestoreEvents;
  }
  function normalizeEvent(eventDocument) {
    const data = eventDocument.data();
    const eventDate = data.eventDate || data.dateISO || data.date || "";
    return {
      ...data,
      id: eventDocument.id,
      eventId: eventDocument.id,
      title: data.eventName || data.title || "Untitled event",
      date: eventDate,
      dateISO: eventDate,
      venue: data.venue || data.location || data.venueOther || "",
      location: data.venue || data.location || data.venueOther || "",
      organization: data.organization || data.organizerName || "",
      createdAt: data.createdAt?.toDate
        ? data.createdAt.toDate().toISOString()
        : data.createdAt || "",
    };
  }
  function statusOf(event) {
    const value = String(event.status || "")
      .toLowerCase()
      .replace(/[ -]+/g, "_");
    return value === "pending" ? "pending_approval" : value;
  }
  function openItems(events) {
    return events
      .flatMap((event) => {
        const status = statusOf(event);
        const issues = [];
        if (status === "pending_approval" || status === "pending")
          issues.push(
            hasConflict(event, events)
              ? { label: "Venue Conflict", type: "venue_conflict" }
              : { label: "Pending Approval", type: "pending_approval" },
          );
        if (status === "final_documents_submitted")
          issues.push({
            label: "Final Documents Submitted",
            type: "final_documents_submitted",
          });
        if (event.rescheduleRequest?.status === "pending")
          issues.push({
            label: "Reschedule Request",
            type: "reschedule_request",
          });
        if (
          (status === "cancelled" || status === "canceled") &&
          !(
            event.cancellation?.acknowledgedAt ||
            event.cancellation?.acknowledgedBy
          )
        )
          issues.push({ label: "Cancellation", type: "cancellation" });
        return issues.map((issue) => ({
          event,
          ...issue,
          at: event.submittedAt || event.createdAt || event.updatedAt || "",
        }));
      })
      .sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));
  }
  function hasConflict(event, all) {
    const date = (event.dateISO || event.date || "").slice(0, 10),
      venue = event.venue || event.location || "",
      parts = String(event.time || "").split(/\s*[-–]\s*/),
      mins = (value) => {
        const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(value || ""));
        return m
          ? ((Number(m[1]) % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0)) *
              60 +
              Number(m[2])
          : null;
      },
      start = mins(event.startTime || parts[0]),
      end = mins(event.endTime || parts[1]);
    if (
      !date ||
      !venue ||
      venue.startsWith("Others |") ||
      start === null ||
      end === null
    )
      return false;
    const rooms = [
      "AVR2-1Room | PUP Biñan",
      "AVR2-2Room | PUP Biñan",
      "AVR2-3Room | PUP Biñan",
    ];
    return all.some((other) => {
      if (
        other === event ||
        ["draft", "rejected", "cancelled", "canceled"].includes(
          statusOf(other),
        ) ||
        (other.dateISO || other.date || "").slice(0, 10) !== date
      )
        return false;
      const otherVenue = other.venue || other.location || "",
        same =
          venue === otherVenue ||
          (venue === "AVR2 | PUP Biñan" && rooms.includes(otherVenue)) ||
          (otherVenue === "AVR2 | PUP Biñan" && rooms.includes(venue));
      if (!same) return false;
      const range = String(other.time || "").split(/\s*[-–]\s*/),
        a = mins(other.startTime || range[0]),
        b = mins(other.endTime || range[1]);
      return a !== null && b !== null && start < b && end > a;
    });
  }
  function render() {
    try {
      root.innerHTML =
        '<div class="admin-metrics"></div><section class="admin-section"><div class="admin-section-heading"><div><h2>Event Submissions</h2><p class="admin-section-description"><strong>Source</strong> is the publishing channel, <strong>Category</strong> is the event topic, and <strong>EO (Event Organizer)</strong> is the responsible person or group. Organizer roles are shown beneath the EO.</p></div><a href="AdminApproval.html">Open Approval Queue</a></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th scope="col">Event</th><th scope="col">Source</th><th scope="col">Category</th><th scope="col">Event Organizer (EO)</th><th scope="col">Schedule</th><th scope="col">Venue</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody id="eventRows"></tbody></table></div><div id="eventsEmpty" class="admin-empty" hidden>No event submissions yet.</div></section>';
      const events = records();
      const all = openItems(events);
      const published = events.filter(
        (event) =>
          ["approved", "published"].includes(statusOf(event)) ||
          event.published === true,
      );
      const metrics = [
        [
          "Pending Approval",
          events.filter((e) =>
            ["pending_approval", "pending"].includes(statusOf(e)),
          ).length,
          "AdminApproval.html?filter=pending_approval",
        ],
        [
          "Finalization Pending",
          events.filter((e) => statusOf(e) === "final_documents_submitted")
            .length,
          "AdminApproval.html?filter=final_documents_submitted",
        ],
        [
          "Upcoming Events",
          published.filter(
            (e) => (e.dateISO || e.date || "").slice(0, 10) > today,
          ).length,
          "AdminAllEvents.html?status=Upcoming",
        ],
        [
          "Events Today",
          events.filter(
            (e) =>
              !["cancelled", "canceled"].includes(statusOf(e)) &&
              (e.dateISO || e.date || "").slice(0, 10) === today,
          ).length,
          "AdminAllEvents.html?status=Happening",
        ],
      ];
      root.querySelector(".admin-metrics").innerHTML = metrics
        .map(
          ([label, count, url]) =>
            `<a class="admin-metric" href="${url}"><strong>${count}</strong><span>${label}</span></a>`,
        )
        .join("");
      root.querySelector("#eventRows").innerHTML = events.map(eventRow).join("");
      root.querySelector("#eventsEmpty").hidden = events.length > 0;
      document.querySelector("[data-queue-count]").textContent = String(
        all.length,
      );
      document.querySelector("[data-queue-count]").hidden = !all.length;
    } catch (error) {
      root.innerHTML = `<div class="admin-error">Could not load dashboard data. <button class="admin-row-action" id="retryDashboard">Retry</button></div>`;
      root.querySelector("#retryDashboard").onclick = render;
    }
  }
  function eventRow(event) {
    const categories = event.categories || event.category || "General";
    const category = (Array.isArray(categories) ? categories : [categories])
      .map((value) =>
        typeof value === "object"
          ? value.name || value.title || value.label || ""
          : value,
      )
      .filter(Boolean)
      .join(", ") || "General";
    const source = normalizeSource(
      event.source ||
        event.eventSource ||
        event.organizationType,
      event._role,
    );
    const organizer =
      event.organizerName ||
      event.eventOrganizer ||
      event.organizer ||
      event.organization ||
      "—";
    const organizerRole =
      event.organizerRole ||
      event.eventOrganizerRole ||
      event.contactRole ||
      "";
    const pending = statusOf(event) === "pending_approval";
    const eventId = event.eventId || event.id;
    const scheduleDate = event.eventDate || event.dateISO || event.date || "Date TBA";
    const startTime = event.startTime || "Time TBA";
    const endTime = event.endTime || "Time TBA";
    return `<tr><td data-label="Event"><span class="admin-item-title">${esc(event.eventName || event.title || "Untitled event")}</span></td><td data-label="Source">${esc(source)}</td><td data-label="Category">${esc(category)}</td><td data-label="Event Organizer (EO)"><span class="admin-item-title">${esc(organizer)}</span>${organizerRole ? `<small class="admin-organizer-role">EO role: ${esc(organizerRole)}</small>` : ""}</td><td data-label="Schedule">${esc(scheduleDate)}<small>${esc(startTime)} - ${esc(endTime)}</small></td><td data-label="Venue">${esc(event.venue || "—")}</td><td data-label="Status"><span class="event-status">${esc(event.status || "Status unavailable")}</span></td><td data-label="Actions">${pending ? `<button class="admin-row-action event-decision approve" type="button" data-event-action="approve" data-event-id="${esc(eventId)}">Approve</button><button class="admin-row-action event-decision reject" type="button" data-event-action="reject" data-event-id="${esc(eventId)}">Reject</button>` : "—"}</td></tr>`;
  }
  function normalizeSource(value, role = "") {
    const source = String(value || "").trim().toLowerCase();
    if (!source && role === "Teacher") return "Teacher / Faculty";
    if (/\bcsc\b/.test(source)) return "CSC";
    if (/teacher|faculty/.test(source)) return "Teacher / Faculty";
    if (/ibits|organiz|event.?organizer/.test(source)) return "Organizational";
    if (/external|other/.test(source)) return "Others / External";
    if (/pup|campus|cite|polytechnic/.test(source)) return "PUP Official";
    return "Others / External";
  }
  function age(value) {
    if (!value) return "Submitted date unavailable";
    const days = Math.max(
      0,
      Math.floor((Date.now() - new Date(value).getTime()) / 86400000),
    );
    return `Submitted ${days ? `${days} day${days === 1 ? "" : "s"} ago` : "today"}`;
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
  function showToast(message) {
    const toast = document.querySelector(".admin-toast");
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast.hidden = true), 3200);
  }
  root.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-event-action]");
    if (!button) return;
    let changes;
    if (button.dataset.eventAction === "approve") {
      changes = { status: "Approved" };
    } else {
      const remarks = window.prompt("Enter remarks for requesting revisions:");
      if (remarks === null) return;
      if (!remarks.trim()) {
        showToast("Remarks are required to reject an event.");
        return;
      }
      changes = { status: "Needs Revision", decisionReason: remarks.trim() };
    }
    const rowButtons = button.parentElement.querySelectorAll("button");
    rowButtons.forEach((action) => (action.disabled = true));
    try {
      await updateDoc(doc(db, "events", button.dataset.eventId), changes);
      showToast(
        changes.status === "Approved" ? "Event approved." : "Revision requested.",
      );
    } catch (error) {
      console.error("Unable to update event status:", error);
      showToast("Could not update the event. Please try again.");
      rowButtons.forEach((action) => (action.disabled = false));
    }
  });
  window.addEventListener("storage", (event) => {
    if (
      !event.key ||
      (event.key.startsWith("recovibe") && event.key.endsWith("Events"))
    )
      render();
  });
  window.addEventListener("focus", render);
  window.addEventListener("recovibeAdminEventsChanged", render);
  function renderNotifications(snapshot) {
    const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    const unreadCount = items.filter((item) => item.isRead === false).length;
    document.querySelectorAll("[data-notification-count]").forEach((badge) => {
      badge.textContent = String(unreadCount);
      badge.hidden = unreadCount === 0;
    });
    const menu = document.querySelector("[data-notification-menu]");
    menu.innerHTML = `<div class="dashboard-notification-heading"><strong>Notifications</strong><a href="AdminNotification.html">View all</a></div>${
      items.length
        ? items
            .slice(0, 8)
            .map(
              (item) =>
                `<button type="button" class="dashboard-notification ${item.isRead === false ? "is-unread" : ""}" data-notification-id="${esc(item.id)}"><strong>${esc(item.title || "Notification")}</strong><span>${esc(item.message || "")}</span></button>`,
            )
            .join("")
        : '<p class="dashboard-notification-empty">No notifications yet.</p>'
    }`;
  }
  function init() {
    if (!isFirebaseConfigured || !db) {
      root.innerHTML =
        '<div class="admin-error">Event data is unavailable. Please contact support.</div>';
      return;
    }
    root.innerHTML = '<div class="admin-loading">Loading event activity…</div>';
    unsubscribeEvents = onSnapshot(
      query(collection(db, "events"), orderBy("createdAt", "desc")),
      (snapshot) => {
        firestoreEvents = snapshot.docs.map(normalizeEvent);
        render();
      },
      (error) => {
        console.error("Unable to load dashboard events:", error);
        root.innerHTML = `<div class="admin-error">Could not load dashboard events. ${esc(error.message || "Please try again later.")}</div>`;
      },
    );
    unsubscribeNotifications = onSnapshot(
      query(collection(db, "notifications"), where("recipientRole", "==", "admin")),
      renderNotifications,
      (error) => {
        console.error("Unable to load admin notifications:", error);
        document.querySelector("[data-notification-menu]").innerHTML =
          '<p class="dashboard-notification-empty">Notifications are unavailable.</p>';
      },
    );
  }
  const notificationToggle = document.querySelector("[data-notification-toggle]");
  notificationToggle.addEventListener("click", () => {
    const menu = document.querySelector("[data-notification-menu]");
    menu.hidden = !menu.hidden;
    notificationToggle.setAttribute("aria-expanded", String(!menu.hidden));
  });
  document.addEventListener("click", async (event) => {
    const item = event.target.closest("[data-notification-id]");
    if (item) {
      if (item.classList.contains("is-unread")) {
        try {
          await updateDoc(doc(db, "notifications", item.dataset.notificationId), {
            isRead: true,
          });
        } catch (error) {
          console.error("Unable to mark notification as read:", error);
        }
      }
      document.querySelector("[data-notification-menu]").hidden = true;
      notificationToggle.setAttribute("aria-expanded", "false");
      return;
    }
    if (!event.target.closest(".dashboard-notifications")) {
      document.querySelector("[data-notification-menu]").hidden = true;
      notificationToggle.setAttribute("aria-expanded", "false");
    }
  });
  window.addEventListener("beforeunload", () => {
    unsubscribeEvents?.();
    unsubscribeNotifications?.();
  });
  init();
})();
