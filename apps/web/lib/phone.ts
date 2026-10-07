/**
 * Client-side Pakistan phone helpers — keep in sync with
 * apps/api/src/common/validation/phone.ts
 *
 * UI: locked +92 + exactly 11 national digits `03XXXXXXXXX`.
 * Storage: E.164 `+923XXXXXXXXX`.
 */
export const PK_PHONE_PREFIX = '+92';
export const PK_PHONE_NATIONAL_LENGTH = 11;
export const PK_PHONE_NATIONAL_PATTERN = /^03\d{9}$/;
export const PK_PHONE_MESSAGE =
  'Enter an 11-digit Pakistan mobile number starting with 03 (e.g. 03001234567).';

export function phoneDigitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function normalizePakistanPhone(raw: string): string | null {
  let digits = phoneDigitsOnly(raw.trim());
  if (!digits) {
    return null;
  }
  // +923001234567 / 923001234567 → national 03001234567
  if (digits.startsWith('92') && digits.length === 12) {
    digits = `0${digits.slice(2)}`;
  }
  // Require full 11-digit national form (leading 0). Do not accept 10-digit 3XXXXXXXXX alone.
  if (!PK_PHONE_NATIONAL_PATTERN.test(digits)) {
    return null;
  }
  return `${PK_PHONE_PREFIX}${digits.slice(1)}`;
}

export function isValidPakistanPhone(raw: string): boolean {
  return normalizePakistanPhone(raw) !== null;
}

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
