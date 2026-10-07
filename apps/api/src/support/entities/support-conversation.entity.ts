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
import { User } from '../../auth/entities/user.entity';
import { SupportConversationStatus } from '../support.enums';
import { SupportMessage } from './support-message.entity';

@Entity({ name: 'zevooria_support_conversations' })
export class SupportConversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 998 })
  subject!: string;

  @Index('IDX_zevooria_support_conversations_status')
  @Column({
    type: 'enum',
    enum: SupportConversationStatus,
    enumName: 'zevooria_support_conversation_status',
    default: SupportConversationStatus.OPEN,
  })
  status!: SupportConversationStatus;

  @Index('IDX_zevooria_support_conversations_requester_email')
  @Column({ type: 'varchar', length: 320, name: 'requester_email' })
  requesterEmail!: string;

  @Column({
    type: 'varchar',
    length: 200,
    name: 'requester_name',
    nullable: true,
  })
  requesterName!: string | null;

  @Column({ type: 'uuid', name: 'customer_id', nullable: true })
  customerId!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer!: User | null;

  @Column({ type: 'uuid', name: 'assignee_admin_id', nullable: true })
  assigneeAdminId!: string | null;

  @ManyToOne(() => AdminUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assignee_admin_id' })
  assigneeAdmin!: AdminUser | null;

  @Index('IDX_zevooria_support_conversations_last_message_at')
  @Column({ type: 'timestamptz', name: 'last_message_at' })
  lastMessageAt!: Date;

  @OneToMany(() => SupportMessage, (message) => message.conversation)
  messages!: SupportMessage[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
