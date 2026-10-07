import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../catalog/entities/product.entity';
import { AccountingService } from './accounting.service';
import { Account } from './entities/account.entity';
import { FiscalPeriod } from './entities/fiscal-period.entity';
import { JournalEntry } from './entities/journal-entry.entity';
import { JournalLine } from './entities/journal-line.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Account,
      FiscalPeriod,
      JournalEntry,
      JournalLine,
      Product,
    ]),
  ],
  providers: [AccountingService],
  exports: [AccountingService, TypeOrmModule],
})
export class AccountingModule {}
