import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5: distinguish SES API MessageId from RFC Message-ID.
 *
 * Existing column `ses_message_id` continues to store the normalized RFC
 * Message-ID used for inbound/outbound email threading (Phase 2 meaning).
 * New nullable `aws_ses_message_id` stores the SES Send* API MessageId for
 * outbound delivery tracking only.
 */
export class SupportOutboundAwsSesMessageId1758139200000 implements MigrationInterface {
  name = 'SupportOutboundAwsSesMessageId1758139200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "zevooria_support_messages"
      ADD COLUMN IF NOT EXISTS "aws_ses_message_id" varchar(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "zevooria_support_messages"
      DROP COLUMN IF EXISTS "aws_ses_message_id"
    `);
  }
}
