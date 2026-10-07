'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AdminShell } from '../../components/admin-shell';
import {
  AdminPagination,
  useClientPagination,
} from '../../components/admin-pagination';
import {
  AdminApiError,
  createAdminPromoCode,
  deleteAdminPromoCode,
  fetchAdminPromoCodes,
  updateAdminPromoCode,
  type AdminPromoCode,
} from '../../lib/admin-api';
import styles from '../admin.module.css';

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

type EditDraft = {
  discountType: 'percent' | 'fixed';
  discountValue: string;
  minSubtotal: string;
  maxUses: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

function draftFromRow(row: AdminPromoCode): EditDraft {
  return {
    discountType: row.discountType,
    discountValue: String(Math.trunc(Number(row.discountValue))),
    minSubtotal: String(Math.trunc(Number(row.minSubtotal))),
    maxUses: row.maxUses == null ? '' : String(row.maxUses),
    startsAt: toDatetimeLocalValue(row.startsAt),
    endsAt: toDatetimeLocalValue(row.endsAt),
    isActive: row.isActive,
  };
}

export default function AdminPromotionsPage() {
  const [rows, setRows] = useState<AdminPromoCode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, EditDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const pager = useClientPagination(rows, 20);

  async function reload() {
    const result = await fetchAdminPromoCodes();
    setRows(result);
    setEdits((prev) => {
      const next: Record<string, EditDraft> = {};
      for (const row of result) {
        next[row.id] = prev[row.id] ?? draftFromRow(row);
      }
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;
    reload()
      .then(() => {
        if (!cancelled) {
          setLoaded(true);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof AdminApiError
              ? err.message
              : 'Unable to load promo codes.',
          );
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const code = String(form.get('code') ?? '').trim();
    const discountType = String(form.get('discountType') ?? 'fixed') as
      | 'percent'
      | 'fixed';
    const discountValue = String(form.get('discountValue') ?? '').replace(
      /[^\d]/g,
      '',
    );
    const minSubtotal = String(form.get('minSubtotal') ?? '1599').replace(
      /[^\d]/g,
      '',
    );
    const maxUsesRaw = String(form.get('maxUses') ?? '').trim();
    const startsAt = fromDatetimeLocal(String(form.get('startsAt') ?? ''));
    const endsAt = fromDatetimeLocal(String(form.get('endsAt') ?? ''));
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createAdminPromoCode({
        code,
        discountType,
        discountValue,
        minSubtotal: minSubtotal || '1599',
        maxUses: maxUsesRaw ? Number(maxUsesRaw) : null,
        startsAt,
        endsAt,
        isActive: true,
      });
      formEl.reset();
      await reload();
      setExpandedId(created.id);
      setNotice(`Created promo ${created.code}.`);
    } catch (err: unknown) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to create promo code.',
      );
    } finally {
      setPending(false);
    }
  }

  async function onSave(row: AdminPromoCode) {
    const draft = edits[row.id] ?? draftFromRow(row);
    setSavingId(row.id);
    setError(null);
    setNotice(null);
    try {
      await updateAdminPromoCode(row.id, {
        discountType: draft.discountType,
        discountValue: draft.discountValue,
        minSubtotal: draft.minSubtotal || '1599',
        maxUses: draft.maxUses.trim() ? Number(draft.maxUses) : null,
        startsAt: fromDatetimeLocal(draft.startsAt),
        endsAt: fromDatetimeLocal(draft.endsAt),
        isActive: draft.isActive,
      });
      await reload();
      setNotice(`Updated ${row.code}.`);
    } catch (err: unknown) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to update promo code.',
      );
    } finally {
      setSavingId(null);
    }
  }

  async function onToggleActive(row: AdminPromoCode) {
    setError(null);
    setNotice(null);
    try {
      await updateAdminPromoCode(row.id, { isActive: !row.isActive });
      await reload();
      setNotice(`${row.code} ${row.isActive ? 'disabled' : 'enabled'}.`);
    } catch (err: unknown) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to update promo.',
      );
    }
  }

  async function onDelete(row: AdminPromoCode) {
    if (
      !window.confirm(
        `Delete promo “${row.code}”? Orders that already used it keep their discount snapshot.`,
      )
    ) {
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await deleteAdminPromoCode(row.id);
      if (expandedId === row.id) {
        setExpandedId(null);
      }
      await reload();
      setNotice(`Deleted ${row.code}.`);
    } catch (err: unknown) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to delete promo code.',
      );
    }
  }

  return (
    <AdminShell
      title="Promotions"
      lede="Create, edit, enable/disable, or delete promo codes. Discounts apply to merchandise only — shipping stays full. Default minimum subtotal is PKR 1,599."
    >
      {error ? <p className={styles.error}>{error}</p> : null}
      {notice ? <p className={styles.success}>{notice}</p> : null}

      <form className={styles.formWide} onSubmit={onCreate}>
        <h2 className={styles.sectionTitle}>Add promo code</h2>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Code</span>
            <input name="code" required placeholder="SAVE300" />
          </label>
          <label className={styles.field}>
            <span>Type</span>
            <select name="discountType" defaultValue="fixed">
              <option value="fixed">Fixed PKR</option>
              <option value="percent">Percent</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>Value</span>
            <input
              name="discountValue"
              inputMode="numeric"
              required
              placeholder="300 or 10"
            />
          </label>
          <label className={styles.field}>
            <span>Min subtotal (PKR)</span>
            <input
              name="minSubtotal"
              inputMode="numeric"
              defaultValue="1599"
            />
          </label>
          <label className={styles.field}>
            <span>Max uses (optional)</span>
            <input name="maxUses" inputMode="numeric" />
          </label>
          <label className={styles.field}>
            <span>Starts at (optional)</span>
            <input name="startsAt" type="datetime-local" />
          </label>
          <label className={styles.field}>
            <span>Ends at (optional)</span>
            <input name="endsAt" type="datetime-local" />
          </label>
        </div>
        <button type="submit" className={styles.primaryBtn} disabled={pending}>
          {pending ? 'Saving…' : 'Create promo'}
        </button>
      </form>

      {!loaded ? <p className={styles.lede}>Loading…</p> : null}
      {loaded && rows.length === 0 ? (
        <p className={styles.lede}>No promo codes yet.</p>
      ) : null}

      {rows.length > 0 ? (
        <>
          <ul className={styles.list}>
            {pager.pageItems.map((row) => {
              const open = expandedId === row.id;
              const draft = edits[row.id] ?? draftFromRow(row);
              return (
                <li key={row.id} className={styles.panelCard}>
                  <button
                    type="button"
                    className={styles.panelHeader}
                    aria-expanded={open}
                    onClick={() =>
                      setExpandedId((prev) =>
                        prev === row.id ? null : row.id,
                      )
                    }
                  >
                    <span>
                      <span className={styles.orderNumber}>{row.code}</span>
                      <span className={styles.meta}>
                        {row.discountType === 'percent'
                          ? `${Math.trunc(Number(row.discountValue))}% off`
                          : `PKR ${Math.trunc(Number(row.discountValue))} off`}{' '}
                        · min {Math.trunc(Number(row.minSubtotal))} · used{' '}
                        {row.usedCount}
                        {row.maxUses != null ? ` / ${row.maxUses}` : ''} ·{' '}
                        {row.isActive ? 'active' : 'inactive'}
                      </span>
                    </span>
                    <span className={styles.meta}>
                      {open ? 'Collapse' : 'Edit'}
                    </span>
                  </button>

                  {open ? (
                    <div className={styles.productEditor}>
                      <div className={styles.formGrid}>
                        <label className={styles.field}>
                          <span>Type</span>
                          <select
                            value={draft.discountType}
                            onChange={(event) =>
                              setEdits((prev) => ({
                                ...prev,
                                [row.id]: {
                                  ...draft,
                                  discountType: event.target.value as
                                    | 'percent'
                                    | 'fixed',
                                },
                              }))
                            }
                          >
                            <option value="fixed">Fixed PKR</option>
                            <option value="percent">Percent</option>
                          </select>
                        </label>
                        <label className={styles.field}>
                          <span>Value</span>
                          <input
                            inputMode="numeric"
                            value={draft.discountValue}
                            onChange={(event) =>
                              setEdits((prev) => ({
                                ...prev,
                                [row.id]: {
                                  ...draft,
                                  discountValue: event.target.value.replace(
                                    /[^\d]/g,
                                    '',
                                  ),
                                },
                              }))
                            }
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Min subtotal (PKR)</span>
                          <input
                            inputMode="numeric"
                            value={draft.minSubtotal}
                            onChange={(event) =>
                              setEdits((prev) => ({
                                ...prev,
                                [row.id]: {
                                  ...draft,
                                  minSubtotal: event.target.value.replace(
                                    /[^\d]/g,
                                    '',
                                  ),
                                },
                              }))
                            }
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Max uses</span>
                          <input
                            inputMode="numeric"
                            value={draft.maxUses}
                            placeholder="Unlimited"
                            onChange={(event) =>
                              setEdits((prev) => ({
                                ...prev,
                                [row.id]: {
                                  ...draft,
                                  maxUses: event.target.value.replace(
                                    /[^\d]/g,
                                    '',
                                  ),
                                },
                              }))
                            }
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Starts at</span>
                          <input
                            type="datetime-local"
                            value={draft.startsAt}
                            onChange={(event) =>
                              setEdits((prev) => ({
                                ...prev,
                                [row.id]: {
                                  ...draft,
                                  startsAt: event.target.value,
                                },
                              }))
                            }
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Ends at</span>
                          <input
                            type="datetime-local"
                            value={draft.endsAt}
                            onChange={(event) =>
                              setEdits((prev) => ({
                                ...prev,
                                [row.id]: {
                                  ...draft,
                                  endsAt: event.target.value,
                                },
                              }))
                            }
                          />
                        </label>
                      </div>
                      <div className={styles.inlineForm}>
                        <button
                          type="button"
                          className={styles.primaryBtn}
                          disabled={savingId === row.id}
                          onClick={() => {
                            void onSave(row);
                          }}
                        >
                          {savingId === row.id ? 'Saving…' : 'Save changes'}
                        </button>
                        <button
                          type="button"
                          className={styles.ghostBtn}
                          onClick={() => {
                            void onToggleActive(row);
                          }}
                        >
                          {row.isActive ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          className={styles.dangerBtn}
                          onClick={() => {
                            void onDelete(row);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.inlineForm}>
                      <button
                        type="button"
                        className={styles.ghostBtn}
                        onClick={() => {
                          void onToggleActive(row);
                        }}
                      >
                        {row.isActive ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
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
