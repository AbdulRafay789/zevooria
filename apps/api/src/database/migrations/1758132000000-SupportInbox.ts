import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Support inbox Phase 1: conversations, messages, attachments,
 * and inbound S3 object idempotency tracking. No permissions/API yet.
 */
export class SupportInbox1758132000000 implements MigrationInterface {
  name = 'SupportInbox1758132000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "zevooria_support_conversation_status" AS ENUM (
          'open',
          'pending',
          'closed'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "zevooria_support_message_direction" AS ENUM (
          'inbound',
          'outbound'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "zevooria_support_inbound_object_status" AS ENUM (
          'processed',
          'failed'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "zevooria_support_conversations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "subject" varchar(998) NOT NULL,
        "status" "zevooria_support_conversation_status" NOT NULL DEFAULT 'open',
        "requester_email" varchar(320) NOT NULL,
        "requester_name" varchar(200) NULL,
        "customer_id" uuid NULL,
        "assignee_admin_id" uuid NULL,
        "last_message_at" TIMESTAMPTZ NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_zevooria_support_conversations_customer"
          FOREIGN KEY ("customer_id") REFERENCES "zevooria_customers"("id")
          ON DELETE SET NULL,
        CONSTRAINT "FK_zevooria_support_conversations_assignee"
          FOREIGN KEY ("assignee_admin_id") REFERENCES "zevooria_admin_users"("id")
          ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_zevooria_support_conversations_status"
        ON "zevooria_support_conversations" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_zevooria_support_conversations_requester_email"
        ON "zevooria_support_conversations" ("requester_email")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_zevooria_support_conversations_last_message_at"
        ON "zevooria_support_conversations" ("last_message_at")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "zevooria_support_messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "conversation_id" uuid NOT NULL,
        "direction" "zevooria_support_message_direction" NOT NULL,
        "from_email" varchar(320) NOT NULL,
        "to_email" varchar(320) NOT NULL,
        "subject" varchar(998) NULL,
        "body_text" text NOT NULL,
        "body_html" text NULL,
        "ses_message_id" varchar(255) NULL,
        "in_reply_to" varchar(998) NULL,
        "references" text NULL,
        "admin_user_id" uuid NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_zevooria_support_messages_conversation"
          FOREIGN KEY ("conversation_id")
          REFERENCES "zevooria_support_conversations"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_zevooria_support_messages_admin"
          FOREIGN KEY ("admin_user_id") REFERENCES "zevooria_admin_users"("id")
          ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_zevooria_support_messages_conversation_created"
        ON "zevooria_support_messages" ("conversation_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_zevooria_support_messages_ses_message_id"
        ON "zevooria_support_messages" ("ses_message_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "zevooria_support_attachments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "message_id" uuid NOT NULL,
        "file_name" varchar(500) NOT NULL,
        "content_type" varchar(255) NOT NULL,
        "size_bytes" integer NOT NULL,
        "storage_key" varchar(1000) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_zevooria_support_attachments_message"
          FOREIGN KEY ("message_id") REFERENCES "zevooria_support_messages"("id")
          ON DELETE CASCADE,
        CONSTRAINT "CHK_zevooria_support_attachments_size"
          CHECK ("size_bytes" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_zevooria_support_attachments_message_id"
        ON "zevooria_support_attachments" ("message_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "zevooria_support_inbound_objects" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "s3_key" varchar(1024) NOT NULL,
        "etag" varchar(128) NULL,
        "sha256" varchar(64) NULL,
        "status" "zevooria_support_inbound_object_status" NOT NULL,
        "processed_at" TIMESTAMPTZ NULL,
        "error" text NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_zevooria_support_inbound_objects_s3_key" UNIQUE ("s3_key")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "zevooria_support_attachments"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "zevooria_support_messages"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "zevooria_support_conversations"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "zevooria_support_inbound_objects"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "zevooria_support_inbound_object_status"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "zevooria_support_message_direction"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "zevooria_support_conversation_status"`,
    );
  }
}
