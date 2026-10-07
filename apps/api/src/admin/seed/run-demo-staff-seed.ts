import 'reflect-metadata';
import dataSource from '../../database/data-source';
import { hashPassword } from '../../auth/password.util';
import { isPasswordPolicyValid } from '../../common/validation/password';
import { AdminRole } from '../entities/admin-role.entity';
import { AdminUser } from '../entities/admin-user.entity';

/**
 * Idempotent demo staff accounts for local/ops QA.
 * Requires ADMIN_DEMO_STAFF_PASSWORD (meets creation policy).
 * Does not log passwords.
 */
async function run(): Promise<void> {
  const password = process.env.ADMIN_DEMO_STAFF_PASSWORD ?? '';
  if (!password || !isPasswordPolicyValid(password)) {
    throw new Error(
      'ADMIN_DEMO_STAFF_PASSWORD is required and must be at least 8 characters with at least 2 special characters.',
    );
  }

  const demos: Array<{ email: string; fullName: string; roleCode: string }> = [
    {
      email: 'staff@zevooria.local',
      fullName: 'Store Staff',
      roleCode: 'store_staff',
    },
    {
      email: 'sales@zevooria.local',
      fullName: 'Sales Desk',
      roleCode: 'sales',
    },
    {
      email: 'catalog@zevooria.local',
      fullName: 'Catalog Editor',
      roleCode: 'catalog',
    },
    {
      email: 'viewer@zevooria.local',
      fullName: 'Store Viewer',
      roleCode: 'store_user',
    },
  ];

  await dataSource.initialize();
  try {
    const userRepo = dataSource.getRepository(AdminUser);
    const roleRepo = dataSource.getRepository(AdminRole);
    const passwordHash = await hashPassword(password);

    for (const demo of demos) {
      const role = await roleRepo.findOne({ where: { code: demo.roleCode } });
      if (!role) {
        throw new Error(`Missing role ${demo.roleCode}. Run migrations first.`);
      }
      let admin = await userRepo.findOne({
        where: { email: demo.email },
        relations: { roles: true },
      });
      if (!admin) {
        admin = userRepo.create({
          email: demo.email,
          fullName: demo.fullName,
          passwordHash,
          role: 'admin',
          isActive: true,
          roles: [role],
        });
      } else {
        admin.fullName = demo.fullName;
        admin.passwordHash = passwordHash;
        admin.isActive = true;
        const hasRole = (admin.roles ?? []).some((r) => r.id === role.id);
        if (!hasRole) {
          admin.roles = [...(admin.roles ?? []), role];
        }
      }
      await userRepo.save(admin);

      console.log(`Upserted demo staff ${demo.email} (${demo.roleCode})`);
    }
  } finally {
    await dataSource.destroy();
  }
}

void run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
