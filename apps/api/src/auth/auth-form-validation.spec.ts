import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  countSpecialCharacters,
  isPasswordPolicyValid,
} from '../common/validation/password';

describe('auth form validation rules (creation vs login)', () => {
  type FieldErrors = Record<string, string>;

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /** Mirrors storefront login: authenticate only — no creation policy. */
  function validateLoginFields(input: {
    email: string;
    password: string;
  }): FieldErrors {
    const errors: FieldErrors = {};
    const email = input.email.trim();
    if (!email) {
      errors.email = 'Email is required.';
    } else if (!EMAIL_PATTERN.test(email)) {
      errors.email = 'Enter a valid email address.';
    }
    if (!input.password) {
      errors.password = 'Password is required.';
    }
    return errors;
  }

  /** Mirrors storefront register password creation checks. */
  function validateRegisterPassword(
    password: string,
    confirmPassword: string,
  ): FieldErrors {
    const errors: FieldErrors = {};
    if (!password) {
      errors.password = 'Password is required.';
    } else if (!isPasswordPolicyValid(password)) {
      errors.password = PASSWORD_POLICY_MESSAGE;
    }
    if (!confirmPassword) {
      errors.confirmPassword = 'Confirm your password.';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    return errors;
  }

  it('requires email and password on login', () => {
    expect(validateLoginFields({ email: '', password: '' })).toEqual({
      email: 'Email is required.',
      password: 'Password is required.',
    });
  });

  it('rejects invalid email on login', () => {
    expect(
      validateLoginFields({ email: 'not-an-email', password: 'password123' }),
    ).toEqual({
      email: 'Enter a valid email address.',
    });
  });

  it('does not reject historical short passwords on login', () => {
    expect(
      validateLoginFields({ email: 'a@b.com', password: 'short' }),
    ).toEqual({});
  });

  it('rejects register password without enough special characters', () => {
    expect(countSpecialCharacters('password123')).toBe(0);
    expect(
      validateRegisterPassword('password123', 'password123'),
    ).toMatchObject({
      password: PASSWORD_POLICY_MESSAGE,
    });
  });

  it('rejects register password shorter than minimum length', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(validateRegisterPassword('ab!@cd', 'ab!@cd')).toMatchObject({
      password: PASSWORD_POLICY_MESSAGE,
    });
  });

  it('accepts register password meeting policy', () => {
    expect(validateRegisterPassword('abcdef!@', 'abcdef!@')).toEqual({});
  });

  it('rejects password mismatch on register', () => {
    expect(validateRegisterPassword('abcdef!@', 'abcdef!!')).toMatchObject({
      confirmPassword: 'Passwords do not match.',
    });
  });
});
