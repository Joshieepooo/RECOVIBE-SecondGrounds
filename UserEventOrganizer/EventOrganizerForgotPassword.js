(function () {
  const codeInputs = [...document.querySelectorAll("#code-inputs input")];
  const password = document.getElementById("new-password");
  const confirmation = document.getElementById("confirm-password");
  const matchMessage = document.getElementById("match-message");
  function startCountdown() {
    const countdown = document.getElementById("countdown");
    if (!countdown) return;
    let remaining = 300;
    clearInterval(window.recoVibeCountdown);
    window.recoVibeCountdown = setInterval(() => {
      remaining -= 1;
      countdown.textContent =
        remaining > 0
          ? `Code expires in ${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`
          : "Code expired";
      if (remaining <= 0) clearInterval(window.recoVibeCountdown);
    }, 1000);
  }
  function fillCode(value) {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    codeInputs.forEach((input, index) => {
      input.value = digits[index] || "";
    });
    (codeInputs.find((input) => !input.value) || codeInputs[5])?.focus();
  }
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
  document.getElementById("verify-code")?.addEventListener("click", () => {
    window.location.href = "EventOrganizerResetPassword.html";
  });
  document.getElementById("resend-code")?.addEventListener("click", () => {
    codeInputs.forEach((input) => {
      input.value = "";
    });
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
        ? "Passwords do not match"
        : "";
  });
  document.getElementById("reset-password")?.addEventListener("click", () => {
    const valid =
      password.value.length >= 8 &&
      /[A-Z]/.test(password.value) &&
      /\d/.test(password.value) &&
      password.value === confirmation.value;
    if (valid) {
      if (window.confirm("Are you sure you want to change your password?")) {
        window.location.href = "EventOrganizerPasswordResetSuccess.html";
      }
    } else
      matchMessage.textContent =
        "Complete all password requirements and make sure both passwords match.";
  });
  startCountdown();
})();
