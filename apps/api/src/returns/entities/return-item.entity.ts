import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Product } from '../../catalog/entities/product.entity';
import { OrderItem } from '../../orders/entities/order-item.entity';
import { ProductReturn } from './return.entity';

@Entity({ name: 'zevooria_return_items' })
@Unique('UQ_zevooria_return_items_return_order_item', [
  'returnId',
  'orderItemId',
])
export class ReturnItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'return_id' })
  returnId!: string;

  @ManyToOne(() => ProductReturn, (ret) => ret.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'return_id' })
  returnEntity!: ProductReturn;

  @Column({ type: 'uuid', name: 'order_item_id' })
  orderItemId!: string;

  @ManyToOne(() => OrderItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_item_id' })
  orderItem!: OrderItem;

  @Column({ type: 'uuid', name: 'product_id', nullable: true })
  productId!: string | null;

  @ManyToOne(() => Product, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'product_id' })
  product!: Product | null;

  @Column({ type: 'varchar', length: 200, name: 'product_name' })
  productName!: string;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'unit_price' })
  unitPrice!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'line_refund' })
  lineRefund!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
