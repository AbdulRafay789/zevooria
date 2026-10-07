import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Product } from '../catalog/entities/product.entity';
import {
  formatSignedWholePkr,
  formatWholePkr,
  lineTotalWholePkr,
  parseWholePkr,
  sumWholePkr,
} from '../common/money/pkr';
import { Order } from '../orders/entities/order.entity';
import { Account } from './entities/account.entity';
import { FiscalPeriod } from './entities/fiscal-period.entity';
import { JournalEntry } from './entities/journal-entry.entity';
import { JournalLine } from './entities/journal-line.entity';

export const ACCOUNT_CODES = {
  CASH: '1100',
  BANK: '1200',
  AR: '1300',
  INVENTORY: '1400',
  REFUNDS_PAYABLE: '2300',
  SALES: '4100',
  SHIPPING_REVENUE: '4200',
  COGS: '5100',
} as const;

export type JournalLineInput = {
  accountCode: string;
  debit: number;
  credit: number;
};

export type PostBalancedEntryInput = {
  memo: string;
  sourceType: string;
  sourceId: string;
  eventKind: string;
  lines: JournalLineInput[];
  entryDate?: Date;
  manager?: EntityManager;
};

@Injectable()
export class AccountingService {
  constructor(
    @InjectRepository(Account)
    private readonly accounts: Repository<Account>,
    @InjectRepository(FiscalPeriod)
    private readonly periods: Repository<FiscalPeriod>,
    @InjectRepository(JournalEntry)
    private readonly entries: Repository<JournalEntry>,
    @InjectRepository(JournalLine)
    private readonly lines: Repository<JournalLine>,
  ) {}

  async listAccounts(): Promise<Account[]> {
    return this.accounts.find({
      where: { isActive: true },
      order: { code: 'ASC' },
    });
  }

  async listRecentEntries(limit = 50): Promise<JournalEntry[]> {
    const take = Math.min(Math.max(limit, 1), 200);
    return this.entries.find({
      relations: { lines: { account: true }, period: true },
      order: { createdAt: 'DESC' },
      take,
    });
  }

  async trialBalance(): Promise<
    Array<{
      accountCode: string;
      accountName: string;
      debit: string;
      credit: string;
    }>
  > {
    const rows = await this.lines
      .createQueryBuilder('line')
      .innerJoin('line.account', 'account')
      .select('account.code', 'accountCode')
      .addSelect('account.name', 'accountName')
      .addSelect('COALESCE(SUM(line.debit), 0)', 'debit')
      .addSelect('COALESCE(SUM(line.credit), 0)', 'credit')
      .groupBy('account.code')
      .addGroupBy('account.name')
      .orderBy('account.code', 'ASC')
      .getRawMany<{
        accountCode: string;
        accountName: string;
        debit: string;
        credit: string;
      }>();

    return rows.map((row) => {
      const debit = parseWholePkr(String(row.debit), 'debit');
      const credit = parseWholePkr(String(row.credit), 'credit');
      const netDebit = Math.max(0, debit - credit);
      const netCredit = Math.max(0, credit - debit);
      return {
        accountCode: row.accountCode,
        accountName: row.accountName,
        debit: formatWholePkr(netDebit),
        credit: formatWholePkr(netCredit),
      };
    });
  }

  /**
   * General ledger lines (newest first), optional account + entry-date window.
   */
  async generalLedger(
    options: {
      accountCode?: string;
      from?: string;
      to?: string;
      limit?: number;
    } = {},
  ): Promise<
    Array<{
      entryId: string;
      entryDate: string;
      memo: string;
      eventKind: string;
      accountCode: string;
      accountName: string;
      accountType: string;
      debit: string;
      credit: string;
      createdAt: string;
    }>
  > {
    const take = Math.min(Math.max(options.limit ?? 200, 1), 500);
    const qb = this.lines
      .createQueryBuilder('line')
      .innerJoinAndSelect('line.account', 'account')
      .innerJoinAndSelect('line.entry', 'entry')
      .orderBy('entry.entryDate', 'DESC')
      .addOrderBy('entry.createdAt', 'DESC')
      .addOrderBy('account.code', 'ASC')
      .take(take);

    if (options.accountCode?.trim()) {
      qb.andWhere('account.code = :code', {
        code: options.accountCode.trim(),
      });
    }
    if (options.from?.trim()) {
      qb.andWhere('entry.entryDate >= :from', { from: options.from.trim() });
    }
    if (options.to?.trim()) {
      qb.andWhere('entry.entryDate <= :to', { to: options.to.trim() });
    }

    const rows = await qb.getMany();
    return rows.map((line) => ({
      entryId: line.entryId,
      entryDate: String(line.entry.entryDate),
      memo: line.entry.memo,
      eventKind: line.entry.eventKind,
      accountCode: line.account.code,
      accountName: line.account.name,
      accountType: line.account.type,
      debit: line.debit,
      credit: line.credit,
      createdAt: line.entry.createdAt.toISOString(),
    }));
  }

