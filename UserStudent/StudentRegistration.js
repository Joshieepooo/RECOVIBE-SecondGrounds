import {
  createUserWithEmailAndPassword,
  deleteUser,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, isFirebaseConfigured } from "./firebaseConfig.js";
import {
  isValidContactNumber,
  isValidEmail,
  isValidName,
  isValidPassword,
  isValidStudentNumber,
  normalizeName,
  normalizePhone,
  normalizeStudentNumber,
  normalizeYear,
  passwordRules,
  protectContactPrefix,
  yearPattern,
} from "./accountValidation.js";

const form = document.getElementById("student-registration-form");
const submitButton = document.getElementById("create-account");
const fields = {
  lastName: document.getElementById("reg-lastname"),
  firstName: document.getElementById("reg-firstname"),
  middleName: document.getElementById("reg-middlename"),
  studentId: document.getElementById("reg-student-id"),
  email: document.getElementById("reg-email"),
  contact: document.getElementById("reg-contact"),
  year: document.getElementById("reg-year"),
  department: document.getElementById("reg-department"),
  organization: document.getElementById("reg-organization"),
  password: document.getElementById("reg-pass"),
  confirmation: document.getElementById("reg-confirm"),
};

window.enhanceDropdownSelects?.("#reg-department, #reg-organization");
const noMiddleNameBox = document.getElementById("no-middle-name");
const touchedFields = new Set();
let submitted = false;

function setInvalid(fieldId, invalid, message = "") {
  const field = document.getElementById(fieldId);
  const control = field.querySelector("input, select");
  const error =
    field.querySelector(".error-msg") ||
    document.getElementById(`${fieldId.replace("field-", "")}-error`);
  field.classList.toggle("invalid", invalid);
  error.classList.toggle("visible", invalid);
  error.textContent = invalid ? message : "";
  if (invalid) control.setAttribute("aria-invalid", "true");
  else control.removeAttribute("aria-invalid");

  const customButton = field.querySelector(
    ".native-filter-dropdown .filter-button",
  );
  if (customButton) {
    if (invalid) {
      customButton.setAttribute("aria-invalid", "true");
      customButton.setAttribute("aria-describedby", error.id);
    } else {
      customButton.removeAttribute("aria-invalid");
      customButton.removeAttribute("aria-describedby");
    }
    if (control.title) customButton.title = control.title;
  }
}

