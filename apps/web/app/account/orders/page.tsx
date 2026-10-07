'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AccountShell } from '../account-shell';
import {
  formatProductPrice,
  storageKeyToPublicUrl,
} from '../../../lib/catalog';
import {
  CommerceApiError,
  fetchOrders,
  type OrderListItem,
} from '../../../lib/commerce-api';
import {
  formatOrderDate,
  formatOrderStatus,
  formatPaymentMethod,
  formatPaymentStatus,
} from '../../../lib/form-validation';
import styles from '../account.module.css';

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<OrderListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOrders()
      .then((result) => {
        if (!cancelled) {
          setOrders(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof CommerceApiError
              ? err.message
              : 'Unable to load your orders.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AccountShell
      title="My orders"
      lede="Your Zevooria cash-on-delivery orders, newest first."
    >
      {error ? <p className={styles.error}>{error}</p> : null}

      {orders && orders.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.lede}>You haven&apos;t placed any orders yet.</p>
          <Link href="/collection" className={styles.primaryBtn}>
            Continue shopping
          </Link>
        </div>
      ) : null}

      {orders && orders.length > 0 ? (
        <ul className={styles.list}>
          {orders.map((order) => (
            <li key={order.id} className={styles.orderItem}>
              <Link
                href={`/account/orders/${order.id}`}
                className={styles.orderCard}
              >
                <div className={styles.orderMain}>
                  <div className={styles.orderHeader}>
                    <div>
                      <p className={styles.orderEyebrow}>Order</p>
                      <p className={styles.orderNumber}>{order.orderNumber}</p>
                    </div>
                    <p className={styles.orderDate}>
                      {formatOrderDate(order.createdAt)}
                    </p>
                  </div>

                  <p className={styles.orderMetaLine}>
                    <span>{formatOrderStatus(order.status)}</span>
                    <span className={styles.metaDot} aria-hidden>
                      ·
                    </span>
                    <span>{formatPaymentMethod(order.paymentMethod)}</span>
                    {order.paymentStatus ? (
                      <>
                        <span className={styles.metaDot} aria-hidden>
                          ·
                        </span>
                        <span>
                          {formatPaymentStatus(
                            order.paymentStatus,
                            order.paymentMethod,
                          )}
                        </span>
                      </>
                    ) : null}
                  </p>

                  <div className={styles.orderFooter}>
                    <p className={styles.total}>
                      {formatProductPrice(order.currency, order.total)}
                    </p>
                    <p className={styles.itemCount}>
                      {order.itemCount}{' '}
                      {order.itemCount === 1 ? 'item' : 'items'}
                    </p>
                  </div>

                  <div className={styles.thumbStrip} aria-hidden>
                    {order.itemsSummary.slice(0, 4).map((item, index) =>
                      item.imageKey ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={`${order.id}-${index}`}
                          className={styles.thumb}
                          src={storageKeyToPublicUrl(item.imageKey)}
                          alt=""
                        />
                      ) : (
                        <span
                          key={`${order.id}-${index}`}
                          className={styles.thumbPlaceholder}
                        />
                      ),
                    )}
                  </div>
                </div>

                <span className={styles.viewOrder}>View order</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {!orders && !error ? (
        <p className={styles.lede}>Loading orders…</p>
      ) : null}
    </AccountShell>
  );
}
