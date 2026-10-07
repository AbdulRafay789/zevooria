'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAdminAuth } from './admin-auth-provider';
import { AdminNotificationBell } from './admin-notification-bell';
import {
  firstAllowedPath,
  hasPermission,
  permissionForPath,
  visibleNavItems,
} from '../lib/admin-permissions';
import styles from '../app/admin.module.css';

function navClass(pathname: string, href: string): string {
  const active =
    href === '/'
      ? pathname === '/'
      : pathname === href || pathname.startsWith(`${href}/`);
  return active ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink;
}

export function AdminShell({
  title,
  lede,
  children,
}: {
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  const { user, ready, logout } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !user) {
      router.replace('/login');
    }
  }, [ready, user, router]);

  useEffect(() => {
    if (!ready || !user) {
      return;
    }
    const required = permissionForPath(pathname);
    if (!required) {
      return;
    }
    if (!hasPermission(user, required)) {
      const fallback = firstAllowedPath(user);
      router.replace(fallback ?? '/login');
    }
  }, [ready, user, pathname, router]);

  if (!ready || !user) {
    return (
      <div className={styles.shell}>
        <main className={styles.main}>
          <p className={styles.lede}>Loading…</p>
        </main>
      </div>
    );
  }

  const navItems = visibleNavItems(user);
  const homeHref = firstAllowedPath(user) ?? '/login';
  const required = permissionForPath(pathname);
  const allowedHere = !required || hasPermission(user, required);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href={homeHref} className={styles.brand}>
          <Image
            src="/brand/logo.png"
            alt="Zevooria Ops"
            width={200}
            height={52}
            className={styles.brandLogo}
            priority
          />
          <span className={styles.brandOps}>Ops</span>
        </Link>
        <nav className={styles.nav} aria-label="Admin">
          {hasPermission(user, 'notifications:read') ? (
            <AdminNotificationBell />
          ) : null}
          {navItems.map((item) => (
            <Link
              key={`${item.href}:${item.label}`}
              href={item.href}
              className={navClass(pathname, item.href)}
            >
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            className={styles.logout}
            onClick={() => {
              void logout().then(() => router.push('/login'));
            }}
          >
            Log out
          </button>
        </nav>
      </header>
      <main className={styles.main}>
        <p className={styles.eyebrow}>{user.fullName}</p>
        <h1 className={styles.title}>{title}</h1>
        {lede ? <p className={styles.lede}>{lede}</p> : null}
        {navItems.length === 0 ? (
          <p className={styles.error}>
            Your account has no permissions assigned. Ask an admin to grant
            access, then sign in again.
          </p>
        ) : null}
        {allowedHere ? children : (
          <p className={styles.lede}>Redirecting…</p>
        )}
      </main>
    </div>
  );
}
