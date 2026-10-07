/**
 * Format whole PKR amounts for catalog seed / price sync.
 * Prefer this over random demo pricing.
 */
export function wholePkrToDb(amount: number): string {
  if (
    !Number.isInteger(amount) ||
    amount < 0 ||
    !Number.isSafeInteger(amount)
  ) {
    throw new Error('Price must be a non-negative safe integer (whole PKR)');
  }
  return `${amount}.00`;
}
