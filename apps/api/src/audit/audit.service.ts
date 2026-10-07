import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AdminUser } from '../admin/entities/admin-user.entity';
import { User } from '../auth/entities/user.entity';
import { AuditLog, type AuditActorType } from './entities/audit-log.entity';

export type AuditRequestContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type RecordAuditInput = {
  actorType: AuditActorType;
  actorId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  request?: AuditRequestContext;
};

export type AuditLogView = {
  id: string;
  actorType: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly logs: Repository<AuditLog>,
    @InjectRepository(AdminUser)
    private readonly admins: Repository<AdminUser>,
    @InjectRepository(User)
    private readonly customers: Repository<User>,
  ) {}

  async record(input: RecordAuditInput): Promise<void> {
    try {
      const row = this.logs.create({
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        action: input.action,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        metadata: input.metadata ?? null,
        ipAddress: input.request?.ipAddress ?? null,
        userAgent: truncate(input.request?.userAgent, 512),
      });
      await this.logs.save(row);
    } catch (error: unknown) {
      // Audit must not break the business operation.
      this.logger.warn(
        `Failed to write audit log for ${input.action}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  async listRecent(limit = 100): Promise<AuditLog[]> {
    const take = Math.min(Math.max(limit, 1), 5000);
    return this.logs.find({
      order: { createdAt: 'DESC' },
      take,
    });
  }

  async listPage(
    options: {
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{
    items: AuditLogView[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = Math.min(Math.max(options.limit ?? 200, 1), 5000);
    const offset = Math.max(options.offset ?? 0, 0);
    const [rows, total] = await this.logs.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    const items = await this.toViews(rows);
    return { items, total, limit, offset };
  }

  private async toViews(rows: AuditLog[]): Promise<AuditLogView[]> {
    const adminIds = [
      ...new Set(
        rows
          .filter((row) => row.actorType === 'admin' && row.actorId)
          .map((row) => row.actorId as string),
      ),
    ];
    const customerIds = [
      ...new Set(
        rows
          .filter((row) => row.actorType === 'customer' && row.actorId)
          .map((row) => row.actorId as string),
      ),
    ];

    const [admins, customers] = await Promise.all([
      adminIds.length > 0
        ? this.admins.find({ where: { id: In(adminIds) } })
        : Promise.resolve([] as AdminUser[]),
      customerIds.length > 0
        ? this.customers.find({ where: { id: In(customerIds) } })
        : Promise.resolve([] as User[]),
    ]);

    const adminById = new Map(admins.map((row) => [row.id, row]));
    const customerById = new Map(customers.map((row) => [row.id, row]));

    return rows.map((row) => {
      let actorName: string | null = null;
      let actorEmail: string | null = null;
      if (row.actorType === 'admin' && row.actorId) {
        const admin = adminById.get(row.actorId);
        actorName = admin?.fullName ?? null;
        actorEmail = admin?.email ?? null;
      } else if (row.actorType === 'customer' && row.actorId) {
        const customer = customerById.get(row.actorId);
        actorName = customer?.fullName ?? null;
        actorEmail = customer?.email ?? null;
      } else if (row.actorType === 'system') {
        actorName = 'System';
      }

      return {
        id: row.id,
        actorType: row.actorType,
        actorId: row.actorId,
        actorName,
        actorEmail,
        action: row.action,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        metadata: row.metadata,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        createdAt: row.createdAt.toISOString(),
      };
    });
  }
}

export function auditRequestFromHeaders(
  headers: Record<string, string | string[] | undefined>,
  ip?: string | null,
): AuditRequestContext {
  const ua = headers['user-agent'];
  return {
    ipAddress: ip ?? null,
    userAgent: Array.isArray(ua) ? ua[0] : (ua ?? null),
  };
}

export function clientIpFromRequest(req: {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() ?? null;
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0]?.trim() ?? null;
  }
  return req.ip ?? null;
}

function truncate(
  value: string | null | undefined,
  max: number,
): string | null {
  if (!value) {
    return null;
  }
  return value.length > max ? value.slice(0, max) : value;
}
