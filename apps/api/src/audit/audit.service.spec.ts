import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('writes a row and never throws on repository failure', async () => {
    const logs = {
      create: jest.fn((value: unknown) => value),
      save: jest.fn().mockRejectedValue(new Error('db down')),
      find: jest.fn(),
      findAndCount: jest.fn(),
    };
    const service = new AuditService(
      logs as never,
      { find: jest.fn() } as never,
      {
        find: jest.fn(),
      } as never,
    );
    await expect(
      service.record({
        actorType: 'admin',
        actorId: '11111111-1111-4111-8111-111111111111',
        action: 'admin.login',
      }),
    ).resolves.toBeUndefined();
    expect(logs.save).toHaveBeenCalled();
  });

  it('lists recent logs with a raised take cap', async () => {
    const logs = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      findAndCount: jest.fn(),
    };
    const service = new AuditService(
      logs as never,
      { find: jest.fn() } as never,
      {
        find: jest.fn(),
      } as never,
    );
    await service.listRecent(9000);
    expect(logs.find).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5000 }),
    );
  });

  it('lists a page with actor names resolved', async () => {
    const createdAt = new Date('2026-10-03T00:00:00.000Z');
    const logs = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 'log-1',
            actorType: 'admin',
            actorId: 'admin-1',
            action: 'order.status_update',
            resourceType: 'order',
            resourceId: 'order-1',
            metadata: { from: 'placed', to: 'processing' },
            ipAddress: '127.0.0.1',
            userAgent: 'test',
            createdAt,
          },
          {
            id: 'log-2',
            actorType: 'customer',
            actorId: 'cust-1',
            action: 'auth.login',
            resourceType: 'customer',
            resourceId: 'cust-1',
            metadata: null,
            ipAddress: null,
            userAgent: null,
            createdAt,
          },
        ],
        2,
      ]),
    };
    const admins = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'admin-1',
          fullName: 'Ops Lead',
          email: 'ops@zevooria.com',
        },
      ]),
    };
    const customers = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'cust-1',
          fullName: 'Ayesha Khan',
          email: 'ayesha@example.com',
        },
      ]),
    };
    const service = new AuditService(
      logs as never,
      admins as never,
      customers as never,
    );
    const page = await service.listPage({ limit: 50, offset: 0 });
    expect(page.total).toBe(2);
    expect(page.items[0]?.actorName).toBe('Ops Lead');
    expect(page.items[0]?.actorEmail).toBe('ops@zevooria.com');
    expect(page.items[1]?.actorName).toBe('Ayesha Khan');
  });
});
