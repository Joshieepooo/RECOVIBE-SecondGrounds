import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
  verifyBeforeUpdateEmail,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, isFirebaseConfigured } from "./firebaseConfig.js";

function hydrateUserProfile() {
  const user =
    JSON.parse(localStorage.getItem("recovibeCurrentUser") || "null") || {};
  const storedFirstName = String(user.firstName || "").trim();
  const storedFullName = String(user.name || user.fullName || "").trim();
  const nameFromProfile = [storedFirstName, user.middleName, user.lastName]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");
  const displayName = storedFullName || nameFromProfile || "Student";
  const firstName =
    storedFirstName ||
    storedFullName.split(/\s+/).filter(Boolean)[0] ||
    nameFromProfile.split(/\s+/).filter(Boolean)[0] ||
    "";
  const avatarFallback =
    [user.username, user.studentNumber, user.studentId, user.email]
      .map((value) => String(value || "").trim())
      .find(Boolean) || "";
  const avatarLetter =
    Array.from(firstName || avatarFallback)[0]?.toLocaleUpperCase() || "S";
  const organization = String(user.organization || "").trim();
  const role =
    organization && organization.toLowerCase() !== "none"
      ? organization
      : "Student";

  document.querySelectorAll(".user-name").forEach((element) => {
    element.textContent = displayName;
  });
  document.querySelectorAll(".user-role").forEach((element) => {
    element.textContent = role;
  });
  document.querySelectorAll(".avatar").forEach((element) => {
    element.textContent = avatarLetter;
  });
  document.querySelectorAll("#userFirstName").forEach((element) => {
    element.textContent = firstName;
  });
}

