'use client';

import { useState } from 'react';
import type { Product } from '../lib/types';
import {
  formatProductPrice,
  getAdditionalImages,
  getPrimaryImage,
  storageKeyToPublicUrl,
} from '../lib/catalog';
import styles from './product-card.module.css';

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  const images = product.media.filter((m) => m.type === 'image');
  const primary = getPrimaryImage(images);
  const additional = getAdditionalImages(images);
  const [activeKey, setActiveKey] = useState(primary?.storageKey ?? null);

  const active =
    images.find((m) => m.storageKey === activeKey) ?? primary ?? null;

  return (
    <article className={styles.card}>
      <div className={styles.media}>
        {active ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.image}
            src={storageKeyToPublicUrl(active.storageKey)}
            alt={active.altText ?? product.name}
            loading="lazy"
          />
        ) : (
          <div className={styles.placeholder} aria-hidden>
            No image
          </div>
        )}
      </div>

      {additional.length > 0 ? (
        <ul className={styles.thumbs} aria-label={`${product.name} gallery`}>
          {primary ? (
            <li>
              <button
                type="button"
                className={
                  active?.storageKey === primary.storageKey
                    ? styles.thumbActive
                    : styles.thumb
                }
                onClick={() => setActiveKey(primary.storageKey)}
                aria-label="Show primary image"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={storageKeyToPublicUrl(primary.storageKey)}
                  alt=""
                  loading="lazy"
                />
              </button>
            </li>
          ) : null}
          {additional.map((media) => (
            <li key={media.id}>
              <button
                type="button"
                className={
                  active?.storageKey === media.storageKey
                    ? styles.thumbActive
                    : styles.thumb
                }
                onClick={() => setActiveKey(media.storageKey)}
                aria-label={media.altText ?? `Show image ${media.sortOrder + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={storageKeyToPublicUrl(media.storageKey)}
                  alt=""
                  loading="lazy"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className={styles.body}>
        <h2 className={styles.name}>{product.name}</h2>
        <p className={styles.price}>
          {formatProductPrice(product.currency, product.price)}
        </p>
        <p className={styles.description}>{product.description}</p>
      </div>
    </article>
  );
}
