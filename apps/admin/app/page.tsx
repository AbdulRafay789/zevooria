'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminShell } from '../components/admin-shell';
import {
  AdminApiError,
  fetchAdminDashboard,
  fetchAdminReports,
  formatDate,
  formatMoney,
  type AdminDashboardStats,
  type AdminReportsSummary,
} from '../lib/admin-api';
import styles from './admin.module.css';

const ORDER_STATUSES = [
  '',
  'placed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
] as const;

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

export default function AdminDashboardPage() {
  const monthDefaults = currentMonthRange();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [reports, setReports] = useState<AdminReportsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState(monthDefaults.from);
  const [to, setTo] = useState(monthDefaults.to);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  async function load(
    filters: { from?: string; to?: string; status?: string } = {},
  ) {
    setLoading(true);
    setError(null);
    try {
      const [dashboard, report] = await Promise.all([
        fetchAdminDashboard({
          from: filters.from || undefined,
          to: filters.to || undefined,
          status: filters.status || undefined,
        }),
        fetchAdminReports(),
      ]);
      setStats(dashboard);
      setReports(report);
    } catch (err: unknown) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to load dashboard.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const range = currentMonthRange();
    setFrom(range.from);
    setTo(range.to);
    void load({ from: range.from, to: range.to });
  }, []);

  return (
    <AdminShell
      title="Operations"
      lede="Live order volume, revenue, and shortcuts into the work that needs attention."
    >
      {error ? <p className={styles.error}>{error}</p> : null}
      {loading && !stats ? <p className={styles.lede}>Loading…</p> : null}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Filters</h2>
        <div className={styles.inlineForm}>
          <label className={styles.field}>
            <span>From</span>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>To</span>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {ORDER_STATUSES.map((value) => (
                <option key={value || 'all'} value={value}>
                  {value ? value : 'All statuses'}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={loading}
            onClick={() => {
              void load({ from, to, status });
            }}
          >
            {loading ? 'Applying…' : 'Apply'}
          </button>
          <button
            type="button"
            className={styles.ghostBtn}
            disabled={loading}
            onClick={() => {
              const range = currentMonthRange();
              setFrom(range.from);
              setTo(range.to);
              setStatus('');
              void load({ from: range.from, to: range.to });
            }}
          >
            This month
          </button>
        </div>
      </section>

      {stats ? (
        <>
          <div className={styles.dashHero}>
            <div className={styles.dashHeroMain}>
              <p className={styles.eyebrow}>
                {stats.from || stats.to || stats.status
                  ? 'Filtered period'
                  : 'Today'}
              </p>
              <p className={styles.dashHeroValue}>
                {formatMoney(
                  'PKR',
                  stats.from || stats.to || stats.status
                    ? stats.filteredRevenuePkr
                    : stats.revenueTodayPkr,
                )}
              </p>
              <p className={styles.dashHeroMeta}>
                {stats.from || stats.to || stats.status ? (
                  <>
                    {stats.filteredOrders} order
                    {stats.filteredOrders === 1 ? '' : 's'} in filter ·{' '}
                    {stats.ordersPending} pending overall
                  </>
                ) : (
                  <>
                    {stats.ordersToday} order
                    {stats.ordersToday === 1 ? '' : 's'} today ·{' '}
                    {stats.ordersPending} pending
                  </>
                )}
              </p>
            </div>
            <div className={styles.dashHeroSide}>
              <div>
                <p className={styles.statLabel}>All orders</p>
                <p className={styles.statValue}>{stats.ordersTotal}</p>
              </div>
              <div>
                <p className={styles.statLabel}>Revenue total</p>
                <p className={styles.statValue}>
                  {formatMoney('PKR', stats.revenueTotalPkr)}
                </p>
              </div>
            </div>
          </div>

          <div className={styles.statGrid}>
            <div className={styles.stat}>
              <p className={styles.statLabel}>Filtered orders</p>
              <p className={styles.statValue}>{stats.filteredOrders}</p>
            </div>
            <div className={styles.stat}>
              <p className={styles.statLabel}>Filtered revenue</p>
              <p className={styles.statValue}>
                {formatMoney('PKR', stats.filteredRevenuePkr)}
              </p>
            </div>
            <div className={styles.stat}>
              <p className={styles.statLabel}>Pending</p>
              <p className={styles.statValue}>{stats.ordersPending}</p>
            </div>
            <div className={styles.stat}>
              <p className={styles.statLabel}>Lifetime avg order</p>
              <p className={styles.statValue}>
                {reports
                  ? formatMoney('PKR', reports.totals.averageOrderPkr)
                  : '—'}
              </p>
            </div>
          </div>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Profit &amp; loss</h2>
            <p className={styles.meta}>
              Chart of accounts totals
              {stats.from || stats.to
                ? ` for ${stats.from ?? '…'} → ${stats.to ?? '…'}`
                : ' (all periods)'}
              . Status filter applies to order counts/revenue only.
            </p>
            <div className={styles.statGrid}>
              <div className={styles.stat}>
                <p className={styles.statLabel}>Revenue (COA)</p>
                <p className={styles.statValue}>
                  {formatMoney('PKR', stats.profitAndLoss.totalRevenue)}
                </p>
              </div>
              <div className={styles.stat}>
                <p className={styles.statLabel}>Expenses (COA)</p>
                <p className={styles.statValue}>
                  {formatMoney('PKR', stats.profitAndLoss.totalExpenses)}
                </p>
              </div>
              <div className={styles.stat}>
                <p className={styles.statLabel}>Net income</p>
                <p className={styles.statValue}>
                  {formatMoney('PKR', stats.profitAndLoss.netIncome)}
                </p>
              </div>
            </div>
          </section>

          <section className={styles.dashSection}>
            <h2 className={styles.sectionTitle}>Quick actions</h2>
            <div className={styles.dashActions}>
              <Link href="/orders" className={styles.dashAction}>
                <span className={styles.dashActionTitle}>Orders</span>
                <span className={styles.dashActionMeta}>
                  Process placements &amp; status
                </span>
              </Link>
              <Link href="/products" className={styles.dashAction}>
                <span className={styles.dashActionTitle}>Products</span>
                <span className={styles.dashActionMeta}>
                  Price, media, QR, archive
                </span>
              </Link>
              <Link href="/inventory" className={styles.dashAction}>
                <span className={styles.dashActionTitle}>Inventory</span>
                <span className={styles.dashActionMeta}>Stock on hand</span>
              </Link>
              <Link href="/customers" className={styles.dashAction}>
                <span className={styles.dashActionTitle}>Customers</span>
                <span className={styles.dashActionMeta}>Accounts &amp; status</span>
              </Link>
              <Link href="/reports" className={styles.dashAction}>
                <span className={styles.dashActionTitle}>Reports</span>
                <span className={styles.dashActionMeta}>Status &amp; top sellers</span>
              </Link>
              <Link href="/notifications" className={styles.dashAction}>
                <span className={styles.dashActionTitle}>Alerts</span>
                <span className={styles.dashActionMeta}>Order notifications</span>
              </Link>
            </div>
          </section>

          {reports ? (
            <div className={styles.dashColumns}>
              <section className={styles.dashSection}>
                <h2 className={styles.sectionTitle}>By status</h2>
                <ul className={styles.dashList}>
                  {reports.ordersByStatus.map((row) => (
                    <li key={row.status}>
                      <span>{row.status}</span>
                      <strong>{row.count}</strong>
                    </li>
                  ))}
                </ul>
              </section>
              <section className={styles.dashSection}>
                <h2 className={styles.sectionTitle}>Recent orders</h2>
                <ul className={styles.dashList}>
                  {reports.recentOrders.slice(0, 6).map((order) => (
                    <li key={order.id}>
                      <Link href={`/orders/${order.id}`}>
                        {order.orderNumber}
                      </Link>
                      <span className={styles.meta}>
                        {order.status} · {formatMoney('PKR', order.total)} ·{' '}
                        {formatDate(order.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : null}
        </>
      ) : null}
    </AdminShell>
  );
}
