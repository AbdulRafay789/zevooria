'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AccountShell } from '../account-shell';
import {
  CommerceApiError,
  createAddress,
  deleteAddress,
  fetchAddresses,
  setDefaultAddress,
  type CustomerAddress,
} from '../../../lib/commerce-api';
import { PAKISTAN_CITIES } from '../../../lib/pakistan-cities';
import styles from '../account.module.css';

export default function AccountAddressesPage() {
  const [rows, setRows] = useState<CustomerAddress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function reload() {
    const result = await fetchAddresses();
    setRows(result);
    setLoaded(true);
  }

  useEffect(() => {
    reload().catch((err: unknown) => {
      setError(
        err instanceof CommerceApiError
          ? err.message
          : 'Unable to load addresses.',
      );
      setLoaded(true);
    });
  }, []);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await createAddress({
        line1: String(data.get('line1') ?? ''),
        line2: String(data.get('line2') ?? '') || undefined,
        city: String(data.get('city') ?? ''),
        postalCode: String(data.get('postalCode') ?? ''),
        country: 'Pakistan',
        isDefault: data.get('isDefault') === 'on',
      });
      form.reset();
      await reload();
      setNotice('Address saved.');
    } catch (err: unknown) {
      setError(
        err instanceof CommerceApiError
          ? err.message
          : 'Unable to save address.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AccountShell
      title="Addresses"
      lede="Saved shipping addresses for faster checkout. One default is used when you place an order."
    >
      {error ? <p className={styles.error}>{error}</p> : null}
      {notice ? <p className={styles.success}>{notice}</p> : null}

      {!loaded ? <p className={styles.lede}>Loading addresses…</p> : null}

      {loaded && rows.length === 0 ? (
        <p className={styles.lede}>No saved addresses yet.</p>
      ) : null}

      {rows.length > 0 ? (
        <ul className={styles.addressList}>
          {rows.map((row) => (
            <li key={row.id} className={styles.addressCard}>
              <p className={styles.addressBlock}>
                {row.line1}
                {row.line2 ? `, ${row.line2}` : ''}
                <br />
                {row.city} {row.postalCode}
                <br />
                {row.country}
              </p>
              <p className={styles.meta}>
                {row.isDefault ? 'Default address' : 'Saved address'}
              </p>
              <div className={styles.actions}>
                {!row.isDefault ? (
                  <button
                    type="button"
                    className={styles.ghostBtn}
                    onClick={() => {
                      setDefaultAddress(row.id)
                        .then(reload)
                        .then(() => setNotice('Default address updated.'))
                        .catch((err: unknown) =>
                          setError(
                            err instanceof CommerceApiError
                              ? err.message
                              : 'Unable to set default.',
                          ),
                        );
                    }}
                  >
                    Make default
                  </button>
                ) : null}
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={() => {
                    deleteAddress(row.id)
                      .then(reload)
                      .then(() => setNotice('Address removed.'))
                      .catch((err: unknown) =>
                        setError(
                          err instanceof CommerceApiError
                            ? err.message
                            : 'Unable to delete address.',
                        ),
                      );
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <section className={styles.section} aria-labelledby="add-address">
        <h2 id="add-address" className={styles.sectionTitle}>
          Add address
        </h2>
        <form className={styles.form} onSubmit={onCreate} noValidate>
          <label className={styles.field}>
            <span>Address</span>
            <input name="line1" required minLength={5} />
          </label>
          <label className={styles.field}>
            <span>Address line 2 (optional)</span>
            <input name="line2" />
          </label>
          <label className={styles.field}>
            <span>City</span>
            <select name="city" required defaultValue="">
              <option value="" disabled>
                Select city
              </option>
              {PAKISTAN_CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Postal code</span>
            <input name="postalCode" required minLength={4} />
          </label>
          <label className={styles.checkField}>
            <input name="isDefault" type="checkbox" />
            <span>Set as default</span>
          </label>
          <button type="submit" className={styles.primaryBtn} disabled={pending}>
            {pending ? 'Saving…' : 'Save address'}
          </button>
        </form>
      </section>
    </AccountShell>
  );
}
