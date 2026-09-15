import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MediaType } from '../catalog.enums';
import { Product } from './product.entity';

@Entity({ name: 'product_media' })
export class ProductMedia {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'product_id' })
  productId!: string;

  @ManyToOne(() => Product, (product) => product.media, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({
    type: 'enum',
    enum: MediaType,
    enumName: 'media_type',
  })
  type!: MediaType;

  /**
   * Storage key or relative path (e.g. assets/sabayica/sabayica.jpeg).
   * Kept provider-agnostic so S3 object keys can replace local paths later.
   */
  @Column({ type: 'varchar', length: 1000, name: 'storage_key' })
  storageKey!: string;

  @Column({ type: 'varchar', length: 300, name: 'alt_text', nullable: true })
  altText!: string | null;

  @Column({ type: 'int', name: 'sort_order', default: 0 })
  sortOrder!: number;

  @Column({ type: 'boolean', name: 'is_primary', default: false })
  isPrimary!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
