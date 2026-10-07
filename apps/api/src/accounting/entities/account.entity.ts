import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { JournalLine } from './journal-line.entity';

export type AccountType =
  'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

@Entity({ name: 'zevooria_accounts' })
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 16 })
  code!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({
    type: 'enum',
    enum: ['asset', 'liability', 'equity', 'revenue', 'expense'],
    enumName: 'zevooria_account_type',
  })
  type!: AccountType;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @OneToMany(() => JournalLine, (line) => line.account)
  lines!: JournalLine[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
