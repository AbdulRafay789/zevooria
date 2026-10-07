import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommerceAuthOrders1758048000000 implements MigrationInterface {
  name = 'CommerceAuthOrders1758048000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "order_status" AS ENUM ('placed', 'cancelled')
    `);
    await queryRunner.query(`
      CREATE TYPE "payment_provider" AS ENUM ('COD', 'EASYPAISA', 'BANK_ALFALAH')
    `);
    await queryRunner.query(`
      CREATE TYPE "payment_status" AS ENUM (
        'CREATED',
        'PENDING',
        'PROCESSING',
        'SUCCESS',
        'FAILED',
        'EXPIRED',
        'REFUNDED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar(320) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "full_name" varchar(200) NOT NULL,
        "phone" varchar(40),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "token_hash" varchar(128) NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_sessions_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_sessions_token_hash" UNIQUE ("token_hash")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_sessions_user_id" ON "sessions" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sessions_expires_at" ON "sessions" ("expires_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_number" varchar(32) NOT NULL,
        "user_id" uuid NOT NULL,
        "status" "order_status" NOT NULL DEFAULT 'placed',
        "currency" varchar(3) NOT NULL DEFAULT 'PKR',
        "subtotal" numeric(12,2) NOT NULL,
        "shipping_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "total" numeric(12,2) NOT NULL,
        "customer_name" varchar(200) NOT NULL,
        "customer_email" varchar(320) NOT NULL,
        "customer_phone" varchar(40) NOT NULL,
        "idempotency_key" varchar(128),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_orders_order_number" UNIQUE ("order_number"),
        CONSTRAINT "UQ_orders_idempotency_key" UNIQUE ("idempotency_key"),
        CONSTRAINT "FK_orders_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_orders_user_id" ON "orders" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "order_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "product_id" uuid,
        "product_name" varchar(200) NOT NULL,
        "product_slug" varchar(220) NOT NULL,
        "unit_price" numeric(12,2) NOT NULL,
        "quantity" integer NOT NULL,
        "line_total" numeric(12,2) NOT NULL,
        CONSTRAINT "FK_order_items_order"
          FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_order_items_product"
          FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_order_items_quantity" CHECK ("quantity" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_order_items_order_id" ON "order_items" ("order_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "order_addresses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "line1" varchar(300) NOT NULL,
        "line2" varchar(300),
        "city" varchar(120) NOT NULL,
        "postal_code" varchar(20) NOT NULL,
        "country" varchar(80) NOT NULL DEFAULT 'Pakistan',
        CONSTRAINT "UQ_order_addresses_order_id" UNIQUE ("order_id"),
        CONSTRAINT "FK_order_addresses_order"
          FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "provider" "payment_provider" NOT NULL,
        "status" "payment_status" NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'PKR',
        "provider_reference" varchar(200),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_payments_order"
          FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_payments_order_id" ON "payments" ("order_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_addresses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payment_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payment_provider"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "order_status"`);
  }
}
