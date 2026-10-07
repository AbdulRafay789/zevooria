'use client';

import { FormEvent, useState } from 'react';
import { AccountShell } from '../account-shell';
import { PasswordField } from '../../../components/password-field';
import { useAuth } from '../../../components/auth-provider';
import { CommerceApiError } from '../../../lib/commerce-api';
import {
  PASSWORD_POLICY_MESSAGE,
  validateChangePasswordFields,
  type FieldErrors,
} from '../../../lib/form-validation';
import styles from '../account.module.css';

export default function ChangePasswordPage() {
  const { changePassword } = useAuth();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) {
      return;
    }
    setError(null);
    setSuccess(false);
    const form = new FormData(event.currentTarget);
    const payload = {
      currentPassword: String(form.get('currentPassword') ?? ''),
      newPassword: String(form.get('newPassword') ?? ''),
      confirmNewPassword: String(form.get('confirmNewPassword') ?? ''),
    };
    const localErrors = validateChangePasswordFields(payload);
    setFieldErrors(localErrors);
    if (Object.keys(localErrors).length > 0) {
      return;
    }

    setPending(true);
    try {
      await changePassword(payload);
      setSuccess(true);
      setFormKey((value) => value + 1);
      setFieldErrors({});
    } catch (err: unknown) {
      setError(
        err instanceof CommerceApiError
          ? err.message
          : 'Unable to change password.',
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <AccountShell
      title="Password & security"
      lede="Choose a strong password. Other sessions will be signed out."
    >
      <form
        key={formKey}
        className={`${styles.form} ${styles.narrow}`}
        onSubmit={onSubmit}
        noValidate
      >
        <PasswordField
          name="currentPassword"
          label="Current password"
          autoComplete="current-password"
          error={fieldErrors.currentPassword}
        />
        <PasswordField
          name="newPassword"
          label="New password"
          autoComplete="new-password"
          error={fieldErrors.newPassword}
          hint={PASSWORD_POLICY_MESSAGE}
        />
        <PasswordField
          name="confirmNewPassword"
          label="Confirm new password"
          autoComplete="new-password"
          error={fieldErrors.confirmNewPassword}
        />
        {error ? <p className={styles.error}>{error}</p> : null}
        {success ? (
          <p className={styles.success}>Password updated successfully.</p>
        ) : null}
        <button type="submit" className={styles.primaryBtn} disabled={pending}>
          {pending ? 'Updating…' : 'Change password'}
        </button>
      </form>
    </AccountShell>
  );
}
