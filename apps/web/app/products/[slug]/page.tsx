import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CatalogError } from '../../../components/catalog-state';
import { ProductGallery } from '../../../components/product-gallery';
import { ProductGrid } from '../../../components/product-grid';
import { ProductDescription } from '../../../components/product-description';
import { ProductPurchase } from '../../../components/product-purchase';
import { RecentlyViewed } from '../../../components/recently-viewed';
import { RecordProductView } from '../../../components/record-product-view';
import { CatalogApiError, fetchProducts } from '../../../lib/api';
import {
  formatProductPrice,
  getCompareAtPrice,
  getProductImages,
  isSignatureProduct,
  isTesterProduct,
} from '../../../lib/catalog';
import { fetchProductBySlug } from '../../../lib/product';
import styles from './page.module.css';

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await fetchProductBySlug(slug);
    return {
      title: `${product.name} — Zevooria`,
      description: product.description,
    };
  } catch {
    return {
      title: 'Fragrance — Zevooria',
    };
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  let product = null;
  let errorMessage: string | null = null;
  let catalog: Awaited<ReturnType<typeof fetchProducts>> = [];

  try {
    product = await fetchProductBySlug(slug);
  } catch (error) {
    if (error instanceof CatalogApiError && error.status === 404) {
      notFound();
    }
    errorMessage =
      error instanceof CatalogApiError
        ? error.message
        : 'Unable to load this fragrance right now.';
  }

  try {
    catalog = await fetchProducts();
  } catch {
    catalog = [];
  }

  const related = product
    ? catalog
        .filter((item) => item.id !== product.id && !isTesterProduct(item))
        .slice(0, 4)
    : [];

  if (errorMessage || !product) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <Link href="/collection" className={styles.crumbLink}>
            Collection
          </Link>
          <CatalogError
            title="Unable to open this fragrance"
            message={
              errorMessage ??
              'This composition could not be retrieved right now.'
            }
          />
        </main>
      </div>
    );
  }

  const images = getProductImages(product.media);
  const priceLabel = formatProductPrice(product.currency, product.price);
  const compareAt = getCompareAtPrice(product);
  const compareLabel = compareAt
    ? formatProductPrice(product.currency, compareAt)
    : null;
  const category = isTesterProduct(product)
    ? 'Discovery'
    : isSignatureProduct(product)
      ? 'Signature'
      : 'Parfum';

  return (
    <div className={styles.page}>
      <RecordProductView slug={product.slug} />
      <main className={styles.main}>
        <nav className={styles.crumbsNav} aria-label="Breadcrumb">
          <ol className={styles.crumbs}>
            <li>
              <Link href="/collection" className={styles.crumbLink}>
                Collection
              </Link>
            </li>
            <li aria-hidden className={styles.sep}>
              /
            </li>
            <li className={styles.crumbCurrent} aria-current="page">
              {product.name}
            </li>
          </ol>
        </nav>

        <div className={styles.layout}>
          <section
            className={styles.gallery}
            aria-label={`${product.name} gallery`}
          >
            <ProductGallery productName={product.name} images={images} />
          </section>

          <section className={styles.detail} aria-labelledby="product-title">
            <p className={styles.eyebrow}>{category}</p>
            <h1 id="product-title" className={styles.title}>
              {product.name}
            </h1>

            <p className={styles.price}>
              {compareLabel ? (
                <span className={styles.compareAt}>{compareLabel}</span>
              ) : null}
              {priceLabel}
            </p>

            <ProductDescription text={product.description} />

            <ProductPurchase
              productId={product.id}
              slug={product.slug}
              available={product.status === 'active'}
              availableQuantity={product.availableQuantity}
            />

            <div className={styles.accordions}>
              <details className={styles.details}>
                <summary className={styles.summary}>Fragrance details</summary>
                <div className={styles.panel}>
                  <dl className={styles.meta}>
                    <div>
                      <dt>House</dt>
                      <dd>Zevooria</dd>
                    </div>
                    <div>
                      <dt>Category</dt>
                      <dd>{category}</dd>
                    </div>
                    <div>
                      <dt>Availability</dt>
                      <dd>
                        {product.status === 'active' &&
                        (product.availableQuantity ?? 0) > 0
                          ? `${product.availableQuantity} in stock`
                          : product.status === 'active'
                            ? 'Out of stock'
                            : 'Unavailable'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </details>
              <details className={styles.details}>
                <summary className={styles.summary}>Delivery & returns</summary>
                <div className={styles.panel}>
                  <p>
                    Cash on delivery is available at checkout. Shipping is PKR
                    250 within Karachi and PKR 500 for other cities. See{' '}
                    <Link href="/shipping">shipping details</Link> and{' '}
                    <Link href="/returns">returns</Link>.
                  </p>
                </div>
              </details>
            </div>
          </section>
        </div>

        {related.length > 0 ? (
          <section className={styles.related} aria-labelledby="related-heading">
            <h2 id="related-heading" className={styles.relatedTitle}>
              You may also like
            </h2>
            <ProductGrid products={related} />
          </section>
        ) : null}

        <RecentlyViewed products={catalog} excludeSlug={product.slug} />
      </main>
    </div>
  );
}
