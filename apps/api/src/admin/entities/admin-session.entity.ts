import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AdminUser } from './admin-user.entity';

@Entity({ name: 'zevooria_admin_sessions' })
export class AdminSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'admin_user_id' })
  adminUserId!: string;

  @ManyToOne(() => AdminUser, (user) => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'admin_user_id' })
  adminUser!: AdminUser;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128, name: 'token_hash' })
  tokenHash!: string;

  @Index()
  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
