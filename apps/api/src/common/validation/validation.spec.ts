import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_SPECIAL,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_REGEX,
  countSpecialCharacters,
  isPasswordLengthValid,
  isPasswordPolicyValid,
} from './password';
import { isValidEmailFormat, normalizeEmail } from './email';

describe('password creation policy', () => {
  it('requires at least 8 characters', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(isPasswordLengthValid('1234567')).toBe(false);
    expect(isPasswordPolicyValid('short!@')).toBe(false);
  });

  it('requires at least 2 special characters', () => {
    expect(PASSWORD_MIN_SPECIAL).toBe(2);
    expect(countSpecialCharacters('abcdefgh')).toBe(0);
    expect(countSpecialCharacters('abcdefg!')).toBe(1);
    expect(countSpecialCharacters('abcdef!@')).toBe(2);
    expect(isPasswordPolicyValid('abcdefgh')).toBe(false);
    expect(isPasswordPolicyValid('abcdefg!')).toBe(false);
    expect(isPasswordPolicyValid('Abcdef12')).toBe(false);
  });

  it('accepts valid creation passwords', () => {
    expect(isPasswordPolicyValid('abcdef!@')).toBe(true);
    expect(isPasswordPolicyValid('Test123!$')).toBe(true);
    expect(isPasswordPolicyValid('password##1')).toBe(true);
    expect(PASSWORD_POLICY_REGEX.test('abcdef!@')).toBe(true);
  });

  it('exposes a clear policy message', () => {
    expect(PASSWORD_POLICY_MESSAGE).toContain('8 characters');
    expect(PASSWORD_POLICY_MESSAGE).toContain('2 special characters');
  });
});

describe('email validation', () => {
  it('rejects invalid email', () => {
    expect(isValidEmailFormat('not-an-email')).toBe(false);
  });

  it('accepts valid email and normalizes', () => {
    expect(isValidEmailFormat('Name@Example.com')).toBe(true);
    expect(normalizeEmail('  Name@Example.com ')).toBe('name@example.com');
  });
});
