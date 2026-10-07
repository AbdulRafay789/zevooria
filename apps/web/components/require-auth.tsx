'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './auth-provider';

type RequireAuthProps = {
  children: ReactNode;
  /** Override redirect target after login (defaults to current path). */
  next?: string;
};

/**
 * Client gate for authenticated storefront routes.
 * Redirects guests to login and re-checks on bfcache back/forward.
 */
export function RequireAuth({ children, next }: RequireAuthProps) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const redirectTo = next ?? pathname ?? '/account';

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(redirectTo)}`);
    }
  }, [ready, user, router, redirectTo]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && !user) {
        router.replace(`/login?next=${encodeURIComponent(redirectTo)}`);
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [user, router, redirectTo]);

  if (!ready || !user) {
    return (
      <div style={{ padding: '3rem var(--space-page, 1.25rem)' }}>
        <p>Checking your session…</p>
      </div>
    );
  }

  return children;
}
