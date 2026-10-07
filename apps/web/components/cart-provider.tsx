'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './auth-provider';
import {
  cartItemCount,
  clearGuestCartKey,
  getOrCreateGuestCartKey,
  peekGuestCartKey,
  type CartItem,
} from '../lib/cart';
import {
  clearServerCart,
  fetchCart,
  mergeGuestCart,
  upsertCartItem,
} from '../lib/commerce-api';

type CartContextValue = {
  items: CartItem[];
  count: number;
  ready: boolean;
  addProduct: (product: { id: string; slug: string }, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeProduct: (productId: string) => void;
  clear: () => void;
  refresh: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  const guestKey = useMemo(() => {
    if (!authReady) {
      return null;
    }
    if (user) {
      return null;
    }
    return getOrCreateGuestCartKey();
  }, [authReady, user]);

  const refresh = useCallback(async () => {
    if (!authReady) {
      return;
    }
    try {
      if (user) {
        const guest = peekGuestCartKey();
        if (guest) {
          const merged = await mergeGuestCart(guest);
          clearGuestCartKey();
          setItems(merged.items);
          setReady(true);
          return;
        }
      }
      const result = await fetchCart(user ? null : guestKey);
      setItems(result.items);
    } catch {
      setItems([]);
    } finally {
      setReady(true);
    }
  }, [authReady, guestKey, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const persistQuantity = useCallback(
    async (productId: string, quantity: number, slug?: string) => {
      const key = user ? null : guestKey;
      if (!user && !key) {
        return;
      }
      const result = await upsertCartItem({ productId, quantity }, key);
      setItems(result.items);
      if (slug && quantity > 0 && !result.items.some((i) => i.productId === productId)) {
        // Product may have been inactive; keep silent.
      }
    },
    [guestKey, user],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: cartItemCount(items),
      ready: authReady && ready,
      addProduct: (product, quantity = 1) => {
        const existing = items.find((item) => item.productId === product.id);
        const nextQty = Math.min(20, (existing?.quantity ?? 0) + quantity);
        void persistQuantity(product.id, nextQty, product.slug);
        setItems((prev) => {
          const found = prev.find((item) => item.productId === product.id);
          if (found) {
            return prev.map((item) =>
              item.productId === product.id
                ? { ...item, quantity: nextQty }
                : item,
            );
          }
          return [
            ...prev,
            { productId: product.id, slug: product.slug, quantity: nextQty },
          ];
        });
      },
      setQuantity: (productId, quantity) => {
        void persistQuantity(productId, quantity);
        setItems((prev) => {
          if (quantity < 1) {
            return prev.filter((item) => item.productId !== productId);
          }
          return prev.map((item) =>
            item.productId === productId ? { ...item, quantity } : item,
          );
        });
      },
      removeProduct: (productId) => {
        void persistQuantity(productId, 0);
        setItems((prev) => prev.filter((item) => item.productId !== productId));
      },
      clear: () => {
        void clearServerCart(user ? null : guestKey);
        setItems([]);
      },
      refresh,
    }),
    [authReady, guestKey, items, persistQuantity, ready, refresh, user],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within CartProvider');
  }
  return ctx;
}
