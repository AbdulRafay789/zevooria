'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import {
  CommerceApiError,
  requestPasswordReset,
} from '../../lib/commerce-api';
import { normalizeEmail } from '../../lib/form-validation';
import styles from '../auth-forms.module.css';

function isLocalHost(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [localDev, setLocalDev] = useState(false);

  useEffect(() => {
    setLocalDev(isLocalHost());
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) {
      return;
    }
    setError(null);
    const form = new FormData(event.currentTarget);
    const email = normalizeEmail(String(form.get('email') ?? ''));
    if (!email) {
      setError('Email is required.');
      return;
    }
    setPending(true);
    try {
      await requestPasswordReset(email);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof CommerceApiError
          ? err.message
          : 'Unable to request a reset.',
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <p className={styles.eyebrow}>Account</p>
        <h1 className={styles.title}>Forgot password</h1>
        <p className={styles.lede}>
          Enter your email. If an account exists, a reset message is sent.
        </p>
        {done ? (
          <>
            <p className={styles.lede}>
              If that email is registered, a reset message was sent. Continue to{' '}
              <Link href="/reset-password">reset password</Link>.
            </p>
            {localDev ? (
              <div className={styles.devTip} role="note">
                <p className={styles.devTipTitle}>Local development</p>
                <p className={styles.lede}>
                  With Compose local, the reset token is printed in the API
                  container logs (body logging via{' '}
                  <code>EMAIL_LOG_BODY=true</code>). Copy the token into the
                  reset form.
                </p>
                <pre className={styles.devTipCode}>
                  docker logs zevooria-api-1 --tail 30
                </pre>
              </div>
            ) : null}
          </>
        ) : (
          <form className={styles.form} onSubmit={onSubmit} noValidate>
            <label className={styles.field}>
              <span>Email</span>
              <input name="email" type="email" autoComplete="email" />
            </label>
            {error ? <p className={styles.error}>{error}</p> : null}
            <button type="submit" className={styles.submit} disabled={pending}>
              {pending ? 'Sending…' : 'Send reset'}
            </button>
          </form>
        )}
        <p className={styles.alt}>
          <Link href="/login">Back to sign in</Link>
        </p>
      </main>
    </div>
  );
}
