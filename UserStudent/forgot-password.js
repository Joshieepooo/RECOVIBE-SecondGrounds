const accountStorageKey = "recovibeAccounts";

const accounts = JSON.parse(localStorage.getItem(accountStorageKey) || "[]");
const views = {
  forgot: document.getElementById("view-forgot"),
  verify: document.getElementById("view-verify"),
  reset: document.getElementById("view-reset"),
  success: document.getElementById("view-success"),
};
let pendingAccount = null;
let verificationCode = "";

function showView(name) {
  Object.entries(views).forEach(([key, view]) =>
    view.classList.toggle("active", key === name),
  );
}

function setInvalid(fieldId, invalid) {
  document.getElementById(fieldId).classList.toggle("invalid", invalid);
}

document.getElementById("send-code").addEventListener("click", () => {
  const email = document
    .getElementById("forgot-email")
    .value.trim()
    .toLowerCase();
  pendingAccount = accounts.find(
    (account) => account.email.toLowerCase() === email,
  );
  setInvalid("field-forgot-email", !pendingAccount);
  if (!pendingAccount) return;

  verificationCode = String(Math.floor(100000 + Math.random() * 900000));
  document.getElementById("sent-to-email").textContent = pendingAccount.email;
  document.getElementById("demo-code-banner").innerHTML =
    `Demo verification code: <strong>${verificationCode}</strong>`;
  document.getElementById("demo-code-banner").classList.add("show");
  document.querySelector("#code-inputs input").focus();
  showView("verify");
});

document
  .getElementById("back-to-forgot")
  .addEventListener("click", () => showView("forgot"));

document
  .querySelectorAll("#code-inputs input")
  .forEach((input, index, inputs) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(-1);
      if (input.value && inputs[index + 1]) inputs[index + 1].focus();
    });
  });

document.getElementById("verify-code").addEventListener("click", () => {
  const enteredCode = [...document.querySelectorAll("#code-inputs input")]
    .map((input) => input.value)
    .join("");
  setInvalid("field-code", enteredCode !== verificationCode);
  if (enteredCode === verificationCode) showView("reset");
});

document.getElementById("save-password").addEventListener("click", () => {
  const password = document.getElementById("new-pass").value;
  const confirmation = document.getElementById("confirm-pass").value;
  setInvalid("field-new-pass", password.length < 8);
  setInvalid("field-confirm-pass", password !== confirmation);
  if (password.length < 8 || password !== confirmation) return;

  pendingAccount.password = password;
  localStorage.setItem(accountStorageKey, JSON.stringify(accounts));
  showView("success");
});
