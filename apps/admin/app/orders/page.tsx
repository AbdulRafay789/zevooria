'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminShell } from '../../components/admin-shell';
import {
  AdminPagination,
  useClientPagination,
} from '../../components/admin-pagination';
import {
  AdminApiError,
  fetchAdminOrders,
  formatDate,
  formatMoney,
  type AdminOrderListItem,
} from '../../lib/admin-api';
import styles from '../admin.module.css';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const pager = useClientPagination(orders, 20);

  useEffect(() => {
    let cancelled = false;
    fetchAdminOrders()
      .then((result) => {
        if (!cancelled) {
          setOrders(result);
          setLoaded(true);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof AdminApiError
              ? err.message
              : 'Unable to load orders.',
          );
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminShell
      title="Orders"
      lede="All cash-on-delivery orders, newest first."
    >
      {error ? <p className={styles.error}>{error}</p> : null}
      {!loaded && !error ? (
        <p className={styles.lede}>Loading orders…</p>
      ) : null}
      {loaded && orders.length === 0 && !error ? (
        <p className={styles.lede}>No orders yet.</p>
      ) : null}
      {orders.length > 0 ? (
        <>
          <ul className={styles.list}>
            {pager.pageItems.map((order) => (
              <li key={order.id}>
                <Link href={`/orders/${order.id}`} className={styles.row}>
                  <div>
                    <p className={styles.orderNumber}>{order.orderNumber}</p>
                    <p className={styles.meta}>{formatDate(order.createdAt)}</p>
                  </div>
                  <div className={styles.rowMeta}>
                    <span>{order.customerName}</span>
                    <span>{order.status}</span>
                    <span>{order.paymentStatus}</span>
                    <span>
                      {order.itemCount}{' '}
                      {order.itemCount === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <p className={styles.total}>
                    {formatMoney(order.currency, order.total)}
                  </p>
                </Link>
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
      ) : null}
    </AdminShell>
  );
}
