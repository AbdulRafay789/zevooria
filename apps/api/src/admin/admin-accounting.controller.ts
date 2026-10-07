import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AccountingService } from '../accounting/accounting.service';
import { AdminGuard } from './admin.guard';
import { RequirePermissions } from './permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

@Controller('admin/accounting')
@UseGuards(AdminGuard, PermissionsGuard)
export class AdminAccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('accounts')
  @RequirePermissions('accounting:read')
  async listAccounts() {
    const rows = await this.accountingService.listAccounts();
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
      isActive: row.isActive,
    }));
  }

  @Get('journal-entries')
  @RequirePermissions('accounting:read')
  async listJournalEntries(@Query('limit') limitRaw?: string) {
    const parsed = limitRaw ? Number(limitRaw) : 50;
    const limit = Number.isFinite(parsed) ? parsed : 50;
    const rows = await this.accountingService.listRecentEntries(limit);
    return rows.map((entry) => ({
      id: entry.id,
      entryDate: entry.entryDate,
      memo: entry.memo,
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      eventKind: entry.eventKind,
      periodLabel: entry.period?.label ?? null,
      createdAt: entry.createdAt.toISOString(),
      lines: (entry.lines ?? []).map((line) => ({
        id: line.id,
        accountCode: line.account?.code ?? null,
        accountName: line.account?.name ?? null,
        debit: line.debit,
        credit: line.credit,
      })),
    }));
  }

  @Get('trial-balance')
  @RequirePermissions('accounting:read')
  async trialBalance() {
    return this.accountingService.trialBalance();
  }

  @Get('general-ledger')
  @RequirePermissions('accounting:read')
  async generalLedger(
    @Query('accountCode') accountCode?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const parsed = limitRaw ? Number(limitRaw) : 200;
    const limit = Number.isFinite(parsed) ? parsed : 200;
    return this.accountingService.generalLedger({
      accountCode,
      from,
      to,
      limit,
    });
  }

  @Get('profit-and-loss')
  @RequirePermissions('accounting:read')
  async profitAndLoss(@Query('from') from?: string, @Query('to') to?: string) {
    return this.accountingService.profitAndLoss({ from, to });
  }

  @Get('balance-sheet')
  @RequirePermissions('accounting:read')
  async balanceSheet(@Query('asOf') asOf?: string) {
    return this.accountingService.balanceSheet({ asOf });
  }
}
