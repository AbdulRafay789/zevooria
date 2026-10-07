import { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomerAddresses1758088800000 implements MigrationInterface {
  name = 'CustomerAddresses1758088800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "zevooria_customer_addresses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "customer_id" uuid NOT NULL,
        "line1" varchar(300) NOT NULL,
        "line2" varchar(300) NULL,
        "city" varchar(120) NOT NULL,
        "postal_code" varchar(20) NOT NULL,
        "country" varchar(80) NOT NULL DEFAULT 'Pakistan',
        "is_default" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_zevooria_customer_addresses_customer"
          FOREIGN KEY ("customer_id") REFERENCES "zevooria_customers"("id")
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_zevooria_customer_addresses_customer_id"
        ON "zevooria_customer_addresses" ("customer_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_zevooria_customer_addresses_one_default"
        ON "zevooria_customer_addresses" ("customer_id")
        WHERE "is_default" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "zevooria_customer_addresses"`,
    );
  }
}
