import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Audit trail for admin/auth-sensitive events + audit:read permission.
 */
export class AuditLogs1758074400000 implements MigrationInterface {
  name = 'AuditLogs1758074400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "zevooria_audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "actor_type" varchar(20) NOT NULL,
        "actor_id" uuid NULL,
        "action" varchar(80) NOT NULL,
        "resource_type" varchar(80) NULL,
        "resource_id" uuid NULL,
        "metadata" jsonb NULL,
        "ip_address" varchar(64) NULL,
        "user_agent" varchar(512) NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_zevooria_audit_logs_actor_type"
          CHECK ("actor_type" IN ('customer', 'admin', 'system'))
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_zevooria_audit_logs_created_at"
        ON "zevooria_audit_logs" ("created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_zevooria_audit_logs_actor_id"
        ON "zevooria_audit_logs" ("actor_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_zevooria_audit_logs_action"
        ON "zevooria_audit_logs" ("action")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_zevooria_audit_logs_resource_id"
        ON "zevooria_audit_logs" ("resource_id")`,
    );

    await queryRunner.query(
      `INSERT INTO "zevooria_admin_permissions" ("code", "name")
       VALUES ('audit:read', 'View audit logs')
       ON CONFLICT ("code") DO NOTHING`,
    );

    await queryRunner.query(`
      INSERT INTO "zevooria_admin_role_permissions" ("role_id", "permission_id")
      SELECT r.id, p.id
      FROM "zevooria_admin_roles" r
      CROSS JOIN "zevooria_admin_permissions" p
      WHERE r.code = 'admin' AND p.code = 'audit:read'
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "zevooria_admin_role_permissions" rp
      USING "zevooria_admin_permissions" p
      WHERE rp.permission_id = p.id AND p.code = 'audit:read'
    `);
    await queryRunner.query(
      `DELETE FROM "zevooria_admin_permissions" WHERE "code" = 'audit:read'`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "zevooria_audit_logs"`);
  }
}
