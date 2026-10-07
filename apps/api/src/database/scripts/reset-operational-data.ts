/**
 * ONE-OFF operational data reset (destructive).
 *
 * Clears transactional/commerce history while keeping identity, RBAC, catalog,
 * warehouses, chart of accounts, fiscal periods, customer addresses, promo
 * definitions, admin notification preferences, and push subscriptions.
 *
 * Confirmed parameters:
 * - inventory: quantity_on_hand = 100, quantity_reserved = 0 (+ fill missing rows)
 * - promo_codes.used_count = 0
 * - clear customer/admin sessions + auth tokens
 *
 * SAFETY:
 * - Does nothing unless CONFIRM_OPERATIONAL_RESET=YES
 * - If DB_HOST is not localhost/127.0.0.1, also requires CONFIRM_PRODUCTION_RESET=YES
 * - Take an RDS snapshot / pg_dump before running on production
 *
 * Usage (after deploy + API image rebuild so this file is in the image):
 *
 *   docker compose exec \
 *     -e CONFIRM_OPERATIONAL_RESET=YES \
 *     -e CONFIRM_PRODUCTION_RESET=YES \
 *     api npm run reset:operational:prod
 *
 * Local:
 *
 *   CONFIRM_OPERATIONAL_RESET=YES npm run reset:operational:dev
 */
import 'reflect-metadata';
import dataSource from '../../database/data-source';

const CONFIRM = 'YES';

const CLEAR_TABLES = [
  'zevooria_return_items',
  'zevooria_returns',
  'zevooria_reviews',
  'zevooria_payments',
  'zevooria_order_status_history',
  'zevooria_order_items',
  'zevooria_order_addresses',
  'zevooria_orders',
  'zevooria_journal_lines',
  'zevooria_journal_entries',
  'zevooria_inventory_movements',
  'zevooria_cart_items',
  'zevooria_carts',
  'zevooria_audit_logs',
  'zevooria_admin_notification_receipts',
  'zevooria_admin_notifications',
  'zevooria_sessions',
  'zevooria_admin_sessions',
  'zevooria_auth_tokens',
] as const;

const KEEP_TABLES = [
  'zevooria_customers',
  'zevooria_admin_users',
  'zevooria_admin_roles',
  'zevooria_admin_permissions',
  'zevooria_admin_role_permissions',
  'zevooria_admin_user_roles',
  'zevooria_products',
  'zevooria_product_media',
  'zevooria_warehouses',
  'zevooria_accounts',
  'zevooria_fiscal_periods',
  'zevooria_customer_addresses',
  'zevooria_promo_codes',
  'zevooria_admin_notification_preferences',
  'zevooria_admin_push_subscriptions',
  'zevooria_inventory',
] as const;

function isRemoteHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  return h !== 'localhost' && h !== '127.0.0.1' && h !== '::1';
}

async function countRows(
  query: (sql: string) => Promise<{ count: string }[]>,
  table: string,
): Promise<number> {
  const rows = await query(`SELECT COUNT(*)::text AS count FROM "${table}"`);
  return Number(rows[0]?.count ?? 0);
}

