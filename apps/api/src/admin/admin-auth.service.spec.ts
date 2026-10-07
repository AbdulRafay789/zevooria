import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from '../audit/audit.service';
import { hashPassword } from '../auth/password.util';
import { AdminAuthService } from './admin-auth.service';
import { AdminSession } from './entities/admin-session.entity';
import { AdminUser } from './entities/admin-user.entity';

describe('AdminAuthService', () => {
  const admins = {
    findOne: jest.fn(),
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

  let service: AdminAuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminAuthService,
        { provide: getRepositoryToken(AdminUser), useValue: admins },
        { provide: getRepositoryToken(AdminSession), useValue: sessions },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();
    service = moduleRef.get(AdminAuthService);
  });

  it('rejects invalid credentials', async () => {
    admins.findOne.mockResolvedValue(null);
    await expect(
      service.login({ email: 'a@b.com', password: 'anything' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects inactive admins', async () => {
    admins.findOne.mockResolvedValue({
      id: '1',
      email: 'ops@zevooria.local',
      passwordHash: await hashPassword('Test123!$'),
      fullName: 'Ops',
      role: 'admin',
      isActive: false,
    });
    await expect(
      service.login({ email: 'ops@zevooria.local', password: 'Test123!$' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('issues a session token for valid admin login', async () => {
    admins.findOne.mockResolvedValue({
      id: 'admin-1',
      email: 'ops@zevooria.local',
      passwordHash: await hashPassword('Test123!$'),
      fullName: 'Ops',
      role: 'admin',
      isActive: true,
      roles: [],
    });
    const result = await service.login({
      email: 'ops@zevooria.local',
      password: 'Test123!$',
    });
    expect(result.token.length).toBeGreaterThan(20);
    expect(result.user.email).toBe('ops@zevooria.local');
    expect(result.user.permissions).toEqual(
      expect.arrayContaining(['dashboard:read', 'orders:update', 'audit:read']),
    );
    expect(sessions.save).toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.login' }),
    );
  });

  it('resolveAdmin returns null for missing token', async () => {
    await expect(service.resolveAdmin(undefined)).resolves.toBeNull();
  });
});
