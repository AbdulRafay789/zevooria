'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AdminShell } from '../../components/admin-shell';
import {
  AdminPagination,
  useClientPagination,
} from '../../components/admin-pagination';
import {
  AdminApiError,
  adminProductQrSheetUrl,
  createAdminProduct,
  deleteAdminProduct,
  deleteAdminProductMedia,
  downloadAdminProductQrPng,
  fetchAdminProductQrObjectUrl,
  fetchAdminProducts,
  formatMoney,
  reorderAdminProducts,
  storageKeyToPreviewUrl,
  updateAdminProduct,
  uploadAdminProductMedia,
  type AdminProductListItem,
} from '../../lib/admin-api';
import {
  descriptionToListItems,
  listItemsToDescriptionHtml,
} from '../../lib/product-description';
import styles from '../admin.module.css';

const STATUSES = ['draft', 'active', 'archived'] as const;

type Draft = {
  status: string;
  price: string;
  compareAtPrice: string;
  cost: string;
  descriptionItems: string[];
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProductListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [removingMediaId, setRemovingMediaId] = useState<string | null>(null);
  const [qrDownloadingId, setQrDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [qrPreviewById, setQrPreviewById] = useState<Record<string, string>>(
    {},
  );
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const pager = useClientPagination(products, 50);

  function draftsFromProducts(rows: AdminProductListItem[]) {
    const next: Record<string, Draft> = {};
    for (const product of rows) {
      next[product.id] = {
        status: product.status,
        price: String(Math.trunc(Number(product.price))),
        compareAtPrice: product.compareAtPrice
          ? String(Math.trunc(Number(product.compareAtPrice)))
          : '',
        cost: String(Math.trunc(Number(product.cost ?? 0))),
        descriptionItems: descriptionToListItems(product.description ?? ''),
      };
    }
    return next;
  }

  useEffect(() => {
    let cancelled = false;
    fetchAdminProducts()
      .then((result) => {
        if (cancelled) {
          return;
        }
        setProducts(result);
        setDrafts(draftsFromProducts(result));
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof AdminApiError
              ? err.message
              : 'Unable to load products.',
          );
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!expandedId || qrPreviewById[expandedId]) {
      return;
    }
    let cancelled = false;
    fetchAdminProductQrObjectUrl(expandedId)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setQrPreviewById((prev) => {
          if (prev[expandedId]) {
            URL.revokeObjectURL(url);
            return prev;
          }
          return { ...prev, [expandedId]: url };
        });
      })
      .catch(() => {
        // Preview is optional; download/print still work.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per product id
  }, [expandedId]);

  function updateItems(productId: string, items: string[]) {
    setDrafts((prev) => {
      const draft = prev[productId];
      if (!draft) {
        return prev;
      }
      return {
        ...prev,
        [productId]: { ...draft, descriptionItems: items },
      };
    });
  }

  async function save(productId: string) {
    const draft = drafts[productId];
    if (!draft) {
      return;
    }
    let description: string;
    try {
      description = listItemsToDescriptionHtml(draft.descriptionItems);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid description.');
      return;
    }
    setSavingId(productId);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateAdminProduct(productId, {
        status: draft.status,
        price: draft.price,
        compareAtPrice: draft.compareAtPrice.trim()
          ? draft.compareAtPrice
          : null,
        cost: draft.cost,
        description,
      });
      setProducts((prev) =>
        prev.map((product) =>
          product.id === productId ? { ...product, ...updated } : product,
        ),
      );
      setDrafts((prev) => ({
        ...prev,
        [productId]: {
          status: updated.status,
          price: String(Math.trunc(Number(updated.price))),
          compareAtPrice: updated.compareAtPrice
            ? String(Math.trunc(Number(updated.compareAtPrice)))
            : '',
          cost: String(Math.trunc(Number(updated.cost ?? 0))),
          descriptionItems: descriptionToListItems(updated.description ?? ''),
        },
      }));
      setNotice(`Saved ${updated.name}.`);
    } catch (err: unknown) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to update product.',
      );
    } finally {
      setSavingId(null);
    }
  }

  async function onUpload(productId: string, file: File | null) {
    if (!file) {
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be 5 MB or smaller.');
      return;
    }
    setUploadingId(productId);
    setError(null);
    setNotice(null);
    try {
      const updated = await uploadAdminProductMedia(productId, {
        file,
        isPrimary: !(
          products.find((p) => p.id === productId)?.media?.length ?? 0
        ),
      });
      setProducts((prev) =>
        prev.map((product) =>
          product.id === productId ? { ...product, ...updated } : product,
        ),
      );
      setNotice(`Uploaded image for ${updated.name}.`);
    } catch (err: unknown) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to upload image.',
      );
    } finally {
      setUploadingId(null);
    }
  }

  async function onRemoveMedia(productId: string, mediaId: string) {
    if (removingMediaId) {
      return;
    }
    if (!window.confirm('Remove this product image?')) {
      return;
    }
    setRemovingMediaId(mediaId);
    setError(null);
    setNotice(null);
    try {
      const updated = await deleteAdminProductMedia(productId, mediaId);
      setProducts((prev) =>
        prev.map((product) =>
          product.id === productId ? { ...product, ...updated } : product,
        ),
      );
      setNotice(`Removed image from ${updated.name}.`);
    } catch (err: unknown) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to remove image.',
      );
    } finally {
      setRemovingMediaId(null);
    }
  }

  async function onDownloadQr(product: AdminProductListItem) {
    setQrDownloadingId(product.id);
    setError(null);
    setNotice(null);
    try {
      await downloadAdminProductQrPng(product.id, product.slug);
      setNotice(`Downloaded QR for ${product.name}.`);
    } catch (err: unknown) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to download QR PNG.',
      );
    } finally {
      setQrDownloadingId(null);
    }
  }

  async function onDelete(product: AdminProductListItem) {
    if (product.status === 'archived') {
      setNotice(`${product.name} is already deleted (archived).`);
      return;
    }
    const confirmed = window.confirm(
      `Delete “${product.name}”? It will be archived and hidden from the storefront. Order history is kept.`,
    );
    if (!confirmed) {
      return;
    }
    setDeletingId(product.id);
    setError(null);
    setNotice(null);
    try {
      const updated = await deleteAdminProduct(product.id);
      setProducts((prev) =>
        prev.map((row) => (row.id === product.id ? { ...row, ...updated } : row)),
      );
      setDrafts((prev) => ({
        ...prev,
        [product.id]: {
          ...(prev[product.id] ?? {
            status: updated.status,
            price: updated.price,
            cost: updated.cost ?? '0',
            descriptionItems: descriptionToListItems(updated.description ?? ''),
          }),
          status: updated.status,
        },
      }));
      setNotice(`Deleted ${updated.name} (archived).`);
    } catch (err: unknown) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to delete product.',
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) {
      return;
    }
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const slug = String(form.get('slug') ?? '').trim();
    const description = String(form.get('description') ?? '').trim();
    const price = String(form.get('price') ?? '').replace(/[^\d]/g, '');
    const compareAtPrice = String(form.get('compareAtPrice') ?? '').replace(
      /[^\d]/g,
      '',
    );
    const cost = String(form.get('cost') ?? '').replace(/[^\d]/g, '');
    const status = String(form.get('status') ?? 'draft');
    if (!name || !description || !price) {
      setError('Name, description, and price are required.');
      return;
    }
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createAdminProduct({
        name,
        slug: slug || undefined,
        description,
        price,
        compareAtPrice: compareAtPrice || null,
        cost: cost || '0',
        status,
      });
      const next = [...products, created].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
      setProducts(next);
      setDrafts(draftsFromProducts(next));
      event.currentTarget.reset();
      setNotice(`Created ${created.name}.`);
      setExpandedId(created.id);
    } catch (err: unknown) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to create product.',
      );
    } finally {
      setCreating(false);
    }
  }

  async function onDropReorder(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    const from = products.findIndex((row) => row.id === dragId);
    const to = products.findIndex((row) => row.id === targetId);
    if (from < 0 || to < 0) {
      setDragId(null);
      return;
    }
    const next = products.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const previous = products;
    setProducts(next);
    setDragId(null);
    setError(null);
    try {
      const saved = await reorderAdminProducts(next.map((row) => row.id));
      setProducts(saved);
      setDrafts(draftsFromProducts(saved));
      setNotice('Catalog order updated.');
    } catch (err: unknown) {
      setProducts(previous);
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to reorder products.',
      );
    }
  }

  return (
    <AdminShell
      title="Products"
      lede="Create products, set sell and previous (compare-at) prices, drag rows to set storefront grid order, manage images and QR codes."
    >
      {error ? <p className={styles.error}>{error}</p> : null}
      {notice ? <p className={styles.success}>{notice}</p> : null}
      {!loaded && !error ? (
        <p className={styles.lede}>Loading products…</p>
      ) : null}

      <form className={styles.formWide} onSubmit={onCreate}>
        <h2 className={styles.sectionTitle}>Add product</h2>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Name</span>
            <input name="name" required />
          </label>
          <label className={styles.field}>
            <span>Slug (optional)</span>
            <input name="slug" placeholder="auto-from-name" />
          </label>
          <label className={styles.field}>
            <span>Sell price (PKR)</span>
            <input name="price" inputMode="numeric" required />
          </label>
          <label className={styles.field}>
            <span>Previous price (PKR)</span>
            <input name="compareAtPrice" inputMode="numeric" />
          </label>
          <label className={styles.field}>
            <span>Cost (PKR)</span>
            <input name="cost" inputMode="numeric" defaultValue="0" />
          </label>
          <label className={styles.field}>
            <span>Status</span>
            <select name="status" defaultValue="draft">
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className={styles.field}>
          <span>Description</span>
          <textarea name="description" rows={3} required />
        </label>
        <button type="submit" className={styles.primaryBtn} disabled={creating}>
          {creating ? 'Creating…' : 'Create product'}
        </button>
      </form>

      {loaded && products.length === 0 && !error ? (
        <p className={styles.lede}>
          No products yet. Create one above or seed the catalog on the API.
        </p>
      ) : null}
      <ul className={styles.list}>
        {pager.pageItems.map((product) => {
          const draft = drafts[product.id] ?? {
            status: product.status,
            price: product.price,
            compareAtPrice: product.compareAtPrice ?? '',
            cost: product.cost ?? '0',
            descriptionItems: descriptionToListItems(product.description ?? ''),
          };
          const open = expandedId === product.id;
          const qrPreview = qrPreviewById[product.id];
          return (
            <li
              key={product.id}
              className={styles.panelCard}
              draggable
              onDragStart={() => setDragId(product.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                void onDropReorder(product.id);
              }}
            >
              <button
                type="button"
                className={styles.panelHeader}
                aria-expanded={open}
                onClick={() =>
                  setExpandedId((prev) =>
                    prev === product.id ? null : product.id,
                  )
                }
              >
                <span>
                  <span className={styles.meta}>⋮⋮ drag</span>{' '}
                  <span className={styles.orderNumber}>{product.name}</span>
                  <span className={styles.meta}>{product.slug}</span>
                </span>
                <span className={styles.meta}>
                  {formatMoney(product.currency, product.price)} ·{' '}
                  {product.status} · {product.media?.length ?? 0} images ·{' '}
                  {open ? 'Collapse' : 'Edit'}
                </span>
              </button>

              {open ? (
                <div className={styles.productEditor}>
                  <div className={styles.inlineForm}>
                    <label className={styles.field}>
                      <span>Status</span>
                      <select
                        value={draft.status}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [product.id]: {
                              ...draft,
                              status: event.target.value,
                            },
                          }))
                        }
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span>Price (PKR)</span>
                      <input
                        inputMode="numeric"
                        value={draft.price}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [product.id]: {
                              ...draft,
                              price: event.target.value.replace(/[^\d]/g, ''),
                            },
                          }))
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Previous price (PKR)</span>
                      <input
                        inputMode="numeric"
                        value={draft.compareAtPrice}
                        placeholder="Optional"
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [product.id]: {
                              ...draft,
                              compareAtPrice: event.target.value.replace(
                                /[^\d]/g,
                                '',
                              ),
                            },
                          }))
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Cost (PKR)</span>
                      <input
                        inputMode="numeric"
                        value={draft.cost}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [product.id]: {
                              ...draft,
                              cost: event.target.value.replace(/[^\d]/g, ''),
                            },
                          }))
                        }
                      />
                    </label>
                  </div>

                  <div className={styles.field}>
                    <span>Description (list)</span>
                    <ul className={styles.descList}>
                      {draft.descriptionItems.map((item, index) => (
                        <li key={`desc-${product.id}-${index}`}>
                          <input
                            value={item}
                            placeholder={`Bullet ${index + 1}`}
                            onChange={(event) => {
                              const next = [...draft.descriptionItems];
                              next[index] = event.target.value;
                              updateItems(product.id, next);
                            }}
                          />
                          <button
                            type="button"
                            className={styles.ghostBtn}
                            disabled={draft.descriptionItems.length <= 1}
                            onClick={() => {
                              const next = draft.descriptionItems.filter(
                                (_value, i) => i !== index,
                              );
                              updateItems(
                                product.id,
                                next.length > 0 ? next : [''],
                              );
                            }}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className={styles.ghostBtn}
                      onClick={() =>
                        updateItems(product.id, [
                          ...draft.descriptionItems,
                          '',
                        ])
                      }
                    >
                      Add bullet
                    </button>
                  </div>

                  <div className={styles.mediaSection}>
                    <p className={styles.meta}>Images</p>
                    <div className={styles.mediaGrid}>
                      {(product.media ?? []).map((item) => {
                        const src = storageKeyToPreviewUrl(item.storageKey);
                        return (
                          <figure key={item.id} className={styles.mediaThumb}>
                            {src ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={src}
                                alt={item.altText ?? product.name}
                              />
                            ) : null}
                            <figcaption>
                              {item.isPrimary
                                ? 'Primary'
                                : `Order ${item.sortOrder}`}
                            </figcaption>
                            <button
                              type="button"
                              className={styles.mediaRemoveBtn}
                              disabled={removingMediaId === item.id}
                              onClick={() => {
                                void onRemoveMedia(product.id, item.id);
                              }}
                            >
                              {removingMediaId === item.id
                                ? 'Removing…'
                                : 'Remove'}
                            </button>
                          </figure>
                        );
                      })}
                    </div>
                    <label className={styles.uploadBtn}>
                      <span>
                        {uploadingId === product.id
                          ? 'Uploading…'
                          : 'Upload image'}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        disabled={uploadingId === product.id}
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          event.target.value = '';
                          void onUpload(product.id, file);
                        }}
                      />
                    </label>
                  </div>

                  <div className={styles.qrSection}>
                    <p className={styles.meta}>Box QR (product page)</p>
                    <div className={styles.qrRow}>
                      {qrPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          className={styles.qrPreview}
                          src={qrPreview}
                          alt={`QR code for ${product.name}`}
                        />
                      ) : (
                        <div className={styles.qrPreview} aria-hidden />
                      )}
                      <div className={styles.qrActions}>
                        <p className={styles.meta}>
                          {product.productPageUrl ??
                            `/products/${product.slug}`}
                        </p>
                        <button
                          type="button"
                          className={styles.ghostBtn}
                          disabled={qrDownloadingId === product.id}
                          onClick={() => {
                            void onDownloadQr(product);
                          }}
                        >
                          {qrDownloadingId === product.id
                            ? 'Downloading…'
                            : 'Download PNG'}
                        </button>
                        <a
                          className={styles.ghostBtn}
                          href={adminProductQrSheetUrl(product.id, 12)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Print sheet (12)
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className={styles.editorActions}>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    disabled={savingId === product.id}
                    onClick={() => {
                      void save(product.id);
                    }}
                  >
                    {savingId === product.id ? 'Saving…' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    className={styles.dangerBtn}
                    disabled={
                      deletingId === product.id ||
                      product.status === 'archived'
                    }
                    onClick={() => {
                      void onDelete(product);
                    }}
                  >
                    {product.status === 'archived'
                      ? 'Already deleted'
                      : deletingId === product.id
                        ? 'Deleting…'
                        : 'Delete product'}
                  </button>
                  </div>
                </div>
              ) : null}
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
    </AdminShell>
  );
}
