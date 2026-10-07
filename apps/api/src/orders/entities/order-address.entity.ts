import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from './order.entity';

@Entity({ name: 'zevooria_order_addresses' })
export class OrderAddress {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'order_id' })
  orderId!: string;

  @OneToOne(() => Order, (order) => order.shippingAddress, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ type: 'varchar', length: 300 })
  line1!: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  line2!: string | null;

  @Column({ type: 'varchar', length: 120 })
  city!: string;

  @Column({ type: 'varchar', length: 20, name: 'postal_code' })
  postalCode!: string;

  @Column({ type: 'varchar', length: 80, default: 'Pakistan' })
  country!: string;
}
