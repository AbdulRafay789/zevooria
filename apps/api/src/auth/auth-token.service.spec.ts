import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminUser } from '../admin/entities/admin-user.entity';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../notifications/mail.service';
import { AuthTokenService } from './auth-token.service';
import { AuthToken } from './entities/auth-token.entity';
import { User } from './entities/user.entity';
import { hashPassword, hashSessionToken } from './password.util';

describe('AuthTokenService', () => {
  const tokens = {
    delete: jest.fn(),
    create: jest.fn((value: unknown) => value),
    save: jest.fn((value: unknown) => Promise.resolve(value)),
    findOne: jest.fn(),
  };
  const customers = {
    findOne: jest.fn(),
    save: jest.fn((value: unknown) => Promise.resolve(value)),
  };
  const admins = {
    findOne: jest.fn(),
    save: jest.fn((value: unknown) => Promise.resolve(value)),
  };
  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  };
  const mail = {
    send: jest.fn().mockResolvedValue(undefined),
  };

  let service: AuthTokenService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthTokenService,
        { provide: getRepositoryToken(AuthToken), useValue: tokens },
        { provide: getRepositoryToken(User), useValue: customers },
        { provide: getRepositoryToken(AdminUser), useValue: admins },
        { provide: AuditService, useValue: auditService },
        { provide: MailService, useValue: mail },
      ],
    }).compile();
    service = moduleRef.get(AuthTokenService);
  });

  it('always returns ok for forgot-password even when email is unknown', async () => {
    customers.findOne.mockResolvedValue(null);
    await expect(
      service.requestCustomerPasswordReset('missing@example.com'),
    ).resolves.toEqual({ ok: true });
    expect(tokens.save).not.toHaveBeenCalled();
  });

  it('sends password-reset and verify emails without BCC', async () => {
    customers.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'a@b.com',
      fullName: 'Amina',
      isActive: true,
      deletedAt: null,
      emailVerifiedAt: null,
    });
    tokens.save.mockResolvedValue({});

    await service.requestCustomerPasswordReset('a@b.com');
    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'a@b.com',
        subject: 'Zevooria password reset',
      }),
    );
    expect(mail.send.mock.calls[0][0].bcc).toBeUndefined();

    mail.send.mockClear();
    await service.requestCustomerEmailVerification('user-1');
    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'a@b.com',
        subject: 'Verify your Zevooria email',
      }),
    );
    expect(mail.send.mock.calls[0][0].bcc).toBeUndefined();
  });

  it('rejects invalid reset tokens', async () => {
    tokens.findOne.mockResolvedValue(null);
    await expect(
      service.resetCustomerPassword({
        token: 'x'.repeat(24),
        newPassword: 'NewPass!!',
        confirmNewPassword: 'NewPass!!',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resets password when token is valid', async () => {
    const raw = `${'a'.repeat(32)}token`;
    const originalHash = await hashPassword('OldPass!!');
    const user = {
      id: 'user-1',
      email: 'a@b.com',
      passwordHash: originalHash,
    };
    tokens.findOne.mockResolvedValue({
      tokenHash: hashSessionToken(raw),
      subjectType: 'customer',
      purpose: 'password_reset',
      subjectId: user.id,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    customers.findOne.mockResolvedValue(user);

    await expect(
      service.resetCustomerPassword({
        token: raw,
        newPassword: 'NewPass!!',
        confirmNewPassword: 'NewPass!!',
      }),
    ).resolves.toEqual({ ok: true });
    expect(customers.save).toHaveBeenCalled();
    expect(user.passwordHash).not.toBe(originalHash);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'customer.password_reset' }),
    );
  });
});
