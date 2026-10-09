import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, isFirebaseConfigured } from "../UserStudent/firebaseConfig.js";

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
  const root = document.getElementById("approvalRoot");
  let pending = false;
  let opened = [];
  let timer;
  let firestoreEvents = [];
  let unsubscribeEvents;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
  }).format(new Date());
  document.querySelector("[data-name]").textContent = (
    profile.name || identity
  ).toUpperCase();
  document.querySelector("[data-avatar]").textContent = (profile.name || "HA")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
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
  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
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
  function normalized(event) {
    const value = String(event.status || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
    return value === "pending" ? "pending_approval" : value;
  }
  function events() {
    return firestoreEvents;
  }
  function normalizeEvent(eventDocument) {
    const data = eventDocument.data();
    const contact = data.contactPerson || {};
    const eventDate = data.eventDate || data.dateISO || data.date || "";
    const createdAt = data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : data.createdAt || "";
    const startTime = data.startTime || "";
    const endTime = data.endTime || "";
    return {
      ...data,
      id: eventDocument.id,
      eventId: eventDocument.id,
      title: data.eventName || data.title || "Untitled event",
      eventName: data.eventName || data.title || "Untitled event",
      date: eventDate,
      dateISO: eventDate,
      startTime,
      endTime,
      time:
        data.time || [startTime, endTime].filter(Boolean).join(" - ") || "Time TBA",
      venue: data.venue || data.location || data.venueOther || "",
      location: data.venue || data.location || data.venueOther || "",
      organization: data.organization || data.organizerName || "",
      source: data.source || data.eventSource || "Event Organizer",
      description:
        data.eventDescription || data.description || data.desc || "",
      contactPerson: {
        ...contact,
        name: contact.name || data.contactName || "",
        role: contact.role || data.contactRole || "",
        email: contact.email || data.contactEmail || "",
        phone:
          contact.contactNumber ||
          contact.phone ||
          data.contactPhone ||
          "",
      },
      createdAt,
      _role: "Event Organizer",
    };
  }
  function minutes(value) {
    const text = String(value || "").trim();
    let match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(text);
    if (match)
      return (
        ((Number(match[1]) % 12) + (match[3].toUpperCase() === "PM" ? 12 : 0)) *
          60 +
        Number(match[2])
      );
    match = /^(\d{1,2}):(\d{2})$/.exec(text);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  }
  function range(event) {
    const parts = String(event.time || "").split(/\s*[-–]\s*/);
    return [
      minutes(event.startTime || parts[0]),
      minutes(event.endTime || parts[1]),
    ];
  }
  function venueSame(a, b) {
    if (a === b) return true;
    const rooms = [
      "AVR2-1Room | PUP Biñan",
      "AVR2-2Room | PUP Biñan",
      "AVR2-3Room | PUP Biñan",
    ];
    return (
      (a === "AVR2 | PUP Biñan" && rooms.includes(b)) ||
      (b === "AVR2 | PUP Biñan" && rooms.includes(a))
    );
  }
  function conflictsFor(event, schedule) {
    const date = (schedule.date || event.dateISO || event.date || "").slice(
        0,
        10,
      ),
      venue = schedule.venue || event.venue || event.location || "",
      parts = String(event.time || "").split(/\s*[-–]\s*/),
      start = minutes(schedule.startTime || event.startTime || parts[0]),
      end = minutes(schedule.endTime || event.endTime || parts[1]);
    if (
      !date ||
      !venue ||
      venue.startsWith("Others |") ||
      start === null ||
      end === null
    )
      return [];
    return events().filter((other) => {
      const id = String(other.eventId || other.id || "");
      if (id === String(event.eventId || event.id)) return false;
      if (
        ["draft", "rejected", "cancelled", "canceled"].includes(
          normalized(other),
        )
      )
        return false;
      if (
        (other.dateISO || other.date || "").slice(0, 10) !== date ||
        !venueSame(venue, other.venue || other.location || "")
      )
        return false;
      const [otherStart, otherEnd] = range(other);
      return (
        otherStart !== null &&
        otherEnd !== null &&
        start < otherEnd &&
        end > otherStart
      );
    });
  }
  function issueList() {
    return events()
      .flatMap((event) => {
        const status = normalized(event);
        const found = [];
        const schedule = {
          date: event.dateISO || event.date,
          venue: event.venue || event.location,
          startTime: event.startTime,
          endTime: event.endTime,
        };
        const conflict = conflictsFor(event, schedule);
        if (status === "pending_approval" || status === "pending")
          found.push({
            type: conflict.length ? "venue_conflict" : "pending_approval",
            label: conflict.length ? "Venue Conflict" : "Pending Approval",
            at: event.submittedAt || event.createdAt || "",
          });
        if (status === "final_documents_submitted")
          found.push({
            type: "final_documents_submitted",
            label: "Final Documents Submitted",
            at: event.updatedAt || event.submittedAt || "",
          });
        if (event.rescheduleRequest?.status === "pending")
          found.push({
            type: "reschedule_request",
            label: "Reschedule Request",
            at: event.rescheduleRequest.requestedAt || "",
          });
        if (
          ["cancelled", "canceled"].includes(status) &&
          !(
            event.cancellation?.acknowledgedAt ||
            event.cancellation?.acknowledgedBy
          )
        )
          found.push({
            type: "cancellation",
            label: "Cancellation",
            at: event.cancellation?.cancelledAt || event.updatedAt || "",
          });
        if (!found.length)
          found.push({
            type: "submission",
            label: event.status || "Status unavailable",
            at: event.createdAt || "",
          });
        return found.map((issue) => ({ ...issue, event }));
      })
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  }
  function metricMarkup(list) {
    const all = events();
    const published = all.filter(
      (e) =>
        ["approved", "published"].includes(normalized(e)) ||
        e.published === true,
    );
    const metrics = [
      [
        "Pending Approval",
        all.filter((e) =>
          ["pending_approval", "pending"].includes(normalized(e)),
        ).length,
        "pending_approval",
      ],
      [
        "Finalization Pending",
        all.filter((e) => normalized(e) === "final_documents_submitted").length,
        "final_documents_submitted",
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
        all.filter(
          (e) =>
            !["cancelled", "canceled"].includes(normalized(e)) &&
            (e.dateISO || e.date || "").slice(0, 10) === today,
        ).length,
        "AdminAllEvents.html?status=Happening",
      ],
    ];
    return `<div class="admin-metrics">${metrics.map(([label, count, target]) => `<a class="admin-metric" href="${target.startsWith("Admin") ? target : `AdminApproval.html?filter=${target}`}" ${target.startsWith("Admin") ? "" : 'data-queue-filter="' + target + '"'}><strong>${count}</strong><span>${label}</span></a>`).join("")}</div>`;
  }
  function organizer(event) {
    return (
      event.organization ||
      (event._role === "Teacher"
        ? `Teacher - ${event.organizer || event.organizerName || "Teacher"}`
        : event.organizer || event.organizerName || "Event Organizer")
    );
  }
  function age(value) {
    if (!value) return "Submitted date unavailable";
    const days = Math.max(
      0,
      Math.floor((Date.now() - new Date(value).getTime()) / 86400000),
    );
    return `Submitted ${days ? `${days} day${days === 1 ? "" : "s"} ago` : "today"}`;
  }
  function render() {
    try {
      const params = new URLSearchParams(location.search);
      const filter = params.get("filter") || "";
      const query = params.get("q") || "";
      const all = issueList();
      const selected = all.filter(
        (item) =>
          (!filter ||
            (filter === "pending_approval"
              ? ["pending_approval", "venue_conflict"].includes(item.type)
              : item.type === filter)) &&
          (!query ||
            `${item.event.title} ${organizer(item.event)} ${item.label}`
              .toLowerCase()
              .includes(query.toLowerCase())),
      );
      root.innerHTML = `${metricMarkup(all)}<section class="admin-section"><div class="queue-toolbar"><input class="admin-search" id="queueSearch" type="search" value="${esc(query)}" placeholder="Search by event, organizer or issue" aria-label="Search by event, organizer or issue">${filter ? `<span class="queue-filter-chip">${esc(filter.replaceAll("_", " "))}<button type="button" id="clearQueueFilter" aria-label="Clear filter">×</button></span>` : ""}</div><div class="admin-section-heading"><h2>Event Submissions <span class="admin-chip">${selected.length}</span></h2></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th scope="col">Event</th><th scope="col">Organizer</th><th scope="col">Issue</th><th scope="col">Actions</th></tr></thead><tbody>${selected.map((item) => `<tr><td data-label="Event"><span class="queue-item-title">${esc(item.event.title || "Untitled event")}</span><small>${esc((item.event.categories || item.event.category || item.event.eventType || "General").toString().split(",")[0])}</small></td><td data-label="Organizer">${esc(organizer(item.event))}</td><td data-label="Issue">${esc(item.label)}<span class="issue-age">${age(item.at)}</span></td><td data-label="Actions"><button class="admin-row-action" type="button" data-review="${esc(item.event.eventId || item.event.id)}" data-issue="${item.type}">Review</button></td></tr>`).join("")}</tbody></table></div>${selected.length ? "" : `<div class="admin-empty">${all.length ? "No submissions match this filter." : "No event submissions yet."}</div>`}</section>`;
      const table = root.querySelector(".admin-table");
      const header = table?.querySelector("thead tr");
      if (header) {
        header.innerHTML =
          "<th scope=\"col\">Event</th><th scope=\"col\">Organization</th><th scope=\"col\">Schedule</th><th scope=\"col\">Venue</th><th scope=\"col\">Contact</th><th scope=\"col\">Status</th><th scope=\"col\">Issue</th><th scope=\"col\">Actions</th>";
      }
      table?.querySelectorAll("tbody tr").forEach((row) => {
        const reviewButton = row.querySelector("[data-review]");
        const item = selected.find(
          (entry) =>
            String(entry.event.eventId || entry.event.id) ===
            reviewButton?.dataset.review,
        );
        if (!item) return;
        const event = item.event;
        row.cells[1].dataset.label = "Organization";
        const issueCell = row.cells[2];
        const date = event.eventDate || event.dateISO || event.date || "Date TBA";
        const time =
          event.time ||
          [event.startTime, event.endTime].filter(Boolean).join(" - ") ||
          "Time TBA";
        const venue = event.venue || event.location || event.venueOther || "Venue TBA";
        const contact = event.contactPerson || {};
        const scheduleCell = document.createElement("td");
        scheduleCell.dataset.label = "Schedule";
        scheduleCell.textContent = `${date} · ${time}`;
        const venueCell = document.createElement("td");
        venueCell.dataset.label = "Venue";
        venueCell.textContent = venue;
        const contactCell = document.createElement("td");
        contactCell.dataset.label = "Contact";
        contactCell.textContent = [
          contact.name || event.contactName,
          contact.email || event.contactEmail,
          contact.contactNumber || contact.phone || event.contactPhone,
        ]
          .filter(Boolean)
          .join(" · ") || "Not provided";
        const statusCell = document.createElement("td");
        statusCell.dataset.label = "Status";
        statusCell.textContent = event.status || "Status unavailable";
        row.insertBefore(scheduleCell, issueCell);
        row.insertBefore(venueCell, issueCell);
        row.insertBefore(contactCell, issueCell);
        row.insertBefore(statusCell, issueCell);
        if (["pending_approval", "pending"].includes(normalized(event))) {
          const actions = row.cells[row.cells.length - 1];
          [
            ["Approved", "Approve", "approve"],
            ["Needs Revision", "Reject", "reject"],
          ].forEach(([status, label, decision]) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `admin-row-action approval-decision ${decision}`;
            button.dataset.decision = status;
            button.dataset.eventId = String(event.eventId || event.id);
            button.textContent = label;
            button.addEventListener("click", () => decide(button));
            actions.append(button);
          });
        }
      });
      const total = all.length;
      document.querySelector("[data-queue-count]").textContent = String(total);
      document.querySelector("[data-queue-count]").hidden = !total;
      root.querySelector("#queueSearch").addEventListener("input", (event) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const next = new URL(location.href);
          if (event.target.value)
            next.searchParams.set("q", event.target.value);
          else next.searchParams.delete("q");
          history.replaceState({}, "", next);
          renderKeepFocus(event.target.value);
        }, 300);
      });
      root.querySelector("#clearQueueFilter")?.addEventListener("click", () => {
        const next = new URL(location.href);
        next.searchParams.delete("filter");
        history.replaceState({}, "", next);
        render();
      });
      root.querySelectorAll("[data-queue-filter]").forEach((card) =>
        card.addEventListener("click", (event) => {
          event.preventDefault();
          const next = new URL(location.href);
          next.searchParams.set("filter", card.dataset.queueFilter);
          history.pushState({}, "", next);
          render();
        }),
      );
      root
        .querySelectorAll("[data-review]")
        .forEach((button) =>
          button.addEventListener("click", () =>
            openReview(button.dataset.review, button.dataset.issue),
          ),
        );
    } catch (error) {
      root.innerHTML = `<div class="admin-error">Could not load the approval queue. <button class="admin-row-action" id="retryQueue">Retry</button></div>`;
      root.querySelector("#retryQueue").onclick = render;
    }
  }
  function renderKeepFocus(query) {
    render();
    const input = root.querySelector("#queueSearch");
    input?.focus();
    input?.setSelectionRange(query.length, query.length);
  }
  async function decide(button) {
    const eventId = button.dataset.eventId;
    const status = button.dataset.decision;
    const actions = button.parentElement.querySelectorAll("button");
    actions.forEach((action) => (action.disabled = true));
    try {
      await updateDoc(doc(db, "events", eventId), {
        status,
        updatedAt: serverTimestamp(),
      });
      toast(status === "Approved" ? "Event approved." : "Revision requested.");
    } catch (error) {
      console.error("Unable to update event status:", error);
      toast("Could not update the event. Please try again.");
      actions.forEach((action) => (action.disabled = false));
    }
  }
  function findEvent(id) {
    return events().find(
      (item) => String(item.eventId || item.id) === String(id),
    );
  }
  function openReview(id, type) {
    let event = findEvent(id);
    if (!event) {
      toast("This item was already handled.");
      render();
      return;
    }
    const conflicts = conflictsFor(event, {
      date: event.dateISO || event.date,
      venue: event.venue || event.location,
      startTime: event.startTime,
      endTime: event.endTime,
    });
    if (type === "venue_conflict" && !conflicts.length)
      type = "pending_approval";
    const layer = document.createElement("div");
    layer.className = "admin-modal-backdrop";
    layer.dataset.layer = "details";
    layer.innerHTML = `<section class="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="reviewTitle" tabindex="-1"><button class="admin-close" type="button" aria-label="Close review">×</button><h2 id="reviewTitle">${esc(event.title || "Event review")}</h2>${type === "venue_conflict" && conflicts.length ? `<div class="admin-warning"><strong>Venue conflict</strong>${conflicts.map((other) => `<p>${esc(other.title)} · ${esc(other.venue || other.location)} · ${esc(other.time || `${other.startTime || ""} - ${other.endTime || ""}`)} · ${esc(other.status)}</p>`).join("")}</div>` : ""}<div class="review-details"><p><strong>Organizer:</strong> ${esc(organizer(event))}</p><p><strong>Source:</strong> ${esc(event.source || "")}</p><p><strong>Date / Time:</strong> ${esc(event.dateISO || event.date || "")} · ${esc(event.time || `${event.startTime || ""} - ${event.endTime || ""}`)}</p><p><strong>Venue:</strong> ${esc(event.venueOther || event.location || event.venue || "")}</p><p><strong>Categories:</strong> ${esc((event.categories || event.category || "").toString())}</p><p>${esc(event.description || event.desc || "")}</p><p><strong>Contact:</strong> ${esc(event.contactPerson?.name || event.contactName || "")} · ${esc(event.contactPerson?.email || event.contactEmail || "")} · ${esc(event.contactPerson?.phone || event.contactPhone || "")}</p><div class="review-docs"><div><strong>Participant Documents</strong>${fileList(event.participantDocuments || event.attachments)}</div><div><strong>Approval Documents</strong>${fileList(event.approvalDocuments || event.finalDocuments)}</div></div></div><div class="admin-dialog-actions" id="reviewActions"></div></section>`;
    document.body.append(layer);
    opened.push(layer);
    layer.querySelector(".admin-close").onclick = () => closeTop();
    layer.addEventListener("click", (event) => {
      if (event.target === layer && !pending) closeTop();
    });
    const actions = layer.querySelector("#reviewActions");
    if (type === "pending_approval" || type === "venue_conflict") {
      actions.innerHTML = `<button class="admin-button green" data-action="approve" ${conflicts.length ? 'disabled title="Resolve the venue conflict first"' : ""}>Approve</button><button class="admin-button" data-action="reject">Reject</button>`;
      actions.querySelector("[data-action=approve]").onclick = () =>
        confirmLayer(
          "Approve Event?",
          "You are about to approve this event. Once approved, it will proceed to the next stage of the event approval process.",
          "Approve Event",
          () =>
            transition(
              event,
              "pending_approval",
              "Approved",
              "approved",
            ),
        );
      actions.querySelector("[data-action=reject]").onclick = () =>
        reasonLayer(
          event,
          "pending_approval",
          "Needs Revision",
          "Reject Event",
          "Please provide a reason for rejecting this event. This reason will be sent to the Event Organizer so they can review the issue and make the necessary changes.",
          "Reject Event",
          "Reject This Event?",
          "This event will be marked as rejected and the Event Organizer will be notified of the reason provided.",
          "Reject Event",
          "Event Rejected",
          "The event has been successfully rejected. The Event Organizer will be notified and can review the reason for rejection.",
          "rejectionReason",
        );
    } else if (type === "final_documents_submitted") {
      actions.innerHTML =
        '<button class="admin-button green" data-action="finalReview">Review Documents</button>';
      actions.querySelector("button").onclick = () => finalReview(event);
    } else if (type === "reschedule_request") {
      actions.innerHTML =
        '<button class="admin-button green" data-action="reschedule">Check Requested Changes</button>';
      actions.querySelector("button").onclick = () => rescheduleReview(event);
    } else if (type === "cancellation") {
      layer.querySelector("#reviewTitle").textContent = "Event Cancelled";
      layer.querySelector(".review-details").innerHTML =
        `<p><strong>Event Name:</strong> ${esc(event.title || "Untitled event")}</p><p><strong>Cancelled by:</strong> ${esc(event.cancellation?.cancelledByName || event.cancellation?.cancelledBy || organizer(event))} (${esc(event.cancellation?.cancelledByRole || event._role)})</p><div class="admin-field"><label for="cancelReason">Reason for Cancellation:</label><textarea id="cancelReason" readonly>${esc(event.cancellation?.reason || "No reason provided.")}</textarea></div>`;
      actions.innerHTML =
        '<button class="admin-button" data-action="acknowledge">Back</button>';
      actions.querySelector("button").onclick = () => acknowledge(event);
    }
    layer.querySelector(".admin-dialog").focus();
  }
  function fileList(items) {
    const list = Array.isArray(items) ? items : items ? [items] : [];
    return list.length
      ? `<ul>${list.map((file) => `<li><button class="admin-doc-link" type="button" data-file="${esc(file.fileId || file.id || "")}" data-name="${esc(file.name || file.fileName || file.title || file)}">${esc(file.name || file.fileName || file.title || file)} <span aria-hidden="true">↓</span></button></li>`).join("")}</ul>`
      : "<p>No documents attached.</p>";
  }
  function confirmLayer(title, message, yes, callback, extra = "") {
    const layer = document.createElement("div");
    layer.className = "admin-modal-backdrop";
    layer.dataset.layer = "confirm";
    layer.innerHTML = `<section class="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="confirmTitle" tabindex="-1"><button class="admin-close" type="button" aria-label="Close confirmation">×</button><h2 id="confirmTitle">${esc(title)}</h2><p>${esc(message)}</p>${extra}<p class="admin-inline-error" role="alert"></p><div class="admin-dialog-actions"><button class="admin-button green" type="button" data-confirm>${esc(yes)}</button><button class="admin-button" type="button" data-cancel>Cancel</button></div></section>`;
    document.body.append(layer);
    opened.push(layer);
    layer.querySelector(".admin-dialog").focus();
    layer.querySelector("[data-cancel]").onclick = () => closeTop();
    layer.querySelector(".admin-close").onclick = () => closeTop();
    layer.addEventListener("click", (event) => {
      if (event.target === layer && !pending) closeTop();
    });
    layer.querySelector("[data-confirm]").onclick = () =>
      runAction(layer, callback);
  }
  function reasonLayer(
    event,
    expected,
    next,
    label,
    intro,
    continueText,
    confirmTitle,
    confirmMessage,
    confirmText,
    successTitle,
    successText,
    field,
  ) {
    const layer = document.createElement("div");
    layer.className = "admin-modal-backdrop";
    layer.dataset.layer = "reason";
    const reasonLabel =
      field === "rescheduleReason"
        ? "Reason for Reschedule:"
        : "Reason for Rejection:";
    layer.innerHTML = `<section class="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="reasonTitle" tabindex="-1"><button class="admin-close" type="button" aria-label="Close">×</button><h2 id="reasonTitle">${esc(label)}</h2><p>${esc(intro)}</p><div class="admin-field"><label for="decisionReason">${reasonLabel}</label><textarea id="decisionReason" maxlength="500" required></textarea><small class="reason-count">Characters: 0/500</small></div><p class="admin-inline-error" role="alert"></p><div class="admin-dialog-actions"><button class="admin-button green" type="button" data-continue disabled>${esc(continueText)}</button><button class="admin-button" type="button" data-cancel>Cancel</button></div></section>`;
    document.body.append(layer);
    opened.push(layer);
    const area = layer.querySelector("textarea"),
      button = layer.querySelector("[data-continue]");
    layer.querySelector(".admin-dialog").focus();
    area.focus();
    area.addEventListener("input", () => {
      const text = area.value.trim();
      layer.querySelector(".reason-count").textContent =
        `Characters: ${area.value.length}/500`;
      button.disabled = !text;
    });
    layer
      .querySelectorAll(".admin-close,[data-cancel]")
      .forEach((item) => (item.onclick = () => closeTop()));
    layer.addEventListener("click", (e) => {
      if (e.target === layer && !pending) closeTop();
    });
    button.onclick = () => {
      const reason = area.value.trim();
      if (!reason || reason.length > 500) return;
      closeTop();
      const rejection = field === "rejectionReason";
      confirmLayer(
        confirmTitle,
        confirmMessage,
        confirmText,
        () =>
          transition(
            event,
            expected,
            next,
            "rejected",
            reason,
            field,
            successTitle,
            successText,
          ),
        rejection
          ? "<p><strong>Are you sure you want to reject this event?</strong></p>"
          : "",
      );
    };
  }
  function finalReview(event) {
    const layer = document.createElement("div");
    layer.className = "admin-modal-backdrop";
    layer.dataset.layer = "final-review";
    const files = event.finalDocuments || event.approvalDocuments || [];
    layer.innerHTML = `<section class="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="finalReviewTitle" tabindex="-1"><button class="admin-close" type="button" aria-label="Close final document review">×</button><h2 id="finalReviewTitle">Review Final Documents</h2><p>The Event Organizer has submitted the final documents for this event. Please review all submitted documents before proceeding.</p><strong>Approval Documents:</strong>${fileList(files)}<p class="admin-inline-error" role="alert"></p><div class="admin-dialog-actions"><button class="admin-button green" type="button" data-final-approve>Approve Finalization</button><button class="admin-button" type="button" data-final-reject>Reject Final Documents</button></div></section>`;
    document.body.append(layer);
    opened.push(layer);
    layer.querySelector(".admin-close").onclick = () => closeTop();
    layer.addEventListener("click", (e) => {
      if (e.target === layer && !pending) closeTop();
    });
    layer.querySelector("[data-final-approve]").onclick = () =>
      confirmLayer(
        "Approve Event?",
        "You are about to approve this event. Once approved, the event will be ready to proceed to the publishing stage.",
        "Approve Event",
        () =>
          transition(
            event,
            "final_documents_submitted",
            "ready_to_publish",
            "final_documents_approved",
            null,
            null,
            "Final Documents Approved",
            "The final documents have been reviewed and approved.",
          ),
      );
    layer.querySelector("[data-final-reject]").onclick = () =>
      reasonLayer(
        event,
        "final_documents_submitted",
        "awaiting_final_documents",
        "Reject Final Documents",
        "The submitted documents do not meet the requirements. Please provide a reason for rejection so the Event Organizer can make the necessary corrections.",
        "Continue",
        "Reject Final Documents?",
        "The Event Organizer will be notified of the rejection and the reason provided. The documents will need to be corrected and resubmitted.",
        "Reject Documents",
        "Final Documents Rejected",
        "The final documents have been rejected successfully. The Event Organizer has been notified of the reason for rejection.",
        "finalDocumentsRejection",
      );
  }
  function rescheduleReview(event) {
    const request = event.rescheduleRequest || {},
      requested = request.requested || {},
      conflicts = conflictsFor(event, requested);
    const deadline = event.registrationDeadline
      ? new Date(String(event.registrationDeadline).replace(/\+08:00$/, ""))
      : null;
    const start = localDateTime(requested.date, requested.startTime);
    const deadlineWarning = deadline && start && start < deadline;
    const layer = document.createElement("div");
    layer.className = "admin-modal-backdrop";
    layer.dataset.layer = "reschedule";
    layer.innerHTML = `<section class="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="rescheduleTitle" tabindex="-1"><button class="admin-close" type="button" aria-label="Close reschedule review">×</button><h2 id="rescheduleTitle">Reschedule Request</h2><div class="admin-schedule-columns"><div><strong>Current Schedule</strong><p>Date: ${esc(event.dateISO || event.date || "")}</p><p>Venue: ${esc(event.venue || event.location || "")}</p><p>Time Start: ${esc(event.startTime || "")}</p><p>Time End: ${esc(event.endTime || "")}</p></div><div><strong>Requested Schedule</strong><p>Date: ${esc(requested.date || "")}</p><p>Venue: ${esc(requested.venue || "")}</p><p>Time Start: ${esc(requested.startTime || "")}</p><p>Time End: ${esc(requested.endTime || "")}</p></div></div><p><strong>Reason for Reschedule:</strong> ${esc(request.reason || "")}</p>${conflicts.length ? `<div class="admin-warning">Conflicts with ${conflicts.map((item) => esc(item.title)).join(", ")}. Resolve the venue conflict first.</div>` : ""}${deadlineWarning ? '<p class="admin-warning">The requested start is before the registration deadline; approval will move the deadline to the new start time.</p>' : ""}<p class="admin-inline-error" role="alert"></p><div class="admin-dialog-actions"><button class="admin-button green" type="button" data-rs-approve ${conflicts.length ? 'disabled title="Resolve the venue conflict first"' : ""}>Approve Request</button><button class="admin-button" type="button" data-rs-reject>Reject Request</button></div></section>`;
    document.body.append(layer);
    opened.push(layer);
    layer.querySelector(".admin-close").onclick = () => closeTop();
    layer.addEventListener("click", (e) => {
      if (e.target === layer && !pending) closeTop();
    });
    layer.querySelector("[data-rs-approve]").onclick = () =>
      confirmLayer(
        "Approve Reschedule Request?",
        "You are about to approve the requested changes to this event. The event schedule will be updated once approved.",
        "Approve Request",
        () => approveReschedule(event, requested, Boolean(deadlineWarning)),
      );
    layer.querySelector("[data-rs-reject]").onclick = () =>
      reasonLayer(
        event,
        normalized(event),
        normalized(event),
        "Reject Reschedule Request",
        "Please provide a reason for rejecting this reschedule request. The reason will be sent to the Event Organizer.",
        "Reject Request",
        "Reject Reschedule Request?",
        "You are about to reject the requested changes to this event. The event schedule will not be updated.",
        "Reject Request",
        "Reschedule Request Rejected",
        "The reschedule request has been rejected successfully. The Event Organizer has been notified of the reason for rejection.",
        "rescheduleReason",
      );
  }
  function localDateTime(date, time) {
    if (!date || !time) return null;
    const mins = minutes(time);
    if (mins === null) return null;
    return new Date(
      `${date}T${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}:00+08:00`,
    );
  }
  function approveReschedule(event, requested, movedDeadline) {
    const current = findEvent(event.eventId || event.id);
    if (!isAdmin())
      return Promise.reject(new Error("Admin authorization required."));
    if (!current || current.rescheduleRequest?.status !== "pending")
      return stale();
    const conflict = conflictsFor(current, requested);
    if (conflict.length)
      return Promise.reject(
        new Error(`Venue conflict with ${conflict[0].title}.`),
      );
    const oldSchedule = {
      date: current.dateISO || current.date,
      venue: current.venue || current.location,
      startTime: current.startTime,
      endTime: current.endTime,
    };
    const expected = normalized(current);
    const changes = {
      date: requested.date,
      dateISO: requested.date,
      venue: requested.venue,
      location: requested.venue,
      startTime: requested.startTime,
      endTime: requested.endTime,
      time: `${requested.startTime} - ${requested.endTime}`,
      isRescheduled: true,
      rescheduleRequest: {
        ...current.rescheduleRequest,
        status: "approved",
        decisionReason: "",
      },
    };
    if (movedDeadline) {
      const start = minutes(requested.startTime);
      changes.registrationDeadline = `${requested.date}T${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}:00+08:00`;
    }
    return transition(
      current,
      expected,
      expected,
      "reschedule_approved",
      null,
      null,
      "Reschedule Request Approved",
      `The event has been successfully rescheduled.${movedDeadline ? " The registration deadline was moved to the new start time." : ""} The Event Organizer will be notified of the updated event schedule.`,
      {
        ...changes,
        reviewHistory: [
          ...(current.reviewHistory || []),
          history("reschedule_approved", oldSchedule),
        ],
      },
      `Moved from ${oldSchedule.date} ${oldSchedule.startTime || ""} at ${oldSchedule.venue} to ${requested.date} ${requested.startTime} at ${requested.venue}.`,
    );
  }
  async function acknowledge(event) {
    const current = findEvent(event.eventId || event.id);
    if (!isAdmin()) return;
    if (
      !current ||
      (normalized(current) !== "cancelled" &&
        normalized(current) !== "canceled") ||
      current.cancellation?.acknowledgedAt
    ) {
      stale();
      return;
    }
    const changed = await casUpdate(current, normalized(current), (next) => ({
      ...next,
      cancellation: {
        ...next.cancellation,
        acknowledgedBy: identity,
        acknowledgedAt: new Date().toISOString(),
      },
      reviewHistory: [
        ...(next.reviewHistory || []),
        history("cancellation_acknowledged"),
      ],
    }));
    if (!changed) {
      stale();
      return;
    }
    closeAll();
    toast("Cancellation acknowledged.");
    render();
  }
  async function transition(
    event,
    expected,
    next,
    action,
    reason,
    reasonField,
    successTitle,
    successText,
    overrides = {},
    message,
  ) {
    if (!isAdmin())
      return Promise.reject(new Error("Admin authorization required."));
    const latest = findEvent(event.eventId || event.id);
    if (!latest || normalized(latest) !== expected) return stale();
    if (
      expected === "pending_approval" &&
      next === "awaiting_final_documents" &&
      conflictsFor(latest, {
        date: latest.dateISO || latest.date,
        venue: latest.venue || latest.location,
        startTime: latest.startTime,
        endTime: latest.endTime,
      }).length
    )
      return Promise.reject(
        new Error("Venue conflict remains. Resolve it before approval."),
      );
    const changes = {
      ...overrides,
      status: next,
      updatedAt: new Date().toISOString(),
      submittedAt:
        next === "pending_approval"
          ? new Date().toISOString()
          : latest.submittedAt,
      reviewHistory: [...(latest.reviewHistory || []), history(action, reason)],
    };
    if (reasonField === "rejectionReason") changes.rejectionReason = reason;
    if (reasonField === "finalDocumentsRejection")
      changes.finalDocumentsRejection = {
        reason,
        by: identity,
        at: new Date().toISOString(),
      };
    if (reasonField === "rescheduleReason")
      changes.rescheduleRequest = {
        ...latest.rescheduleRequest,
        status: "rejected",
        decisionReason: reason,
      };
    const success = await casUpdate(latest, expected, (item) => ({
      ...item,
      ...changes,
    }));
    if (!success) return stale();
    notify(success, action, reason, message);
    return showSuccess(successTitle, successText);
  }
  async function casUpdate(event, expected, mutate) {
    if (!isAdmin() || normalized(event) !== expected) return null;
    const updated = mutate({ ...event });
    const changes = {};
    Object.entries(updated).forEach(([key, value]) => {
      if (["id", "eventId", "_role", "_store", "createdAt"].includes(key))
        return;
      if (JSON.stringify(value) !== JSON.stringify(event[key]))
        changes[key] = value;
    });
    changes.updatedAt = serverTimestamp();
    await updateDoc(
      doc(db, "events", String(event.eventId || event.id)),
      changes,
    );
    return { ...updated, _role: event._role };
  }
  function history(action, reason) {
    return {
      action,
      by: identity,
      at: new Date().toISOString(),
      ...(reason ? { reason } : {}),
    };
  }
  function stale() {
    toast("This item was already handled.");
    closeAll();
    render();
    return Promise.resolve(null);
  }
  function isAdmin() {
    const current = read("recovibeAdminProfile", null);
    return Boolean(
      current &&
      String(current.role || "").toLowerCase() === "admin" &&
      localStorage.getItem("recovibeAdminId") === identity,
    );
  }
  function notify(event, action, reason, message) {
    const now = new Date().toISOString(),
      id = String(event.eventId || event.id);
    const target =
      event._role === "Teacher"
        ? "recovibeTeacherNotifications"
        : "recovibeOrganizerNotifications";
    const list = read(target, []);
    list.unshift({
      id: `admin-${action}-${id}-${Date.now()}`,
      title: action.includes("reject") ? "Event Update" : "Event Update",
      message:
        message ||
        `Your event “${event.title}” was updated by the Head of Academic Programs. ${reason ? `Reason: ${reason}` : ""}`,
      time: new Date().toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Manila",
      }),
      createdAt: now,
      eventId: id,
      eventTitle: event.title,
      eventStatus: event.status || (action.includes("reject") ? "Needs Revision" : "Approved"),
      reason,
      read: false,
      type: action.includes("reject") ? "red" : "green",
    });
    localStorage.setItem(target, JSON.stringify(list));
    if (action === "reschedule_approved") {
      const participations = read("recovibeParticipations", []);
      const students = Array.isArray(participations)
        ? participations.map(String)
        : [];
      const notifications = read("recovibeNotifications", []);
      notifications.unshift({
        id: `schedule-${id}-${Date.now()}`,
        title: "Event Schedule Updated",
        message: message || `“${event.title}” has been rescheduled.`,
        eventId: id,
        recipientIds: students,
        createdAt: now,
        time: new Date().toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Asia/Manila",
        }),
        read: false,
        type: "maroon",
      });
      localStorage.setItem(
        "recovibeNotifications",
        JSON.stringify(notifications),
      );
    }
  }
  function showSuccess(
    title = "Event Approved",
    message = "The event has been successfully approved and will proceed to the next stage of the approval process.",
  ) {
    const layer = document.createElement("div");
    layer.className = "admin-modal-backdrop";
    layer.dataset.layer = "success";
    layer.innerHTML = `<section class="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="successTitle" tabindex="-1"><h2 id="successTitle">${esc(title)}</h2><p>${esc(message)}</p><div class="admin-dialog-actions"><button class="admin-button green" type="button">Done</button></div></section>`;
    document.body.append(layer);
    opened.push(layer);
    layer.querySelector("button").onclick = () => {
      closeAll();
      render();
    };
    layer.querySelector(".admin-dialog").focus();
    return Promise.resolve();
  }
  function runAction(layer, callback) {
    if (pending) return;
    pending = true;
    const button = layer.querySelector("[data-confirm]");
    button.disabled = true;
    button.textContent = "Saving…";
    Promise.resolve()
      .then(callback)
      .catch((error) => {
        if (error.message !== "This item was already handled.") {
          const active = opened.at(-1);
          if (active) {
            const alert = active.querySelector(".admin-inline-error");
            if (alert)
              alert.textContent = `${error.message || "Could not save. Try again."} Your review is still open.`;
          }
        }
      })
      .finally(() => {
        pending = false;
        if (button.isConnected) {
          button.disabled = false;
          button.textContent =
            button.dataset.original ||
            button.textContent.replace("Saving…", "Confirm");
        }
      });
  }
  function closeTop() {
    if (pending || !opened.length) return;
    opened.pop()?.remove();
  }
  function closeAll() {
    if (pending) return;
    while (opened.length) opened.pop().remove();
  }
  function toast(message) {
    const el = document.querySelector(".admin-toast");
    el.textContent = message;
    el.hidden = false;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => (el.hidden = true), 3300);
  }
  async function download(fileId, name) {
    try {
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open("RecoVibeEventDocuments", 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const record = await new Promise((resolve, reject) => {
        const req = db.transaction("files").objectStore("files").get(fileId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (!record) throw new Error("Document is unavailable.");
      const url = URL.createObjectURL(record.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = record.name || name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (error) {
      toast(error.message);
    }
  }
  document.addEventListener("click", (event) => {
    const file = event.target.closest("[data-file]");
    if (file) download(file.dataset.file, file.dataset.name);
    const conflict = event.target.closest("[data-conflict-event]");
    if (conflict) {
      const item = findEvent(conflict.dataset.conflictEvent);
      if (item) window.RecovibeEventDetails?.open(item);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeTop();
      return;
    }
    if (event.key !== "Tab" || !opened.length) return;
    const dialog = opened.at(-1).querySelector("[role=dialog]");
    const focusable = [
      ...dialog.querySelectorAll(
        "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href]",
      ),
    ];
    if (!focusable.length) return;
    const first = focusable[0],
      last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  window.addEventListener("storage", (event) => {
    if (!event.key || event.key.includes("Events")) render();
  });
  window.addEventListener("focus", render);
  window.addEventListener("recovibeAdminEventsChanged", render);
  function toastCounts() {
    const count = issueList().length;
    const badge = document.querySelector("[data-queue-count]");
    badge.textContent = String(count);
    badge.hidden = !count;
    const notices = read("recovibeAdminNotifications", []);
    const unread = Array.isArray(notices)
      ? notices.filter((item) => !item.read).length
      : 0;
    const noticeBadge = document.querySelector("[data-notification-count]");
    noticeBadge.textContent = String(unread);
    noticeBadge.hidden = !unread;
  }
  function init() {
    if (!isFirebaseConfigured || !db) {
      root.innerHTML =
        '<div class="admin-error">Event data is unavailable. Please contact support.</div>';
      return;
    }
    root.innerHTML = '<div class="admin-loading">Loading approval items…</div>';
    unsubscribeEvents = onSnapshot(
      query(collection(db, "events"), orderBy("createdAt", "desc")),
      (snapshot) => {
        firestoreEvents = snapshot.docs.map(normalizeEvent);
        toastCounts();
        render();
        const params = new URLSearchParams(location.search);
        if (params.get("review"))
          openReview(
            params.get("review"),
            params.get("type") || "pending_approval",
          );
      },
      (error) => {
        console.error("Unable to load approval submissions:", error);
        root.innerHTML = `<div class="admin-error">Could not load approval items. ${esc(error.message || "Please try again later.")}</div>`;
      },
    );
  }
  init();
})();
