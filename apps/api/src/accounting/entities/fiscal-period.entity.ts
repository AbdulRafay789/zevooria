import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { JournalEntry } from './journal-entry.entity';

@Entity({ name: 'zevooria_fiscal_periods' })
export class FiscalPeriod {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  label!: string;

  @Column({ type: 'date', name: 'starts_on' })
  startsOn!: string;

  @Column({ type: 'date', name: 'ends_on' })
  endsOn!: string;

  @Column({ type: 'boolean', name: 'is_open', default: true })
  isOpen!: boolean;

  @OneToMany(() => JournalEntry, (entry) => entry.period)
  entries!: JournalEntry[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
