/**
 * Client-side whole-PKR helpers for display totals only.
 * Server recalculates authoritative totals on order creation.
 */

export function parseWholePkr(raw: string): number {
  const cleaned = raw.trim();
  if (!/^\d+(\.0{1,2})?$/.test(cleaned)) {
    throw new Error(`Invalid whole PKR amount: ${raw}`);
  }
  return Number.parseInt(cleaned.split('.')[0] ?? '0', 10);
}

export function lineTotalWholePkr(unitPrice: number, quantity: number): number {
  if (!Number.isInteger(unitPrice) || !Number.isInteger(quantity) || quantity < 1) {
    throw new Error('Invalid line total inputs');
  }
  return unitPrice * quantity;
}

export function sumWholePkr(amounts: number[]): number {
  return amounts.reduce((sum, amount) => {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error('Invalid sum amount');
    }
    return sum + amount;
  }, 0);
}
