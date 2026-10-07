import { BadRequestException, ConflictException } from '@nestjs/common';
import { OrderStatus } from '../orders/order.enums';
import { ReviewsService, toSafeDisplayName } from './reviews.service';

describe('ReviewsService', () => {
  function createService(overrides: {
    order?: unknown;
    existingReview?: unknown;
    saveImpl?: jest.Mock;
    publicRows?: unknown[];
    publicTotal?: number;
    averageRating?: number;
  }) {
    const reviews = {
      find: jest.fn().mockImplementation((opts?: { relations?: unknown }) => {
        if (opts?.relations) {
          return Promise.resolve(overrides.publicRows ?? []);
        }
        return Promise.resolve(
          overrides.existingReview ? [overrides.existingReview] : [],
        );
      }),
      findAndCount: jest
        .fn()
        .mockResolvedValue([
          overrides.publicRows ?? [],
          overrides.publicTotal ?? overrides.publicRows?.length ?? 0,
        ]),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          avg:
            overrides.averageRating !== undefined
              ? String(overrides.averageRating)
              : null,
        }),
      }),
      findOne: jest.fn().mockResolvedValue(overrides.existingReview ?? null),
      create: jest.fn((value: unknown) => value),
      save:
        overrides.saveImpl ??
        jest.fn((value: unknown) =>
          Promise.resolve({
            ...(value as object),
            id: 'review-1',
            createdAt: new Date(),
          }),
        ),
    };
    const ordersService = {
      findForUser: jest.fn().mockResolvedValue(
        overrides.order ?? {
          id: 'order-1',
          status: OrderStatus.PLACED,
          items: [
            { productId: 'product-1', productName: 'A', productSlug: 'a' },
          ],
        },
      ),
    };
    return {
      service: new ReviewsService(
        reviews as never,
        {} as never,
        { find: jest.fn().mockResolvedValue([]) } as never,
        ordersService as never,
      ),
      reviews,
      ordersService,
    };
  }

  it('allows review of a purchased product', async () => {
    const { service } = createService({});
    await expect(
      service.create('user-1', {
        orderId: '11111111-1111-4111-8111-111111111111',
        productId: 'product-1',
        rating: 5,
        body: 'A beautiful fragrance with lasting presence.',
      }),
    ).resolves.toMatchObject({ productId: 'product-1', rating: 5 });
  });

  it('rejects review of an unpurchased product', async () => {
    const { service } = createService({});
    await expect(
      service.create('user-1', {
        orderId: '11111111-1111-4111-8111-111111111111',
        productId: 'other-product',
        rating: 4,
        body: 'A beautiful fragrance with lasting presence.',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate reviews', async () => {
    const { service } = createService({
      existingReview: { productId: 'product-1' },
    });
    await expect(
      service.create('user-1', {
        orderId: '11111111-1111-4111-8111-111111111111',
        productId: 'product-1',
        rating: 4,
        body: 'A beautiful fragrance with lasting presence.',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects empty review text', async () => {
    const { service } = createService({});
    await expect(
      service.create('user-1', {
        orderId: '11111111-1111-4111-8111-111111111111',
        productId: 'product-1',
        rating: 4,
        body: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns submitted review content on the owned order', async () => {
    const { service } = createService({
      existingReview: {
        productId: 'product-1',
        rating: 5,
        body: 'A beautiful fragrance with lasting presence.',
      },
    });
    const products = await service.listForOrder('user-1', 'order-1');
    expect(products[0]).toMatchObject({
      alreadyReviewed: true,
      review: {
        rating: 5,
        body: 'A beautiful fragrance with lasting presence.',
      },
    });
  });

  it('public homepage payload omits private customer fields', async () => {
    const { service } = createService({
      publicRows: [
        {
          productId: 'product-1',
          rating: 5,
          body: 'A beautiful fragrance with lasting presence.',
          user: {
            fullName: 'Ayesha Khan',
            email: 'secret@example.com',
            phone: '03001234567',
          },
          product: { name: 'Crown Haider' },
        },
      ],
      publicTotal: 1,
      averageRating: 5,
    });
    const page = await service.listPublic({ limit: 20, offset: 0 });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(1);
    expect(page.averageRating).toBe(5);
    expect(page.hasMore).toBe(false);
    expect(page.items[0]).toEqual({
      rating: 5,
      body: 'A beautiful fragrance with lasting presence.',
      productName: 'Crown Haider',
      displayName: 'Ayesha',
      imageKey: null,
    });
    expect(JSON.stringify(page)).not.toContain('secret@example.com');
    expect(JSON.stringify(page)).not.toContain('03001234567');
  });

  it('caps public review batches at 20 and reports hasMore', async () => {
    const { service, reviews } = createService({
      publicRows: Array.from({ length: 20 }, (_, i) => ({
        productId: `p-${i}`,
        rating: 4,
        body: 'Nice',
        user: { fullName: 'Sam' },
        product: { name: 'Noir' },
      })),
      publicTotal: 45,
      averageRating: 4.2,
    });
    const page = await service.listPublic({ limit: 50, offset: 0 });
    expect(reviews.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20, skip: 0 }),
    );
    expect(page.limit).toBe(20);
    expect(page.hasMore).toBe(true);
    expect(page.averageRating).toBe(4.2);
  });
});

describe('toSafeDisplayName', () => {
  it('uses first name only', () => {
    expect(toSafeDisplayName('Ayesha Khan')).toBe('Ayesha');
  });
});