  /**
   * Profit & loss for an optional entry-date window (inclusive).
   * Revenue = credit − debit; expense (incl. COGS) = debit − credit.
   */
  async profitAndLoss(options: { from?: string; to?: string } = {}): Promise<{
    from: string | null;
    to: string | null;
    revenue: Array<{
      accountCode: string;
      accountName: string;
      amount: string;
    }>;
    expenses: Array<{
      accountCode: string;
      accountName: string;
      amount: string;
    }>;
    totalRevenue: string;
    totalExpenses: string;
    netIncome: string;
  }> {
    const aggregates = await this.accountAggregates(options.from, options.to);
    const revenue: Array<{
      accountCode: string;
      accountName: string;
      amount: string;
    }> = [];
    const expenses: Array<{
      accountCode: string;
      accountName: string;
      amount: string;
    }> = [];
    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const row of aggregates) {
      if (row.type === 'revenue') {
        const amount = Math.max(0, row.credit - row.debit);
        if (amount === 0) {
          continue;
        }
        totalRevenue += amount;
        revenue.push({
          accountCode: row.code,
          accountName: row.name,
          amount: formatWholePkr(amount),
        });
      } else if (row.type === 'expense') {
        const amount = Math.max(0, row.debit - row.credit);
        if (amount === 0) {
          continue;
        }
        totalExpenses += amount;
        expenses.push({
          accountCode: row.code,
          accountName: row.name,
          amount: formatWholePkr(amount),
        });
      }
    }

