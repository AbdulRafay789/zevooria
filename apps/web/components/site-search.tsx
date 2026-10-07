'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Product } from '../lib/types';
import {
  formatProductPrice,
  getPrimaryImage,
  storageKeyToPublicUrl,
} from '../lib/catalog';
import { filterAndSortProducts } from '../lib/collection-filters';
import styles from './site-search.module.css';

type SiteSearchProps = {
  open: boolean;
  onClose: () => void;
  products: Product[];
};

export function SiteSearch({ open, onClose, products }: SiteSearchProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const [query, setQuery] = useState('');

  const results = useMemo(
    () =>
      query.trim()
        ? filterAndSortProducts(products, {
            categories: [],
            sort: 'recommended',
            q: query.trim(),
          }).slice(0, 10)
        : [],
    [products, query],
  );

  const close = useCallback(() => {
    setQuery('');
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }
    restoreRef.current = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      restoreRef.current?.focus?.();
    };
  }, [open, close]);

  if (!open) {
    return null;
  }

  return (
    <div className={styles.root} role="presentation">
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.bar}>
          <p id={titleId} className={styles.kicker}>
            Search
          </p>
          <button type="button" className={styles.close} onClick={close}>
            Close
          </button>
        </div>

        <label className={styles.label} htmlFor="site-search-input">
          Search products
        </label>
        <input
          id="site-search-input"
          ref={inputRef}
          className={styles.input}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search products"
          autoComplete="off"
        />

        <div className={styles.results} aria-live="polite">
          {query.trim() && results.length === 0 ? (
            <div className={styles.empty}>
              <p>No results found</p>
              <button
                type="button"
                className={styles.clear}
                onClick={() => setQuery('')}
              >
                Clear search
              </button>
            </div>
          ) : null}

          {results.length > 0 ? (
            <ul className={styles.list}>
              {results.map((product) => {
                const image = getPrimaryImage(
                  product.media.filter((media) => media.type === 'image'),
                );
                return (
                  <li key={product.id}>
                    <Link
                      href={`/products/${product.slug}`}
                      className={styles.result}
                      onClick={close}
                    >
                      <span className={styles.thumb}>
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={storageKeyToPublicUrl(image.storageKey)}
                            alt=""
                            loading="lazy"
                          />
                        ) : null}
                      </span>
                      <span className={styles.meta}>
                        <span className={styles.name}>{product.name}</span>
                        <span className={styles.price}>
                          {formatProductPrice(product.currency, product.price)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {!query.trim() ? (
            <p className={styles.hint}>Search the Zevooria fragrance catalog.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
