'use client';

import styles from './session-keep-alive-modal.module.css';

type SessionKeepAliveModalProps = {
  open: boolean;
  busy: boolean;
  onKeepAlive: () => void;
  onLogout: () => void;
};

export function SessionKeepAliveModal({
  open,
  busy,
  onKeepAlive,
  onLogout,
}: SessionKeepAliveModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className={styles.root} role="dialog" aria-modal="true" aria-labelledby="session-keep-alive-title">
      <div className={styles.backdrop} />
      <div className={styles.panel}>
        <p className={styles.eyebrow}>Session</p>
        <h2 id="session-keep-alive-title" className={styles.title}>
          Stay signed in?
        </h2>
        <p className={styles.lede}>
          Your session expires in about 30 seconds. Keep shopping signed in, or
          log out now.
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            disabled={busy}
            onClick={onKeepAlive}
          >
            {busy ? 'Refreshing…' : 'Keep me logged in'}
          </button>
          <button
            type="button"
            className={styles.ghost}
            disabled={busy}
            onClick={onLogout}
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
