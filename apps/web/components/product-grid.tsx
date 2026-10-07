import type { Product } from '../lib/types';
import { ProductCard } from './product-card';
import { Reveal } from './reveal';
import styles from './product-grid.module.css';

type ProductGridProps = {
  products: Product[];
};

export function ProductGrid({ products }: ProductGridProps) {
  return (
    <div className={styles.grid}>
      {products.map((product, index) => (
        <Reveal
          key={product.id}
          delayMs={Math.min(index, 8) * 55}
          className={styles.cell}
        >
          <ProductCard product={product} />
        </Reveal>
      ))}
    </div>
  );
}
