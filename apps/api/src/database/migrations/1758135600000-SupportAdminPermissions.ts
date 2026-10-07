import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Support inbox Phase 3: admin API permissions.
 * Granted to admin + store_admin by default.
 */
export class SupportAdminPermissions1758135600000 implements MigrationInterface {
  name = 'SupportAdminPermissions1758135600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "zevooria_admin_permissions" ("code", "name")
       VALUES ('support:read', 'View support inbox conversations'),
              ('support:update', 'Update support conversation status and assignment')
       ON CONFLICT ("code") DO NOTHING`,
    );
    await queryRunner.query(`
      INSERT INTO "zevooria_admin_role_permissions" ("role_id", "permission_id")
      SELECT r.id, p.id
      FROM "zevooria_admin_roles" r
      CROSS JOIN "zevooria_admin_permissions" p
      WHERE r.code IN ('admin', 'store_admin')
        AND p.code IN ('support:read', 'support:update')
        AND NOT EXISTS (
          SELECT 1 FROM "zevooria_admin_role_permissions" rp
          WHERE rp.role_id = r.id AND rp.permission_id = p.id
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "zevooria_admin_role_permissions" rp
      USING "zevooria_admin_permissions" p
      WHERE rp.permission_id = p.id
        AND p.code IN ('support:read', 'support:update')
    `);
    await queryRunner.query(`
      DELETE FROM "zevooria_admin_permissions"
      WHERE code IN ('support:read', 'support:update')
    `);
  }
}
