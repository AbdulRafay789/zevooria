import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { AuditService, type AuditRequestContext } from '../audit/audit.service';
import {
  createSessionToken,
  hashSessionToken,
  verifyPassword,
} from '../auth/password.util';
import { AdminLoginDto } from './dto/admin-auth.dto';
import { AdminSession } from './entities/admin-session.entity';
import { AdminUser } from './entities/admin-user.entity';

const SESSION_TTL_MS = 1000 * 60 * 30; // 30 minutes

export type AdminUserView = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  permissions: string[];
};

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectRepository(AdminUser)
    private readonly admins: Repository<AdminUser>,
    @InjectRepository(AdminSession)
    private readonly sessions: Repository<AdminSession>,
    private readonly auditService: AuditService,
  ) {}

  async login(
    dto: AdminLoginDto,
    request?: AuditRequestContext,
  ): Promise<{ token: string; user: AdminUserView }> {
    const email = dto.email.trim().toLowerCase();
    const admin = await this.admins.findOne({
      where: { email },
      relations: { roles: { permissions: true } },
    });
    if (
      !admin ||
      !admin.isActive ||
      !(await verifyPassword(dto.password, admin.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    const token = await this.createSession(admin.id);
    await this.auditService.record({
      actorType: 'admin',
      actorId: admin.id,
      action: 'admin.login',
      resourceType: 'admin_user',
      resourceId: admin.id,
      request,
    });
    return { token, user: this.toView(admin) };
  }

  async logout(
    token: string | undefined,
    request?: AuditRequestContext,
  ): Promise<void> {
    if (!token) {
      return;
    }
    const admin = await this.resolveAdmin(token);
    await this.sessions.delete({ tokenHash: hashSessionToken(token) });
    if (admin) {
      await this.auditService.record({
        actorType: 'admin',
        actorId: admin.id,
        action: 'admin.logout',
        resourceType: 'admin_user',
        resourceId: admin.id,
        request,
      });
    }
  }

  async resolveAdmin(token: string | undefined): Promise<AdminUser | null> {
    if (!token) {
      return null;
    }
    const session = await this.sessions.findOne({
      where: { tokenHash: hashSessionToken(token) },
      relations: {
        adminUser: { roles: { permissions: true } },
      },
    });
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      if (session) {
        await this.sessions.delete({ id: session.id });
      }
      return null;
    }
    if (!session.adminUser?.isActive) {
      return null;
    }
    return session.adminUser;
  }

  async me(token: string | undefined): Promise<AdminUserView> {
    const admin = await this.resolveAdmin(token);
    if (!admin) {
      throw new UnauthorizedException('Authentication required.');
    }
    return this.toView(admin);
  }

  async getPermissionCodes(adminUserId: string): Promise<string[]> {
    const admin = await this.admins.findOne({
      where: { id: adminUserId },
      relations: { roles: { permissions: true } },
    });
    if (!admin) {
      return [];
    }
    return this.permissionCodesFrom(admin);
  }

  async purgeExpiredSessions(): Promise<void> {
    await this.sessions.delete({ expiresAt: LessThan(new Date()) });
  }

  private async createSession(adminUserId: string): Promise<string> {
    const token = createSessionToken();
    const session = this.sessions.create({
      adminUserId,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });
    await this.sessions.save(session);
    return token;
  }

  private permissionCodesFrom(admin: AdminUser): string[] {
    const codes = new Set<string>();
    for (const role of admin.roles ?? []) {
      for (const permission of role.permissions ?? []) {
        codes.add(permission.code);
      }
    }
    // Backward-compatible: seeded admins before RBAC migration still work
    // once role rows exist; if none, treat legacy role=admin as full access.
    if (codes.size === 0 && admin.role === 'admin') {
      return [
        'dashboard:read',
        'orders:read',
        'orders:update',
        'customers:read',
        'customers:update',
        'customers:delete',
        'products:read',
        'products:update',
        'promotions:read',
        'promotions:update',
        'returns:read',
        'returns:update',
        'inventory:read',
        'inventory:update',
        'accounting:read',
        'notifications:read',
        'support:read',
        'support:update',
        'admins:manage',
        'audit:read',
      ];
    }
    return [...codes];
  }

  private toView(admin: AdminUser): AdminUserView {
    return {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      role: admin.role,
      permissions: this.permissionCodesFrom(admin),
    };
  }
}
