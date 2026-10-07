import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FiscalPeriod } from './fiscal-period.entity';
import { JournalLine } from './journal-line.entity';

@Entity({ name: 'zevooria_journal_entries' })
export class JournalEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'period_id' })
  periodId!: string;

  @ManyToOne(() => FiscalPeriod, (period) => period.entries, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'period_id' })
  period!: FiscalPeriod;

  @Column({ type: 'date', name: 'entry_date' })
  entryDate!: string;

  @Column({ type: 'varchar', length: 500 })
  memo!: string;

  @Column({ type: 'varchar', length: 64, name: 'source_type' })
  sourceType!: string;

  @Column({ type: 'uuid', name: 'source_id' })
  sourceId!: string;

  @Column({ type: 'varchar', length: 64, name: 'event_kind' })
  eventKind!: string;

  @OneToMany(() => JournalLine, (line) => line.entry, { cascade: true })
  lines!: JournalLine[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
