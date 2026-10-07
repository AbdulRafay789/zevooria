import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Customer sessions: short-lived access token + longer-lived refresh token.
 */
export class CustomerSessionRefresh1758110400000 implements MigrationInterface {
  name = 'CustomerSessionRefresh1758110400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "zevooria_sessions"
        ADD COLUMN IF NOT EXISTS "refresh_token_hash" varchar(128),
        ADD COLUMN IF NOT EXISTS "refresh_expires_at" TIMESTAMPTZ
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_zevooria_sessions_refresh_token_hash"
        ON "zevooria_sessions" ("refresh_token_hash")
        WHERE "refresh_token_hash" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_zevooria_sessions_refresh_expires_at"
        ON "zevooria_sessions" ("refresh_expires_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_zevooria_sessions_refresh_expires_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_zevooria_sessions_refresh_token_hash"`,
    );
    await queryRunner.query(`
      ALTER TABLE "zevooria_sessions"
        DROP COLUMN IF EXISTS "refresh_expires_at",
        DROP COLUMN IF EXISTS "refresh_token_hash"
    `);
  }
}
