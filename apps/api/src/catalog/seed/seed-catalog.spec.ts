import { MediaType } from '../catalog.enums';
import {
  SEED_PRODUCTS,
  buildStorageKey,
  isImageFile,
} from '../seed/seed-catalog.definitions';
import { buildMediaForProduct } from '../seed/seed-catalog';
import { uniqueSlug } from '../utils/slug.util';

describe('catalog seed definitions', () => {
  it('defines 13 sellable products and unique preferred slugs', () => {
    expect(SEED_PRODUCTS).toHaveLength(13);

    const used = new Set<string>();
    const slugs = SEED_PRODUCTS.map((p) => uniqueSlug(p.slugHint, used));
    expect(new Set(slugs).size).toBe(13);

    const sabayica = SEED_PRODUCTS.filter((p) => p.name === 'Sabayica');
    expect(sabayica).toHaveLength(2);
    expect(sabayica.every((p) => p.assetFolder === 'sabayica')).toBe(true);

    const signatures = SEED_PRODUCTS.filter(
      (p) => p.name === 'Signature for Men',
    );
    expect(signatures).toHaveLength(2);
    expect(signatures.every((p) => p.assetFolder === 'signature-for-man')).toBe(
      true,
    );

    expect(SEED_PRODUCTS.some((p) => p.assetFolder === 'video')).toBe(false);

    for (const product of SEED_PRODUCTS) {
      if (product.name === 'Signature for Men') {
        expect(product.pricePkr).toBe(1699);
        expect(product.compareAtPkr).toBe(2200);
      } else if (product.name === 'Tester') {
        expect(product.pricePkr).toBe(999);
        expect(product.compareAtPkr).toBeNull();
      } else {
        expect(product.pricePkr).toBe(1599);
        expect(product.compareAtPkr).toBe(2100);
      }
    }
  });

  it('maps image files to ordered media with a single primary', () => {
    const media = buildMediaForProduct('Roselle', 'roselle', [
      'roselle.jpeg',
      'roselle-1.jpeg',
    ]);

    expect(media).toHaveLength(2);
    expect(media[0]).toMatchObject({
      type: MediaType.IMAGE,
      storageKey: buildStorageKey('roselle', 'roselle.jpeg'),
      sortOrder: 0,
      isPrimary: true,
    });
    expect(media[1].isPrimary).toBe(false);
    expect(media[1].sortOrder).toBe(1);
  });

  it('detects image files and ignores video extensions', () => {
    expect(isImageFile('sabayica.jpeg')).toBe(true);
    expect(isImageFile('making-video.mp4')).toBe(false);
  });
});
