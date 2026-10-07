'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AccountShell } from '../../account-shell';
import { useCart } from '../../../../components/cart-provider';
import {
  formatProductPrice,
  storageKeyToPublicUrl,
} from '../../../../lib/catalog';
import {
  CommerceApiError,
  cancelOrder,
  fetchOrder,
  fetchReviewProducts,
  type OrderConfirmation,
  type ReviewableProduct,
} from '../../../../lib/commerce-api';
import {
  formatOrderDate,
  formatOrderStatus,
  formatPaymentMethod,
  formatPaymentStatus,
} from '../../../../lib/form-validation';
import styles from '../../account.module.css';

function stars(rating: number): string {
  return '★★★★★'.slice(0, Math.max(0, Math.min(5, rating)));
}

function canReorder(status: string): boolean {
  return (
    status === 'placed' ||
    status === 'processing' ||
    status === 'shipped' ||
    status === 'delivered'
  );
}

export default function AccountOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const { addProduct } = useCart();
  const [order, setOrder] = useState<OrderConfirmation | null>(null);
  const [reviews, setReviews] = useState<ReviewableProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    if (!params.orderId) {
      return;
    }
    let cancelled = false;
    Promise.all([
      fetchOrder(params.orderId),
      fetchReviewProducts(params.orderId).catch(() => ({
        orderId: params.orderId,
        products: [] as ReviewableProduct[],
      })),
    ])
      .then(([orderResult, reviewResult]) => {
        if (!cancelled) {
          setOrder(orderResult);
          setReviews(reviewResult.products);
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
  }, [params.orderId]);

  async function onCancel() {
    if (!order || cancelling) {
      return;
    }
    if (!window.confirm('Cancel this order? Stock will be restored.')) {
      return;
    }
    setCancelling(true);
    setError(null);
    try {
      const updated = await cancelOrder(order.id);
      setOrder(updated);
    } catch (err: unknown) {
      setError(
        err instanceof CommerceApiError
          ? err.message
          : 'Unable to cancel this order.',
      );
    } finally {
      setCancelling(false);
    }
  }

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
    setError(null);
    for (const item of lines) {
      addProduct(
        { id: item.productId, slug: item.productSlug },
        item.quantity,
      );
    }
    router.push('/cart');
  }

  const reviewMap = new Map(
    (reviews ?? []).map((product) => [product.productId, product]),
  );

  return (
    <AccountShell title="Order details" eyebrow="Account">
      {error ? <p className={styles.error}>{error}</p> : null}

      {order ? (
        <>
          <header className={styles.detailHeader}>
            <p className={styles.orderEyebrow}>Order</p>
            <p className={styles.orderNumber}>{order.orderNumber}</p>
            <p className={styles.orderDate}>
              Placed {formatOrderDate(order.createdAt)}
            </p>
            <p className={styles.orderMetaLine}>
              <span>{formatOrderStatus(order.status)}</span>
              <span className={styles.metaDot} aria-hidden>
                ·
              </span>
              <span>{formatPaymentMethod(order.paymentMethod)}</span>
              <span className={styles.metaDot} aria-hidden>
                ·
              </span>
              <span>
                Payment{' '}
                {formatPaymentStatus(order.paymentStatus, order.paymentMethod)}
              </span>
            </p>
          </header>

          <section className={styles.section} aria-labelledby="products-heading">
            <h2 id="products-heading" className={styles.sectionTitle}>
              Products
            </h2>
            <div className={styles.productList}>
              {order.items.map((item) => {
                const reviewInfo = item.productId
                  ? reviewMap.get(item.productId)
                  : undefined;
                const submitted = reviewInfo?.review ?? null;
                return (
                  <article key={item.id} className={styles.productBlock}>
                    <Link
                      href={`/products/${item.productSlug}`}
                      className={styles.productRow}
                    >
                      {item.imageKey ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          className={styles.productImage}
                          src={storageKeyToPublicUrl(item.imageKey)}
                          alt=""
                        />
                      ) : (
                        <span className={styles.thumbPlaceholder} />
                      )}
                      <div className={styles.productMeta}>
                        <p className={styles.productName}>{item.productName}</p>
                        <p className={styles.productDetail}>
                          Qty {item.quantity} ·{' '}
                          {formatProductPrice(order.currency, item.unitPrice)}{' '}
                          each
                        </p>
                        <p className={styles.productLineTotal}>
                          {formatProductPrice(order.currency, item.lineTotal)}
                        </p>
                      </div>
                    </Link>
                    {submitted ? (
                      <div className={styles.submittedReview}>
                        <p
                          className={styles.reviewStars}
                          aria-label={`${submitted.rating} out of 5 stars`}
                        >
                          {stars(submitted.rating)}
                        </p>
                        <p className={styles.reviewQuote}>
                          &ldquo;{submitted.body}&rdquo;
                        </p>
                        <p className={styles.reviewStatus}>Review submitted</p>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>

            <div className={styles.totals}>
              <div className={styles.summaryLine}>
                <span>Subtotal (exclusive)</span>
                <span>
                  {formatProductPrice(order.currency, order.subtotal)}
                </span>
              </div>
              <div className={styles.summaryLine}>
                <span>Delivery charges</span>
                <span>
                  {formatProductPrice(order.currency, order.shippingAmount)}
                </span>
              </div>
              <div className={`${styles.summaryLine} ${styles.summaryTotal}`}>
                <span>Net total</span>
                <strong>
                  {formatProductPrice(order.currency, order.total)}
                </strong>
              </div>
            </div>
          </section>

          <div className={styles.detailColumns}>
            <section
              className={styles.section}
              aria-labelledby="delivery-heading"
            >
              <h2 id="delivery-heading" className={styles.sectionTitle}>
                Delivery
              </h2>
              <p className={styles.addressBlock}>
                {order.shippingAddress.line1}
                {order.shippingAddress.line2
                  ? `, ${order.shippingAddress.line2}`
                  : ''}
                <br />
                {order.shippingAddress.city} {order.shippingAddress.postalCode}
                <br />
                {order.shippingAddress.country}
              </p>
            </section>

            <section
              className={styles.section}
              aria-labelledby="payment-heading"
            >
              <h2 id="payment-heading" className={styles.sectionTitle}>
                Payment
              </h2>
              <div className={styles.summaryLine}>
                <span>Method</span>
                <span>{formatPaymentMethod(order.paymentMethod)}</span>
              </div>
              <div className={styles.summaryLine}>
                <span>Status</span>
                <span>
                  {formatPaymentStatus(order.paymentStatus, order.paymentMethod)}
                </span>
              </div>
            </section>
          </div>

          {(order.statusHistory?.length ?? 0) > 0 ? (
            <section
              className={styles.section}
              aria-labelledby="history-heading"
            >
              <h2 id="history-heading" className={styles.sectionTitle}>
                Status history
              </h2>
              <ul className={styles.addressList}>
                {order.statusHistory?.map((entry) => (
                  <li key={entry.id} className={styles.meta}>
                    {formatOrderDate(entry.createdAt)} ·{' '}
                    {entry.fromStatus
                      ? `${formatOrderStatus(entry.fromStatus)} → `
                      : ''}
                    {formatOrderStatus(entry.toStatus)}
                    {entry.note ? ` · ${entry.note}` : ''}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className={styles.actions}>
            {canReorder(order.status) ? (
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={reordering}
                onClick={() => {
                  onReorder();
                }}
              >
                {reordering ? 'Adding…' : 'Reorder'}
              </button>
            ) : null}
            {order.canCancel ? (
              <button
                type="button"
                className={styles.ghostBtn}
                disabled={cancelling}
                onClick={() => {
                  void onCancel();
                }}
              >
                {cancelling ? 'Cancelling…' : 'Cancel order'}
              </button>
            ) : null}
            <Link href="/collection" className={styles.ghostBtn}>
              Continue shopping
            </Link>
            <Link href="/account/orders" className={styles.ghostBtn}>
              Back to my orders
            </Link>
          </div>
        </>
      ) : !error ? (
        <p className={styles.lede}>Loading order…</p>
      ) : null}
    </AccountShell>
  );
}
