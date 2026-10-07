import type { ReactNode } from 'react';
import Link from 'next/link';

export type FaqItem = {
  q: string;
  a: ReactNode;
};

export const ZEVOORIA_FAQS: FaqItem[] = [
  {
    q: 'How will you deliver my order?',
    a: (
      <>
        Orders are delivered through a registered courier service to the shipping
        address you provide at checkout. For cash-on-delivery orders, the courier
        collects payment when the parcel is handed over.
      </>
    ),
  },
  {
    q: 'How much is delivery?',
    a: (
      <>
        Delivery is <strong>PKR 250</strong> for Karachi and{' '}
        <strong>PKR 500</strong> for other cities. Charges appear in your order
        summary once you select a city. See{' '}
        <Link href="/shipping">shipping details</Link>.
      </>
    ),
  },
  {
    q: 'What payment methods do you accept?',
    a: (
      <>
        This release supports <strong>cash on delivery</strong> only. Online
        payment options may be added later.
      </>
    ),
  },
  {
    q: 'Can I open a COD package before paying the courier?',
    a: (
      <>
        Couriers typically require payment on delivery for COD parcels. If you
        have a concern after receiving the order, contact{' '}
        <a href="mailto:support@zevooria.com">support@zevooria.com</a> promptly
        with your order number and photos.
      </>
    ),
  },
  {
    q: 'How do returns and exchanges work?',
    a: (
      <>
        Eligible items may be returned or exchanged within{' '}
        <strong>7–14 days</strong> of delivery. You arrange and pay return
        shipping. Refunds are offered as bank transfer or store credit. Download
        the return form on our <Link href="/returns">returns page</Link> and
        email it to support.
      </>
    ),
  },
  {
    q: 'How long does delivery take?',
    a: (
      <>
        Most orders arrive within <strong>1–5 working days</strong> after
        dispatch, depending on your city and courier schedules. Sundays and
        national holidays may delay processing.
      </>
    ),
  },
  {
    q: 'How do I contact Zevooria?',
    a: (
      <>
        Email <a href="mailto:support@zevooria.com">support@zevooria.com</a>{' '}
        with your order number (if you have one). We also publish policy pages
        for <Link href="/privacy-policy">privacy</Link>,{' '}
        <Link href="/shipping">shipping</Link>, and{' '}
        <Link href="/returns">returns</Link>.
      </>
    ),
  },
  {
    q: 'Do you ship outside Pakistan?',
    a: <>At this time Zevooria ships within Pakistan only.</>,
  },
];
