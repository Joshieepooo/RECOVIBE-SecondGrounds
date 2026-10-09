import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, isFirebaseConfigured } from "../UserStudent/firebaseConfig.js";

(() => {
  "use strict";

  const settingsRef = db ? doc(db, "system_settings", "global_config") : null;
  const registrationToggle = document.getElementById("toggle-registration");
  const loginToggle = document.getElementById("toggle-login");
  const modal = document.getElementById("settings-modal-backdrop");
  const modalForm = document.getElementById("settings-modal-form");
  const modalTitle = document.getElementById("settings-modal-title");
  const itemField = document.getElementById("settings-item-field");
  const itemLabel = document.getElementById("settings-item-label");
  const itemInput = document.getElementById("settings-item-input");
  const itemList = document.getElementById("settings-item-list");
  const submitButton = document.getElementById("settings-item-submit");
  const statusMessage = document.getElementById("settings-status");
  const entityFields = {
    venues: { label: "Venues", singular: "venue" },
    categories: { label: "Event Categories", singular: "event category" },
    organizations: { label: "Organizations", singular: "organization" },
    eventSources: { label: "Event Sources", singular: "event source" },
  };
  const actionFields = {
    venues: "venues",
    categories: "categories",
    organizations: "organizations",
    sources: "eventSources",
  };
  const defaultSettings = {
    registrationEnabled: true,
    loginEnabled: true,
    venues: [],
    categories: [],
    organizations: [],
    eventSources: [],
  };

  let currentSettings = { ...defaultSettings };
  let activeField = null;
  let settingsReady = false;
  let initializingDocument = false;
  let backfillingDefaults = null;
  let unsubscribeSettings;

  function showMessage(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.dataset.state = isError ? "error" : "success";
    statusMessage.hidden = false;
  }

  function actorTag() {
    return document.querySelector(".account-badge")?.textContent.trim() || "SA1";
  }

  function actorIdentifier() {
    const name =
      document.getElementById("superadmin-name")?.textContent.trim() ||
      "Super Admin";
    return `${actorTag()} – ${name}`;
  }

  async function appendAudit(action) {
    await addDoc(collection(db, "audit_logs"), {
      timestamp: serverTimestamp(),
      user: actorIdentifier(),
      action,
      category: "System Settings",
    });
  }

  function setReady(ready) {
    settingsReady = ready;
    registrationToggle.disabled = !ready;
    loginToggle.disabled = !ready;
    document.querySelectorAll("[data-settings-action]").forEach((button) => {
      button.disabled = !ready;
    });
  }

  function normalizedSettings(data) {
    return {
      registrationEnabled:
        typeof data.registrationEnabled === "boolean"
          ? data.registrationEnabled
          : defaultSettings.registrationEnabled,
      loginEnabled:
        typeof data.loginEnabled === "boolean"
          ? data.loginEnabled
          : defaultSettings.loginEnabled,
      venues: Array.isArray(data.venues) ? data.venues.filter((item) => typeof item === "string") : [],
      categories: Array.isArray(data.categories)
        ? data.categories.filter((item) => typeof item === "string")
        : [],
      organizations: Array.isArray(data.organizations)
        ? data.organizations.filter((item) => typeof item === "string")
        : [],
      eventSources: Array.isArray(data.eventSources)
        ? data.eventSources.filter((item) => typeof item === "string")
        : [],
    };
  }

  function backfillMissingFields(data) {
    if (backfillingDefaults) return backfillingDefaults;
    const missingFields = {};
    Object.entries(defaultSettings).forEach(([field, defaultValue]) => {
      if (!(field in data)) missingFields[field] = defaultValue;
    });
    if (!Object.keys(missingFields).length) return Promise.resolve();

    backfillingDefaults = updateDoc(settingsRef, {
      ...missingFields,
      updatedAt: serverTimestamp(),
    })
      .catch((error) => {
        console.error("Unable to initialize missing system settings:", error);
        showMessage("Some system settings could not be initialized.", true);
      })
      .finally(() => {
        backfillingDefaults = null;
      });
    return backfillingDefaults;
  }

  function renderEntityList() {
    itemList.replaceChildren();
    const values = currentSettings[activeField] || [];
    if (!values.length) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "settings-item-empty";
      emptyItem.textContent = `No ${entityFields[activeField].label.toLowerCase()} have been added.`;
      itemList.append(emptyItem);
      return;
    }

    values.forEach((value) => {
      const row = document.createElement("li");
      row.className = "settings-item-row";
      const name = document.createElement("span");
      name.className = "settings-item-name";
      name.textContent = value;
      const removeButton = document.createElement("button");
      removeButton.className = "settings-item-remove";
      removeButton.type = "button";
      removeButton.textContent = "Remove";
      removeButton.setAttribute("aria-label", `Remove ${value}`);
      removeButton.addEventListener("click", () => removeEntity(value, removeButton));
      row.append(name, removeButton);
      itemList.append(row);
    });
  }

  function openEntityModal(field, mode) {
    if (!settingsReady) return;
    activeField = field;
    const entity = entityFields[field];
    const adding = mode === "add";
    modalTitle.textContent = `${adding ? "Add" : "Edit"} ${entity.label}`;
    itemLabel.textContent = `New ${entity.singular} name`;
    itemField.hidden = !adding;
    itemInput.value = "";
    itemInput.required = adding;
    itemList.hidden = adding;
    submitButton.hidden = !adding;
    submitButton.textContent = "Add";
    if (!adding) renderEntityList();
    modal.showModal();
    if (adding) itemInput.focus();
  }

  async function changeEntity(field, value, operation) {
    const entity = entityFields[field];
    const mutation = operation === "added" ? arrayUnion(value) : arrayRemove(value);
    try {
      await updateDoc(settingsRef, {
        [field]: mutation,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(`Unable to update ${entity.label}:`, error);
      showMessage(`Could not update ${entity.label.toLowerCase()}. Please try again.`, true);
      return false;
    }

    currentSettings[field] =
      operation === "added"
        ? currentSettings[field].includes(value)
          ? currentSettings[field]
          : [...currentSettings[field], value]
        : currentSettings[field].filter((item) => item !== value);
    if (activeField === field && !itemList.hidden) renderEntityList();

    try {
      await appendAudit(
        `${actorTag()} ${operation} "${value}" ${operation === "added" ? "to" : "from"} ${entity.label}`,
      );
      showMessage(`${entity.singular[0].toUpperCase()}${entity.singular.slice(1)} ${operation}.`);
    } catch (error) {
      console.error("System setting changed, but its audit log could not be saved:", error);
      showMessage("Setting changed, but its audit record could not be saved.", true);
    }
    return true;
  }

  async function addEntity(event) {
    event.preventDefault();
    if (!settingsReady || !activeField) return;
    const value = itemInput.value.trim();
    if (!value) {
      itemInput.focus();
      return;
    }
    if (currentSettings[activeField].includes(value)) {
      showMessage(`That ${entityFields[activeField].singular} already exists.`, true);
      return;
    }

    submitButton.disabled = true;
    try {
      if (await changeEntity(activeField, value, "added")) modal.close();
    } finally {
      submitButton.disabled = false;
    }
  }

  async function removeEntity(value, button) {
    if (!settingsReady || !activeField) return;
    button.disabled = true;
    try {
      await changeEntity(activeField, value, "removed");
    } finally {
      button.disabled = false;
    }
  }

  async function changeToggle(field, label, toggle) {
    if (!settingsReady) return;
    const previousValue = currentSettings[field];
    const enabled = toggle.checked;
    toggle.disabled = true;
    try {
      await updateDoc(settingsRef, {
        [field]: enabled,
        updatedAt: serverTimestamp(),
      });
      currentSettings[field] = enabled;
      try {
        await appendAudit(`${actorTag()} ${enabled ? "enabled" : "disabled"} ${label}`);
        showMessage(`${label[0].toUpperCase()}${label.slice(1)} ${enabled ? "enabled" : "disabled"}.`);
      } catch (error) {
        console.error("System setting changed, but its audit log could not be saved:", error);
        showMessage("Setting changed, but its audit record could not be saved.", true);
      }
    } catch (error) {
      console.error(`Unable to update ${label}:`, error);
      currentSettings[field] = previousValue;
      toggle.checked = previousValue;
      showMessage(`Could not update ${label}. Please try again.`, true);
    } finally {
      toggle.disabled = !settingsReady;
    }
  }

  if (!isFirebaseConfigured || !db) {
    setReady(false);
    showMessage("System settings are unavailable. Check Firebase configuration.", true);
    return;
  }

  setReady(false);
  registrationToggle.addEventListener("change", () =>
    changeToggle("registrationEnabled", "event registration", registrationToggle),
  );
  loginToggle.addEventListener("change", () =>
    changeToggle("loginEnabled", "user login", loginToggle),
  );

  document.querySelectorAll("[data-settings-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const [actionKey, mode] = button.dataset.settingsAction.split("-");
      const field = actionFields[actionKey];
      if (field) openEntityModal(field, mode);
    });
  });

  modalForm.addEventListener("submit", addEntity);
  document.querySelectorAll("[data-close-settings]").forEach((button) => {
    button.addEventListener("click", () => modal.close());
  });
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.close();
  });
  modal.addEventListener("close", () => {
    activeField = null;
    itemInput.value = "";
  });

  unsubscribeSettings = onSnapshot(
    settingsRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        if (initializingDocument) return;
        initializingDocument = true;
        setDoc(settingsRef, {
          ...defaultSettings,
          updatedAt: serverTimestamp(),
        })
          .catch((error) => {
            console.error("Unable to initialize system settings:", error);
            showMessage("Could not initialize system settings.", true);
          })
          .finally(() => {
            initializingDocument = false;
          });
        return;
      }

      const data = snapshot.data();
      currentSettings = normalizedSettings(data);
      registrationToggle.checked = currentSettings.registrationEnabled;
      loginToggle.checked = currentSettings.loginEnabled;
      const hasMissingFields = Object.keys(defaultSettings).some(
        (field) => !(field in data),
      );
      if (hasMissingFields) {
        setReady(false);
        backfillMissingFields(data).finally(() => setReady(true));
      } else {
        setReady(true);
      }
      if (activeField && !itemList.hidden) renderEntityList();
    },
    (error) => {
      console.error("Unable to subscribe to system settings:", error);
      setReady(false);
      showMessage("Could not load system settings. Please try again later.", true);
    },
  );

  window.addEventListener("beforeunload", () => unsubscribeSettings?.(), { once: true });
})();
