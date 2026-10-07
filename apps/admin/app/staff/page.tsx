'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AdminShell } from '../../components/admin-shell';
import {
  AdminPagination,
  useClientPagination,
} from '../../components/admin-pagination';
import {
  AdminApiError,
  createAdminStaff,
  fetchAdminRoles,
  fetchAdminStaff,
  updateAdminStaff,
  type AdminRoleView,
  type AdminStaffView,
} from '../../lib/admin-api';
import styles from '../admin.module.css';

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<AdminStaffView[]>([]);
  const [roles, setRoles] = useState<AdminRoleView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const pager = useClientPagination(staff, 20);

  async function reload() {
    const [staffRows, roleRows] = await Promise.all([
      fetchAdminStaff(),
      fetchAdminRoles(),
    ]);
    setStaff(staffRows);
    setRoles(roleRows);
  }

  useEffect(() => {
    let cancelled = false;
    reload()
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof AdminApiError
              ? err.message
              : 'Unable to load staff.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) {
      return;
    }
    setError(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    const fullName = String(form.get('fullName') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const roleId = String(form.get('roleId') ?? '');
    setPending(true);
    try {
      await createAdminStaff({
        email,
        fullName,
        password,
        roleIds: roleId ? [roleId] : [],
      });
      event.currentTarget.reset();
      await reload();
    } catch (err: unknown) {
      setError(
        err instanceof AdminApiError ? err.message : 'Unable to create staff.',
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <AdminShell
      title="Staff"
      lede="Create staff accounts and assign roles. Passwords must meet creation policy."
    >
      {error ? <p className={styles.error}>{error}</p> : null}

      <form className={styles.form} onSubmit={onCreate}>
        <label className={styles.field}>
          <span>Email</span>
          <input name="email" type="email" required />
        </label>
        <label className={styles.field}>
          <span>Full name</span>
          <input name="fullName" required />
        </label>
        <label className={styles.field}>
          <span>Password</span>
          <input name="password" type="password" required />
        </label>
        <label className={styles.field}>
          <span>Role</span>
          <select name="roleId" defaultValue="">
            <option value="">No role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name} ({role.code})
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={styles.primaryBtn} disabled={pending}>
          {pending ? 'Creating…' : 'Add staff'}
        </button>
      </form>

      <ul className={styles.list}>
        {pager.pageItems.map((member) => (
          <li key={member.id} className={styles.productRow}>
            <div>
              <p className={styles.orderNumber}>{member.fullName}</p>
              <p className={styles.meta}>
                {member.email} · {member.isActive ? 'active' : 'inactive'} ·{' '}
                {member.roles.map((r) => r.code).join(', ') || 'no roles'}
              </p>
            </div>
            <div className={styles.inlineForm}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => {
                  void updateAdminStaff(member.id, {
                    isActive: !member.isActive,
                  })
                    .then(reload)
                    .catch((err: unknown) =>
                      setError(
                        err instanceof AdminApiError
                          ? err.message
                          : 'Unable to update staff.',
                      ),
                    );
                }}
              >
                {member.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <AdminPagination
        page={pager.page}
        totalPages={pager.totalPages}
        total={pager.total}
        pageSize={pager.pageSize}
        onPageChange={pager.setPage}
      />
    </AdminShell>
  );
}