function valueOf(control) {
  return control.value.trim();
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

function updatePasswordChecklist() {
  const password = fields.password.value;
  passwordRules.forEach(([rule, test]) => {
    const item = document.querySelector(
      `#reg-pass-checklist [data-rule="${rule}"]`,
    );
    const met = test(password);
    item.classList.toggle("met", met);
    item.setAttribute(
      "aria-label",
      `${item.textContent.trim()}${met ? " met" : " required"}`,
    );
  });
}

function validateField(name) {
  const value = valueOf(fields[name]);

  if (name === "lastName" || name === "firstName") {
    const label = name === "lastName" ? "Last name" : "First name";
    const fieldId =
      name === "lastName" ? "field-reg-lastname" : "field-reg-firstname";
    if (!value) {
      setInvalid(fieldId, true, `Enter your ${label.toLowerCase()}.`);
      return false;
    }
    const valid = isValidName(value);
    setInvalid(fieldId, !valid, "Use 2–50 valid name characters.");
    return valid;
  }

  if (name === "middleName") {
    if (noMiddleNameBox.checked) {
      setInvalid("field-reg-middlename", false);
      return true;
    }
    const valid = isValidName(value);
    setInvalid(
      "field-reg-middlename",
      !valid,
      value
        ? "Use 2–50 valid name characters."
        : "Enter middle name or check box.",
    );
    return valid;
  }

  if (name === "email") {
    const email = value.toLowerCase();
    const valid = Boolean(email) && isValidEmail(email);
    setInvalid(
      "field-reg-email",
      !valid,
      email ? "Enter a valid email address." : "Email is required.",
    );
    return valid;
  }

  if (name === "studentId") {
    const valid = isValidStudentNumber(value);
    setInvalid("field-reg-student-id", !valid, "Enter a valid student number.");
    return valid;
  }

  if (name === "contact") {
    const valid = isValidContactNumber(value);
    setInvalid(
      "field-reg-contact",
      !valid,
      "Enter a valid 11-digit contact number.",
    );
    return valid;
  }

  if (name === "year") {
    const valid = yearPattern.test(value);
    setInvalid("field-reg-year", !valid, "Enter year and section like 2-3.");
    return valid;
  }

  if (name === "department" || name === "organization") {
    const fieldId = `field-reg-${name}`;
    const valid = Boolean(fields[name].value);
    setInvalid(fieldId, !valid, `Select your ${name}.`);
    return valid;
  }

  if (name === "password") {
    const rawValue = fields.password.value;
    const valid = isValidPassword(rawValue);
    setInvalid("field-reg-pass", !valid, "");
    updatePasswordChecklist();
    return valid;
  }

  if (name === "confirmation") {
    const valid =
      Boolean(fields.confirmation.value) &&
      fields.confirmation.value === fields.password.value;
    setInvalid("field-reg-confirm", !valid, "Passwords do not match.");
    return valid;
  }

  return true;
}

const fieldOrder = [
  "lastName",
  "firstName",
  "middleName",
  "email",
  "studentId",
  "contact",
  "department",
  "year",
  "organization",
  "password",
  "confirmation",
];

function validateAll() {
  const results = fieldOrder.map((name) => ({
    name,
    valid: validateField(name),
  }));
  const invalidName = results.find((result) => !result.valid)?.name;
  if (!invalidName) return true;

  const field = fields[invalidName].closest(".field");
  const focusTarget =
    field.querySelector(".native-filter-dropdown .filter-button") ||
    fields[invalidName];
  focusTarget.scrollIntoView({ behavior: "smooth", block: "center" });
  focusTarget.focus();
  return false;
}

function updateLiveValidation(name) {
  if (
    submitted ||
    touchedFields.has(name) ||
    fields[name].closest(".field").classList.contains("invalid")
  ) {
    validateField(name);
  }
  if (
    name === "password" &&
    (submitted ||
      touchedFields.has("confirmation") ||
      Boolean(fields.confirmation.value) ||
      fields.confirmation.closest(".field").classList.contains("invalid"))
  ) {
    validateField("confirmation");
  }
}

protectContactPrefix(fields.contact);

fields.year.addEventListener("paste", (event) => {
  const pasted = event.clipboardData?.getData("text") || "";
  if (!/^[1-5](?:-?[1-5])?$/.test(pasted)) {
    event.preventDefault();
    return;
  }
  event.preventDefault();
  fields.year.value = normalizeYear(pasted);
  fields.year.setSelectionRange(
    fields.year.value.length,
    fields.year.value.length,
  );
  fields.year.dispatchEvent(new Event("input", { bubbles: true }));
});

Object.entries(fields).forEach(([name, control]) => {
  const normalize = () => {
    if (name === "lastName" || name === "firstName" || name === "middleName") {
      normalizeWithCaret(control, normalizeName);
    } else if (name === "email") {
      normalizeWithCaret(control, (value) => value.toLowerCase());
    } else if (name === "studentId") {
      normalizeWithCaret(control, normalizeStudentNumber);
    } else if (name === "year") {
      normalizeWithCaret(control, normalizeYear);
    }
  };

  if (control.tagName === "SELECT") {
    control.addEventListener("change", () => {
      touchedFields.add(name);
      const selected = control.selectedOptions[0];
      control.title = selected?.title || selected?.textContent.trim() || "";
      updateLiveValidation(name);
    });
    control.addEventListener("blur", () => {
      touchedFields.add(name);
      updateLiveValidation(name);
    });
  } else {
    control.addEventListener("input", () => {
      normalize();
      if (name === "password") updatePasswordChecklist();
      updateLiveValidation(name);
    });
    control.addEventListener("blur", () => {
      normalize();
      if (
        name === "lastName" ||
        name === "firstName" ||
        name === "middleName" ||
        name === "email" ||
        name === "studentId"
      ) {
        control.value = control.value.trim();
      }
      if (name === "email") control.value = control.value.toLowerCase();
      touchedFields.add(name);
      updateLiveValidation(name);
    });
  }

  const customButton = control
    .closest(".field")
    .querySelector(".native-filter-dropdown .filter-button");
  if (customButton) {
    customButton.addEventListener("blur", () => {
      touchedFields.add(name);
      updateLiveValidation(name);
    });

    customButton.title =
      control.selectedOptions[0]?.title ||
      control.selectedOptions[0]?.textContent.trim() ||
      "";
  }
});

noMiddleNameBox.addEventListener("change", () => {
  fields.middleName.disabled = noMiddleNameBox.checked;
  fields.middleName.setAttribute(
    "aria-disabled",
    String(noMiddleNameBox.checked),
  );
  if (noMiddleNameBox.checked) {
    fields.middleName.value = "";
    touchedFields.add("middleName");
    setInvalid("field-reg-middlename", false);
  } else if (submitted || touchedFields.has("middleName")) {
    fields.middleName.focus();
    validateField("middleName");
  }
});

fields.middleName.setAttribute("aria-disabled", "false");
updatePasswordChecklist();

document.querySelectorAll(".toggle-password").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.target);
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    button.querySelector(".icon-eye").style.display = showing ? "" : "none";
    button.querySelector(".icon-eye-off").style.display = showing ? "none" : "";
    button.setAttribute(
      "aria-label",
      showing ? "Show password" : "Hide password",
    );
  });
});

