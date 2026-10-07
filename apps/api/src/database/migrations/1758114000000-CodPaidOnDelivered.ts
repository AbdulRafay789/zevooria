import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfill: COD cash is collected when the order is delivered.
 * Older delivered COD rows may still show PENDING.
 */
export class CodPaidOnDelivered1758114000000 implements MigrationInterface {
  name = 'CodPaidOnDelivered1758114000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE zevooria_payments AS p
      SET status = 'SUCCESS'::payment_status,
          updated_at = NOW()
      FROM zevooria_orders AS o
      WHERE p.order_id = o.id
        AND o.status = 'delivered'
        AND p.provider = 'COD'::payment_provider
        AND p.status <> 'SUCCESS'::payment_status
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE zevooria_payments AS p
      SET status = 'PENDING'::payment_status,
          updated_at = NOW()
      FROM zevooria_orders AS o
      WHERE p.order_id = o.id
        AND o.status = 'delivered'
        AND p.provider = 'COD'::payment_provider
        AND p.status = 'SUCCESS'::payment_status
    `);
  }
}
