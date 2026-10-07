'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '../../components/admin-auth-provider';
import { AdminApiError } from '../../lib/admin-api';
import { firstAllowedPath } from '../../lib/admin-permissions';
import styles from '../admin.module.css';

export default function AdminLoginPage() {
  const { login, user, ready } = useAdminAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (ready && user) {
      router.replace(firstAllowedPath(user) ?? '/login');
    }
  }, [ready, user, router]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) {
      return;
    }
    setError(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    const password = String(form.get('password') ?? '');
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    setPending(true);
    try {
      const signedIn = await login(email, password);
      router.push(firstAllowedPath(signedIn) ?? '/login');
    } catch (err) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Invalid email or password.',
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <div className={styles.loginBrand}>
          <Image
            src="/brand/logo.png"
            alt="Zevooria"
            width={240}
            height={64}
            className={styles.loginLogo}
            priority
          />
        </div>
        <p className={styles.eyebrow}>Administration</p>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.lede}>
          Staff access for Zevooria order operations.
        </p>
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <label className={styles.field}>
            <span>Email</span>
            <input name="email" type="email" autoComplete="username" />
          </label>
          <label className={styles.field}>
            <span>Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
            />
          </label>
          {error ? <p className={styles.error}>{error}</p> : null}
          <button className={styles.primaryBtn} type="submit" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </main>
    </div>
  );
}
