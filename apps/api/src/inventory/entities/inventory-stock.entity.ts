import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from '../../catalog/entities/product.entity';
import { Warehouse } from './warehouse.entity';

@Entity({ name: 'zevooria_inventory' })
@Unique('UQ_zevooria_inventory_warehouse_product', ['warehouseId', 'productId'])
export class InventoryStock {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'warehouse_id' })
  warehouseId!: string;

  @ManyToOne(() => Warehouse, (warehouse) => warehouse.stock, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: Warehouse;

  @Index()
  @Column({ type: 'uuid', name: 'product_id' })
  productId!: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  /** Units physically on hand. */
  @Column({ type: 'int', name: 'quantity_on_hand', default: 0 })
  quantityOnHand!: number;

  /** Units reserved for open orders (placed, not yet confirmed). */
  @Column({ type: 'int', name: 'quantity_reserved', default: 0 })
  quantityReserved!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
