import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Staff RBAC: roles, permissions, joins.
 * Seeds an `admin` role with full ops permissions and attaches existing admins.
 */
export class AdminRbac1758067200000 implements MigrationInterface {
  name = 'AdminRbac1758067200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "zevooria_admin_roles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(64) NOT NULL,
        "name" varchar(120) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_zevooria_admin_roles_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "zevooria_admin_permissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(64) NOT NULL,
        "name" varchar(120) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_zevooria_admin_permissions_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "zevooria_admin_role_permissions" (
        "role_id" uuid NOT NULL,
        "permission_id" uuid NOT NULL,
        CONSTRAINT "PK_zevooria_admin_role_permissions"
          PRIMARY KEY ("role_id", "permission_id"),
        CONSTRAINT "FK_zevooria_admin_role_permissions_role"
          FOREIGN KEY ("role_id") REFERENCES "zevooria_admin_roles"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_zevooria_admin_role_permissions_permission"
          FOREIGN KEY ("permission_id") REFERENCES "zevooria_admin_permissions"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "zevooria_admin_user_roles" (
        "admin_user_id" uuid NOT NULL,
        "role_id" uuid NOT NULL,
        CONSTRAINT "PK_zevooria_admin_user_roles"
          PRIMARY KEY ("admin_user_id", "role_id"),
        CONSTRAINT "FK_zevooria_admin_user_roles_user"
          FOREIGN KEY ("admin_user_id") REFERENCES "zevooria_admin_users"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_zevooria_admin_user_roles_role"
          FOREIGN KEY ("role_id") REFERENCES "zevooria_admin_roles"("id")
          ON DELETE CASCADE
      )
    `);

    const permissions: Array<[string, string]> = [
      ['dashboard:read', 'View dashboard'],
      ['orders:read', 'View orders'],
      ['orders:update', 'Update orders'],
      ['customers:read', 'View customers'],
      ['products:read', 'View products'],
      ['products:update', 'Update products'],
      ['admins:manage', 'Manage admin users and roles'],
    ];

    for (const [code, name] of permissions) {
      await queryRunner.query(
        `INSERT INTO "zevooria_admin_permissions" ("code", "name") VALUES ($1, $2)`,
        [code, name],
      );
    }

    await queryRunner.query(
      `INSERT INTO "zevooria_admin_roles" ("code", "name") VALUES ('admin', 'Administrator')`,
    );

    await queryRunner.query(`
      INSERT INTO "zevooria_admin_role_permissions" ("role_id", "permission_id")
      SELECT r.id, p.id
      FROM "zevooria_admin_roles" r
      CROSS JOIN "zevooria_admin_permissions" p
      WHERE r.code = 'admin'
    `);

    await queryRunner.query(`
      INSERT INTO "zevooria_admin_user_roles" ("admin_user_id", "role_id")
      SELECT u.id, r.id
      FROM "zevooria_admin_users" u
      CROSS JOIN "zevooria_admin_roles" r
      WHERE r.code = 'admin'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "zevooria_admin_user_roles"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "zevooria_admin_role_permissions"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "zevooria_admin_permissions"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "zevooria_admin_roles"`);
  }
}
