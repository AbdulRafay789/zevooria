import {
  DEMO_PRICE_MAX_PKR,
  DEMO_PRICE_MIN_PKR,
  randomPricePkr,
} from './price.util';

describe('randomPricePkr', () => {
  it('returns decimal-safe string amounts within inclusive bounds', () => {
    const samples = [
      randomPricePkr(DEMO_PRICE_MIN_PKR, DEMO_PRICE_MAX_PKR, () => 0),
      randomPricePkr(DEMO_PRICE_MIN_PKR, DEMO_PRICE_MAX_PKR, () => 0.999999),
      randomPricePkr(DEMO_PRICE_MIN_PKR, DEMO_PRICE_MAX_PKR, () => 0.5),
    ];

    for (const price of samples) {
      expect(price).toMatch(/^\d+\.\d{2}$/);
      const major = Number(price);
      expect(Number.isInteger(Number(price.split('.')[0]))).toBe(true);
      expect(major).toBeGreaterThanOrEqual(DEMO_PRICE_MIN_PKR);
      expect(major).toBeLessThanOrEqual(DEMO_PRICE_MAX_PKR);
    }

    expect(
      randomPricePkr(DEMO_PRICE_MIN_PKR, DEMO_PRICE_MAX_PKR, () => 0),
    ).toBe('999.00');
    expect(
      randomPricePkr(DEMO_PRICE_MIN_PKR, DEMO_PRICE_MAX_PKR, () => 0.999999),
    ).toBe('1499.00');
  });
});
