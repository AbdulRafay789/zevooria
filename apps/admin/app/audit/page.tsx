'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '../../components/admin-shell';
import {
  AdminPagination,
  useClientPagination,
} from '../../components/admin-pagination';
import {
  AdminApiError,
  fetchAdminAuditLogs,
  formatDate,
  type AdminAuditLog,
} from '../../lib/admin-api';
import styles from '../admin.module.css';

function metadataText(metadata: Record<string, unknown> | null): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return '—';
  }
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return '—';
  }
}

function actorLabel(row: AdminAuditLog): string {
  if (row.actorName) {
    return row.actorEmail
      ? `${row.actorName} (${row.actorEmail})`
      : row.actorName;
  }
  if (row.actorEmail) {
    return row.actorEmail;
  }
  if (row.actorId) {
    return `${row.actorType} · ${row.actorId}`;
  }
  return row.actorType;
}

export default function AdminAuditPage() {
  const [rows, setRows] = useState<AdminAuditLog[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const pager = useClientPagination(rows ?? [], 50);

  useEffect(() => {
    let cancelled = false;
    fetchAdminAuditLogs({ limit: 1000, offset: 0 })
      .then((result) => {
        if (!cancelled) {
          setRows(result.items);
          setTotal(result.total);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof AdminApiError
              ? err.message
              : 'Unable to load audit logs.',
          );
          setRows([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadMore() {
    if (!rows || loadingMore || rows.length >= total) {
      return;
    }
    setLoadingMore(true);
    setError(null);
    try {
      const page = await fetchAdminAuditLogs({
        limit: 1000,
        offset: rows.length,
      });
      setRows((prev) => [...(prev ?? []), ...page.items]);
      setTotal(page.total);
    } catch (err: unknown) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to load more audit logs.',
      );
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <AdminShell
      title="Audit logs"
      lede="Every recorded admin, customer, and system event. Newest first. Secrets are never stored in metadata."
    >
      {error ? <p className={styles.error}>{error}</p> : null}
      {rows === null && !error ? (
        <p className={styles.lede}>Loading audit logs…</p>
      ) : null}
      {rows && rows.length === 0 && !error ? (
        <p className={styles.lede}>No audit events yet.</p>
      ) : null}
      {rows && rows.length > 0 ? (
        <>
          <p className={styles.meta}>
            Showing {rows.length} of {total} events
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Action</th>
                  <th scope="col">User</th>
                  <th scope="col">Resource</th>
                  <th scope="col">Details</th>
                  <th scope="col">IP</th>
                </tr>
              </thead>
              <tbody>
                {pager.pageItems.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.createdAt)}</td>
                    <td>
                      <code className={styles.codeChip}>{row.action}</code>
                    </td>
                    <td>
                      <span className={styles.meta}>
                        {actorLabel(row)}
                        <br />
                        {row.actorType}
                      </span>
                    </td>
                    <td>
                      <span className={styles.meta}>
                        {row.resourceType ?? '—'}
                        {row.resourceId ? (
                          <>
                            <br />
                            {row.resourceId}
                          </>
                        ) : null}
                      </span>
                    </td>
                    <td>
                      <pre className={styles.auditMeta}>
                        {metadataText(row.metadata)}
                      </pre>
                    </td>
                    <td>
                      <span className={styles.meta}>{row.ipAddress ?? '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AdminPagination
            page={pager.page}
            totalPages={pager.totalPages}
            total={pager.total}
            pageSize={pager.pageSize}
            onPageChange={pager.setPage}
          />
          {rows.length < total ? (
            <div className={styles.inlineForm}>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={loadingMore}
                onClick={() => {
                  void loadMore();
                }}
              >
                {loadingMore ? 'Loading…' : 'Load more activity'}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </AdminShell>
  );
}
