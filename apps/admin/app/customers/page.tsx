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
  fetchAdminCustomers,
  formatDate,
  type AdminCustomerListItem,
} from '../../lib/admin-api';
import styles from '../admin.module.css';

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomerListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pager = useClientPagination(customers, 20);

  useEffect(() => {
    let cancelled = false;
    fetchAdminCustomers()
      .then((result) => {
        if (!cancelled) {
          setCustomers(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof AdminApiError
              ? err.message
              : 'Unable to load customers.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminShell title="Customers" lede="Registered storefront accounts.">
      {error ? <p className={styles.error}>{error}</p> : null}
      {loading ? <p className={styles.lede}>Loading customers…</p> : null}
      {!loading && !error && customers.length === 0 ? (
        <p className={styles.lede}>No customers yet.</p>
      ) : null}
      {customers.length > 0 ? (
        <>
          <ul className={styles.list}>
            {pager.pageItems.map((customer) => (
              <li key={customer.id}>
                <Link
                  href={`/customers/${customer.id}`}
                  className={styles.row}
                >
                  <div>
                    <p className={styles.orderNumber}>{customer.fullName}</p>
                    <p className={styles.meta}>{customer.email}</p>
                  </div>
                  <div className={styles.rowMeta}>
                    <span>
                      {customer.deletedAt
                        ? 'deleted'
                        : customer.isActive
                          ? 'active'
                          : 'inactive'}
                    </span>
                    <span>{formatDate(customer.createdAt)}</span>
                  </div>
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
