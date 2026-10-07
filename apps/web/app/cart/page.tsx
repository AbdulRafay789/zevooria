'use client';

import Link from 'next/link';
import { useCart } from '../../components/cart-provider';
import { useCatalogProducts } from '../../components/catalog-provider';
import {
  formatProductPrice,
  getPrimaryImage,
  storageKeyToPublicUrl,
} from '../../lib/catalog';
import {
  lineTotalWholePkr,
  parseWholePkr,
  sumWholePkr,
} from '../../lib/money';
import styles from './cart.module.css';

export default function CartPage() {
  const { items, setQuantity, removeProduct } = useCart();
  const products = useCatalogProducts();

  const lines = items.map((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    return { item, product };
  });

  const priced = lines.filter(
    (line): line is { item: (typeof lines)[number]['item']; product: NonNullable<(typeof lines)[number]['product']> } =>
      Boolean(line.product),
  );

  let subtotal = 0;
  try {
    subtotal = sumWholePkr(
      priced.map(({ item, product }) =>
        lineTotalWholePkr(parseWholePkr(product.price), item.quantity),
      ),
    );
  } catch {
    subtotal = 0;
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <p className={styles.eyebrow}>Shopping</p>
        <h1 className={styles.title}>Your bag</h1>

        {items.length === 0 ? (
          <div className={styles.empty}>
            <p>Your bag is empty.</p>
            <Link href="/collection" className={styles.primaryBtn}>
              Continue shopping
            </Link>
          </div>
        ) : (
          <>
            <ul className={styles.list}>
              {lines.map(({ item, product }) => {
                if (!product) {
                  return (
                    <li key={item.productId} className={styles.row}>
                      <div className={styles.thumb} aria-hidden />
                      <div className={styles.body}>
                        <p className={styles.missing}>
                          This product is no longer available.
                        </p>
                        <button
                          type="button"
                          className={styles.remove}
                          onClick={() => removeProduct(item.productId)}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                }

                const image = getPrimaryImage(product.media);
                const unit = parseWholePkr(product.price);
                const lineTotal = lineTotalWholePkr(unit, item.quantity);

                return (
                  <li key={item.productId} className={styles.row}>
                    <Link
                      href={`/products/${product.slug}`}
                      className={styles.thumb}
                    >
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={storageKeyToPublicUrl(image.storageKey)}
                          alt={image.altText ?? product.name}
                        />
                      ) : null}
                    </Link>
                    <div className={styles.body}>
                      <h2 className={styles.name}>
                        <Link href={`/products/${product.slug}`}>
                          {product.name}
                        </Link>
                      </h2>
                      <p className={styles.meta}>
                        {formatProductPrice(product.currency, product.price)}
                        {' · '}
                        Line {formatProductPrice(product.currency, `${lineTotal}.00`)}
                      </p>
                      <div className={styles.controls}>
                        <div className={styles.qty} role="group" aria-label="Quantity">
                          <button
                            type="button"
                            className={styles.qtyBtn}
                            aria-label="Decrease quantity"
                            onClick={() =>
                              setQuantity(item.productId, item.quantity - 1)
                            }
                          >
                            −
                          </button>
                          <span className={styles.qtyValue}>{item.quantity}</span>
                          <button
                            type="button"
                            className={styles.qtyBtn}
                            aria-label="Increase quantity"
                            onClick={() =>
                              setQuantity(item.productId, item.quantity + 1)
                            }
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          className={styles.remove}
                          onClick={() => removeProduct(item.productId)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className={styles.summary}>
              <div className={styles.summaryRow}>
                <span>Subtotal</span>
                <strong>{formatProductPrice('PKR', `${subtotal}.00`)}</strong>
              </div>
              <p className={styles.meta}>
                  Shipping is calculated at checkout along with applicable taxes.
              </p>
              <div className={styles.actions}>
                <Link href="/collection" className={styles.ghostBtn}>
                  Continue shopping
                </Link>
                <Link href="/checkout" className={styles.primaryBtn}>
                  Proceed to checkout
                </Link>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

