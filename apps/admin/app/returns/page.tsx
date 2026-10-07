'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { AdminShell } from '../../components/admin-shell';
import {
  AdminPagination,
  useClientPagination,
} from '../../components/admin-pagination';
import {
  AdminApiError,
  createAdminReturn,
  fetchAdminOrder,
  fetchAdminReturns,
  formatMoney,
  inspectAdminReturn,
  markAdminReturnRefunded,
  type AdminOrderDetail,
  type AdminReturn,
} from '../../lib/admin-api';
import styles from '../admin.module.css';

export default function AdminReturnsPage() {
  const [rows, setRows] = useState<AdminReturn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [reason, setReason] = useState('');
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const pager = useClientPagination(rows, 15);

  async function reload() {
    const list = await fetchAdminReturns();
    setRows(list);
  }

  useEffect(() => {
    reload().catch((err: unknown) =>
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to load returns.',
      ),
    );
  }, []);

  async function loadOrder(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setOrder(null);
    if (!orderId.trim()) {
      setError('Enter an order id (UUID).');
      return;
    }
    setPending(true);
    try {
      const detail = await fetchAdminOrder(orderId.trim());
      setOrder(detail);
      const next: Record<string, string> = {};
      for (const item of detail.items) {
        next[item.id] = '';
      }
      setQtys(next);
      if (detail.status !== 'delivered') {
        setError('Only delivered orders can be returned.');
      }
    } catch (err: unknown) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to load order.',
      );
    } finally {
      setPending(false);
    }
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!order) {
      return;
    }
    const items = Object.entries(qtys)
      .map(([orderItemId, raw]) => ({
        orderItemId,
        quantity: Number(raw),
      }))
      .filter((row) => Number.isInteger(row.quantity) && row.quantity > 0);
    if (items.length === 0) {
      setError('Select at least one line quantity to return.');
      return;
    }
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createAdminReturn({
        orderId: order.id,
        reason: reason.trim() || undefined,
        items,
      });
      setNotice(`Return created for ${created.orderNumber ?? order.orderNumber}.`);
      setOrder(null);
      setReason('');
      setOrderId('');
      await reload();
    } catch (err: unknown) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to create return.',
      );
    } finally {
      setPending(false);
    }
  }

  async function onInspect(id: string) {
    setPending(true);
    setError(null);
    try {
      await inspectAdminReturn(id);
      setNotice('Inspected and restocked. Refunds Payable journal posted.');
      await reload();
    } catch (err: unknown) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to inspect return.',
      );
    } finally {
      setPending(false);
    }
  }

  async function onMarkPaid(id: string) {
    setPending(true);
    setError(null);
    try {
      await markAdminReturnRefunded(id);
      setNotice('Bank refund marked paid.');
      await reload();
    } catch (err: unknown) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to mark refund paid.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AdminShell
      title="Returns"
      lede="Admin-created returns for delivered orders (within 14 days of delivery). Inspect restocks inventory and posts Sales → Refunds Payable; mark paid clears Refunds Payable via Bank. Shipping is never refunded."
    >
      {error ? <p className={styles.error}>{error}</p> : null}
      {notice ? <p className={styles.success}>{notice}</p> : null}

      <form className={styles.formWide} onSubmit={loadOrder}>
        <h2 className={styles.sectionTitle}>Load delivered order</h2>
        <label className={styles.field}>
          <span>Order ID (UUID)</span>
          <input
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            placeholder="From order detail URL"
            required
          />
        </label>
        <button type="submit" className={styles.primaryBtn} disabled={pending}>
          {pending ? 'Loading…' : 'Load order'}
        </button>
      </form>

      {order ? (
        <form className={styles.formWide} onSubmit={onCreate}>
          <h2 className={styles.sectionTitle}>
            Return lines — {order.orderNumber} ({order.status})
          </h2>
          <p className={styles.meta}>
            <Link href={`/orders/${order.id}`}>Open order</Link>
          </p>
          <ul className={styles.list}>
            {order.items.map((item) => (
              <li key={item.id} className={styles.productRow}>
                <div>
                  <p className={styles.orderNumber}>{item.productName}</p>
                  <p className={styles.meta}>
                    Ordered {item.quantity} ·{' '}
                    {formatMoney(order.currency, item.unitPrice)} each
                  </p>
                </div>
                <label className={styles.field}>
                  <span>Return qty</span>
                  <input
                    inputMode="numeric"
                    value={qtys[item.id] ?? ''}
                    onChange={(event) =>
                      setQtys((prev) => ({
                        ...prev,
                        [item.id]: event.target.value.replace(/[^\d]/g, ''),
                      }))
                    }
                    placeholder={`0–${item.quantity}`}
                  />
                </label>
              </li>
            ))}
          </ul>
          <label className={styles.field}>
            <span>Reason (optional)</span>
            <textarea
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className={styles.primaryBtn}
            disabled={pending || order.status !== 'delivered'}
          >
            {pending ? 'Saving…' : 'Create return'}
          </button>
        </form>
      ) : null}

      <section className={styles.panelCard} style={{ marginTop: '1.5rem' }}>
        <h2 className={styles.sectionTitle}>Recent returns</h2>
        {rows.length === 0 ? (
          <p className={styles.lede}>No returns yet.</p>
        ) : (
          <>
            <ul className={styles.list}>
              {pager.pageItems.map((row) => (
                <li key={row.id} className={styles.panelCard}>
                  <p className={styles.orderNumber}>
                    {row.orderNumber ?? row.orderId} · {row.status}
                  </p>
                  <p className={styles.meta}>
                    Refund {formatMoney('PKR', row.refundAmount)} ·{' '}
                    {row.items
                      .map((item) => `${item.productName} ×${item.quantity}`)
                      .join(', ')}
                  </p>
                  {row.reason ? <p className={styles.meta}>{row.reason}</p> : null}
                  <div className={styles.inlineForm}>
                    {row.status === 'pending_inspect' ? (
                      <button
                        type="button"
                        className={styles.primaryBtn}
                        disabled={pending}
                        onClick={() => {
                          void onInspect(row.id);
                        }}
                      >
                        Inspect &amp; restock
                      </button>
                    ) : null}
                    {row.status === 'inspected' ? (
                      <button
                        type="button"
                        className={styles.primaryBtn}
                        disabled={pending}
                        onClick={() => {
                          void onMarkPaid(row.id);
                        }}
                      >
                        Mark bank refund paid
                      </button>
                    ) : null}
                    <Link href={`/orders/${row.orderId}`} className={styles.ghostBtn}>
                      Order
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
            <AdminPagination
              page={pager.page}
              totalPages={pager.totalPages}
              total={pager.total}
              pageSize={pager.pageSize}
              onPageChange={pager.setPage}
            />
          </>
        )}
      </section>
    </AdminShell>
  );
}
