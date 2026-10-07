import type { ProductMedia } from './types';

/**
 * Converts API media storageKey (e.g. assets/crown-haider/x.jpeg)
 * into a same-origin URL served by the Next.js assets route.
 */
export function storageKeyToPublicUrl(storageKey: string): string {
  const normalized = storageKey.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized.startsWith('assets/')) {
    throw new Error(`Unsupported storageKey (expected assets/...): ${storageKey}`);
  }
  return `/${normalized}`;
}

export function formatProductPrice(currency: string, price: string): string {
  const numeric = Number(price);
  if (!Number.isFinite(numeric)) {
    return `${currency} ${price}`;
  }
  const formatted = new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(numeric));
  return `${currency} ${formatted}`;
}

/** Compare-at is display-only; only show when strictly above the sell price. */
export function getCompareAtPrice(product: {
  price: string;
  compareAtPrice?: string | null;
}): string | null {
  if (!product.compareAtPrice) {
    return null;
  }
  const sell = Number(product.price);
  const compare = Number(product.compareAtPrice);
  if (!Number.isFinite(sell) || !Number.isFinite(compare) || compare <= sell) {
    return null;
  }
  return product.compareAtPrice;
}

export function isTesterProduct(product: {
  slug: string;
  name: string;
}): boolean {
  return product.slug === 'tester' || product.name.toLowerCase() === 'tester';
}

export function isSignatureProduct(product: { name: string }): boolean {
  return product.name.toLowerCase().includes('signature for men');
}

/** Short preview for cards — first clause of the API description. */
export function previewDescription(description: string, max = 78): string {
  const cleaned = description.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) {
    return cleaned;
  }
  const slice = cleaned.slice(0, max);
  const boundary = slice.lastIndexOf(' ');
  return `${(boundary > 40 ? slice.slice(0, boundary) : slice).trim()}…`;
}

export function getPrimaryImage(media: ProductMedia[]): ProductMedia | undefined {
  return (
    media.find((m) => m.type === 'image' && m.isPrimary) ??
    media.find((m) => m.type === 'image')
  );
}

export function getAdditionalImages(media: ProductMedia[]): ProductMedia[] {
  return media.filter((m) => m.type === 'image' && !m.isPrimary);
}

/** Image media sorted for gallery display (primary first, then sortOrder). */
export function getProductImages(media: ProductMedia[]): ProductMedia[] {
  return media
    .filter((m) => m.type === 'image')
    .slice()
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) {
        return a.isPrimary ? -1 : 1;
      }
      return a.sortOrder - b.sortOrder;
    });
}
