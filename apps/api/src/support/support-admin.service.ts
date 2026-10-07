import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { AdminUser } from '../admin/entities/admin-user.entity';
import type { SupportAttachmentAccessDto } from '../admin/dto/support/support-attachment-access.dto';
import type { UpdateSupportConversationDto } from '../admin/dto/support/update-support-conversation.dto';
import type { SupportConversationDetailDto } from '../admin/dto/support/support-conversation-detail.dto';
import type {
  SupportConversationListItemDto,
  SupportConversationListResponseDto,
} from '../admin/dto/support/support-conversation-list.dto';
import type { SupportAttachmentDto } from '../admin/dto/support/support-attachment.dto';
import type { SupportMessageDto } from '../admin/dto/support/support-message.dto';
import {
  auditRequestFromHeaders,
  AuditService,
  clientIpFromRequest,
  type AuditRequestContext,
} from '../audit/audit.service';
import { User } from '../auth/entities/user.entity';
import { isValidEmailFormat, normalizeEmail } from '../common/validation/email';
import { SupportAttachment } from './entities/support-attachment.entity';
import { SupportConversation } from './entities/support-conversation.entity';
import { SupportMessage } from './entities/support-message.entity';
import { SUPPORT_S3_BUCKET_DEFAULT } from './support-email.util';
import {
  buildReferencesHeader,
  buildSupportReplyBodyText,
  buildSupportReplySubject,
  generateSupportRfcMessageId,
  SUPPORT_REPLY_HISTORY_MAX_MESSAGES,
  supportBodyFingerprint,
} from './support-outbound-mail.util';
import { SupportOutboundService } from './support-outbound.service';
import { SUPPORT_S3_CLIENT } from './support-s3.client';
import {
  SupportConversationStatus,
  SupportMessageDirection,
} from './support.enums';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const ATTACHMENT_URL_TTL_SECONDS = 5 * 60;

export type SupportAdminListQuery = {
  page?: number;
  limit?: number;
  status?: SupportConversationStatus;
  search?: string;
};

export type SupportAdminAuditActor = {
  actorId: string | null;
  request?: AuditRequestContext;
};

@Injectable()
export class SupportAdminService {
  private readonly logger = new Logger(SupportAdminService.name);
  private readonly bucket: string;

  constructor(
    @InjectRepository(SupportConversation)
    private readonly conversations: Repository<SupportConversation>,
    @InjectRepository(SupportMessage)
    private readonly messages: Repository<SupportMessage>,
    @InjectRepository(SupportAttachment)
    private readonly attachments: Repository<SupportAttachment>,
    @InjectRepository(AdminUser)
    private readonly admins: Repository<AdminUser>,
    @InjectRepository(User)
    private readonly customers: Repository<User>,
    @Inject(SUPPORT_S3_CLIENT) private readonly s3: S3Client,
    private readonly outbound: SupportOutboundService,
    private readonly audit: AuditService,
  ) {
    this.bucket =
      process.env.SUPPORT_S3_BUCKET?.trim() || SUPPORT_S3_BUCKET_DEFAULT;
  }

