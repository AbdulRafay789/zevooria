import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity({ name: 'zevooria_sessions' })
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128, name: 'token_hash' })
  tokenHash!: string;

  @Index()
  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  /** Longer-lived refresh token hash (nullable for legacy rows). */
  @Index({ unique: true })
  @Column({
    type: 'varchar',
    length: 128,
    name: 'refresh_token_hash',
    nullable: true,
  })
  refreshTokenHash!: string | null;

  @Index()
  @Column({ type: 'timestamptz', name: 'refresh_expires_at', nullable: true })
  refreshExpiresAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
