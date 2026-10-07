import {
  ACCOUNT_CODES,
  AccountingService,
  type JournalLineInput,
} from './accounting.service';

describe('AccountingService.postBalancedEntry validation', () => {
  it('rejects unbalanced lines without posting', async () => {
    const service = new AccountingService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const lines: JournalLineInput[] = [
      { accountCode: ACCOUNT_CODES.AR, debit: 100, credit: 0 },
      { accountCode: ACCOUNT_CODES.SALES, debit: 0, credit: 50 },
    ];
    await expect(
      service.postBalancedEntry({
        memo: 'bad',
        sourceType: 'test',
        sourceId: '00000000-0000-4000-8000-000000000001',
        eventKind: 'test.unbalanced',
        lines,
        manager: {
          findOne: jest.fn().mockResolvedValue(null),
        } as never,
      }),
    ).rejects.toThrow(/Unbalanced/);
  });

  it('accepts balanced AR/Sales lines', async () => {
    const period = { id: 'period-1', isOpen: true };
    const accounts = [
      { id: 'a-ar', code: ACCOUNT_CODES.AR, isActive: true },
      { id: 'a-sales', code: ACCOUNT_CODES.SALES, isActive: true },
    ];
    const manager = {
      findOne: jest.fn(
        (_entity: unknown, opts?: { where?: Record<string, unknown> }) => {
          if (opts?.where?.eventKind) {
            return Promise.resolve(null);
          }
          if (opts?.where?.isOpen) {
            return Promise.resolve(period);
          }
          if (opts?.where?.id === 'entry-1') {
            return Promise.resolve({ id: 'entry-1', lines: [], period });
          }
          return Promise.resolve(null);
        },
      ),
      find: jest.fn().mockResolvedValue(accounts),
      create: jest.fn((_entity: unknown, data: unknown) => data),
      save: jest.fn((value: unknown) => {
        if (Array.isArray(value)) {
          return Promise.resolve(value as unknown[]);
        }
        return Promise.resolve({ ...(value as object), id: 'entry-1' });
      }),
    };

    const service = new AccountingService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.postBalancedEntry({
      memo: 'Sale',
      sourceType: 'test',
      sourceId: '00000000-0000-4000-8000-000000000002',
      eventKind: 'test.ok',
      lines: [
        { accountCode: ACCOUNT_CODES.AR, debit: 100, credit: 0 },
        { accountCode: ACCOUNT_CODES.SALES, debit: 0, credit: 100 },
      ],
      manager: manager as never,
    });

    expect(result).toMatchObject({ id: 'entry-1' });
    expect(manager.save).toHaveBeenCalled();
  });
});

describe('AccountingService report aggregation', () => {
  function mockAggregates(
    rows: Array<{
      code: string;
      name: string;
      type: string;
      debit: string;
      credit: string;
    }>,
  ) {
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    };
    return new AccountingService(
      {} as never,
      {} as never,
      {} as never,
      { createQueryBuilder: jest.fn().mockReturnValue(qb) } as never,
    );
  }

  it('builds profit and loss from revenue and expense aggregates', async () => {
    const service = mockAggregates([
      {
        code: '4100',
        name: 'Product Sales',
        type: 'revenue',
        debit: '0',
        credit: '1000',
      },
      {
        code: '5100',
        name: 'COGS',
        type: 'expense',
        debit: '400',
        credit: '0',
      },
    ]);
    const pnl = await service.profitAndLoss();
    expect(pnl.totalRevenue).toBe('1000.00');
    expect(pnl.totalExpenses).toBe('400.00');
    expect(pnl.netIncome).toBe('600.00');
  });

  it('builds balance sheet with unclosed net income', async () => {
    const service = mockAggregates([
      {
        code: '1100',
        name: 'Cash',
        type: 'asset',
        debit: '1000',
        credit: '0',
      },
      {
        code: '4100',
        name: 'Product Sales',
        type: 'revenue',
        debit: '0',
        credit: '1000',
      },
      {
        code: '5100',
        name: 'COGS',
        type: 'expense',
        debit: '400',
        credit: '0',
      },
    ]);
    const sheet = await service.balanceSheet();
    expect(sheet.totalAssets).toBe('1000.00');
    expect(sheet.netIncome).toBe('600.00');
    expect(sheet.totalLiabilitiesAndEquity).toBe('600.00');
  });

  it('allows credit-balance assets and net loss on the balance sheet', async () => {
    const service = mockAggregates([
      {
        code: '1100',
        name: 'Cash',
        type: 'asset',
        debit: '100',
        credit: '250',
      },
      {
        code: '4100',
        name: 'Product Sales',
        type: 'revenue',
        debit: '0',
        credit: '100',
      },
      {
        code: '5100',
        name: 'COGS',
        type: 'expense',
        debit: '400',
        credit: '0',
      },
    ]);
    const sheet = await service.balanceSheet();
    expect(sheet.assets[0]?.amount).toBe('-150.00');
    expect(sheet.totalAssets).toBe('-150.00');
    expect(sheet.netIncome).toBe('-300.00');
    const pnl = await service.profitAndLoss();
    expect(pnl.netIncome).toBe('-300.00');
  });
});
