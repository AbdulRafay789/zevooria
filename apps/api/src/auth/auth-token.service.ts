import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { LessThan, Repository } from 'typeorm';
import { AdminUser } from '../admin/entities/admin-user.entity';
import { AuditService, type AuditRequestContext } from '../audit/audit.service';
import { getWebPublicBaseUrl } from '../common/urls/web-public';
import { isPasswordPolicyValid } from '../common/validation/password';
import { MailService } from '../notifications/mail.service';
import {
  adminPasswordResetEmail,
  passwordResetEmail,
  verifyEmailMessage,
} from '../notifications/email-templates';
import {
  AuthToken,
  type AuthTokenPurpose,
  type AuthTokenSubjectType,
} from './entities/auth-token.entity';
import { User } from './entities/user.entity';
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
} from './password.util';

const RESET_TTL_MS = 1000 * 60 * 60;
const VERIFY_TTL_MS = 1000 * 60 * 60 * 24;

function storefrontLink(path: string, token: string): string {
  const base = getWebPublicBaseUrl();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}?token=${encodeURIComponent(token)}`;
}

@Injectable()
export class AuthTokenService {
  constructor(
    @InjectRepository(AuthToken)
    private readonly tokens: Repository<AuthToken>,
    @InjectRepository(User)
    private readonly customers: Repository<User>,
    @InjectRepository(AdminUser)
    private readonly admins: Repository<AdminUser>,
    private readonly auditService: AuditService,
    private readonly mail: MailService,
  ) {}

  async requestCustomerPasswordReset(emailRaw: string): Promise<{ ok: true }> {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.customers.findOne({ where: { email } });
    if (user) {
      if (user.deletedAt || user.isActive === false) {
        return { ok: true };
      }
      const raw = await this.issueToken('customer', user.id, 'password_reset');
      const link = storefrontLink('/reset-password', raw);
      const content = passwordResetEmail({
        fullName: user.fullName,
        link,
        token: raw,
      });
      await this.mail.send({
        to: user.email,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });
    }
    return { ok: true };
  }

  async resetCustomerPassword(
    input: {
      token: string;
      newPassword: string;
      confirmNewPassword: string;
    },
    request?: AuditRequestContext,
  ): Promise<{ ok: true }> {
    this.assertPasswordPair(input.newPassword, input.confirmNewPassword);
    const record = await this.consumeToken(
      input.token,
      'customer',
      'password_reset',
    );
    const user = await this.customers.findOne({
      where: { id: record.subjectId },
    });
    if (!user) {
      throw new NotFoundException('Account not found.');
    }
    if (user.deletedAt || user.isActive === false) {
      throw new BadRequestException('This account cannot be reset.');
    }
    user.passwordHash = await hashPassword(input.newPassword);
    await this.customers.save(user);
    await this.auditService.record({
      actorType: 'customer',
      actorId: user.id,
      action: 'customer.password_reset',
      resourceType: 'customer',
      resourceId: user.id,
      request,
    });
    return { ok: true };
  }

  async requestCustomerEmailVerification(
    userId: string,
  ): Promise<{ ok: true }> {
    const user = await this.customers.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Authentication required.');
    }
    if (user.emailVerifiedAt) {
      return { ok: true };
    }
    const raw = await this.issueToken('customer', user.id, 'email_verify');
    const link = storefrontLink('/verify-email', raw);
    const content = verifyEmailMessage({
      fullName: user.fullName,
      link,
      token: raw,
    });
    await this.mail.send({
      to: user.email,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    return { ok: true };
  }

  async verifyCustomerEmail(
    token: string,
    request?: AuditRequestContext,
  ): Promise<{ ok: true }> {
    const record = await this.consumeToken(token, 'customer', 'email_verify');
    const user = await this.customers.findOne({
      where: { id: record.subjectId },
    });
    if (!user) {
      throw new NotFoundException('Account not found.');
    }
    user.emailVerifiedAt = new Date();
    await this.customers.save(user);
    await this.auditService.record({
      actorType: 'customer',
      actorId: user.id,
      action: 'customer.email_verified',
      resourceType: 'customer',
      resourceId: user.id,
      request,
    });
    return { ok: true };
  }

  async requestAdminPasswordReset(emailRaw: string): Promise<{ ok: true }> {
    const email = emailRaw.trim().toLowerCase();
    const admin = await this.admins.findOne({ where: { email } });
    if (admin?.isActive) {
      const raw = await this.issueToken('admin', admin.id, 'password_reset');
      const content = adminPasswordResetEmail({ token: raw });
      await this.mail.send({
        to: admin.email,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });
    }
    return { ok: true };
  }

  async resetAdminPassword(
    input: {
      token: string;
      newPassword: string;
      confirmNewPassword: string;
    },
    request?: AuditRequestContext,
  ): Promise<{ ok: true }> {
    this.assertPasswordPair(input.newPassword, input.confirmNewPassword);
    const record = await this.consumeToken(
      input.token,
      'admin',
      'password_reset',
    );
    const admin = await this.admins.findOne({
      where: { id: record.subjectId },
    });
    if (!admin) {
      throw new NotFoundException('Account not found.');
    }
    admin.passwordHash = await hashPassword(input.newPassword);
    await this.admins.save(admin);
    await this.auditService.record({
      actorType: 'admin',
      actorId: admin.id,
      action: 'admin.password_reset',
      resourceType: 'admin_user',
      resourceId: admin.id,
      request,
    });
    return { ok: true };
  }

  async purgeExpired(): Promise<void> {
    await this.tokens.delete({ expiresAt: LessThan(new Date()) });
  }

  private assertPasswordPair(password: string, confirm: string): void {
    if (password !== confirm) {
      throw new BadRequestException('Passwords do not match.');
    }
    if (!isPasswordPolicyValid(password)) {
      throw new BadRequestException(
        'Password must be at least 8 characters and contain at least 2 special characters.',
      );
    }
  }

  private async issueToken(
    subjectType: AuthTokenSubjectType,
    subjectId: string,
    purpose: AuthTokenPurpose,
  ): Promise<string> {
    await this.tokens.delete({ subjectType, subjectId, purpose });
    const raw = createSessionToken() + randomBytes(8).toString('base64url');
    const ttl = purpose === 'email_verify' ? VERIFY_TTL_MS : RESET_TTL_MS;
    const row = this.tokens.create({
      subjectType,
      subjectId,
      purpose,
      tokenHash: hashSessionToken(raw),
      expiresAt: new Date(Date.now() + ttl),
      usedAt: null,
    });
    await this.tokens.save(row);
    return raw;
  }

  private async consumeToken(
    raw: string,
    subjectType: AuthTokenSubjectType,
    purpose: AuthTokenPurpose,
  ): Promise<AuthToken> {
    const row = await this.tokens.findOne({
      where: {
        tokenHash: hashSessionToken(raw),
        subjectType,
        purpose,
      },
    });
    if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Invalid or expired token.');
    }
    row.usedAt = new Date();
    await this.tokens.save(row);
    return row;
  }
}
