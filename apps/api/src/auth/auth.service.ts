import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService, type AuditRequestContext } from '../audit/audit.service';
import {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  UpdateProfileDto,
} from './dto/auth.dto';
import { Session } from './entities/session.entity';
import { User } from './entities/user.entity';
import { AuthTokenService } from './auth-token.service';
import { CustomerEmailService } from '../notifications/customer-email.service';
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from './password.util';

const ACCESS_TOKEN_TTL_MS = 1000 * 60 * 30; // 30 minutes
const REFRESH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export type AuthUserView = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  emailVerifiedAt: string | null;
  isActive: boolean;
  deletedAt: string | null;
};

export type AuthSessionResult = {
  token: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: string;
  user: AuthUserView;
};

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    private readonly auditService: AuditService,
    private readonly authTokens: AuthTokenService,
    private readonly customerEmail: CustomerEmailService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthSessionResult> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.users.findOne({ where: { email } });
    if (existing) {
      if (existing.deletedAt) {
        throw new ConflictException(
          'This email belongs to a deleted account. An admin must restore it before you can sign in again.',
        );
      }
      if (existing.isActive === false) {
        throw new ConflictException(
          'This email belongs to a deactivated account. An admin must reactivate it before you can sign in again.',
        );
      }
      throw new ConflictException(
        'An account with this email already exists. Please sign in.',
      );
    }

    const user = this.users.create({
      email,
      passwordHash: await hashPassword(dto.password),
      fullName: dto.fullName.trim(),
      phone: dto.phone.trim(),
      isActive: true,
      deletedAt: null,
    });
    await this.users.save(user);
    const session = await this.issueSession(user);
    void this.customerEmail
      .sendWelcome({ to: user.email, fullName: user.fullName })
      .catch(() => undefined);
    void this.authTokens
      .requestCustomerEmailVerification(user.id)
      .catch(() => undefined);
    return session;
  }

  async login(dto: LoginDto): Promise<AuthSessionResult> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.users.findOne({ where: { email } });
    if (!user || !(await verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    this.assertUsableForAuth(user);
    return this.issueSession(user);
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
    request?: AuditRequestContext,
  ): Promise<AuthUserView> {
    const user = await this.requireUsableUser(userId);
    user.fullName = dto.fullName.trim();
    user.phone = dto.phone.trim();
    await this.users.save(user);
    await this.auditService.record({
      actorType: 'customer',
      actorId: user.id,
      action: 'customer.profile_update',
      resourceType: 'customer',
      resourceId: user.id,
      request,
    });
    return this.toView(user);
  }

  async deactivateAccount(
    userId: string,
    request?: AuditRequestContext,
  ): Promise<{ ok: true }> {
    const user = await this.requireUsableUser(userId);
    user.isActive = false;
    await this.users.save(user);
    await this.sessions.delete({ userId });
    await this.auditService.record({
      actorType: 'customer',
      actorId: user.id,
      action: 'customer.deactivate',
      resourceType: 'customer',
      resourceId: user.id,
      request,
    });
    return { ok: true };
  }

  async deleteAccount(
    userId: string,
    request?: AuditRequestContext,
  ): Promise<{ ok: true }> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Authentication required.');
    }
    if (user.deletedAt) {
      return { ok: true };
    }
    user.isActive = false;
    user.deletedAt = new Date();
    await this.users.save(user);
    await this.sessions.delete({ userId });
    await this.auditService.record({
      actorType: 'customer',
      actorId: user.id,
      action: 'customer.delete',
      resourceType: 'customer',
      resourceId: user.id,
      request,
    });
    return { ok: true };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    request?: AuditRequestContext,
  ): Promise<AuthSessionResult> {
    if (dto.newPassword !== dto.confirmNewPassword) {
      throw new BadRequestException('Passwords do not match.');
    }

    const user = await this.requireUsableUser(userId);

    if (!(await verifyPassword(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    if (await verifyPassword(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException(
        'New password must be different from the current password.',
      );
    }

    user.passwordHash = await hashPassword(dto.newPassword);
    await this.users.save(user);

    await this.sessions.delete({ userId });
    const session = await this.issueSession(user);
    await this.auditService.record({
      actorType: 'customer',
      actorId: user.id,
      action: 'customer.password_change',
      resourceType: 'customer',
      resourceId: user.id,
      request,
    });
    return session;
  }

  async logout(
    accessToken: string | undefined,
    refreshToken?: string,
  ): Promise<void> {
    if (accessToken) {
      await this.sessions.delete({
        tokenHash: hashSessionToken(accessToken),
      });
    }
    if (refreshToken) {
      await this.sessions.delete({
        refreshTokenHash: hashSessionToken(refreshToken),
      });
    }
  }

  async refresh(refreshToken: string): Promise<AuthSessionResult> {
    const session = await this.sessions.findOne({
      where: { refreshTokenHash: hashSessionToken(refreshToken) },
      relations: { user: true },
    });
    if (
      !session ||
      !session.refreshExpiresAt ||
      session.refreshExpiresAt.getTime() <= Date.now()
    ) {
      if (session) {
        await this.sessions.delete({ id: session.id });
      }
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }
    const user = session.user;
    if (!user || !this.isUsable(user)) {
      await this.sessions.delete({ id: session.id });
      throw new UnauthorizedException('Authentication required.');
    }

    const accessToken = createSessionToken();
    const nextRefresh = createSessionToken();
    const accessExpires = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
    const refreshExpires = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    session.tokenHash = hashSessionToken(accessToken);
    session.expiresAt = accessExpires;
    session.refreshTokenHash = hashSessionToken(nextRefresh);
    session.refreshExpiresAt = refreshExpires;
    await this.sessions.save(session);

    return {
      token: accessToken,
      refreshToken: nextRefresh,
      expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
      expiresAt: accessExpires.toISOString(),
      user: this.toView(user),
    };
  }

  async resolveUser(token: string | undefined): Promise<User | null> {
    if (!token) {
      return null;
    }
    const session = await this.sessions.findOne({
      where: { tokenHash: hashSessionToken(token) },
      relations: { user: true },
    });
    if (!session) {
      return null;
    }

    const refreshStillValid =
      session.refreshExpiresAt != null &&
      session.refreshExpiresAt.getTime() > Date.now();

    if (session.expiresAt.getTime() <= Date.now()) {
      // Access expired — keep row if refresh is still valid so client can refresh.
      if (!refreshStillValid) {
        await this.sessions.delete({ id: session.id });
      }
      return null;
    }

    const user = session.user;
    if (!user || !this.isUsable(user)) {
      await this.sessions.delete({ id: session.id });
      return null;
    }
    return user;
  }

  async me(
    token: string | undefined,
  ): Promise<AuthUserView & { expiresAt: string }> {
    if (!token) {
      throw new UnauthorizedException('Authentication required.');
    }
    const session = await this.sessions.findOne({
      where: { tokenHash: hashSessionToken(token) },
      relations: { user: true },
    });
    if (!session) {
      throw new UnauthorizedException('Authentication required.');
    }
    const refreshStillValid =
      session.refreshExpiresAt != null &&
      session.refreshExpiresAt.getTime() > Date.now();
    if (session.expiresAt.getTime() <= Date.now()) {
      if (!refreshStillValid) {
        await this.sessions.delete({ id: session.id });
      }
      throw new UnauthorizedException('Authentication required.');
    }
    const user = session.user;
    if (!user || !this.isUsable(user)) {
      await this.sessions.delete({ id: session.id });
      throw new UnauthorizedException('Authentication required.');
    }
    return {
      ...this.toView(user),
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  async purgeExpiredSessions(): Promise<void> {
    const now = new Date();
    await this.sessions
      .createQueryBuilder()
      .delete()
      .where('refresh_expires_at IS NOT NULL AND refresh_expires_at <= :now', {
        now,
      })
      .orWhere('refresh_expires_at IS NULL AND expires_at <= :now', { now })
      .execute();
  }

  isUsable(user: User): boolean {
    return user.isActive !== false && !user.deletedAt;
  }

  assertUsableForAuth(user: User): void {
    if (user.deletedAt) {
      throw new UnauthorizedException(
        'This account has been deleted. Contact support or ask an admin to restore it.',
      );
    }
    if (user.isActive === false) {
      throw new UnauthorizedException(
        'This account is deactivated. Contact support or ask an admin to reactivate it.',
      );
    }
  }

  private async requireUsableUser(userId: string): Promise<User> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Authentication required.');
    }
    this.assertUsableForAuth(user);
    return user;
  }

  private async issueSession(user: User): Promise<AuthSessionResult> {
    const accessToken = createSessionToken();
    const refreshToken = createSessionToken();
    const accessExpires = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
    const refreshExpires = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    const session = this.sessions.create({
      userId: user.id,
      tokenHash: hashSessionToken(accessToken),
      expiresAt: accessExpires,
      refreshTokenHash: hashSessionToken(refreshToken),
      refreshExpiresAt: refreshExpires,
    });
    await this.sessions.save(session);
    return {
      token: accessToken,
      refreshToken,
      expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
      expiresAt: accessExpires.toISOString(),
      user: this.toView(user),
    };
  }

  private toView(user: User): AuthUserView {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      isActive: user.isActive !== false,
      deletedAt: user.deletedAt?.toISOString() ?? null,
    };
  }
}
