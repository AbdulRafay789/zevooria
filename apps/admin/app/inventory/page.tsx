'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '../../components/admin-shell';
import {
  AdminPagination,
  useClientPagination,
} from '../../components/admin-pagination';
import {
  AdminApiError,
  fetchAdminInventory,
  updateAdminInventory,
  type AdminInventoryRow,
} from '../../lib/admin-api';
import styles from '../admin.module.css';

export default function AdminInventoryPage() {
  const [rows, setRows] = useState<AdminInventoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const pager = useClientPagination(rows, 20);

  async function reload() {
    const result = await fetchAdminInventory();
    setRows(result);
    const next: Record<string, string> = {};
    for (const row of result) {
      next[row.productId] = String(row.quantityOnHand);
    }
    setDrafts(next);
  }

  useEffect(() => {
    reload().catch((err: unknown) =>
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to load inventory.',
      ),
    );
  }, []);

  async function save(productId: string) {
    const raw = drafts[productId];
    const quantityOnHand = Number(raw);
    if (!Number.isInteger(quantityOnHand) || quantityOnHand < 0) {
      setError('Quantity must be a whole non-negative number.');
      return;
    }
    setSavingId(productId);
    setError(null);
    try {
      const updated = await updateAdminInventory(productId, {
        quantityOnHand,
      });
      setRows((prev) =>
        prev.map((row) =>
          row.productId === productId ? { ...row, ...updated } : row,
        ),
      );
      setDrafts((prev) => ({
        ...prev,
        [productId]: String(updated.quantityOnHand),
      }));
    } catch (err: unknown) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to update inventory.',
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <AdminShell
      title="Inventory"
      lede="Default warehouse stock levels. Adjustments are audited and recorded as inventory movements."
    >
      {error ? <p className={styles.error}>{error}</p> : null}
      {rows.length === 0 && !error ? (
        <p className={styles.lede}>Loading inventory…</p>
      ) : null}
      <ul className={styles.list}>
        {pager.pageItems.map((row) => (
          <li key={row.productId} className={styles.productRow}>
            <div>
              <p className={styles.orderNumber}>{row.productName}</p>
              <p className={styles.meta}>
                {row.productSlug} · {row.warehouseCode} · available{' '}
                {row.available} (reserved {row.quantityReserved})
              </p>
            </div>
            <div className={styles.inlineForm}>
              <label className={styles.field}>
                <span>On hand</span>
                <input
                  inputMode="numeric"
                  value={drafts[row.productId] ?? String(row.quantityOnHand)}
                  onChange={(event) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [row.productId]: event.target.value.replace(/[^\d]/g, ''),
                    }))
                  }
                />
              </label>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={savingId === row.productId}
                onClick={() => {
                  void save(row.productId);
                }}
              >
                {savingId === row.productId ? 'Saving…' : 'Save'}
              </button>
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
    </AdminShell>
  );
}
