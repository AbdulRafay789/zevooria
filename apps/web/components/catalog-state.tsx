import styles from './catalog-state.module.css';

export function CatalogLoading() {
  return (
    <div className={styles.state} role="status" aria-live="polite">
      <p className={styles.title}>Opening the collection</p>
      <p className={styles.copy}>Retrieving live catalog details.</p>
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

export function CatalogError({
  message,
  title = 'Unable to load catalog',
}: {
  message: string;
  title?: string;
}) {
  return (
    <div className={styles.state} role="alert">
      <p className={styles.title}>{title}</p>
      <p className={styles.copy}>{message}</p>
    </div>
  );
}
