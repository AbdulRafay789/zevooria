import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProductStatus } from '../catalog.enums';
import { ProductMedia } from './product-media.entity';

@Entity({ name: 'zevooria_products' })
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 220 })
  slug!: string;

  @Column({ type: 'text' })
  description!: string;

  /** Decimal-safe money amount in major currency units (PKR). Stored as numeric. */
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  price!: string;

  /**
   * Optional compare-at (list) price for strikethrough display only.
   * Must be greater than `price` to show on the storefront.
   */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'compare_at_price',
    nullable: true,
  })
  compareAtPrice!: string | null;

  /** Unit cost in whole PKR for COGS. Stored as numeric. Default 0 until set. */
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  cost!: string;

  @Column({ type: 'varchar', length: 3, default: 'PKR' })
  currency!: string;

  /** Lower values appear earlier in storefront grids. */
  @Column({ type: 'int', name: 'sort_order', default: 0 })
  sortOrder!: number;

  @Column({
    type: 'enum',
    enum: ProductStatus,
    enumName: 'product_status',
    default: ProductStatus.DRAFT,
  })
  status!: ProductStatus;

  @OneToMany(() => ProductMedia, (media) => media.product, {
    cascade: true,
  })
  media!: ProductMedia[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
