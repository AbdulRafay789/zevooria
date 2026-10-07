import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '../../components/content-page';
import styles from '../../components/content-page.module.css';

export const metadata: Metadata = {
  title: 'What We Do — Zevooria',
  description: 'How Zevooria designs, sells, and delivers fragrances.',
};

export default function WhatWeDoPage() {
  return (
    <ContentPage
      eyebrow="About"
      title="What We Do"
      lede="From composition to courier — the work behind every Zevooria order."
    >
      <section className={styles.section}>
        <h2>Compose</h2>
        <p>
          We curate and present fragrances with a deliberate point of view. The
          storefront is designed to feel calm and clear: fewer distractions, more
          attention on the scent and the story.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Sell with clarity</h2>
        <p>
          Prices are shown in Pakistani Rupees. Delivery charges appear when you
          select your city. Checkout is cash on delivery for this release — you
          pay when the parcel arrives.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Fulfil &amp; deliver</h2>
        <ul>
          <li>Orders are packed from available inventory.</li>
          <li>Parcels move through registered courier partners across Pakistan.</li>
          <li>
            Support helps with tracking questions, returns, and exchanges via{' '}
            <a href="mailto:support@zevooria.com">support@zevooria.com</a>.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Stand behind the purchase</h2>
        <p>
          If something is wrong with an order, we want to know. Our{' '}
          <Link href="/returns">returns process</Link> covers eligible items within
          7–14 days of delivery. See also{' '}
          <Link href="/shipping">shipping details</Link> and{' '}
          <Link href="/faqs">FAQs</Link>.
        </p>
      </section>

      <section className={styles.section}>
        <div className={styles.actions}>
          <Link href="/collection" className={styles.primaryLink}>
            Shop the collection
          </Link>
          <Link href="/who-we-are" className={styles.ghostLink}>
            Who we are
          </Link>
        </div>
      </section>
    </ContentPage>
  );
}
