'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminShell } from '../../../components/admin-shell';
import {
  AdminApiError,
  deleteAdminOrder,
  fetchAdminOrder,
  formatDate,
  formatMoney,
  updateAdminOrderStatus,
  type AdminOrderDetail,
} from '../../../lib/admin-api';
import styles from '../../admin.module.css';

export default function AdminOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!params.orderId) {
      return;
    }
    let cancelled = false;
    fetchAdminOrder(params.orderId)
      .then((result) => {
        if (!cancelled) {
          setOrder(result);
          setNextStatus(result.allowedNextStatuses[0] ?? '');
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof AdminApiError
              ? err.message
              : 'Unable to load this order.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params.orderId]);

  async function applyStatus() {
    if (!order || !nextStatus) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateAdminOrderStatus(order.id, nextStatus);
      setOrder(updated);
      setNextStatus(updated.allowedNextStatuses[0] ?? '');
    } catch (err: unknown) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to update order status.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function applyDelete() {
    if (!order || order.status === 'cancelled') {
      return;
    }
    const confirmed = window.confirm(
      `Delete order ${order.orderNumber}? This cancels the order, restores inventory, and reverses accounting journals.`,
    );
    if (!confirmed) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const updated = await deleteAdminOrder(order.id);
      setOrder(updated);
      setNextStatus(updated.allowedNextStatuses[0] ?? '');
    } catch (err: unknown) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to delete this order.',
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AdminShell title="Order detail">
      {error ? <p className={styles.error}>{error}</p> : null}
      {!order && !error ? <p className={styles.lede}>Loading order…</p> : null}
      {order ? (
        <>
          <p className={styles.orderNumber}>{order.orderNumber}</p>
          <p className={styles.meta}>
            Placed {formatDate(order.createdAt)} · {order.status} ·{' '}
            {order.paymentMethod} · {order.paymentStatus}
          </p>

          {order.allowedNextStatuses.length > 0 ? (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Update status</h2>
              <div className={styles.inlineForm}>
                <label className={styles.field}>
                  <span>Next status</span>
                  <select
                    value={nextStatus}
                    onChange={(event) => setNextStatus(event.target.value)}
                  >
                    {order.allowedNextStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={saving || !nextStatus}
                  onClick={() => {
                    void applyStatus();
                  }}
                >
                  {saving ? 'Updating…' : 'Apply'}
                </button>
              </div>
            </section>
          ) : (
            <p className={styles.lede}>
              No further status transitions are allowed for this order.
            </p>
          )}

          {order.status !== 'cancelled' ? (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Delete order</h2>
              <p className={styles.meta}>
                Cancels the order, restores inventory, and posts reversing
                journals on the chart of accounts.
              </p>
              <button
                type="button"
                className={styles.dangerBtn}
                disabled={saving || deleting}
                onClick={() => {
                  void applyDelete();
                }}
              >
                {deleting ? 'Deleting…' : 'Delete order'}
              </button>
            </section>
          ) : null}

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Customer</h2>
            <p className={styles.address}>
              {order.customerName}
              <br />
              {order.customerEmail}
              <br />
              {order.customerPhone}
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Products</h2>
            {order.items.map((item) => (
              <article key={item.id} className={styles.product}>
                <p className={styles.productName}>{item.productName}</p>
                <p className={styles.meta}>
                  Qty {item.quantity} ·{' '}
                  {formatMoney(order.currency, item.unitPrice)} each ·{' '}
                  {formatMoney(order.currency, item.lineTotal)}
                </p>
              </article>
            ))}
            <div className={styles.summaryLine}>
              <span>Subtotal</span>
              <span>{formatMoney(order.currency, order.subtotal)}</span>
            </div>
            <div className={styles.summaryLine}>
              <span>Discount</span>
              <span>
                {order.discountApplied ||
                (Number.parseInt(
                  (order.discountAmount ?? '0').split('.')[0] ?? '0',
                  10,
                ) > 0)
                  ? `−${formatMoney(order.currency, order.discountAmount ?? '0')}${
                      order.promoCode ? ` (${order.promoCode})` : ''
                    }`
                  : 'Not applied'}
              </span>
            </div>
            <div className={styles.summaryLine}>
              <span>Shipping</span>
              <span>{formatMoney(order.currency, order.shippingAmount)}</span>
            </div>
            <div className={styles.summaryLine}>
              <span>Total</span>
              <strong>{formatMoney(order.currency, order.total)}</strong>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Delivery</h2>
            <p className={styles.address}>
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

          {(order.statusHistory?.length ?? 0) > 0 ? (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Status history</h2>
              <ul className={styles.list}>
                {order.statusHistory?.map((entry) => (
                  <li key={entry.id} className={styles.meta}>
                    {formatDate(entry.createdAt)} · {entry.actorType}
                    {entry.fromStatus
                      ? ` · ${entry.fromStatus} → ${entry.toStatus}`
                      : ` · ${entry.toStatus}`}
                    {entry.note ? ` · ${entry.note}` : ''}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <Link href="/orders" className={styles.backLink}>
            Back to orders
          </Link>
        </>
      ) : null}
    </AdminShell>
  );
}
