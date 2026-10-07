import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '../../components/content-page';
import styles from '../../components/content-page.module.css';

export const metadata: Metadata = {
  title: 'Returns & Exchanges — Zevooria',
  description:
    'Zevooria return window, process, and downloadable return form for support@zevooria.com.',
};

const FORM_PREVIEW = `ZEVOORIA — RETURN / EXCHANGE FORM

Email completed form to: support@zevooria.com
Subject: Return request — [Order number]

1. Customer details (name, email, phone, city)
2. Order number and date
3. Item(s), quantity, and reason
4. Store credit  OR  bank transfer details
5. Signature and date`;

export default function ReturnsPage() {
  const mailto = `mailto:support@zevooria.com?subject=${encodeURIComponent(
    'Return request — [Order number]',
  )}&body=${encodeURIComponent(
    'Please find my completed Zevooria return form attached (or pasted below).\n\nOrder number:\n\n',
  )}`;

  return (
    <ContentPage
      eyebrow="Legal"
      title="Returns & Exchanges"
      lede="A clear path if something is not right — within 7–14 days of delivery."
    >
      <section className={styles.section}>
        <h2>Eligibility</h2>
        <ul>
          <li>
            Requests must be raised within <strong>7–14 days</strong> of delivery.
          </li>
          <li>
            Both unused sealed items and opened products may be considered —
            include photos and a clear reason.
          </li>
          <li>
            Please include the order number and product name(s) in your request.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Who pays return shipping?</h2>
        <p>
          The customer arranges and pays return shipping via a traceable courier
          or registered post. Original outbound delivery charges are not refunded.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Refund options</h2>
        <ul>
          <li>
            <strong>Store credit</strong> for a future Zevooria purchase, or
          </li>
          <li>
            <strong>Bank transfer</strong> to an account you nominate on the return
            form.
          </li>
        </ul>
        <p>
          Once we receive and inspect the return, eligible refunds are typically
          processed within several working days. We will confirm by email.
        </p>
      </section>

      <section className={styles.section}>
        <h2>How to return</h2>
        <ol>
          <li>Download and complete the Zevooria return form.</li>
          <li>
            Email the form (and photos if helpful) to{' '}
            <a href="mailto:support@zevooria.com">support@zevooria.com</a>.
          </li>
          <li>
            Wait for confirmation of the return address / next steps from support.
          </li>
          <li>
            Pack the item securely, include a copy of the form, and ship with a
            tracking number.
          </li>
        </ol>
      </section>

      <section className={styles.section}>
        <h2>Return form</h2>
        <p>
          Download the form, fill it in, and email it to support. You can also
          open a pre-filled email draft.
        </p>
        <div className={styles.actions}>
          <a
            className={styles.primaryLink}
            href="/forms/zevooria-return-form.txt"
            download="zevooria-return-form.txt"
          >
            Download return form
          </a>
          <a className={styles.ghostLink} href={mailto}>
            Email support@zevooria.com
          </a>
        </div>
        <div className={styles.formPreview} aria-hidden="true">
          <h3>Form outline</h3>
          <pre>{FORM_PREVIEW}</pre>
        </div>
        <p className={styles.note}>
          Tip: after downloading, print to PDF from your editor if you prefer a
          PDF attachment.
        </p>
      </section>

      <section className={styles.section}>
        <div className={styles.actions}>
          <Link href="/faqs" className={styles.ghostLink}>
            FAQs
          </Link>
          <Link href="/shipping" className={styles.ghostLink}>
            Shipping details
          </Link>
        </div>
      </section>
    </ContentPage>
  );
}
