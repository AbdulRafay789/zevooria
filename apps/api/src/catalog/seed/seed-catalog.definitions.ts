import { MediaType, ProductStatus } from '../catalog.enums';

export type SeedProductDefinition = {
  name: string;
  /** Preferred slug; uniqueness enforced at seed time. */
  slugHint: string;
  description: string;
  /** Relative folder under repository `assets/` (not used for video promo). */
  assetFolder: string;
  status: ProductStatus;
};

/**
 * Initial Zevooria demo catalog. Two Sabayica and two Signature SKUs share
 * asset folders intentionally. assets/video is promotional only — not a product.
 */
export const SEED_PRODUCTS: SeedProductDefinition[] = [
  {
    name: 'Crown Haider',
    slugHint: 'crown-haider',
    description:
      'Crown Haider — a distinguished Zevooria fragrance from the demo catalog.',
    assetFolder: 'crown-haider',
    status: ProductStatus.ACTIVE,
  },
  {
    name: 'Janic Sports',
    slugHint: 'janic-sports',
    description:
      'Janic Sports — an energetic Zevooria fragrance from the demo catalog.',
    assetFolder: 'janic-sports',
    status: ProductStatus.ACTIVE,
  },
  {
    name: 'Oceanic Luxe',
    slugHint: 'oceanic-luxe',
    description:
      'Oceanic Luxe — a refined aquatic-inspired Zevooria fragrance from the demo catalog.',
    assetFolder: 'oceanic-luxe',
    status: ProductStatus.ACTIVE,
  },
  {
    name: 'Roselle',
    slugHint: 'roselle',
    description: 'Roselle — a floral Zevooria fragrance from the demo catalog.',
    assetFolder: 'roselle',
    status: ProductStatus.ACTIVE,
  },
  {
    name: 'Royal Khamr',
    slugHint: 'royal-khamr',
    description:
      'Royal Khamr — a regal Zevooria fragrance from the demo catalog.',
    assetFolder: 'royal-khamr',
    status: ProductStatus.ACTIVE,
  },
  {
    name: 'Royal Voyage',
    slugHint: 'royal-voyage',
    description:
      'Royal Voyage — a journey-inspired Zevooria fragrance from the demo catalog.',
    assetFolder: 'royal-voyage',
    status: ProductStatus.ACTIVE,
  },
  {
    name: 'Sabayica',
    slugHint: 'sabayica',
    description:
      '"SABAYICA" — Arabic richness, Taif Rose, Jasmine, Oriental Spices, Amber, Musk, Precious Woods.',
    assetFolder: 'sabayica',
    status: ProductStatus.ACTIVE,
  },
  {
    name: 'Sabayica',
    slugHint: 'sabayica-golden-sweetness',
    description:
      'Sabayica — Golden Sweetness & Timeless Bloom — Caramel, citrus, white florals, rose, vanilla, sandalwood, musk.',
    assetFolder: 'sabayica',
    status: ProductStatus.ACTIVE,
  },
  {
    name: 'Signature for Men',
    slugHint: 'signature-for-men',
    description: 'Signature for Men – The Mark of Success',
    assetFolder: 'signature-for-man',
    status: ProductStatus.ACTIVE,
  },
  {
    name: 'Signature for Men',
    slugHint: 'signature-for-men-ultimate-alpha',
    description: 'Signature for Men — The Ultimate Alpha Essence',
    assetFolder: 'signature-for-man',
    status: ProductStatus.ACTIVE,
  },
  {
    name: 'Velmor',
    slugHint: 'velmor',
    description:
      'Velmor — a contemporary Zevooria fragrance from the demo catalog.',
    assetFolder: 'velmor',
    status: ProductStatus.ACTIVE,
  },
  {
    name: 'Velvet Night Oud',
    slugHint: 'velvet-night-oud',
    description:
      'Velvet Night Oud — a deep oud-inspired Zevooria fragrance from the demo catalog.',
    // Repository folder spelling is velvet-night-old (do not rename assets).
    assetFolder: 'velvet-night-old',
    status: ProductStatus.ACTIVE,
  },
  {
    name: 'Tester',
    slugHint: 'tester',
    description:
      'Tester — a generic demo fragrance sample from the Zevooria catalog for evaluation and sampling. Fragrance notes are not specified for this product.',
    assetFolder: 'tester',
    status: ProductStatus.ACTIVE,
  },
];

export const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.avif',
]);

export function isImageFile(filename: string): boolean {
  const dot = filename.lastIndexOf('.');
  if (dot < 0) {
    return false;
  }
  return IMAGE_EXTENSIONS.has(filename.slice(dot).toLowerCase());
}

export function buildStorageKey(assetFolder: string, filename: string): string {
  return `assets/${assetFolder}/${filename}`;
}

export function mediaAltText(productName: string, index: number): string {
  return index === 0
    ? `${productName} product image`
    : `${productName} product image ${index + 1}`;
}

export type BuiltMediaSeed = {
  type: MediaType;
  storageKey: string;
  altText: string;
  sortOrder: number;
  isPrimary: boolean;
};
