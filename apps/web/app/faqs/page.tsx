import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '../../components/content-page';
import styles from '../../components/content-page.module.css';
import { ZEVOORIA_FAQS } from '../../lib/faqs';

export const metadata: Metadata = {
  title: 'FAQs — Zevooria',
  description:
    'Answers to common questions about Zevooria orders, delivery, and returns.',
};

export default function FaqsPage() {
  return (
    <ContentPage
      eyebrow="Help"
      title="FAQs"
      lede="Quick answers about ordering, delivery, and returns. Need something else? Email support@zevooria.com."
    >
      <div className={styles.faqList}>
        {ZEVOORIA_FAQS.map((item) => (
          <details key={item.q} className={styles.faqItem}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>

      <section className={styles.section}>
        <div className={styles.actions}>
          <Link href="/returns" className={styles.primaryLink}>
            Returns &amp; exchanges
          </Link>
          <Link href="/shipping" className={styles.ghostLink}>
            Shipping details
          </Link>
        </div>
      </section>
    </ContentPage>
  );
}
