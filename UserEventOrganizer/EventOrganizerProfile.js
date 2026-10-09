(() => {
  const profileStorageKey = "recovibeOrganizerProfile";
  const organizerId = localStorage.getItem("recovibeOrganizerId") || "";
  const defaultProfile = {
    name: "Event Organizer",
    email: organizerId.includes("@") ? organizerId : "",
    organization: "IBITS",
  };
  const storedProfile = localStorage.getItem(profileStorageKey);
  let profile = defaultProfile;

  if (storedProfile) {
    try {
      const parsedProfile = JSON.parse(storedProfile);
      if (parsedProfile && typeof parsedProfile === "object") {
        profile = { ...defaultProfile, ...parsedProfile };
      }
    } catch (error) {
      console.error("Unable to read organizer profile:", error);
    }
  }

  const form = document.getElementById("organizerProfileForm");
  const status = document.getElementById("profileStatus");
  const firstNameInput = document.getElementById("profileFirstName");
  const middleNameInput = document.getElementById("profileMiddleName");
  const lastNameInput = document.getElementById("profileLastName");
  const emailInput = document.getElementById("profileEmail");
  const contactInput = document.getElementById("profileContact");
  const organizationInput = document.getElementById("profileOrganization");
  const avatar = document.getElementById("profileAvatar");
  const accountName = document.getElementById("organizerName");
  const accountRole = document.getElementById("organizerRole");
  const profileSummary = document.getElementById("profileSummary");
  const profileSummaryName = document.getElementById("profileSummaryName");
  const profileSummaryOrganization = document.getElementById(
    "profileSummaryOrganization",
  );
  const profileSummaryEmail = document.getElementById("profileSummaryEmail");
  const profileSummaryContact = document.getElementById(
    "profileSummaryContact",
  );
  const editProfileButton = document.getElementById("editProfileButton");
  const cancelProfileEdit = document.getElementById("cancelProfileEdit");
  const profileConfirmOverlay = document.getElementById(
    "profileConfirmOverlay",
  );
  const confirmProfileSave = document.getElementById("confirmProfileSave");
  const cancelProfileSave = document.getElementById("cancelProfileSave");
  let pendingProfile = null;

  const organizerToday = document.getElementById("organizerToday");
  if (organizerToday) {
    organizerToday.textContent = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function updateProfileDisplay() {
    const nameParts = profile.name.trim().split(/\s+/).filter(Boolean);
    const firstName = profile.firstName || nameParts[0] || "";
    const lastName =
      profile.lastName ||
      (nameParts.length > 1 ? nameParts[nameParts.length - 1] : "");
    const middleName =
      profile.middleName ||
      (nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "");
    const initials =
      profile.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((namePart) => namePart[0].toUpperCase())
        .join("") || "EO";

    firstNameInput.value = firstName;
    middleNameInput.value = middleName;
    lastNameInput.value = lastName;
    emailInput.value = profile.email;
    contactInput.value = profile.contactNumber || "";
    organizationInput.value = profile.organization;
    profileSummaryName.textContent = profile.name;
    profileSummaryOrganization.textContent = profile.organization;
    profileSummaryEmail.textContent = profile.email;
    profileSummaryContact.textContent = profile.contactNumber || "Not provided";
    avatar.textContent = initials;
    document.getElementById("organizerAvatar").textContent = initials;
    accountName.textContent = profile.name;
    accountRole.textContent = `${profile.organization} account`;
  }

  function setEditMode(isEditing) {
    document
      .getElementById("eventOrganizerProfilePage")
      .classList.toggle("profile-editing", isEditing);
    profileSummary.hidden = isEditing;
    editProfileButton.hidden = isEditing;
    form.hidden = !isEditing;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const nextProfile = {
      firstName: firstNameInput.value.trim(),
      middleName: middleNameInput.value.trim(),
      lastName: lastNameInput.value.trim(),
      name: [
        firstNameInput.value.trim(),
        middleNameInput.value.trim(),
        lastNameInput.value.trim(),
      ]
        .filter(Boolean)
        .join(" "),
      email: emailInput.value.trim().toLowerCase(),
      contactNumber: contactInput.value.trim(),
      organization: organizationInput.value.trim(),
    };

    if (!nextProfile.name || !nextProfile.email || !nextProfile.organization) {
      status.textContent = "Complete all profile fields.";
      return;
    }

    if (!emailInput.checkValidity()) {
      status.textContent = "Enter a valid email address.";
      emailInput.focus();
      return;
    }

    pendingProfile = nextProfile;
    profileConfirmOverlay.hidden = false;
    document.body.classList.add("profile-confirm-open");
    confirmProfileSave.focus();
  });

  function closeProfileConfirmation() {
    pendingProfile = null;
    profileConfirmOverlay.hidden = true;
    document.body.classList.remove("profile-confirm-open");
  }

  confirmProfileSave.addEventListener("click", () => {
    if (!pendingProfile) return;
    profile = { ...profile, ...pendingProfile };
    localStorage.setItem(profileStorageKey, JSON.stringify(profile));
    localStorage.setItem("recovibeOrganizerId", profile.email);
    updateProfileDisplay();
    status.textContent = "Profile saved.";
    setEditMode(false);
    closeProfileConfirmation();
  });

  cancelProfileSave.addEventListener("click", closeProfileConfirmation);
  profileConfirmOverlay.addEventListener("click", (event) => {
    if (event.target === profileConfirmOverlay) closeProfileConfirmation();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !profileConfirmOverlay.hidden)
      closeProfileConfirmation();
  });

  editProfileButton.addEventListener("click", () => {
    status.textContent = "";
    setEditMode(true);
    firstNameInput.focus();
  });

  cancelProfileEdit.addEventListener("click", (event) => {
    event.preventDefault();
    updateProfileDisplay();
    status.textContent = "";
    setEditMode(false);
  });

  document.getElementById("organizerLogout").addEventListener("click", () => {
    localStorage.removeItem("recovibeOrganizerId");
  });

  updateProfileDisplay();
  setEditMode(false);
})();
