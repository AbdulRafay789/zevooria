import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dedicated notifications:read permission so order viewers are not
 * automatically shown the alerts bell / notifications screen.
 * Granted to admin + store_admin by default.
 */
export class NotificationsReadPermission1758128400000 implements MigrationInterface {
  name = 'NotificationsReadPermission1758128400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "zevooria_admin_permissions" ("code", "name")
       VALUES ('notifications:read', 'View admin notifications and alerts')
       ON CONFLICT ("code") DO NOTHING`,
    );
    await queryRunner.query(`
      INSERT INTO "zevooria_admin_role_permissions" ("role_id", "permission_id")
      SELECT r.id, p.id
      FROM "zevooria_admin_roles" r
      CROSS JOIN "zevooria_admin_permissions" p
      WHERE r.code IN ('admin', 'store_admin')
        AND p.code = 'notifications:read'
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
      WHERE rp.permission_id = p.id AND p.code = 'notifications:read'
    `);
    await queryRunner.query(
      `DELETE FROM "zevooria_admin_permissions" WHERE "code" = 'notifications:read'`,
    );
  }
}
