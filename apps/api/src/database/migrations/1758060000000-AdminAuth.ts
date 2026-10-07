import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Staff/admin identity separate from customer accounts.
 * Tables: zevooria_admin_users, zevooria_admin_sessions.
 */
export class AdminAuth1758060000000 implements MigrationInterface {
  name = 'AdminAuth1758060000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "zevooria_admin_users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar(320) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "full_name" varchar(200) NOT NULL,
        "role" varchar(40) NOT NULL DEFAULT 'admin',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_zevooria_admin_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "zevooria_admin_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "admin_user_id" uuid NOT NULL,
        "token_hash" varchar(128) NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_zevooria_admin_sessions_token_hash" UNIQUE ("token_hash"),
        CONSTRAINT "FK_zevooria_admin_sessions_user"
          FOREIGN KEY ("admin_user_id") REFERENCES "zevooria_admin_users"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_zevooria_admin_sessions_admin_user_id" ON "zevooria_admin_sessions" ("admin_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_zevooria_admin_sessions_expires_at" ON "zevooria_admin_sessions" ("expires_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "zevooria_admin_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "zevooria_admin_users"`);
  }
}
