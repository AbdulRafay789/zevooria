import {
  isValidPakistanPhone,
  normalizePakistanPhone,
  PK_PHONE_MESSAGE,
} from './phone';

export type FieldErrors = Record<string, string>;

export { normalizePakistanPhone, isValidPakistanPhone, PK_PHONE_MESSAGE };

/** Keep in sync with apps/api/src/common/validation/password.ts */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_MIN_SPECIAL = 2;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SPECIAL_CHAR_PATTERN = /[^A-Za-z0-9]/g;

export const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 8 characters and contain at least 2 special characters.';

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

export function countSpecialCharacters(password: string): number {
  return (password.match(SPECIAL_CHAR_PATTERN) ?? []).length;
}

/** Password creation policy (register / change-password). */
export function validatePasswordValue(password: string): string | null {
  if (!password) {
    return 'Password is required.';
  }
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    countSpecialCharacters(password) < PASSWORD_MIN_SPECIAL
  ) {
    return PASSWORD_POLICY_MESSAGE;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return 'Password is too long.';
  }
  return null;
}

export function validateLoginFields(input: {
  email: string;
  password: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  const email = input.email.trim();

  if (!email) {
    errors.email = 'Email is required.';
  } else if (!isValidEmailFormat(email)) {
    errors.email = 'Enter a valid email address.';
  }

  // Login authenticates only — do not enforce creation policy.
  if (!input.password) {
    errors.password = 'Password is required.';
  }

  return errors;
}

export function validateRegisterFields(input: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  const fullName = input.fullName.trim();
  const email = input.email.trim();
  const phone = input.phone.trim();

  if (!fullName) {
    errors.fullName = 'Full name is required.';
  } else if (fullName.length < 2) {
    errors.fullName = 'Enter your full name.';
  } else if (fullName.length > 200) {
    errors.fullName = 'Name is too long.';
  }

  if (!email) {
    errors.email = 'Email is required.';
  } else if (!isValidEmailFormat(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!phone) {
    errors.phone = 'Phone is required.';
  } else if (!isValidPakistanPhone(phone)) {
    errors.phone = PK_PHONE_MESSAGE;
  }

  const passwordError = validatePasswordValue(input.password);
  if (passwordError) {
    errors.password = passwordError;
  }

  if (!input.confirmPassword) {
    errors.confirmPassword = 'Confirm your password.';
  } else if (input.password !== input.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

export function validateChangePasswordFields(input: {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}): FieldErrors {
  const errors: FieldErrors = {};

  if (!input.currentPassword) {
    errors.currentPassword = 'Current password is required.';
  }

  const newError = validatePasswordValue(input.newPassword);
  if (newError) {
    errors.newPassword = newError.replace(/^Password/, 'New password');
  }

  if (!input.confirmNewPassword) {
    errors.confirmNewPassword = 'Confirm your new password.';
  } else if (input.newPassword !== input.confirmNewPassword) {
    errors.confirmNewPassword = 'Passwords do not match.';
  }

  return errors;
}

export function formatOrderDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatPaymentMethod(method: string): string {
  if (method === 'COD') {
    return 'Cash on Delivery';
  }
  return method;
}

export function formatOrderStatus(status: string): string {
  if (!status) {
    return status;
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** Prefer COD-aware labels (due on delivery vs collected). */
export function formatPaymentStatus(
  status: string,
  paymentMethod?: string,
): string {
  if (paymentMethod === 'COD') {
    if (status === 'SUCCESS') {
      return 'Collected';
    }
    if (status === 'PENDING' || status === 'CREATED') {
      return 'Due on delivery';
    }
  }
  if (!status) {
    return status;
  }
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
