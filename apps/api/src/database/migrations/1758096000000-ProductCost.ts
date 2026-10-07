import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Product unit cost (whole PKR) for COGS on order confirm.
 */
export class ProductCost1758096000000 implements MigrationInterface {
  name = 'ProductCost1758096000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "zevooria_products"
      ADD COLUMN IF NOT EXISTS "cost" numeric(12,2) NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "zevooria_products" DROP COLUMN IF EXISTS "cost"
    `);
  }
}
