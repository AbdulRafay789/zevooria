import Link from 'next/link';
import { CatalogEmpty, CatalogError } from '../components/catalog-state';
import { CustomerReviewsSection } from '../components/customer-reviews-section';
import { HeroVideo } from '../components/hero-video';
import { HomeFaqSection } from '../components/home-faq-section';
import { ProductDescription } from '../components/product-description';
import { ProductGrid } from '../components/product-grid';
import { Reveal } from '../components/reveal';
import {
  CatalogApiError,
  fetchProducts,
  fetchPublicReviewsPage,
} from '../lib/api';
import {
  formatProductPrice,
  getPrimaryImage,
  isTesterProduct,
  storageKeyToPublicUrl,
} from '../lib/catalog';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let products = null;
  let errorMessage: string | null = null;
  let reviewsPage = {
    items: [] as Awaited<ReturnType<typeof fetchPublicReviewsPage>>['items'],
    total: 0,
    averageRating: 0,
    limit: 20,
    offset: 0,
    hasMore: false,
  };

  try {
    products = await fetchProducts();
  } catch (error) {
    errorMessage =
      error instanceof CatalogApiError
        ? error.message
        : 'Something went wrong while loading the catalog.';
  }

  try {
    reviewsPage = await fetchPublicReviewsPage(undefined, undefined, {
      limit: 20,
      offset: 0,
    });
  } catch {
    // keep empty page
  }

  const fragrances =
    products?.filter((product) => !isTesterProduct(product)) ?? [];
  const tester = products?.find((product) => isTesterProduct(product));
  const testerImage = tester
    ? getPrimaryImage(tester.media.filter((media) => media.type === 'image'))
    : undefined;

  return (
    <div className={styles.page}>
      <main>
        <HeroVideo
          brand={
            <>
              <p className={styles.eyebrow}>Maison de parfum</p>
              <h1 className={styles.heroBrand}>Zevooria</h1>
            </>
          }
        >
          <p className={styles.heroLine}>A perfume for your presence</p>
          <Link href="/collection" className={styles.heroCta}>
            Discover the collection
          </Link>
        </HeroVideo>

        <Reveal>
          <section id="maison" className={styles.maison}>
            <p className={styles.sectionEyebrow}>The house of Zevooria</p>
            <h2 className={styles.maisonTitle}>
              A dark, deliberate collection — composed for presence, finished with
              restraint.
            </h2>
            <Link href="/our-story" className={styles.textLink}>
              Read our story
            </Link>
          </section>
        </Reveal>

        <Reveal>
          <section
            id="collection"
            className={styles.collection}
            aria-labelledby="collection-heading"
          >
            <div className={styles.collectionHead}>
              <div>
                <p className={styles.sectionEyebrow}>Fragrances</p>
                <h2 id="collection-heading" className={styles.sectionTitle}>
                  The collection
                </h2>
              </div>
              <p className={styles.collectionIntro}>
                Browse the house catalog.{' '}
                <Link href="/collection" className={styles.inlineLink}>
                  View all with filters
                </Link>
              </p>
            </div>

            {errorMessage ? <CatalogError message={errorMessage} /> : null}
            {!errorMessage && fragrances.length === 0 ? <CatalogEmpty /> : null}
            {!errorMessage && fragrances.length > 0 ? (
              <ProductGrid products={fragrances} />
            ) : null}
          </section>
        </Reveal>

        {tester ? (
          <Reveal>
            <section id="tester" className={styles.tester}>
              <div className={styles.testerInner}>
                <p className={styles.sectionEyebrow}>Discovery collection</p>
                <h2 className={styles.testerTitle}>{tester.name}</h2>
                <div className={styles.testerBody}>
                  <ProductDescription text={tester.description} />
                </div>
                <p className={styles.testerPrice}>
                  {formatProductPrice(tester.currency, tester.price)}
                </p>
                <p className={styles.testerNote}>
                  Named constituent fragrances are not specified in the current
                  product data.
                </p>
                <Link
                  href={`/products/${tester.slug}`}
                  className={styles.textLink}
                >
                  View tester
                </Link>
              </div>
              <div className={styles.testerMedia}>
                {testerImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={storageKeyToPublicUrl(testerImage.storageKey)}
                    alt={testerImage.altText ?? tester.name}
                    loading="lazy"
                    decoding="async"
                  />
                ) : null}
              </div>
            </section>
          </Reveal>
        ) : null}

        {reviewsPage.total > 0 || reviewsPage.items.length > 0 ? (
          <Reveal>
            <CustomerReviewsSection initial={reviewsPage} />
          </Reveal>
        ) : null}

        <Reveal>
          <HomeFaqSection />
        </Reveal>

        <Reveal>
          <section className={styles.closing}>
            <p className={styles.sectionEyebrow}>Zevooria</p>
            <h2 className={styles.closingTitle}>Presence, composed.</h2>
          </section>
        </Reveal>
      </main>
    </div>
  );
}
