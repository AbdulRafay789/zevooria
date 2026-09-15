import Link from 'next/link';
import type { Product } from '../lib/types';
import {
  formatProductPrice,
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
  const imageCount = images.length;

  return (
    <article className={styles.card}>
      <Link href={`/products/${product.slug}`} className={styles.link}>
        <div className={styles.media}>
          {primary ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className={styles.image}
              src={storageKeyToPublicUrl(primary.storageKey)}
              alt={primary.altText ?? product.name}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className={styles.placeholder} aria-hidden>
              Awaiting imagery
            </div>
          )}
          {imageCount > 1 ? (
            <p className={styles.badge}>{imageCount} views</p>
          ) : null}
        </div>

        <div className={styles.body}>
          <div className={styles.copy}>
            <h3 className={styles.name}>{product.name}</h3>
            <p className={styles.description}>{product.description}</p>
          </div>
          <p className={styles.price}>
            {formatProductPrice(product.currency, product.price)}
          </p>
        </div>
      </Link>
    </article>
  );
}
