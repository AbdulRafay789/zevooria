export type WishlistItem = {
  productId: string;
  slug: string;
};

const STORAGE_KEY = 'zevooria_wishlist_v1';

export function getWishlistItems(): WishlistItem[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const record = entry as Record<string, unknown>;
        if (
          typeof record.productId !== 'string' ||
          typeof record.slug !== 'string'
        ) {
          return null;
        }
        return { productId: record.productId, slug: record.slug };
      })
      .filter((item): item is WishlistItem => Boolean(item));
  } catch {
    return [];
  }
}

export function saveWishlistItems(items: WishlistItem[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('zevooria-wishlist-change'));
}

export function isInWishlist(
  items: WishlistItem[],
  productId: string,
): boolean {
  return items.some((item) => item.productId === productId);
}

export function toggleWishlistItem(
  items: WishlistItem[],
  product: { id: string; slug: string },
): WishlistItem[] {
  if (isInWishlist(items, product.id)) {
    return items.filter((item) => item.productId !== product.id);
  }
  return [...items, { productId: product.id, slug: product.slug }];
}
