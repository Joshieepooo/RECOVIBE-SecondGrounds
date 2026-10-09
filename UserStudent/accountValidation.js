export const namePattern = /^[\p{L}\p{M}]+(?:[ .'-][\p{L}\p{M}]+)*\.?$/u;
export const emailPattern =
  /^(?=.{1,254}$)(?!.*\.\.)[A-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,}$/i;
export const studentNumberPattern = /^[0-9]{4}-[0-9]{5}-[A-Z]{2}-[0-9]$/;
export const contactPattern = /^09[0-9]{9}$/;
export const yearPattern = /^[1-5]-[1-5]$/;
export const passwordRules = [
  ["length", (value) => value.length >= 8 && value.length <= 64],
  ["uppercase", (value) => /[A-Z]/.test(value)],
  ["lowercase", (value) => /[a-z]/.test(value)],
  ["number", (value) => /\d/.test(value)],
  ["special", (value) => /[^\p{L}\p{N}\s]/u.test(value)],
];

export function normalizeName(value) {
  return value
    .replace(/ {2,}/g, " ")
    .replace(/^ /, "")
    .replace(
      /(^|[ '-])(\p{L})/gu,
      (_, separator, letter) => separator + letter.toUpperCase(),
    );
}

export function normalizeYear(value) {
  const allowed = value.replace(/[^0-9-]/g, "");
  const first = allowed[0];
  if (!first || !/[1-5]/.test(first)) return "";

  const rest = allowed.slice(1);
  if (rest.startsWith("-")) {
    const second = rest.slice(1).match(/[0-9]/)?.[0];
    return second && /[1-5]/.test(second) ? `${first}-${second}` : `${first}-`;
  }

  const second = rest.match(/[0-9]/)?.[0];
  return second && /[1-5]/.test(second) ? `${first}-${second}` : first;
}

export function normalizePhone(value) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("09")) return digits.slice(0, 11);
  if (digits.startsWith("639")) return `0${digits.slice(2, 12)}`;
  if (digits.startsWith("9")) return `0${digits.slice(0, 10)}`;
  return `09${digits.replace(/^0+/, "").slice(0, 9)}`;
}

export function normalizeStudentNumber(value) {
  return value
    .replace(/[^A-Za-z0-9-]/g, "")
    .slice(0, 15)
    .toUpperCase();
}

export function protectContactPrefix(input) {
  input.value = normalizePhone(input.value || "09");

  input.addEventListener("input", () => {
    const value = input.value;
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? start;
    const normalized = normalizePhone(value);
    if (normalized !== value) {
      input.value = normalized;
      input.setSelectionRange(
        Math.min(
          normalizePhone(value.slice(0, start)).length,
          normalized.length,
        ),
        Math.min(normalizePhone(value.slice(0, end)).length, normalized.length),
      );
    }
  });

  input.addEventListener("focus", () => {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    if (start < 2) input.setSelectionRange(2, Math.max(2, end));
  });

  input.addEventListener("click", () => {
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    if (start < 2) input.setSelectionRange(2, Math.max(2, end));
  });

  input.addEventListener("keydown", (event) => {
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    const fullSelection = start === 0 && end === input.value.length;
    if (event.key === "Home") {
      event.preventDefault();
      input.setSelectionRange(2, 2);
    } else if (event.key === "ArrowLeft" && start <= 2) {
      event.preventDefault();
      input.setSelectionRange(2, 2);
    } else if (["Backspace", "Delete"].includes(event.key)) {
      if (fullSelection) {
        event.preventDefault();
        input.value = "09";
        input.setSelectionRange(2, 2);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (start < 2) {
        if (end > 2) input.setSelectionRange(2, end);
        else {
          event.preventDefault();
          input.setSelectionRange(2, 2);
        }
      } else if (start === 2 && end === 2) {
        event.preventDefault();
      }
    } else if (
      start < 2 &&
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      input.setSelectionRange(2, Math.max(2, end));
    }
  });

  input.addEventListener("paste", (event) => {
    event.preventDefault();
    input.value = normalizePhone(event.clipboardData?.getData("text") || "");
    input.setSelectionRange(input.value.length, input.value.length);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

export function isValidName(value) {
  const normalized = value.normalize("NFC");
  const length = Array.from(normalized).length;
  return length >= 2 && length <= 50 && namePattern.test(normalized);
}

export function isValidEmail(value) {
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

export function isValidStudentNumber(value) {
  return studentNumberPattern.test(value.toUpperCase());
}

export function isValidContactNumber(value) {
  return value !== "09" && contactPattern.test(value);
}

export function isValidPassword(value) {
  return (
    value.length >= 8 &&
    value.length <= 64 &&
    !/\s/.test(value) &&
    passwordRules.every(([, test]) => test(value))
  );
}
