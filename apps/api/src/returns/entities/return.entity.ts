import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AdminUser } from '../../admin/entities/admin-user.entity';
import { Order } from '../../orders/entities/order.entity';
import { ReturnStatus } from '../return.enums';
import { ReturnItem } from './return-item.entity';

@Entity({ name: 'zevooria_returns' })
export class ProductReturn {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'order_id' })
  orderId!: string;

  @ManyToOne(() => Order, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Index()
  @Column({
    type: 'enum',
    enum: ReturnStatus,
    enumName: 'zevooria_return_status',
    default: ReturnStatus.PENDING_INSPECT,
  })
  status!: ReturnStatus;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  reason!: string | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'refund_amount',
    default: 0,
  })
  refundAmount!: string;

  @Column({ type: 'uuid', name: 'created_by_admin_id', nullable: true })
  createdByAdminId!: string | null;

  @ManyToOne(() => AdminUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_admin_id' })
  createdByAdmin!: AdminUser | null;

  @Column({ type: 'timestamptz', name: 'inspected_at', nullable: true })
  inspectedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'restocked_at', nullable: true })
  restockedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'refunded_at', nullable: true })
  refundedAt!: Date | null;

  @OneToMany(() => ReturnItem, (item) => item.returnEntity, { cascade: true })
  items!: ReturnItem[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
