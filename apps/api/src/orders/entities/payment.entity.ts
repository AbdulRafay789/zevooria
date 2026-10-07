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
import {
  PaymentProviderName,
  PaymentStatus,
} from '../../payments/payment-provider';
import { Order } from './order.entity';

@Entity({ name: 'zevooria_payments' })
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'order_id' })
  orderId!: string;

  @ManyToOne(() => Order, (order) => order.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({
    type: 'enum',
    enum: PaymentProviderName,
    enumName: 'payment_provider',
  })
  provider!: PaymentProviderName;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    enumName: 'payment_status',
  })
  status!: PaymentStatus;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount!: string;

  @Column({ type: 'varchar', length: 3, default: 'PKR' })
  currency!: string;

  @Column({
    type: 'varchar',
    length: 200,
    name: 'provider_reference',
    nullable: true,
  })
  providerReference!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
