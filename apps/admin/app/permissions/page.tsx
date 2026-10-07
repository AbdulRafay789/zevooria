'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '../../components/admin-shell';
import { RbacMatrix } from '../../components/rbac-matrix';
import {
  AdminApiError,
  fetchAdminPermissions,
  fetchAdminRoles,
  updateAdminRole,
  type AdminPermission,
  type AdminRoleView,
} from '../../lib/admin-api';
import styles from '../admin.module.css';

export default function AdminPermissionsPage() {
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [roles, setRoles] = useState<AdminRoleView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [compareRoleIds, setCompareRoleIds] = useState<string[]>([]);

  async function reload() {
    const [permRows, roleRows] = await Promise.all([
      fetchAdminPermissions(),
      fetchAdminRoles(),
    ]);
    setPermissions(permRows);
    setRoles(roleRows);
  }

  useEffect(() => {
    reload().catch((err: unknown) =>
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to load permissions.',
      ),
    );
  }, []);

  async function toggleRolePermission(role: AdminRoleView, permCode: string) {
    const has = role.permissionCodes.includes(permCode);
    const permissionCodes = has
      ? role.permissionCodes.filter((code) => code !== permCode)
      : [...role.permissionCodes, permCode].sort();
    const key = `${role.id}:${permCode}`;
    setSavingKey(key);
    setError(null);
    setRoles((prev) =>
      prev.map((row) =>
        row.id === role.id ? { ...row, permissionCodes } : row,
      ),
    );
    try {
      const updated = await updateAdminRole(role.id, { permissionCodes });
      setRoles((prev) =>
        prev.map((row) => (row.id === updated.id ? updated : row)),
      );
    } catch (err: unknown) {
      await reload().catch(() => undefined);
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to update permission assignment.',
      );
    } finally {
      setSavingKey(null);
    }
  }

  async function bulkSetRole(role: AdminRoleView, enable: boolean) {
    const permissionCodes = enable
      ? permissions.map((perm) => perm.code).sort()
      : [];
    setSavingKey(`${role.id}:bulk`);
    setError(null);
    setRoles((prev) =>
      prev.map((row) =>
        row.id === role.id ? { ...row, permissionCodes } : row,
      ),
    );
    try {
      const updated = await updateAdminRole(role.id, { permissionCodes });
      setRoles((prev) =>
        prev.map((row) => (row.id === updated.id ? updated : row)),
      );
    } catch (err: unknown) {
      await reload().catch(() => undefined);
      setError(
        err instanceof AdminApiError
          ? err.message
          : 'Unable to bulk-update role.',
      );
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <AdminShell
      title="Permissions"
      lede="Same interactive matrix as Roles — search codes, compare roles, and bulk-assign. Catalog codes remain seeded (not free-form)."
    >
      {error ? <p className={styles.error}>{error}</p> : null}
      <RbacMatrix
        roles={roles}
        permissions={permissions}
        savingKey={savingKey}
        search={search}
        onSearchChange={setSearch}
        compareRoleIds={compareRoleIds}
        onCompareRoleIdsChange={setCompareRoleIds}
        onToggle={(role, code) => {
          void toggleRolePermission(role, code);
        }}
        onBulkSetRole={(role, enable) => {
          void bulkSetRole(role, enable);
        }}
      />
    </AdminShell>
  );
}
