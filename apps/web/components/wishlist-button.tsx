'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './auth-provider';
import {
  getWishlistItems,
  isInWishlist,
  saveWishlistItems,
  toggleWishlistItem,
} from '../lib/wishlist';
import styles from './wishlist-button.module.css';

type WishlistButtonProps = {
  productId: string;
  slug: string;
  className?: string;
};

export function WishlistButton({
  productId,
  slug,
  className,
}: WishlistButtonProps) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [on, setOn] = useState(false);

  useEffect(() => {
    const sync = () => setOn(isInWishlist(getWishlistItems(), productId));
    sync();
    window.addEventListener('zevooria-wishlist-change', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('zevooria-wishlist-change', sync);
      window.removeEventListener('storage', sync);
    };
  }, [productId]);

  return (
    <button
      type="button"
      className={className ?? styles.wish}
      aria-pressed={on}
      aria-label={on ? 'Remove from wishlist' : 'Save to wishlist'}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!user) {
          router.push(
            `/login?next=${encodeURIComponent(pathname || `/products/${slug}`)}`,
          );
          return;
        }
        const next = toggleWishlistItem(getWishlistItems(), {
          id: productId,
          slug,
        });
        saveWishlistItems(next);
        setOn(isInWishlist(next, productId));
      }}
    >
      {on ? '♥' : '♡'}
    </button>
  );
}
