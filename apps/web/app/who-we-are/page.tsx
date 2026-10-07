import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '../../components/content-page';
import styles from '../../components/content-page.module.css';

export const metadata: Metadata = {
  title: 'Who We Are — Zevooria',
  description: 'Meet Zevooria — the people and principles behind the house.',
};

export default function WhoWeArePage() {
  return (
    <ContentPage
      eyebrow="About"
      title="Who We Are"
      lede="Zevooria is a small fragrance house with a clear mandate: compose with intention, sell with honesty, and deliver with care."
    >
      <section className={styles.section}>
        <h2>The house</h2>
        <p>
          We are builders and curators of perfume — not a marketplace of
          everything. Our catalog stays focused so every product earns its place
          on the shelf and in the bag.
        </p>
      </section>

      <section className={styles.section}>
        <h2>How we work</h2>
        <ul>
          <li>Product decisions stay close to the brand — quality before volume.</li>
          <li>Orders are fulfilled from our inventory with tracked courier delivery.</li>
          <li>
            Customers can reach us directly at{' '}
            <a href="mailto:support@zevooria.com">support@zevooria.com</a>.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Where we serve</h2>
        <p>
          We ship across Pakistan. Delivery charges depend on city — Karachi is
          PKR 250; other cities are PKR 500 — and are confirmed at checkout before
          you place a cash-on-delivery order.
        </p>
      </section>

      <section className={styles.section}>
        <div className={styles.actions}>
          <Link href="/what-we-do" className={styles.primaryLink}>
            What we do
          </Link>
          <Link href="/our-story" className={styles.ghostLink}>
            Our story
          </Link>
        </div>
      </section>
    </ContentPage>
  );
}
