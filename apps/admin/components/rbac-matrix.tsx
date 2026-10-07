'use client';

import styles from './rbac-matrix.module.css';
import type { AdminPermission, AdminRoleView } from '../lib/admin-api';

export type RbacMatrixProps = {
  roles: AdminRoleView[];
  permissions: AdminPermission[];
  savingKey: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  compareRoleIds: string[];
  onCompareRoleIdsChange: (ids: string[]) => void;
  onToggle: (role: AdminRoleView, permissionCode: string) => void;
  onBulkSetRole: (role: AdminRoleView, enable: boolean) => void;
};

function matchesSearch(
  haystack: string,
  query: string,
): boolean {
  if (!query.trim()) {
    return true;
  }
  return haystack.toLowerCase().includes(query.trim().toLowerCase());
}

export function RbacMatrix({
  roles,
  permissions,
  savingKey,
  search,
  onSearchChange,
  compareRoleIds,
  onCompareRoleIdsChange,
  onToggle,
  onBulkSetRole,
}: RbacMatrixProps) {
  const filteredPermissions = permissions.filter((perm) =>
    matchesSearch(`${perm.code} ${perm.name}`, search),
  );

  const visibleRoles =
    compareRoleIds.length > 0
      ? roles.filter((role) => compareRoleIds.includes(role.id))
      : roles;

  const diffOnly =
    compareRoleIds.length >= 2
      ? filteredPermissions.filter((perm) => {
          const flags = visibleRoles.map((role) =>
            role.permissionCodes.includes(perm.code),
          );
          return flags.some((on) => on) && flags.some((on) => !on);
        })
      : filteredPermissions;

  function toggleCompare(roleId: string) {
    if (compareRoleIds.includes(roleId)) {
      onCompareRoleIdsChange(compareRoleIds.filter((id) => id !== roleId));
      return;
    }
    onCompareRoleIdsChange([...compareRoleIds, roleId]);
  }

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <label className={styles.searchField}>
          <span>Search permissions</span>
          <input
            type="search"
            value={search}
            placeholder="orders:read, dashboard…"
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
        <p className={styles.hint}>
          {compareRoleIds.length >= 2
            ? `Comparing ${compareRoleIds.length} roles — showing differing permissions only.`
            : 'Select 2+ roles below to compare differences. Cell toggles save immediately.'}
        </p>
      </div>

      <div className={styles.compareBar}>
        <span className={styles.compareLabel}>Compare roles</span>
        <div className={styles.compareChips}>
          {roles.map((role) => {
            const active = compareRoleIds.includes(role.id);
            return (
              <button
                key={role.id}
                type="button"
                className={active ? styles.compareChipOn : styles.compareChip}
                aria-pressed={active}
                onClick={() => toggleCompare(role.id)}
              >
                {role.name}
              </button>
            );
          })}
          {compareRoleIds.length > 0 ? (
            <button
              type="button"
              className={styles.clearCompare}
              onClick={() => onCompareRoleIdsChange([])}
            >
              Clear compare
            </button>
          ) : null}
        </div>
      </div>

      {visibleRoles.length === 0 ? (
        <p className={styles.empty}>No roles to display.</p>
      ) : (
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col" className={styles.permCol}>
                  Permission
                </th>
                {visibleRoles.map((role) => (
                  <th key={role.id} scope="col" className={styles.roleCol}>
                    <div className={styles.roleHead}>
                      <strong>{role.name}</strong>
                      <span>{role.code}</span>
                      <span className={styles.bulkRow}>
                        <button
                          type="button"
                          className={styles.bulkBtn}
                          onClick={() => onBulkSetRole(role, true)}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          className={styles.bulkBtn}
                          onClick={() => onBulkSetRole(role, false)}
                        >
                          None
                        </button>
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {diffOnly.map((perm) => (
                <tr key={perm.id}>
                  <th scope="row" className={styles.permCell}>
                    <strong>{perm.code}</strong>
                    <span>{perm.name}</span>
                  </th>
                  {visibleRoles.map((role) => {
                    const on = role.permissionCodes.includes(perm.code);
                    const busy = savingKey === `${role.id}:${perm.code}`;
                    const differs =
                      compareRoleIds.length >= 2 &&
                      visibleRoles.some(
                        (other) =>
                          other.permissionCodes.includes(perm.code) !== on,
                      );
                    return (
                      <td
                        key={role.id}
                        className={
                          differs ? styles.cellDiff : styles.cell
                        }
                      >
                        <label className={styles.switchLabel}>
                          <span className={styles.srOnly}>
                            {role.name} — {perm.code}
                          </span>
                          <input
                            className={styles.switch}
                            type="checkbox"
                            role="switch"
                            checked={on}
                            disabled={busy}
                            onChange={() => onToggle(role, perm.code)}
                          />
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {diffOnly.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleRoles.length + 1}
                    className={styles.emptyCell}
                  >
                    {compareRoleIds.length >= 2
                      ? 'Selected roles have identical permissions for this filter.'
                      : 'No permissions match this search.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
