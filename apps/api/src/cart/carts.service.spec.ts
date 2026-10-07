import { CART_MAX_QTY, CartsService } from './carts.service';
import { ProductStatus } from '../catalog/catalog.enums';

describe('CartsService.mergeGuestIntoUser', () => {
  it('sums quantities and clamps to max', async () => {
    const guestItem = {
      productId: 'p1',
      quantity: 15,
      product: { status: ProductStatus.ACTIVE, slug: 'roselle' },
    };
    const userItem = {
      productId: 'p1',
      quantity: 10,
    };
    const saved: unknown[] = [];
    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({
          id: 'guest-cart',
        })
        .mockResolvedValueOnce({ id: 'user-cart', userId: 'u1' })
        .mockResolvedValueOnce(userItem)
        .mockResolvedValueOnce({
          id: 'user-cart',
          items: [
            {
              productId: 'p1',
              quantity: CART_MAX_QTY,
              product: { status: ProductStatus.ACTIVE, slug: 'roselle' },
            },
          ],
        }),
      find: jest.fn().mockResolvedValue([guestItem]),
      save: jest.fn((value: unknown) => {
        saved.push(value);
        return Promise.resolve(value);
      }),
      create: jest.fn((_entity: unknown, data: unknown) => data),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const service = new CartsService(
      {
        manager: {
          transaction: (fn: (m: typeof manager) => unknown) =>
            Promise.resolve(fn(manager)),
        },
        findOne: jest.fn(),
        save: jest.fn(),
      } as never,
      { delete: jest.fn() } as never,
      {} as never,
    );

    const result = await service.mergeGuestIntoUser('u1', 'guest-key-1');
    expect(userItem.quantity).toBe(CART_MAX_QTY);
    expect(manager.delete).toHaveBeenCalled();
    expect(result.items[0]?.quantity).toBe(CART_MAX_QTY);
  });
});
