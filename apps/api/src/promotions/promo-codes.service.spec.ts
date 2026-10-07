import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PromoDiscountType } from './promo-discount.enums';
import { PromoCodesService } from './promo-codes.service';
import { PromoCode } from './entities/promo-code.entity';

describe('PromoCodesService', () => {
  const repo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((row: Partial<PromoCode>) => row),
    save: jest.fn(async (row: PromoCode) => row),
  };
  const service = new PromoCodesService(repo as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function promo(partial: Partial<PromoCode>): PromoCode {
    return {
      id: 'promo-1',
      code: 'SAVE10',
      discountType: PromoDiscountType.PERCENT,
      discountValue: '10.00',
      minSubtotal: '1599.00',
      maxUses: null,
      usedCount: 0,
      startsAt: null,
      endsAt: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...partial,
    };
  }

  it('computes percent discount floored to whole PKR', () => {
    expect(service.computeDiscount(promo({}), 1699)).toBe(169);
  });

  it('caps fixed discount at subtotal', () => {
    expect(
      service.computeDiscount(
        promo({
          discountType: PromoDiscountType.FIXED,
          discountValue: '500.00',
        }),
        300,
      ),
    ).toBe(300);
  });

  it('rejects below min subtotal', async () => {
    repo.findOne.mockResolvedValue(promo({}));
    await expect(
      service.validateForSubtotal('save10', 999),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes codes to uppercase', () => {
    expect(service.normalizeCode('  save10 ')).toBe('SAVE10');
  });

  it('rejects inactive codes', async () => {
    repo.findOne.mockResolvedValue(promo({ isActive: false }));
    await expect(
      service.validateForSubtotal('SAVE10', 2000),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects exhausted max uses', async () => {
    repo.findOne.mockResolvedValue(promo({ maxUses: 1, usedCount: 1 }));
    await expect(
      service.validateForSubtotal('SAVE10', 2000),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFoundException for missing id', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
