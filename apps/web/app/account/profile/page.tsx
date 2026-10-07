'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AccountShell } from '../account-shell';
import { useAuth } from '../../../components/auth-provider';
import { PhoneField } from '../../../components/phone-field';
import {
  CommerceApiError,
  deactivateAccount,
  deleteAccount,
  updateProfileAccount,
} from '../../../lib/commerce-api';
import {
  isValidPakistanPhone,
  normalizePakistanPhone,
  PK_PHONE_MESSAGE,
} from '../../../lib/phone';
import styles from '../account.module.css';
import formStyles from '../../auth-forms.module.css';

export default function AccountProfilePage() {
  const { user, logout, setUser } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  if (!user) {
    return null;
  }

  const onSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) {
      return;
    }
    setError(null);
    setSaved(false);
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get('fullName') ?? '').trim();
    const phoneRaw = String(form.get('phone') ?? '').trim();
    if (fullName.length < 2) {
      setError('Enter a valid name.');
      return;
    }
    if (!isValidPakistanPhone(phoneRaw)) {
      setError(PK_PHONE_MESSAGE);
      return;
    }
    const phone = normalizePakistanPhone(phoneRaw)!;
    setPending(true);
    try {
      const updated = await updateProfileAccount({ fullName, phone });
      setUser(updated);
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof CommerceApiError
          ? err.message
          : 'Unable to update profile.',
      );
    } finally {
      setPending(false);
    }
  };

  const onDeactivate = async () => {
    if (
      !window.confirm(
        'Deactivate your account? You will be signed out and cannot log in until an admin reactivates you.',
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await deactivateAccount();
      await logout().catch(() => undefined);
      router.push('/login');
    } catch (err) {
      setError(
        err instanceof CommerceApiError
          ? err.message
          : 'Unable to deactivate account.',
      );
      setPending(false);
    }
  };

  const onDelete = async () => {
    if (
      !window.confirm(
        'Permanently delete your account? This cannot be undone from the storefront.',
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await deleteAccount();
      await logout().catch(() => undefined);
      router.push('/login');
    } catch (err) {
      setError(
        err instanceof CommerceApiError
          ? err.message
          : 'Unable to delete account.',
      );
      setPending(false);
    }
  };

  return (
    <AccountShell
      title="Profile"
      lede="Update your name and phone, manage password, or close your account."
    >
      <form className={formStyles.form} onSubmit={onSave} noValidate>
        <label className={formStyles.field}>
          <span>Email</span>
          <input value={user.email} disabled readOnly />
        </label>
        <label className={formStyles.field}>
          <span>Full name</span>
          <input
            name="fullName"
            defaultValue={user.fullName}
            autoComplete="name"
          />
        </label>
        <PhoneField name="phone" defaultValue={user.phone} />
        {error ? <p className={formStyles.error}>{error}</p> : null}
        {saved ? <p className={styles.lede}>Profile saved.</p> : null}
        <button type="submit" className={formStyles.submit} disabled={pending}>
          {pending ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      <p className={styles.lede} style={{ marginTop: '1.5rem' }}>
        <Link href="/account/change-password">Change password</Link>
        {' · '}
        <Link href="/verify-email">Verify email</Link>
      </p>

      <section className={styles.section} style={{ marginTop: '2rem' }}>
        <h2 className={styles.sectionTitle}>Account status</h2>
        <p className={styles.lede}>
          Deactivate pauses login. Delete soft-closes the account permanently.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button
            type="button"
            className={formStyles.submit}
            disabled={pending}
            onClick={() => {
              void onDeactivate();
            }}
          >
            Deactivate account
          </button>
          <button
            type="button"
            className={formStyles.submit}
            disabled={pending}
            onClick={() => {
              void onDelete();
            }}
          >
            Delete account
          </button>
        </div>
      </section>
    </AccountShell>
  );
}