  async list(
    query: SupportAdminListQuery,
  ): Promise<SupportConversationListResponseDto> {
    const page = normalizePage(query.page);
    const limit = normalizeLimit(query.limit);

    const qb = this.conversations
      .createQueryBuilder('c')
      .orderBy('c.lastMessageAt', 'DESC')
      .addOrderBy('c.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status });
    }

    const search = query.search?.trim();
    if (search) {
      qb.andWhere(
        '(LOWER(c.requesterEmail) LIKE :q OR LOWER(c.subject) LIKE :q OR LOWER(COALESCE(c.requesterName, :empty)) LIKE :q)',
        { q: `%${search.toLowerCase()}%`, empty: '' },
      );
    }

    const [rows, total] = await qb.getManyAndCount();
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      items: rows.map((row) => this.toListItem(row)),
      page,
      limit,
      total,
      totalPages,
    };
  }

  async getDetail(id: string): Promise<SupportConversationDetailDto> {
    const conversation = await this.conversations.findOne({ where: { id } });
    if (!conversation) {
      throw new NotFoundException('Support conversation not found.');
    }

    const [customer, assignee, messages] = await Promise.all([
      conversation.customerId
        ? this.customers.findOne({ where: { id: conversation.customerId } })
        : Promise.resolve(null),
      conversation.assigneeAdminId
        ? this.admins.findOne({ where: { id: conversation.assigneeAdminId } })
        : Promise.resolve(null),
      this.messages.find({
        where: { conversationId: conversation.id },
        relations: { attachments: true },
        order: { createdAt: 'ASC' },
      }),
    ]);

    return {
      conversation: this.toListItem(conversation),
      customer: customer ? this.toCustomerSummary(customer) : null,
      assignee: assignee ? this.toAssigneeSummary(assignee) : null,
      messages: messages.map((message) => this.toMessageDto(message)),
    };
  }

  /**
   * Issue a short-lived S3 GET URL for an attachment scoped to a conversation.
   * storageKey is never accepted from the client.
   */
  async getAttachmentAccess(
    conversationId: string,
    attachmentId: string,
  ): Promise<SupportAttachmentAccessDto> {
    const conversation = await this.conversations.findOne({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException('Support conversation not found.');
    }

    const attachment = await this.attachments
      .createQueryBuilder('a')
      .innerJoin('a.message', 'm')
      .where('a.id = :attachmentId', { attachmentId })
      .andWhere('m.conversationId = :conversationId', { conversationId })
      .getOne();

    if (!attachment) {
      throw new NotFoundException('Support attachment not found.');
    }

    const contentDisposition = buildContentDisposition(
      attachment.fileName,
      attachment.contentType,
    );
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: attachment.storageKey,
      ResponseContentType: attachment.contentType,
      ResponseContentDisposition: contentDisposition,
    });
    const url = await getSignedUrl(this.s3, command, {
      expiresIn: ATTACHMENT_URL_TTL_SECONDS,
    });

    return {
      url,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
    };
  }

  async update(
    id: string,
    dto: UpdateSupportConversationDto,
    actor: SupportAdminAuditActor,
  ): Promise<SupportConversationListItemDto> {
    if (dto.status === undefined && dto.assigneeAdminId === undefined) {
      throw new BadRequestException(
        'Provide status and/or assigneeAdminId to update.',
      );
    }

    const conversation = await this.conversations.findOne({ where: { id } });
    if (!conversation) {
      throw new NotFoundException('Support conversation not found.');
    }

    const oldStatus = conversation.status;
    const oldAssigneeAdminId = conversation.assigneeAdminId;

    if (dto.status !== undefined) {
      conversation.status = dto.status;
    }

    if (dto.assigneeAdminId !== undefined) {
      if (dto.assigneeAdminId === null) {
        conversation.assigneeAdminId = null;
      } else {
        const admin = await this.admins.findOne({
          where: { id: dto.assigneeAdminId },
        });
        if (!admin) {
          throw new BadRequestException('Assignee admin not found.');
        }
        conversation.assigneeAdminId = admin.id;
      }
    }

    await this.conversations.save(conversation);

    if (dto.status !== undefined && dto.status !== oldStatus) {
      await this.audit.record({
        actorType: 'admin',
        actorId: actor.actorId,
        action: 'support.status_update',
        resourceType: 'support_conversation',
        resourceId: conversation.id,
        metadata: {
          conversationId: conversation.id,
          oldStatus,
          newStatus: conversation.status,
        },
        request: actor.request,
      });
    }

    if (
      dto.assigneeAdminId !== undefined &&
      conversation.assigneeAdminId !== oldAssigneeAdminId
    ) {
      await this.audit.record({
        actorType: 'admin',
        actorId: actor.actorId,
        action: 'support.assignment_update',
        resourceType: 'support_conversation',
        resourceId: conversation.id,
        metadata: {
          conversationId: conversation.id,
          oldAssigneeAdminId,
          newAssigneeAdminId: conversation.assigneeAdminId,
        },
        request: actor.request,
      });
    }

    return this.toListItem(conversation);
  }

  /**
   * Send a plain-text support reply via SES SendRawEmail, then persist outbound
   * message + set conversation to pending. SES cannot be rolled back if DB fails.
   */
  async reply(
    conversationId: string,
    bodyTextRaw: string,
    actor: SupportAdminAuditActor,
  ): Promise<{
    message: SupportMessageDto;
    conversation: SupportConversationListItemDto;
  }> {
    const bodyText = bodyTextRaw.trim();
    if (!bodyText) {
      throw new BadRequestException('Reply message cannot be empty.');
    }
    if (!actor.actorId) {
      throw new BadRequestException('Admin session required.');
    }

    const conversation = await this.conversations.findOne({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException('Support conversation not found.');
    }

    const toEmail = normalizeEmail(conversation.requesterEmail);
    if (!toEmail || !isValidEmailFormat(toEmail)) {
      throw new BadRequestException(
        'Conversation has no valid requester email to reply to.',
      );
    }

    const parent = await this.messages.findOne({
      where: {
        conversationId: conversation.id,
        sesMessageId: Not(IsNull()),
      },
      order: { createdAt: 'DESC' },
    });

    // Newest-first page, then reverse so quoted history is oldest → newest.
    const priorNewestFirst = await this.messages.find({
      where: { conversationId: conversation.id },
      order: { createdAt: 'DESC' },
      take: SUPPORT_REPLY_HISTORY_MAX_MESSAGES,
    });
    const priorMessages = [...priorNewestFirst].reverse();

    const subject = buildSupportReplySubject(conversation.subject);
    const rfcMessageId = generateSupportRfcMessageId();
    const inReplyTo = parent?.sesMessageId ?? null;
    const references = buildReferencesHeader(parent?.references, inReplyTo);
    const outboundBodyText = buildSupportReplyBodyText({
      replyText: bodyText,
      priorMessages: priorMessages.map((row) => ({
        fromEmail: row.fromEmail,
        bodyText: row.bodyText,
        createdAt: row.createdAt,
      })),
    });

    const sent = await this.outbound.sendRaw({
      toEmail,
      subject,
      bodyText: outboundBodyText,
      rfcMessageId,
      inReplyTo,
      references,
    });

    const now = new Date();
    try {
      const message = this.messages.create({
        conversationId: conversation.id,
        direction: SupportMessageDirection.OUTBOUND,
        fromEmail: this.outbound.getFromEmail(),
        toEmail,
        subject,
        // Persist admin text only — quoted history is for the outbound MIME.
        bodyText,
        bodyHtml: null,
        // RFC Message-ID for threading (same column meaning as inbound).
        sesMessageId: rfcMessageId,
        awsSesMessageId: sent.awsSesMessageId,
        inReplyTo,
        references,
        adminUserId: actor.actorId,
      });
      const savedMessage = await this.messages.save(message);

      conversation.status = SupportConversationStatus.PENDING;
      conversation.lastMessageAt = now;
      await this.conversations.save(conversation);

      await this.audit.record({
        actorType: 'admin',
        actorId: actor.actorId,
        action: 'support.reply',
        resourceType: 'support_conversation',
        resourceId: conversation.id,
        metadata: {
          conversationId: conversation.id,
          messageId: savedMessage.id,
          requesterEmail: toEmail,
          adminUserId: actor.actorId,
        },
        request: actor.request,
      });

      return {
        message: this.toMessageDto({ ...savedMessage, attachments: [] }),
        conversation: this.toListItem(conversation),
      };
    } catch (error: unknown) {
      // Email was already accepted by SES — do not claim success without a row.
      this.logger.error(
        `Support reply SES succeeded but DB persist failed conversationId=${conversation.id} rfcMessageId=${rfcMessageId} awsSesMessageId=${sent.awsSesMessageId ?? 'none'} bodyFp=${supportBodyFingerprint(bodyText)}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      throw error;
    }
  }

  private toListItem(row: SupportConversation): SupportConversationListItemDto {
    return {
      id: row.id,
      subject: row.subject,
      status: row.status,
      requesterEmail: row.requesterEmail,
      requesterName: row.requesterName,
      customerId: row.customerId,
      assigneeAdminId: row.assigneeAdminId,
      lastMessageAt: row.lastMessageAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toCustomerSummary(user: User) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      isActive: user.isActive !== false,
    };
  }

  private toAssigneeSummary(admin: AdminUser) {
    return {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      isActive: admin.isActive,
    };
  }

  private toMessageDto(message: SupportMessage): SupportMessageDto {
    return {
      id: message.id,
      direction: message.direction,
      fromEmail: message.fromEmail,
      toEmail: message.toEmail,
      subject: message.subject,
      bodyText: message.bodyText,
      bodyHtml: message.bodyHtml,
      sesMessageId: message.sesMessageId,
      inReplyTo: message.inReplyTo,
      references: message.references,
      adminUserId: message.adminUserId,
      createdAt: message.createdAt.toISOString(),
      attachments: (message.attachments ?? []).map((att) =>
        this.toAttachmentDto(att),
      ),
    };
  }

  private toAttachmentDto(att: SupportAttachment): SupportAttachmentDto {
    return {
      id: att.id,
      fileName: att.fileName,
      contentType: att.contentType,
      sizeBytes: att.sizeBytes,
      storageKey: att.storageKey,
      createdAt: att.createdAt.toISOString(),
    };
  }
}

export function normalizePage(raw: number | undefined): number {
  if (!Number.isFinite(raw) || raw === undefined) {
    return DEFAULT_PAGE;
  }
  return Math.max(1, Math.trunc(raw));
}

export function normalizeLimit(raw: number | undefined): number {
  if (!Number.isFinite(raw) || raw === undefined) {
    return DEFAULT_LIMIT;
  }
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(raw)));
}

function isInlineViewableContentType(contentType: string): boolean {
  const lower = contentType.toLowerCase();
  return (
    lower.startsWith('image/') ||
    lower.startsWith('text/') ||
    lower === 'application/pdf'
  );
}

function buildContentDisposition(
  fileName: string,
  contentType: string,
): string {
  const safeName = fileName.replace(/["\\\r\n]/g, '_').slice(0, 200) || 'file';
  const kind = isInlineViewableContentType(contentType)
    ? 'inline'
    : 'attachment';
  return `${kind}; filename="${safeName}"`;
}

/** Helper for controller request audit context. */
export function supportAuditFromRequest(req: {
  headers: Record<string, string | string[] | undefined>;
  admin?: { id: string } | undefined;
  ip?: string;
  socket?: { remoteAddress?: string };
}): SupportAdminAuditActor {
  return {
    actorId: req.admin?.id ?? null,
    request: auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
  };
}
