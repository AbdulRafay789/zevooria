import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Soft-delete products via archived status (reviews RESTRICT hard deletes).
 */
export class ProductArchivedStatus1758106800000 implements MigrationInterface {
  name = 'ProductArchivedStatus1758106800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "product_status" ADD VALUE IF NOT EXISTS 'archived'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL cannot easily remove enum values; leave archived in place.
  }
}
