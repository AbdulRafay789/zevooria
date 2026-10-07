'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { PasswordField } from '../../components/password-field';
import { useAuth } from '../../components/auth-provider';
import { CommerceApiError } from '../../lib/commerce-api';
import {
  normalizeEmail,
  validateLoginFields,
  type FieldErrors,
} from '../../lib/form-validation';
import styles from '../auth-forms.module.css';

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/account';
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) {
      return;
    }
    setError(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    const localErrors = validateLoginFields({ email, password });
    setFieldErrors(localErrors);
    if (Object.keys(localErrors).length > 0) {
      return;
    }

    setPending(true);
    try {
      await login(normalizeEmail(email), password);
      router.push(next);
    } catch (err) {
      setError(
        err instanceof CommerceApiError
          ? err.message
          : 'Invalid email or password.',
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <p className={styles.eyebrow}>Account</p>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.lede}>
          Sign in to view your orders or continue to checkout.
        </p>

        <form className={styles.form} onSubmit={onSubmit} noValidate autoComplete="on">
          <label className={styles.field}>
            <span>Email</span>
            <input
              name="email"
              type="email"
              autoComplete="username"
              aria-invalid={Boolean(fieldErrors.email)}
            />
            {fieldErrors.email ? (
              <span className={styles.fieldError}>{fieldErrors.email}</span>
            ) : null}
          </label>
          <PasswordField
            name="password"
            label="Password"
            autoComplete="current-password"
            error={fieldErrors.password}
          />
          {error ? <p className={styles.error}>{error}</p> : null}
          <button type="submit" className={styles.submit} disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className={styles.alt}>
          <Link href="/forgot-password">Forgot password?</Link>
        </p>

        <p className={styles.alt}>
          New to Zevooria?{' '}
          <Link href={`/register?next=${encodeURIComponent(next)}`}>
            Create an account
          </Link>
        </p>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className={styles.page} />}>
      <LoginForm />
    </Suspense>
  );
}
