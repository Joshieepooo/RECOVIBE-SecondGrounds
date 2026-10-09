import {
  deleteApp,
  getApp,
  initializeApp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  auth,
  db,
  isFirebaseConfigured,
} from "../UserStudent/firebaseConfig.js";
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
  protectContactPrefix,
} from "../UserStudent/accountValidation.js";

(() => {
  "use strict";

  const tableBody = document.getElementById("user-table-tbody");
  const roleDialog = document.getElementById("account-type-dialog");
  const createDialog = document.getElementById("create-user-dialog");
  const detailsDialog = document.getElementById("user-details-modal-backdrop");
  const createForm = document.getElementById("create-user-form");
  const createFields = document.getElementById("create-user-fields");
  const createError = document.getElementById("create-user-error");
  const statusButton = document.getElementById("toggle-user-status-button");
  const deleteButton = document.getElementById("delete-user-button");
  const toast = document.getElementById("user-management-status");
  let studentsList = [];
  let staffList = [];
  let selectedUserId = null;
  let selectedUserCollection = null;
  let selectedAccountType = null;
  let accountNumberPreview = null;
  let returnToAccountTypeDialog = false;
  let unsubscribeStudents;
  let unsubscribeStaff;

  function showMessage(message, isError = false) {
    if (!toast) return;
    toast.textContent = message;
    toast.dataset.state = isError ? "error" : "success";
    toast.hidden = false;
  }

  function stringValue(value, fallback = "") {
    return value == null ? fallback : String(value);
  }

  const fieldId = (name) => `new-user-${name}`;

  const sequenceKeys = {
    EventOrganizer: "eventOrganizer",
    Teacher: "teacher",
    Admin: "admin",
    SuperAdmin: "superAdmin",
  };

  function sequenceFromProfile(type, profile) {
    const patterns = {
      EventOrganizer: /^EO-(\d{3,})-/i,
      Teacher: /^Teacher-(\d{3,})$/i,
      Admin: /^Admin-(\d{3,})-/i,
      SuperAdmin: /^SA-(\d{3,})$/i,
    };
    const match = String(profile.accountNo || profile.accountId || "").match(
      patterns[type],
    );
    return match ? Number(match[1]) : 0;
  }

  async function existingAccountSequenceMaximum(type) {
    const sequenceKey = sequenceKeys[type];
    if (!sequenceKey) throw new Error("This account type has no generated ID.");
    const collections =
      type === "SuperAdmin" ? ["adminUser", "users"] : ["adminUser"];
    const snapshots = await Promise.all([
      ...collections.map((name) => getDocs(collection(db, name))),
      getDocs(collection(db, "account_ids")),
    ]);
    const profileMaximum = snapshots
      .slice(0, collections.length)
      .reduce(
        (maximum, snapshot) =>
          snapshot.docs.reduce(
            (next, profile) =>
              Math.max(next, sequenceFromProfile(type, profile.data())),
            maximum,
          ),
        0,
      );
    const activeIds = snapshots[collections.length].docs
      .map((accountId) => accountId.data())
      .filter((accountId) => accountId.state === "active");
    const activeAccountNumbers = new Set(
      activeIds.map((accountId) => accountId.accountNo),
    );
    const ledgerMaximum = activeIds.reduce(
      (maximum, accountId) =>
        Math.max(maximum, sequenceFromProfile(type, accountId)),
      0,
    );
    return {
      maximum: Math.max(profileMaximum, ledgerMaximum),
      activeAccountNumbers,
    };
  }

  async function previewNextAccountSequence(type) {
    const sequenceKey = sequenceKeys[type];
    const sequenceState = await existingAccountSequenceMaximum(type);
    const sequenceSnapshot = await getDoc(doc(db, "id_sequences", sequenceKey));
    const sequenceData = sequenceSnapshot.data() || {};
    const lastAccountNo = String(sequenceData.lastAccountNo || "");
    const counterValue = Number(sequenceData.value) || 0;
    const counterIsBackedByAccount =
      sequenceState.activeAccountNumbers.has(lastAccountNo) &&
      sequenceFromProfile(type, { accountNo: lastAccountNo }) === counterValue;
    const current = Math.max(
      sequenceState.maximum,
      counterIsBackedByAccount ? counterValue : 0,
    );
    return current + 1;
  }

  function generatedAccountNumber(type, sequence, suffix = "") {
    const formattedSequence = String(sequence).padStart(3, "0");
    const prefix = {
      EventOrganizer: `EO-${formattedSequence}`,
      Teacher: `Teacher-${formattedSequence}`,
      Admin: `Admin-${formattedSequence}`,
      SuperAdmin: `SA-${formattedSequence}`,
    }[type];
    return [prefix, suffix.trim().toUpperCase()].filter(Boolean).join("-");
  }

  function inputField(name, label, type = "text", attributes = "") {
    return `<label class="form-field" for="${fieldId(name)}"><span>${label}</span><input id="${fieldId(name)}" name="${name}" type="${type}" ${attributes}><small class="field-error" data-error-for="${name}"></small></label>`;
  }

  function replaceWithSelect(name, label, options) {
    const input = createFields.querySelector(`[name="${name}"]`);
    const select = document.createElement("select");
    select.id = input.id;
    select.name = name;
    select.required = true;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = `Select ${label.toLowerCase()}`;
    select.append(placeholder);
    options.forEach(([value, text]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      select.append(option);
    });
    input.replaceWith(select);
  }

  function namesMarkup(student = false) {
    const firstName = inputField(
      "firstName",
      "First Name",
      "text",
      'autocomplete="given-name" minlength="2" maxlength="50" required',
    );
    const middleName = inputField(
      "middleName",
      "Middle Name",
      "text",
      'autocomplete="additional-name" minlength="2" maxlength="50" required',
    );
    const lastName = inputField(
      "lastName",
      "Last Name",
      "text",
      'autocomplete="family-name" minlength="2" maxlength="50" required',
    );
    const middleNameOption =
      '<label class="form-field middle-name-option"><span>Middle name</span><span class="checkbox-row"><input id="no-middle-name" type="checkbox"> I don\'t have a middle name</span></label>';
    return student
      ? `${lastName}${firstName}${middleName}${middleNameOption}`
      : `${firstName}${middleName}${middleNameOption}${lastName}`;
  }

  function roleMarkup(role) {
    return inputField(
      "roleDisplay",
      "Role",
      "text",
      `value="${role}" readonly`,
    );
  }

  function accountPreviewMarkup() {
    return inputField(
      "accountPreview",
      "Account Number",
      "text",
      'autocomplete="off" readonly aria-live="polite"',
    );
  }

  function studentFieldsMarkup() {
    return `${namesMarkup(true)}${inputField("email", "Email", "email", 'autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" maxlength="254" required')}${inputField("studentNumber", "Student Number", "text", 'placeholder="Enter Student Number" minlength="15" maxlength="15" pattern="[0-9]{4}-[0-9]{5}-[A-Za-z]{2}-[0-9]" autocomplete="username" required')}${inputField("contactNumber", "Contact Number", "tel", 'value="09" inputmode="numeric" maxlength="11" pattern="09[0-9]{9}" autocomplete="tel" required')}${inputField("department", "Department", "text", 'list="student-departments" required')}<datalist id="student-departments"><option value="BSIT"><option value="BSCPE"><option value="BSBA"><option value="BSOA"><option value="BSHM"><option value="Other"></datalist>${inputField("year", "Year and Section", "text", 'placeholder="2-3" maxlength="3" pattern="[1-5]-[1-5]" required')}${inputField("organization", "Organization", "text", 'list="student-organizations" required')}<datalist id="student-organizations"><option value="IBITS"><option value="ORG"><option value="None"></datalist>${inputField("password", "Password", "password", 'autocomplete="new-password" minlength="8" maxlength="64" required')}${inputField("passwordConfirmation", "Confirm Password", "password", 'autocomplete="new-password" minlength="8" maxlength="64" required')}`;
  }

  function staffFieldsMarkup(type) {
    const role = {
      EventOrganizer: "EO",
      Teacher: "Teacher",
      Admin: "Admin",
      SuperAdmin: "Super Admin",
    }[type];
    const isEo = type === "EventOrganizer";
    const isAdmin = type === "Admin";
    let accountExtras = "";
    if (isEo) {
      accountExtras = `${inputField("organization", "Organization", "text", 'list="eo-organizations" value="IBITS" maxlength="24" required')}<datalist id="eo-organizations"><option value="IBITS"><option value="ACES"><option value="CSC"></datalist>`;
    } else if (isAdmin) {
      accountExtras = `${inputField("title", "Role Suffix", "text", 'list="admin-role-suffixes" value="HAP" maxlength="24" required')}<datalist id="admin-role-suffixes"><option value="HAP"><option value="Head-of-Academic-Programs"></datalist>`;
    }
    return `${namesMarkup()}${accountPreviewMarkup()}${roleMarkup(role)}${accountExtras}${inputField("email", "Email", "email", 'autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" maxlength="254" required')}${inputField("contactNumber", "Contact Number", "tel", 'value="09" inputmode="numeric" maxlength="11" pattern="09[0-9]{9}" autocomplete="tel" required')}${inputField("password", "Password", "password", 'autocomplete="new-password" minlength="8" maxlength="64" required')}${inputField("passwordConfirmation", "Confirm Password", "password", 'autocomplete="new-password" minlength="8" maxlength="64" required')}`;
  }

  function setFieldError(name, message) {
    const input = createFields.querySelector(`[name="${name}"]`);
    const error = createFields.querySelector(`[data-error-for="${name}"]`);
    if (!input || !error) return;
    input.setAttribute("aria-invalid", String(Boolean(message)));
    error.textContent = message;
    error.hidden = !message;
  }

  function updateAccountPreview() {
    if (selectedAccountType === "Student") {
      return;
    }
    const preview = createFields.querySelector('[name="accountPreview"]');
    if (!preview) return;
    if (!accountNumberPreview) {
      preview.value = "Checking existing account numbers";
      return;
    }
    const sequence = String(accountNumberPreview.sequence).padStart(3, "0");
    const suffix =
      createFields.querySelector('[name="organization"]')?.value.trim() ||
      createFields.querySelector('[name="title"]')?.value.trim() ||
      "";
    const prefix = {
      EventOrganizer: `EO-${sequence}`,
      Teacher: `Teacher-${sequence}`,
      Admin: `Admin-${sequence}`,
      SuperAdmin: `SA-${sequence}`,
    }[selectedAccountType];
    preview.value = [prefix, suffix.toUpperCase()].filter(Boolean).join("-");
  }

  function renderCreateForm(type, preview = null) {
    selectedAccountType = type;
    createError.hidden = true;
    createError.textContent = "";
    accountNumberPreview = preview;
    createFields.innerHTML =
      type === "Student" ? studentFieldsMarkup() : staffFieldsMarkup(type);
    if (type === "Student") {
      replaceWithSelect("department", "Department", [
        ["BSIT", "Bachelor of Science in Information Technology (BSIT)"],
        ["BSCPE", "Bachelor of Science in Computer Engineering (BSCPE)"],
        ["BSBA", "Bachelor of Science in Business Administration (BSBA)"],
        ["BSOA", "Bachelor of Science in Office Administration (BSOA)"],
        ["BSHM", "Bachelor of Science in Hospitality Management (BSHM)"],
        ["Other", "Other"],
      ]);
      replaceWithSelect("organization", "Organization", [
        ["IBITS", "IBITS"],
        ["ORG", "ORG"],
        ["None", "None"],
      ]);
      createFields
        .querySelectorAll("datalist")
        .forEach((list) => list.remove());
    }
    const noMiddleName = createFields.querySelector("#no-middle-name");
    const middleName = createFields.querySelector('[name="middleName"]');
    noMiddleName.addEventListener("change", () => {
      middleName.disabled = noMiddleName.checked;
      middleName.required = !noMiddleName.checked;
      if (noMiddleName.checked) {
        middleName.value = "";
        setFieldError("middleName", "");
      }
    });
    protectContactPrefix(createFields.querySelector('[name="contactNumber"]'));
    createFields.oninput = (event) => {
      const control = event.target;
      if (["firstName", "middleName", "lastName"].includes(control.name)) {
        control.value = normalizeName(control.value);
      } else if (control.name === "email") {
        control.value = control.value.toLowerCase();
      } else if (control.name === "studentNumber") {
        control.value = normalizeStudentNumber(control.value);
      } else if (control.name === "year") {
        control.value = normalizeYear(control.value);
      } else if (["organization", "title"].includes(control.name)) {
        control.value = control.value.toUpperCase();
      }
      if (["organization", "title"].includes(control.name))
        updateAccountPreview();
    };
    createFields.onchange = updateAccountPreview;
    updateAccountPreview();
  }

  function normalizeUser(userId, data, collectionName) {
    const familyFirstName = [data.lastName, data.firstName]
      .map((value) => stringValue(value).trim())
      .filter(Boolean)
      .join(" ");
    const fullName =
      data.fullName ||
      familyFirstName ||
      data.name ||
      data.displayName ||
      "Unnamed User";
    const accountNumber =
      data.studentNumber || data.accountNo || data.studentNo || "—";
    const status = data.status || (data.isActive ? "Active" : "Inactive");

    return {
      ...data,
      id: userId,
      collectionName,
      fullName: stringValue(fullName, "Unnamed User"),
      accountNumber: stringValue(accountNumber, "—"),
      email: stringValue(data.email, "—"),
      role: stringValue(
        data.role || (collectionName === "studentUser" ? "Student" : "Staff"),
      ),
      status,
      contactNumber: stringValue(data.contactNumber || data.phone),
      department: stringValue(data.department || data.course || data.program),
      yearSection: stringValue(data.yearSection || data.section),
      organization: stringValue(data.organization || data.org),
    };
  }

  function createCell(label, value, emphasize = false) {
    const cell = document.createElement("td");
    cell.dataset.label = label;
    if (emphasize) {
      const strong = document.createElement("strong");
      strong.textContent = value;
      cell.append(strong);
    } else {
      cell.textContent = value;
    }
    return cell;
  }

  function renderUsers() {
    const allUsers = [...studentsList, ...staffList];
    tableBody.replaceChildren();
    if (!allUsers.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 6;
      cell.className = "user-table-empty";
      cell.textContent = "No user accounts to display.";
      row.append(cell);
      tableBody.append(row);
      return;
    }

    allUsers.forEach((user) => {
      const row = document.createElement("tr");
      row.id = `user-row-${user.collectionName}-${user.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
      row.dataset.id = user.id;
      row.dataset.collection = user.collectionName;
      row.append(
        createCell("User", user.fullName, true),
        createCell("Account No.", user.accountNumber, true),
        createCell("Email", user.email),
        createCell("Role", user.role),
      );
      const statusCell = document.createElement("td");
      statusCell.dataset.label = "Status";
      const statusPill = document.createElement("span");
      const statusClass = user.status.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      statusPill.className = `user-status-pill status-${statusClass}`;
      statusPill.textContent = user.status;
      statusCell.append(statusPill);
      row.append(statusCell);

      const actionCell = document.createElement("td");
      actionCell.dataset.label = "Action";
      const viewButton = document.createElement("button");
      viewButton.className = "user-view-button";
      viewButton.type = "button";
      viewButton.dataset.id = user.id;
      viewButton.dataset.collection = user.collectionName;
      viewButton.textContent = "View";
      viewButton.setAttribute("aria-label", `View ${user.fullName}`);
      actionCell.append(viewButton);
      row.append(actionCell);
      tableBody.append(row);
    });
  }

  function handleUsersSnapshot(collectionName, snapshot) {
    const mappedUsers = snapshot.docs.map((userDocument) =>
      normalizeUser(userDocument.id, userDocument.data(), collectionName),
    );
    if (collectionName === "studentUser") {
      studentsList = mappedUsers;
    } else {
      staffList = mappedUsers;
    }
    renderUsers();

    const selectedUser = [...studentsList, ...staffList].find(
      (user) =>
        user.id === selectedUserId &&
        user.collectionName === selectedUserCollection,
    );
    if (selectedUser && detailsDialog.open) populateDetails(selectedUser);
  }

  function displayValue(value) {
    return value?.trim() || "Not provided";
  }

  function populateDetails(user) {
    document.getElementById("user-details-name").textContent = user.fullName;
    document.getElementById("user-details-role").textContent = user.role;
    document.getElementById("user-details-status").textContent = user.status;
    document.getElementById("user-detail-full-name").textContent =
      user.fullName;
    document.getElementById("user-detail-account-number").textContent =
      user.accountNumber;
    document.getElementById("user-detail-email").textContent = user.email;
    document.getElementById("user-detail-contact").textContent = displayValue(
      user.contactNumber,
    );
    document.getElementById("user-detail-department").textContent =
      displayValue(user.department);
    document.getElementById("user-detail-year-section").textContent =
      displayValue(user.yearSection);
    document.getElementById("user-detail-organization").textContent =
      displayValue(user.organization);
    document.getElementById("user-detail-role").textContent = user.role;
    statusButton.textContent =
      user.status === "Active" ? "Suspend Account" : "Activate Account";
    document.getElementById("view-user-activity").href =
      `SuperAdminAuditLogs.html?user=${encodeURIComponent(user.id)}`;
  }

  async function openDetails(userId, collectionName) {
    try {
      const snapshot = await getDoc(doc(db, collectionName, userId));
      if (!snapshot.exists()) {
        showMessage("This user record no longer exists.", true);
        return;
      }
      const user = normalizeUser(snapshot.id, snapshot.data(), collectionName);
      selectedUserId = snapshot.id;
      selectedUserCollection = collectionName;
      populateDetails(user);
      detailsDialog.showModal();
    } catch (error) {
      console.error("Unable to fetch user document:", error);
      showMessage("Could not load user details. Please try again.", true);
    }
  }

  function validateCreateForm() {
    createError.hidden = true;
    createError.textContent = "";
    createFields.querySelectorAll("[data-error-for]").forEach((error) => {
      error.textContent = "";
      error.hidden = true;
    });
    createFields.querySelectorAll("[aria-invalid=true]").forEach((input) => {
      input.removeAttribute("aria-invalid");
    });

    let firstInvalid = null;
    const invalidate = (name, message) => {
      setFieldError(name, message);
      firstInvalid ||= createFields.querySelector(`[name="${name}"]`);
    };
    createFields.querySelectorAll("[required]").forEach((input) => {
      if (!input.disabled && !input.value.trim()) {
        invalidate(input.name, "This field is required.");
      }
    });

    ["firstName", "middleName", "lastName"].forEach((name) => {
      const input = createFields.querySelector(`[name="${name}"]`);
      if (
        input &&
        !input.disabled &&
        input.value &&
        !isValidName(input.value.trim())
      ) {
        invalidate(name, "Use 2–50 valid name characters.");
      }
    });
    const email = createFields.querySelector('[name="email"]');
    if (email?.value && !isValidEmail(email.value.trim().toLowerCase())) {
      invalidate("email", "Enter a valid email address.");
    }
    const contact = createFields.querySelector('[name="contactNumber"]');
    if (contact?.value && !isValidContactNumber(contact.value.trim())) {
      invalidate("contactNumber", "Enter a valid 11-digit contact number.");
    }
    const password = createFields.querySelector('[name="password"]');
    const confirmation = createFields.querySelector(
      '[name="passwordConfirmation"]',
    );
    if (password?.value && !isValidPassword(password.value)) {
      invalidate(
        "password",
        "Use 8–64 characters with uppercase and lowercase letters, a number, and a special character. Do not use spaces.",
      );
    }
    if (confirmation?.value && confirmation.value !== password?.value) {
      invalidate("passwordConfirmation", "Passwords do not match.");
    }
    const studentNumber = createFields.querySelector('[name="studentNumber"]');
    if (
      studentNumber?.value &&
      !isValidStudentNumber(studentNumber.value.trim())
    ) {
      invalidate("studentNumber", "Enter a valid student number.");
    }
    const year = createFields.querySelector('[name="year"]');
    if (year?.value && !/^[1-5]-[1-5]$/.test(year.value.trim())) {
      invalidate("year", "Enter year and section like 2-3.");
    }
    const suffixField = createFields.querySelector(
      '[name="organization"], [name="title"]',
    );
    if (
      suffixField?.value &&
      !/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(suffixField.value.trim())
    ) {
      invalidate(
        suffixField.name,
        "Use letters and numbers, with hyphens between words.",
      );
    }

    if (firstInvalid) {
      firstInvalid.focus();
      return null;
    }

    const values = new FormData(createForm);
    return {
      accountType: selectedAccountType,
      firstName: stringValue(values.get("firstName")).trim(),
      middleName: createFields.querySelector("#no-middle-name")?.checked
        ? ""
        : stringValue(values.get("middleName")).trim(),
      lastName: stringValue(values.get("lastName")).trim(),
      email: stringValue(values.get("email")).trim().toLowerCase(),
      contactNumber: stringValue(values.get("contactNumber")).trim(),
      studentNumber: stringValue(values.get("studentNumber"))
        .trim()
        .toUpperCase(),
      department:
        createFields
          .querySelector('[name="department"]')
          ?.selectedOptions?.[0]?.textContent.trim() ||
        stringValue(values.get("department")).trim(),
      year: stringValue(values.get("year")).trim(),
      organization: stringValue(values.get("organization")).trim(),
      title: stringValue(values.get("title")).trim(),
      password: stringValue(values.get("password")),
      passwordConfirmation: stringValue(values.get("passwordConfirmation")),
    };
  }

  function accountCreationError(error) {
    const message = String(error?.message || "");
    const normalized = message.toLowerCase();
    if (normalized.includes("student number is already registered")) {
      setFieldError(
        "studentNumber",
        "This student number is already registered.",
      );
      return "This student number is already registered.";
    }
    if (normalized.includes("email") && normalized.includes("already")) {
      setFieldError(
        "email",
        "An account already exists with this email address.",
      );
      return "An account already exists with this email address.";
    }
    if (
      normalized.includes("account id is already in use") ||
      normalized.includes("account number is already in use")
    ) {
      return "That account ID was just reserved by another creation. Select the account type again.";
    }
    if (error?.code === "auth/email-already-in-use") {
      setFieldError(
        "email",
        "An account already exists with this email address.",
      );
      return "An account already exists with this email address.";
    }
    if (error?.code === "permission-denied") {
      return "Firestore denied this account operation. Confirm your Super Admin profile and deployed rules.";
    }
    return message || "Could not create the account. Please try again.";
  }

  function accountProfile(payload, accountNo, uid) {
    const fullName = [payload.firstName, payload.middleName, payload.lastName]
      .filter(Boolean)
      .join(" ");
    const profile = {
      uid,
      firstName: payload.firstName,
      middleName: payload.middleName,
      lastName: payload.lastName,
      fullName,
      name: fullName,
      email: payload.email,
      contactNumber: payload.contactNumber,
      accountNo,
      status: "Active",
      isActive: true,
      createdAt: serverTimestamp(),
    };

    if (payload.accountType === "Student") {
      return {
        ...profile,
        studentNumber: payload.studentNumber,
        role: "student",
        department: payload.department,
        year: payload.year,
        organization: payload.organization,
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
      };
    }

    const role = {
      EventOrganizer: "EO",
      Teacher: "Teacher",
      Admin: "Admin",
      SuperAdmin: "Super Admin",
    }[payload.accountType];
    return {
      ...profile,
      accountType:
        payload.accountType === "EventOrganizer" ? "EO" : payload.accountType,
      role,
      ...(payload.accountType === "EventOrganizer"
        ? {
            organization: payload.organization.toUpperCase(),
            roleName: "Event Organizer",
          }
        : {}),
      ...(payload.accountType === "Admin"
        ? {
            title: payload.title.toUpperCase(),
            roleSuffix: payload.title.toUpperCase(),
          }
        : {}),
    };
  }

  async function createAccountDirectly(payload, targetCollection) {
    if (!auth?.currentUser) {
      throw new Error(
        "Sign in with an authorized Super Admin account to create users.",
      );
    }

    if (payload.accountType === "Student") {
      const matchingStudents = await getDocs(
        query(
          collection(db, "studentUser"),
          where("studentNumber", "==", payload.studentNumber),
          limit(1),
        ),
      );
      if (!matchingStudents.empty) {
        throw new Error("This student number is already registered.");
      }
    }

    const appName = `recovibe-user-provision-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;
    const provisioningApp = initializeApp(getApp().options, appName);
    const provisioningAuth = getAuth(provisioningApp);
    let userCredential;

    try {
      userCredential = await createUserWithEmailAndPassword(
        provisioningAuth,
        payload.email,
        payload.password,
      );
      const profileRef = doc(db, targetCollection, userCredential.user.uid);
      const sequenceRef =
        payload.accountType === "Student"
          ? null
          : doc(db, "id_sequences", sequenceKeys[payload.accountType]);
      const sequenceState = sequenceRef
        ? await existingAccountSequenceMaximum(payload.accountType)
        : null;
      let accountNo = payload.studentNumber;

      await runTransaction(db, async (transaction) => {
        let sequence = 0;
        if (sequenceRef) {
          const sequenceSnapshot = await transaction.get(sequenceRef);
          const sequenceData = sequenceSnapshot.data() || {};
          const lastAccountNo = String(sequenceData.lastAccountNo || "");
          let backedCounterValue = 0;
          if (lastAccountNo) {
            const lastAccountRef = doc(db, "account_ids", lastAccountNo);
            const lastAccountSnapshot = await transaction.get(lastAccountRef);
            const savedSequence = sequenceFromProfile(payload.accountType, {
              accountNo: lastAccountNo,
            });
            if (
              lastAccountSnapshot.exists() &&
              lastAccountSnapshot.data().state === "active" &&
              savedSequence === Number(sequenceData.value)
            ) {
              backedCounterValue = savedSequence;
            }
          }
          sequence = Math.max(sequenceState.maximum, backedCounterValue) + 1;
          const suffix =
            payload.accountType === "EventOrganizer"
              ? payload.organization
              : payload.accountType === "Admin"
                ? payload.title
                : "";
          accountNo = generatedAccountNumber(
            payload.accountType,
            sequence,
            suffix,
          );
        }

        const accountIdRef = doc(
          db,
          payload.accountType === "Student"
            ? "student_number_claims"
            : "account_ids",
          accountNo,
        );
        const existingId = await transaction.get(accountIdRef);
        if (existingId.exists()) {
          throw new Error(
            payload.accountType === "Student"
              ? "This student number is already registered."
              : "This account number is already in use.",
          );
        }
        if (sequenceRef) {
          transaction.set(sequenceRef, {
            value: sequence,
            lastAccountNo: accountNo,
            updatedAt: serverTimestamp(),
          });
        }
        transaction.set(
          accountIdRef,
          payload.accountType === "Student"
            ? {
                studentNumber: accountNo,
                createdBy: auth.currentUser.uid,
                uid: userCredential.user.uid,
                state: "active",
                createdAt: serverTimestamp(),
              }
            : {
                accountNo,
                accountType:
                  payload.accountType === "EventOrganizer"
                    ? "EO"
                    : payload.accountType,
                createdBy: auth.currentUser.uid,
                uid: userCredential.user.uid,
                state: "active",
                createdAt: serverTimestamp(),
              },
        );
        transaction.set(
          profileRef,
          accountProfile(payload, accountNo, userCredential.user.uid),
        );
      });
      return { uid: userCredential.user.uid, accountNo };
    } catch (error) {
      if (userCredential?.user) {
        await deleteUser(userCredential.user).catch((cleanupError) => {
          console.error(
            "Unable to remove Auth user after profile write failed:",
            cleanupError,
          );
        });
      }
      throw error;
    } finally {
      await signOut(provisioningAuth).catch(() => {});
      await deleteApp(provisioningApp).catch(() => {});
    }
  }

  async function createUser(event) {
    event.preventDefault();
    const payload = validateCreateForm();
    if (!payload) return;
    const submitButton = createForm.querySelector('[type="submit"]');
    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");
    try {
      const targetCollection =
        selectedAccountType === "Student" ? "studentUser" : "adminUser";
      const createdAccount = await createAccountDirectly(
        payload,
        targetCollection,
      );
      const createdUserId = createdAccount.uid;
      const accountNo = createdAccount.accountNo;
      const accountTypeLabel = {
        Student: "Student",
        EventOrganizer: "Event Organizer",
        Teacher: "Teacher",
        Admin: "Admin",
        SuperAdmin: "Super Admin",
      }[selectedAccountType];
      createDialog.close();
      try {
        await appendUserAudit(
          `Created new ${accountTypeLabel} account ${accountNo} for ${payload.firstName} ${payload.lastName}`,
          createdUserId,
          targetCollection,
        );
        showMessage(`${accountTypeLabel} account ${accountNo} created.`);
      } catch (auditError) {
        console.error(
          "Account created, but its audit log could not be saved:",
          auditError,
        );
        showMessage(
          "Account created, but its audit record could not be saved.",
          true,
        );
      }
    } catch (error) {
      console.error("Unable to create account:", error);
      createError.textContent = accountCreationError(error);
      createError.hidden = false;
    } finally {
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-busy");
    }
  }

  function superAdminIdentifier() {
    const tag =
      document.querySelector(".account-badge")?.textContent.trim() || "SA1";
    const name =
      document.getElementById("superadmin-name")?.textContent.trim() ||
      "Super Admin";
    return `${tag} – ${name}`;
  }

  async function appendUserAudit(action, targetUserId, targetCollection) {
    await addDoc(collection(db, "audit_logs"), {
      timestamp: serverTimestamp(),
      user: superAdminIdentifier(),
      action,
      category: "User Management",
      targetUserId,
      ...(targetCollection ? { targetCollection } : {}),
    });
  }

  async function toggleUserStatus() {
    const user = [...studentsList, ...staffList].find(
      (item) =>
        item.id === selectedUserId &&
        item.collectionName === selectedUserCollection,
    );
    if (!user || statusButton.disabled || deleteButton.disabled) return;
    const reactivating = user.status.toLowerCase() === "suspended";
    const nextStatus = reactivating ? "Active" : "Suspended";
    statusButton.disabled = true;
    deleteButton.disabled = true;
    try {
      await updateDoc(doc(db, user.collectionName, user.id), {
        status: nextStatus,
        isActive: nextStatus === "Active",
        updatedAt: serverTimestamp(),
      });
      try {
        await appendUserAudit(
          `${reactivating ? "Reactivated" : "Suspended"} account of ${user.fullName}`,
          user.id,
          user.collectionName,
        );
        showMessage(
          `${user.fullName}'s account was ${reactivating ? "reactivated" : "suspended"}.`,
        );
      } catch (auditError) {
        console.error(
          "Status changed, but its audit log could not be saved:",
          auditError,
        );
        showMessage(
          "Status changed, but its audit log could not be saved.",
          true,
        );
      }
      detailsDialog.close();
    } catch (error) {
      console.error("Unable to update user status:", error);
      showMessage("Could not update user status. Please try again.", true);
    } finally {
      statusButton.disabled = false;
      deleteButton.disabled = false;
    }
  }

  async function deleteSelectedUser() {
    const user = [...studentsList, ...staffList].find(
      (item) =>
        item.id === selectedUserId &&
        item.collectionName === selectedUserCollection,
    );
    if (
      !user ||
      statusButton.disabled ||
      deleteButton.disabled ||
      !window.confirm(
        `Delete ${user.fullName}'s account? This cannot be undone.`,
      )
    ) {
      return;
    }
    statusButton.disabled = true;
    deleteButton.disabled = true;
    try {
      await deleteDoc(doc(db, user.collectionName, user.id));
      const identifier = user.email !== "—" ? user.email : user.accountNumber;
      try {
        await appendUserAudit(
          `Permanently deleted account: ${user.fullName} (${identifier})`,
          user.id,
          user.collectionName,
        );
        showMessage(`${user.fullName}'s account was deleted.`);
      } catch (auditError) {
        console.error(
          "User deleted, but its audit log could not be saved:",
          auditError,
        );
        showMessage(
          "User deleted, but its audit log could not be saved.",
          true,
        );
      }
      detailsDialog.close();
    } catch (error) {
      console.error("Unable to delete user:", error);
      showMessage("Could not delete the user. Please try again.", true);
    } finally {
      statusButton.disabled = false;
      deleteButton.disabled = false;
    }
  }

  document
    .getElementById("create-user-button")
    .addEventListener("click", () => {
      roleDialog.showModal();
      roleDialog.querySelector("[data-select-role]").focus();
    });

  roleDialog.querySelectorAll("[data-select-role]").forEach((button) => {
    button.addEventListener("click", async () => {
      const type = {
        Student: "Student",
        "Event Organizer": "EventOrganizer",
        Teacher: "Teacher",
        Admin: "Admin",
        "Super Admin": "SuperAdmin",
      }[button.dataset.selectRole];
      if (!type) return;
      button.disabled = true;
      renderCreateForm(type);
      const submitButton = createForm.querySelector('[type="submit"]');
      submitButton.disabled = type !== "Student";
      roleDialog.close();
      createDialog.showModal();
      createFields.querySelector("input:not([readonly])")?.focus();

      if (type === "Student") {
        button.disabled = false;
        return;
      }

      const preview = createFields.querySelector('[name="accountPreview"]');
      preview.value = "Checking next account number...";
      createError.textContent = "";
      createError.hidden = true;
      try {
        const sequence = await previewNextAccountSequence(type);
        if (selectedAccountType !== type) return;
        accountNumberPreview = { sequence };
        updateAccountPreview();
        submitButton.disabled = false;
      } catch (error) {
        console.error("Unable to allocate account number:", error);
        if (selectedAccountType !== type) return;
        preview.value = "Unavailable";
        createError.textContent =
          "Could not preview the next account number. Check your Super Admin access, connection, and deployed Firestore rules.";
        createError.hidden = false;
      } finally {
        button.disabled = false;
      }
    });
  });

  createForm.addEventListener("submit", createUser);
  tableBody.addEventListener("click", (event) => {
    const viewButton = event.target.closest("button[data-id]");
    if (viewButton) {
      openDetails(viewButton.dataset.id, viewButton.dataset.collection);
    }
  });
  statusButton.addEventListener("click", toggleUserStatus);
  deleteButton.addEventListener("click", deleteSelectedUser);

  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog").close());
  });

  function returnToAccountTypeSelection() {
    returnToAccountTypeDialog = true;
    createDialog.close();
  }

  createDialog
    .querySelectorAll("[data-return-to-account-types]")
    .forEach((button) => {
      button.addEventListener("click", returnToAccountTypeSelection);
    });
  createDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    returnToAccountTypeSelection();
  });

  createDialog.addEventListener("close", () => {
    createForm.reset();
    createForm.querySelector('[type="submit"]').disabled = false;
    createFields.replaceChildren();
    createError.textContent = "";
    createError.hidden = true;
    selectedAccountType = null;
    accountNumberPreview = null;
    if (returnToAccountTypeDialog) {
      returnToAccountTypeDialog = false;
      roleDialog.showModal();
      roleDialog.querySelector("[data-select-role]")?.focus();
    }
  });
  detailsDialog.addEventListener("close", () => {
    selectedUserId = null;
    selectedUserCollection = null;
    [
      "user-details-name",
      "user-details-role",
      "user-details-status",
      "user-detail-full-name",
      "user-detail-account-number",
      "user-detail-email",
      "user-detail-contact",
      "user-detail-department",
      "user-detail-year-section",
      "user-detail-organization",
      "user-detail-role",
    ].forEach((id) => {
      document.getElementById(id).textContent = "";
    });
    statusButton.textContent = "Suspend Account";
    document.getElementById("view-user-activity").href =
      "SuperAdminAuditLogs.html";
  });

  if (!isFirebaseConfigured || !auth || !db) {
    tableBody.innerHTML =
      '<tr><td class="user-table-empty" colspan="6">User data is unavailable. Please check Firebase configuration.</td></tr>';
    return;
  }

  tableBody.innerHTML =
    '<tr><td class="user-table-empty" colspan="6">Loading user accounts…</td></tr>';
  tableBody.innerHTML =
    '<tr><td class="user-table-empty" colspan="6">Loading user accounts…</td></tr>';
  const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    unsubscribeStudents?.();
    unsubscribeStaff?.();
    if (!user) {
      tableBody.innerHTML =
        '<tr><td class="user-table-empty" colspan="6">Sign in as a Super Admin to manage accounts.</td></tr>';
      return;
    }
    unsubscribeStudents = onSnapshot(
      collection(db, "studentUser"),
      (snapshot) => handleUsersSnapshot("studentUser", snapshot),
      (error) => {
        console.error("Unable to load studentUser accounts:", error);
        showMessage("Could not load student accounts.", true);
      },
    );
    unsubscribeStaff = onSnapshot(
      collection(db, "adminUser"),
      (snapshot) => handleUsersSnapshot("adminUser", snapshot),
      (error) => {
        console.error("Unable to load adminUser accounts:", error);
        showMessage("Could not load staff accounts.", true);
      },
    );
  });

  window.addEventListener("beforeunload", () => {
    unsubscribeAuth();
    unsubscribeStudents?.();
    unsubscribeStaff?.();
  });
})();
