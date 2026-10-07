'use client';

import { useEffect, useState } from 'react';
import type { Product } from '../lib/types';
import { getRecentlyViewedSlugs } from '../lib/recently-viewed';
import { ProductCard } from './product-card';
import styles from './recently-viewed.module.css';

type RecentlyViewedProps = {
  products: Product[];
  excludeSlug?: string;
  title?: string;
};

export function RecentlyViewed({
  products,
  excludeSlug,
  title = 'Recently viewed',
}: RecentlyViewedProps) {
  const [slugs, setSlugs] = useState<string[]>([]);

  useEffect(() => {
    setSlugs(getRecentlyViewedSlugs());
  }, [excludeSlug]);

  const recent = slugs
    .filter((slug) => slug !== excludeSlug)
    .map((slug) => products.find((product) => product.slug === slug))
    .filter((product): product is Product => Boolean(product))
    .slice(0, 6);

  if (recent.length === 0) {
    return null;
  }

  return (
    <section className={styles.section} aria-labelledby="recently-viewed-heading">
      <p className={styles.eyebrow}>Continue browsing</p>
      <h2 id="recently-viewed-heading" className={styles.title}>
        {title}
      </h2>
      <div className={styles.rail}>
        {recent.map((product) => (
          <div key={product.id} className={styles.item}>
            <ProductCard product={product} compact />
          </div>
        ))}
      </div>
    </section>
  );
}
