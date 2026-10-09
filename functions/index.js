const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();
const REGION = "asia-southeast1";
const EMAIL_PATTERN =
  /^(?=.{1,254}$)(?!.*\.\.)[A-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,}$/i;
const NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ .'-][\p{L}\p{M}]+)*\.?$/u;
const STUDENT_NUMBER_PATTERN = /^[0-9]{4}-[0-9]{5}-[A-Z]{2}-[0-9]$/;
const CONTACT_PATTERN = /^09[0-9]{9}$/;
const STUDENT_DEPARTMENTS = new Set([
  "Bachelor of Science in Information Technology (BSIT)",
  "Bachelor of Science in Computer Engineering (BSCPE)",
  "Bachelor of Science in Business Administration (BSBA)",
  "Bachelor of Science in Office Administration (BSOA)",
  "Bachelor of Science in Hospitality Management (BSHM)",
  "Other",
]);
const STUDENT_ORGANIZATIONS = new Set(["IBITS", "ORG", "None"]);
const PASSWORD_RULES = [
  (value) => value.length >= 8 && value.length <= 64,
  (value) => !/\s/.test(value),
  (value) => /[A-Z]/.test(value),
  (value) => /[a-z]/.test(value),
  (value) => /\d/.test(value),
  (value) => /[^\p{L}\p{N}\s]/u.test(value),
];

const accountTypes = {
  EventOrganizer: {
    sequenceKey: "eventOrganizer",
    collection: "adminUser",
    prefix: (sequence) => `EO-${sequence}`,
  },
  Teacher: {
    sequenceKey: "teacher",
    collection: "adminUser",
    prefix: (sequence) => `Teacher-${sequence}`,
  },
  Admin: {
    sequenceKey: "admin",
    collection: "adminUser",
    prefix: (sequence) => `Admin-${sequence}`,
  },
  SuperAdmin: {
    sequenceKey: "superAdmin",
    collection: "adminUser",
    prefix: (sequence) => `SA-${sequence}`,
  },
};

function fail(code, message) {
  throw new HttpsError(code, message);
}

function cleanText(value, field, maximum = 100) {
  if (typeof value !== "string")
    fail("invalid-argument", `${field} is required.`);
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned || cleaned.length > maximum) {
    fail("invalid-argument", `${field} is required.`);
  }
  return cleaned;
}

function validName(value, field, required = true) {
  if (!value && !required) return "";
  const name = cleanText(value, field, 50).normalize("NFC");
  const length = Array.from(name).length;
  if (length < 2 || !NAME_PATTERN.test(name)) {
    fail("invalid-argument", "Use 2–50 valid name characters.");
  }
  return name;
}

function normalizeEmail(value) {
  const email = cleanText(value, "Email", 254).toLowerCase();
  const [local, domain] = email.split("@");
  if (
    !EMAIL_PATTERN.test(email) ||
    email.split("@").length !== 2 ||
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    domain.startsWith(".") ||
    domain.endsWith(".")
  ) {
    fail("invalid-argument", "Enter a valid email address.");
  }
  return email;
}

function validatePassword(value, confirmation) {
  if (
    typeof value !== "string" ||
    !PASSWORD_RULES.every((rule) => rule(value))
  ) {
    fail(
      "invalid-argument",
      "Password must be 8–64 characters, contain uppercase and lowercase letters, a number, and a special character, and contain no spaces.",
    );
  }
  if (value !== confirmation) {
    fail("invalid-argument", "Passwords do not match.");
  }
  return value;
}

function normalizeSuffix(value, label) {
  const suffix = cleanText(value, label, 24).toUpperCase();
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(suffix)) {
    fail("invalid-argument", `Enter a valid ${label.toLowerCase()}.`);
  }
  return suffix;
}

function formatSequence(sequence) {
  return String(sequence).padStart(3, "0");
}

function accountIdFor(type, sequence, suffix) {
  const account = accountTypes[type];
  const prefix = account.prefix(formatSequence(sequence));
  if (type === "EventOrganizer" || type === "Admin") {
    return `${prefix}-${suffix}`;
  }
  return prefix;
}

function sequenceFromAccount(type, accountNo) {
  const patterns = {
    EventOrganizer: /^EO-(\d{3,})-/i,
    Teacher: /^Teacher-(\d{3,})$/i,
    Admin: /^Admin-(\d{3,})-/i,
    SuperAdmin: /^SA-(\d{3,})$/i,
  };
  const match = String(accountNo || "").match(patterns[type]);
  return match ? Number(match[1]) : 0;
}

