import type { Product } from './types';
import { CatalogApiError, getApiBaseUrl } from './api';

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.slug === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.price === 'string' &&
    typeof candidate.currency === 'string' &&
    Array.isArray(candidate.media)
  );
}

export async function fetchProductBySlug(
  slug: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<Product> {
  const encoded = encodeURIComponent(slug);
  const url = `${getApiBaseUrl(env)}/api/products/${encoded}`;
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

  if (response.status === 404) {
    throw new CatalogApiError('Product not found', 404);
  }

  if (!response.ok) {
    throw new CatalogApiError(
      'Unable to load this fragrance right now.',
      response.status,
    );
  }

  const data: unknown = await response.json();
  if (!isProduct(data)) {
    throw new CatalogApiError('Catalog API returned an unexpected payload');
  }

  return data;
}
