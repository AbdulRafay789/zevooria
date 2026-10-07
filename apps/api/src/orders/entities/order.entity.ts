import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { OrderStatus } from '../order.enums';
import { OrderAddress } from './order-address.entity';
import { OrderItem } from './order-item.entity';
import { Payment } from './payment.entity';

@Entity({ name: 'zevooria_orders' })
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32, name: 'order_number' })
  orderNumber!: string;

  @Index()
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    enumName: 'order_status',
    default: OrderStatus.PLACED,
  })
  status!: OrderStatus;

  @Column({ type: 'varchar', length: 3, default: 'PKR' })
  currency!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  subtotal!: string;

  /** Merchandise discount from a promo (never applied to shipping). */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'discount_amount',
    default: 0,
  })
  discountAmount!: string;

  @Column({ type: 'uuid', name: 'promo_code_id', nullable: true })
  promoCodeId!: string | null;

  /** Snapshot of the applied promo code string. */
  @Column({ type: 'varchar', length: 64, name: 'promo_code', nullable: true })
  promoCode!: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'shipping_amount' })
  shippingAmount!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  total!: string;

  @Column({ type: 'varchar', length: 200, name: 'customer_name' })
  customerName!: string;

  @Column({ type: 'varchar', length: 320, name: 'customer_email' })
  customerEmail!: string;

  @Column({ type: 'varchar', length: 40, name: 'customer_phone' })
  customerPhone!: string;

  @Index({ unique: true })
  @Column({
    type: 'varchar',
    length: 128,
    name: 'idempotency_key',
    nullable: true,
  })
  idempotencyKey!: string | null;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items!: OrderItem[];

  @OneToOne(() => OrderAddress, (address) => address.order, { cascade: true })
  shippingAddress!: OrderAddress;

  @OneToMany(() => Payment, (payment) => payment.order, { cascade: true })
  payments!: Payment[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
