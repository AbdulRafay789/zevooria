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
  fetchAdminReports,
  formatMoney,
  type AdminReportsSummary,
} from '../../lib/admin-api';
import styles from '../admin.module.css';

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AdminReportsPage() {
  const [report, setReport] = useState<AdminReportsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recentPager = useClientPagination(report?.recentOrders ?? [], 10);
  const topPager = useClientPagination(report?.topProducts ?? [], 10);

  useEffect(() => {
    let cancelled = false;
    fetchAdminReports()
      .then((result) => {
        if (!cancelled) {
          setReport(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof AdminApiError
              ? err.message
              : 'Unable to load reports.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminShell
      title="Reports"
      lede="Live order and revenue summary from the API. Generated on demand — no export files yet."
    >
      {error ? <p className={styles.error}>{error}</p> : null}
      {!report && !error ? <p className={styles.lede}>Loading report…</p> : null}
      {report ? (
        <>
          <p className={styles.meta}>
            Generated {formatWhen(report.generatedAt)}
          </p>

          <div className={styles.statGrid}>
            <div className={styles.stat}>
              <p className={styles.statLabel}>Orders</p>
              <p className={styles.statValue}>{report.totals.ordersTotal}</p>
            </div>
            <div className={styles.stat}>
              <p className={styles.statLabel}>Revenue (excl. cancelled)</p>
              <p className={styles.statValue}>
                {formatMoney('PKR', report.totals.revenueTotalPkr)}
              </p>
            </div>
            <div className={styles.stat}>
              <p className={styles.statLabel}>Avg order</p>
              <p className={styles.statValue}>
                {formatMoney('PKR', report.totals.averageOrderPkr)}
              </p>
            </div>
          </div>

          <section className={styles.panelCard} style={{ marginTop: '1.5rem' }}>
            <h2 className={styles.sectionTitle}>Orders by status</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Status</th>
                    <th scope="col">Count</th>
                    <th scope="col">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report.ordersByStatus.map((row) => {
                    const revenue =
                      report.revenueByStatusPkr.find(
                        (entry) => entry.status === row.status,
                      )?.revenuePkr ?? '0';
                    return (
                      <tr key={row.status}>
                        <td>{row.status}</td>
                        <td>{row.count}</td>
                        <td>{formatMoney('PKR', revenue)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.panelCard} style={{ marginTop: '1.5rem' }}>
            <h2 className={styles.sectionTitle}>Top products</h2>
            {report.topProducts.length === 0 ? (
              <p className={styles.lede}>No sold items yet.</p>
            ) : (
              <>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">Product</th>
                        <th scope="col">Qty</th>
                        <th scope="col">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topPager.pageItems.map((row) => (
                        <tr key={row.productName}>
                          <td>{row.productName}</td>
                          <td>{row.quantitySold}</td>
                          <td>{formatMoney('PKR', row.revenuePkr)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <AdminPagination
                  page={topPager.page}
                  totalPages={topPager.totalPages}
                  total={topPager.total}
                  pageSize={topPager.pageSize}
                  onPageChange={topPager.setPage}
                />
              </>
            )}
          </section>

          <section className={styles.panelCard} style={{ marginTop: '1.5rem' }}>
            <h2 className={styles.sectionTitle}>Recent orders</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Order</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Status</th>
                    <th scope="col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPager.pageItems.map((order) => (
                    <tr key={order.id}>
                      <td>{formatWhen(order.createdAt)}</td>
                      <td>
                        <Link href={`/orders/${order.id}`}>
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td>{order.customerName}</td>
                      <td>{order.status}</td>
                      <td>{formatMoney('PKR', order.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AdminPagination
              page={recentPager.page}
              totalPages={recentPager.totalPages}
              total={recentPager.total}
              pageSize={recentPager.pageSize}
              onPageChange={recentPager.setPage}
            />
          </section>
        </>
      ) : null}
    </AdminShell>
  );
}
