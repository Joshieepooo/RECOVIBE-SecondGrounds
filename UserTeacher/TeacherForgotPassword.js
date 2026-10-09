(() => {
  const resetEmailKey = "recovibeTeacherResetEmail";
  const resetCodeKey = "recovibeTeacherResetCode";
  const resetExpiryKey = "recovibeTeacherResetExpiry";
  const resetVerifiedKey = "recovibeTeacherResetVerified";
  const demoCode = "123456";
  const codeInputs = [...document.querySelectorAll("#code-inputs input")];
  const password = document.getElementById("new-password");
  const confirmation = document.getElementById("confirm-password");
  const matchMessage = document.getElementById("match-message");
  const resetEmailInput = document.getElementById("school-email");
  const resetEmailStatus = document.getElementById("forgot-status");
  let resetEmailInvalid = false;
  const emailPattern =
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
      emailPattern.test(value)
    );
  }

  resetEmailInput?.addEventListener("input", () => {
    if (!resetEmailInvalid) return;
    const email = resetEmailInput.value.trim().toLowerCase();
    const message = email
      ? isValidEmail(email)
        ? ""
        : "Enter a valid email address."
      : "Email is required.";
    resetEmailInvalid = Boolean(message);
    resetEmailInput.toggleAttribute("aria-invalid", resetEmailInvalid);
    resetEmailInput.closest(".field")?.classList.toggle("invalid", resetEmailInvalid);
    resetEmailStatus.textContent = message;
  });
  resetEmailInput?.addEventListener("blur", () => {
    const email = resetEmailInput.value.trim().toLowerCase();
    resetEmailInput.value = email;
    const message = email
      ? isValidEmail(email)
        ? ""
        : "Enter a valid email address."
      : "Email is required.";
    resetEmailInvalid = Boolean(message);
    resetEmailInput.toggleAttribute("aria-invalid", resetEmailInvalid);
    resetEmailInput.closest(".field")?.classList.toggle("invalid", resetEmailInvalid);
    resetEmailStatus.textContent = message;
  });

  function startCountdown() {
    const countdown = document.getElementById("countdown");
    if (!countdown) return;
    clearInterval(window.recoVibeCountdown);
    const update = () => {
      const remaining = Math.max(
        0,
        Math.ceil(
          (Number(sessionStorage.getItem(resetExpiryKey)) - Date.now()) / 1000,
        ),
      );
      countdown.textContent =
        remaining > 0
          ? `Code expires in ${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`
          : "Code expired";
      if (!remaining) clearInterval(window.recoVibeCountdown);
    };
    update();
    window.recoVibeCountdown = setInterval(update, 1000);
  }

  function issueDemoCode() {
    sessionStorage.setItem(resetCodeKey, demoCode);
    sessionStorage.setItem(resetExpiryKey, String(Date.now() + 5 * 60 * 1000));
    sessionStorage.removeItem(resetVerifiedKey);
  }

  function fillCode(value) {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    codeInputs.forEach((input, index) => {
      input.value = digits[index] || "";
    });
    (
      codeInputs.find((input) => !input.value) ||
      codeInputs[codeInputs.length - 1]
    )?.focus();
  }

  document.getElementById("send-code")?.addEventListener("click", () => {
    const email = resetEmailInput.value.trim().toLowerCase();
    resetEmailInput.value = email;
    const valid = isValidEmail(email);
    resetEmailInvalid = !valid;
    resetEmailInput.toggleAttribute("aria-invalid", resetEmailInvalid);
    resetEmailInput.closest(".field")?.classList.toggle("invalid", resetEmailInvalid);
    if (!valid) {
      resetEmailStatus.textContent = email
        ? "Enter a valid email address."
        : "Email is required.";
      resetEmailInput.focus();
      return;
    }
    resetEmailStatus.textContent = "";
    sessionStorage.setItem(
      resetEmailKey,
      email,
    );
    issueDemoCode();
    window.location.href = "TeacherVerifyCode.html";
  });

  codeInputs.forEach((input, index) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(-1);
      if (input.value && codeInputs[index + 1]) codeInputs[index + 1].focus();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Backspace" && !input.value && codeInputs[index - 1])
        codeInputs[index - 1].focus();
    });
    input.addEventListener("paste", (event) => {
      event.preventDefault();
      fillCode(event.clipboardData.getData("text"));
    });
  });

  const resetEmailLabel = document.getElementById("reset-email-label");
  if (resetEmailLabel) {
    const email = sessionStorage.getItem(resetEmailKey);
    resetEmailLabel.textContent = email
      ? `Code requested for ${email}`
      : "No reset email was provided. Return and enter your email.";
    document.getElementById("verify-status").textContent =
      "Local prototype code: 123456. No email service is connected.";
    startCountdown();
  }

  document.getElementById("verify-code")?.addEventListener("click", () => {
    const status = document.getElementById("verify-status");
    const enteredCode = codeInputs.map((input) => input.value).join("");
    const isExpired =
      Date.now() >= Number(sessionStorage.getItem(resetExpiryKey));
    if (!sessionStorage.getItem(resetEmailKey)) {
      status.textContent = "Start again and enter your email first.";
    } else if (isExpired) {
      status.textContent = "This code has expired. Request a new code.";
    } else if (enteredCode !== sessionStorage.getItem(resetCodeKey)) {
      status.textContent = "That code is not correct.";
      codeInputs[0]?.focus();
    } else {
      sessionStorage.setItem(resetVerifiedKey, "true");
      window.location.href = "TeacherResetPassword.html";
    }
  });

  document.getElementById("resend-code")?.addEventListener("click", () => {
    if (!sessionStorage.getItem(resetEmailKey)) {
      document.getElementById("verify-status").textContent =
        "Return and enter your email first.";
      return;
    }
    codeInputs.forEach((input) => {
      input.value = "";
    });
    issueDemoCode();
    document.getElementById("verify-status").textContent =
      "A new local prototype code is 123456. No email service is connected.";
    codeInputs[0]?.focus();
    startCountdown();
  });

  document.querySelectorAll(".pass-toggle").forEach((toggle) =>
    toggle.addEventListener("click", () => {
      const input = document.getElementById(toggle.dataset.passwordTarget);
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      toggle.setAttribute(
        "aria-label",
        visible ? "Hide password" : "Show password",
      );
    }),
  );

  password?.addEventListener("input", () => {
    const checks = {
      length: password.value.length >= 8,
      uppercase: /[A-Z]/.test(password.value),
      number: /\d/.test(password.value),
    };
    Object.entries(checks).forEach(([name, met]) =>
      document
        .querySelector(`[data-requirement="${name}"]`)
        ?.classList.toggle("met", met),
    );
  });
  confirmation?.addEventListener("input", () => {
    matchMessage.textContent =
      confirmation.value && confirmation.value !== password.value
        ? "Passwords do not match."
        : "";
  });
  document.getElementById("reset-password")?.addEventListener("click", () => {
    const valid =
      password.value.length >= 8 &&
      /[A-Z]/.test(password.value) &&
      /\d/.test(password.value) &&
      password.value === confirmation.value;
    if (
      !sessionStorage.getItem(resetVerifiedKey) ||
      Date.now() >= Number(sessionStorage.getItem(resetExpiryKey))
    ) {
      matchMessage.textContent =
        "Verify a current code before resetting your password.";
    } else if (!valid) {
      matchMessage.textContent =
        "Complete all password requirements and make sure both passwords match.";
    } else {
      sessionStorage.removeItem(resetCodeKey);
      sessionStorage.removeItem(resetExpiryKey);
      sessionStorage.removeItem(resetVerifiedKey);
      window.location.href = "TeacherPasswordResetSuccess.html";
    }
  });
})();
