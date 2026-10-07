'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminShell } from '../../../components/admin-shell';
import {
  AdminApiError,
  fetchAdminCustomer,
  formatDate,
  formatMoney,
  softDeleteAdminCustomer,
  updateAdminCustomerStatus,
  type AdminCustomerDetail,
} from '../../../lib/admin-api';
import styles from '../../admin.module.css';

export default function AdminCustomerDetailPage() {
  const params = useParams<{ customerId: string }>();
  const [customer, setCustomer] = useState<AdminCustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!params.customerId) {
      return;
    }
    let cancelled = false;
    fetchAdminCustomer(params.customerId)
      .then((result) => {
        if (!cancelled) {
          setCustomer(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof AdminApiError
              ? err.message
              : 'Unable to load this customer.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params.customerId]);

  async function setActive(isActive: boolean) {
    if (!customer) {
      return;
    }
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateAdminCustomerStatus(customer.id, isActive);
      setCustomer({ ...customer, ...updated });
      setNotice(
        isActive
          ? customer.deletedAt
            ? 'Account restored. The customer can sign in again.'
            : 'Account reactivated.'
          : 'Account deactivated. The customer cannot sign in.',
      );
    } catch (err: unknown) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to update customer status.',
      );
    } finally {
      setPending(false);
    }
  }

  async function softDelete() {
    if (!customer) {
      return;
    }
    if (
      !window.confirm(
        'Soft-delete this customer? They will not be able to sign in. An admin can restore the account later.',
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await softDeleteAdminCustomer(customer.id);
      setCustomer({ ...customer, ...updated });
      setNotice(
        'Customer soft-deleted. Use Restore account to allow sign-in again.',
      );
    } catch (err: unknown) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to delete customer.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AdminShell title="Customer">
      {error ? <p className={styles.error}>{error}</p> : null}
      {notice ? <p className={styles.lede}>{notice}</p> : null}
      {!customer && !error ? (
        <p className={styles.lede}>Loading customer…</p>
      ) : null}
      {customer ? (
        <>
          <p className={styles.orderNumber}>{customer.fullName}</p>
          <p className={styles.meta}>
            {customer.email}
            {customer.phone ? ` · ${customer.phone}` : ''} · Joined{' '}
            {formatDate(customer.createdAt)}
          </p>
          <p className={styles.lede}>
            Status:{' '}
            {customer.deletedAt
              ? `deleted ${formatDate(customer.deletedAt)}`
              : customer.isActive
                ? 'active'
                : 'deactivated'}
            . Email{' '}
            {customer.emailVerifiedAt
              ? `verified ${formatDate(customer.emailVerifiedAt)}`
              : 'not verified'}
            . {customer.orderCount} order
            {customer.orderCount === 1 ? '' : 's'}.
          </p>

          {customer.deletedAt ? (
            <div className={styles.inlineForm}>
              <p className={styles.lede}>
                This account is soft-deleted. Restoring clears the deletion and
                allows the customer to sign in with the same email.
              </p>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={pending}
                onClick={() => {
                  void setActive(true);
                }}
              >
                Restore account
              </button>
            </div>
          ) : (
            <div className={styles.inlineForm}>
              {customer.isActive ? (
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={pending}
                  onClick={() => {
                    void setActive(false);
                  }}
                >
                  Deactivate
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={pending}
                  onClick={() => {
                    void setActive(true);
                  }}
                >
                  Reactivate
                </button>
              )}
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={pending}
                onClick={() => {
                  void softDelete();
                }}
              >
                Soft-delete
              </button>
            </div>
          )}

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Recent orders</h2>
            {customer.recentOrders.length === 0 ? (
              <p className={styles.lede}>No orders yet.</p>
            ) : (
              <ul className={styles.list}>
                {customer.recentOrders.map((order) => (
                  <li key={order.id}>
                    <Link href={`/orders/${order.id}`} className={styles.row}>
                      <div>
                        <p className={styles.orderNumber}>
                          {order.orderNumber}
                        </p>
                        <p className={styles.meta}>
                          {formatDate(order.createdAt)} · {order.status}
                        </p>
                      </div>
                      <p className={styles.total}>
                        {formatMoney(order.currency, order.total)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Link href="/customers" className={styles.backLink}>
            Back to customers
          </Link>
        </>
      ) : null}
    </AdminShell>
  );
}
