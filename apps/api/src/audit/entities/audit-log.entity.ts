import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AuditActorType = 'customer' | 'admin' | 'system';

@Entity({ name: 'zevooria_audit_logs' })
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20, name: 'actor_type' })
  actorType!: AuditActorType;

  @Index()
  @Column({ type: 'uuid', name: 'actor_id', nullable: true })
  actorId!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 80 })
  action!: string;

  @Column({
    type: 'varchar',
    length: 80,
    name: 'resource_type',
    nullable: true,
  })
  resourceType!: string | null;

  @Index()
  @Column({ type: 'uuid', name: 'resource_id', nullable: true })
  resourceId!: string | null;

  /** Non-sensitive structured context only. Never store secrets. */
  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, name: 'ip_address', nullable: true })
  ipAddress!: string | null;

  @Column({ type: 'varchar', length: 512, name: 'user_agent', nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
