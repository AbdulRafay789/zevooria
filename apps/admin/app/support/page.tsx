'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AdminShell } from '../../components/admin-shell';
import { AdminPagination } from '../../components/admin-pagination';
import {
  fetchSupportConversations,
  formatRelativeTime,
  type SupportConversationListItem,
  type SupportConversationStatus,
} from '../../lib/admin-api';
import {
  SUPPORT_PAGE_SIZE,
  buildSupportListHref,
  parseSupportListSearchParams,
  supportListEmptyMessage,
  supportStatusLabel,
  supportSubjectDisplay,
} from '../../lib/support-inbox';
import styles from '../admin.module.css';

function SupportInboxInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = parseSupportListSearchParams(searchParams);

  const [searchInput, setSearchInput] = useState(query.search ?? '');
  const [items, setItems] = useState<SupportConversationListItem[]>([]);
  const [page, setPage] = useState(query.page);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setSearchInput(query.search ?? '');
  }, [query.search]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const nextSearch = searchInput.trim();
      const currentSearch = query.search ?? '';
      if (nextSearch === currentSearch) {
        return;
      }
      router.replace(
        buildSupportListHref({
          page: 1,
          status: query.status ?? '',
          search: nextSearch,
        }),
      );
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchInput, query.search, query.status, router]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSupportConversations({
      page: query.page,
      limit: query.limit,
      status: query.status,
      search: query.search,
    })
      .then((result) => {
        if (cancelled) {
          return;
        }
        setItems(result.items);
        setPage(result.page);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Unable to load support conversations.');
          setItems([]);
          setTotal(0);
          setTotalPages(0);
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
  }, [query.page, query.limit, query.status, query.search, reloadKey]);

  const filtersActive = Boolean(query.status || query.search);

  function replaceFilters(next: {
    page?: number;
    status?: SupportConversationStatus | '';
    search?: string;
  }) {
    router.replace(
      buildSupportListHref({
        page: next.page ?? 1,
        status: next.status === undefined ? query.status ?? '' : next.status,
        search: next.search === undefined ? query.search ?? '' : next.search,
      }),
    );
  }

  return (
    <AdminShell
      title="Support"
      lede="Customer support conversations from support@zevooria.com."
    >
      <div className={styles.supportToolbar}>
        <label className={styles.field}>
          <span>Search</span>
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
          />
        </label>
        <label className={styles.field}>
          <span>Status</span>
          <select
            value={query.status ?? ''}
            onChange={(event) => {
              const value = event.target.value as SupportConversationStatus | '';
              replaceFilters({ page: 1, status: value });
            }}
            aria-label="Filter by status"
          >
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        {filtersActive ? (
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => {
              setSearchInput('');
              router.replace('/support');
            }}
          >
            Clear filters
          </button>
        ) : null}
        <button
          type="button"
          className={styles.ghostBtn}
          onClick={() => setReloadKey((value) => value + 1)}
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className={styles.inlineForm}>
          <p className={styles.error}>{error}</p>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => setReloadKey((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading ? <p className={styles.lede}>Loading conversations…</p> : null}

      {!loading && !error && items.length === 0 ? (
        <p className={styles.lede}>{supportListEmptyMessage(filtersActive)}</p>
      ) : null}

      {!loading && items.length > 0 ? (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Subject</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last message</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link
                        href={`/support/${row.id}`}
                        className={styles.orderNumber}
                      >
                        {supportSubjectDisplay(row.subject)}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/support/${row.id}`} className={styles.meta}>
                        {row.requesterName ? (
                          <>
                            <span className={styles.orderNumber}>
                              {row.requesterName}
                            </span>
                            <br />
                            {row.requesterEmail}
                          </>
                        ) : (
                          <span className={styles.orderNumber}>
                            {row.requesterEmail}
                          </span>
                        )}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/support/${row.id}`}>
                        <span className={styles.chip}>
                          {supportStatusLabel(row.status)}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <Link href={`/support/${row.id}`} className={styles.meta}>
                        {formatRelativeTime(row.lastMessageAt)}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AdminPagination
            page={page}
            totalPages={Math.max(totalPages, 1)}
            total={total}
            pageSize={SUPPORT_PAGE_SIZE}
            onPageChange={(nextPage) => {
              replaceFilters({
                page: nextPage,
                status: query.status ?? '',
                search: query.search ?? '',
              });
            }}
          />
        </>
      ) : null}
    </AdminShell>
  );
}

export default function AdminSupportPage() {
  return (
    <Suspense
      fallback={
        <AdminShell title="Support" lede="Customer support conversations.">
          <p className={styles.lede}>Loading conversations…</p>
        </AdminShell>
      }
    >
      <SupportInboxInner />
    </Suspense>
  );
}
