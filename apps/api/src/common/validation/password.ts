/** Shared password rules for auth forms and DTOs. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_MIN_SPECIAL = 2;

/** Characters outside A–Z / a–z / 0–9 count as special. */
const SPECIAL_CHAR_PATTERN = /[^A-Za-z0-9]/g;

export const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 8 characters and contain at least 2 special characters.';

export function countSpecialCharacters(password: string): number {
  return (password.match(SPECIAL_CHAR_PATTERN) ?? []).length;
}

export function isPasswordLengthValid(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH
  );
}

/** Creation policy (register / change-password). Not used for login. */
export function isPasswordPolicyValid(password: string): boolean {
  return (
    isPasswordLengthValid(password) &&
    countSpecialCharacters(password) >= PASSWORD_MIN_SPECIAL
  );
}

/** Regex for class-validator @Matches on password creation fields. */
export const PASSWORD_POLICY_REGEX = /^(?=(?:.*[^A-Za-z0-9]){2,}).{8,128}$/;
