/**
 * Pakistan mobile numbers for Zevooria.
 *
 * UI: locked `+92` prefix + 11-digit national number `03XXXXXXXXX`.
 * Storage: E.164 `+923XXXXXXXXX` (leading 0 dropped).
 */
export const PK_PHONE_PREFIX = '+92';
export const PK_PHONE_NATIONAL_LENGTH = 11;
export const PK_PHONE_NATIONAL_PATTERN = /^03\d{9}$/;
export const PK_PHONE_E164_PATTERN = /^\+923\d{9}$/;

export const PK_PHONE_MESSAGE =
  'Enter an 11-digit Pakistan mobile number starting with 03 (e.g. 03001234567).';

/** Digits only from any phone-ish input. */
export function phoneDigitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Normalize to E.164 `+923XXXXXXXXX`, or null if invalid.
 * Accepts: 03XXXXXXXXX, +923XXXXXXXXX, 923XXXXXXXXX.
 * Does not accept 10-digit numbers without the leading 0.
 */
export function normalizePakistanPhone(raw: string): string | null {
  let digits = phoneDigitsOnly(raw.trim());
  if (!digits) {
    return null;
  }

  if (digits.startsWith('92') && digits.length === 12) {
    digits = `0${digits.slice(2)}`;
  }

  if (!PK_PHONE_NATIONAL_PATTERN.test(digits)) {
    return null;
  }

  return `${PK_PHONE_PREFIX}${digits.slice(1)}`;
}

export function isValidPakistanPhone(raw: string): boolean {
  return normalizePakistanPhone(raw) !== null;
}

/** National digits for the editable field (`03XXXXXXXXX`). */
export function toPakistanNationalDisplay(
  stored: string | null | undefined,
): string {
  if (!stored?.trim()) {
    return '';
  }
  const normalized = normalizePakistanPhone(stored);
  if (!normalized) {
    const digits = phoneDigitsOnly(stored);
    if (PK_PHONE_NATIONAL_PATTERN.test(digits)) {
      return digits;
    }
    return '';
  }
  return `0${normalized.slice(PK_PHONE_PREFIX.length)}`;
}
