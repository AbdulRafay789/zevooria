import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type _Object,
  type S3Client,
} from '@aws-sdk/client-s3';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { simpleParser, type Attachment, type ParsedMail } from 'mailparser';
import { DataSource, In, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { User } from '../auth/entities/user.entity';
import { SupportAttachment } from './entities/support-attachment.entity';
import { SupportConversation } from './entities/support-conversation.entity';
import { SupportInboundObject } from './entities/support-inbound-object.entity';
import { SupportMessage } from './entities/support-message.entity';
import {
  SupportConversationStatus,
  SupportInboundObjectStatus,
  SupportMessageDirection,
} from './support.enums';
import {
  buildAttachmentStorageKey,
  extractAddress,
  isSesSetupNotificationKey,
  normalizeEmail,
  normalizeMessageId,
  normalizeSubject,
  parseReferencesHeader,
  SUPPORT_S3_BUCKET_DEFAULT,
  SUPPORT_S3_INCOMING_PREFIX,
} from './support-email.util';
import { SUPPORT_S3_CLIENT } from './support-s3.client';

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_LIST_MAX_KEYS = 50;
const DEFAULT_SUPPORT_TO = 'support@zevooria.com';

export type SupportInboundPollResult = {
  listed: number;
  processed: number;
  skipped: number;
  failed: number;
  ignored: number;
};

type ParsedInboundMail = {
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  /** Normalized RFC Message-ID (thread id), not SES Send* MessageId. */
  rfcMessageId: string | null;
  inReplyTo: string | null;
  references: string | null;
  attachments: Array<{
    fileName: string;
    contentType: string;
    sizeBytes: number;
    content: Buffer;
  }>;
};

@Injectable()
export class SupportInboundService {
  private readonly logger = new Logger(SupportInboundService.name);
  private readonly bucket: string;
  private readonly prefix: string;
  private readonly batchSize: number;

  constructor(
    private readonly dataSource: DataSource,
    @Inject(SUPPORT_S3_CLIENT) private readonly s3: S3Client,
    private readonly audit: AuditService,
    @InjectRepository(SupportInboundObject)
    private readonly inboundObjects: Repository<SupportInboundObject>,
    @InjectRepository(SupportConversation)
    private readonly conversations: Repository<SupportConversation>,
    @InjectRepository(SupportMessage)
    private readonly messages: Repository<SupportMessage>,
    @InjectRepository(User)
    private readonly customers: Repository<User>,
  ) {
    this.bucket =
      process.env.SUPPORT_S3_BUCKET?.trim() || SUPPORT_S3_BUCKET_DEFAULT;
    this.prefix =
      process.env.SUPPORT_S3_INCOMING_PREFIX?.trim() ||
      SUPPORT_S3_INCOMING_PREFIX;
    const parsedBatch = Number(process.env.SUPPORT_INBOUND_BATCH_SIZE ?? '');
    this.batchSize =
      Number.isFinite(parsedBatch) && parsedBatch > 0
        ? Math.min(Math.trunc(parsedBatch), 100)
        : DEFAULT_BATCH_SIZE;
  }

  /**
   * List a bounded set of S3 objects and ingest new inbound emails.
   * Safe to call from the scheduler; does not throw for per-object failures.
   */
  async pollOnce(): Promise<SupportInboundPollResult> {
    const result: SupportInboundPollResult = {
      listed: 0,
      processed: 0,
      skipped: 0,
      failed: 0,
      ignored: 0,
    };

    let objects: _Object[] = [];
    try {
      objects = await this.listIncomingObjects();
    } catch (error: unknown) {
      this.logger.error(
        `Support inbound list failed bucket=${this.bucket} prefix=${this.prefix}: ${errorMessage(error)}`,
      );
      return result;
    }

    result.listed = objects.length;
    let handled = 0;

    for (const object of objects) {
      if (handled >= this.batchSize) {
        break;
      }
      const key = object.Key?.trim();
      if (!key || key.endsWith('/')) {
        continue;
      }
      handled += 1;

      try {
        const outcome = await this.processObject(key, object.ETag ?? null);
        if (outcome === 'processed') {
          result.processed += 1;
        } else if (outcome === 'skipped') {
          result.skipped += 1;
        } else if (outcome === 'ignored') {
          result.ignored += 1;
        } else {
          result.failed += 1;
        }
      } catch (error: unknown) {
        result.failed += 1;
        this.logger.error(
          `Support inbound unexpected error s3Key=${key}: ${errorMessage(error)}`,
        );
        await this.recordFailure(key, object.ETag ?? null, null, error);
      }
    }

    this.logger.log(
      `Support inbound poll listed=${result.listed} processed=${result.processed} skipped=${result.skipped} ignored=${result.ignored} failed=${result.failed}`,
    );
    return result;
  }

  /**
   * Process a single S3 object. Exposed for tests.
   */
  async processObject(
    s3Key: string,
    etag: string | null,
  ): Promise<'processed' | 'skipped' | 'ignored' | 'failed'> {
    const existing = await this.inboundObjects.findOne({
      where: { s3Key },
    });
    if (existing?.status === SupportInboundObjectStatus.PROCESSED) {
      return 'skipped';
    }

    if (isSesSetupNotificationKey(s3Key)) {
      await this.markInbound(
        s3Key,
        etag,
        null,
        SupportInboundObjectStatus.PROCESSED,
        null,
      );
      this.logger.log(
        `Support inbound ignored SES setup notification s3Key=${s3Key}`,
      );
      return 'ignored';
    }

    let body: Buffer;
    try {
      body = await this.getObjectBuffer(s3Key);
    } catch (error: unknown) {
      await this.recordFailure(s3Key, etag, null, error);
      return 'failed';
    }

    const sha256 = createHash('sha256').update(body).digest('hex');

    let parsed: ParsedInboundMail;
    try {
      parsed = await this.parseMime(body);
    } catch (error: unknown) {
      await this.recordFailure(s3Key, etag, sha256, error);
      return 'failed';
    }

    if (!parsed.fromEmail) {
      await this.recordFailure(
        s3Key,
        etag,
        sha256,
        new Error('Inbound email missing From address'),
      );
      return 'failed';
    }

    // Pre-assign message/attachment IDs so S3 keys are known before the DB TX.
    const messageId = randomUUID();
    const plannedAttachments = parsed.attachments.map((att) => {
      const attachmentId = randomUUID();
      const storageKey = buildAttachmentStorageKey({
        messageId,
        attachmentId,
        fileName: att.fileName,
      });
      return {
        id: attachmentId,
        fileName: att.fileName,
        contentType: att.contentType,
        sizeBytes: att.sizeBytes,
        storageKey,
        content: att.content,
      };
    });

    try {
      // Upload attachment bytes before the DB transaction commits.
      await this.uploadAttachments(
        plannedAttachments.map((att) => ({
          storageKey: att.storageKey,
          content: att.content,
          contentType: att.contentType,
        })),
      );
    } catch (error: unknown) {
      await this.recordFailure(s3Key, etag, sha256, error);
      return 'failed';
    }

    try {
      const persisted = await this.persistInboundEmail(
        parsed,
        { s3Key, etag, sha256 },
        {
          messageId,
          attachments: plannedAttachments.map((att) => ({
            id: att.id,
            fileName: att.fileName,
            contentType: att.contentType,
            sizeBytes: att.sizeBytes,
            storageKey: att.storageKey,
          })),
        },
      );
      await this.audit.record({
        actorType: 'system',
        action: 'support.inbound.process',
        resourceType: 'support_conversation',
        resourceId: persisted.conversationId,
        metadata: {
          s3Key,
          conversationId: persisted.conversationId,
          messageId: persisted.messageId,
          attachmentCount: plannedAttachments.length,
        },
      });
      this.logger.log(
        `Support inbound processed s3Key=${s3Key} conversationId=${persisted.conversationId} messageId=${persisted.messageId}`,
      );
      return 'processed';
    } catch (error: unknown) {
      if (error instanceof AlreadyProcessedError) {
        return 'skipped';
      }
      // Orphan S3 attachment objects are acceptable for now; log for ops follow-up.
      if (plannedAttachments.length > 0) {
        this.logger.warn(
          `Support inbound DB persist failed after attachment upload s3Key=${s3Key} orphanStorageKeys=${plannedAttachments
            .map((a) => a.storageKey)
            .join(',')}: ${errorMessage(error)}`,
        );
      }
      await this.recordFailure(s3Key, etag, sha256, error);
      return 'failed';
    }
  }

  /** Pure MIME parse for tests. */
  async parseMime(raw: Buffer): Promise<ParsedInboundMail> {
    const mail: ParsedMail = await simpleParser(raw);
    const from = extractAddress(firstAddressObject(mail.from));
    const to = extractAddress(firstAddressObject(mail.to));
    const rfcMessageId = normalizeMessageId(mail.messageId ?? null);
    const inReplyTo = normalizeMessageId(
      typeof mail.inReplyTo === 'string'
        ? mail.inReplyTo
        : Array.isArray(mail.inReplyTo)
          ? mail.inReplyTo[0]
          : null,
    );
    const referenceIds = parseReferencesHeader(mail.references ?? null);
    const bodyText =
      (mail.text ?? '').trim() ||
      (typeof mail.html === 'string' && mail.html.trim()
        ? stripHtml(mail.html)
        : '') ||
      '(no text body)';
    const bodyHtml =
      typeof mail.html === 'string' && mail.html.trim() ? mail.html : null;

    const attachments = (mail.attachments ?? [])
      .filter((att) => !att.related)
      .map((att) => toAttachmentPayload(att))
      .filter((att): att is NonNullable<typeof att> => Boolean(att));

    return {
      fromEmail: from.email,
      fromName: from.name,
      toEmail: to.email || DEFAULT_SUPPORT_TO,
      subject: (mail.subject ?? '').trim() || '(no subject)',
      bodyText,
      bodyHtml,
      rfcMessageId,
      inReplyTo,
      references: referenceIds.length > 0 ? referenceIds.join(' ') : null,
      attachments,
    };
  }

  private async listIncomingObjects(): Promise<_Object[]> {
    const response = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: this.prefix,
        MaxKeys: DEFAULT_LIST_MAX_KEYS,
      }),
    );
    return response.Contents ?? [];
  }

  private async getObjectBuffer(s3Key: string): Promise<Buffer> {
    const response = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
      }),
    );
    const stream = response.Body;
    if (!stream) {
      throw new Error('S3 object body was empty');
    }
    const bytes = await stream.transformToByteArray();
    return Buffer.from(bytes);
  }

  private async persistInboundEmail(
    parsed: ParsedInboundMail,
    meta: { s3Key: string; etag: string | null; sha256: string },
    prepared: {
      messageId: string;
      attachments: Array<{
        id: string;
        fileName: string;
        contentType: string;
        sizeBytes: number;
        storageKey: string;
      }>;
    },
  ): Promise<{
    conversationId: string;
    messageId: string;
  }> {
    return this.dataSource.transaction(async (manager) => {
      // Re-check inside the transaction to avoid duplicate messages on race.
      const existing = await manager.findOne(SupportInboundObject, {
        where: { s3Key: meta.s3Key },
      });
      if (existing?.status === SupportInboundObjectStatus.PROCESSED) {
        throw new AlreadyProcessedError(meta.s3Key);
      }

      const customer = await manager
        .getRepository(User)
        .createQueryBuilder('u')
        .where('LOWER(u.email) = :email', { email: parsed.fromEmail })
        .getOne();

      const conversation = await this.resolveConversation(
        manager,
        parsed,
        customer,
      );
      const now = new Date();
      conversation.lastMessageAt = now;
      if (!conversation.customerId && customer) {
        conversation.customerId = customer.id;
      }
      if (!conversation.requesterName && parsed.fromName) {
        conversation.requesterName = parsed.fromName;
      }
      await manager.save(conversation);

      const message = manager.create(SupportMessage, {
        id: prepared.messageId,
        conversationId: conversation.id,
        direction: SupportMessageDirection.INBOUND,
        fromEmail: parsed.fromEmail,
        toEmail: parsed.toEmail,
        subject: parsed.subject,
        bodyText: parsed.bodyText,
        bodyHtml: parsed.bodyHtml,
        // Store RFC Message-ID for threading (not SES Send* API MessageId).
        sesMessageId: parsed.rfcMessageId,
        inReplyTo: parsed.inReplyTo,
        references: parsed.references,
        adminUserId: null,
      });
      const savedMessage = await manager.save(message);

      for (const att of prepared.attachments) {
        const row = manager.create(SupportAttachment, {
          id: att.id,
          messageId: savedMessage.id,
          fileName: att.fileName.slice(0, 500),
          contentType: att.contentType.slice(0, 255),
          sizeBytes: att.sizeBytes,
          storageKey: att.storageKey,
        });
        await manager.save(row);
      }

      if (existing) {
        existing.etag = meta.etag;
        existing.sha256 = meta.sha256;
        existing.status = SupportInboundObjectStatus.PROCESSED;
        existing.processedAt = now;
        existing.error = null;
        await manager.save(existing);
      } else {
        await manager.save(
          manager.create(SupportInboundObject, {
            s3Key: meta.s3Key,
            etag: meta.etag,
            sha256: meta.sha256,
            status: SupportInboundObjectStatus.PROCESSED,
            processedAt: now,
            error: null,
          }),
        );
      }

      return {
        conversationId: conversation.id,
        messageId: savedMessage.id,
      };
    });
  }

  private async resolveConversation(
    manager: {
      getRepository: DataSource['manager']['getRepository'];
    },
    parsed: ParsedInboundMail,
    customer: User | null,
  ): Promise<SupportConversation> {
    const messageRepo = manager.getRepository(SupportMessage);
    const conversationRepo = manager.getRepository(SupportConversation);

    if (parsed.inReplyTo) {
      const byReply = await messageRepo.findOne({
        where: { sesMessageId: parsed.inReplyTo },
      });
      if (byReply) {
        const conversation = await conversationRepo.findOne({
          where: { id: byReply.conversationId },
        });
        if (conversation) {
          return conversation;
        }
      }
    }

    const referenceIds = parseReferencesHeader(parsed.references);
    if (referenceIds.length > 0) {
      const byRef = await messageRepo.findOne({
        where: { sesMessageId: In(referenceIds) },
        order: { createdAt: 'DESC' },
      });
      if (byRef) {
        const conversation = await conversationRepo.findOne({
          where: { id: byRef.conversationId },
        });
        if (conversation) {
          return conversation;
        }
      }
    }

    const candidates = await conversationRepo.find({
      where: {
        requesterEmail: parsed.fromEmail,
        status: In([
          SupportConversationStatus.OPEN,
          SupportConversationStatus.PENDING,
        ]),
      },
      order: { lastMessageAt: 'DESC' },
      take: 50,
    });
    const normalized = normalizeSubject(parsed.subject);
    const bySubject = candidates.find(
      (row) => normalizeSubject(row.subject) === normalized,
    );
    if (bySubject) {
      return bySubject;
    }

    return conversationRepo.create({
      subject: parsed.subject.slice(0, 998),
      status: SupportConversationStatus.OPEN,
      requesterEmail: parsed.fromEmail,
      requesterName: parsed.fromName,
      customerId: customer?.id ?? null,
      assigneeAdminId: null,
      lastMessageAt: new Date(),
    });
  }

  private async uploadAttachments(
    uploads: Array<{
      storageKey: string;
      content: Buffer;
      contentType: string;
    }>,
  ): Promise<void> {
    for (const upload of uploads) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: upload.storageKey,
          Body: upload.content,
          ContentType: upload.contentType,
        }),
      );
    }
  }

  private async recordFailure(
    s3Key: string,
    etag: string | null,
    sha256: string | null,
    error: unknown,
  ): Promise<void> {
    const message = errorMessage(error);
    this.logger.warn(`Support inbound failed s3Key=${s3Key}: ${message}`);
    try {
      await this.markInbound(
        s3Key,
        etag,
        sha256,
        SupportInboundObjectStatus.FAILED,
        message.slice(0, 4000),
      );
      await this.audit.record({
        actorType: 'system',
        action: 'support.inbound.failed',
        resourceType: 'support_inbound_object',
        resourceId: null,
        metadata: { s3Key, error: message.slice(0, 500) },
      });
    } catch (persistError: unknown) {
      this.logger.error(
        `Support inbound failed to persist failure s3Key=${s3Key}: ${errorMessage(persistError)}`,
      );
    }
  }

  private async markInbound(
    s3Key: string,
    etag: string | null,
    sha256: string | null,
    status: SupportInboundObjectStatus,
    error: string | null,
  ): Promise<void> {
    const existing = await this.inboundObjects.findOne({ where: { s3Key } });
    const now = new Date();
    if (existing) {
      existing.etag = etag ?? existing.etag;
      existing.sha256 = sha256 ?? existing.sha256;
      existing.status = status;
      existing.processedAt =
        status === SupportInboundObjectStatus.PROCESSED
          ? now
          : existing.processedAt;
      existing.error = error;
      await this.inboundObjects.save(existing);
      return;
    }
    await this.inboundObjects.save(
      this.inboundObjects.create({
        s3Key,
        etag,
        sha256,
        status,
        processedAt:
          status === SupportInboundObjectStatus.PROCESSED ? now : null,
        error,
      }),
    );
  }
}

class AlreadyProcessedError extends Error {
  constructor(s3Key: string) {
    super(`Already processed: ${s3Key}`);
    this.name = 'AlreadyProcessedError';
  }
}

function firstAddressObject(value: ParsedMail['from'] | ParsedMail['to']): {
  value?: Array<{ address?: string | null; name?: string | null }>;
  text?: string;
} | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toAttachmentPayload(att: Attachment): {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  content: Buffer;
} | null {
  const content = Buffer.isBuffer(att.content)
    ? att.content
    : att.content
      ? Buffer.from(att.content)
      : null;
  if (!content || content.length === 0) {
    return null;
  }
  return {
    fileName: (att.filename || 'attachment').toString(),
    contentType: (att.contentType || 'application/octet-stream').toString(),
    sizeBytes: content.length,
    content,
  };
}