async function run(): Promise<void> {
  if (process.env.CONFIRM_OPERATIONAL_RESET !== CONFIRM) {
    throw new Error(
      'Refusing to run: set CONFIRM_OPERATIONAL_RESET=YES to clear operational data.',
    );
  }

  const host = process.env.DB_HOST ?? 'localhost';
  if (isRemoteHost(host) && process.env.CONFIRM_PRODUCTION_RESET !== CONFIRM) {
    throw new Error(
      `Refusing remote DB_HOST=${host}: also set CONFIRM_PRODUCTION_RESET=YES (after snapshot).`,
    );
  }

  await dataSource.initialize();
  const qr = dataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    const before: Record<string, number> = {};
    for (const table of CLEAR_TABLES) {
      before[table] = await countRows(
        (sql) => qr.query(sql) as Promise<{ count: string }[]>,
        table,
      );
    }
    before['zevooria_inventory'] = await countRows(
      (sql) => qr.query(sql) as Promise<{ count: string }[]>,
      'zevooria_inventory',
    );
    before['zevooria_promo_codes'] = await countRows(
      (sql) => qr.query(sql) as Promise<{ count: string }[]>,
      'zevooria_promo_codes',
    );

    console.log('[reset:operational] DB host:', host);
    console.log('[reset:operational] Row counts before truncate:');
    for (const [table, count] of Object.entries(before)) {
      console.log(`  ${table}: ${count}`);
    }
    console.log('[reset:operational] Kept tables (not truncated):');
    for (const table of KEEP_TABLES) {
      console.log(`  ${table}`);
    }

    // Truncate all transactional tables in one statement (FK-safe among listed).
    await qr.query(
      `TRUNCATE TABLE ${CLEAR_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY`,
    );

    await qr.query(`
      UPDATE "zevooria_inventory"
      SET
        "quantity_on_hand" = 100,
        "quantity_reserved" = 0,
        "updated_at" = NOW()
    `);

    // Ensure every product × warehouse has a stock row at 100/0.
    await qr.query(`
      INSERT INTO "zevooria_inventory" (
        "id",
        "warehouse_id",
        "product_id",
        "quantity_on_hand",
        "quantity_reserved",
        "created_at",
        "updated_at"
      )
      SELECT
        gen_random_uuid(),
        w."id",
        p."id",
        100,
        0,
        NOW(),
        NOW()
      FROM "zevooria_products" p
      CROSS JOIN "zevooria_warehouses" w
      WHERE NOT EXISTS (
        SELECT 1
        FROM "zevooria_inventory" i
        WHERE i."product_id" = p."id"
          AND i."warehouse_id" = w."id"
      )
    `);

    await qr.query(`
      UPDATE "zevooria_promo_codes"
      SET "used_count" = 0, "updated_at" = NOW()
    `);

    const afterClear: Record<string, number> = {};
    for (const table of CLEAR_TABLES) {
      afterClear[table] = await countRows(
        (sql) => qr.query(sql) as Promise<{ count: string }[]>,
        table,
      );
    }
    const inventoryAfter = await countRows(
      (sql) => qr.query(sql) as Promise<{ count: string }[]>,
      'zevooria_inventory',
    );
    const reservedStuck = await qr.query(
      `SELECT COUNT(*)::text AS count
       FROM "zevooria_inventory"
       WHERE "quantity_reserved" <> 0 OR "quantity_on_hand" <> 100`,
    );
    const reservedCount = Number(
      (reservedStuck as { count: string }[])[0]?.count ?? 0,
    );

    for (const table of CLEAR_TABLES) {
      if (afterClear[table] !== 0) {
        throw new Error(
          `Expected ${table} empty after truncate, found ${afterClear[table]}`,
        );
      }
    }
    if (reservedCount !== 0) {
      throw new Error(
        `Inventory reset incomplete: ${reservedCount} rows not at on_hand=100 reserved=0`,
      );
    }

    await qr.commitTransaction();

    console.log('[reset:operational] Complete.');
    console.log(
      `  inventory rows: ${inventoryAfter} (all 100 on-hand, 0 reserved)`,
    );
    console.log('  promo used_count: all 0');
    console.log('  sessions / auth tokens: cleared');
    console.log(
      '  accounts, customers, admins, RBAC, products, addresses, prefs, push: kept',
    );
  } catch (err) {
    await qr.rollbackTransaction();
    throw err;
  } finally {
    await qr.release();
    await dataSource.destroy();
  }
}

void run().catch((err: unknown) => {
  console.error(
    '[reset:operational] FAILED — no changes committed.',
    err instanceof Error ? err.message : err,
  );
  process.exitCode = 1;
});
