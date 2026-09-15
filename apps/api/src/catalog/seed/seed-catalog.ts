import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { MediaType } from '../catalog.enums';
import { Product } from '../entities/product.entity';
import { ProductMedia } from '../entities/product-media.entity';
import {
  DEMO_PRICE_MAX_PKR,
  DEMO_PRICE_MIN_PKR,
  randomPricePkr,
} from '../utils/price.util';
import { uniqueSlug } from '../utils/slug.util';
import {
  BuiltMediaSeed,
  SEED_PRODUCTS,
  buildStorageKey,
  isImageFile,
  mediaAltText,
} from './seed-catalog.definitions';

export function resolveAssetsRoot(cwd = process.cwd()): string {
  // Supports running from repo root or apps/api
  const candidates = [
    join(cwd, 'assets'),
    join(cwd, '..', '..', 'assets'),
    join(cwd, '..', 'assets'),
  ];
  for (const candidate of candidates) {
    try {
      readdirSync(candidate);
      return candidate;
    } catch {
      // try next
    }
  }
  throw new Error(
    `Could not locate repository assets/ directory from cwd=${cwd}`,
  );
}

export function listImageFilenames(
  assetsRoot: string,
  assetFolder: string,
): string[] {
  const dir = join(assetsRoot, assetFolder);
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && isImageFile(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function buildMediaForProduct(
  productName: string,
  assetFolder: string,
  filenames: string[],
): BuiltMediaSeed[] {
  return filenames.map((filename, index) => ({
    type: MediaType.IMAGE,
    storageKey: buildStorageKey(assetFolder, filename),
    altText: mediaAltText(productName, index),
    sortOrder: index,
    isPrimary: index === 0,
  }));
}

export type SeedCatalogOptions = {
  assetsRoot?: string;
  randomUnit?: () => number;
  /** When true, skip inserting if any products already exist. */
  skipIfNotEmpty?: boolean;
};

export async function seedCatalog(
  dataSource: DataSource,
  options: SeedCatalogOptions = {},
): Promise<{ inserted: number; skipped: boolean }> {
  const productRepo = dataSource.getRepository(Product);
  const existingCount = await productRepo.count();
  if (options.skipIfNotEmpty !== false && existingCount > 0) {
    return { inserted: 0, skipped: true };
  }

  const assetsRoot = options.assetsRoot ?? resolveAssetsRoot();
  const usedSlugs = new Set<string>();
  const randomUnit = options.randomUnit ?? Math.random;

  const products: Product[] = [];

  for (const def of SEED_PRODUCTS) {
    const filenames = listImageFilenames(assetsRoot, def.assetFolder);
    if (filenames.length === 0) {
      throw new Error(
        `No image files found for product "${def.name}" in assets/${def.assetFolder}`,
      );
    }

    const product = productRepo.create({
      name: def.name,
      slug: uniqueSlug(def.slugHint, usedSlugs),
      description: def.description,
      price: randomPricePkr(DEMO_PRICE_MIN_PKR, DEMO_PRICE_MAX_PKR, randomUnit),
      currency: 'PKR',
      status: def.status,
      media: buildMediaForProduct(def.name, def.assetFolder, filenames).map(
        (m) =>
          ({
            type: m.type,
            storageKey: m.storageKey,
            altText: m.altText,
            sortOrder: m.sortOrder,
            isPrimary: m.isPrimary,
          }) as ProductMedia,
      ),
    });

    products.push(product);
  }

  await productRepo.save(products);
  return { inserted: products.length, skipped: false };
}
