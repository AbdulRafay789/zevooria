'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PasswordField } from '../../components/password-field';
import {
  CommerceApiError,
  resetPasswordWithToken,
} from '../../lib/commerce-api';
import {
  validatePasswordValue,
  type FieldErrors,
} from '../../lib/form-validation';
import styles from '../auth-forms.module.css';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const tokenFromUrl = (searchParams.get('token') ?? '').trim();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) {
      return;
    }
    setError(null);
    const form = new FormData(event.currentTarget);
    const token = String(form.get('token') ?? '').trim();
    const newPassword = String(form.get('newPassword') ?? '');
    const confirmNewPassword = String(form.get('confirmNewPassword') ?? '');
    const localErrors: FieldErrors = {};
    if (!token) {
      localErrors.token = 'Reset token is required.';
    }
    const passwordError = validatePasswordValue(newPassword);
    if (passwordError) {
      localErrors.password = passwordError;
    }
    if (!confirmNewPassword) {
      localErrors.confirmPassword = 'Confirm your password.';
    } else if (newPassword !== confirmNewPassword) {
      localErrors.confirmPassword = 'Passwords do not match.';
    }
    setFieldErrors(localErrors);
    if (Object.keys(localErrors).length > 0) {
      return;
    }
    setPending(true);
    try {
      await resetPasswordWithToken({
        token,
        newPassword,
        confirmNewPassword,
      });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof CommerceApiError
          ? err.message
          : 'Unable to reset password.',
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <p className={styles.eyebrow}>Account</p>
        <h1 className={styles.title}>Reset password</h1>
        {done ? (
          <p className={styles.lede}>
            Password updated.{' '}
            <Link href="/login">Sign in</Link> with your new password.
          </p>
        ) : (
          <>
            <p className={styles.lede}>
              Open the link from your email, or paste the one-time token below,
              then choose a new password.
            </p>
            <form className={styles.form} onSubmit={onSubmit} noValidate>
              <label className={styles.field}>
                <span>Reset token</span>
                <input
                  name="token"
                  autoComplete="off"
                  defaultValue={tokenFromUrl}
                />
                {fieldErrors.token ? (
                  <span className={styles.fieldError}>{fieldErrors.token}</span>
                ) : null}
              </label>
              <PasswordField
                name="newPassword"
                label="New password"
                autoComplete="new-password"
                error={fieldErrors.password}
              />
              <PasswordField
                name="confirmNewPassword"
                label="Confirm password"
                autoComplete="new-password"
                error={fieldErrors.confirmPassword}
              />
              {error ? <p className={styles.error}>{error}</p> : null}
              <button
                type="submit"
                className={styles.submit}
                disabled={pending}
              >
                {pending ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
        <p className={styles.alt}>
          <Link href="/login">Back to sign in</Link>
        </p>
      </main>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className={styles.page} />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
