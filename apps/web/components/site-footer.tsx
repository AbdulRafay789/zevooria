import Link from 'next/link';
import styles from './site-footer.module.css';

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandBlock}>
          <p className={styles.brand}>Zevooria</p>
          <p className={styles.statement}>
            A dark, deliberate fragrance house — composed for presence.
          </p>
        </div>

        <div className={styles.columns}>
          <nav className={styles.column} aria-label="Shop">
            <p className={styles.heading}>Shop</p>
            <Link href="/collection">All fragrances</Link>
            <Link href="/collection?category=signature">Signature</Link>
            <Link href="/collection?category=tester">Tester</Link>
          </nav>

          <nav className={styles.column} aria-label="About">
            <p className={styles.heading}>About</p>
            <Link href="/our-story">Our story</Link>
            <Link href="/who-we-are">Who we are</Link>
            <Link href="/what-we-do">What we do</Link>
          </nav>

          <nav className={styles.column} aria-label="Services">
            <p className={styles.heading}>Services</p>
            <a href="mailto:support@zevooria.com">Contact</a>
            <Link href="/shipping">Shipping</Link>
            <Link href="/faqs">FAQ</Link>
          </nav>

          <nav className={styles.column} aria-label="Legal">
            <p className={styles.heading}>Legal</p>
            <Link href="/privacy-policy">Privacy</Link>
            <Link href="/returns">Returns</Link>
          </nav>
        </div>

        <a href="https://www.zevooria.com" target="_blank" rel="noopener noreferrer">
          <p className={styles.copy} style={{ color: 'white' }}>
            © {new Date().getFullYear()} Zevooria.
          </p>
        </a>
      </div>
    </footer>
  );
}
