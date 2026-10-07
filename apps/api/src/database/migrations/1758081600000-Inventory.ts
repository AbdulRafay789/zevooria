import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 6 inventory MVP: warehouses, stock levels, movements, RBAC permissions.
 * Seeds default `main` warehouse and initial on-hand qty for existing products.
 */
export class Inventory1758081600000 implements MigrationInterface {
  name = 'Inventory1758081600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."inventory_movement_type" AS ENUM (
        'receipt', 'sale', 'adjustment', 'reservation', 'release'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "zevooria_warehouses" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" character varying(64) NOT NULL,
        "name" character varying(200) NOT NULL,
        "is_default" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_zevooria_warehouses" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_zevooria_warehouses_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_zevooria_warehouses_one_default"
      ON "zevooria_warehouses" ("is_default")
      WHERE "is_default" = true
    `);

    await queryRunner.query(`
      CREATE TABLE "zevooria_inventory" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "warehouse_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "quantity_on_hand" integer NOT NULL DEFAULT 0,
        "quantity_reserved" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_zevooria_inventory" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_zevooria_inventory_warehouse_product" UNIQUE ("warehouse_id", "product_id"),
        CONSTRAINT "FK_zevooria_inventory_warehouse"
          FOREIGN KEY ("warehouse_id") REFERENCES "zevooria_warehouses"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_zevooria_inventory_product"
          FOREIGN KEY ("product_id") REFERENCES "zevooria_products"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_zevooria_inventory_on_hand_nonneg" CHECK ("quantity_on_hand" >= 0),
        CONSTRAINT "CHK_zevooria_inventory_reserved_nonneg" CHECK ("quantity_reserved" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_zevooria_inventory_warehouse_id" ON "zevooria_inventory" ("warehouse_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_zevooria_inventory_product_id" ON "zevooria_inventory" ("product_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "zevooria_inventory_movements" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "warehouse_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "type" "public"."inventory_movement_type" NOT NULL,
        "quantity_delta" integer NOT NULL,
        "quantity_after" integer NOT NULL,
        "reference_type" character varying(64),
        "reference_id" uuid,
        "note" character varying(500),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_zevooria_inventory_movements" PRIMARY KEY ("id"),
        CONSTRAINT "FK_zevooria_inventory_movements_warehouse"
          FOREIGN KEY ("warehouse_id") REFERENCES "zevooria_warehouses"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_zevooria_inventory_movements_product"
          FOREIGN KEY ("product_id") REFERENCES "zevooria_products"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_zevooria_inventory_movements_warehouse_id"
        ON "zevooria_inventory_movements" ("warehouse_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_zevooria_inventory_movements_product_id"
        ON "zevooria_inventory_movements" ("product_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_zevooria_inventory_movements_created_at"
        ON "zevooria_inventory_movements" ("created_at")`,
    );

    await queryRunner.query(`
      INSERT INTO "zevooria_warehouses" ("code", "name", "is_default", "is_active")
      VALUES ('main', 'Main warehouse', true, true)
    `);

    await queryRunner.query(`
      INSERT INTO "zevooria_inventory" ("warehouse_id", "product_id", "quantity_on_hand", "quantity_reserved")
      SELECT w.id, p.id, 100, 0
      FROM "zevooria_warehouses" w
      CROSS JOIN "zevooria_products" p
      WHERE w.code = 'main'
    `);

    await queryRunner.query(`
      INSERT INTO "zevooria_inventory_movements" (
        "warehouse_id", "product_id", "type", "quantity_delta", "quantity_after",
        "reference_type", "note"
      )
      SELECT i.warehouse_id, i.product_id, 'receipt', i.quantity_on_hand, i.quantity_on_hand,
             'seed', 'Initial stock seed'
      FROM "zevooria_inventory" i
    `);

    const perms: Array<[string, string]> = [
      ['inventory:read', 'View inventory stock and movements'],
      ['inventory:update', 'Adjust inventory stock levels'],
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
        AND p.code IN ('inventory:read', 'inventory:update')
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "zevooria_admin_role_permissions" ("role_id", "permission_id")
      SELECT r.id, p.id
      FROM "zevooria_admin_roles" r
      CROSS JOIN "zevooria_admin_permissions" p
      WHERE r.code = 'catalog'
        AND p.code IN ('inventory:read', 'inventory:update')
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "zevooria_admin_role_permissions" ("role_id", "permission_id")
      SELECT r.id, p.id
      FROM "zevooria_admin_roles" r
      CROSS JOIN "zevooria_admin_permissions" p
      WHERE r.code IN ('store_staff', 'store_user')
        AND p.code = 'inventory:read'
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "zevooria_admin_role_permissions" rp
      USING "zevooria_admin_permissions" p
      WHERE rp.permission_id = p.id
        AND p.code IN ('inventory:read', 'inventory:update')
    `);
    await queryRunner.query(`
      DELETE FROM "zevooria_admin_permissions"
      WHERE "code" IN ('inventory:read', 'inventory:update')
    `);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "zevooria_inventory_movements"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "zevooria_inventory"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "zevooria_warehouses"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."inventory_movement_type"`,
    );
  }
}
