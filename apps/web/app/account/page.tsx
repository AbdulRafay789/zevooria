'use client';

import Link from 'next/link';
import { AccountShell } from './account-shell';
import { useAuth } from '../../components/auth-provider';
import styles from './account.module.css';

export default function AccountOverviewPage() {
  const { user } = useAuth();
  const firstName = user?.fullName?.split(/\s+/)[0] || 'there';

  return (
    <AccountShell
      title="Welcome back"
      lede={`${firstName}, manage your orders and account security.`}
    >
      <div className={styles.overviewGrid}>
        <Link href="/account/profile" className={styles.overviewLink}>
          <p className={styles.overviewLinkTitle}>Profile</p>
          <p className={styles.overviewLinkText}>
            Update your name and phone, or deactivate your account.
          </p>
        </Link>
        <Link href="/account/orders" className={styles.overviewLink}>
          <p className={styles.overviewLinkTitle}>My orders</p>
          <p className={styles.overviewLinkText}>
            Review cash-on-delivery orders, delivery details, and write reviews.
          </p>
        </Link>
        <Link href="/account/change-password" className={styles.overviewLink}>
          <p className={styles.overviewLinkTitle}>Password &amp; security</p>
          <p className={styles.overviewLinkText}>
            Update your password. Other sessions will be signed out.
          </p>
        </Link>
        <Link href="/verify-email" className={styles.overviewLink}>
          <p className={styles.overviewLinkTitle}>Email verification</p>
          <p className={styles.overviewLinkText}>
            {user?.emailVerifiedAt
              ? 'Your email is verified.'
              : 'Verify your email with a one-time token from your inbox (or API logs locally).'}
          </p>
        </Link>
      </div>
    </AccountShell>
  );
}
