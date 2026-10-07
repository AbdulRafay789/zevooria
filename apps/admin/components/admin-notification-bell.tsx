'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  AdminApiError,
  fetchAdminNotifications,
  formatDate,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  openAdminNotificationStream,
  type AdminNotificationItem,
} from '../lib/admin-api';
import styles from '../app/admin.module.css';

export function AdminNotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdminNotifications(12)
      .then((result) => {
        if (!cancelled) {
          setItems(result.items);
          setUnreadCount(result.unreadCount);
        }
      })
      .catch(() => {
        // Bell is best-effort.
      });

    const source = openAdminNotificationStream((payload) => {
      if ('type' in payload && payload.type === 'connected') {
        return;
      }
      const item = payload as AdminNotificationItem;
      if (!item.id) {
        return;
      }
      setItems((prev) => [item, ...prev.filter((row) => row.id !== item.id)].slice(0, 20));
      setUnreadCount((prev) => prev + 1);
      setToast(item.title);
      window.setTimeout(() => setToast(null), 5000);
    });

    return () => {
      cancelled = true;
      source?.close();
    };
  }, []);

  async function onMarkRead(id: string) {
    try {
      const updated = await markAdminNotificationRead(id);
      setItems((prev) =>
        prev.map((row) => (row.id === id ? { ...row, ...updated } : row)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err: unknown) {
      if (!(err instanceof AdminApiError)) {
        return;
      }
    }
  }

  async function onMarkAll() {
    try {
      await markAllAdminNotificationsRead();
      setItems((prev) =>
        prev.map((row) => ({
          ...row,
          readAt: row.readAt ?? new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }

  return (
    <div className={styles.notifWrap}>
      <button
        type="button"
        className={styles.notifBell}
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        Alerts
        {unreadCount > 0 ? (
          <span className={styles.notifBadge}>{unreadCount}</span>
        ) : null}
      </button>
      {toast ? <div className={styles.notifToast}>{toast}</div> : null}
      {open ? (
        <div className={styles.notifDropdown} role="dialog" aria-label="Notifications">
          <div className={styles.notifDropdownHeader}>
            <strong>Notifications</strong>
            <button type="button" className={styles.ghostBtn} onClick={() => void onMarkAll()}>
              Mark all read
            </button>
          </div>
          {items.length === 0 ? (
            <p className={styles.meta}>No notifications yet.</p>
          ) : (
            <ul className={styles.bellList}>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={
                      item.readAt ? styles.bellItem : styles.bellItemUnread
                    }
                    onClick={() => {
                      if (!item.readAt) {
                        void onMarkRead(item.id);
                      }
                      if (item.resourceType === 'order' && item.resourceId) {
                        window.location.href = `/orders/${item.resourceId}`;
                      }
                    }}
                  >
                    <span className={styles.orderNumber}>{item.title}</span>
                    <span className={styles.meta}>{item.body}</span>
                    <time
                      className={styles.meta}
                      dateTime={item.createdAt}
                    >
                      {formatDate(item.createdAt)}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link href="/notifications" className={styles.navLink} onClick={() => setOpen(false)}>
            Notification settings
          </Link>
        </div>
      ) : null}
    </div>
  );
}
