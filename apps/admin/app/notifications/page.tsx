'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '../../components/admin-shell';
import {
  AdminPagination,
  useClientPagination,
} from '../../components/admin-pagination';
import {
  AdminApiError,
  fetchAdminNotificationPreferences,
  fetchAdminNotifications,
  fetchVapidPublicKey,
  formatDate,
  markAdminNotificationRead,
  subscribeAdminPush,
  updateAdminNotificationPreferences,
  type AdminNotificationItem,
} from '../../lib/admin-api';
import styles from '../admin.module.css';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export default function AdminNotificationsPage() {
  const [items, setItems] = useState<AdminNotificationItem[]>([]);
  const [orderPlaced, setOrderPlaced] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const pager = useClientPagination(items, 15);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchAdminNotifications(100),
      fetchAdminNotificationPreferences(),
    ])
      .then(([list, prefs]) => {
        if (cancelled) {
          return;
        }
        setItems(list.items);
        setOrderPlaced(prefs.orderPlaced);
        setPushEnabled(prefs.pushEnabled);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof AdminApiError
              ? err.message
              : 'Unable to load notifications.',
          );
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function savePrefs(next: {
    orderPlaced?: boolean;
    pushEnabled?: boolean;
  }) {
    setError(null);
    setNotice(null);
    try {
      const prefs = await updateAdminNotificationPreferences(next);
      setOrderPlaced(prefs.orderPlaced);
      setPushEnabled(prefs.pushEnabled);
      setNotice('Preferences saved.');
    } catch (err: unknown) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to save preferences.',
      );
    }
  }

  async function enablePush() {
    setError(null);
    setNotice(null);
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setError('This browser does not support Web Push.');
        return;
      }
      const { publicKey } = await fetchVapidPublicKey();
      if (!publicKey) {
        setError(
          'Web Push is not configured on the server (missing VAPID keys).',
        );
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Notification permission was not granted.');
        return;
      }
      const registration = await navigator.serviceWorker.register(
        '/sw-admin-push.js',
      );
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setError('Push subscription was incomplete.');
        return;
      }
      await subscribeAdminPush({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      });
      await savePrefs({ pushEnabled: true });
      setNotice('Browser push enabled for this device.');
    } catch (err: unknown) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to enable browser push.',
      );
    }
  }

  return (
    <AdminShell
      title="Notifications"
      lede="In-app alerts for new orders (SSE) and optional browser Web Push. Requires notifications:read."
    >
      {error ? <p className={styles.error}>{error}</p> : null}
      {notice ? <p className={styles.success}>{notice}</p> : null}

      <section className={styles.section} aria-labelledby="prefs-heading">
        <h2 id="prefs-heading" className={styles.sectionTitle}>
          Preferences
        </h2>
        <div className={styles.prefStack}>
          <label className={styles.toggleRow}>
            <span className={styles.toggleCopy}>
              <strong>Order placed</strong>
              <em>Notify when a customer places a COD order</em>
            </span>
            <input
              className={styles.toggleInput}
              type="checkbox"
              role="switch"
              checked={orderPlaced}
              onChange={(event) => {
                const value = event.target.checked;
                setOrderPlaced(value);
                void savePrefs({ orderPlaced: value });
              }}
            />
          </label>
          <label className={styles.toggleRow}>
            <span className={styles.toggleCopy}>
              <strong>Browser push</strong>
              <em>Push alerts on this device when enabled</em>
            </span>
            <input
              className={styles.toggleInput}
              type="checkbox"
              role="switch"
              checked={pushEnabled}
              onChange={(event) => {
                const value = event.target.checked;
                if (value) {
                  void enablePush();
                } else {
                  void savePrefs({ pushEnabled: false });
                }
              }}
            />
          </label>
        </div>
        <div className={styles.notifActions}>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => {
              void enablePush();
            }}
          >
            Re-subscribe this browser
          </button>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="recent-heading">
        <h2 id="recent-heading" className={styles.sectionTitle}>
          Recent
        </h2>
        {!loaded ? <p className={styles.lede}>Loading…</p> : null}
        {loaded && items.length === 0 ? (
          <p className={styles.lede}>No notifications yet.</p>
        ) : null}
        {loaded && items.length > 0 ? (
          <>
            <ul className={styles.notifList}>
              {pager.pageItems.map((item) => (
                <li key={item.id} className={styles.notifItem}>
                  <p className={styles.orderNumber}>{item.title}</p>
                  <p className={styles.meta}>{item.body}</p>
                  <p className={styles.meta}>{formatDate(item.createdAt)}</p>
                  <div className={styles.notifActions}>
                    {!item.readAt ? (
                      <button
                        type="button"
                        className={styles.ghostBtn}
                        onClick={() => {
                          void markAdminNotificationRead(item.id).then(
                            (updated) => {
                              setItems((prev) =>
                                prev.map((row) =>
                                  row.id === item.id
                                    ? { ...row, ...updated }
                                    : row,
                                ),
                              );
                            },
                          );
                        }}
                      >
                        Mark read
                      </button>
                    ) : (
                      <span className={styles.meta}>Read</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <AdminPagination
              page={pager.page}
              totalPages={pager.totalPages}
              total={pager.total}
              pageSize={pager.pageSize}
              onPageChange={pager.setPage}
            />
          </>
        ) : null}
      </section>
    </AdminShell>
  );
}
