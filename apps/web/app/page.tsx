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

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <p className={styles.brand}>Zevooria</p>
        <h1 className={styles.headline}>The Collection</h1>
        <p className={styles.lede}>
          Perfumes composed for presence — browse the current catalog.
        </p>
      </header>

      <section className={styles.section} aria-label="Product catalog">
        {errorMessage ? <CatalogError message={errorMessage} /> : null}
        {!errorMessage && products && products.length === 0 ? (
          <CatalogEmpty />
        ) : null}
        {!errorMessage && products && products.length > 0 ? (
          <ProductGrid products={products} />
        ) : null}
      </section>
    </main>
  );
}
