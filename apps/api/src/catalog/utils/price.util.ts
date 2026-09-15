/**
 * Demo catalog prices in whole PKR. Returns an integer in [min, max] inclusive.
 * Uses Math.floor of a provided random unit interval to avoid float money arithmetic.
 */
export function randomPricePkr(
  minInclusive: number,
  maxInclusive: number,
  randomUnit: () => number = Math.random,
): string {
  if (!Number.isInteger(minInclusive) || !Number.isInteger(maxInclusive)) {
    throw new Error('Price bounds must be integers (whole PKR)');
  }
  if (minInclusive > maxInclusive) {
    throw new Error('minInclusive must be <= maxInclusive');
  }

  const span = maxInclusive - minInclusive + 1;
  const unit = randomUnit();
  if (unit < 0 || unit >= 1) {
    throw new Error('randomUnit must return a value in [0, 1)');
  }

  const value = minInclusive + Math.floor(unit * span);
  return value.toFixed(2);
}

export const DEMO_PRICE_MIN_PKR = 999;
export const DEMO_PRICE_MAX_PKR = 1499;
