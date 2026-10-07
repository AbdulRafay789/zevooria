'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { PasswordField } from '../../components/password-field';
import { PhoneField } from '../../components/phone-field';
import { useAuth } from '../../components/auth-provider';
import { CommerceApiError } from '../../lib/commerce-api';
import {
  PASSWORD_POLICY_MESSAGE,
  normalizeEmail,
  normalizePakistanPhone,
  validateRegisterFields,
  type FieldErrors,
} from '../../lib/form-validation';
import styles from '../auth-forms.module.css';

function RegisterForm() {
  const { register } = useAuth();
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
    const payload = {
      fullName: String(form.get('fullName') ?? ''),
      email: String(form.get('email') ?? ''),
      phone: String(form.get('phone') ?? ''),
      password: String(form.get('password') ?? ''),
      confirmPassword: String(form.get('confirmPassword') ?? ''),
    };
    const localErrors = validateRegisterFields(payload);
    setFieldErrors(localErrors);
    if (Object.keys(localErrors).length > 0) {
      return;
    }

    setPending(true);
    try {
      const phone = normalizePakistanPhone(payload.phone);
      if (!phone) {
        setFieldErrors({ phone: 'Enter a valid Pakistan mobile number.' });
        setPending(false);
        return;
      }
      await register({
        email: normalizeEmail(payload.email),
        password: payload.password,
        fullName: payload.fullName.trim(),
        phone,
      });
      router.push(next);
    } catch (err) {
      setError(
        err instanceof CommerceApiError
          ? err.message
          : 'Unable to create account. Please try again.',
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <p className={styles.eyebrow}>Account</p>
        <h1 className={styles.title}>Create account</h1>
        <p className={styles.lede}>
          Create an account to place cash-on-delivery orders and view order
          history.
        </p>

        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <label className={styles.field}>
            <span>Full name</span>
            <input
              name="fullName"
              type="text"
              autoComplete="name"
              aria-invalid={Boolean(fieldErrors.fullName)}
            />
            {fieldErrors.fullName ? (
              <span className={styles.fieldError}>{fieldErrors.fullName}</span>
            ) : null}
          </label>
          <label className={styles.field}>
            <span>Email</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(fieldErrors.email)}
            />
            {fieldErrors.email ? (
              <span className={styles.fieldError}>{fieldErrors.email}</span>
            ) : null}
          </label>
          <PhoneField name="phone" error={fieldErrors.phone} />
          <PasswordField
            name="password"
            label="Password"
            autoComplete="new-password"
            error={fieldErrors.password}
            hint={PASSWORD_POLICY_MESSAGE}
          />
          <PasswordField
            name="confirmPassword"
            label="Confirm password"
            autoComplete="new-password"
            error={fieldErrors.confirmPassword}
          />
          {error ? <p className={styles.error}>{error}</p> : null}
          <button type="submit" className={styles.submit} disabled={pending}>
            {pending ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <p className={styles.alt}>
          Already have an account?{' '}
          <Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
        </p>
      </main>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className={styles.page} />}>
      <RegisterForm />
    </Suspense>
  );
}
