import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';

jest.mock('../admin/admin-notifications.service', () => ({
  AdminNotificationsService: class AdminNotificationsService {},
}));

import { OrdersService } from './orders.service';
import { OrderStatus } from './order.enums';

const accountingStub = {
  postOrderConfirm: jest.fn(),
  postOrderDelivered: jest.fn(),
  reverseOrderJournals: jest.fn(),
};

const notificationsStub = {
  notifyOrderPlaced: jest.fn(),
};

const auditStub = {
  record: jest.fn(),
};

const customerEmailStub = {
  sendOrderPlaced: jest.fn().mockResolvedValue(undefined),
};

function buildService(
  overrides: {
    dataSource?: unknown;
    paymentService?: unknown;
    inventory?: unknown;
    orders?: unknown;
    media?: unknown;
    history?: unknown;
    customerEmail?: unknown;
  } = {},
) {
  return new OrdersService(
    (overrides.dataSource ?? {}) as never,
    (overrides.paymentService ?? {}) as never,
    (overrides.inventory ?? {
      reserveForOrder: jest.fn(),
      consumeReservedForSale: jest.fn(),
      releaseOrRestoreOnCancel: jest.fn(),
      restoreForCancel: jest.fn(),
    }) as never,
    accountingStub as never,
    notificationsStub as never,
    auditStub as never,
    { validateForSubtotal: jest.fn(), consumeUse: jest.fn() } as never,
    (overrides.customerEmail ?? customerEmailStub) as never,
    (overrides.orders ?? { findOne: jest.fn(), find: jest.fn() }) as never,
    (overrides.media ?? { find: jest.fn().mockResolvedValue([]) }) as never,
    (overrides.history ?? { find: jest.fn().mockResolvedValue([]) }) as never,
  );
}

describe('OrdersService ownership', () => {
  it('returns an order only when userId matches', async () => {
    const order = {
      id: 'order-1',
      userId: 'user-a',
      orderNumber: 'ZEV-1',
    };
    const service = buildService({
      orders: { findOne: jest.fn().mockResolvedValue(order), find: jest.fn() },
    });
    await expect(service.findForUser('user-a', 'order-1')).resolves.toBe(order);
  });

  it('throws NotFound when another customer requests the order', async () => {
    const service = buildService({
      orders: { findOne: jest.fn().mockResolvedValue(null), find: jest.fn() },
    });
    await expect(
      service.findForUser('user-b', 'order-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists only by authenticated userId', async () => {
    const list = [{ id: 'order-1' }];
    const find = jest.fn().mockResolvedValue(list);
    const service = buildService({
      orders: { find, findOne: jest.fn() },
    });
    await expect(service.listForUser('user-a')).resolves.toBe(list);
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-a' },
        order: { createdAt: 'DESC' },
      }),
    );
  });
});

