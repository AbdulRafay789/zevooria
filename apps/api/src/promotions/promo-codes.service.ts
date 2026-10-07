import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { formatWholePkr, parseWholePkr } from '../common/money/pkr';
import { PromoCode } from './entities/promo-code.entity';
import { PromoDiscountType } from './promo-discount.enums';

export type PromoValidationResult = {
  promo: PromoCode;
  discountAmount: number;
};

@Injectable()
export class PromoCodesService {
  constructor(
    @InjectRepository(PromoCode)
    private readonly promos: Repository<PromoCode>,
  ) {}

  normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  async listAll(): Promise<PromoCode[]> {
    return this.promos.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<PromoCode> {
    const row = await this.promos.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('Promo code not found.');
    }
    return row;
  }

  async create(input: {
    code: string;
    discountType: PromoDiscountType;
    discountValue: string;
    minSubtotal?: string;
    maxUses?: number | null;
    startsAt?: string | null;
    endsAt?: string | null;
    isActive?: boolean;
  }): Promise<PromoCode> {
    const code = this.normalizeCode(input.code);
    if (!code || code.length < 2) {
      throw new BadRequestException('Promo code is required.');
    }
    const existing = await this.promos.findOne({ where: { code } });
    if (existing) {
      throw new BadRequestException('Promo code already exists.');
    }
    const discountValue = this.parseDiscountValue(
      input.discountType,
      input.discountValue,
    );
    const minSubtotal = parseWholePkr(
      input.minSubtotal ?? '1599',
      'min subtotal',
    );
    const row = this.promos.create({
      code,
      discountType: input.discountType,
      discountValue: formatWholePkr(discountValue),
      minSubtotal: formatWholePkr(minSubtotal),
      maxUses: input.maxUses ?? null,
      usedCount: 0,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      isActive: input.isActive !== false,
    });
    this.assertDateRange(row.startsAt, row.endsAt);
    return this.promos.save(row);
  }

  async update(
    id: string,
    input: {
      discountType?: PromoDiscountType;
      discountValue?: string;
      minSubtotal?: string;
      maxUses?: number | null;
      startsAt?: string | null;
      endsAt?: string | null;
      isActive?: boolean;
    },
  ): Promise<PromoCode> {
    const row = await this.findById(id);
    if (input.discountType) {
      row.discountType = input.discountType;
    }
    if (input.discountValue !== undefined) {
      const value = this.parseDiscountValue(
        row.discountType,
        input.discountValue,
      );
      row.discountValue = formatWholePkr(value);
    }
    if (input.minSubtotal !== undefined) {
      row.minSubtotal = formatWholePkr(
        parseWholePkr(input.minSubtotal, 'min subtotal'),
      );
    }
    if (input.maxUses !== undefined) {
      row.maxUses = input.maxUses;
    }
    if (input.startsAt !== undefined) {
      row.startsAt = input.startsAt ? new Date(input.startsAt) : null;
    }
    if (input.endsAt !== undefined) {
      row.endsAt = input.endsAt ? new Date(input.endsAt) : null;
    }
    if (input.isActive !== undefined) {
      row.isActive = input.isActive;
    }
    this.assertDateRange(row.startsAt, row.endsAt);
    return this.promos.save(row);
  }

  async remove(id: string): Promise<void> {
    const row = await this.findById(id);
    await this.promos.remove(row);
  }

  /**
   * Validates a code against a merchandise subtotal (whole PKR).
   * Does not mutate usage counters.
   */
  async validateForSubtotal(
    rawCode: string,
    subtotalPkr: number,
  ): Promise<PromoValidationResult> {
    const code = this.normalizeCode(rawCode);
    if (!code) {
      throw new BadRequestException('Promo code is required.');
    }
    const promo = await this.promos.findOne({ where: { code } });
    if (!promo || !promo.isActive) {
      throw new BadRequestException('Invalid or inactive promo code.');
    }
    const now = new Date();
    if (promo.startsAt && now < promo.startsAt) {
      throw new BadRequestException('This promo code is not active yet.');
    }
    if (promo.endsAt && now > promo.endsAt) {
      throw new BadRequestException('This promo code has expired.');
    }
    if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
      throw new BadRequestException('This promo code has reached its limit.');
    }
    const minSubtotal = parseWholePkr(promo.minSubtotal, 'min subtotal');
    if (subtotalPkr < minSubtotal) {
      throw new BadRequestException(
        `Minimum merchandise subtotal for this code is PKR ${minSubtotal}.`,
      );
    }
    const discountAmount = this.computeDiscount(promo, subtotalPkr);
    if (discountAmount <= 0) {
      throw new BadRequestException('Promo does not reduce this order.');
    }
    return { promo, discountAmount };
  }

  computeDiscount(promo: PromoCode, subtotalPkr: number): number {
    const value = parseWholePkr(promo.discountValue, 'discount value');
    if (promo.discountType === PromoDiscountType.PERCENT) {
      if (value < 1 || value > 100) {
        return 0;
      }
      return Math.min(subtotalPkr, Math.floor((subtotalPkr * value) / 100));
    }
    return Math.min(subtotalPkr, value);
  }

  /** Atomically increments used_count; throws if max uses reached. */
  async consumeUse(manager: EntityManager, promoId: string): Promise<void> {
    const result = await manager
      .createQueryBuilder()
      .update(PromoCode)
      .set({ usedCount: () => '"used_count" + 1' })
      .where('id = :id', { id: promoId })
      .andWhere('("max_uses" IS NULL OR "used_count" < "max_uses")')
      .execute();
    if (!result.affected) {
      throw new BadRequestException('This promo code has reached its limit.');
    }
  }

  private parseDiscountValue(type: PromoDiscountType, raw: string): number {
    const value = parseWholePkr(raw, 'discount value');
    if (type === PromoDiscountType.PERCENT) {
      if (value < 1 || value > 100) {
        throw new BadRequestException(
          'Percent discount must be a whole number from 1 to 100.',
        );
      }
      return value;
    }
    if (value < 1) {
      throw new BadRequestException('Fixed discount must be at least PKR 1.');
    }
    return value;
  }

  private assertDateRange(startsAt: Date | null, endsAt: Date | null): void {
    if (startsAt && endsAt && endsAt < startsAt) {
      throw new BadRequestException('End date must be after start date.');
    }
  }
}
