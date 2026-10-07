'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Product } from '../lib/types';
import {
  CATEGORY_OPTIONS,
  type CatalogCategory,
  type CollectionQuery,
  type SortOption,
  buildCollectionSearchParams,
  filterAndSortProducts,
  parseCollectionQuery,
  priceBounds,
} from '../lib/collection-filters';
import { ProductGrid } from './product-grid';
import { RecentlyViewed } from './recently-viewed';
import styles from './collection-browser.module.css';

type CollectionBrowserProps = {
  products: Product[];
};

export function CollectionBrowser({ products }: CollectionBrowserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const bounds = useMemo(() => priceBounds(products), [products]);

  const query = useMemo(
    () => parseCollectionQuery(searchParams),
    [searchParams],
  );

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftMin, setDraftMin] = useState(
    query.min != null ? String(Math.round(query.min)) : '',
  );
  const [draftMax, setDraftMax] = useState(
    query.max != null ? String(Math.round(query.max)) : '',
  );
  const [draftCategories, setDraftCategories] = useState<CatalogCategory[]>(
    query.categories,
  );

  useEffect(() => {
    setDraftMin(query.min != null ? String(Math.round(query.min)) : '');
    setDraftMax(query.max != null ? String(Math.round(query.max)) : '');
    setDraftCategories(query.categories);
  }, [query.min, query.max, query.categories]);

  const filtered = useMemo(
    () => filterAndSortProducts(products, query),
    [products, query],
  );

  const pushQuery = useCallback(
    (next: CollectionQuery) => {
      const params = buildCollectionSearchParams(next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const applyFilters = () => {
    const min = draftMin.trim() === '' ? undefined : Number(draftMin);
    const max = draftMax.trim() === '' ? undefined : Number(draftMax);
    pushQuery({
      ...query,
      min: Number.isFinite(min) ? min : undefined,
      max: Number.isFinite(max) ? max : undefined,
      categories: draftCategories,
    });
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    setDraftMin('');
    setDraftMax('');
    setDraftCategories([]);
    pushQuery({
      ...query,
      min: undefined,
      max: undefined,
      categories: [],
    });
    setFiltersOpen(false);
  };

  const toggleCategory = (value: CatalogCategory) => {
    setDraftCategories((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };

  const onSortChange = (sort: SortOption) => {
    pushQuery({ ...query, sort });
  };

  const countLabel =
    filtered.length === 1 ? '1 fragrance' : `${filtered.length} fragrances`;

  const filterPanel = (
    <div className={styles.filterBody}>
      <div className={styles.filterBlock}>
        <p className={styles.filterHeading}>Price</p>
        <p className={styles.filterHint}>
          Catalog range PKR {Math.round(bounds.min)} – {Math.round(bounds.max)}
        </p>
        <div className={styles.priceRow}>
          <label className={styles.field}>
            <span>Min</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={draftMin}
              onChange={(event) => setDraftMin(event.target.value)}
              placeholder="PKR"
            />
          </label>
          <label className={styles.field}>
            <span>Max</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={draftMax}
              onChange={(event) => setDraftMax(event.target.value)}
              placeholder="PKR"
            />
          </label>
        </div>
      </div>

      <div className={styles.filterBlock}>
        <p className={styles.filterHeading}>Category</p>
        <ul className={styles.checkList}>
          {CATEGORY_OPTIONS.map((option) => (
            <li key={option.value}>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={draftCategories.includes(option.value)}
                  onChange={() => toggleCategory(option.value)}
                />
                <span>{option.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <p className={styles.brandNote}>
        Brand filter will appear when multiple houses are available. All current
        fragrances are Zevooria.
      </p>

      <div className={styles.filterActions}>
        <button type="button" className={styles.apply} onClick={applyFilters}>
          Apply filters
        </button>
        <button type="button" className={styles.clear} onClick={clearFilters}>
          Clear all
        </button>
      </div>
    </div>
  );

  return (
    <div className={styles.root}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>Zevooria fragrances</p>
        <h1 className={styles.title}>The collection</h1>
        <p className={styles.lede}>
          A curated house catalog — browse by category, refine by price, and
          discover your next signature.
        </p>
      </header>

      <div className={styles.controls}>
        <p className={styles.count} aria-live="polite">
          {countLabel}
        </p>
        <div className={styles.controlActions}>
          <button
            type="button"
            className={styles.controlBtn}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((value) => !value)}
          >
            Filters
          </button>
          <label className={styles.sort}>
            <span>Sort by</span>
            <select
              value={query.sort}
              onChange={(event) =>
                onSortChange(event.target.value as SortOption)
              }
            >
              <option value="recommended">Recommended</option>
              <option value="newest">Newest</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
          </label>
        </div>
      </div>

      <div className={styles.layout}>
        <aside className={styles.desktopFilters} aria-label="Filters">
          {filterPanel}
        </aside>

        <div className={styles.results}>
          {filtered.length === 0 ? (
            <p className={styles.empty}>No fragrances match these filters.</p>
          ) : (
            <ProductGrid products={filtered} />
          )}
        </div>
      </div>

      {filtersOpen ? (
        <div className={styles.sheetRoot} role="presentation">
          <button
            type="button"
            className={styles.sheetBackdrop}
            aria-label="Close filters"
            onClick={() => setFiltersOpen(false)}
          />
          <div
            className={styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
          >
            <div className={styles.sheetTop}>
              <p className={styles.sheetTitle}>Filters</p>
              <button
                type="button"
                className={styles.sheetClose}
                onClick={() => setFiltersOpen(false)}
              >
                Close
              </button>
            </div>
            {filterPanel}
          </div>
        </div>
      ) : null}

      <RecentlyViewed products={products} />
    </div>
  );
}
