import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialCatalog1757961600000 implements MigrationInterface {
  name = 'InitialCatalog1757961600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(
      `CREATE TYPE "public"."product_status" AS ENUM('draft', 'active')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."media_type" AS ENUM('image', 'video')`,
    );
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(200) NOT NULL,
        "slug" character varying(220) NOT NULL,
        "description" text NOT NULL,
        "price" numeric(12,2) NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'PKR',
        "status" "public"."product_status" NOT NULL DEFAULT 'draft',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_products_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_products_slug" UNIQUE ("slug")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "product_media" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "product_id" uuid NOT NULL,
        "type" "public"."media_type" NOT NULL,
        "storage_key" character varying(1000) NOT NULL,
        "alt_text" character varying(300),
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_primary" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_product_media_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_product_media_product"
          FOREIGN KEY ("product_id") REFERENCES "products"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_product_media_product_id" ON "product_media" ("product_id")`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_product_media_one_primary_image"
      ON "product_media" ("product_id")
      WHERE "is_primary" = true AND "type" = 'image'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."UQ_product_media_one_primary_image"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_product_media_product_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "product_media"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."media_type"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."product_status"`);
  }
}