function registrationErrorMessage(error) {
  const detail = String(error?.message || "");
  if (detail.toLowerCase().includes("student number is already registered")) {
    return "This student number is already registered.";
  }
  if (detail.toLowerCase().includes("already exists with this email")) {
    return "This email is already registered.";
  }
  switch (error.code?.replace(/^functions\//, "")) {
    case "auth/email-already-in-use":
    case "already-exists":
      return "This email is already registered.";
    case "auth/weak-password":
      return "";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/operation-not-allowed":
      return "Student registration is unavailable right now. Please contact support.";
    case "invalid-argument":
      return detail || "Check the highlighted fields and try again.";
    case "auth/network-request-failed":
      return "A network error occurred. Check your connection and try again.";
    case "permission-denied":
    case "firestore/permission-denied":
      return "We couldn't save your account. Please try again or contact support.";
    default:
      return "We couldn't create your account right now. Please try again.";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitted = true;
  document.getElementById("registration-form-error").textContent = "";
  fields.lastName.value = fields.lastName.value.trim();
  fields.firstName.value = fields.firstName.value.trim();
  fields.lastName.value = normalizeName(fields.lastName.value);
  fields.firstName.value = normalizeName(fields.firstName.value);
  fields.middleName.value = normalizeName(fields.middleName.value.trim());
  fields.email.value = fields.email.value.trim().toLowerCase();
  fields.studentId.value = normalizeStudentNumber(
    fields.studentId.value.trim(),
  );
  fields.contact.value = normalizePhone(fields.contact.value);
  fields.year.value = normalizeYear(fields.year.value);
  if (!validateAll()) return;

  if (!isFirebaseConfigured || !auth || !db) {
    document.getElementById("registration-form-error").textContent =
      "Student registration is not configured yet. Please contact support.";
    return;
  }

  const lastName = valueOf(fields.lastName);
  const firstName = valueOf(fields.firstName);
  const middleName = noMiddleNameBox.checked ? "" : valueOf(fields.middleName);
  const email = valueOf(fields.email).toLowerCase();
  const studentNumber = valueOf(fields.studentId);
  const contactNumber = valueOf(fields.contact);
  const department =
    fields.department.selectedOptions?.[0]?.textContent.trim() ||
    valueOf(fields.department);
  const year = valueOf(fields.year);
  const organization = fields.organization.value;

  submitButton.disabled = true;
  submitButton.setAttribute("aria-busy", "true");
  submitButton.textContent = "Creating account...";

  let createdUser;
  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      fields.password.value,
    );
    createdUser = credential.user;
    const fullName = [firstName, middleName, lastName]
      .filter(Boolean)
      .join(" ");
    const profile = {
      uid: createdUser.uid,
      firstName,
      middleName,
      lastName,
      fullName,
      name: fullName,
      email,
      studentNumber,
      studentId: studentNumber,
      accountNo: studentNumber,
      contactNumber,
      department,
      year,
      organization,
      role: "student",
      status: "Active",
      isActive: true,
      preferences: {
        categories: ["Academic & Learning", "Tech & Innovation"],
        sources: [
          "PUP Official",
          "CSC",
          "Teacher / Faculty",
          "Organizational",
          "Others / External",
        ],
      },
      createdAt: serverTimestamp(),
    };
    const studentNumberRef = doc(db, "student_number_claims", studentNumber);
    await runTransaction(db, async (transaction) => {
      const existingClaim = await transaction.get(studentNumberRef);
      if (existingClaim.exists()) {
        throw Object.assign(
          new Error("This student number is already registered."),
          {
            code: "registration/student-number-already-in-use",
          },
        );
      }
      transaction.set(studentNumberRef, {
        studentNumber,
        createdBy: createdUser.uid,
        uid: createdUser.uid,
        state: "active",
        createdAt: serverTimestamp(),
      });
      transaction.set(doc(db, "studentUser", createdUser.uid), profile);
    });

    localStorage.setItem(
      "recovibeCurrentUser",
      JSON.stringify({ ...profile, createdAt: new Date().toISOString() }),
    );
    window.location.assign("Dashboard.html");
  } catch (error) {
    console.error("Registration error:", error);
    if (createdUser) {
      await deleteUser(createdUser).catch((cleanupError) => {
        console.error(
          "Unable to remove Auth user after registration failed:",
          cleanupError,
        );
      });
    }
    const message = registrationErrorMessage(error);
    if (
      error.code === "auth/email-already-in-use" ||
      message === "This email is already registered."
    ) {
      setInvalid("field-reg-email", true, message);
      fields.email.focus();
    } else if (message === "This student number is already registered.") {
      setInvalid("field-reg-student-id", true, message);
      fields.studentId.focus();
    } else if (message.toLowerCase().includes("password")) {
      setInvalid("field-reg-pass", true, message);
      fields.password.focus();
    } else if (error.code === "auth/invalid-email") {
      setInvalid("field-reg-email", true, message);
      fields.email.focus();
    } else {
      document.getElementById("registration-form-error").textContent = message;
    }
  } finally {
    submitButton.disabled = false;
    submitButton.removeAttribute("aria-busy");
    submitButton.textContent = "Create account";
  }
});