async function isSuperAdmin(uid) {
  const refs = [
    db.collection("adminUser").doc(uid),
    db.collection("users").doc(uid),
  ];
  const profiles = await Promise.all(refs.map((ref) => ref.get()));
  return profiles.some((profile) => {
    const role = String(profile.data()?.role || profile.data()?.userRole || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    return profile.exists && role === "superadmin";
  });
}

async function requireSuperAdmin(request) {
  if (!request.auth?.uid || !(await isSuperAdmin(request.auth.uid))) {
    fail(
      "permission-denied",
      "Only a Super Admin can create managed accounts.",
    );
  }
  return request.auth.uid;
}

async function existingSequenceFloor(transaction, type) {
  const account = accountTypes[type];
  const collectionNames =
    type === "SuperAdmin"
      ? [account.collection, "users"]
      : [account.collection];
  let maximum = 0;
  for (const collectionName of collectionNames) {
    const snapshot = await transaction.get(db.collection(collectionName));
    snapshot.docs.forEach((document) => {
      const data = document.data();
      if (
        type === "SuperAdmin" &&
        String(data.role || data.userRole || "")
          .toLowerCase()
          .replace(/\s+/g, "") !== "superadmin"
      ) {
        return;
      }
      maximum = Math.max(
        maximum,
        sequenceFromAccount(type, data.accountNo || data.accountId),
      );
    });
  }
  return maximum;
}

exports.reserveManagedAccountId = onCall(
  { region: REGION },
  async (request) => {
    await requireSuperAdmin(request);
    const type = request.data?.accountType;
    if (typeof type !== "string" || !Object.hasOwn(accountTypes, type)) {
      fail("invalid-argument", "This account type does not use generated IDs.");
    }
    const account = accountTypes[type];

    const suffix =
      type === "EventOrganizer"
        ? normalizeSuffix(request.data?.organization, "Organization")
        : type === "Admin"
          ? normalizeSuffix(request.data?.title, "Role suffix")
          : "";
    const reservationRef = db.collection("id_reservations").doc();
    const sequenceRef = db.collection("id_sequences").doc(account.sequenceKey);

    const reserved = await db.runTransaction(async (transaction) => {
      const sequenceSnapshot = await transaction.get(sequenceRef);
      const current = sequenceSnapshot.exists
        ? Number(sequenceSnapshot.data().value) || 0
        : await existingSequenceFloor(transaction, type);
      const sequence = current + 1;
      const accountNo = accountIdFor(type, sequence, suffix);
      transaction.set(sequenceRef, {
        value: sequence,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(reservationRef, {
        accountType: type,
        sequence,
        uid: request.auth.uid,
        state: "reserved",
        createdAt: FieldValue.serverTimestamp(),
      });
      return { sequence, accountNo };
    });

    return {
      reservationId: reservationRef.id,
      accountNo: reserved.accountNo,
      sequence: reserved.sequence,
    };
  },
);

exports.lookupStudentEmail = onCall({ region: REGION }, async (request) => {
  const studentNumber = String(request.data?.studentNumber || "")
    .trim()
    .toUpperCase();
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    fail("not-found", "No matching student account.");
  }
  const matches = await db
    .collection("studentUser")
    .where("studentNumber", "==", studentNumber)
    .limit(2)
    .get();
  if (matches.size !== 1) fail("not-found", "No matching student account.");
  const email = String(matches.docs[0].data().email || "")
    .trim()
    .toLowerCase();
  if (!email) fail("not-found", "No matching student account.");
  return { email };
});

exports.createManagedAccount = onCall({ region: REGION }, async (request) => {
  const data = request.data || {};
  const type = data.accountType;
  const isStudent = type === "Student";
  const creatorUid = isStudent ? null : await requireSuperAdmin(request);
  if (
    !isStudent &&
    (typeof type !== "string" || !Object.hasOwn(accountTypes, type))
  ) {
    fail("invalid-argument", "Choose a valid account type.");
  }

  const firstName = validName(data.firstName, "First name");
  const middleName = validName(data.middleName || "", "Middle name", false);
  const lastName = validName(data.lastName, "Last name");
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");
  const email = normalizeEmail(data.email);
  const contactNumber = cleanText(data.contactNumber, "Contact number", 11);
  if (!CONTACT_PATTERN.test(contactNumber)) {
    fail("invalid-argument", "Enter a valid 11-digit contact number.");
  }
  const password = validatePassword(data.password, data.passwordConfirmation);
  const name = fullName;
  let accountNo;
  let role;
  let profile = {
    firstName,
    middleName,
    lastName,
    fullName,
    name,
    email,
    contactNumber,
    status: "Active",
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
  };

  if (isStudent) {
    accountNo = cleanText(
      data.studentNumber,
      "Student number",
      15,
    ).toUpperCase();
    if (!STUDENT_NUMBER_PATTERN.test(accountNo)) {
      fail("invalid-argument", "Enter a valid student number.");
    }
    const department = cleanText(data.department, "Department", 100);
    const year = cleanText(data.year, "Year", 3);
    const organization = cleanText(data.organization, "Organization", 40);
    if (!STUDENT_DEPARTMENTS.has(department)) {
      fail("invalid-argument", "Select your department.");
    }
    if (!STUDENT_ORGANIZATIONS.has(organization)) {
      fail("invalid-argument", "Select your organization.");
    }
    if (!/^[1-5]-[1-5]$/.test(year)) {
      fail("invalid-argument", "Enter year and section like 2-3.");
    }
    profile = {
      ...profile,
      studentNumber: accountNo,
      accountNo,
      role: "student",
      department,
      year,
      organization,
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
  } else {
    const reservationId = cleanText(
      data.reservationId,
      "Account ID reservation",
      80,
    );
    const reservationRef = db.collection("id_reservations").doc(reservationId);
    const reservationSnapshot = await reservationRef.get();
    const reservation = reservationSnapshot.data();
    if (
      !reservationSnapshot.exists ||
      reservation.uid !== creatorUid ||
      reservation.accountType !== type ||
      reservation.state !== "reserved"
    ) {
      fail(
        "failed-precondition",
        "The account ID reservation is invalid or expired. Select the account type again.",
      );
    }
    const suffix =
      type === "EventOrganizer"
        ? normalizeSuffix(data.organization, "Organization")
        : type === "Admin"
          ? normalizeSuffix(data.title, "Role suffix")
          : "";
    accountNo = accountIdFor(type, reservation.sequence, suffix);
    role =
      type === "EventOrganizer"
        ? "EO"
        : type === "SuperAdmin"
          ? "Super Admin"
          : type;
    profile = {
      ...profile,
      accountNo,
      accountType: type === "EventOrganizer" ? "EO" : type,
      role,
      ...(type === "EventOrganizer"
        ? { organization: suffix, roleName: "Event Organizer" }
        : {}),
      ...(type === "Admin" ? { title: suffix, roleSuffix: suffix } : {}),
    };
  }

  const accountIdRef = db.collection("account_ids").doc(accountNo);
  const reservationRef = isStudent
    ? null
    : db.collection("id_reservations").doc(data.reservationId);
  let profileRef;
  await db.runTransaction(async (transaction) => {
    if (reservationRef) {
      const latestReservation = await transaction.get(reservationRef);
      const reservationData = latestReservation.data();
      if (
        !latestReservation.exists ||
        reservationData.uid !== creatorUid ||
        reservationData.accountType !== type ||
        reservationData.sequence !== reservation.sequence ||
        reservationData.state !== "reserved"
      ) {
        fail(
          "failed-precondition",
          "The account ID reservation has already been used. Select the account type again.",
        );
      }
    }
    const existingId = await transaction.get(accountIdRef);
    if (existingId.exists) {
      fail(
        "already-exists",
        isStudent
          ? "This student number is already registered."
          : "This account ID is already in use. Select the account type again.",
      );
    }
    if (isStudent) {
      const duplicateNumber = await transaction.get(
        db
          .collection("studentUser")
          .where("studentNumber", "==", accountNo)
          .limit(1),
      );
      if (!duplicateNumber.empty) {
        fail("already-exists", "This student number is already registered.");
      }
    }
    transaction.create(accountIdRef, {
      accountNo,
      accountType: type,
      state: "reserved",
      createdAt: FieldValue.serverTimestamp(),
    });
    if (!isStudent) {
      transaction.update(reservationRef, {
        state: "account-id-reserved",
        accountNo,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  let authUser;
  try {
    authUser = await getAuth().createUser({
      email,
      password,
      displayName: fullName,
    });
    profile.uid = authUser.uid;
    profileRef = db
      .collection(isStudent ? "studentUser" : "adminUser")
      .doc(authUser.uid);
    await profileRef.set(profile);
    await db.runTransaction(async (transaction) => {
      transaction.update(accountIdRef, {
        uid: authUser.uid,
        state: "active",
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (!isStudent) {
        transaction.update(
          db.collection("id_reservations").doc(data.reservationId),
          {
            state: "used",
            uid: authUser.uid,
            updatedAt: FieldValue.serverTimestamp(),
          },
        );
      }
    });
    return { uid: authUser.uid, accountNo, role: profile.role };
  } catch (error) {
    if (profileRef) await profileRef.delete().catch(() => {});
    if (authUser?.uid) {
      await getAuth()
        .deleteUser(authUser.uid)
        .catch((cleanupError) => {
          console.error(
            "Unable to remove Auth user after profile creation failed:",
            cleanupError,
          );
        });
    }
    await accountIdRef
      .update({ state: "failed", updatedAt: FieldValue.serverTimestamp() })
      .catch(() => {});
    if (error instanceof HttpsError) throw error;
    if (error.code === "auth/email-already-exists") {
      fail(
        "already-exists",
        "An account already exists with this email address.",
      );
    }
    console.error("Managed account creation failed:", error);
    fail("internal", "Could not create the account. Please try again.");
  }
});
