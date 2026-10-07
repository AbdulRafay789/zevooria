import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AdminUser } from '../../admin/entities/admin-user.entity';
import { SupportMessageDirection } from '../support.enums';
import { SupportAttachment } from './support-attachment.entity';
import { SupportConversation } from './support-conversation.entity';

@Entity({ name: 'zevooria_support_messages' })
@Index('IDX_zevooria_support_messages_conversation_created', [
  'conversationId',
  'createdAt',
])
export class SupportMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'conversation_id' })
  conversationId!: string;

  @ManyToOne(
    () => SupportConversation,
    (conversation) => conversation.messages,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'conversation_id' })
  conversation!: SupportConversation;

  @Column({
    type: 'enum',
    enum: SupportMessageDirection,
    enumName: 'zevooria_support_message_direction',
  })
  direction!: SupportMessageDirection;

  @Column({ type: 'varchar', length: 320, name: 'from_email' })
  fromEmail!: string;

  @Column({ type: 'varchar', length: 320, name: 'to_email' })
  toEmail!: string;

  @Column({ type: 'varchar', length: 998, nullable: true })
  subject!: string | null;

  @Column({ type: 'text', name: 'body_text' })
  bodyText!: string;

  @Column({ type: 'text', name: 'body_html', nullable: true })
  bodyHtml!: string | null;

  /**
   * Normalized RFC 5322 Message-ID (inbound or outbound), used for threading.
   * Not the AWS SES Send* API MessageId — see `awsSesMessageId`.
   */
  @Index('IDX_zevooria_support_messages_ses_message_id')
  @Column({
    type: 'varchar',
    length: 255,
    name: 'ses_message_id',
    nullable: true,
  })
  sesMessageId!: string | null;

  /** SES SendRawEmail/SendEmail API MessageId for outbound delivery tracking. */
  @Column({
    type: 'varchar',
    length: 255,
    name: 'aws_ses_message_id',
    nullable: true,
  })
  awsSesMessageId!: string | null;

  @Column({
    type: 'varchar',
    length: 998,
    name: 'in_reply_to',
    nullable: true,
  })
  inReplyTo!: string | null;

  /** RFC 5322 References header value (space-separated message IDs). */
  @Column({ type: 'text', name: 'references', nullable: true })
  references!: string | null;

  @Column({ type: 'uuid', name: 'admin_user_id', nullable: true })
  adminUserId!: string | null;

  @ManyToOne(() => AdminUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'admin_user_id' })
  adminUser!: AdminUser | null;

  @OneToMany(() => SupportAttachment, (attachment) => attachment.message)
  attachments!: SupportAttachment[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