describe('OrdersService status transitions', () => {
  beforeEach(() => {
    accountingStub.postOrderConfirm.mockClear();
    accountingStub.postOrderDelivered.mockClear();
    accountingStub.reverseOrderJournals.mockClear();
  });

  it('allows placed → processing and rejects illegal jumps', async () => {
    const order = {
      id: 'order-1',
      status: OrderStatus.PLACED,
      items: [],
      payments: [],
      shippingAddress: {},
    };
    const manager = {
      findOne: jest
        .fn()
        .mockImplementation(() => Promise.resolve({ ...order })),
      save: jest.fn((value: unknown) => {
        if (value && typeof value === 'object' && 'status' in value) {
          order.status = (value as { status: OrderStatus }).status;
        }
        return Promise.resolve(value);
      }),
      create: jest.fn((_entity: unknown, data: unknown) => data),
    };
    const dataSource = {
      transaction: jest.fn((fn: (m: typeof manager) => unknown) =>
        Promise.resolve(fn(manager)),
      ),
    };
    const inventory = {
      reserveForOrder: jest.fn(),
      consumeReservedForSale: jest.fn(),
      releaseOrRestoreOnCancel: jest.fn(),
      restoreForCancel: jest.fn(),
    };
    const service = buildService({ dataSource, inventory });

    await expect(
      service.updateStatus('order-1', OrderStatus.PROCESSING, {
        type: 'admin',
        id: 'admin-1',
      }),
    ).resolves.toMatchObject({ status: OrderStatus.PROCESSING });
    expect(manager.save).toHaveBeenCalled();
    expect(inventory.consumeReservedForSale).toHaveBeenCalled();
    expect(accountingStub.postOrderConfirm).toHaveBeenCalled();

    order.status = OrderStatus.DELIVERED;
    manager.findOne.mockResolvedValue({ ...order });
    await expect(
      service.updateStatus('order-1', OrderStatus.SHIPPED, {
        type: 'admin',
        id: 'admin-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('restores inventory and reverses journals when cancelling', async () => {
    const order = {
      id: 'order-1',
      status: OrderStatus.PLACED,
      items: [
        {
          productId: 'p1',
          quantity: 2,
          productName: 'Roselle',
        },
      ],
      payments: [],
      shippingAddress: {},
    };
    const manager = {
      findOne: jest.fn().mockResolvedValue(order),
      save: jest.fn((value: unknown) => Promise.resolve(value)),
      create: jest.fn((_entity: unknown, data: unknown) => data),
    };
    const dataSource = {
      transaction: jest.fn((fn: (m: typeof manager) => unknown) =>
        Promise.resolve(fn(manager)),
      ),
    };
    const inventory = {
      reserveForOrder: jest.fn(),
      consumeReservedForSale: jest.fn(),
      releaseOrRestoreOnCancel: jest.fn(),
      restoreForCancel: jest.fn(),
    };
    const service = buildService({ dataSource, inventory });

    await service.updateStatus('order-1', OrderStatus.CANCELLED, {
      type: 'customer',
      id: 'user-1',
    });
    expect(inventory.releaseOrRestoreOnCancel).toHaveBeenCalledWith(
      manager,
      [
        {
          productId: 'p1',
          quantity: 2,
          productName: 'Roselle',
        },
      ],
      'order-1',
    );
    expect(accountingStub.reverseOrderJournals).toHaveBeenCalled();
  });

  it('admin delete voids delivered orders with inventory restore and journal reverse', async () => {
    const payment = {
      id: 'pay-1',
      provider: 'COD',
      status: 'SUCCESS',
    };
    const order = {
      id: 'order-1',
      status: OrderStatus.DELIVERED,
      items: [
        {
          productId: 'p1',
          quantity: 1,
          productName: 'Roselle',
        },
      ],
      payments: [payment],
      shippingAddress: {},
    };
    const manager = {
      findOne: jest.fn().mockResolvedValue(order),
      save: jest.fn((value: unknown) => Promise.resolve(value)),
      create: jest.fn((_entity: unknown, data: unknown) => data),
    };
    const dataSource = {
      transaction: jest.fn((fn: (m: typeof manager) => unknown) =>
        Promise.resolve(fn(manager)),
      ),
    };
    const inventory = {
      reserveForOrder: jest.fn(),
      consumeReservedForSale: jest.fn(),
      releaseOrRestoreOnCancel: jest.fn(),
      restoreForCancel: jest.fn(),
    };
    const service = buildService({ dataSource, inventory });

    const updated = await service.adminDeleteOrder('order-1', {
      type: 'admin',
      id: 'admin-1',
    });
    expect(inventory.releaseOrRestoreOnCancel).toHaveBeenCalled();
    expect(accountingStub.reverseOrderJournals).toHaveBeenCalled();
    expect(payment.status).toBe('REFUNDED');
    expect(updated.status).toBe(OrderStatus.CANCELLED);
  });

  it('posts cash journal and marks COD payment success on delivered', async () => {
    const payment = {
      id: 'pay-1',
      provider: 'COD',
      status: 'PENDING',
    };
    const order = {
      id: 'order-1',
      status: OrderStatus.SHIPPED,
      items: [],
      payments: [payment],
      shippingAddress: {},
      total: '1000.00',
    };
    const manager = {
      findOne: jest.fn().mockResolvedValue(order),
      save: jest.fn((value: unknown) => Promise.resolve(value)),
      create: jest.fn((_entity: unknown, data: unknown) => data),
    };
    const dataSource = {
      transaction: jest.fn((fn: (m: typeof manager) => unknown) =>
        Promise.resolve(fn(manager)),
      ),
    };
    const service = buildService({ dataSource });
    await service.updateStatus('order-1', OrderStatus.DELIVERED, {
      type: 'admin',
      id: 'admin-1',
    });
    expect(accountingStub.postOrderDelivered).toHaveBeenCalled();
    expect(payment.status).toBe('SUCCESS');
    expect(manager.save).toHaveBeenCalledWith(payment);
  });

  it('customer cancel rejects non-placed orders', async () => {
    const order = {
      id: 'order-1',
      userId: 'user-a',
      status: OrderStatus.PROCESSING,
      items: [],
      payments: [],
      shippingAddress: {},
    };
    const service = buildService({
      orders: { findOne: jest.fn().mockResolvedValue(order), find: jest.fn() },
    });
    await expect(
      service.cancelForCustomer('user-a', 'order-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('OrdersService place email', () => {
  beforeEach(() => {
    notificationsStub.notifyOrderPlaced.mockClear();
    customerEmailStub.sendOrderPlaced.mockClear();
    customerEmailStub.sendOrderPlaced.mockResolvedValue(undefined);
    auditStub.record.mockClear();
  });

  it('emails the customer after a new order is placed', async () => {
    customerEmailStub.sendOrderPlaced.mockResolvedValueOnce('mid-order-1');
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const product = {
      id: 'p1',
      name: 'Noir',
      slug: 'noir',
      status: 'active',
      price: '1000',
    };
    const createdOrder = {
      id: 'ord-1',
      orderNumber: 'ZEV-1',
      customerName: 'Buyer',
      customerEmail: 'buyer@example.com',
      total: '1250',
      currency: 'PKR',
      items: [{ productName: 'Noir', quantity: 1 }],
      payments: [{ provider: 'COD' }],
    };
    const manager = {
      find: jest.fn().mockResolvedValue([product]),
      findOne: jest.fn().mockResolvedValue(createdOrder),
      create: jest.fn((_entity: unknown, data: unknown) => ({
        id: 'generated',
        ...(data as object),
      })),
      save: jest.fn((value: unknown) => Promise.resolve(value)),
    };
    const dataSource = {
      transaction: jest.fn(async (fn: (m: typeof manager) => unknown) =>
        fn(manager),
      ),
    };
    const inventory = {
      reserveForOrder: jest.fn().mockResolvedValue(undefined),
      consumeReservedForSale: jest.fn(),
      releaseOrRestoreOnCancel: jest.fn(),
      restoreForCancel: jest.fn(),
    };
    const paymentService = {
      createPayment: jest.fn().mockResolvedValue({
        provider: 'COD',
        status: 'PENDING',
        providerReference: null,
      }),
    };
    const service = buildService({
      dataSource,
      inventory,
      paymentService,
      orders: { findOne: jest.fn().mockResolvedValue(null), find: jest.fn() },
    });

    await service.create(
      { id: 'user-1' } as never,
      {
        paymentMethod: 'COD',
        customerName: 'Buyer',
        customerEmail: 'buyer@example.com',
        customerPhone: '03001234567',
        items: [{ productId: 'p1', quantity: 1 }],
        shippingAddress: {
          line1: 'Street 1',
          city: 'Karachi',
          postalCode: '74000',
          country: 'Pakistan',
        },
      } as never,
    );

    expect(notificationsStub.notifyOrderPlaced).toHaveBeenCalled();
    expect(customerEmailStub.sendOrderPlaced).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'buyer@example.com',
        orderId: 'ord-1',
        orderNumber: 'ZEV-1',
        totalPkr: '1250',
        paymentMethod: 'COD',
      }),
    );
    expect(log).toHaveBeenCalledWith(expect.stringContaining('order=ZEV-1'));
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('to=buyer@example.com'),
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        'bcc=abdulrafaydeveloper@outlook.com,saad.jabri.iftikhar@gmail.com',
      ),
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('messageId=mid-order-1'),
    );
    log.mockRestore();
  });

  it('still places the order when customer email fails and logs a safe warning', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    customerEmailStub.sendOrderPlaced.mockRejectedValueOnce(
      Object.assign(
        new Error('Email delivery failed (MessageRejected). Try again later.'),
        {
          name: 'ServiceUnavailableException',
        },
      ),
    );
    const product = {
      id: 'p1',
      name: 'Noir',
      slug: 'noir',
      status: 'active',
      price: '1000',
    };
    const createdOrder = {
      id: 'ord-2',
      orderNumber: 'ZEV-2',
      customerName: 'Buyer',
      customerEmail: 'buyer@example.com',
      total: '1250',
      currency: 'PKR',
      items: [{ productName: 'Noir', quantity: 1 }],
      payments: [{ provider: 'COD' }],
    };
    const manager = {
      find: jest.fn().mockResolvedValue([product]),
      findOne: jest.fn().mockResolvedValue(createdOrder),
      create: jest.fn((_entity: unknown, data: unknown) => ({
        id: 'generated',
        ...(data as object),
      })),
      save: jest.fn((value: unknown) => Promise.resolve(value)),
    };
    const service = buildService({
      dataSource: {
        transaction: jest.fn(async (fn: (m: typeof manager) => unknown) =>
          fn(manager),
        ),
      },
      inventory: {
        reserveForOrder: jest.fn().mockResolvedValue(undefined),
        consumeReservedForSale: jest.fn(),
        releaseOrRestoreOnCancel: jest.fn(),
        restoreForCancel: jest.fn(),
      },
      paymentService: {
        createPayment: jest.fn().mockResolvedValue({
          provider: 'COD',
          status: 'PENDING',
          providerReference: null,
        }),
      },
      orders: { findOne: jest.fn().mockResolvedValue(null), find: jest.fn() },
    });

    await expect(
      service.create(
        { id: 'user-1' } as never,
        {
          paymentMethod: 'COD',
          customerName: 'Buyer',
          customerEmail: 'buyer@example.com',
          customerPhone: '03001234567',
          items: [{ productId: 'p1', quantity: 1 }],
          shippingAddress: {
            line1: 'Street 1',
            city: 'Karachi',
            postalCode: '74000',
            country: 'Pakistan',
          },
        } as never,
      ),
    ).resolves.toMatchObject({ id: 'ord-2' });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('order=ZEV-2'));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('to=buyer@example.com'),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('MessageRejected'),
    );
    warn.mockRestore();
  });
});
