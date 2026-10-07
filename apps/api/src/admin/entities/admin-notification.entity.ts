import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AdminNotificationReceipt } from './admin-notification-receipt.entity';

@Entity({ name: 'zevooria_admin_notifications' })
export class AdminNotification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  type!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'varchar', length: 1000 })
  body!: string;

  @Column({
    type: 'varchar',
    length: 64,
    name: 'resource_type',
    nullable: true,
  })
  resourceType!: string | null;

  @Column({ type: 'uuid', name: 'resource_id', nullable: true })
  resourceId!: string | null;

  @OneToMany(() => AdminNotificationReceipt, (receipt) => receipt.notification)
  receipts!: AdminNotificationReceipt[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
