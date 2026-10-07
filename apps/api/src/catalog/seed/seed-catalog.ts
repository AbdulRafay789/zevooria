import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { MediaType } from '../catalog.enums';
import { Product } from '../entities/product.entity';
import { ProductMedia } from '../entities/product-media.entity';
import { wholePkrToDb } from '../utils/price.util';
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
  /** When true, skip inserting if any products already exist. */
  skipIfNotEmpty?: boolean;
  /**
   * When products already exist, sync authoritative price, compare-at,
   * description, and sort_order for matching seed slugs.
   */
  syncExisting?: boolean;
};

export async function seedCatalog(
  dataSource: DataSource,
  options: SeedCatalogOptions = {},
): Promise<{
  inserted: number;
  skipped: boolean;
  synced: number;
}> {
  const productRepo = dataSource.getRepository(Product);
  const existingCount = await productRepo.count();

  if (existingCount > 0) {
    let synced = 0;
    if (options.syncExisting !== false) {
      for (let index = 0; index < SEED_PRODUCTS.length; index += 1) {
        const def = SEED_PRODUCTS[index];
        const result = await productRepo.update(
          { slug: def.slugHint },
          {
            price: wholePkrToDb(def.pricePkr),
            compareAtPrice:
              def.compareAtPkr == null ? null : wholePkrToDb(def.compareAtPkr),
            description: def.description,
            name: def.name,
            status: def.status,
            sortOrder: index,
          },
        );
        synced += result.affected ?? 0;
      }
    }

    if (options.skipIfNotEmpty !== false) {
      return { inserted: 0, skipped: true, synced };
    }
  }

  const assetsRoot = options.assetsRoot ?? resolveAssetsRoot();
  const usedSlugs = new Set<string>();
  const products: Product[] = [];

  for (let index = 0; index < SEED_PRODUCTS.length; index += 1) {
    const def = SEED_PRODUCTS[index];
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
      price: wholePkrToDb(def.pricePkr),
      compareAtPrice:
        def.compareAtPkr == null ? null : wholePkrToDb(def.compareAtPkr),
      currency: 'PKR',
      status: def.status,
      sortOrder: index,
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
  return { inserted: products.length, skipped: false, synced: 0 };
}
