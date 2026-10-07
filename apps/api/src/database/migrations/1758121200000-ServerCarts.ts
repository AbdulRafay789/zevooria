import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Server-backed guest + customer carts (Phase 8).
 */
export class ServerCarts1758121200000 implements MigrationInterface {
  name = 'ServerCarts1758121200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "zevooria_carts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NULL,
        "guest_key" varchar(64) NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_zevooria_carts_user"
          FOREIGN KEY ("user_id") REFERENCES "zevooria_customers"("id")
          ON DELETE CASCADE,
        CONSTRAINT "CHK_zevooria_carts_owner"
          CHECK (
            ("user_id" IS NOT NULL AND "guest_key" IS NULL)
            OR ("user_id" IS NULL AND "guest_key" IS NOT NULL)
          )
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_zevooria_carts_user_id"
        ON "zevooria_carts" ("user_id")
        WHERE "user_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_zevooria_carts_guest_key"
        ON "zevooria_carts" ("guest_key")
        WHERE "guest_key" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "zevooria_cart_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "cart_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_zevooria_cart_items_cart"
          FOREIGN KEY ("cart_id") REFERENCES "zevooria_carts"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_zevooria_cart_items_product"
          FOREIGN KEY ("product_id") REFERENCES "zevooria_products"("id")
          ON DELETE CASCADE,
        CONSTRAINT "CHK_zevooria_cart_items_qty"
          CHECK ("quantity" >= 1 AND "quantity" <= 20),
        CONSTRAINT "UQ_zevooria_cart_items_cart_product"
          UNIQUE ("cart_id", "product_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_zevooria_cart_items_cart_id"
        ON "zevooria_cart_items" ("cart_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "zevooria_cart_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "zevooria_carts"`);
  }
}
