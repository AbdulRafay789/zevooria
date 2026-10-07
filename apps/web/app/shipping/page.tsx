import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '../../components/content-page';
import styles from '../../components/content-page.module.css';

export const metadata: Metadata = {
  title: 'Shipping Details — Zevooria',
  description: 'Zevooria delivery charges, timelines, and cash-on-delivery rules.',
};

export default function ShippingPage() {
  return (
    <ContentPage
      eyebrow="Services"
      title="Shipping Details"
      lede="Transparent delivery for cash-on-delivery orders across Pakistan."
    >
      <section className={styles.section}>
        <h2>Delivery charges</h2>
        <ul>
          <li>
            <strong>Karachi — PKR 250</strong>
          </li>
          <li>
            <strong>All other cities — PKR 500</strong>
          </li>
        </ul>
        <p>
          Charges are calculated from the city you select at checkout and are
          included in your net total before you place the order.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Coverage &amp; timelines</h2>
        <ul>
          <li>We deliver across serviceable cities in Pakistan.</li>
          <li>
            Typical delivery is <strong>1–5 working days</strong> after dispatch
            (no routine Sunday delivery). Busy seasons may take longer.
          </li>
          <li>
            Orders are packed from available inventory and handed to a registered
            courier partner.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Cash on delivery</h2>
        <p>
          Payment is collected by the courier when your order arrives. Please keep
          the correct amount ready. If a delivery attempt fails, the courier may
          retry according to their local schedule — contact{' '}
          <a href="mailto:support@zevooria.com">support@zevooria.com</a> if you
          need help coordinating.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Addresses</h2>
        <p>
          Provide a complete address, phone number, and city so the courier can
          reach you. You can save addresses in your Zevooria account for faster
          checkout.
        </p>
      </section>

      <section className={styles.section}>
        <div className={styles.actions}>
          <Link href="/collection" className={styles.primaryLink}>
            Continue shopping
          </Link>
          <Link href="/faqs" className={styles.ghostLink}>
            FAQs
          </Link>
        </div>
      </section>
    </ContentPage>
  );
}
