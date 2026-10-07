import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SupportMessage } from './support-message.entity';

@Entity({ name: 'zevooria_support_attachments' })
export class SupportAttachment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_zevooria_support_attachments_message_id')
  @Column({ type: 'uuid', name: 'message_id' })
  messageId!: string;

  @ManyToOne(() => SupportMessage, (message) => message.attachments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'message_id' })
  message!: SupportMessage;

  @Column({ type: 'varchar', length: 500, name: 'file_name' })
  fileName!: string;

  @Column({ type: 'varchar', length: 255, name: 'content_type' })
  contentType!: string;

  @Column({ type: 'int', name: 'size_bytes' })
  sizeBytes!: number;

  /** S3 object key (or future storage key); not a public URL. */
  @Column({ type: 'varchar', length: 1000, name: 'storage_key' })
  storageKey!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
