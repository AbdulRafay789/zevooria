import type { Product } from './types';

export class CatalogApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'CatalogApiError';
  }
}

export function getApiBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.API_URL?.trim() || 'http://localhost:3001';
  return raw.replace(/\/$/, '');
}

export async function fetchProducts(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<Product[]> {
  const url = `${getApiBaseUrl(env)}/api/products`;
  let response: Response;

  try {
    response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch {
    throw new CatalogApiError(
      'Unable to reach the catalog API. Please try again shortly.',
    );
  }

  if (!response.ok) {
    throw new CatalogApiError(
      `Catalog API returned ${response.status}`,
      response.status,
    );
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new CatalogApiError('Catalog API returned an unexpected payload');
  }

  return data as Product[];
}

export type PublicReview = {
  rating: number;
  body: string;
  productName: string;
  displayName: string;
  imageKey: string | null;
};

export type PublicReviewsPage = {
  items: PublicReview[];
  total: number;
  averageRating: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export async function fetchPublicReviewsPage(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
  options: { limit?: number; offset?: number } = {},
): Promise<PublicReviewsPage> {
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;
  const url = `${getApiBaseUrl(env)}/api/reviews/public?limit=${limit}&offset=${offset}`;
  const empty: PublicReviewsPage = {
    items: [],
    total: 0,
    averageRating: 0,
    limit,
    offset,
    hasMore: false,
  };

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch {
    return empty;
  }

  if (!response.ok) {
    return empty;
  }

  const data: unknown = await response.json();
  if (!data || typeof data !== 'object') {
    return empty;
  }
  const record = data as Partial<PublicReviewsPage>;
  if (!Array.isArray(record.items)) {
    return empty;
  }

  return {
    items: record.items as PublicReview[],
    total: typeof record.total === 'number' ? record.total : record.items.length,
    averageRating:
      typeof record.averageRating === 'number' ? record.averageRating : 0,
    limit: typeof record.limit === 'number' ? record.limit : limit,
    offset: typeof record.offset === 'number' ? record.offset : offset,
    hasMore: Boolean(record.hasMore),
  };
}

/** @deprecated Prefer fetchPublicReviewsPage for aggregates + batching. */
export async function fetchPublicReviews(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
  limit = 20,
): Promise<PublicReview[]> {
  const page = await fetchPublicReviewsPage(env, fetchImpl, { limit, offset: 0 });
  return page.items;
}
