/**
 * Whole-PKR money helpers.
 * Authoritative amounts are integer PKR major units (e.g. 1599).
 * Database storage remains numeric(12,2) strings ("1599.00").
 * Never use floating-point arithmetic for totals.
 */

export function assertWholePkr(amount: number, label = 'amount'): void {
  if (
    !Number.isInteger(amount) ||
    amount < 0 ||
    !Number.isSafeInteger(amount)
  ) {
    throw new Error(`${label} must be a non-negative safe integer PKR amount`);
  }
}

/** Parse a DB/API numeric money string into whole PKR (rejects fractional paisa). */
export function parseWholePkr(raw: string, label = 'price'): number {
  const cleaned = raw.trim();
  if (!/^\d+(\.0{1,2})?$/.test(cleaned)) {
    throw new Error(`${label} must be a whole PKR amount (received "${raw}")`);
  }
  const major = Number.parseInt(cleaned.split('.')[0] ?? '', 10);
  assertWholePkr(major, label);
  return major;
}

export function formatWholePkr(amount: number): string {
  assertWholePkr(amount);
  return `${amount}.00`;
}

/**
 * Format a whole-PKR amount that may be negative (report nets: net income/loss,
 * credit-balance assets, debit-balance liabilities).
 */
export function assertSignedWholePkr(amount: number, label = 'amount'): void {
  if (!Number.isInteger(amount) || !Number.isSafeInteger(amount)) {
    throw new Error(`${label} must be a safe integer PKR amount`);
  }
}

export function formatSignedWholePkr(amount: number): string {
  assertSignedWholePkr(amount);
  return `${amount}.00`;
}

export function lineTotalWholePkr(unitPrice: number, quantity: number): number {
  assertWholePkr(unitPrice, 'unitPrice');
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    !Number.isSafeInteger(quantity)
  ) {
    throw new Error('quantity must be a positive safe integer');
  }
  const total = unitPrice * quantity;
  assertWholePkr(total, 'lineTotal');
  return total;
}

export function sumWholePkr(amounts: number[]): number {
  let total = 0;
  for (const amount of amounts) {
    assertWholePkr(amount);
    total += amount;
    assertWholePkr(total, 'sum');
  }
  return total;
}
