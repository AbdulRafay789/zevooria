import { MigrationInterface, QueryRunner } from 'typeorm';

/** Expand order_status for ops workflow: processing, shipped, delivered. */
export class OrderStatusExpansion1758063600000 implements MigrationInterface {
  name = 'OrderStatusExpansion1758063600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'processing'`,
    );
    await queryRunner.query(
      `ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'shipped'`,
    );
    await queryRunner.query(
      `ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'delivered'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL cannot easily remove enum values safely; leave as no-op.
  }
}
