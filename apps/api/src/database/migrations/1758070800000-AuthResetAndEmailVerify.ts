import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Customer email verification + password-reset tokens (customer and admin).
 * Email delivery is abstracted; tokens are hashed at rest.
 */
export class AuthResetAndEmailVerify1758070800000 implements MigrationInterface {
  name = 'AuthResetAndEmailVerify1758070800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "zevooria_customers"
      ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMPTZ NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "zevooria_auth_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "subject_type" varchar(20) NOT NULL,
        "subject_id" uuid NOT NULL,
        "purpose" varchar(40) NOT NULL,
        "token_hash" varchar(128) NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "used_at" TIMESTAMPTZ NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_zevooria_auth_tokens_token_hash" UNIQUE ("token_hash"),
        CONSTRAINT "CHK_zevooria_auth_tokens_subject_type"
          CHECK ("subject_type" IN ('customer', 'admin')),
        CONSTRAINT "CHK_zevooria_auth_tokens_purpose"
          CHECK ("purpose" IN ('password_reset', 'email_verify'))
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_zevooria_auth_tokens_subject"
        ON "zevooria_auth_tokens" ("subject_type", "subject_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_zevooria_auth_tokens_expires_at"
        ON "zevooria_auth_tokens" ("expires_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "zevooria_auth_tokens"`);
    await queryRunner.query(
      `ALTER TABLE "zevooria_customers" DROP COLUMN IF EXISTS "email_verified_at"`,
    );
  }
}
