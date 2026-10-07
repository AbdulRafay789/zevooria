import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminSupportController } from '../admin/admin-support.controller';
import { AdminAuthService } from '../admin/admin-auth.service';
import { ListSupportConversationsQueryDto } from '../admin/dto/support/list-support-conversations.dto';
import { UpdateSupportConversationDto } from '../admin/dto/support/update-support-conversation.dto';
import { PERMISSIONS_KEY } from '../admin/permissions.decorator';
import { PermissionsGuard } from '../admin/permissions.guard';
import {
  normalizeLimit,
  normalizePage,
  SupportAdminService,
} from './support-admin.service';
import { SupportConversationStatus } from './support.enums';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/file.pdf'),
}));

function conversationRow(
  overrides: Partial<{
    id: string;
    subject: string;
    status: SupportConversationStatus;
    requesterEmail: string;
    requesterName: string | null;
    customerId: string | null;
    assigneeAdminId: string | null;
    lastMessageAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
) {
  const now = new Date('2026-10-01T12:00:00.000Z');
  return {
    id: overrides.id ?? 'conv-1',
    subject: overrides.subject ?? 'Help please',
    status: overrides.status ?? SupportConversationStatus.OPEN,
    requesterEmail: overrides.requesterEmail ?? 'customer@example.com',
    requesterName: overrides.requesterName ?? 'Ayesha',
    customerId: overrides.customerId ?? null,
    assigneeAdminId: overrides.assigneeAdminId ?? null,
    lastMessageAt: overrides.lastMessageAt ?? now,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

type Harness = {
  service: SupportAdminService;
  qb: {
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    addOrderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };
  conversations: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
  };
  messages: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  attachments: {
    createQueryBuilder: jest.Mock;
  };
  attachmentQb: {
    innerJoin: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    getOne: jest.Mock;
  };
  admins: { findOne: jest.Mock };
  customers: { findOne: jest.Mock };
  auditRecord: jest.Mock;
  outboundSendRaw: jest.Mock;
};

function createHarness(): Harness {
  const qb = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
  const conversations = {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    findOne: jest.fn(),
    save: jest.fn((row: unknown) => Promise.resolve(row)),
  };
  const messages = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((_data: unknown) => _data),
    save: jest.fn((row: Record<string, unknown>) =>
      Promise.resolve({
        id: 'msg-out-1',
        attachments: [],
        createdAt: new Date('2026-10-07T00:00:00.000Z'),
        ...row,
      }),
    ),
  };
  const attachmentQb = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
  };
  const attachments = {
    createQueryBuilder: jest.fn().mockReturnValue(attachmentQb),
  };
  const admins = { findOne: jest.fn() };
  const customers = { findOne: jest.fn() };
  const auditRecord = jest.fn().mockResolvedValue(undefined);
  const outboundSendRaw = jest.fn().mockResolvedValue({
    awsSesMessageId: 'ses-api-msg-1',
  });
  const outbound = {
    sendRaw: outboundSendRaw,
    getFromEmail: () => 'support@zevooria.com',
    getFromHeader: () => 'Zevooria Support <support@zevooria.com>',
  };

  const service = new SupportAdminService(
    conversations as never,
    messages as never,
    attachments as never,
    admins as never,
    customers as never,
    { send: jest.fn() } as never,
    outbound as never,
    { record: auditRecord } as never,
  );

  return {
    service,
    qb,
    conversations,
    messages,
    attachments,
    attachmentQb,
    admins,
    customers,
    auditRecord,
    outboundSendRaw,
  };
}

