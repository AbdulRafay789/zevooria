import { SupportInboundObjectStatus } from './support.enums';
import { SupportInboundService } from './support-inbound.service';
import { SES_SETUP_NOTIFICATION_KEY } from './support-email.util';

function rawEmail(input: {
  from: string;
  to?: string;
  subject: string;
  text?: string;
  html?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
  attachment?: { fileName: string; contentType: string; content: string };
}): Buffer {
  const boundary = '----=_ZevooriaBoundary7';
  const messageId = input.messageId ?? '<msg-1@example.com>';
  const headers = [
    `From: ${input.from}`,
    `To: ${input.to ?? 'support@zevooria.com'}`,
    `Subject: ${input.subject}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
  ];
  if (input.inReplyTo) {
    headers.push(`In-Reply-To: ${input.inReplyTo}`);
  }
  if (input.references) {
    headers.push(`References: ${input.references}`);
  }

  if (input.attachment) {
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    const parts = [
      headers.join('\r\n'),
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      input.text ?? 'Hello support',
      `--${boundary}`,
      `Content-Type: ${input.attachment.contentType}; name="${input.attachment.fileName}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${input.attachment.fileName}"`,
      '',
      Buffer.from(input.attachment.content).toString('base64'),
      `--${boundary}--`,
      '',
    ];
    return Buffer.from(parts.join('\r\n'));
  }

  if (input.html) {
    headers.push('Content-Type: text/html; charset=utf-8');
    return Buffer.from(`${headers.join('\r\n')}\r\n\r\n${input.html}\r\n`);
  }

  headers.push('Content-Type: text/plain; charset=utf-8');
  return Buffer.from(
    `${headers.join('\r\n')}\r\n\r\n${input.text ?? 'Hello support'}\r\n`,
  );
}

type Harness = {
  service: SupportInboundService;
  s3Send: jest.Mock;
  transaction: jest.Mock;
  inboundFindOne: jest.Mock;
  inboundSave: jest.Mock;
  inboundCreate: jest.Mock;
  messageFindOne: jest.Mock;
  conversationFind: jest.Mock;
  conversationFindOne: jest.Mock;
  conversationCreate: jest.Mock;
  customerGetOne: jest.Mock;
  managerSave: jest.Mock;
  auditRecord: jest.Mock;
  savedRows: unknown[];
};

function createHarness(
  overrides: {
    inboundExisting?: { status: SupportInboundObjectStatus } | null;
    customer?: { id: string; email: string } | null;
    messageById?: { conversationId: string; sesMessageId: string } | null;
    conversations?: Array<{
      id: string;
      subject: string;
      requesterEmail: string;
      status: string;
      customerId: string | null;
      requesterName: string | null;
    }>;
  } = {},
): Harness {
  const savedRows: unknown[] = [];
  const inboundFindOne = jest
    .fn()
    .mockResolvedValue(overrides.inboundExisting ?? null);
  const inboundSave = jest.fn(async (row: unknown) => row);
  const inboundCreate = jest.fn((_entity: unknown, data: unknown) => data);

  const messageFindOne = jest
    .fn()
    .mockResolvedValue(overrides.messageById ?? null);
  const conversationFind = jest
    .fn()
    .mockResolvedValue(overrides.conversations ?? []);
  const conversationFindOne = jest.fn(
    async ({ where }: { where: { id: string } }) => {
      if (overrides.messageById?.conversationId === where.id) {
        return {
          id: where.id,
          subject: 'Original',
          requesterEmail: 'customer@example.com',
          status: 'open',
          customerId: null,
          requesterName: null,
          lastMessageAt: new Date(),
        };
      }
      return null;
    },
  );
  const conversationCreate = jest.fn((data: unknown) => ({
    id: 'conv-new',
    ...(data as object),
  }));

  const customerGetOne = jest
    .fn()
    .mockResolvedValue(overrides.customer ?? null);

  const managerSave = jest.fn(async (row: Record<string, unknown>) => {
    if (!row.id && row.direction) {
      row.id = 'msg-1';
    }
    if (!row.id && row.requesterEmail) {
      row.id = row.id ?? 'conv-new';
    }
    if (!row.id && row.s3Key) {
      row.id = 'inbound-1';
    }
    savedRows.push(row);
    return row;
  });

  const manager = {
    findOne: jest.fn(
      async (_entity: unknown, opts: { where: { s3Key?: string } }) => {
        if (opts.where.s3Key) {
          return inboundFindOne(opts);
        }
        return null;
      },
    ),
    getRepository: jest.fn((entity: unknown) => {
      const name = String((entity as { name?: string })?.name ?? entity);
      if (name.includes('User')) {
        return {
          createQueryBuilder: () => ({
            where: () => ({
              getOne: customerGetOne,
            }),
          }),
        };
      }
      if (name.includes('SupportMessage')) {
        return {
          findOne: messageFindOne,
        };
      }
      if (name.includes('SupportConversation')) {
        return {
          find: conversationFind,
          findOne: conversationFindOne,
          create: conversationCreate,
        };
      }
      return {
        findOne: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
        create: jest.fn((d: unknown) => d),
      };
    }),
    create: jest.fn((_entity: unknown, data: unknown) => data),
    save: managerSave,
  };

  const transaction = jest.fn(async (fn: (m: typeof manager) => unknown) =>
    fn(manager),
  );
  const dataSource = {
    transaction,
  };

  const s3Send = jest.fn(
    async (command: {
      constructor: { name: string };
      input: Record<string, unknown>;
    }) => {
      const name = command.constructor.name;
      if (name === 'ListObjectsV2Command') {
        return { Contents: [] };
      }
      if (name === 'GetObjectCommand') {
        return {
          Body: {
            transformToByteArray: async () =>
              Uint8Array.from(
                rawEmail({
                  from: 'Customer <customer@example.com>',
                  subject: 'Help please',
                  text: 'I need help with my order',
                  messageId: '<abc@example.com>',
                }),
              ),
          },
        };
      }
      if (name === 'PutObjectCommand') {
        return {};
      }
      return {};
    },
  );

  const auditRecord = jest.fn().mockResolvedValue(undefined);

  const service = new SupportInboundService(
    dataSource as never,
    { send: s3Send } as never,
    { record: auditRecord } as never,
    {
      findOne: inboundFindOne,
      save: inboundSave,
      create: inboundCreate,
    } as never,
    { find: conversationFind, findOne: conversationFindOne } as never,
    { findOne: messageFindOne } as never,
    {
      createQueryBuilder: () => ({ where: () => ({ getOne: customerGetOne }) }),
    } as never,
  );

  return {
    service,
    s3Send,
    transaction,
    inboundFindOne,
    inboundSave,
    inboundCreate,
    messageFindOne,
    conversationFind,
    conversationFindOne,
    conversationCreate,
    customerGetOne,
    managerSave,
    auditRecord,
    savedRows,
  };
}

describe('SupportInboundService', () => {
  it('ignores SES setup notification without creating a conversation', async () => {
    const h = createHarness();
    const outcome = await h.service.processObject(
      SES_SETUP_NOTIFICATION_KEY,
      '"etag"',
    );
    expect(outcome).toBe('ignored');
    expect(h.inboundSave).toHaveBeenCalled();
    expect(h.auditRecord).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'support.inbound.process' }),
    );
    expect(h.s3Send).not.toHaveBeenCalledWith(
      expect.objectContaining({
        constructor: expect.objectContaining({ name: 'GetObjectCommand' }),
      }),
    );
  });

  it('creates conversation + message for a new inbound email', async () => {
    const h = createHarness();
    h.s3Send.mockImplementation(
      async (command: { constructor: { name: string } }) => {
        if (command.constructor.name === 'GetObjectCommand') {
          return {
            Body: {
              transformToByteArray: async () =>
                Uint8Array.from(
                  rawEmail({
                    from: 'Ayesha <ayesha@example.com>',
                    subject: 'Order question',
                    text: 'Where is my order?',
                    html: '<p>Where is my order?</p>',
                    messageId: '<new-1@example.com>',
                  }),
                ),
            },
          };
        }
        return {};
      },
    );

    const outcome = await h.service.processObject('incoming/abc', '"e1"');
    expect(outcome).toBe('processed');
    expect(h.conversationCreate).toHaveBeenCalled();
    expect(h.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'support.inbound.process' }),
    );
    const message = h.savedRows.find(
      (row) =>
        row &&
        typeof row === 'object' &&
        'direction' in row &&
        (row as { direction: string }).direction === 'inbound',
    ) as { sesMessageId: string; fromEmail: string; adminUserId: null };
    expect(message.fromEmail).toBe('ayesha@example.com');
    expect(message.sesMessageId).toBe('new-1@example.com');
    expect(message.adminUserId).toBeNull();
  });

  it('matches existing customer by email case-insensitively', async () => {
    const h = createHarness({
      customer: { id: 'cust-1', email: 'ayesha@example.com' },
    });
    h.s3Send.mockImplementation(
      async (command: { constructor: { name: string } }) => {
        if (command.constructor.name === 'GetObjectCommand') {
          return {
            Body: {
              transformToByteArray: async () =>
                Uint8Array.from(
                  rawEmail({
                    from: 'Ayesha <Ayesha@Example.com>',
                    subject: 'Hi',
                    text: 'Hello',
                  }),
                ),
            },
          };
        }
        return {};
      },
    );
    await h.service.processObject('incoming/cust', null);
    expect(h.customerGetOne).toHaveBeenCalled();
    const conv = h.savedRows.find(
      (row) =>
        row &&
        typeof row === 'object' &&
        'requesterEmail' in row &&
        'customerId' in row,
    ) as { customerId: string };
    expect(conv.customerId).toBe('cust-1');
  });

  it('leaves customerId null when no user matches', async () => {
    const h = createHarness({ customer: null });
    h.s3Send.mockImplementation(
      async (command: { constructor: { name: string } }) => {
        if (command.constructor.name === 'GetObjectCommand') {
          return {
            Body: {
              transformToByteArray: async () =>
                Uint8Array.from(
                  rawEmail({
                    from: 'guest@example.com',
                    subject: 'Guest help',
                    text: 'Hi',
                  }),
                ),
            },
          };
        }
        return {};
      },
    );
    await h.service.processObject('incoming/guest', null);
    const conv = h.savedRows.find(
      (row) =>
        row &&
        typeof row === 'object' &&
        'requesterEmail' in row &&
        'customerId' in row,
    ) as { customerId: string | null };
    expect(conv.customerId).toBeNull();
  });

  it('matches conversation via In-Reply-To', async () => {
    const h = createHarness({
      messageById: {
        conversationId: 'conv-existing',
        sesMessageId: 'parent@example.com',
      },
    });
    h.s3Send.mockImplementation(
      async (command: { constructor: { name: string } }) => {
        if (command.constructor.name === 'GetObjectCommand') {
          return {
            Body: {
              transformToByteArray: async () =>
                Uint8Array.from(
                  rawEmail({
                    from: 'customer@example.com',
                    subject: 'Re: Original',
                    text: 'Follow up',
                    inReplyTo: '<parent@example.com>',
                    messageId: '<child@example.com>',
                  }),
                ),
            },
          };
        }
        return {};
      },
    );
    await h.service.processObject('incoming/reply', null);
    expect(h.conversationCreate).not.toHaveBeenCalled();
    expect(h.messageFindOne).toHaveBeenCalled();
  });

  it('matches conversation via References', async () => {
    const h = createHarness({
      messageById: {
        conversationId: 'conv-ref',
        sesMessageId: 'root@example.com',
      },
    });
    h.s3Send.mockImplementation(
      async (command: { constructor: { name: string } }) => {
        if (command.constructor.name === 'GetObjectCommand') {
          return {
            Body: {
              transformToByteArray: async () =>
                Uint8Array.from(
                  rawEmail({
                    from: 'customer@example.com',
                    subject: 'Re: Thread',
                    text: 'More',
                    references: '<root@example.com> <mid@example.com>',
                    messageId: '<latest@example.com>',
                  }),
                ),
            },
          };
        }
        return {};
      },
    );
    await h.service.processObject('incoming/refs', null);
    expect(h.conversationCreate).not.toHaveBeenCalled();
  });

  it('matches open conversation by requester + normalized subject', async () => {
    const h = createHarness({
      conversations: [
        {
          id: 'conv-subj',
          subject: 'Shipping delay',
          requesterEmail: 'customer@example.com',
          status: 'open',
          customerId: null,
          requesterName: null,
        },
      ],
    });
    h.s3Send.mockImplementation(
      async (command: { constructor: { name: string } }) => {
        if (command.constructor.name === 'GetObjectCommand') {
          return {
            Body: {
              transformToByteArray: async () =>
                Uint8Array.from(
                  rawEmail({
                    from: 'customer@example.com',
                    subject: 'Re: Fwd: Shipping delay',
                    text: 'Still waiting',
                  }),
                ),
            },
          };
        }
        return {};
      },
    );
    await h.service.processObject('incoming/subj', null);
    expect(h.conversationCreate).not.toHaveBeenCalled();
  });

  it('creates a new conversation when unmatched', async () => {
    const h = createHarness({ conversations: [] });
    h.s3Send.mockImplementation(
      async (command: { constructor: { name: string } }) => {
        if (command.constructor.name === 'GetObjectCommand') {
          return {
            Body: {
              transformToByteArray: async () =>
                Uint8Array.from(
                  rawEmail({
                    from: 'new@example.com',
                    subject: 'Brand new topic',
                    text: 'Hello',
                  }),
                ),
            },
          };
        }
        return {};
      },
    );
    await h.service.processObject('incoming/new', null);
    expect(h.conversationCreate).toHaveBeenCalled();
  });

  it('skips duplicate S3 keys already processed', async () => {
    const h = createHarness({
      inboundExisting: { status: SupportInboundObjectStatus.PROCESSED },
    });
    const outcome = await h.service.processObject('incoming/dup', null);
    expect(outcome).toBe('skipped');
    expect(h.s3Send).not.toHaveBeenCalled();
  });

  it('retries previously failed objects', async () => {
    const h = createHarness({
      inboundExisting: { status: SupportInboundObjectStatus.FAILED },
    });
    h.s3Send.mockImplementation(
      async (command: { constructor: { name: string } }) => {
        if (command.constructor.name === 'GetObjectCommand') {
          return {
            Body: {
              transformToByteArray: async () =>
                Uint8Array.from(
                  rawEmail({
                    from: 'retry@example.com',
                    subject: 'Retry me',
                    text: 'Again',
                  }),
                ),
            },
          };
        }
        return {};
      },
    );
    const outcome = await h.service.processObject('incoming/failed-once', null);
    expect(outcome).toBe('processed');
  });

  it('parses HTML and text bodies', async () => {
    const h = createHarness();
    const parsed = await h.service.parseMime(
      rawEmail({
        from: 'a@example.com',
        subject: 'Html',
        html: '<p>Hello <b>world</b></p>',
      }),
    );
    expect(parsed.bodyHtml).toContain('<p>Hello');
    expect(parsed.bodyText.toLowerCase()).toContain('hello');
  });

  it('stores attachment metadata and uploads to support-attachments prefix', async () => {
    const h = createHarness();
    const putKeys: string[] = [];
    h.s3Send.mockImplementation(
      async (command: {
        constructor: { name: string };
        input: { Key?: string };
      }) => {
        if (command.constructor.name === 'GetObjectCommand') {
          return {
            Body: {
              transformToByteArray: async () =>
                Uint8Array.from(
                  rawEmail({
                    from: 'a@example.com',
                    subject: 'With file',
                    text: 'See attached',
                    attachment: {
                      fileName: 'invoice.pdf',
                      contentType: 'application/pdf',
                      content: '%PDF-1.4 fake',
                    },
                  }),
                ),
            },
          };
        }
        if (command.constructor.name === 'PutObjectCommand') {
          putKeys.push(String(command.input.Key));
          return {};
        }
        return {};
      },
    );

    await h.service.processObject('incoming/att', null);
    const attachment = h.savedRows.find(
      (row) =>
        row &&
        typeof row === 'object' &&
        'storageKey' in row &&
        'fileName' in row,
    ) as { fileName: string; storageKey: string; sizeBytes: number };
    expect(attachment.fileName).toBe('invoice.pdf');
    expect(attachment.storageKey.startsWith('support-attachments/')).toBe(true);
    expect(attachment.sizeBytes).toBeGreaterThan(0);
    expect(putKeys.some((key) => key.startsWith('support-attachments/'))).toBe(
      true,
    );
    expect(attachment.storageKey).toBe(putKeys[0]);
  });

  it('uploads attachment bytes to S3 before starting the DB transaction', async () => {
    const h = createHarness();
    const order: string[] = [];
    const originalTransaction = h.transaction.getMockImplementation()!;
    h.transaction.mockImplementation(async (...args: unknown[]) => {
      order.push('transaction');
      return originalTransaction(...args);
    });
    h.s3Send.mockImplementation(
      async (command: {
        constructor: { name: string };
        input: { Key?: string };
      }) => {
        if (command.constructor.name === 'GetObjectCommand') {
          return {
            Body: {
              transformToByteArray: async () =>
                Uint8Array.from(
                  rawEmail({
                    from: 'a@example.com',
                    subject: 'With file',
                    text: 'See attached',
                    attachment: {
                      fileName: 'invoice.pdf',
                      contentType: 'application/pdf',
                      content: '%PDF-1.4 fake',
                    },
                  }),
                ),
            },
          };
        }
        if (command.constructor.name === 'PutObjectCommand') {
          order.push('put');
          return {};
        }
        return {};
      },
    );

    const outcome = await h.service.processObject('incoming/att-order', null);
    expect(outcome).toBe('processed');
    expect(order.indexOf('put')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('transaction')).toBeGreaterThan(order.indexOf('put'));
  });

  it('does not start DB transaction when attachment upload fails', async () => {
    const h = createHarness();
    h.s3Send.mockImplementation(
      async (command: { constructor: { name: string } }) => {
        if (command.constructor.name === 'GetObjectCommand') {
          return {
            Body: {
              transformToByteArray: async () =>
                Uint8Array.from(
                  rawEmail({
                    from: 'a@example.com',
                    subject: 'With file',
                    text: 'See attached',
                    attachment: {
                      fileName: 'invoice.pdf',
                      contentType: 'application/pdf',
                      content: '%PDF-1.4 fake',
                    },
                  }),
                ),
            },
          };
        }
        if (command.constructor.name === 'PutObjectCommand') {
          throw new Error('S3 put denied');
        }
        return {};
      },
    );

    const outcome = await h.service.processObject('incoming/att-fail', null);
    expect(outcome).toBe('failed');
    expect(h.transaction).not.toHaveBeenCalled();
    expect(h.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'support.inbound.failed' }),
    );
  });

  it('logs orphan attachment keys when DB persist fails after S3 upload', async () => {
    const h = createHarness();
    const warnSpy = jest
      .spyOn(
        (
          h.service as unknown as {
            logger: { warn: (...args: unknown[]) => void };
          }
        ).logger,
        'warn',
      )
      .mockImplementation(() => undefined);

    h.transaction.mockRejectedValue(new Error('DB commit failed'));
    h.s3Send.mockImplementation(
      async (command: {
        constructor: { name: string };
        input: { Key?: string };
      }) => {
        if (command.constructor.name === 'GetObjectCommand') {
          return {
            Body: {
              transformToByteArray: async () =>
                Uint8Array.from(
                  rawEmail({
                    from: 'a@example.com',
                    subject: 'With file',
                    text: 'See attached',
                    attachment: {
                      fileName: 'invoice.pdf',
                      contentType: 'application/pdf',
                      content: '%PDF-1.4 fake',
                    },
                  }),
                ),
            },
          };
        }
        if (command.constructor.name === 'PutObjectCommand') {
          return {};
        }
        return {};
      },
    );

    const outcome = await h.service.processObject('incoming/att-orphan', null);
    expect(outcome).toBe('failed');
    expect(h.transaction).toHaveBeenCalled();
    expect(
      warnSpy.mock.calls.some((call) =>
        String(call[0]).includes('orphanStorageKeys=support-attachments/'),
      ),
    ).toBe(true);
    warnSpy.mockRestore();
  });

  it('records failure for malformed MIME without throwing', async () => {
    const h = createHarness();
    h.s3Send.mockImplementation(
      async (command: { constructor: { name: string } }) => {
        if (command.constructor.name === 'GetObjectCommand') {
          return {
            Body: {
              // Not a valid email — empty from after parse may fail our validation
              transformToByteArray: async () =>
                Uint8Array.from(Buffer.from('not-an-email')),
            },
          };
        }
        return {};
      },
    );
    const outcome = await h.service.processObject('incoming/bad', null);
    expect(outcome).toBe('failed');
    expect(h.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'support.inbound.failed' }),
    );
  });

  it('continues processing later objects when one fails', async () => {
    const h = createHarness();
    let getCount = 0;
    h.s3Send.mockImplementation(
      async (command: { constructor: { name: string } }) => {
        if (command.constructor.name === 'ListObjectsV2Command') {
          return {
            Contents: [
              { Key: 'incoming/bad', ETag: '"1"' },
              { Key: 'incoming/good', ETag: '"2"' },
            ],
          };
        }
        if (command.constructor.name === 'GetObjectCommand') {
          getCount += 1;
          if (getCount === 1) {
            throw new Error('S3 boom');
          }
          return {
            Body: {
              transformToByteArray: async () =>
                Uint8Array.from(
                  rawEmail({
                    from: 'ok@example.com',
                    subject: 'OK',
                    text: 'Recovered',
                  }),
                ),
            },
          };
        }
        return {};
      },
    );

    // First object fails independently
    h.inboundFindOne.mockResolvedValue(null);
    const result = await h.service.pollOnce();
    expect(result.failed).toBeGreaterThanOrEqual(1);
    expect(result.processed).toBeGreaterThanOrEqual(1);
  });
});
