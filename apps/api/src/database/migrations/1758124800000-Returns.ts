import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Customer returns: admin-created, delivered-only, line-level,
 * inspect→restock, bank refund via Refunds Payable.
 */
export class Returns1758124800000 implements MigrationInterface {
  name = 'Returns1758124800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "zevooria_return_status" AS ENUM (
          'pending_inspect',
          'inspected',
          'refunded',
          'cancelled'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "zevooria_returns" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "status" "zevooria_return_status" NOT NULL DEFAULT 'pending_inspect',
        "reason" varchar(1000) NULL,
        "refund_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "created_by_admin_id" uuid NULL,
        "inspected_at" TIMESTAMPTZ NULL,
        "restocked_at" TIMESTAMPTZ NULL,
        "refunded_at" TIMESTAMPTZ NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_zevooria_returns_order"
          FOREIGN KEY ("order_id") REFERENCES "zevooria_orders"("id")
          ON DELETE RESTRICT,
        CONSTRAINT "FK_zevooria_returns_admin"
          FOREIGN KEY ("created_by_admin_id") REFERENCES "zevooria_admin_users"("id")
          ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_zevooria_returns_order_id"
        ON "zevooria_returns" ("order_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_zevooria_returns_status"
        ON "zevooria_returns" ("status")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "zevooria_return_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "return_id" uuid NOT NULL,
        "order_item_id" uuid NOT NULL,
        "product_id" uuid NULL,
        "product_name" varchar(200) NOT NULL,
        "quantity" integer NOT NULL,
        "unit_price" numeric(12,2) NOT NULL,
        "line_refund" numeric(12,2) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_zevooria_return_items_return"
          FOREIGN KEY ("return_id") REFERENCES "zevooria_returns"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_zevooria_return_items_order_item"
          FOREIGN KEY ("order_item_id") REFERENCES "zevooria_order_items"("id")
          ON DELETE RESTRICT,
        CONSTRAINT "FK_zevooria_return_items_product"
          FOREIGN KEY ("product_id") REFERENCES "zevooria_products"("id")
          ON DELETE SET NULL,
        CONSTRAINT "CHK_zevooria_return_items_qty"
          CHECK ("quantity" >= 1),
        CONSTRAINT "UQ_zevooria_return_items_return_order_item"
          UNIQUE ("return_id", "order_item_id")
      )
    `);

    await queryRunner.query(
      `INSERT INTO "zevooria_admin_permissions" ("code", "name")
       VALUES ('returns:read', 'View returns'),
              ('returns:update', 'Manage returns')
       ON CONFLICT ("code") DO NOTHING`,
    );
    await queryRunner.query(`
      INSERT INTO "zevooria_admin_role_permissions" ("role_id", "permission_id")
      SELECT r.id, p.id
      FROM "zevooria_admin_roles" r
      CROSS JOIN "zevooria_admin_permissions" p
      WHERE r.code = 'admin'
        AND p.code IN ('returns:read', 'returns:update')
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
        AND p.code IN ('returns:read', 'returns:update')
    `);
    await queryRunner.query(`
      DELETE FROM "zevooria_admin_permissions"
      WHERE code IN ('returns:read', 'returns:update')
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "zevooria_return_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "zevooria_returns"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "zevooria_return_status"`);
  }
}
