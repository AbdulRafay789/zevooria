import Link from 'next/link';
import styles from './not-found.module.css';

export default function ProductNotFound() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <p className={styles.eyebrow}>Fragrance</p>
        <h1 className={styles.title}>Composition unavailable</h1>
        <p className={styles.copy}>
          This fragrance is not part of the current collection, or it may have
          been withdrawn.
        </p>
        <Link href="/collection" className={styles.link}>
          Return to the collection
        </Link>
      </main>
    </div>
  );
}
