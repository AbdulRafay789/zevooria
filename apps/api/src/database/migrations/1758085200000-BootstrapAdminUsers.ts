import { MigrationInterface, QueryRunner } from 'typeorm';
import { hashPassword } from '../../auth/password.util';
import { isPasswordPolicyValid } from '../../common/validation/password';

type BootstrapAdmin = {
  email: string;
  fullName: string;
  roleCode: string;
  password: string;
};

/**
 * Idempotent bootstrap of ops + demo staff admin users.
 *
 * Passwords come from env (preferred) with documented bootstrap defaults for
 * first deploy. Hashes only are stored. Rotate these credentials after launch.
 *
 * Env overrides:
 * - ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD / ADMIN_SEED_FULL_NAME (ops account)
 * - ADMIN_DEMO_STAFF_PASSWORD (staff/sales/catalog/viewer)
 */
export class BootstrapAdminUsers1758085200000 implements MigrationInterface {
  name = 'BootstrapAdminUsers1758085200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const opsEmail = (process.env.ADMIN_SEED_EMAIL ?? 'ops@yourdomain.com')
      .trim()
      .toLowerCase();
    const opsPassword = process.env.ADMIN_SEED_PASSWORD ?? 'YourPass!@12';
    const opsName = (process.env.ADMIN_SEED_FULL_NAME ?? 'Zevooria Ops').trim();
    const demoPassword = process.env.ADMIN_DEMO_STAFF_PASSWORD ?? 'DemoStaff!!';

    for (const [label, password] of [
      ['ADMIN_SEED_PASSWORD / ops bootstrap', opsPassword],
      ['ADMIN_DEMO_STAFF_PASSWORD / demo bootstrap', demoPassword],
    ] as const) {
      if (!isPasswordPolicyValid(password)) {
        throw new Error(
          `${label} must be at least 8 characters with at least 2 special characters.`,
        );
      }
    }

    const accounts: BootstrapAdmin[] = [
      {
        email: opsEmail,
        fullName: opsName || 'Zevooria Ops',
        roleCode: 'admin',
        password: opsPassword,
      },
      {
        email: 'staff@zevooria.local',
        fullName: 'Store Staff',
        roleCode: 'store_staff',
        password: demoPassword,
      },
      {
        email: 'sales@zevooria.local',
        fullName: 'Sales Desk',
        roleCode: 'sales',
        password: demoPassword,
      },
      {
        email: 'catalog@zevooria.local',
        fullName: 'Catalog Editor',
        roleCode: 'catalog',
        password: demoPassword,
      },
      {
        email: 'viewer@zevooria.local',
        fullName: 'Store Viewer',
        roleCode: 'store_user',
        password: demoPassword,
      },
    ];

    for (const account of accounts) {
      const passwordHash = await hashPassword(account.password);
      const roleRows = (await queryRunner.query(
        `SELECT "id" FROM "zevooria_admin_roles" WHERE "code" = $1 LIMIT 1`,
        [account.roleCode],
      )) as Array<{ id: string }>;
      if (!roleRows[0]?.id) {
        throw new Error(
          `Missing role ${account.roleCode}. Run prior RBAC migrations first.`,
        );
      }
      const roleId = roleRows[0].id;

      const existing = (await queryRunner.query(
        `SELECT "id" FROM "zevooria_admin_users" WHERE "email" = $1 LIMIT 1`,
        [account.email],
      )) as Array<{ id: string }>;

      let userId: string;
      if (existing[0]?.id) {
        userId = existing[0].id;
        await queryRunner.query(
          `
          UPDATE "zevooria_admin_users"
          SET "password_hash" = $2,
              "full_name" = $3,
              "is_active" = true,
              "updated_at" = now()
          WHERE "id" = $1
        `,
          [userId, passwordHash, account.fullName],
        );
      } else {
        const inserted = (await queryRunner.query(
          `
          INSERT INTO "zevooria_admin_users"
            ("email", "password_hash", "full_name", "role", "is_active")
          VALUES ($1, $2, $3, 'admin', true)
          RETURNING "id"
        `,
          [account.email, passwordHash, account.fullName],
        )) as Array<{ id: string }>;
        userId = inserted[0].id;
      }

      await queryRunner.query(
        `
        INSERT INTO "zevooria_admin_user_roles" ("admin_user_id", "role_id")
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `,
        [userId, roleId],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const emails = [
      (process.env.ADMIN_SEED_EMAIL ?? 'ops@yourdomain.com')
        .trim()
        .toLowerCase(),
      'staff@zevooria.local',
      'sales@zevooria.local',
      'catalog@zevooria.local',
      'viewer@zevooria.local',
    ];
    await queryRunner.query(
      `
      DELETE FROM "zevooria_admin_user_roles" ur
      USING "zevooria_admin_users" u
      WHERE ur.admin_user_id = u.id
        AND u.email = ANY($1::varchar[])
    `,
      [emails],
    );
    await queryRunner.query(
      `DELETE FROM "zevooria_admin_users" WHERE "email" = ANY($1::varchar[])`,
      [emails],
    );
  }
}
