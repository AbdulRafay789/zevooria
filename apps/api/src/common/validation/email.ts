/** Shared email validation for auth and checkout forms. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmailFormat(value: string): boolean {
  const email = value.trim();
  if (!email || email.length > 320) {
    return false;
  }
  return EMAIL_PATTERN.test(email);
}
