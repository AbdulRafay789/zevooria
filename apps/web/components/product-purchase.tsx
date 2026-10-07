'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './auth-provider';
import { useCart } from './cart-provider';
import {
  getWishlistItems,
  isInWishlist,
  saveWishlistItems,
  toggleWishlistItem,
} from '../lib/wishlist';
import styles from './product-purchase.module.css';

type ProductPurchaseProps = {
  productId: string;
  slug: string;
  available?: boolean;
  availableQuantity?: number;
};

export function ProductPurchase({
  productId,
  slug,
  available = true,
  availableQuantity,
}: ProductPurchaseProps) {
  const { user, ready } = useAuth();
  const { addProduct } = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const [qty, setQty] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [wishListed, setWishListed] = useState(false);

  const maxQty =
    typeof availableQuantity === 'number'
      ? Math.max(0, Math.min(20, availableQuantity))
      : 20;
  const inStock = available && maxQty > 0;

  useEffect(() => {
    const sync = () => {
      setWishListed(isInWishlist(getWishlistItems(), productId));
    };
    sync();
    window.addEventListener('zevooria-wishlist-change', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('zevooria-wishlist-change', sync);
      window.removeEventListener('storage', sync);
    };
  }, [productId]);

  const requireLogin = () => {
    const next = pathname || `/products/${slug}`;
    router.push(`/login?next=${encodeURIComponent(next)}`);
  };

  const onAdd = () => {
    if (!inStock || !ready) {
      return;
    }
    addProduct({ id: productId, slug }, Math.min(qty, maxQty));
    setFeedback('Added to bag');
    window.setTimeout(() => setFeedback(null), 1800);
  };

  const onWish = () => {
    if (!user) {
      requireLogin();
      return;
    }
    const next = toggleWishlistItem(getWishlistItems(), {
      id: productId,
      slug,
    });
    saveWishlistItems(next);
    setWishListed(isInWishlist(next, productId));
  };

  return (
    <div className={styles.root}>
      <div className={styles.row}>
        <div className={styles.qty} role="group" aria-label="Quantity">
          <button
            type="button"
            className={styles.qtyBtn}
            aria-label="Decrease quantity"
            disabled={!inStock}
            onClick={() => setQty((value) => Math.max(1, value - 1))}
          >
            −
          </button>
          <span className={styles.qtyValue} aria-live="polite">
            {qty}
          </span>
          <button
            type="button"
            className={styles.qtyBtn}
            aria-label="Increase quantity"
            disabled={!inStock}
            onClick={() =>
              setQty((value) => Math.min(Math.max(maxQty, 1), value + 1))
            }
          >
            +
          </button>
        </div>

        <button
          type="button"
          className={styles.wish}
          aria-pressed={wishListed}
          aria-label={
            wishListed ? 'Remove from wishlist' : 'Save to wishlist'
          }
          onClick={onWish}
        >
          {wishListed ? '♥' : '♡'}
        </button>
      </div>

      <button
        type="button"
        className={styles.add}
        onClick={onAdd}
        disabled={!inStock}
        aria-disabled={!inStock}
      >
        {!user && ready
          ? 'Sign in to add'
          : inStock
            ? 'Add to bag'
            : 'Out of stock'}
      </button>

      {typeof availableQuantity === 'number' ? (
        <p className={styles.stockNote}>
          {inStock
            ? `${availableQuantity} available`
            : 'Out of stock'}
        </p>
      ) : null}

      {feedback ? (
        <p className={styles.feedback} role="status">
          {feedback}
        </p>
      ) : null}

      <ul className={styles.notes}>
        <li>Cash on delivery at checkout.</li>
       {user ? null : <li>Sign in required to add items to your bag.</li>}
        <li>
          Bag totals and stocks will be confirmed once you are logged in and place an order.
        </li>
      </ul>
    </div>
  );
}
