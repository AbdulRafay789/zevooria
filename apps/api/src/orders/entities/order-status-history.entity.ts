import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrderStatus } from '../order.enums';
import { Order } from './order.entity';

export type OrderStatusActorType = 'customer' | 'admin' | 'system';

@Entity({ name: 'zevooria_order_status_history' })
export class OrderStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'order_id' })
  orderId!: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ type: 'varchar', length: 32, name: 'from_status', nullable: true })
  fromStatus!: OrderStatus | null;

  @Column({ type: 'varchar', length: 32, name: 'to_status' })
  toStatus!: OrderStatus;

  @Column({ type: 'varchar', length: 32, name: 'actor_type' })
  actorType!: OrderStatusActorType;

  @Column({ type: 'uuid', name: 'actor_id', nullable: true })
  actorId!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
