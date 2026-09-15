import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CatalogError } from '../../../components/catalog-state';
import { ProductGallery } from '../../../components/product-gallery';
import { CatalogApiError } from '../../../lib/api';
import { formatProductPrice, getProductImages } from '../../../lib/catalog';
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

  if (errorMessage || !product) {
    return (
      <div className={styles.page}>
        <header className={styles.masthead}>
          <Link href="/" className={styles.brand}>
            Zevooria
          </Link>
        </header>
        <main className={styles.main}>
          <nav className={styles.nav} aria-label="Breadcrumb">
            <Link href="/" className={styles.back}>
              ← Collection
            </Link>
          </nav>
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
  const imageCount = images.length;

  return (
    <div className={styles.page}>
      <header className={styles.masthead}>
        <Link href="/" className={styles.brand}>
          Zevooria
        </Link>
        <p className={styles.mastheadMeta}>The Collection</p>
      </header>

      <main className={styles.main}>
        <nav className={styles.nav} aria-label="Breadcrumb">
          <ol className={styles.crumbs}>
            <li>
              <Link href="/" className={styles.crumbLink}>
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
            <div className={styles.detailIntro}>
              <p className={styles.eyebrow}>Fragrance</p>
              <h1 id="product-title" className={styles.title}>
                {product.name}
              </h1>
              <p className={styles.price}>
                <span className={styles.priceLabel}>Price</span>
                <span className={styles.priceValue}>
                  {formatProductPrice(product.currency, product.price)}
                </span>
              </p>
            </div>

            <div className={styles.rule} aria-hidden />

            <div className={styles.composition}>
              <h2 className={styles.sectionLabel}>Composition</h2>
              <p className={styles.description}>{product.description}</p>
            </div>

            <dl className={styles.meta}>
              <div className={styles.metaItem}>
                <dt>House</dt>
                <dd>Zevooria</dd>
              </div>
              {imageCount > 0 ? (
                <div className={styles.metaItem}>
                  <dt>Views</dt>
                  <dd>
                    {imageCount} {imageCount === 1 ? 'image' : 'images'}
                  </dd>
                </div>
              ) : null}
              <div className={styles.metaItem}>
                <dt>Availability</dt>
                <dd>Coming soon</dd>
              </div>
            </dl>

            <div className={styles.purchase}>
              <p className={styles.purchaseNote}>
                Private purchasing opens in a later release. This composition is
                shown for discovery only.
              </p>
              <button
                type="button"
                className={styles.purchaseButton}
                disabled
                aria-disabled="true"
              >
                Add to bag — coming soon
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
