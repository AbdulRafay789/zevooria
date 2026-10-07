import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AdminUser } from './admin-user.entity';

@Entity({ name: 'zevooria_admin_notification_preferences' })
export class AdminNotificationPreferences {
  @PrimaryColumn({ type: 'uuid', name: 'admin_user_id' })
  adminUserId!: string;

  @OneToOne(() => AdminUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'admin_user_id' })
  adminUser!: AdminUser;

  @Column({ type: 'boolean', name: 'order_placed', default: true })
  orderPlaced!: boolean;

  @Column({ type: 'boolean', name: 'push_enabled', default: false })
  pushEnabled!: boolean;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
