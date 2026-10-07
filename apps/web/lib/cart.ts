export type CartItem = {
  productId: string;
  slug: string;
  quantity: number;
};

const GUEST_KEY_STORAGE = 'zevooria_cart_guest_v1';

/** Stable guest cart id for anonymous browsers (UUID). */
export function getOrCreateGuestCartKey(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    const existing = window.localStorage.getItem(GUEST_KEY_STORAGE);
    if (existing && isUuid(existing)) {
      return existing;
    }
    const next = crypto.randomUUID();
    window.localStorage.setItem(GUEST_KEY_STORAGE, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

export function peekGuestCartKey(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const existing = window.localStorage.getItem(GUEST_KEY_STORAGE);
    return existing && isUuid(existing) ? existing : null;
  } catch {
    return null;
  }
}

export function clearGuestCartKey(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(GUEST_KEY_STORAGE);
  } catch {
    // ignore
  }
}

export function cartItemCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
