import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Account } from './account.entity';
import { JournalEntry } from './journal-entry.entity';

@Entity({ name: 'zevooria_journal_lines' })
export class JournalLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'entry_id' })
  entryId!: string;

  @ManyToOne(() => JournalEntry, (entry) => entry.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'entry_id' })
  entry!: JournalEntry;

  @Column({ type: 'uuid', name: 'account_id' })
  accountId!: string;

  @ManyToOne(() => Account, (account) => account.lines, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'account_id' })
  account!: Account;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  debit!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  credit!: string;
}
