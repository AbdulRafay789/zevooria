import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  formatProductPrice,
  getAdditionalImages,
  getPrimaryImage,
  getProductImages,
  storageKeyToPublicUrl,
} from './catalog';
import { resolveSafeAssetPath } from './assets-path';
import type { ProductMedia } from './types';
import { CatalogApiError } from './api';
import { fetchProductBySlug } from './product';

test('storageKeyToPublicUrl maps assets keys to public URLs', () => {
  assert.equal(
    storageKeyToPublicUrl('assets/crown-haider/crown-haider.jpeg'),
    '/assets/crown-haider/crown-haider.jpeg',
  );
});

test('storageKeyToPublicUrl rejects non-assets keys', () => {
  assert.throws(() => storageKeyToPublicUrl('s3://bucket/x.jpeg'));
});

test('formatProductPrice displays API values without recalculation', () => {
  assert.equal(formatProductPrice('PKR', '1299.00'), 'PKR 1,299');
  assert.equal(formatProductPrice('PKR', '999.00'), 'PKR 999');
});

test('primary and additional image selection', () => {
  const media: ProductMedia[] = [
    {
      id: '1',
      type: 'image',
      storageKey: 'assets/a/1.jpeg',
      altText: null,
      sortOrder: 1,
      isPrimary: false,
    },
    {
      id: '2',
      type: 'image',
      storageKey: 'assets/a/2.jpeg',
      altText: null,
      sortOrder: 0,
      isPrimary: true,
    },
    {
      id: '3',
      type: 'video',
      storageKey: 'assets/a/3.mp4',
      altText: null,
      sortOrder: 2,
      isPrimary: false,
    },
  ];
  assert.equal(getPrimaryImage(media)?.id, '2');
  assert.deepEqual(
    getAdditionalImages(media).map((m) => m.id),
    ['1'],
  );
  assert.deepEqual(
    getProductImages(media).map((m) => m.id),
    ['2', '1'],
  );
});

test('fetchProductBySlug maps 404 to CatalogApiError', async () => {
  const fetchImpl = async () =>
    new Response(null, { status: 404 }) as Response;

  await assert.rejects(
    () => fetchProductBySlug('missing', {}, fetchImpl as typeof fetch),
    (error: unknown) =>
      error instanceof CatalogApiError && error.status === 404,
  );
});

test('fetchProductBySlug returns a product payload', async () => {
  const payload = {
    id: '1',
    name: 'Tester',
    slug: 'tester',
    description: 'Demo',
    price: '999.00',
    currency: 'PKR',
    status: 'active',
    media: [],
  };
  const fetchImpl = async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }) as Response;

  const product = await fetchProductBySlug(
    'tester',
    {},
    fetchImpl as typeof fetch,
  );
  assert.equal(product.slug, 'tester');
  assert.equal(product.price, '999.00');
});

test('resolveSafeAssetPath blocks traversal', () => {
  const root = mkdtempSync(join(tmpdir(), 'zevooria-assets-'));
  mkdirSync(join(root, 'crown-haider'));
  writeFileSync(join(root, 'crown-haider', 'a.jpeg'), 'x');

  try {
    const ok = resolveSafeAssetPath(root, ['crown-haider', 'a.jpeg']);
    assert.ok(ok.endsWith(join('crown-haider', 'a.jpeg')));
    assert.throws(() => resolveSafeAssetPath(root, ['..', 'etc', 'passwd']));
    assert.throws(() =>
      resolveSafeAssetPath(root, ['crown-haider', '..', '..', 'x']),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
