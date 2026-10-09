(function () {
  const codeInputs = [...document.querySelectorAll("#code-inputs input")];
  const verifyButton = document.getElementById("verify-code");
  const resendButton = document.getElementById("resend-code");
  const countdown = document.getElementById("countdown");

  function startCountdown() {
    let remaining = 300;
    if (!countdown) return;
    clearInterval(window.recoVibeCountdown);
    countdown.textContent = "Code expires in 05:00";
    window.recoVibeCountdown = setInterval(function () {
      remaining -= 1;
      const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
      const seconds = String(remaining % 60).padStart(2, "0");
      countdown.textContent =
        remaining > 0
          ? `Code expires in ${minutes}:${seconds}`
          : "Code expired";
      if (remaining <= 0) clearInterval(window.recoVibeCountdown);
    }, 1000);
  }

  function fillCode(value) {
    const digits = value.replace(/\D/g, "").slice(0, codeInputs.length);
    codeInputs.forEach((input, index) => {
      input.value = digits[index] || "";
    });
    const nextEmpty = codeInputs.find((input) => !input.value);
    (nextEmpty || codeInputs[codeInputs.length - 1])?.focus();
  }

  codeInputs.forEach((input, index) => {
    input.addEventListener("input", function () {
      input.value = input.value.replace(/\D/g, "").slice(-1);
      if (input.value && codeInputs[index + 1]) codeInputs[index + 1].focus();
    });
    input.addEventListener("keydown", function (event) {
      if (event.key === "Backspace" && !input.value && codeInputs[index - 1]) {
        codeInputs[index - 1].focus();
      }
    });
    input.addEventListener("paste", function (event) {
      event.preventDefault();
      fillCode(event.clipboardData.getData("text"));
    });
  });

  verifyButton?.addEventListener("click", function () {
    window.location.href = "reset-password.html";
  });
  resendButton?.addEventListener("click", function () {
    codeInputs.forEach((input) => {
      input.value = "";
    });
    codeInputs[0]?.focus();
    startCountdown();
  });
  startCountdown();

  document.querySelectorAll(".pass-toggle").forEach(function (toggle) {
    toggle.addEventListener("click", function () {
      const input = document.getElementById(toggle.dataset.passwordTarget);
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      toggle.setAttribute(
        "aria-label",
        visible ? "Hide password" : "Show password",
      );
      toggle.setAttribute("aria-pressed", String(visible));
    });
  });

  const password = document.getElementById("new-password");
  const confirmation = document.getElementById("confirm-password");
  const matchMessage = document.getElementById("match-message");
  const resetButton = document.getElementById("reset-password");

  function updateRequirements() {
    if (!password) return;
    const checks = {
      length: password.value.length >= 8,
      uppercase: /[A-Z]/.test(password.value),
      number: /\d/.test(password.value),
    };
    Object.entries(checks).forEach(([name, met]) => {
      document
        .querySelector(`[data-requirement="${name}"]`)
        ?.classList.toggle("met", met);
    });
  }

  password?.addEventListener("input", updateRequirements);
  confirmation?.addEventListener("input", function () {
    if (confirmation.value && confirmation.value !== password.value) {
      matchMessage.textContent = "Passwords do not match.";
    } else {
      matchMessage.textContent = "";
    }
  });
  resetButton?.addEventListener("click", function () {
    const valid =
      password.value.length >= 8 &&
      /[A-Z]/.test(password.value) &&
      /\d/.test(password.value) &&
      password.value === confirmation.value;
    if (valid) window.location.href = "password-reset-success.html";
    else
      matchMessage.textContent =
        "Complete all password requirements and make sure both passwords match.";
  });
})();
