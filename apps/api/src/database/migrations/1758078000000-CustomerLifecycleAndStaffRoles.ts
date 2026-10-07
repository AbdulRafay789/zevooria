import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Customer soft lifecycle + expanded staff roles/permissions.
 */
export class CustomerLifecycleAndStaffRoles1758078000000 implements MigrationInterface {
  name = 'CustomerLifecycleAndStaffRoles1758078000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "zevooria_customers"
      ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "zevooria_customers"
      ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ NULL
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_zevooria_customers_is_active"
        ON "zevooria_customers" ("is_active")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_zevooria_customers_deleted_at"
        ON "zevooria_customers" ("deleted_at")`,
    );

    const newPermissions: Array<[string, string]> = [
      ['customers:update', 'Update customer status'],
      ['customers:delete', 'Soft-delete customers'],
    ];
    for (const [code, name] of newPermissions) {
      await queryRunner.query(
        `INSERT INTO "zevooria_admin_permissions" ("code", "name")
         VALUES ($1, $2) ON CONFLICT ("code") DO NOTHING`,
        [code, name],
      );
    }

    // Ensure legacy admin role keeps every permission (including new ones).
    await queryRunner.query(`
      INSERT INTO "zevooria_admin_role_permissions" ("role_id", "permission_id")
      SELECT r.id, p.id
      FROM "zevooria_admin_roles" r
      CROSS JOIN "zevooria_admin_permissions" p
      WHERE r.code = 'admin'
      ON CONFLICT DO NOTHING
    `);

    const roles: Array<{
      code: string;
      name: string;
      permissions: string[];
    }> = [
      {
        code: 'store_admin',
        name: 'Store Admin',
        permissions: ['*'],
      },
      {
        code: 'store_staff',
        name: 'Store Staff',
        permissions: [
          'dashboard:read',
          'orders:read',
          'orders:update',
          'customers:read',
          'customers:update',
          'products:read',
        ],
      },
      {
        code: 'sales',
        name: 'Sales',
        permissions: [
          'dashboard:read',
          'orders:read',
          'orders:update',
          'customers:read',
        ],
      },
      {
        code: 'catalog',
        name: 'Catalog',
        permissions: ['dashboard:read', 'products:read', 'products:update'],
      },
      {
        code: 'store_user',
        name: 'Store User',
        permissions: [
          'dashboard:read',
          'orders:read',
          'customers:read',
          'products:read',
        ],
      },
    ];

    for (const role of roles) {
      await queryRunner.query(
        `INSERT INTO "zevooria_admin_roles" ("code", "name")
         VALUES ($1, $2) ON CONFLICT ("code") DO NOTHING`,
        [role.code, role.name],
      );
      if (role.permissions.includes('*')) {
        await queryRunner.query(
          `
          INSERT INTO "zevooria_admin_role_permissions" ("role_id", "permission_id")
          SELECT r.id, p.id
          FROM "zevooria_admin_roles" r
          CROSS JOIN "zevooria_admin_permissions" p
          WHERE r.code = $1
          ON CONFLICT DO NOTHING
        `,
          [role.code],
        );
      } else {
        for (const perm of role.permissions) {
          await queryRunner.query(
            `
            INSERT INTO "zevooria_admin_role_permissions" ("role_id", "permission_id")
            SELECT r.id, p.id
            FROM "zevooria_admin_roles" r
            CROSS JOIN "zevooria_admin_permissions" p
            WHERE r.code = $1 AND p.code = $2
            ON CONFLICT DO NOTHING
          `,
            [role.code, perm],
          );
        }
      }
    }

    // Attach store_admin to existing staff who only have legacy admin role.
    await queryRunner.query(`
      INSERT INTO "zevooria_admin_user_roles" ("admin_user_id", "role_id")
      SELECT u.id, r.id
      FROM "zevooria_admin_users" u
      CROSS JOIN "zevooria_admin_roles" r
      WHERE r.code = 'store_admin'
        AND NOT EXISTS (
          SELECT 1 FROM "zevooria_admin_user_roles" ur
          WHERE ur.admin_user_id = u.id AND ur.role_id = r.id
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const roleCodes = [
      'store_admin',
      'store_staff',
      'sales',
      'catalog',
      'store_user',
    ];
    for (const code of roleCodes) {
      await queryRunner.query(
        `
        DELETE FROM "zevooria_admin_user_roles" ur
        USING "zevooria_admin_roles" r
        WHERE ur.role_id = r.id AND r.code = $1
      `,
        [code],
      );
      await queryRunner.query(
        `
        DELETE FROM "zevooria_admin_role_permissions" rp
        USING "zevooria_admin_roles" r
        WHERE rp.role_id = r.id AND r.code = $1
      `,
        [code],
      );
      await queryRunner.query(
        `DELETE FROM "zevooria_admin_roles" WHERE "code" = $1`,
        [code],
      );
    }

    for (const code of ['customers:update', 'customers:delete']) {
      await queryRunner.query(
        `
        DELETE FROM "zevooria_admin_role_permissions" rp
        USING "zevooria_admin_permissions" p
        WHERE rp.permission_id = p.id AND p.code = $1
      `,
        [code],
      );
      await queryRunner.query(
        `DELETE FROM "zevooria_admin_permissions" WHERE "code" = $1`,
        [code],
      );
    }

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_zevooria_customers_deleted_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_zevooria_customers_is_active"`,
    );
    await queryRunner.query(
      `ALTER TABLE "zevooria_customers" DROP COLUMN IF EXISTS "deleted_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "zevooria_customers" DROP COLUMN IF EXISTS "is_active"`,
    );
  }
}
