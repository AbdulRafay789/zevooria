'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../components/auth-provider';
import {
  CommerceApiError,
  requestEmailVerification,
  verifyEmailWithToken,
} from '../../lib/commerce-api';
import styles from '../auth-forms.module.css';

function VerifyEmailForm() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const tokenFromUrl = (searchParams.get('token') ?? '').trim();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [done, setDone] = useState(Boolean(user?.emailVerifiedAt));
  const [pending, setPending] = useState(false);
  const autoTried = useRef(false);

  const verifyToken = async (token: string) => {
    setError(null);
    setInfo(null);
    setPending(true);
    try {
      await verifyEmailWithToken(token);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof CommerceApiError
          ? err.message
          : 'Unable to verify email.',
      );
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    if (done || autoTried.current || !tokenFromUrl) {
      return;
    }
    autoTried.current = true;
    void verifyToken(tokenFromUrl);
  }, [done, tokenFromUrl]);

  const onRequest = async () => {
    if (pending) {
      return;
    }
    setError(null);
    setInfo(null);
    setPending(true);
    try {
      await requestEmailVerification();
      setInfo(
        'If needed, a verification email was sent. Check your inbox for the link.',
      );
    } catch (err) {
      setError(
        err instanceof CommerceApiError
          ? err.message
          : 'Unable to request verification.',
      );
    } finally {
      setPending(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) {
      return;
    }
    const form = new FormData(event.currentTarget);
    const token = String(form.get('token') ?? '').trim();
    if (!token) {
      setError('Verification token is required.');
      return;
    }
    await verifyToken(token);
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <p className={styles.eyebrow}>Account</p>
        <h1 className={styles.title}>Verify email</h1>
        {done ? (
          <p className={styles.lede}>
            Email verified. You can return to your{' '}
            <Link href="/account">account</Link>.
          </p>
        ) : (
          <>
            <p className={styles.lede}>
              Open the link from your email.
            </p>
            {user ? (
              <button
                type="button"
                className={styles.submit}
                disabled={pending}
                onClick={() => {
                  void onRequest();
                }}
              >
                {pending ? 'Working…' : 'Send verification'}
              </button>
            ) : (
              <p className={styles.lede}>
                <Link href="/login?next=/verify-email">Sign in</Link> to request
                a verification email.
              </p>
            )}
            {info ? <p className={styles.lede}>{info}</p> : null}
            <form className={styles.form} onSubmit={onSubmit} noValidate>
              <label className={styles.field}>
                <span>Verification token</span>
                <input
                  name="token"
                  autoComplete="off"
                  defaultValue={tokenFromUrl}
                />
              </label>
              {error ? <p className={styles.error}>{error}</p> : null}
              <button
                type="submit"
                className={styles.submit}
                disabled={pending}
              >
                {pending ? 'Verifying…' : 'Verify email'}
              </button>
            </form>
          </>
        )}
        <p className={styles.alt}>
          <Link href="/account">Back to account</Link>
        </p>
      </main>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className={styles.page} />}>
      <VerifyEmailForm />
    </Suspense>
  );
}
