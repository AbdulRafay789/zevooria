import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '../../components/content-page';
import styles from '../../components/content-page.module.css';

export const metadata: Metadata = {
  title: 'Our Story — Zevooria',
  description: 'The story of Zevooria — a dark, deliberate fragrance house.',
};

export default function OurStoryPage() {
  return (
    <ContentPage
      eyebrow="About"
      title="Our Story"
      lede="Zevooria began as a quiet idea: perfume should feel composed — dark, deliberate, and finished with restraint."
    >
      <section className={styles.section}>
        <h2>A house for presence</h2>
        <p>
          We build fragrances for people who want presence without noise. Each
          composition is chosen carefully, presented simply, and shipped with the
          same attention we give the bottle itself.
        </p>
      </section>

      <section className={styles.section}>
        <h2>From idea to doorstep</h2>
        <p>
          Zevooria is a Pakistan-first fragrance house. Customers discover the
          collection online, place cash-on-delivery orders, and receive carefully
          packed parcels through registered courier partners across the country.
        </p>
      </section>

      <section className={styles.section}>
        <h2>What guides us</h2>
        <ul>
          <li>Clarity over clutter — one strong idea per fragrance.</li>
          <li>Honest commerce — prices and delivery charges shown before you order.</li>
          <li>Respect for the customer — support that answers, returns that are fair.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <div className={styles.actions}>
          <Link href="/collection" className={styles.primaryLink}>
            Explore the collection
          </Link>
          <Link href="/who-we-are" className={styles.ghostLink}>
            Who we are
          </Link>
        </div>
      </section>
    </ContentPage>
  );
}
