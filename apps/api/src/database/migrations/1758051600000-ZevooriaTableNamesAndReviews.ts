import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Safe rename of existing commerce/catalog tables to the Zevooria-prefixed
 * convention, plus creation of zevooria_reviews. Preserves data, PKs, and FKs.
 */
export class ZevooriaTableNamesAndReviews1758051600000 implements MigrationInterface {
  name = 'ZevooriaTableNamesAndReviews1758051600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "product_media" RENAME TO "zevooria_product_media"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "products" RENAME TO "zevooria_products"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "payments" RENAME TO "zevooria_payments"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "order_addresses" RENAME TO "zevooria_order_addresses"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "order_items" RENAME TO "zevooria_order_items"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "orders" RENAME TO "zevooria_orders"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "sessions" RENAME TO "zevooria_sessions"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "users" RENAME TO "zevooria_customers"`,
    );

    await queryRunner.query(`
      CREATE TABLE "zevooria_reviews" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "order_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "rating" integer NOT NULL,
        "body" varchar(2000) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_zevooria_reviews_rating"
          CHECK ("rating" >= 1 AND "rating" <= 5),
        CONSTRAINT "CHK_zevooria_reviews_body_len"
          CHECK (char_length(btrim("body")) >= 10),
        CONSTRAINT "UQ_zevooria_reviews_user_product"
          UNIQUE ("user_id", "product_id"),
        CONSTRAINT "FK_zevooria_reviews_user"
          FOREIGN KEY ("user_id") REFERENCES "zevooria_customers"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_zevooria_reviews_order"
          FOREIGN KEY ("order_id") REFERENCES "zevooria_orders"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_zevooria_reviews_product"
          FOREIGN KEY ("product_id") REFERENCES "zevooria_products"("id")
          ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_zevooria_reviews_order_id" ON "zevooria_reviews" ("order_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_zevooria_reviews_product_id" ON "zevooria_reviews" ("product_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "zevooria_reviews"`);

    await queryRunner.query(
      `ALTER TABLE IF EXISTS "zevooria_customers" RENAME TO "users"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "zevooria_sessions" RENAME TO "sessions"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "zevooria_orders" RENAME TO "orders"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "zevooria_order_items" RENAME TO "order_items"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "zevooria_order_addresses" RENAME TO "order_addresses"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "zevooria_payments" RENAME TO "payments"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "zevooria_products" RENAME TO "products"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "zevooria_product_media" RENAME TO "product_media"`,
    );
  }
}
