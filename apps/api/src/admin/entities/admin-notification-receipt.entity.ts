import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AdminUser } from './admin-user.entity';
import { AdminNotification } from './admin-notification.entity';

@Entity({ name: 'zevooria_admin_notification_receipts' })
export class AdminNotificationReceipt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'notification_id' })
  notificationId!: string;

  @ManyToOne(() => AdminNotification, (n) => n.receipts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'notification_id' })
  notification!: AdminNotification;

  @Column({ type: 'uuid', name: 'admin_user_id' })
  adminUserId!: string;

  @ManyToOne(() => AdminUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'admin_user_id' })
  adminUser!: AdminUser;

  @Column({ type: 'timestamptz', name: 'read_at', nullable: true })
  readAt!: Date | null;
}
