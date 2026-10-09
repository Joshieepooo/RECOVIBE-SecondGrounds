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
  const root = document.getElementById("profileRoot"),
    toastElement = document.querySelector(".admin-toast"),
    namePattern = /^[A-Z][a-z]*(?: [A-Z][a-z]*)*$/,
    phonePattern = /^(09\d{9}|\+639\d{9})$/;
  let editing = false,
    dirty = false;
  const fullName =
    profile.name ||
    [profile.firstName, profile.middleName, profile.lastName]
      .filter(Boolean)
      .join(" ") ||
    identity;
  const nameParts = fullName.trim().split(/\s+/);
  profile.firstName = profile.firstName || nameParts[0] || "";
  profile.lastName =
    profile.lastName || nameParts.length > 1
      ? profile.lastName || nameParts.at(-1)
      : "";
  profile.middleName =
    profile.middleName ||
    (nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "");
  document.querySelector("[data-name]").textContent = fullName.toUpperCase();
  document.querySelector("[data-avatar]").textContent = fullName
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
  const lastName = profile.lastName || fullName.split(/\s+/).at(-1) || fullName;
  document.getElementById("greeting").textContent =
    `${greeting()}, ${[profile.title || "Administrator", lastName].filter(Boolean).join(" ")}!`;
  root.innerHTML = `<section class="admin-profile-card"><h2>Personal Information</h2><div class="profile-summary-grid" id="profileSummary"></div><div class="admin-profile-actions"><button class="admin-button" id="editProfile" type="button">Edit Profile</button><button class="admin-button" id="changePassword" type="button">Change Password</button></div><form class="admin-profile-form" id="profileForm" hidden novalidate><div class="admin-field"><label for="firstName">First Name</label><input id="firstName" autocomplete="given-name"></div><div class="admin-field"><label for="middleName">Middle Name</label><input id="middleName" autocomplete="additional-name"></div><label class="admin-checkbox"><input id="noMiddleName" type="checkbox"> I don't have a middle name</label><div class="admin-field"><label for="lastName">Last Name</label><input id="lastName" autocomplete="family-name"></div><div class="admin-field"><label for="emailAddress">Email Address</label><input id="emailAddress" type="email" readonly></div><div class="admin-field"><label for="contactNumber">Contact Number</label><input id="contactNumber" type="tel" autocomplete="tel" placeholder="09XXXXXXXXX or +639XXXXXXXXX"></div><p class="admin-error-text" id="profileError" role="alert"></p><div class="admin-profile-actions"><button class="admin-button green" type="submit">Save</button><button class="admin-button" id="cancelEdit" type="button">Cancel</button></div></form></section><div class="admin-modal-backdrop" id="passwordLayer" hidden style="display:none"><section class="admin-dialog admin-password-dialog" role="dialog" aria-modal="true" aria-labelledby="passwordTitle" tabindex="-1"><button class="admin-close" id="passwordClose" type="button" aria-label="Close password dialog">×</button><h2 id="passwordTitle">Change Password</h2><form id="passwordForm" novalidate><div class="admin-field"><label for="currentPassword">Current Password</label><div class="password-control"><input id="currentPassword" type="password" autocomplete="current-password"><button type="button" data-toggle="currentPassword" aria-label="Show current password">◉</button></div></div><div class="admin-field"><label for="newPassword">New Password</label><div class="password-control"><input id="newPassword" type="password" autocomplete="new-password"><button type="button" data-toggle="newPassword" aria-label="Show new password">◉</button></div></div><p class="password-rules">At least 8 characters, including uppercase, lowercase, and a number.</p><div class="admin-field"><label for="confirmPassword">Confirm New Password</label><div class="password-control"><input id="confirmPassword" type="password" autocomplete="new-password"><button type="button" data-toggle="confirmPassword" aria-label="Show confirmation password">◉</button></div></div><p class="admin-error-text" id="passwordError" role="alert"></p><div class="admin-dialog-actions"><button class="admin-button green" type="submit">Update Password</button><button class="admin-button" id="cancelPassword" type="button">Cancel</button></div></form></section></div>`;
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
  function toast(message) {
    toastElement.textContent = message;
    toastElement.hidden = false;
    clearTimeout(toastElement._timer);
    toastElement._timer = setTimeout(() => (toastElement.hidden = true), 3000);
  }
  function display() {
    const grid = root.querySelector("#profileSummary");
    grid.innerHTML = `<div><strong>First Name</strong><span>${esc(profile.firstName)}</span></div><div><strong>Middle Name</strong><span>${esc(profile.middleName || "--")}</span></div><div><strong>Last Name</strong><span>${esc(profile.lastName)}</span></div><div><strong>Email Address</strong><span>${esc(profile.email || identity)}</span></div><div><strong>Contact Number</strong><span>${esc(profile.contactNumber || "Not provided")}</span></div>`;
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
  function setEditing(value) {
    editing = value;
    dirty = false;
    root.querySelector("#profileSummary").hidden = value;
    root.querySelector("#editProfile").hidden = value;
    root.querySelector("#profileForm").hidden = !value;
    const form = root.querySelector("#profileForm");
    form.firstName.value = profile.firstName;
    form.middleName.value = profile.middleName;
    form.lastName.value = profile.lastName;
    form.emailAddress.value = profile.email || identity;
    form.contactNumber.value = profile.contactNumber || "";
    form.noMiddleName.checked = !profile.middleName;
    form.middleName.disabled = form.noMiddleName.checked;
    root.querySelector("#profileError").textContent = "";
    if (value) form.firstName.focus();
  }
  function changed() {
    dirty = true;
  }
  function hash(value) {
    return crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(value))
      .then((bytes) =>
        [...new Uint8Array(bytes)]
          .map((item) => item.toString(16).padStart(2, "0"))
          .join(""),
      );
  }
  root.querySelector("#editProfile").onclick = () => setEditing(true);
  root.querySelector("#profileForm").addEventListener("input", changed);
  root.querySelector("#noMiddleName").addEventListener("change", (event) => {
    const middle = root.querySelector("#middleName");
    middle.disabled = event.target.checked;
    if (event.target.checked) middle.value = "";
    else middle.focus();
    changed();
  });
  root.querySelector("#cancelEdit").onclick = () => {
    if (dirty && !confirm("Discard your unsaved profile changes?")) return;
    setEditing(false);
  };
  root.querySelector("#profileForm").onsubmit = (event) => {
    event.preventDefault();
    const form = event.currentTarget,
      first = form.firstName.value.trim(),
      middle = form.noMiddleName.checked ? "" : form.middleName.value.trim(),
      last = form.lastName.value.trim(),
      phone = form.contactNumber.value.trim(),
      normalizedPhone = phone.replace(/[\s-]/g, ""),
      error = root.querySelector("#profileError");
    if (
      !first ||
      !last ||
      !namePattern.test(first) ||
      !namePattern.test(last) ||
      (!form.noMiddleName.checked && (!middle || !namePattern.test(middle)))
    ) {
      error.textContent =
        "Enter valid first and last names; middle name is required unless you select the checkbox.";
      return;
    }
    if (phone && !phonePattern.test(normalizedPhone)) {
      error.textContent = "Use 09XXXXXXXXX or +639XXXXXXXXX.";
      form.contactNumber.focus();
      return;
    }
    profile.firstName = first;
    profile.middleName = middle;
    profile.lastName = last;
    profile.name = [first, middle, last].filter(Boolean).join(" ");
    profile.contactNumber = normalizedPhone;
    profile.email = profile.email || identity;
    localStorage.setItem("recovibeAdminProfile", JSON.stringify(profile));
    document.querySelector("[data-name]").textContent =
      profile.name.toUpperCase();
    document.querySelector("[data-avatar]").textContent = profile.name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase();
    document.getElementById("greeting").textContent =
      `${greeting()}, ${[profile.title || "Administrator", last].filter(Boolean).join(" ")}!`;
    display();
    setEditing(false);
    toast("Profile saved.");
  };
  const layer = root.querySelector("#passwordLayer");
  function closePassword() {
    layer.hidden = true;
    layer.style.display = "none";
    document.body.style.overflow = "";
    root.querySelector("#changePassword").focus();
    root.querySelector("#passwordError").textContent = "";
    root.querySelector("#passwordForm").reset();
  }
  root.querySelector("#changePassword").onclick = () => {
    layer.hidden = false;
    layer.style.display = "grid";
    document.body.style.overflow = "hidden";
    root.querySelector("#currentPassword").focus();
  };
  root.querySelectorAll("[data-toggle]").forEach(
    (button) =>
      (button.onclick = () => {
        const input = document.getElementById(button.dataset.toggle),
          visible = input.type === "password";
        input.type = visible ? "text" : "password";
        button.setAttribute(
          "aria-label",
          `${visible ? "Hide" : "Show"} ${input.labels[0]?.textContent.toLowerCase() || "password"}`,
        );
      }),
  );
  root.querySelector("#passwordClose").onclick = closePassword;
  root.querySelector("#cancelPassword").onclick = closePassword;
  layer.addEventListener("click", (event) => {
    if (event.target === layer) closePassword();
  });
  root.querySelector("#passwordForm").onsubmit = async (event) => {
    event.preventDefault();
    const current = root.querySelector("#currentPassword").value,
      next = root.querySelector("#newPassword").value,
      confirmValue = root.querySelector("#confirmPassword").value,
      error = root.querySelector("#passwordError"),
      button = event.submitter;
    error.textContent = "";
    if (
      !current ||
      next.length < 8 ||
      !/[A-Z]/.test(next) ||
      !/[a-z]/.test(next) ||
      !/[0-9]/.test(next)
    ) {
      error.textContent =
        "Use at least 8 characters with uppercase, lowercase, and a number.";
      return;
    }
    if (next !== confirmValue) {
      error.textContent = "The new passwords do not match.";
      return;
    }
    button.disabled = true;
    button.textContent = "Updating…";
    try {
      const expected = localStorage.getItem("recovibeAdminPasswordHash");
      if (!expected || (await hash(current)) !== expected)
        throw new Error("Current password is incorrect.");
      localStorage.setItem("recovibeAdminPasswordHash", await hash(next));
      closePassword();
      toast("Password changed successfully.");
    } catch (failure) {
      error.textContent = failure.message || "Password could not be changed.";
    } finally {
      button.disabled = false;
      button.textContent = "Update Password";
    }
  };
  layer.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closePassword();
      return;
    }
    if (event.key === "Tab") {
      const controls = [
        ...layer.querySelectorAll("button:not(:disabled),input:not(:disabled)"),
      ];
      if (event.shiftKey && document.activeElement === controls[0]) {
        event.preventDefault();
        controls.at(-1).focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === controls.at(-1)
      ) {
        event.preventDefault();
        controls[0].focus();
      }
    }
  });
  window.addEventListener("beforeunload", (event) => {
    if (dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  display();
})();
