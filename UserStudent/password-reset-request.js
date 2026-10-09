import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth, isFirebaseConfigured } from "./firebaseConfig.js";

const EMAIL_PATTERN =
  /^(?=.{1,254}$)(?!.*\.\.)[A-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,}$/i;

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
    EMAIL_PATTERN.test(value)
  );
}

function errorMessage(error) {
  switch (error.code) {
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/user-not-found":
      return "If an account exists for that email, a reset link will be sent.";
    case "auth/too-many-requests":
      return "Too many requests. Please wait a while and try again.";
    case "auth/network-request-failed":
      return "Could not connect. Check your internet connection and try again.";
    default:
      return "We couldn't send the reset link. Please try again.";
  }
}

document.querySelectorAll("[data-password-reset-form]").forEach((form) => {
  const emailInput = form.querySelector('input[type="email"]');
  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector("[data-reset-status]");
  const field = emailInput?.closest(".field");
  const errorSlot = field?.querySelector(".error-msg");
  let hasEmailError = false;

  if (!emailInput || !button || !status) return;

  emailInput.addEventListener("input", () => {
    if (!hasEmailError) return;
    const email = emailInput.value.trim().toLowerCase();
    const message = email
      ? isValidEmail(email)
        ? ""
        : "Enter a valid email address."
      : "Email is required.";
    hasEmailError = Boolean(message);
    field?.classList.toggle("invalid", hasEmailError);
    emailInput.toggleAttribute("aria-invalid", hasEmailError);
    if (errorSlot) errorSlot.textContent = message;
    status.textContent = "";
  });

  emailInput.addEventListener("blur", () => {
    const email = emailInput.value.trim().toLowerCase();
    emailInput.value = email;
    const message = email
      ? isValidEmail(email)
        ? ""
        : "Enter a valid email address."
      : "Email is required.";
    hasEmailError = Boolean(message);
    field?.classList.toggle("invalid", hasEmailError);
    emailInput.toggleAttribute("aria-invalid", hasEmailError);
    if (errorSlot) errorSlot.textContent = message;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim().toLowerCase();
    emailInput.value = email;
    if (!email || !isValidEmail(email)) {
      hasEmailError = true;
      field?.classList.add("invalid");
      emailInput.setAttribute("aria-invalid", "true");
      if (errorSlot) {
        errorSlot.textContent = email
          ? "Enter a valid email address."
          : "Email is required.";
      }
      status.textContent = "";
      emailInput.focus();
      return;
    }

    if (!isFirebaseConfigured || !auth) {
      status.textContent =
        "Password reset is temporarily unavailable. Please try again later.";
      return;
    }

    button.disabled = true;
    status.textContent = "Sending reset link…";
    try {
      await sendPasswordResetEmail(auth, email);
      hasEmailError = false;
      field?.classList.remove("invalid");
      emailInput.removeAttribute("aria-invalid");
      if (errorSlot) errorSlot.textContent = "";
      status.textContent =
        "If an account exists for that email, a reset link will be sent. Check your inbox and spam folder.";
    } catch (error) {
      if (error.code === "auth/invalid-email") {
        hasEmailError = true;
        field?.classList.add("invalid");
        emailInput.setAttribute("aria-invalid", "true");
        if (errorSlot) errorSlot.textContent = "Enter a valid email address.";
      }
      status.textContent = errorMessage(error);
    } finally {
      button.disabled = false;
    }
  });
});