(() => {
  hydrateUserProfile();
  const user =
    JSON.parse(localStorage.getItem("recovibeCurrentUser") || "null") || {};
  const preferenceKey = "recovibePreferences";
  const accountPreferenceKey = `recovibePreferences:${user.uid || user.email || "student"}`;
  const categories = [
    "Academic & Learning",
    "Tech & Innovation",
    "Leadership & Career",
    "Sports & Fitness",
    "Music & Entertainment",
    "Orgs & Student Acts",
    "Social Events",
    "Community & Outreach",
    "Competitions",
    "Seminars & Workshops",
    "Arts & Culture",
    "University & Campuses",
  ];
  const sources = [
    "PUP Official",
    "CSC",
    "Teacher / Faculty",
    "Organizational",
    "Others / External",
  ];
  const defaults = {
    categories: ["Academic & Learning", "Tech & Innovation"],
    sources,
  };
  let preferences =
    user.preferences ||
    JSON.parse(localStorage.getItem(accountPreferenceKey) || "null") ||
    JSON.parse(localStorage.getItem(preferenceKey) || "null") ||
    defaults;
  if (
    !Array.isArray(preferences.categories) ||
    !Array.isArray(preferences.sources)
  ) {
    preferences = defaults;
  }

  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element)
      element.textContent = String(value || "").trim() || "Not provided";
  };
  const storedName = String(user.fullName || user.name || "").trim();
  const nameParts = storedName.split(/\s+/).filter(Boolean);
  const firstName = String(user.firstName || "").trim() || nameParts[0] || "";
  const lastName =
    String(user.lastName || "").trim() ||
    (nameParts.length > 1 ? nameParts.at(-1) : "");
  setText("profileFirstName", firstName);
  setText(
    "profileMiddleName",
    String(user.middleName || "").trim() ||
      (nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : ""),
  );
  setText("profileLastName", lastName);
  setText("profileStudentId", user.studentNumber || user.studentId);
  setText("profileEmail", user.email);
  setText("profileContact", user.contactNumber || user.contact);
  setText("profileDepartment", user.department);
  setText("profileYear", user.year);
  setText("profileOrganization", user.organization);
  setText(
    "todayDate",
    new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  );
  const renderSummary = (id, items, emptyMessage) => {
    const container = document.getElementById(id);
    if (!container) return;
    container.replaceChildren();
    if (!items.length) {
      const emptyState = document.createElement("p");
      emptyState.className = "preference-empty";
      emptyState.textContent = emptyMessage;
      container.append(emptyState);
      return;
    }
    items.forEach((item) => {
      const chip = document.createElement("span");
      chip.className = "preference-chip";
      chip.textContent = item;
      container.append(chip);
    });
  };
  renderSummary(
    "categorySummary",
    preferences.categories,
    "No categories selected.",
  );
  renderSummary("sourceSummary", preferences.sources, "No sources selected.");
  const profileForm = document.getElementById("profileForm");
  const passwordForm = document.getElementById("passwordForm");
  const profileFormStatus = document.getElementById("profileFormStatus");
  const passwordFormStatus = document.getElementById("passwordFormStatus");
  const saveProfileBtn =
    document.getElementById("saveProfileBtn") ||
    profileForm.querySelector('[type="submit"]');

  const namePattern = /^[\p{L}\p{M}]+(?:[ .'-][\p{L}\p{M}]+)*\.?$/u;
  const emailPattern =
    /^(?=.{1,254}$)(?!.*\.\.)[A-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,}$/i;
  const contactPattern = /^09[0-9]{9}$/;
  const yearPattern = /^[1-5]-[1-5]$/;

  function isValidName(value) {
    const normalized = value.normalize("NFC");
    const length = Array.from(normalized).length;
    return length >= 2 && length <= 50 && namePattern.test(normalized);
  }

  function isValidEmail(value) {
    if (
      value.length > 254 ||
      /\s/.test(value) ||
      (value.match(/@/g) || []).length !== 1
    ) {
      return false;
    }
    const [local, domain] = value.split("@");
    return (
      local.length <= 64 &&
      !local.startsWith(".") &&
      !local.endsWith(".") &&
      !domain.startsWith(".") &&
      !domain.endsWith(".") &&
      emailPattern.test(value)
    );
  }

  function normalizeName(value) {
    return value
      .replace(/ {2,}/g, " ")
      .replace(/^ /, "")
      .replace(
        /(^|[ '-])(\p{L})/gu,
        (_, separator, letter) => separator + letter.toUpperCase(),
      );
  }

  function normalizeYear(value) {
    const allowed = value.replace(/[^0-9-]/g, "");
    const first = allowed[0];
    if (!first || !/[1-5]/.test(first)) return "";

    const rest = allowed.slice(1);
    if (rest.startsWith("-")) {
      const second = rest.slice(1).match(/[0-9]/)?.[0];
      return second && /[1-5]/.test(second)
        ? `${first}-${second}`
        : `${first}-`;
    }

    const second = rest.match(/[0-9]/)?.[0];
    return second && /[1-5]/.test(second) ? `${first}-${second}` : first;
  }

  function normalizePhone(value) {
    const digits = value.replace(/\D/g, "");
    if (digits.startsWith("09")) return digits.slice(0, 11);
    if (digits.startsWith("639")) return `0${digits.slice(2, 12)}`;
    if (digits.startsWith("9")) return `0${digits.slice(0, 10)}`;
    return `09${digits.replace(/^0+/, "").slice(0, 9)}`;
  }

  function normalizeWithCaret(control, normalize) {
    const value = control.value;
    const start = control.selectionStart ?? value.length;
    const end = control.selectionEnd ?? start;
    const nextValue = normalize(value);
    if (nextValue !== value) {
      const nextStart = normalize(value.slice(0, start)).length;
      const nextEnd = normalize(value.slice(0, end)).length;
      control.value = nextValue;
      control.setSelectionRange(
        Math.min(nextStart, nextValue.length),
        Math.min(nextEnd, nextValue.length),
      );
    }
  }

  const accountProfile = {
    firstName: String(user.firstName || "").trim(),
    middleName: String(user.middleName || "").trim(),
    lastName: String(user.lastName || "").trim(),
    email: String(user.email || "")
      .trim()
      .toLowerCase(),
    contactNumber: String(user.contactNumber || user.contact || "").trim(),
    department: String(user.department || "").trim(),
    year: String(user.year || "").trim(),
    organization: String(user.organization || "None").trim(),
  };

  const profileFields = {
    firstName: document.getElementById("editFirstName"),
    middleName: document.getElementById("editMiddleName"),
    lastName: document.getElementById("editLastName"),
    email: document.getElementById("editEmail"),
    contactNumber: document.getElementById("editContact"),
    department: document.getElementById("editDepartment"),
    year: document.getElementById("editYear"),
    organization: document.getElementById("editOrganization"),
  };

  const touchedProfileFields = new Set();
  let profileSubmitted = false;

  function setInvalid(fieldId, invalid, message = "") {
    const field = document.getElementById(fieldId);
    if (!field) return;
    const control = field.querySelector("input, select");
    const error =
      field.querySelector(".error-msg") ||
      document.getElementById(`${fieldId.replace("field-", "")}Error`);
    field.classList.toggle("invalid", invalid);
    if (error) {
      error.classList.toggle("visible", invalid);
      error.textContent = invalid ? message : "";
    }
    if (control) {
      if (invalid) {
        control.setAttribute("aria-invalid", "true");
        if (error && error.id)
          control.setAttribute("aria-describedby", error.id);
      } else {
        control.removeAttribute("aria-invalid");
      }
    }
  }

  function validateProfileField(name) {
    const control = profileFields[name];
    if (!control) return true;
    const value = control.value.trim();

    if (name === "lastName" || name === "firstName") {
      const label = name === "lastName" ? "Last name" : "First name";
      const fieldId =
        name === "lastName" ? "field-edit-lastname" : "field-edit-firstname";
      if (!value) {
        setInvalid(fieldId, true, `Enter your ${label.toLowerCase()}.`);
        return false;
      }
      const valid = isValidName(value);
      setInvalid(fieldId, !valid, "Use 2–50 valid name characters.");
      return valid;
    }

    if (name === "middleName") {
      const fieldId = "field-edit-middlename";
      if (!value) {
        setInvalid(fieldId, false);
        return true;
      }
      const valid = isValidName(value);
      setInvalid(fieldId, !valid, "Use 2–50 valid name characters.");
      return valid;
    }

    if (name === "email") {
      const emailVal = value.toLowerCase();
      const valid = Boolean(emailVal) && isValidEmail(emailVal);
      setInvalid(
        "field-edit-email",
        !valid,
        emailVal ? "Enter a valid email address." : "Email is required.",
      );
      return valid;
    }

    if (name === "contactNumber") {
      const valid = value !== "09" && contactPattern.test(value);
      setInvalid(
        "field-edit-contact",
        !valid,
        "Enter a valid 11-digit contact number.",
      );
      return valid;
    }

    if (name === "year") {
      const valid = yearPattern.test(value);
      setInvalid("field-edit-year", !valid, "Enter year and section like 2-3.");
      return valid;
    }

    if (name === "department") {
      const valid = Boolean(control.value);
      setInvalid("field-edit-department", !valid, "Select your department.");
      return valid;
    }

    if (name === "organization") {
      const valid = Boolean(control.value);
      setInvalid(
        "field-edit-organization",
        !valid,
        "Select your organization.",
      );
      return valid;
    }

    return true;
  }

  function updateLiveProfileValidation(name) {
    if (
      profileSubmitted ||
      touchedProfileFields.has(name) ||
      profileFields[name]?.closest(".form-field")?.classList.contains("invalid")
    ) {
      validateProfileField(name);
    }
  }

  function validateAllProfileFields() {
    const fieldNames = [
      "firstName",
      "middleName",
      "lastName",
      "email",
      "contactNumber",
      "department",
      "year",
      "organization",
    ];
    let firstInvalid = null;
    let allValid = true;
    fieldNames.forEach((name) => {
      const valid = validateProfileField(name);
      if (!valid) {
        allValid = false;
        if (!firstInvalid) firstInvalid = profileFields[name];
      }
    });
    if (firstInvalid) {
      firstInvalid.focus();
    }
    return allValid;
  }

  function fillProfileForm() {
    profileFields.firstName.value = accountProfile.firstName || "";
    profileFields.middleName.value = accountProfile.middleName || "";
    profileFields.lastName.value = accountProfile.lastName || "";
    profileFields.email.value = accountProfile.email || user.email || "";
    profileFields.contactNumber.value = accountProfile.contactNumber || "09";
    profileFields.year.value = accountProfile.year || "";

    const deptSelect = profileFields.department;
    const currentDept = accountProfile.department || "";
    if (
      currentDept &&
      ![...deptSelect.options].some(
        (opt) =>
          opt.value === currentDept || opt.textContent.trim() === currentDept,
      )
    ) {
      const opt = document.createElement("option");
      opt.value = currentDept;
      opt.textContent = currentDept;
      deptSelect.appendChild(opt);
    }
    deptSelect.value = currentDept;

    const orgSelect = profileFields.organization;
    const currentOrg = accountProfile.organization || "None";
    if (
      currentOrg &&
      ![...orgSelect.options].some(
        (opt) =>
          opt.value === currentOrg || opt.textContent.trim() === currentOrg,
      )
    ) {
      const opt = document.createElement("option");
      opt.value = currentOrg;
      opt.textContent = currentOrg;
      orgSelect.appendChild(opt);
    }
    orgSelect.value = currentOrg;

    [
      "firstname",
      "middlename",
      "lastname",
      "email",
      "contact",
      "department",
      "year",
      "organization",
    ].forEach((key) => setInvalid(`field-edit-${key}`, false));
    profileSubmitted = false;
    touchedProfileFields.clear();
  }

  function isProfileFormDirty() {
    return (
      profileFields.firstName.value.trim() !==
        (accountProfile.firstName || "") ||
      profileFields.middleName.value.trim() !==
        (accountProfile.middleName || "") ||
      profileFields.lastName.value.trim() !== (accountProfile.lastName || "") ||
      profileFields.email.value.trim().toLowerCase() !==
        (accountProfile.email || user.email || "").toLowerCase() ||
      profileFields.contactNumber.value.trim() !==
        (accountProfile.contactNumber || "") ||
      profileFields.department.value.trim() !==
        (accountProfile.department || "") ||
      profileFields.year.value.trim() !== (accountProfile.year || "") ||
      profileFields.organization.value.trim() !==
        (accountProfile.organization || "")
    );
  }

  Object.entries(profileFields).forEach(([name, control]) => {
    if (!control) return;
    if (control.tagName === "SELECT") {
      control.addEventListener("change", () => {
        touchedProfileFields.add(name);
        updateLiveProfileValidation(name);
      });
      control.addEventListener("blur", () => {
        touchedProfileFields.add(name);
        updateLiveProfileValidation(name);
      });
    } else {
      control.addEventListener("input", () => {
        if (
          name === "firstName" ||
          name === "lastName" ||
          name === "middleName"
        ) {
          normalizeWithCaret(control, normalizeName);
        } else if (name === "email") {
          normalizeWithCaret(control, (val) => val.toLowerCase());
        } else if (name === "contactNumber") {
          normalizeWithCaret(control, normalizePhone);
        } else if (name === "year") {
          normalizeWithCaret(control, normalizeYear);
        }
        updateLiveProfileValidation(name);
      });
      control.addEventListener("blur", () => {
        if (
          name === "firstName" ||
          name === "lastName" ||
          name === "middleName"
        ) {
          control.value = normalizeName(control.value.trim());
        } else if (name === "email") {
          control.value = control.value.trim().toLowerCase();
        } else if (name === "contactNumber") {
          control.value = normalizePhone(control.value.trim());
        } else if (name === "year") {
          control.value = normalizeYear(control.value.trim());
        }
        touchedProfileFields.add(name);
        updateLiveProfileValidation(name);
      });
    }
  });

  profileFields.contactNumber.addEventListener("focus", () => {
    if (!profileFields.contactNumber.value.startsWith("09")) {
      profileFields.contactNumber.value = normalizePhone(
        profileFields.contactNumber.value,
      );
    }
  });

  function requireSignedInStudent() {
    if (!isFirebaseConfigured || !auth || !db || !user.uid) {
      return Promise.reject(new Error("Sign in again to update your account."));
    }
    if (auth.currentUser?.uid === user.uid) {
      return Promise.resolve(auth.currentUser);
    }
    return new Promise((resolve, reject) => {
      let unsubscribe = () => {};
      unsubscribe = onAuthStateChanged(
        auth,
        (signedInUser) => {
          unsubscribe();
          if (signedInUser?.uid === user.uid) resolve(signedInUser);
          else reject(new Error("Sign in again to update your account."));
        },
        (error) => {
          unsubscribe();
          reject(error);
        },
      );
    });
  }

  document.getElementById("editProfile").addEventListener("click", () => {
    fillProfileForm();
    profileFormStatus.textContent = "";
    profileFormStatus.style.color = "";
    profileForm.hidden = false;
    passwordForm.hidden = true;
    profileFields.firstName.focus();
  });

  document.getElementById("cancelProfileEdit").addEventListener("click", () => {
    if (isProfileFormDirty()) {
      if (
        !window.confirm(
          "You have unsaved changes. Are you sure you want to cancel?",
        )
      ) {
        return;
      }
    }
    profileForm.hidden = true;
    profileFormStatus.textContent = "";
  });

  window.addEventListener("beforeunload", (event) => {
    if (!profileForm.hidden && isProfileFormDirty()) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    profileSubmitted = true;
    profileFormStatus.textContent = "";

    profileFields.firstName.value = normalizeName(
      profileFields.firstName.value.trim(),
    );
    profileFields.middleName.value = normalizeName(
      profileFields.middleName.value.trim(),
    );
    profileFields.lastName.value = normalizeName(
      profileFields.lastName.value.trim(),
    );
    profileFields.email.value = profileFields.email.value.trim().toLowerCase();
    profileFields.contactNumber.value = normalizePhone(
      profileFields.contactNumber.value,
    );
    profileFields.year.value = normalizeYear(profileFields.year.value);

    if (!validateAllProfileFields()) {
      return;
    }

    const updated = {
      firstName: profileFields.firstName.value.trim(),
      middleName: profileFields.middleName.value.trim(),
      lastName: profileFields.lastName.value.trim(),
      email: profileFields.email.value.trim().toLowerCase(),
      contactNumber: profileFields.contactNumber.value.trim(),
      department: profileFields.department.value.trim(),
      year: profileFields.year.value.trim(),
      organization: profileFields.organization.value.trim(),
    };

    saveProfileBtn.disabled = true;
    saveProfileBtn.textContent = "Saving profile...";

    try {
      const currentEmail = (user.email || "").toLowerCase();
      const emailChanged = updated.email && updated.email !== currentEmail;

      let emailNotice = "";
      if (emailChanged && isFirebaseConfigured && auth) {
        const signedInUser = await requireSignedInStudent();
        if (signedInUser) {
          try {
            if (typeof verifyBeforeUpdateEmail === "function") {
              await verifyBeforeUpdateEmail(signedInUser, updated.email);
              emailNotice =
                " A confirmation email has been sent to verify your new email address.";
            } else if (typeof updateEmail === "function") {
              await updateEmail(signedInUser, updated.email);
            }
          } catch (authErr) {
            console.warn("Auth email update notice:", authErr);
            if (authErr.code === "auth/email-already-in-use") {
              setInvalid(
                "field-edit-email",
                true,
                "This email is already registered.",
              );
              profileFields.email.focus();
              saveProfileBtn.disabled = false;
              saveProfileBtn.textContent = "Save Profile";
              return;
            } else if (authErr.code === "auth/requires-recent-login") {
              throw new Error(
                "Please sign in again to update your email address.",
              );
            }
          }
        }
      }

      const fullName = [updated.firstName, updated.middleName, updated.lastName]
        .filter(Boolean)
        .join(" ");
      const nextProfile = {
        ...updated,
        contact: updated.contactNumber,
        fullName,
        name: fullName,
      };

      if (isFirebaseConfigured && db && user.uid) {
        await updateDoc(doc(db, "studentUser", user.uid), nextProfile);
      }

      Object.assign(user, nextProfile);
      Object.assign(accountProfile, updated);
      localStorage.setItem("recovibeCurrentUser", JSON.stringify(user));

      const summaryFields = {
        profileFirstName: updated.firstName,
        profileMiddleName: updated.middleName,
        profileLastName: updated.lastName,
        profileEmail: updated.email,
        profileContact: updated.contactNumber,
        profileDepartment: updated.department,
        profileYear: updated.year,
        profileOrganization: updated.organization,
      };
      Object.entries(summaryFields).forEach(([id, value]) =>
        setText(id, value),
      );
      hydrateUserProfile();

      profileFormStatus.style.color = "#1b6d43";
      profileFormStatus.textContent = `Profile saved successfully.${emailNotice}`;

      window.setTimeout(() => {
        profileForm.hidden = true;
        profileFormStatus.textContent = "";
        profileFormStatus.style.color = "";
      }, 1400);
    } catch (error) {
      console.error("Student profile update failed:", error);
      profileFormStatus.style.color = "var(--red-500)";
      profileFormStatus.textContent =
        error.message || "Profile could not be saved.";
    } finally {
      saveProfileBtn.disabled = false;
      saveProfileBtn.textContent = "Save Profile";
    }
  });
  document.getElementById("changePassword").addEventListener("click", () => {
    passwordForm.reset();
    passwordFormStatus.textContent = "";
    passwordForm.hidden = false;
    profileForm.hidden = true;
    document.getElementById("currentPassword").focus();
  });
  document
    .getElementById("cancelPasswordChange")
    .addEventListener("click", () => {
      passwordForm.hidden = true;
      passwordFormStatus.textContent = "";
    });
  passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    passwordFormStatus.textContent = "";
    const current = document.getElementById("currentPassword").value;
    const next = document.getElementById("newPassword").value;
    const confirmation = document.getElementById("confirmPassword").value;
    if (
      next.length < 8 ||
      !/[A-Z]/.test(next) ||
      !/[a-z]/.test(next) ||
      !/\d/.test(next) ||
      !/[^\p{L}\p{N}\s]/u.test(next)
    ) {
      passwordFormStatus.textContent =
        "Use at least 8 characters with uppercase, lowercase, a number, and a special character.";
      return;
    }
    if (next !== confirmation) {
      passwordFormStatus.textContent = "The new passwords do not match.";
      return;
    }
    const submit = passwordForm.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const signedInUser = await requireSignedInStudent();
      if (!signedInUser.email) {
        throw new Error("This account does not have a sign-in email.");
      }
      await reauthenticateWithCredential(
        signedInUser,
        EmailAuthProvider.credential(signedInUser.email, current),
      );
      await updatePassword(signedInUser, next);
      passwordForm.reset();
      passwordFormStatus.textContent = "Password changed successfully.";
      window.setTimeout(() => {
        passwordForm.hidden = true;
      }, 1200);
    } catch (error) {
      console.error("Student password update failed:", error);
      passwordFormStatus.textContent =
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password"
          ? "Current password is incorrect."
          : error.code === "auth/requires-recent-login"
            ? "Please sign in again, then retry changing your password."
            : error.message || "Password could not be changed.";
    } finally {
      submit.disabled = false;
    }
  });
  const organization = String(user.organization || "").trim();
  const role =
    organization && organization.toLowerCase() !== "none"
      ? organization
      : "Student";
  setText("userRole", role);
  setText("userName", storedName || firstName);
  hydrateUserProfile();

  const sidebar = document.getElementById("sidebar");
  const collapseButton = document.getElementById("collapseBtn");
  const setCollapsed = (collapsed) => {
    sidebar.classList.toggle("is-collapsed", collapsed);
    if (collapseButton) {
      collapseButton.setAttribute("aria-expanded", String(!collapsed));
      collapseButton.setAttribute(
        "aria-label",
        collapsed ? "Expand sidebar" : "Collapse sidebar",
      );
      collapseButton.setAttribute(
        "title",
        collapsed ? "Expand sidebar" : "Collapse sidebar",
      );
    }
    localStorage.setItem("sidebarCollapsed", String(collapsed));
  };
  const mobileSidebar = window.matchMedia("(max-width: 860px)");
  setCollapsed(
    mobileSidebar.matches
      ? false
      : localStorage.getItem("sidebarCollapsed") === "true",
  );
  if (collapseButton) {
    collapseButton.addEventListener("click", () => {
      if (!mobileSidebar.matches)
        setCollapsed(!sidebar.classList.contains("is-collapsed"));
    });
  }
  document.querySelector(".logout").addEventListener("click", (event) => {
    event.preventDefault();
    localStorage.removeItem("recovibeCurrentUser");
    window.location.href = "StudentLogin.html";
  });

  const categoryChoices = document.getElementById("categoryChoices");
  const sourceChoices = document.getElementById("sourceChoices");
  const renderChoices = (container, items, selected) => {
    container.innerHTML = items
      .map(
        (item) =>
          `<button type="button" class="choice${selected.includes(item) ? " is-selected" : ""}" data-choice="${item}"><span>${item}</span><span class="choice-mark">${selected.includes(item) ? "✓" : "+"}</span></button>`,
      )
      .join("");
  };
  const openEditor = () => {
    renderChoices(categoryChoices, categories, preferences.categories);
    renderChoices(sourceChoices, sources, preferences.sources);
    document.getElementById("preferenceEditor").hidden = false;
    document.getElementById("editPreferences").hidden = true;
  };
  document
    .getElementById("editPreferences")
    .addEventListener("click", openEditor);
  document.getElementById("cancelPreferences").addEventListener("click", () => {
    document.getElementById("preferenceEditor").hidden = true;
    document.getElementById("editPreferences").hidden = false;
  });
  document.addEventListener("click", (event) => {
    const choice = event.target.closest(".choice");
    if (!choice) return;
    choice.classList.toggle("is-selected");
    choice.querySelector(".choice-mark").textContent =
      choice.classList.contains("is-selected") ? "✓" : "+";
  });
  document.getElementById("savePreferences").addEventListener("click", () => {
    preferences = {
      categories: [
        ...categoryChoices.querySelectorAll(".choice.is-selected"),
      ].map((item) => item.dataset.choice),
      sources: [...sourceChoices.querySelectorAll(".choice.is-selected")].map(
        (item) => item.dataset.choice,
      ),
    };
    localStorage.setItem(preferenceKey, JSON.stringify(preferences));
    localStorage.setItem(accountPreferenceKey, JSON.stringify(preferences));
    user.preferences = preferences;
    localStorage.setItem("recovibeCurrentUser", JSON.stringify(user));
    if (isFirebaseConfigured && db && user.uid) {
      updateDoc(doc(db, "studentUser", user.uid), { preferences }).catch(
        (error) => {
          console.error(
            "Student preferences could not be saved to the account:",
            error,
          );
          const toast = document.getElementById("toast");
          toast.textContent =
            "Preferences saved on this device, but not to your account.";
          toast.classList.add("is-visible");
        },
      );
    }
    renderSummary(
      "categorySummary",
      preferences.categories,
      "No categories selected.",
    );
    renderSummary("sourceSummary", preferences.sources, "No sources selected.");
    document.getElementById("cancelPreferences").click();
    const toast = document.getElementById("toast");
    toast.textContent = "Preferences saved.";
    toast.classList.add("is-visible");
    setTimeout(() => toast.classList.remove("is-visible"), 2200);
  });
})();
