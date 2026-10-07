import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Compare-at price + catalog sort order, promo codes, and order discount fields.
 * Seeds promotions:read / promotions:update for the admin role.
 */
export class CompareAtSortPromo1758117600000 implements MigrationInterface {
  name = 'CompareAtSortPromo1758117600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "zevooria_products"
      ADD COLUMN IF NOT EXISTS "compare_at_price" numeric(12,2) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "zevooria_products"
      ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      WITH ordered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY name ASC, created_at ASC) - 1 AS idx
        FROM "zevooria_products"
      )
      UPDATE "zevooria_products" p
      SET "sort_order" = ordered.idx
      FROM ordered
      WHERE p.id = ordered.id
    `);

    await queryRunner.query(`
      CREATE TYPE "promo_discount_type" AS ENUM ('percent', 'fixed')
    `);

    await queryRunner.query(`
      CREATE TABLE "zevooria_promo_codes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(64) NOT NULL,
        "discount_type" "promo_discount_type" NOT NULL,
        "discount_value" numeric(12,2) NOT NULL,
        "min_subtotal" numeric(12,2) NOT NULL DEFAULT 1599,
        "max_uses" integer NULL,
        "used_count" integer NOT NULL DEFAULT 0,
        "starts_at" TIMESTAMPTZ NULL,
        "ends_at" TIMESTAMPTZ NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_zevooria_promo_codes_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "zevooria_orders"
      ADD COLUMN IF NOT EXISTS "discount_amount" numeric(12,2) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "zevooria_orders"
      ADD COLUMN IF NOT EXISTS "promo_code_id" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "zevooria_orders"
      ADD COLUMN IF NOT EXISTS "promo_code" varchar(64) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "zevooria_orders"
      ADD CONSTRAINT "FK_zevooria_orders_promo_code"
      FOREIGN KEY ("promo_code_id") REFERENCES "zevooria_promo_codes"("id")
      ON DELETE SET NULL
    `);

    await queryRunner.query(
      `INSERT INTO "zevooria_admin_permissions" ("code", "name")
       VALUES ('promotions:read', 'View promotions'),
              ('promotions:update', 'Manage promotions')
       ON CONFLICT ("code") DO NOTHING`,
    );
    await queryRunner.query(`
      INSERT INTO "zevooria_admin_role_permissions" ("role_id", "permission_id")
      SELECT r.id, p.id
      FROM "zevooria_admin_roles" r
      CROSS JOIN "zevooria_admin_permissions" p
      WHERE r.code = 'admin'
        AND p.code IN ('promotions:read', 'promotions:update')
        AND NOT EXISTS (
          SELECT 1 FROM "zevooria_admin_role_permissions" rp
          WHERE rp.role_id = r.id AND rp.permission_id = p.id
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "zevooria_admin_role_permissions" rp
      USING "zevooria_admin_permissions" p
      WHERE rp.permission_id = p.id
        AND p.code IN ('promotions:read', 'promotions:update')
    `);
    await queryRunner.query(`
      DELETE FROM "zevooria_admin_permissions"
      WHERE code IN ('promotions:read', 'promotions:update')
    `);

    await queryRunner.query(`
      ALTER TABLE "zevooria_orders"
      DROP CONSTRAINT IF EXISTS "FK_zevooria_orders_promo_code"
    `);
    await queryRunner.query(`
      ALTER TABLE "zevooria_orders" DROP COLUMN IF EXISTS "promo_code"
    `);
    await queryRunner.query(`
      ALTER TABLE "zevooria_orders" DROP COLUMN IF EXISTS "promo_code_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "zevooria_orders" DROP COLUMN IF EXISTS "discount_amount"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "zevooria_promo_codes"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "promo_discount_type"`);

    await queryRunner.query(`
      ALTER TABLE "zevooria_products" DROP COLUMN IF EXISTS "sort_order"
    `);
    await queryRunner.query(`
      ALTER TABLE "zevooria_products" DROP COLUMN IF EXISTS "compare_at_price"
    `);
  }
}
