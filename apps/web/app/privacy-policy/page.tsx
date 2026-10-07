import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '../../components/content-page';
import styles from '../../components/content-page.module.css';

export const metadata: Metadata = {
  title: 'Privacy Policy — Zevooria',
  description: 'How Zevooria collects, uses, and protects your information.',
};

export default function PrivacyPolicyPage() {
  return (
    <ContentPage
      eyebrow="Legal"
      title="Privacy Policy"
      lede="This policy explains what Zevooria collects when you browse, create an account, or place a cash-on-delivery order — and how we use that information."
    >
      <section className={styles.section}>
        <h2>Who we are</h2>
        <p>
          Zevooria is a fragrance house selling perfumes online across Pakistan.
          For privacy questions, contact{' '}
          <a href="mailto:support@zevooria.com">support@zevooria.com</a>.
        </p>
      </section>

      <section className={styles.section}>
        <h2>What we collect</h2>
        <ul>
          <li>
            Account details you provide: name, email, phone number, and password
            (stored only as a secure hash).
          </li>
          <li>
            Order and delivery details: shipping address, city, postal code, and
            order history.
          </li>
          <li>
            Technical data needed to run the storefront: session tokens, basic
            device/browser information, and security logs.
          </li>
          <li>
            Messages you send us (for example return requests emailed to support).
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>How we use your information</h2>
        <ul>
          <li>To create and secure your account.</li>
          <li>To process, ship, and support cash-on-delivery orders.</li>
          <li>To send transactional messages such as order and account emails.</li>
          <li>To improve the storefront, prevent fraud, and meet legal duties.</li>
        </ul>
        <p>
          We do not sell your personal information. We do not use your data for
          unrelated marketing without a clear opt-in where required.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Payments</h2>
        <p>
          Zevooria currently offers cash on delivery. Couriers may collect payment
          at the door. We do not store card numbers on Zevooria servers for COD
          orders. If online payment methods are added later, they will be handled
          through dedicated payment providers under their own security standards.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Sharing</h2>
        <p>We share information only when needed to operate the business, including:</p>
        <ul>
          <li>Courier partners, to deliver your order.</li>
          <li>Infrastructure providers that host our website, API, and database.</li>
          <li>Authorities, when required by law.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Retention &amp; security</h2>
        <p>
          We keep account and order records for as long as needed to fulfil orders,
          handle returns, maintain accounting records, and meet legal requirements.
          We use reasonable technical and organisational measures to protect your
          data. No online service is perfectly secure; please use a strong unique
          password for your Zevooria account.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Your choices</h2>
        <ul>
          <li>Update your profile and addresses from your account.</li>
          <li>
            Request access, correction, or deletion of personal data by emailing{' '}
            <a href="mailto:support@zevooria.com">support@zevooria.com</a>.
          </li>
          <li>
            Some records (for example completed orders and accounting entries) may
            need to be retained even after an account is closed.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Cookies &amp; local storage</h2>
        <p>
          The storefront uses local storage for signed-in sessions and your bag.
          Essential cookies or similar technologies may be used for security and
          basic site function. We do not rely on third-party advertising trackers
          for the core shopping experience.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Children</h2>
        <p>
          Zevooria is intended for adults. If you believe we have collected data
          from a minor, contact support and we will review it promptly.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Changes</h2>
        <p>
          We may update this policy as the platform evolves. The latest version
          will always be published on this page. Continued use of Zevooria after
          changes means you accept the updated policy.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Contact</h2>
        <p>
          Privacy requests:{' '}
          <a href="mailto:support@zevooria.com">support@zevooria.com</a>
        </p>
        <p className={styles.note}>
          Related: <Link href="/shipping">Shipping</Link> ·{' '}
          <Link href="/returns">Returns</Link> · <Link href="/faqs">FAQs</Link>
        </p>
      </section>
    </ContentPage>
  );
}