describe('SupportAdminService', () => {
  beforeEach(() => {
    jest.mocked(getSignedUrl).mockClear();
    jest
      .mocked(getSignedUrl)
      .mockResolvedValue('https://signed.example/file.pdf');
  });

  it('lists conversations with default pagination', async () => {
    const h = createHarness();
    const row = conversationRow();
    h.qb.getManyAndCount.mockResolvedValue([[row], 1]);

    const result = await h.service.list({});

    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'conv-1',
      subject: 'Help please',
      requesterEmail: 'customer@example.com',
    });
    expect(result.items[0]).not.toHaveProperty('bodyText');
    expect(h.qb.skip).toHaveBeenCalledWith(0);
    expect(h.qb.take).toHaveBeenCalledWith(20);
    expect(h.qb.orderBy).toHaveBeenCalledWith('c.lastMessageAt', 'DESC');
    expect(h.qb.addOrderBy).toHaveBeenCalledWith('c.createdAt', 'DESC');
  });

  it('applies custom pagination', async () => {
    const h = createHarness();
    h.qb.getManyAndCount.mockResolvedValue([[], 45]);

    const result = await h.service.list({ page: 3, limit: 10 });

    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
    expect(result.total).toBe(45);
    expect(result.totalPages).toBe(5);
    expect(h.qb.skip).toHaveBeenCalledWith(20);
    expect(h.qb.take).toHaveBeenCalledWith(10);
  });

  it('clamps limit to 100', async () => {
    const h = createHarness();
    h.qb.getManyAndCount.mockResolvedValue([[], 0]);

    const result = await h.service.list({ limit: 500 });

    expect(result.limit).toBe(100);
    expect(h.qb.take).toHaveBeenCalledWith(100);
    expect(normalizeLimit(500)).toBe(100);
    expect(normalizePage(0)).toBe(1);
  });

  it('filters by status', async () => {
    const h = createHarness();
    h.qb.getManyAndCount.mockResolvedValue([[], 0]);

    await h.service.list({ status: SupportConversationStatus.PENDING });

    expect(h.qb.andWhere).toHaveBeenCalledWith('c.status = :status', {
      status: SupportConversationStatus.PENDING,
    });
  });

  it('searches requester email case-insensitively', async () => {
    const h = createHarness();
    h.qb.getManyAndCount.mockResolvedValue([
      [conversationRow({ requesterEmail: 'Ayesha@Example.com' })],
      1,
    ]);

    await h.service.list({ search: 'AYESHA@example.com' });

    expect(h.qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('LOWER(c.requesterEmail) LIKE :q'),
      expect.objectContaining({ q: '%ayesha@example.com%' }),
    );
  });

  it('searches subject case-insensitively', async () => {
    const h = createHarness();
    h.qb.getManyAndCount.mockResolvedValue([
      [conversationRow({ subject: 'Order delay' })],
      1,
    ]);

    await h.service.list({ search: 'ORDER' });

    expect(h.qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('LOWER(c.subject) LIKE :q'),
      expect.objectContaining({ q: '%order%' }),
    );
  });

  it('searches requester name case-insensitively', async () => {
    const h = createHarness();
    h.qb.getManyAndCount.mockResolvedValue([
      [conversationRow({ requesterName: 'Fatima Khan' })],
      1,
    ]);

    await h.service.list({ search: 'fatima' });

    expect(h.qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('LOWER(COALESCE(c.requesterName'),
      expect.objectContaining({ q: '%fatima%' }),
    );
  });

  it('orders newest conversations first via lastMessageAt DESC', async () => {
    const h = createHarness();
    const newer = conversationRow({
      id: 'conv-new',
      lastMessageAt: new Date('2026-10-02T00:00:00.000Z'),
    });
    const older = conversationRow({
      id: 'conv-old',
      lastMessageAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    h.qb.getManyAndCount.mockResolvedValue([[newer, older], 2]);

    const result = await h.service.list({});

    expect(result.items.map((item) => item.id)).toEqual([
      'conv-new',
      'conv-old',
    ]);
    expect(h.qb.orderBy).toHaveBeenCalledWith('c.lastMessageAt', 'DESC');
  });

  it('returns empty result set', async () => {
    const h = createHarness();
    h.qb.getManyAndCount.mockResolvedValue([[], 0]);

    const result = await h.service.list({ search: 'nobody' });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('returns conversation detail with messages ASC and attachment metadata', async () => {
    const h = createHarness();
    const conv = conversationRow({
      customerId: 'cust-1',
      assigneeAdminId: 'admin-1',
    });
    h.conversations.findOne.mockResolvedValue(conv);
    h.customers.findOne.mockResolvedValue({
      id: 'cust-1',
      email: 'customer@example.com',
      fullName: 'Ayesha',
      phone: '+923001234567',
      emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      isActive: true,
      passwordHash: 'SECRET_HASH',
    });
    h.admins.findOne.mockResolvedValue({
      id: 'admin-1',
      email: 'staff@zevooria.com',
      fullName: 'Store Staff',
      isActive: true,
      passwordHash: 'ADMIN_SECRET',
    });
    h.messages.find.mockResolvedValue([
      {
        id: 'msg-1',
        direction: 'inbound',
        fromEmail: 'customer@example.com',
        toEmail: 'support@zevooria.com',
        subject: 'Help',
        bodyText: 'Hello',
        bodyHtml: '<p>Hello</p>',
        sesMessageId: 'mid-1',
        inReplyTo: null,
        references: null,
        adminUserId: null,
        createdAt: new Date('2026-10-01T10:00:00.000Z'),
        attachments: [
          {
            id: 'att-1',
            fileName: 'invoice.pdf',
            contentType: 'application/pdf',
            sizeBytes: 1234,
            storageKey: 'support-attachments/msg-1/att-1/invoice.pdf',
            createdAt: new Date('2026-10-01T10:00:01.000Z'),
            content: Buffer.from('SHOULD_NOT_APPEAR'),
          },
        ],
      },
      {
        id: 'msg-2',
        direction: 'inbound',
        fromEmail: 'customer@example.com',
        toEmail: 'support@zevooria.com',
        subject: 'Help',
        bodyText: 'Follow up',
        bodyHtml: null,
        sesMessageId: 'mid-2',
        inReplyTo: 'mid-1',
        references: 'mid-1',
        adminUserId: null,
        createdAt: new Date('2026-10-01T11:00:00.000Z'),
        attachments: [],
      },
    ]);

    const detail = await h.service.getDetail('conv-1');

    expect(detail.conversation.id).toBe('conv-1');
    expect(detail.messages.map((m) => m.id)).toEqual(['msg-1', 'msg-2']);
    expect(h.messages.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId: 'conv-1' },
        order: { createdAt: 'ASC' },
      }),
    );
    expect(detail.messages[0].attachments).toEqual([
      {
        id: 'att-1',
        fileName: 'invoice.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1234,
        storageKey: 'support-attachments/msg-1/att-1/invoice.pdf',
        createdAt: '2026-10-01T10:00:01.000Z',
      },
    ]);
    expect(JSON.stringify(detail)).not.toContain('SHOULD_NOT_APPEAR');
    expect(detail.messages[0].attachments[0]).not.toHaveProperty('content');
    expect(detail.customer).toEqual({
      id: 'cust-1',
      email: 'customer@example.com',
      fullName: 'Ayesha',
      phone: '+923001234567',
      emailVerifiedAt: '2026-01-01T00:00:00.000Z',
      isActive: true,
    });
    expect(detail.customer).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(detail)).not.toContain('SECRET_HASH');
    expect(detail.assignee).toEqual({
      id: 'admin-1',
      email: 'staff@zevooria.com',
      fullName: 'Store Staff',
      isActive: true,
    });
    expect(detail.assignee).not.toHaveProperty('passwordHash');
  });

  it('throws 404 when conversation is missing', async () => {
    const h = createHarness();
    h.conversations.findOne.mockResolvedValue(null);

    await expect(h.service.getDetail('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates status and records audit', async () => {
    const h = createHarness();
    const conv = conversationRow({ status: SupportConversationStatus.OPEN });
    h.conversations.findOne.mockResolvedValue(conv);

    const result = await h.service.update(
      'conv-1',
      { status: SupportConversationStatus.CLOSED },
      { actorId: 'admin-actor' },
    );

    expect(result.status).toBe(SupportConversationStatus.CLOSED);
    expect(h.conversations.save).toHaveBeenCalled();
    expect(h.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'support.status_update',
        metadata: {
          conversationId: 'conv-1',
          oldStatus: SupportConversationStatus.OPEN,
          newStatus: SupportConversationStatus.CLOSED,
        },
      }),
    );
  });

  it('rejects invalid status via DTO validation', async () => {
    const dto = plainToInstance(UpdateSupportConversationDto, {
      status: 'bogus',
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'status')).toBe(true);

    const query = plainToInstance(ListSupportConversationsQueryDto, {
      status: 'not-a-status',
    });
    const queryErrors = await validate(query);
    expect(queryErrors.some((error) => error.property === 'status')).toBe(true);
  });

  it('throws 404 when updating a missing conversation', async () => {
    const h = createHarness();
    h.conversations.findOne.mockResolvedValue(null);
    await expect(
      h.service.update(
        'missing',
        { status: SupportConversationStatus.CLOSED },
        { actorId: 'admin-actor' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('assigns an admin and records audit', async () => {
    const h = createHarness();
    const conv = conversationRow({ assigneeAdminId: null });
    h.conversations.findOne.mockResolvedValue(conv);
    h.admins.findOne.mockResolvedValue({
      id: 'admin-9',
      email: 'a@zevooria.com',
      fullName: 'A',
      isActive: true,
    });

    const result = await h.service.update(
      'conv-1',
      { assigneeAdminId: 'admin-9' },
      { actorId: 'admin-actor' },
    );

    expect(result.assigneeAdminId).toBe('admin-9');
    expect(h.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'support.assignment_update',
        metadata: {
          conversationId: 'conv-1',
          oldAssigneeAdminId: null,
          newAssigneeAdminId: 'admin-9',
        },
      }),
    );
  });

  it('clears assignee when null is provided', async () => {
    const h = createHarness();
    const conv = conversationRow({ assigneeAdminId: 'admin-9' });
    h.conversations.findOne.mockResolvedValue(conv);

    const result = await h.service.update(
      'conv-1',
      { assigneeAdminId: null },
      { actorId: 'admin-actor' },
    );

    expect(result.assigneeAdminId).toBeNull();
    expect(h.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'support.assignment_update',
        metadata: {
          conversationId: 'conv-1',
          oldAssigneeAdminId: 'admin-9',
          newAssigneeAdminId: null,
        },
      }),
    );
  });

  it('rejects nonexistent assignee', async () => {
    const h = createHarness();
    h.conversations.findOne.mockResolvedValue(conversationRow());
    h.admins.findOne.mockResolvedValue(null);

    await expect(
      h.service.update(
        'conv-1',
        { assigneeAdminId: '00000000-0000-4000-8000-000000000099' },
        { actorId: 'admin-actor' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(h.conversations.save).not.toHaveBeenCalled();
    expect(h.auditRecord).not.toHaveBeenCalled();
  });

  it('rejects empty update payload', async () => {
    const h = createHarness();
    await expect(
      h.service.update('conv-1', {}, { actorId: 'admin-actor' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns a short-lived URL for a valid attachment in the conversation', async () => {
    const h = createHarness();
    h.conversations.findOne.mockResolvedValue(conversationRow());
    h.attachmentQb.getOne.mockResolvedValue({
      id: 'att-1',
      fileName: 'invoice.pdf',
      contentType: 'application/pdf',
      sizeBytes: 245123,
      storageKey: 'support-attachments/msg/att/invoice.pdf',
    });

    const result = await h.service.getAttachmentAccess('conv-1', 'att-1');

    expect(result).toEqual({
      url: 'https://signed.example/file.pdf',
      fileName: 'invoice.pdf',
      contentType: 'application/pdf',
      sizeBytes: 245123,
    });
    expect(result).not.toHaveProperty('storageKey');
    expect(h.attachmentQb.where).toHaveBeenCalledWith('a.id = :attachmentId', {
      attachmentId: 'att-1',
    });
    expect(h.attachmentQb.andWhere).toHaveBeenCalledWith(
      'm.conversationId = :conversationId',
      { conversationId: 'conv-1' },
    );
    expect(jest.mocked(getSignedUrl)).toHaveBeenCalledTimes(1);
    const [, command, options] = jest.mocked(getSignedUrl).mock.calls[0];
    expect(options).toEqual({ expiresIn: 300 });
    expect((command as unknown as { input: { Key: string } }).input.Key).toBe(
      'support-attachments/msg/att/invoice.pdf',
    );
  });

  it('rejects attachment belonging to another conversation', async () => {
    const h = createHarness();
    h.conversations.findOne.mockResolvedValue(
      conversationRow({ id: 'conv-a' }),
    );
    h.attachmentQb.getOne.mockResolvedValue(null);

    await expect(
      h.service.getAttachmentAccess('conv-a', 'att-from-b'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('rejects unknown attachment', async () => {
    const h = createHarness();
    h.conversations.findOne.mockResolvedValue(conversationRow());
    h.attachmentQb.getOne.mockResolvedValue(null);

    await expect(
      h.service.getAttachmentAccess('conv-1', 'missing-att'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects unknown conversation for attachment access', async () => {
    const h = createHarness();
    h.conversations.findOne.mockResolvedValue(null);

    await expect(
      h.service.getAttachmentAccess('missing-conv', 'att-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(h.attachments.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('sends a reply for an unknown (guest) requester email', async () => {
    const h = createHarness();
    h.conversations.findOne.mockResolvedValue(
      conversationRow({
        customerId: null,
        requesterEmail: 'someone@gmail.com',
        subject: 'Order #12345 issue',
        status: SupportConversationStatus.OPEN,
      }),
    );
    h.messages.findOne.mockResolvedValue({
      sesMessageId: 'parent@example.com',
      references: 'root@example.com',
      createdAt: new Date('2026-10-01T10:00:00.000Z'),
    });

    const result = await h.service.reply(
      'conv-1',
      'Thank you for contacting Zevooria.',
      { actorId: 'admin-actor' },
    );

    expect(h.outboundSendRaw).toHaveBeenCalledTimes(1);
    type OutboundSendArg = {
      toEmail: string;
      subject: string;
      bodyText: string;
      inReplyTo: string;
      references: string;
      rfcMessageId: string;
    };
    const sendCalls = h.outboundSendRaw.mock.calls as OutboundSendArg[][];
    const sendArg = sendCalls[0]?.[0];
    expect(sendArg).toBeDefined();
    expect(sendArg?.toEmail).toBe('someone@gmail.com');
    expect(sendArg?.subject).toBe('Re: Order #12345 issue');
    expect(sendArg?.bodyText).toBe('Thank you for contacting Zevooria.');
    expect(sendArg?.inReplyTo).toBe('parent@example.com');
    expect(sendArg?.references).toBe('root@example.com parent@example.com');
    expect(sendArg?.rfcMessageId).toMatch(/@zevooria\.com$/);
    expect(result.message.direction).toBe('outbound');
    expect(result.message.toEmail).toBe('someone@gmail.com');
    expect(result.message.adminUserId).toBe('admin-actor');
    expect(result.conversation.status).toBe(SupportConversationStatus.PENDING);
    type SavedConversation = {
      status: SupportConversationStatus;
      lastMessageAt: Date;
    };
    const saveCalls = h.conversations.save.mock.calls as SavedConversation[][];
    const savedConversation = saveCalls
      .map((call) => call[0])
      .find((row) => row?.status === SupportConversationStatus.PENDING);
    expect(savedConversation?.status).toBe(SupportConversationStatus.PENDING);
    expect(savedConversation?.lastMessageAt).toBeInstanceOf(Date);
    expect(h.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'support.reply',
        metadata: {
          conversationId: 'conv-1',
          messageId: 'msg-out-1',
          requesterEmail: 'someone@gmail.com',
          adminUserId: 'admin-actor',
        },
      }),
    );
  });

  it('sends a reply for a registered customer conversation', async () => {
    const h = createHarness();
    h.conversations.findOne.mockResolvedValue(
      conversationRow({
        customerId: 'cust-1',
        requesterEmail: 'john@example.com',
        subject: 'Help',
      }),
    );

    const result = await h.service.reply(
      'conv-1',
      'We are looking into this.',
      {
        actorId: 'admin-actor',
      },
    );

    expect(result.message.toEmail).toBe('john@example.com');
    expect(h.outboundSendRaw).toHaveBeenCalled();
  });

  it('rejects reply when requester email is missing/invalid', async () => {
    const h = createHarness();
    h.conversations.findOne.mockResolvedValue(
      conversationRow({ requesterEmail: 'not-an-email' }),
    );

    await expect(
      h.service.reply('conv-1', 'Hello', { actorId: 'admin-actor' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(h.outboundSendRaw).not.toHaveBeenCalled();
  });

  it('rejects empty reply body', async () => {
    const h = createHarness();
    h.conversations.findOne.mockResolvedValue(conversationRow());

    await expect(
      h.service.reply('conv-1', '   ', { actorId: 'admin-actor' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(h.outboundSendRaw).not.toHaveBeenCalled();
  });

  it('normalizes subject to a single Re: prefix', async () => {
    const h = createHarness();
    h.conversations.findOne.mockResolvedValue(
      conversationRow({ subject: 'Re: Re: Payment question' }),
    );

    await h.service.reply('conv-1', 'Following up.', {
      actorId: 'admin-actor',
    });

    expect(h.outboundSendRaw).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Re: Payment question' }),
    );
  });

  it('appends quoted prior history to SES body but persists unquoted admin text', async () => {
    const h = createHarness();
    h.conversations.findOne.mockResolvedValue(
      conversationRow({ requesterEmail: 'someone@gmail.com' }),
    );
    h.messages.find.mockResolvedValue([
      {
        fromEmail: 'someone@gmail.com',
        bodyText: 'I need help with my order',
        createdAt: new Date('2026-10-01T10:00:00.000Z'),
      },
    ]);

    const result = await h.service.reply(
      'conv-1',
      'We are looking into this.',
      {
        actorId: 'admin-actor',
      },
    );

    type OutboundSendArg = { bodyText: string };
    const sendArg = (
      h.outboundSendRaw.mock.calls as OutboundSendArg[][]
    )[0]?.[0];
    expect(sendArg?.bodyText).toContain('We are looking into this.');
    expect(sendArg?.bodyText).toContain(
      '---------- Previous messages ----------',
    );
    expect(sendArg?.bodyText).toContain('> I need help with my order');
    expect(result.message.bodyText).toBe('We are looking into this.');
    expect(result.message.bodyText).not.toContain('Previous messages');
    type SavedMessage = { bodyText: string };
    const saved = (h.messages.save.mock.calls as SavedMessage[][])[0]?.[0];
    expect(saved?.bodyText).toBe('We are looking into this.');
  });

  it('sends reply-only body when conversation has no prior messages', async () => {
    const h = createHarness();
    h.conversations.findOne.mockResolvedValue(conversationRow());
    h.messages.find.mockResolvedValue([]);

    await h.service.reply('conv-1', 'Hello alone.', {
      actorId: 'admin-actor',
    });

    expect(h.outboundSendRaw).toHaveBeenCalledWith(
      expect.objectContaining({ bodyText: 'Hello alone.' }),
    );
  });

  it('does not persist a message when SES send fails', async () => {
    const h = createHarness();
    h.conversations.findOne.mockResolvedValue(conversationRow());
    h.outboundSendRaw.mockRejectedValue(new Error('SES down'));

    await expect(
      h.service.reply('conv-1', 'Hello', { actorId: 'admin-actor' }),
    ).rejects.toThrow('SES down');
    expect(h.messages.save).not.toHaveBeenCalled();
    expect(h.auditRecord).not.toHaveBeenCalled();
  });

  it('does not accept an arbitrary storage key from the client', async () => {
    const h = createHarness();
    h.conversations.findOne.mockResolvedValue(conversationRow());
    h.attachmentQb.getOne.mockResolvedValue({
      id: 'att-1',
      fileName: 'safe.pdf',
      contentType: 'application/pdf',
      sizeBytes: 10,
      storageKey: 'support-attachments/from-db-only.pdf',
    });

    await h.service.getAttachmentAccess('conv-1', 'att-1');

    expect(jest.mocked(getSignedUrl)).toHaveBeenCalledTimes(1);
    const [, command] = jest.mocked(getSignedUrl).mock.calls[0];
    expect((command as unknown as { input: { Key: string } }).input.Key).toBe(
      'support-attachments/from-db-only.pdf',
    );
    expect(JSON.stringify(command)).not.toContain('attacker-key');
  });
});

describe('AdminSupportController permissions', () => {
  /* Prototype method refs are intentional for Nest metadata/permission checks. */
  /* eslint-disable @typescript-eslint/unbound-method */
  it('requires support:read on list, detail, and attachment; support:update on patch', () => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        AdminSupportController.prototype.list,
      ),
    ).toEqual(['support:read']);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        AdminSupportController.prototype.getOne,
      ),
    ).toEqual(['support:read']);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        AdminSupportController.prototype.getAttachment,
      ),
    ).toEqual(['support:read']);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        AdminSupportController.prototype.update,
      ),
    ).toEqual(['support:update']);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        AdminSupportController.prototype.reply,
      ),
    ).toEqual(['support:update']);
  });

  it('denies access when required support permission is missing', async () => {
    const reflector = new Reflector();
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['support:read']);
    const guard = new PermissionsGuard(reflector, {
      getPermissionCodes: jest.fn().mockResolvedValue(['orders:read']),
    } as unknown as AdminAuthService);
    const handler = AdminSupportController.prototype.getAttachment;

    await expect(
      guard.canActivate({
        getHandler: () => handler,
        getClass: () => AdminSupportController,
        switchToHttp: () => ({
          getRequest: () => ({ admin: { id: 'admin-1' } }),
        }),
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows access when support:read is present', async () => {
    const reflector = new Reflector();
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['support:read']);
    const guard = new PermissionsGuard(reflector, {
      getPermissionCodes: jest.fn().mockResolvedValue(['support:read']),
    } as unknown as AdminAuthService);
    const handler = AdminSupportController.prototype.getAttachment;

    await expect(
      guard.canActivate({
        getHandler: () => handler,
        getClass: () => AdminSupportController,
        switchToHttp: () => ({
          getRequest: () => ({ admin: { id: 'admin-1' } }),
        }),
      } as never),
    ).resolves.toBe(true);
  });
  /* eslint-enable @typescript-eslint/unbound-method */
});
