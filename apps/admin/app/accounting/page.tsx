'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '../../components/admin-shell';
import {
  AdminPagination,
  useClientPagination,
} from '../../components/admin-pagination';
import {
  AdminApiError,
  fetchAdminAccounts,
  fetchAdminBalanceSheet,
  fetchAdminGeneralLedger,
  fetchAdminJournalEntries,
  fetchAdminProfitAndLoss,
  fetchAdminTrialBalance,
  formatMoney,
  type AdminAccount,
  type AdminBalanceSheet,
  type AdminGeneralLedgerRow,
  type AdminJournalEntry,
  type AdminProfitAndLoss,
  type AdminTrialBalanceRow,
} from '../../lib/admin-api';
import styles from '../admin.module.css';

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function ReportTable({
  rows,
}: {
  rows: Array<{ accountCode: string; accountName: string; amount: string }>;
}) {
  if (rows.length === 0) {
    return <p className={styles.lede}>No balances in this section.</p>;
  }
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Code</th>
            <th scope="col">Account</th>
            <th scope="col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.accountCode}>
              <td>{row.accountCode}</td>
              <td>{row.accountName}</td>
              <td>{formatMoney('PKR', row.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminAccountingPage() {
  const [accounts, setAccounts] = useState<AdminAccount[] | null>(null);
  const [entries, setEntries] = useState<AdminJournalEntry[] | null>(null);
  const [trial, setTrial] = useState<AdminTrialBalanceRow[] | null>(null);
  const [ledger, setLedger] = useState<AdminGeneralLedgerRow[] | null>(null);
  const [pnl, setPnl] = useState<AdminProfitAndLoss | null>(null);
  const [sheet, setSheet] = useState<AdminBalanceSheet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const journalsPager = useClientPagination(entries ?? [], 10);
  const accountsPager = useClientPagination(accounts ?? [], 20);
  const ledgerPager = useClientPagination(ledger ?? [], 20);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchAdminAccounts(),
      fetchAdminJournalEntries(100),
      fetchAdminTrialBalance(),
      fetchAdminGeneralLedger({ limit: 200 }),
      fetchAdminProfitAndLoss(),
      fetchAdminBalanceSheet(),
    ])
      .then(
        ([
          accountRows,
          entryRows,
          trialRows,
          ledgerRows,
          pnlRows,
          sheetRows,
        ]) => {
          if (cancelled) {
            return;
          }
          setAccounts(accountRows);
          setEntries(entryRows);
          setTrial(trialRows);
          setLedger(ledgerRows);
          setPnl(pnlRows);
          setSheet(sheetRows);
        },
      )
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof AdminApiError
              ? err.message
              : 'Unable to load accounting.',
          );
          setAccounts([]);
          setEntries([]);
          setTrial([]);
          setLedger([]);
          setPnl(null);
          setSheet(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminShell
      title="Accounting"
      lede="Chart of accounts, journals, trial balance, general ledger, profit & loss, and balance sheet. Journals post on order confirm (processing), cash on delivery, and cancel reverses posted entries."
    >
      {error ? <p className={styles.error}>{error}</p> : null}

      <section className={styles.panelCard} style={{ marginBottom: '1.5rem' }}>
        <h2 className={styles.sectionTitle}>Profit &amp; loss</h2>
        {pnl === null && !error ? (
          <p className={styles.lede}>Loading…</p>
        ) : null}
        {pnl ? (
          <>
            <p className={styles.meta}>
              Window: {pnl.from ?? 'all'} → {pnl.to ?? 'all'} · Net income{' '}
              {formatMoney('PKR', pnl.netIncome)}
            </p>
            <h3 className={styles.sectionTitle}>Revenue</h3>
            <ReportTable rows={pnl.revenue} />
            <p className={styles.meta}>
              Total revenue {formatMoney('PKR', pnl.totalRevenue)}
            </p>
            <h3 className={styles.sectionTitle}>Expenses</h3>
            <ReportTable rows={pnl.expenses} />
            <p className={styles.meta}>
              Total expenses {formatMoney('PKR', pnl.totalExpenses)}
            </p>
          </>
        ) : null}
      </section>

      <section className={styles.panelCard} style={{ marginBottom: '1.5rem' }}>
        <h2 className={styles.sectionTitle}>Balance sheet</h2>
        {sheet === null && !error ? (
          <p className={styles.lede}>Loading…</p>
        ) : null}
        {sheet ? (
          <>
            <p className={styles.meta}>
              As of {sheet.asOf ?? 'all activity'} · Assets{' '}
              {formatMoney('PKR', sheet.totalAssets)} · L+E+NI{' '}
              {formatMoney('PKR', sheet.totalLiabilitiesAndEquity)}
            </p>
            <h3 className={styles.sectionTitle}>Assets</h3>
            <ReportTable rows={sheet.assets} />
            <h3 className={styles.sectionTitle}>Liabilities</h3>
            <ReportTable rows={sheet.liabilities} />
            <h3 className={styles.sectionTitle}>Equity</h3>
            <ReportTable rows={sheet.equity} />
            <p className={styles.meta}>
              Net income (unclosed) {formatMoney('PKR', sheet.netIncome)} ·
              Equity total {formatMoney('PKR', sheet.totalEquity)} ·
              Liabilities {formatMoney('PKR', sheet.totalLiabilities)}
            </p>
          </>
        ) : null}
      </section>

      <section className={styles.panelCard} style={{ marginBottom: '1.5rem' }}>
        <h2 className={styles.sectionTitle}>Trial balance</h2>
        {trial === null && !error ? (
          <p className={styles.lede}>Loading…</p>
        ) : null}
        {trial && trial.length === 0 ? (
          <p className={styles.lede}>No journal activity yet.</p>
        ) : null}
        {trial && trial.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Account</th>
                  <th scope="col">Debit</th>
                  <th scope="col">Credit</th>
                </tr>
              </thead>
              <tbody>
                {trial.map((row) => (
                  <tr key={row.accountCode}>
                    <td>{row.accountCode}</td>
                    <td>{row.accountName}</td>
                    <td>{formatMoney('PKR', row.debit)}</td>
                    <td>{formatMoney('PKR', row.credit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className={styles.panelCard} style={{ marginBottom: '1.5rem' }}>
        <h2 className={styles.sectionTitle}>General ledger</h2>
        {ledger === null && !error ? (
          <p className={styles.lede}>Loading…</p>
        ) : null}
        {ledger && ledger.length === 0 ? (
          <p className={styles.lede}>No ledger lines yet.</p>
        ) : null}
        {ledger && ledger.length > 0 ? (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Account</th>
                    <th scope="col">Memo</th>
                    <th scope="col">Debit</th>
                    <th scope="col">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerPager.pageItems.map((row) => (
                    <tr key={`${row.entryId}-${row.accountCode}-${row.createdAt}`}>
                      <td>{row.entryDate}</td>
                      <td>
                        {row.accountCode} {row.accountName}
                      </td>
                      <td>
                        {row.memo}
                        <div className={styles.meta}>{row.eventKind}</div>
                      </td>
                      <td>{formatMoney('PKR', row.debit)}</td>
                      <td>{formatMoney('PKR', row.credit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AdminPagination
              page={ledgerPager.page}
              totalPages={ledgerPager.totalPages}
              total={ledgerPager.total}
              pageSize={ledgerPager.pageSize}
              onPageChange={ledgerPager.setPage}
            />
          </>
        ) : null}
      </section>

      <section className={styles.panelCard} style={{ marginBottom: '1.5rem' }}>
        <h2 className={styles.sectionTitle}>Recent journals</h2>
        {entries === null && !error ? (
          <p className={styles.lede}>Loading…</p>
        ) : null}
        {entries && entries.length === 0 ? (
          <p className={styles.lede}>No journal entries yet.</p>
        ) : null}
        {entries && entries.length > 0 ? (
          <>
            <ul className={styles.list}>
              {journalsPager.pageItems.map((entry) => (
                <li key={entry.id} className={styles.panelCard}>
                  <div className={styles.meta}>
                    {formatWhen(entry.createdAt)} · {entry.eventKind} ·{' '}
                    {entry.periodLabel ?? '—'}
                  </div>
                  <p className={styles.orderNumber}>{entry.memo}</p>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th scope="col">Account</th>
                          <th scope="col">Debit</th>
                          <th scope="col">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.lines.map((line) => (
                          <tr key={line.id}>
                            <td>
                              {line.accountCode} {line.accountName}
                            </td>
                            <td>{formatMoney('PKR', line.debit)}</td>
                            <td>{formatMoney('PKR', line.credit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </li>
              ))}
            </ul>
            <AdminPagination
              page={journalsPager.page}
              totalPages={journalsPager.totalPages}
              total={journalsPager.total}
              pageSize={journalsPager.pageSize}
              onPageChange={journalsPager.setPage}
            />
          </>
        ) : null}
      </section>

      <section className={styles.panelCard}>
        <h2 className={styles.sectionTitle}>Chart of accounts</h2>
        {accounts === null && !error ? (
          <p className={styles.lede}>Loading…</p>
        ) : null}
        {accounts && accounts.length > 0 ? (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Code</th>
                    <th scope="col">Name</th>
                    <th scope="col">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {accountsPager.pageItems.map((account) => (
                    <tr key={account.id}>
                      <td>{account.code}</td>
                      <td>{account.name}</td>
                      <td>{account.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AdminPagination
              page={accountsPager.page}
              totalPages={accountsPager.totalPages}
              total={accountsPager.total}
              pageSize={accountsPager.pageSize}
              onPageChange={accountsPager.setPage}
            />
          </>
        ) : null}
      </section>
    </AdminShell>
  );
}
