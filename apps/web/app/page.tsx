import { CatalogEmpty, CatalogError } from '../components/catalog-state';
import { ProductGrid } from '../components/product-grid';
import { CatalogApiError, fetchProducts } from '../lib/api';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let products = null;
  let errorMessage: string | null = null;

  try {
    products = await fetchProducts();
  } catch (error) {
    errorMessage =
      error instanceof CatalogApiError
        ? error.message
        : 'Something went wrong while loading the catalog.';
  }

  const count = products?.length ?? 0;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Maison de parfum</p>
          <h1 className={styles.brand}>Zevooria</h1>
          <div className={styles.heroRule} aria-hidden />
          <p className={styles.lede}>
            A dark, deliberate collection — composed for presence, finished with
            restraint.
          </p>
          {!errorMessage && products ? (
            <p className={styles.meta}>
              {count === 0
                ? 'Collection forthcoming'
                : `${count} fragrance${count === 1 ? '' : 's'} available`}
            </p>
          ) : null}
        </header>

        <section className={styles.section} aria-labelledby="collection-heading">
          <div className={styles.sectionHead}>
            <h2 id="collection-heading" className={styles.sectionTitle}>
              The Collection
            </h2>
            <p className={styles.sectionCopy}>
              Each composition is presented as photographed — prices and details
              are served live from the catalog.
            </p>
          </div>

          {errorMessage ? <CatalogError message={errorMessage} /> : null}
          {!errorMessage && products && products.length === 0 ? (
            <CatalogEmpty />
          ) : null}
          {!errorMessage && products && products.length > 0 ? (
            <ProductGrid products={products} />
          ) : null}
        </section>
      </main>
    </div>
  );
}
