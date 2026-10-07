import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 14 double-entry accounting: COA, fiscal periods, immutable journals.
 * Seeds starting chart of accounts from docs/ACCOUNTING.md and current-year period.
 */
export class Accounting1758099600000 implements MigrationInterface {
  name = 'Accounting1758099600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."zevooria_account_type" AS ENUM (
        'asset', 'liability', 'equity', 'revenue', 'expense'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "zevooria_accounts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" character varying(16) NOT NULL,
        "name" character varying(200) NOT NULL,
        "type" "public"."zevooria_account_type" NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_zevooria_accounts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_zevooria_accounts_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "zevooria_fiscal_periods" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "label" character varying(64) NOT NULL,
        "starts_on" date NOT NULL,
        "ends_on" date NOT NULL,
        "is_open" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_zevooria_fiscal_periods" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_zevooria_fiscal_periods_label" UNIQUE ("label")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_zevooria_fiscal_periods_one_open"
      ON "zevooria_fiscal_periods" ("is_open")
      WHERE "is_open" = true
    `);

    await queryRunner.query(`
      CREATE TABLE "zevooria_journal_entries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "period_id" uuid NOT NULL,
        "entry_date" date NOT NULL,
        "memo" character varying(500) NOT NULL,
        "source_type" character varying(64) NOT NULL,
        "source_id" uuid NOT NULL,
        "event_kind" character varying(64) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_zevooria_journal_entries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_zevooria_journal_entries_period"
          FOREIGN KEY ("period_id") REFERENCES "zevooria_fiscal_periods"("id")
          ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_zevooria_journal_entries_source_event"
      ON "zevooria_journal_entries" ("source_type", "source_id", "event_kind")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_zevooria_journal_entries_created_at"
      ON "zevooria_journal_entries" ("created_at")
    `);

    await queryRunner.query(`
      CREATE TABLE "zevooria_journal_lines" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "entry_id" uuid NOT NULL,
        "account_id" uuid NOT NULL,
        "debit" numeric(12,2) NOT NULL DEFAULT 0,
        "credit" numeric(12,2) NOT NULL DEFAULT 0,
        CONSTRAINT "PK_zevooria_journal_lines" PRIMARY KEY ("id"),
        CONSTRAINT "FK_zevooria_journal_lines_entry"
          FOREIGN KEY ("entry_id") REFERENCES "zevooria_journal_entries"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_zevooria_journal_lines_account"
          FOREIGN KEY ("account_id") REFERENCES "zevooria_accounts"("id")
          ON DELETE RESTRICT,
        CONSTRAINT "CHK_zevooria_journal_lines_nonneg"
          CHECK ("debit" >= 0 AND "credit" >= 0),
        CONSTRAINT "CHK_zevooria_journal_lines_one_side"
          CHECK (
            ("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0)
          )
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_zevooria_journal_lines_entry_id"
      ON "zevooria_journal_lines" ("entry_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_zevooria_journal_lines_account_id"
      ON "zevooria_journal_lines" ("account_id")
    `);

    const accounts: Array<[string, string, string]> = [
      ['1100', 'Cash', 'asset'],
      ['1200', 'Bank', 'asset'],
      ['1300', 'Accounts Receivable', 'asset'],
      ['1400', 'Inventory', 'asset'],
      ['1500', 'Payment Gateway Receivable', 'asset'],
      ['2100', 'Accounts Payable', 'liability'],
      ['2200', 'Taxes Payable', 'liability'],
      ['2300', 'Refunds Payable', 'liability'],
      ['2400', 'Reseller Commissions Payable', 'liability'],
      ['3100', 'Owner Capital', 'equity'],
      ['3200', 'Retained Earnings', 'equity'],
      ['4100', 'Product Sales', 'revenue'],
      ['4200', 'Shipping Revenue', 'revenue'],
      ['4300', 'Other Revenue', 'revenue'],
      ['5100', 'Cost of Goods Sold', 'expense'],
      ['6100', 'Marketing Expense', 'expense'],
      ['6200', 'Shipping Expense', 'expense'],
      ['6300', 'Payment Gateway Fees', 'expense'],
      ['6400', 'Salaries', 'expense'],
      ['6500', 'General Expenses', 'expense'],
    ];

    for (const [code, name, type] of accounts) {
      await queryRunner.query(
        `INSERT INTO "zevooria_accounts" ("code", "name", "type")
         VALUES ($1, $2, $3::"public"."zevooria_account_type")
         ON CONFLICT ("code") DO NOTHING`,
        [code, name, type],
      );
    }

    const year = new Date().getUTCFullYear();
    await queryRunner.query(
      `INSERT INTO "zevooria_fiscal_periods" ("label", "starts_on", "ends_on", "is_open")
       VALUES ($1, $2, $3, true)
       ON CONFLICT ("label") DO NOTHING`,
      [`FY${year}`, `${year}-01-01`, `${year}-12-31`],
    );

    const perms: Array<[string, string]> = [
      [
        'accounting:read',
        'View chart of accounts, journals, and trial balance',
      ],
      ['accounting:manage', 'Post manual accounting adjustments'],
    ];
    for (const [code, name] of perms) {
      await queryRunner.query(
        `INSERT INTO "zevooria_admin_permissions" ("code", "name")
         VALUES ($1, $2) ON CONFLICT ("code") DO NOTHING`,
        [code, name],
      );
    }

    await queryRunner.query(`
      INSERT INTO "zevooria_admin_role_permissions" ("role_id", "permission_id")
      SELECT r.id, p.id
      FROM "zevooria_admin_roles" r
      CROSS JOIN "zevooria_admin_permissions" p
      WHERE r.code IN ('admin', 'store_admin')
        AND p.code IN ('accounting:read', 'accounting:manage')
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "zevooria_admin_role_permissions" rp
      USING "zevooria_admin_permissions" p
      WHERE rp.permission_id = p.id
        AND p.code IN ('accounting:read', 'accounting:manage')
    `);
    await queryRunner.query(`
      DELETE FROM "zevooria_admin_permissions"
      WHERE code IN ('accounting:read', 'accounting:manage')
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "zevooria_journal_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "zevooria_journal_entries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "zevooria_fiscal_periods"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "zevooria_accounts"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."zevooria_account_type"`,
    );
  }
}
