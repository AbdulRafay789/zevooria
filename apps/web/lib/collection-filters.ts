import type { Product } from './types';
import { isSignatureProduct, isTesterProduct } from './catalog';

export type CatalogCategory = 'signature' | 'tester' | 'fragrance';

export type SortOption = 'recommended' | 'newest' | 'price-low' | 'price-high';

export function getProductCategory(product: Product): CatalogCategory {
  if (isTesterProduct(product)) {
    return 'tester';
  }
  if (isSignatureProduct(product)) {
    return 'signature';
  }
  return 'fragrance';
}

export function categoryLabel(category: CatalogCategory): string {
  switch (category) {
    case 'signature':
      return 'Signature';
    case 'tester':
      return 'Tester';
    default:
      return 'Fragrance';
  }
}

export const CATEGORY_OPTIONS: { value: CatalogCategory; label: string }[] = [
  { value: 'fragrance', label: 'Fragrance' },
  { value: 'signature', label: 'Signature' },
  { value: 'tester', label: 'Tester' },
];

export type CollectionQuery = {
  min?: number;
  max?: number;
  categories: CatalogCategory[];
  sort: SortOption;
  q?: string;
};

export function parseCollectionQuery(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): CollectionQuery {
  const get = (key: string): string | undefined => {
    if (params instanceof URLSearchParams) {
      return params.get(key) ?? undefined;
    }
    const value = params[key];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  };

  const minRaw = Number(get('min'));
  const maxRaw = Number(get('max'));
  const categoryRaw = get('category') ?? '';
  const categories = categoryRaw
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is CatalogCategory =>
      item === 'signature' || item === 'tester' || item === 'fragrance',
    );
  const sortRaw = get('sort') ?? 'recommended';
  const sort: SortOption =
    sortRaw === 'newest' ||
    sortRaw === 'price-low' ||
    sortRaw === 'price-high'
      ? sortRaw
      : 'recommended';
  const q = get('q')?.trim() || undefined;

  return {
    min: Number.isFinite(minRaw) && minRaw >= 0 ? minRaw : undefined,
    max: Number.isFinite(maxRaw) && maxRaw >= 0 ? maxRaw : undefined,
    categories,
    sort,
    q,
  };
}

export function buildCollectionSearchParams(
  query: CollectionQuery,
): URLSearchParams {
  const params = new URLSearchParams();
  if (query.min != null) {
    params.set('min', String(Math.round(query.min)));
  }
  if (query.max != null) {
    params.set('max', String(Math.round(query.max)));
  }
  if (query.categories.length > 0) {
    params.set('category', query.categories.join(','));
  }
  if (query.sort !== 'recommended') {
    params.set('sort', query.sort);
  }
  if (query.q) {
    params.set('q', query.q);
  }
  return params;
}

export function filterAndSortProducts(
  products: Product[],
  query: CollectionQuery,
): Product[] {
  let result = products.slice();

  if (query.q) {
    const needle = query.q.toLowerCase();
    result = result.filter(
      (product) =>
        product.name.toLowerCase().includes(needle) ||
        product.description.toLowerCase().includes(needle),
    );
  }

  if (query.categories.length > 0) {
    result = result.filter((product) =>
      query.categories.includes(getProductCategory(product)),
    );
  }

  if (query.min != null) {
    result = result.filter((product) => Number(product.price) >= query.min!);
  }
  if (query.max != null) {
    result = result.filter((product) => Number(product.price) <= query.max!);
  }

  switch (query.sort) {
    case 'price-low':
      result.sort((a, b) => Number(a.price) - Number(b.price));
      break;
    case 'price-high':
      result.sort((a, b) => Number(b.price) - Number(a.price));
      break;
    case 'newest':
      result.sort(
        (a, b) => (b.sortOrder ?? 0) - (a.sortOrder ?? 0),
      );
      break;
    default:
      result.sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
      );
      break;
  }

  return result;
}

export function priceBounds(products: Product[]): { min: number; max: number } {
  if (products.length === 0) {
    return { min: 0, max: 0 };
  }
  const prices = products.map((product) => Number(product.price));
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}
