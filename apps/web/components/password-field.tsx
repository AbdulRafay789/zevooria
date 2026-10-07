'use client';

import { useId, useState } from 'react';
import styles from '../app/auth-forms.module.css';

type PasswordFieldProps = {
  name: string;
  label: string;
  autoComplete?: string;
  error?: string;
  hint?: string;
  defaultValue?: string;
};

export function PasswordField({
  name,
  label,
  autoComplete,
  error,
  hint,
  defaultValue,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const inputId = useId();
  const errorId = useId();

  return (
    <label className={styles.field} htmlFor={inputId}>
      <span>{label}</span>
      <span className={styles.passwordRow}>
        <input
          id={inputId}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
        <button
          type="button"
          className={styles.passwordToggle}
          aria-pressed={visible}
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </span>
      {hint && !error ? <span className={styles.hint}>{hint}</span> : null}
      {error ? (
        <span id={errorId} className={styles.fieldError}>
          {error}
        </span>
      ) : null}
    </label>
  );
}
