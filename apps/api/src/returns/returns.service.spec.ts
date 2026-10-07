import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '../orders/order.enums';
import { ReturnsService } from './returns.service';
import { ReturnStatus } from './return.enums';

describe('ReturnsService.create guards', () => {
  it('rejects non-delivered orders', async () => {
    const service = new ReturnsService(
      {} as never,
      {} as never,
      {} as never,
      { record: jest.fn() } as never,
      { find: jest.fn() } as never,
      {
        findOne: jest.fn().mockResolvedValue({
          id: 'order-1',
          status: OrderStatus.PROCESSING,
          items: [],
        }),
      } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.create(
        {
          orderId: 'order-1',
          items: [{ orderItemId: 'item-1', quantity: 1 }],
        },
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when return window has expired', async () => {
    const old = new Date();
    old.setDate(old.getDate() - 30);
    const service = new ReturnsService(
      {} as never,
      {} as never,
      {} as never,
      { record: jest.fn() } as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      {
        findOne: jest.fn().mockResolvedValue({
          id: 'order-1',
          status: OrderStatus.DELIVERED,
          subtotal: '1599.00',
          discountAmount: '0.00',
          items: [
            {
              id: 'item-1',
              productId: 'p1',
              productName: 'Roselle',
              quantity: 1,
              unitPrice: '1599.00',
            },
          ],
        }),
      } as never,
      {} as never,
      {
        findOne: jest.fn().mockResolvedValue({ createdAt: old }),
      } as never,
      {} as never,
    );

    await expect(
      service.create(
        {
          orderId: 'order-1',
          items: [{ orderItemId: 'item-1', quantity: 1 }],
        },
        'admin-1',
      ),
    ).rejects.toThrow(/14 days/);
  });
});

describe('ReturnStatus', () => {
  it('exposes pending_inspect workflow states', () => {
    expect(ReturnStatus.PENDING_INSPECT).toBe('pending_inspect');
    expect(ReturnStatus.INSPECTED).toBe('inspected');
    expect(ReturnStatus.REFUNDED).toBe('refunded');
  });
});
