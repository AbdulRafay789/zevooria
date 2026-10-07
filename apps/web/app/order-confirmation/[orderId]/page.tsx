'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../components/auth-provider';
import { useCart } from '../../../components/cart-provider';
import { RequireAuth } from '../../../components/require-auth';
import { formatProductPrice } from '../../../lib/catalog';
import {
  CommerceApiError,
  fetchOrder,
  type OrderConfirmation,
} from '../../../lib/commerce-api';
import {
  formatPaymentStatus,
  formatOrderStatus,
} from '../../../lib/form-validation';
import styles from '../../auth-forms.module.css';

function OrderConfirmationContent() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const { ready, user } = useAuth();
  const { addProduct } = useCart();
  const [order, setOrder] = useState<OrderConfirmation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    if (!ready || !user || !params.orderId) {
      return;
    }
    let cancelled = false;
    fetchOrder(params.orderId)
      .then((result) => {
        if (!cancelled) {
          setOrder(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof CommerceApiError
              ? err.message
              : 'Unable to load this order.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ready, user, params.orderId]);

  function onReorder() {
    if (!order || reordering) {
      return;
    }
    const lines = order.items.filter(
      (item): item is typeof item & { productId: string } =>
        Boolean(item.productId) && Boolean(item.productSlug),
    );
    if (lines.length === 0) {
      setError('This order has no products available to reorder.');
      return;
    }
    setReordering(true);
    for (const item of lines) {
      addProduct(
        { id: item.productId, slug: item.productSlug },
        item.quantity,
      );
    }
    router.push('/cart');
  }

  return (
    <div className={styles.page}>
      <main className={`${styles.main} ${styles.wide}`}>
        <p className={styles.eyebrow}>Order</p>
        <h1 className={styles.title}>Order confirmed</h1>

        {!error && !order ? (
          <p className={styles.lede}>Loading confirmation…</p>
        ) : null}

        {error ? <p className={styles.error}>{error}</p> : null}

        {order ? (
          <>
            <p className={styles.lede}>
              Thank you, {order.customerName}. Your cash-on-delivery order has
              been placed.
            </p>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Details</h2>
              <div className={styles.summaryLine}>
                <span>Order number</span>
                <strong>{order.orderNumber}</strong>
              </div>
              <div className={styles.summaryLine}>
                <span>Payment</span>
                <span>
                  Cash on Delivery (
                  {formatPaymentStatus(order.paymentStatus, order.paymentMethod)}
                  )
                </span>
              </div>
              <div className={styles.summaryLine}>
                <span>Status</span>
                <span>{formatOrderStatus(order.status)}</span>
              </div>
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Items</h2>
              {order.items.map((item) => (
                <div key={item.id} className={styles.summaryLine}>
                  <span>
                    {item.productName} × {item.quantity}
                  </span>
                  <span>
                    {formatProductPrice(order.currency, item.lineTotal)}
                  </span>
                </div>
              ))}
              <div className={styles.summaryLine}>
                <span>Subtotal (exclusive)</span>
                <span>{formatProductPrice(order.currency, order.subtotal)}</span>
              </div>
              <div className={styles.summaryLine}>
                <span>Delivery charges</span>
                <span>
                  {formatProductPrice(order.currency, order.shippingAmount)}
                </span>
              </div>
              <div className={styles.summaryLine}>
                <span>Net total</span>
                <strong>
                  {formatProductPrice(order.currency, order.total)}
                </strong>
              </div>
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Shipping address</h2>
              <p className={styles.note}>
                {order.shippingAddress.line1}
                {order.shippingAddress.line2
                  ? `, ${order.shippingAddress.line2}`
                  : ''}
                <br />
                {order.shippingAddress.city} {order.shippingAddress.postalCode}
                <br />
                {order.shippingAddress.country}
              </p>
            </div>

            <div className={styles.actionRow}>
              <button
                type="button"
                className={styles.submit}
                disabled={reordering}
                onClick={() => {
                  onReorder();
                }}
              >
                {reordering ? 'Adding…' : 'Reorder'}
              </button>
              <Link href="/account/orders" className={styles.secondaryLink}>
                View my orders
              </Link>
            </div>

            <p className={styles.alt}>
              <Link href="/collection">Continue shopping</Link>
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}

export default function OrderConfirmationPage() {
  const params = useParams<{ orderId: string }>();
  return (
    <RequireAuth next={`/order-confirmation/${params.orderId ?? ''}`}>
      <OrderConfirmationContent />
    </RequireAuth>
  );
}
