import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChangePasswordDto, LoginDto, RegisterDto } from './auth.dto';
import { hashPassword, verifyPassword } from '../password.util';
import { AuthService } from '../auth.service';
import { PASSWORD_POLICY_MESSAGE } from '../../common/validation/password';

describe('Auth DTO password rules', () => {
  it('rejects register password shorter than 8', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'a@b.com',
      password: 'short!@',
      fullName: 'Test User',
      phone: '03001234567',
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });

  it('rejects register password with fewer than 2 special characters', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'a@b.com',
      password: 'abcdefg!',
      fullName: 'Test User',
      phone: '03001234567',
    });
    const errors = await validate(dto);
    const passwordError = errors.find((error) => error.property === 'password');
    expect(passwordError).toBeDefined();
    expect(Object.values(passwordError!.constraints ?? {}).join(' ')).toContain(
      PASSWORD_POLICY_MESSAGE,
    );
  });

  it('accepts register password with 8+ chars and 2 specials', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'a@b.com',
      password: 'abcdef!@',
      fullName: 'Test User',
      phone: '03001234567',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('does not enforce creation policy on login DTO', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'a@b.com',
      password: 'password',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts short historical password on login DTO when non-empty', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'a@b.com',
      password: 'short',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects mismatched change-password confirmation in service', async () => {
    const users = {
      findOne: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        fullName: 'A',
        phone: null,
        passwordHash: await hashPassword('oldpassword'),
      }),
      save: jest.fn((user: unknown) => Promise.resolve(user)),
    };
    const sessions = {
      delete: jest.fn(),
      create: jest.fn((value: unknown) => value),
      save: jest.fn(),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const authTokens = {
      requestCustomerEmailVerification: jest.fn(),
    };
    const service = new AuthService(
      users as never,
      sessions as never,
      auditService as never,
      authTokens as never,
      { sendWelcome: jest.fn() } as never,
    );
    await expect(
      service.changePassword('user-1', {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword!@',
        confirmNewPassword: 'different1!@',
      }),
    ).rejects.toThrow('Passwords do not match.');
  });
});

describe('password hashing', () => {
  it('hashes new password and invalidates old', async () => {
    const hash = await hashPassword('password123');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('password123', hash)).toBe(true);
    expect(await verifyPassword('wrong-pass', hash)).toBe(false);
  });
});

describe('ChangePasswordDto', () => {
  it('rejects new password shorter than 8', async () => {
    const dto = plainToInstance(ChangePasswordDto, {
      currentPassword: 'oldpassword',
      newPassword: 'short!@',
      confirmNewPassword: 'short!@',
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'newPassword')).toBe(true);
  });

  it('rejects new password with fewer than 2 special characters', async () => {
    const dto = plainToInstance(ChangePasswordDto, {
      currentPassword: 'oldpassword',
      newPassword: 'Abcdef12',
      confirmNewPassword: 'Abcdef12',
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'newPassword')).toBe(true);
  });

  it('accepts new password meeting creation policy', async () => {
    const dto = plainToInstance(ChangePasswordDto, {
      currentPassword: 'oldpassword',
      newPassword: 'Test123!$',
      confirmNewPassword: 'Test123!$',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
