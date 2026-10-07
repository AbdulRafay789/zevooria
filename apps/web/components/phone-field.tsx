'use client';

import { useId, useState, type ChangeEvent } from 'react';
import {
  isValidPakistanPhone,
  normalizePakistanPhone,
  PK_PHONE_MESSAGE,
  PK_PHONE_NATIONAL_LENGTH,
  PK_PHONE_PREFIX,
  phoneDigitsOnly,
  toPakistanNationalDisplay,
} from '../lib/phone';
import styles from '../app/auth-forms.module.css';

type PhoneFieldProps = {
  name?: string;
  label?: string;
  defaultValue?: string | null;
  error?: string;
  autoComplete?: string;
  required?: boolean;
};

/**
 * Locked +92 prefix + 11-digit national mobile (03XXXXXXXXX).
 * Hidden input submits E.164 (+923XXXXXXXXX) only when valid.
 */
export function PhoneField({
  name = 'phone',
  label = 'Phone',
  defaultValue,
  error,
  autoComplete = 'tel-national',
  required = true,
}: PhoneFieldProps) {
  const inputId = useId();
  const [national, setNational] = useState(() =>
    toPakistanNationalDisplay(defaultValue),
  );

  const normalized = normalizePakistanPhone(national);
  const e164 = normalized ?? '';

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const digits = phoneDigitsOnly(event.target.value).slice(
      0,
      PK_PHONE_NATIONAL_LENGTH,
    );
    setNational(digits);
  }

  return (
    <label className={styles.field} htmlFor={inputId}>
      <span className={styles.fieldLabel}>{label}</span>
      <div
        className={styles.phoneRow}
        data-country-code={PK_PHONE_PREFIX}
      >
        <b className={styles.phonePrefix} aria-hidden="true">
          {PK_PHONE_PREFIX}
        </b>
        <input
          id={inputId}
          type="tel"
          inputMode="numeric"
          autoComplete={autoComplete}
          value={national}
          onChange={onChange}
          maxLength={PK_PHONE_NATIONAL_LENGTH}
          minLength={PK_PHONE_NATIONAL_LENGTH}
          pattern="03[0-9]{9}"
          placeholder="03XXXXXXXXX"
          title={PK_PHONE_MESSAGE}
          aria-invalid={
            Boolean(error) ||
            (national.length > 0 && !isValidPakistanPhone(national))
          }
          aria-describedby={error ? `${inputId}-error` : `${inputId}-hint`}
          required={required}
        />
      </div>
      <input type="hidden" name={name} value={e164} readOnly />
      {error ? (
        <span id={`${inputId}-error`} className={styles.fieldError}>
          {error}
        </span>
      ) : (
        <span id={`${inputId}-hint`} className={styles.hint}>
          {PK_PHONE_MESSAGE}
        </span>
      )}
    </label>
  );
}
