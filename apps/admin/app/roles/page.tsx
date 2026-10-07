'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AdminShell } from '../../components/admin-shell';
import { RbacMatrix } from '../../components/rbac-matrix';
import {
  AdminApiError,
  createAdminRole,
  fetchAdminPermissions,
  fetchAdminRoles,
  updateAdminRole,
  type AdminPermission,
  type AdminRoleView,
} from '../../lib/admin-api';
import styles from '../admin.module.css';

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<AdminRoleView[]>([]);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [compareRoleIds, setCompareRoleIds] = useState<string[]>([]);
  const [createFilter, setCreateFilter] = useState('');

  async function reload() {
    const [roleRows, permRows] = await Promise.all([
      fetchAdminRoles(),
      fetchAdminPermissions(),
    ]);
    setRoles(roleRows);
    setPermissions(permRows);
  }

  useEffect(() => {
    reload().catch((err: unknown) =>
      setError(
        err instanceof AdminApiError ? err.message : 'Unable to load roles.',
      ),
    );
  }, []);

  const createPermissions = useMemo(() => {
    const q = createFilter.trim().toLowerCase();
    if (!q) {
      return permissions;
    }
    return permissions.filter((perm) =>
      `${perm.code} ${perm.name}`.toLowerCase().includes(q),
    );
  }, [permissions, createFilter]);

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const code = String(form.get('code') ?? '')
      .trim()
      .toLowerCase();
    const name = String(form.get('name') ?? '').trim();
    const permissionCodes = Object.entries(selected)
      .filter(([, on]) => on)
      .map(([codeKey]) => codeKey);
    setPending(true);
    try {
      await createAdminRole({ code, name, permissionCodes });
      event.currentTarget.reset();
      setSelected({});
      setCreateFilter('');
      await reload();
    } catch (err: unknown) {
      setError(
        err instanceof AdminApiError ? err.message : 'Unable to create role.',
      );
    } finally {
      setPending(false);
    }
  };

  async function togglePermission(role: AdminRoleView, permCode: string) {
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
          : 'Unable to update role permissions.',
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
      title="Roles"
      lede="Interactive permission matrix with search, bulk assign, and role compare. Changes save immediately."
    >
      {error ? <p className={styles.error}>{error}</p> : null}

      <form className={styles.formWide} onSubmit={onCreate}>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Code</span>
            <input name="code" placeholder="ops_lead" required />
          </label>
          <label className={styles.field}>
            <span>Name</span>
            <input name="name" placeholder="Ops Lead" required />
          </label>
        </div>
        <div className={styles.field}>
          <span>Starting permissions</span>
          <input
            type="search"
            value={createFilter}
            placeholder="Filter permission list…"
            onChange={(event) => setCreateFilter(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                // Filter-only field inside the create-role form — don't submit.
                event.preventDefault();
              }
            }}
          />
        </div>
        <div className={styles.toggleStack} role="group" aria-label="Starting permissions">
          {createPermissions.map((perm) => (
            <label key={perm.id} className={styles.toggleRow}>
              <span className={styles.toggleCopy}>
                <strong>{perm.code}</strong>
                <em>{perm.name}</em>
              </span>
              <input
                className={styles.toggleInput}
                type="checkbox"
                role="switch"
                checked={Boolean(selected[perm.code])}
                onChange={(event) =>
                  setSelected((prev) => ({
                    ...prev,
                    [perm.code]: event.target.checked,
                  }))
                }
              />
            </label>
          ))}
          {createPermissions.length === 0 ? (
            <p className={styles.meta}>No permissions match this filter.</p>
          ) : null}
        </div>
        <div className={styles.inlineForm}>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => {
              const next: Record<string, boolean> = {};
              for (const perm of permissions) {
                next[perm.code] = true;
              }
              setSelected(next);
            }}
          >
            Select all
          </button>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => setSelected({})}
          >
            Clear
          </button>
          <button type="submit" className={styles.primaryBtn} disabled={pending}>
            {pending ? 'Saving…' : 'Create role'}
          </button>
        </div>
      </form>

      <RbacMatrix
        roles={roles}
        permissions={permissions}
        savingKey={savingKey}
        search={search}
        onSearchChange={setSearch}
        compareRoleIds={compareRoleIds}
        onCompareRoleIdsChange={setCompareRoleIds}
        onToggle={(role, code) => {
          void togglePermission(role, code);
        }}
        onBulkSetRole={(role, enable) => {
          void bulkSetRole(role, enable);
        }}
      />
    </AdminShell>
  );
}
