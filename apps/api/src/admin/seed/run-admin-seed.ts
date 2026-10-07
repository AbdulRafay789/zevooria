import 'reflect-metadata';
import dataSource from '../../database/data-source';
import { hashPassword } from '../../auth/password.util';
import { isPasswordPolicyValid } from '../../common/validation/password';
import { AdminRole } from '../entities/admin-role.entity';
import { AdminUser } from '../entities/admin-user.entity';

/**
 * Idempotent bootstrap for the first admin account.
 * Requires ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD in env.
 * Does not log credentials.
 * Assigns the seeded `admin` RBAC role when present.
 */
async function run(): Promise<void> {
  const email = (process.env.ADMIN_SEED_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD ?? '';
  const fullName = (
    process.env.ADMIN_SEED_FULL_NAME ?? 'Zevooria Admin'
  ).trim();

  if (!email || !password) {
    throw new Error(
      'ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD are required to seed an admin.',
    );
  }
  if (!isPasswordPolicyValid(password)) {
    throw new Error(
      'ADMIN_SEED_PASSWORD must be at least 8 characters and contain at least 2 special characters.',
    );
  }

  await dataSource.initialize();
  try {
    const repo = dataSource.getRepository(AdminUser);
    const roleRepo = dataSource.getRepository(AdminRole);
    const adminRole = await roleRepo.findOne({
      where: { code: 'admin' },
      relations: { permissions: true },
    });

    const existing = await repo.findOne({
      where: { email },
      relations: { roles: true },
    });

    const admin =
      existing ??
      repo.create({
        email,
        passwordHash: '',
        fullName: fullName || 'Zevooria Admin',
        role: 'admin',
        isActive: true,
        roles: [],
      });

    admin.fullName = fullName || admin.fullName;
    admin.passwordHash = await hashPassword(password);
    admin.isActive = true;
    admin.role = admin.role || 'admin';

    if (adminRole) {
      const hasRole = (admin.roles ?? []).some(
        (role) => role.id === adminRole.id,
      );
      if (!hasRole) {
        admin.roles = [...(admin.roles ?? []), adminRole];
      }
    }

    await repo.save(admin);

    console.log(
      existing
        ? `Updated admin account for ${email}`
        : `Created admin account for ${email}`,
    );
  } finally {
    await dataSource.destroy();
  }
}

void run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
