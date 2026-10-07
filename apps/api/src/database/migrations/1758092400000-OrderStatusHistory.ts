import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderStatusHistory1758092400000 implements MigrationInterface {
  name = 'OrderStatusHistory1758092400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "zevooria_order_status_history" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "from_status" varchar(32) NULL,
        "to_status" varchar(32) NOT NULL,
        "actor_type" varchar(32) NOT NULL,
        "actor_id" uuid NULL,
        "note" varchar(500) NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_zevooria_order_status_history_order"
          FOREIGN KEY ("order_id") REFERENCES "zevooria_orders"("id")
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_zevooria_order_status_history_order_id"
        ON "zevooria_order_status_history" ("order_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_zevooria_order_status_history_created_at"
        ON "zevooria_order_status_history" ("created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "zevooria_order_status_history"`,
    );
  }
}
