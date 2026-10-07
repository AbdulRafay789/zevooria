import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SupportInboundObjectStatus } from '../support.enums';

@Entity({ name: 'zevooria_support_inbound_objects' })
export class SupportInboundObject {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('UQ_zevooria_support_inbound_objects_s3_key', { unique: true })
  @Column({ type: 'varchar', length: 1024, name: 's3_key' })
  s3Key!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  etag!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sha256!: string | null;

  @Column({
    type: 'enum',
    enum: SupportInboundObjectStatus,
    enumName: 'zevooria_support_inbound_object_status',
  })
  status!: SupportInboundObjectStatus;

  @Column({ type: 'timestamptz', name: 'processed_at', nullable: true })
  processedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
