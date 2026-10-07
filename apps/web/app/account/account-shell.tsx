'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { RequireAuth } from '../../components/require-auth';
import { useAuth } from '../../components/auth-provider';
import {
  fetchOrder,
  fetchReviewProducts,
} from '../../lib/commerce-api';
import styles from './account.module.css';

const BASE_NAV = [
  { href: '/account', label: 'Overview', match: 'exact' as const },
  { href: '/account/profile', label: 'Profile', match: 'exact' as const },
  { href: '/account/addresses', label: 'Addresses', match: 'exact' as const },
  { href: '/account/orders', label: 'My orders', match: 'prefix' as const },
  {
    href: '/account/change-password',
    label: 'Password',
    match: 'exact' as const,
  },
];

const REVIEWABLE_STATUSES = new Set([
  'placed',
  'processing',
  'shipped',
  'delivered',
]);

function selectedOrderId(pathname: string): string | null {
  const match = pathname.match(
    /^\/account\/orders\/([0-9a-f-]{36})(?:\/review)?$/i,
  );
  return match?.[1] ?? null;
}

function AccountShellInner({
  title,
  eyebrow = 'Account',
  lede,
  children,
}: {
  title: string;
  eyebrow?: string;
  lede?: string;
  children: ReactNode;
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const orderId = selectedOrderId(pathname);
  const [showReviewNav, setShowReviewNav] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setShowReviewNav(false);
      return;
    }
    let cancelled = false;
    Promise.all([fetchOrder(orderId), fetchReviewProducts(orderId)])
      .then(([order, review]) => {
        if (cancelled) {
          return;
        }
        const canWrite =
          REVIEWABLE_STATUSES.has(order.status) &&
          review.products.some((product) => !product.alreadyReviewed);
        setShowReviewNav(canWrite);
      })
      .catch(() => {
        if (!cancelled) {
          setShowReviewNav(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (!user) {
    return null;
  }

  const onLogout = async () => {
    await logout();
    window.location.assign('/login');
  };

  const reviewHref = orderId
    ? `/account/orders/${orderId}/review`
    : null;

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.nav} aria-label="Account">
          <p className={styles.navEyebrow}>Account</p>
          <p className={styles.navName}>{user.fullName}</p>
          <p className={styles.navEmail}>{user.email}</p>
          <nav className={styles.navList}>
            {BASE_NAV.map((item) => {
              const active =
                item.match === 'exact'
                  ? pathname === item.href
                  : item.href === '/account/orders'
                    ? pathname === '/account/orders' ||
                      (/^\/account\/orders\/[^/]+$/.test(pathname) &&
                        !pathname.endsWith('/review'))
                    : pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);

              const afterOrders =
                item.href === '/account/orders' &&
                showReviewNav &&
                reviewHref ? (
                  <Link
                    key="write-review"
                    href={reviewHref}
                    className={`${styles.navLink} ${styles.navLinkReview} ${
                      pathname === reviewHref ? styles.navLinkActive : ''
                    }`}
                    aria-current={
                      pathname === reviewHref ? 'page' : undefined
                    }
                  >
                    Write a review
                  </Link>
                ) : null;

              return (
                <span key={item.href} className={styles.navItemGroup}>
                  <Link
                    href={item.href}
                    className={`${styles.navLink} ${active ? styles.navLinkActive : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                  {afterOrders}
                </span>
              );
            })}
            <button
              type="button"
              className={styles.navLogout}
              onClick={() => {
                void onLogout();
              }}
            >
              Log out
            </button>
          </nav>
        </aside>

        <main className={styles.main}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.title}>{title}</h1>
          {lede ? <p className={styles.lede}>{lede}</p> : null}
          {children}
        </main>
      </div>
    </div>
  );
}

export function AccountShell({
  title,
  eyebrow = 'Account',
  lede,
  children,
}: {
  title: string;
  eyebrow?: string;
  lede?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <RequireAuth next={pathname}>
      <AccountShellInner title={title} eyebrow={eyebrow} lede={lede}>
        {children}
      </AccountShellInner>
    </RequireAuth>
  );
}
