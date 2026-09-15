import styles from './loading.module.css';

export default function ProductLoading() {
  return (
    <div className={styles.page}>
      <header className={styles.masthead}>
        <p className={styles.brand}>Zevooria</p>
        <p className={styles.mastheadMeta}>The Collection</p>
      </header>

      <main className={styles.main} aria-busy="true" aria-live="polite">
        <p className={styles.status}>Opening the fragrance</p>

        <div className={styles.layout}>
          <div className={styles.gallerySkeleton} aria-hidden />
          <div className={styles.detailSkeleton} aria-hidden>
            <div className={styles.lineShort} />
            <div className={styles.lineTitle} />
            <div className={styles.linePrice} />
            <div className={styles.rule} />
            <div className={styles.lineBody} />
            <div className={styles.lineBody} />
            <div className={styles.lineBodyNarrow} />
          </div>
        </div>
      </main>
    </div>
  );
}
