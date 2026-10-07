import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AuthTokenSubjectType = 'customer' | 'admin';
export type AuthTokenPurpose = 'password_reset' | 'email_verify';

@Entity({ name: 'zevooria_auth_tokens' })
export class AuthToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20, name: 'subject_type' })
  subjectType!: AuthTokenSubjectType;

  @Index()
  @Column({ type: 'uuid', name: 'subject_id' })
  subjectId!: string;

  @Column({ type: 'varchar', length: 40 })
  purpose!: AuthTokenPurpose;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128, name: 'token_hash' })
  tokenHash!: string;

  @Index()
  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', name: 'used_at', nullable: true })
  usedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