    return {
      from: options.from?.trim() || null,
      to: options.to?.trim() || null,
      revenue,
      expenses,
      totalRevenue: formatWholePkr(totalRevenue),
      totalExpenses: formatWholePkr(totalExpenses),
      netIncome: formatSignedWholePkr(totalRevenue - totalExpenses),
    };
  }

  /**
   * Balance sheet as of optional entry date (inclusive).
   * Assets = liabilities + equity + net income through asOf (period earnings not yet closed).
   */
  async balanceSheet(options: { asOf?: string } = {}): Promise<{
    asOf: string | null;
    assets: Array<{
      accountCode: string;
      accountName: string;
      amount: string;
    }>;
    liabilities: Array<{
      accountCode: string;
      accountName: string;
      amount: string;
    }>;
    equity: Array<{
      accountCode: string;
      accountName: string;
      amount: string;
    }>;
    totalAssets: string;
    totalLiabilities: string;
    totalEquity: string;
    netIncome: string;
    totalLiabilitiesAndEquity: string;
  }> {
    const asOf = options.asOf?.trim() || undefined;
    const aggregates = await this.accountAggregates(undefined, asOf);
    const assets: Array<{
      accountCode: string;
      accountName: string;
      amount: string;
    }> = [];
    const liabilities: Array<{
      accountCode: string;
      accountName: string;
      amount: string;
    }> = [];
    const equity: Array<{
      accountCode: string;
      accountName: string;
      amount: string;
    }> = [];
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const row of aggregates) {
      if (row.type === 'asset') {
        const amount = row.debit - row.credit;
        if (amount === 0) {
          continue;
        }
        totalAssets += amount;
        assets.push({
          accountCode: row.code,
          accountName: row.name,
          amount: formatSignedWholePkr(amount),
        });
      } else if (row.type === 'liability') {
        const amount = row.credit - row.debit;
        if (amount === 0) {
          continue;
        }
        totalLiabilities += amount;
        liabilities.push({
          accountCode: row.code,
          accountName: row.name,
          amount: formatSignedWholePkr(amount),
        });
      } else if (row.type === 'equity') {
        const amount = row.credit - row.debit;
        if (amount === 0) {
          continue;
        }
        totalEquity += amount;
        equity.push({
          accountCode: row.code,
          accountName: row.name,
          amount: formatSignedWholePkr(amount),
        });
      } else if (row.type === 'revenue') {
        totalRevenue += Math.max(0, row.credit - row.debit);
      } else if (row.type === 'expense') {
        totalExpenses += Math.max(0, row.debit - row.credit);
      }
    }

    const netIncome = totalRevenue - totalExpenses;
    return {
      asOf: asOf ?? null,
      assets,
      liabilities,
      equity,
      totalAssets: formatSignedWholePkr(totalAssets),
      totalLiabilities: formatSignedWholePkr(totalLiabilities),
      totalEquity: formatSignedWholePkr(totalEquity),
      netIncome: formatSignedWholePkr(netIncome),
      totalLiabilitiesAndEquity: formatSignedWholePkr(
        totalLiabilities + totalEquity + netIncome,
      ),
    };
  }

  private async accountAggregates(
    from?: string,
    to?: string,
  ): Promise<
    Array<{
      code: string;
      name: string;
      type: Account['type'];
      debit: number;
      credit: number;
    }>
  > {
    const qb = this.lines
      .createQueryBuilder('line')
      .innerJoin('line.account', 'account')
      .innerJoin('line.entry', 'entry')
      .select('account.code', 'code')
      .addSelect('account.name', 'name')
      .addSelect('account.type', 'type')
      .addSelect('COALESCE(SUM(line.debit), 0)', 'debit')
      .addSelect('COALESCE(SUM(line.credit), 0)', 'credit')
      .groupBy('account.code')
      .addGroupBy('account.name')
      .addGroupBy('account.type')
      .orderBy('account.code', 'ASC');

    if (from?.trim()) {
      qb.andWhere('entry.entryDate >= :from', { from: from.trim() });
    }
    if (to?.trim()) {
      qb.andWhere('entry.entryDate <= :to', { to: to.trim() });
    }

    const rows = await qb.getRawMany<{
      code: string;
      name: string;
      type: Account['type'];
      debit: string;
      credit: string;
    }>();

    return rows.map((row) => ({
      code: row.code,
      name: row.name,
      type: row.type,
      debit: parseWholePkr(String(row.debit), 'debit'),
      credit: parseWholePkr(String(row.credit), 'credit'),
    }));
  }

  /**
   * Posts an immutable balanced journal entry.
   * Idempotent on (sourceType, sourceId, eventKind).
   */
  async postBalancedEntry(
    input: PostBalancedEntryInput,
  ): Promise<JournalEntry | null> {
    const run = async (manager: EntityManager) => {
      const existing = await manager.findOne(JournalEntry, {
        where: {
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          eventKind: input.eventKind,
        },
      });
      if (existing) {
        return existing;
      }

      if (!input.lines.length) {
        throw new BadRequestException(
          'Journal entry requires at least one line.',
        );
      }

      let debitTotal = 0;
      let creditTotal = 0;
      for (const line of input.lines) {
        if (line.debit < 0 || line.credit < 0) {
          throw new BadRequestException(
            'Journal amounts must be non-negative.',
          );
        }
        if (
          (line.debit > 0 && line.credit > 0) ||
          (line.debit === 0 && line.credit === 0)
        ) {
          throw new BadRequestException(
            'Each journal line must be either a debit or a credit.',
          );
        }
        debitTotal = sumWholePkr([debitTotal, line.debit]);
        creditTotal = sumWholePkr([creditTotal, line.credit]);
      }
      if (debitTotal !== creditTotal) {
        throw new BadRequestException(
          `Unbalanced journal entry: debit ${debitTotal} != credit ${creditTotal}`,
        );
      }
      if (debitTotal === 0) {
        return null;
      }

      const period = await manager.findOne(FiscalPeriod, {
        where: { isOpen: true },
      });
      if (!period) {
        throw new BadRequestException('No open fiscal period.');
      }

      const codes = [...new Set(input.lines.map((line) => line.accountCode))];
      const accounts = await manager.find(Account, {
        where: { code: In(codes), isActive: true },
      });
      const byCode = new Map(
        accounts.map((account) => [account.code, account]),
      );
      for (const code of codes) {
        if (!byCode.has(code)) {
          throw new BadRequestException(`Unknown account code: ${code}`);
        }
      }

      const entryDate = (input.entryDate ?? new Date())
        .toISOString()
        .slice(0, 10);

      const entry = manager.create(JournalEntry, {
        periodId: period.id,
        entryDate,
        memo: input.memo.slice(0, 500),
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        eventKind: input.eventKind,
      });
      const savedEntry = await manager.save(entry);

      const lines = input.lines.map((line) =>
        manager.create(JournalLine, {
          entryId: savedEntry.id,
          accountId: byCode.get(line.accountCode)!.id,
          debit: formatWholePkr(line.debit),
          credit: formatWholePkr(line.credit),
        }),
      );
      await manager.save(lines);

      const saved = await manager.findOne(JournalEntry, {
        where: { id: savedEntry.id },
        relations: { lines: { account: true }, period: true },
      });
      return saved;
    };

    if (input.manager) {
      return run(input.manager);
    }
    return this.entries.manager.transaction(run);
  }

  /**
   * COD confirm (admin → processing, or shipped if processing skipped):
   * Dr AR / Cr Sales (+ shipping revenue); Dr COGS / Cr Inventory when cost > 0.
   */
  async postOrderConfirm(
    order: Order,
    manager: EntityManager,
  ): Promise<JournalEntry | null> {
    const subtotal = parseWholePkr(order.subtotal, 'subtotal');
    const discount = parseWholePkr(order.discountAmount ?? '0', 'discount');
    const merchandiseNet = Math.max(0, subtotal - discount);
    const shipping = parseWholePkr(order.shippingAmount, 'shipping');
    const lines: JournalLineInput[] = [];

    if (merchandiseNet > 0) {
      lines.push(
        { accountCode: ACCOUNT_CODES.AR, debit: merchandiseNet, credit: 0 },
        { accountCode: ACCOUNT_CODES.SALES, debit: 0, credit: merchandiseNet },
      );
    }
    if (shipping > 0) {
      lines.push(
        { accountCode: ACCOUNT_CODES.AR, debit: shipping, credit: 0 },
        {
          accountCode: ACCOUNT_CODES.SHIPPING_REVENUE,
          debit: 0,
          credit: shipping,
        },
      );
    }

    const cogs = await this.computeOrderCogs(order, manager);
    if (cogs > 0) {
      lines.push(
        { accountCode: ACCOUNT_CODES.COGS, debit: cogs, credit: 0 },
        { accountCode: ACCOUNT_CODES.INVENTORY, debit: 0, credit: cogs },
      );
    }

    if (lines.length === 0) {
      return null;
    }

    return this.postBalancedEntry({
      memo: `Order ${order.orderNumber} confirmed (AR/Sales/COGS)`,
      sourceType: 'order',
      sourceId: order.id,
      eventKind: 'order.confirm',
      lines,
      manager,
    });
  }

  /** COD collected: Dr Cash / Cr AR = order total. */
  async postOrderDelivered(
    order: Order,
    manager: EntityManager,
  ): Promise<JournalEntry | null> {
    const total = parseWholePkr(order.total, 'total');
    if (total === 0) {
      return null;
    }
    return this.postBalancedEntry({
      memo: `Order ${order.orderNumber} delivered (Cash/AR)`,
      sourceType: 'order',
      sourceId: order.id,
      eventKind: 'order.delivered',
      lines: [
        { accountCode: ACCOUNT_CODES.CASH, debit: total, credit: 0 },
        { accountCode: ACCOUNT_CODES.AR, debit: 0, credit: total },
      ],
      manager,
    });
  }

  /**
   * After return inspect + restock:
   * Dr Sales / Cr Refunds Payable = merchandise refund (shipping never refunded)
   * Dr Inventory / Cr COGS = returned COGS when > 0
   */
  async postReturnInspect(input: {
    returnId: string;
    orderNumber: string;
    refundAmountPkr: number;
    cogsPkr: number;
    manager: EntityManager;
  }): Promise<JournalEntry | null> {
    const lines: JournalLineInput[] = [];
    if (input.refundAmountPkr > 0) {
      lines.push(
        {
          accountCode: ACCOUNT_CODES.SALES,
          debit: input.refundAmountPkr,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.REFUNDS_PAYABLE,
          debit: 0,
          credit: input.refundAmountPkr,
        },
      );
    }
    if (input.cogsPkr > 0) {
      lines.push(
        {
          accountCode: ACCOUNT_CODES.INVENTORY,
          debit: input.cogsPkr,
          credit: 0,
        },
        { accountCode: ACCOUNT_CODES.COGS, debit: 0, credit: input.cogsPkr },
      );
    }
    if (lines.length === 0) {
      return null;
    }
    return this.postBalancedEntry({
      memo: `Return on order ${input.orderNumber} inspected (Sales/Refunds Payable/COGS)`,
      sourceType: 'return',
      sourceId: input.returnId,
      eventKind: 'return.inspect',
      lines,
      manager: input.manager,
    });
  }

  /**
   * Bank transfer paid to customer:
   * Dr Refunds Payable / Cr Bank
   */
  async postReturnRefundPaid(input: {
    returnId: string;
    orderNumber: string;
    refundAmountPkr: number;
    manager: EntityManager;
  }): Promise<JournalEntry | null> {
    if (input.refundAmountPkr <= 0) {
      return null;
    }
    return this.postBalancedEntry({
      memo: `Return on order ${input.orderNumber} refund paid (Bank)`,
      sourceType: 'return',
      sourceId: input.returnId,
      eventKind: 'return.refund_paid',
      lines: [
        {
          accountCode: ACCOUNT_CODES.REFUNDS_PAYABLE,
          debit: input.refundAmountPkr,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.BANK,
          debit: 0,
          credit: input.refundAmountPkr,
        },
      ],
      manager: input.manager,
    });
  }

  /**
   * Reverse all non-reversal journals for an order (idempotent).
   */
  async reverseOrderJournals(
    order: Order,
    manager: EntityManager,
  ): Promise<JournalEntry | null> {
    const existingReverse = await manager.findOne(JournalEntry, {
      where: {
        sourceType: 'order',
        sourceId: order.id,
        eventKind: 'order.reverse',
      },
    });
    if (existingReverse) {
      return existingReverse;
    }

    const originals = await manager.find(JournalEntry, {
      where: {
        sourceType: 'order',
        sourceId: order.id,
      },
      relations: { lines: true },
      order: { createdAt: 'ASC' },
    });

    const toReverse = originals.filter(
      (entry) => entry.eventKind !== 'order.reverse',
    );
    if (toReverse.length === 0) {
      return null;
    }

    const lines: JournalLineInput[] = [];
    for (const entry of toReverse) {
      for (const line of entry.lines ?? []) {
        const debit = parseWholePkr(line.debit, 'debit');
        const credit = parseWholePkr(line.credit, 'credit');
        const account = await manager.findOne(Account, {
          where: { id: line.accountId },
        });
        if (!account) {
          throw new BadRequestException('Missing account for journal reverse.');
        }
        lines.push({
          accountCode: account.code,
          debit: credit,
          credit: debit,
        });
      }
    }

    return this.postBalancedEntry({
      memo: `Order ${order.orderNumber} cancelled — reverse journals`,
      sourceType: 'order',
      sourceId: order.id,
      eventKind: 'order.reverse',
      lines,
      manager,
    });
  }

  private async computeOrderCogs(
    order: Order,
    manager: EntityManager,
  ): Promise<number> {
    const items = order.items ?? [];
    const productIds = [
      ...new Set(
        items
          .map((item) => item.productId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (productIds.length === 0) {
      return 0;
    }
    const products = await manager.find(Product, {
      where: { id: In(productIds) },
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    let total = 0;
    for (const item of items) {
      if (!item.productId) {
        continue;
      }
      const product = byId.get(item.productId);
      if (!product) {
        continue;
      }
      const unitCost = parseWholePkr(product.cost ?? '0', 'cost');
      if (unitCost === 0) {
        continue;
      }
      total = sumWholePkr([total, lineTotalWholePkr(unitCost, item.quantity)]);
    }
    return total;
  }
}
