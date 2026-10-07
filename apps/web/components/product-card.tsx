import Link from 'next/link';
import type { Product } from '../lib/types';
import {
  formatProductPrice,
  getAdditionalImages,
  getCompareAtPrice,
  getPrimaryImage,
  isSignatureProduct,
  isTesterProduct,
  storageKeyToPublicUrl,
} from '../lib/catalog';
import { WishlistButton } from './wishlist-button';
import styles from './product-card.module.css';

type ProductCardProps = {
  product: Product;
  compact?: boolean;
};

export function ProductCard({ product, compact = false }: ProductCardProps) {
  const images = product.media.filter((m) => m.type === 'image');
  const primary = getPrimaryImage(images);
  const secondary = getAdditionalImages(images)[0];
  const compareAt = getCompareAtPrice(product);
  const category = isTesterProduct(product)
    ? 'Discovery'
    : isSignatureProduct(product)
      ? 'Signature'
      : 'Parfum';

  return (
    <article className={compact ? styles.cardCompact : styles.card}>
      <div className={styles.media}>
        <Link
          href={`/products/${product.slug}`}
          className={styles.mediaLink}
          aria-label={`View ${product.name}`}
        >
          {primary ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={secondary ? styles.imagePrimary : styles.image}
                src={storageKeyToPublicUrl(primary.storageKey)}
                alt={primary.altText ?? product.name}
                loading="lazy"
                decoding="async"
              />
              {secondary ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.imageSecondary}
                  src={storageKeyToPublicUrl(secondary.storageKey)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  aria-hidden
                />
              ) : null}
            </>
          ) : (
            <div className={styles.placeholder} aria-hidden>
              Awaiting imagery
            </div>
          )}
        </Link>
        <WishlistButton productId={product.id} slug={product.slug} />
        <span className={styles.discover} aria-hidden>
          Discover
        </span>
      </div>

      <div className={styles.body}>
        <p className={styles.type}>{category}</p>
        <h3 className={styles.name}>
          <Link href={`/products/${product.slug}`}>{product.name}</Link>
        </h3>
        <p className={styles.price}>
          {compareAt ? (
            <>
              <span className={styles.compareAt}>
                {formatProductPrice(product.currency, compareAt)}
              </span>{' '}
            </>
          ) : null}
          {formatProductPrice(product.currency, product.price)}
        </p>
      </div>
    </article>
  );
}
