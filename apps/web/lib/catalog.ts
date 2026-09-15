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
  return `${currency} ${price}`;
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
