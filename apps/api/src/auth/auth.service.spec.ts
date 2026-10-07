import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from '../audit/audit.service';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { CustomerEmailService } from '../notifications/customer-email.service';
import { Session } from './entities/session.entity';
import { User } from './entities/user.entity';
import { hashPassword } from './password.util';

describe('AuthService customer lifecycle', () => {
  const users = {
    findOne: jest.fn(),
    create: jest.fn((value: unknown) => value),
    save: jest.fn((value: unknown) => Promise.resolve(value)),
  };
  const sessions = {
    create: jest.fn((value: unknown) => value),
    save: jest.fn((value: unknown) => Promise.resolve(value)),
    delete: jest.fn(),
    findOne: jest.fn(),
  };
  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  };
  const authTokens = {
    requestCustomerEmailVerification: jest.fn().mockResolvedValue({ ok: true }),
  };
  const customerEmail = {
    sendWelcome: jest.fn().mockResolvedValue(undefined),
  };

  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: users },
        { provide: getRepositoryToken(Session), useValue: sessions },
        { provide: AuditService, useValue: auditService },
        { provide: AuthTokenService, useValue: authTokens },
        { provide: CustomerEmailService, useValue: customerEmail },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('rejects login for deactivated customers', async () => {
    users.findOne.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      passwordHash: await hashPassword('OldPass!!'),
      isActive: false,
      deletedAt: null,
    });
    await expect(
      service.login({ email: 'a@b.com', password: 'OldPass!!' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects login for deleted customers', async () => {
    users.findOne.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      passwordHash: await hashPassword('OldPass!!'),
      isActive: false,
      deletedAt: new Date(),
    });
    await expect(
      service.login({ email: 'a@b.com', password: 'OldPass!!' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
