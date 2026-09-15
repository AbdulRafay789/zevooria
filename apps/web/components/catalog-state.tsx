import styles from './catalog-state.module.css';

export function CatalogLoading() {
  return (
    <div className={styles.state} role="status" aria-live="polite">
      <p className={styles.title}>Loading collection</p>
      <p className={styles.copy}>Fetching fragrances from the catalog.</p>
    </div>
  );
}

export function CatalogEmpty() {
  return (
    <div className={styles.state}>
      <p className={styles.title}>No fragrances yet</p>
      <p className={styles.copy}>
        The catalog is empty. Check back once products are published.
      </p>
    </div>
  );
}

export function CatalogError({ message }: { message: string }) {
  return (
    <div className={styles.state} role="alert">
      <p className={styles.title}>Unable to load catalog</p>
      <p className={styles.copy}>{message}</p>
    </div>
  );
}
