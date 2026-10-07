import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MediaType } from '../catalog/catalog.enums';
import { ProductMedia } from '../catalog/entities/product-media.entity';
import { OrderStatus } from '../orders/order.enums';
import { OrderItem } from '../orders/entities/order-item.entity';
import { OrdersService } from '../orders/orders.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { Review } from './entities/review.entity';

export type OrderProductReview = {
  rating: number;
  body: string;
};

export type ReviewableProduct = {
  productId: string;
  productName: string;
  productSlug: string;
  imageKey: string | null;
  alreadyReviewed: boolean;
  review: OrderProductReview | null;
};

export type PublicReviewView = {
  rating: number;
  body: string;
  productName: string;
  displayName: string;
  imageKey: string | null;
};

export type PublicReviewsPage = {
  items: PublicReviewView[];
  total: number;
  averageRating: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

/** Max page size for public review batches (keeps API load bounded). */
export const PUBLIC_REVIEWS_PAGE_SIZE = 20;

/** Safe public display: first token of full name only. */
export function toSafeDisplayName(fullName: string | null | undefined): string {
  const first = (fullName ?? '').trim().split(/\s+/)[0];
  return first || 'Customer';
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(OrderItem)
    private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(ProductMedia)
    private readonly media: Repository<ProductMedia>,
    private readonly ordersService: OrdersService,
  ) {}

  async listForOrder(
    userId: string,
    orderId: string,
  ): Promise<ReviewableProduct[]> {
    const order = await this.ordersService.findForUser(userId, orderId);
    if (order.status !== OrderStatus.PLACED) {
      return [];
    }

    const items = (order.items ?? []).filter(
      (item): item is OrderItem & { productId: string } =>
        Boolean(item.productId),
    );
    if (items.length === 0) {
      return [];
    }

    const productIds = [...new Set(items.map((item) => item.productId))];
    const existing = await this.reviews.find({
      where: { userId, productId: In(productIds) },
    });
    const reviewByProduct = new Map(
      existing.map((review) => [review.productId, review]),
    );
    const imageMap = await this.primaryImageKeys(productIds);

    const seen = new Set<string>();
    const result: ReviewableProduct[] = [];
    for (const item of items) {
      if (seen.has(item.productId)) {
        continue;
      }
      seen.add(item.productId);
      const review = reviewByProduct.get(item.productId);
      result.push({
        productId: item.productId,
        productName: item.productName,
        productSlug: item.productSlug,
        imageKey: imageMap.get(item.productId) ?? null,
        alreadyReviewed: Boolean(review),
        review: review ? { rating: review.rating, body: review.body } : null,
      });
    }
    return result;
  }

  async create(userId: string, dto: CreateReviewDto): Promise<Review> {
    const body = dto.body.trim();
    if (body.length < 10) {
      throw new BadRequestException('Review must be at least 10 characters.');
    }

    const order = await this.ordersService.findForUser(userId, dto.orderId);
    if (order.status !== OrderStatus.PLACED) {
      throw new BadRequestException('This order is not eligible for reviews.');
    }

    const purchased = (order.items ?? []).some(
      (item) => item.productId === dto.productId,
    );
    if (!purchased) {
      throw new BadRequestException(
        'You can only review products from this order.',
      );
    }

    const duplicate = await this.reviews.findOne({
      where: { userId, productId: dto.productId },
    });
    if (duplicate) {
      throw new ConflictException('You have already reviewed this product.');
    }

    const review = this.reviews.create({
      userId,
      orderId: dto.orderId,
      productId: dto.productId,
      rating: dto.rating,
      body,
    });

    try {
      return await this.reviews.save(review);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === '23505'
      ) {
        throw new ConflictException('You have already reviewed this product.');
      }
      throw error;
    }
  }

  /**
   * Public homepage notes. No moderation column exists yet — all submitted
   * reviews are eligible. Returns only safe display fields, plus aggregate
   * totals. Batched with a hard page size of 20.
   */
  async listPublic(options?: {
    limit?: number;
    offset?: number;
  }): Promise<PublicReviewsPage> {
    const limit = Math.min(
      Math.max(options?.limit ?? PUBLIC_REVIEWS_PAGE_SIZE, 1),
      PUBLIC_REVIEWS_PAGE_SIZE,
    );
    const offset = Math.max(options?.offset ?? 0, 0);

    const [rows, total] = await this.reviews.findAndCount({
      relations: { user: true, product: true },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    const avgRow = await this.reviews
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'avg')
      .getRawOne<{ avg: string | null }>();
    const averageRating = avgRow?.avg
      ? Math.round(Number(avgRow.avg) * 10) / 10
      : 0;

    if (rows.length === 0) {
      return {
        items: [],
        total,
        averageRating,
        limit,
        offset,
        hasMore: false,
      };
    }

    const imageMap = await this.primaryImageKeys(
      rows.map((row) => row.productId),
    );

    const items = rows.map((row) => ({
      rating: row.rating,
      body: row.body,
      productName: row.product?.name ?? 'Zevooria fragrance',
      displayName: toSafeDisplayName(row.user?.fullName),
      imageKey: imageMap.get(row.productId) ?? null,
    }));

    return {
      items,
      total,
      averageRating,
      limit,
      offset,
      hasMore: offset + items.length < total,
    };
  }

  async primaryImageKeys(productIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(productIds.filter(Boolean))];
    const map = new Map<string, string>();
    if (unique.length === 0) {
      return map;
    }

    const mediaRows = await this.media.find({
      where: {
        productId: In(unique),
        type: MediaType.IMAGE,
      },
      order: { isPrimary: 'DESC', sortOrder: 'ASC' },
    });

    for (const row of mediaRows) {
      if (!map.has(row.productId)) {
        map.set(row.productId, row.storageKey);
      }
    }
    return map;
  }

  assertFound(orderId: string | null): asserts orderId is string {
    if (!orderId) {
      throw new NotFoundException('Order not found.');
    }
  }
}
