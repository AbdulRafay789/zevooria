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
