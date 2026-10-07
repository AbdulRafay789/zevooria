import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CatalogError } from '../../components/catalog-state';
import { CollectionBrowser } from '../../components/collection-browser';
import { CatalogApiError, fetchProducts } from '../../lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Collection — Zevooria',
  description: 'Browse the Zevooria fragrance collection.',
};

export default async function CollectionPage() {
  let products = null;
  let errorMessage: string | null = null;

  try {
    products = await fetchProducts();
  } catch (error) {
    errorMessage =
      error instanceof CatalogApiError
        ? error.message
        : 'Unable to load the collection right now.';
  }

  if (errorMessage || !products) {
    return (
      <div style={{ paddingTop: '5rem', paddingInline: 'var(--space-page)' }}>
        <CatalogError
          title="Unable to open the collection"
          message={errorMessage ?? 'Please try again shortly.'}
        />
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      <CollectionBrowser products={products} />
    </Suspense>
  );
}
