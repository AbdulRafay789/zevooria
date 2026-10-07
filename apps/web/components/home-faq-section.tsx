import Link from 'next/link';
import { ZEVOORIA_FAQS } from '../lib/faqs';
import styles from '../app/page.module.css';

export function HomeFaqSection() {
  return (
    <section
      id="faqs"
      className={styles.faqSection}
      aria-labelledby="home-faq-heading"
    >
      <div className={styles.faqHead}>
        <p className={styles.sectionEyebrow}>Help</p>
        <h2 id="home-faq-heading" className={styles.faqTitle}>
          Frequently asked questions
        </h2>
        <p className={styles.faqLede}>
          Clear answers on ordering, delivery, and returns — so every purchase
          feels confident.
        </p>
      </div>

      <div className={styles.faqList}>
        {ZEVOORIA_FAQS.map((item) => (
          <details key={item.q} className={styles.faqItem}>
            <summary>{item.q}</summary>
            <div className={styles.faqAnswer}>{item.a}</div>
          </details>
        ))}
      </div>

      <p className={styles.faqMore}>
        Need more detail?{' '}
        <Link href="/faqs" className={styles.inlineLink}>
          View all FAQs
        </Link>
      </p>
    </section>
  );
}
