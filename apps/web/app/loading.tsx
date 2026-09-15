import { CatalogLoading } from '../components/catalog-state';
import styles from './loading.module.css';

export default function Loading() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <CatalogLoading />
      </main>
    </div>
  );
}
