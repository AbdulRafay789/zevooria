import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Admin in-app notifications, receipts, push subscriptions, and preferences.
 */
export class AdminNotifications1758103200000 implements MigrationInterface {
  name = 'AdminNotifications1758103200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "zevooria_admin_notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "type" character varying(64) NOT NULL,
        "title" character varying(200) NOT NULL,
        "body" character varying(1000) NOT NULL,
        "resource_type" character varying(64),
        "resource_id" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_zevooria_admin_notifications" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_zevooria_admin_notifications_created_at"
      ON "zevooria_admin_notifications" ("created_at")
    `);

    await queryRunner.query(`
      CREATE TABLE "zevooria_admin_notification_receipts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "notification_id" uuid NOT NULL,
        "admin_user_id" uuid NOT NULL,
        "read_at" TIMESTAMPTZ,
        CONSTRAINT "PK_zevooria_admin_notification_receipts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_zevooria_admin_notification_receipts"
          UNIQUE ("notification_id", "admin_user_id"),
        CONSTRAINT "FK_zevooria_admin_notification_receipts_notification"
          FOREIGN KEY ("notification_id")
          REFERENCES "zevooria_admin_notifications"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_zevooria_admin_notification_receipts_admin"
          FOREIGN KEY ("admin_user_id")
          REFERENCES "zevooria_admin_users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_zevooria_admin_notification_receipts_admin"
      ON "zevooria_admin_notification_receipts" ("admin_user_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "zevooria_admin_push_subscriptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "admin_user_id" uuid NOT NULL,
        "endpoint" text NOT NULL,
        "p256dh" text NOT NULL,
        "auth" text NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_zevooria_admin_push_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_zevooria_admin_push_subscriptions_endpoint" UNIQUE ("endpoint"),
        CONSTRAINT "FK_zevooria_admin_push_subscriptions_admin"
          FOREIGN KEY ("admin_user_id")
          REFERENCES "zevooria_admin_users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "zevooria_admin_notification_preferences" (
        "admin_user_id" uuid NOT NULL,
        "order_placed" boolean NOT NULL DEFAULT true,
        "push_enabled" boolean NOT NULL DEFAULT false,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_zevooria_admin_notification_preferences"
          PRIMARY KEY ("admin_user_id"),
        CONSTRAINT "FK_zevooria_admin_notification_preferences_admin"
          FOREIGN KEY ("admin_user_id")
          REFERENCES "zevooria_admin_users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "zevooria_admin_notification_preferences"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "zevooria_admin_push_subscriptions"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "zevooria_admin_notification_receipts"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "zevooria_admin_notifications"`,
    );
  }
}
