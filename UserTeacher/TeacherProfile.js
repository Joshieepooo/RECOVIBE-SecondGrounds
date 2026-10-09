(() => {
  const storageKey = "recovibeCurrentTeacher";
  const teacherIdKey = "recovibeTeacherId";
  const form = document.getElementById("organizerProfileForm");
  const status = document.getElementById("profileStatus");
  const firstNameInput = document.getElementById("profileFirstName");
  const middleNameInput = document.getElementById("profileMiddleName");
  const lastNameInput = document.getElementById("profileLastName");
  const emailInput = document.getElementById("profileEmail");
  const contactInput = document.getElementById("profileContact");
  const departmentInput = document.getElementById("profileOrganization");
  const summary = document.getElementById("profileSummary");
  const confirmOverlay = document.getElementById("profileConfirmOverlay");
  const confirmButton = document.getElementById("confirmProfileSave");
  let pendingProfile = null;

  let profile = {
    name: "Teacher",
    email: "",
    department: "PUP Biñan Campus",
    role: "Faculty account",
  };
  try {
    const storedProfile = JSON.parse(
      localStorage.getItem(storageKey) || "null",
    );
    if (storedProfile && typeof storedProfile === "object")
      profile = { ...profile, ...storedProfile };
  } catch (error) {
    console.warn("Unable to read teacher profile:", error);
  }
  profile.email = profile.email || localStorage.getItem(teacherIdKey) || "";

  function updateDisplay() {
    const parts = String(profile.name || "Teacher")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    firstNameInput.value = profile.firstName || parts[0] || "";
    middleNameInput.value =
      profile.middleName ||
      (parts.length > 2 ? parts.slice(1, -1).join(" ") : "");
    lastNameInput.value =
      profile.lastName || (parts.length > 1 ? parts[parts.length - 1] : "");
    emailInput.value = profile.email;
    contactInput.value = profile.contactNumber || "";
    departmentInput.value =
      profile.department || profile.organization || "PUP Biñan Campus";
    document.getElementById("profileSummaryName").textContent = profile.name;
    document.getElementById("profileSummaryOrganization").textContent =
      departmentInput.value;
    document.getElementById("profileSummaryEmail").textContent = profile.email;
    document.getElementById("profileSummaryContact").textContent =
      profile.contactNumber || "Not provided";
    const initials =
      parts
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("") || "T";
    document.getElementById("profileAvatar").textContent = initials;
    document.getElementById("organizerAvatar").textContent = initials;
    document.getElementById("organizerName").textContent = profile.name;
    document.getElementById("organizerRole").textContent =
      profile.department ||
      profile.organization ||
      profile.role ||
      "Faculty account";
  }

  function setEditMode(editing) {
    document
      .getElementById("eventOrganizerProfilePage")
      .classList.toggle("profile-editing", editing);
    summary.hidden = editing;
    document.getElementById("editProfileButton").hidden = editing;
    form.hidden = !editing;
  }

  function closeConfirmation() {
    pendingProfile = null;
    confirmOverlay.hidden = true;
    document.body.classList.remove("profile-confirm-open");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const firstName = firstNameInput.value.trim();
    const middleName = middleNameInput.value.trim();
    const lastName = lastNameInput.value.trim();
    const nextProfile = {
      ...profile,
      firstName,
      middleName,
      lastName,
      name: [firstName, middleName, lastName].filter(Boolean).join(" "),
      email: emailInput.value.trim().toLowerCase(),
      contactNumber: contactInput.value.trim(),
      department: departmentInput.value.trim(),
    };
    if (!nextProfile.name || !nextProfile.email || !nextProfile.department) {
      status.textContent = "Complete all profile fields.";
      return;
    }
    if (!emailInput.checkValidity()) {
      status.textContent = "Enter a valid email address.";
      emailInput.focus();
      return;
    }
    pendingProfile = nextProfile;
    confirmOverlay.hidden = false;
    document.body.classList.add("profile-confirm-open");
    confirmButton.focus();
  });

  confirmButton.addEventListener("click", () => {
    if (!pendingProfile) return;
    profile = pendingProfile;
    localStorage.setItem(storageKey, JSON.stringify(profile));
    localStorage.setItem(teacherIdKey, profile.email);
    updateDisplay();
    status.textContent = "Profile saved.";
    setEditMode(false);
    closeConfirmation();
  });
  document
    .getElementById("cancelProfileSave")
    .addEventListener("click", closeConfirmation);
  confirmOverlay.addEventListener("click", (event) => {
    if (event.target === confirmOverlay) closeConfirmation();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !confirmOverlay.hidden) closeConfirmation();
  });
  document.getElementById("editProfileButton").addEventListener("click", () => {
    status.textContent = "";
    setEditMode(true);
    firstNameInput.focus();
  });
  document
    .getElementById("cancelProfileEdit")
    .addEventListener("click", (event) => {
      event.preventDefault();
      updateDisplay();
      status.textContent = "";
      setEditMode(false);
    });
  document.getElementById("organizerLogout").addEventListener("click", () => {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(teacherIdKey);
  });

  updateDisplay();
  setEditMode(false);
})();
