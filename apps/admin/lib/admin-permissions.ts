/**
 * Admin UI RBAC helpers.
 * Deny by default — never treat missing/empty permissions as full access.
 */

export type AdminPermissionUser = {
  permissions?: string[];
};

export function hasPermission(
  user: AdminPermissionUser | null | undefined,
  code: string,
): boolean {
  const codes = user?.permissions ?? [];
  return codes.includes(code);
}

export function hasAnyPermission(
  user: AdminPermissionUser | null | undefined,
  codes: string[],
): boolean {
  return codes.some((code) => hasPermission(user, code));
}

export type AdminNavItem = {
  href: string;
  label: string;
  /** Permission required to see this nav item and open this route. */
  permission: string;
};

/** Primary nav order. Header renders only items the user is allowed to see. */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: '/', label: 'Dashboard', permission: 'dashboard:read' },
  { href: '/reports', label: 'Reports', permission: 'dashboard:read' },
  { href: '/orders', label: 'Orders', permission: 'orders:read' },
  { href: '/returns', label: 'Returns', permission: 'returns:read' },
  { href: '/support', label: 'Support', permission: 'support:read' },
  {
    href: '/notifications',
    label: 'Notifications',
    permission: 'notifications:read',
  },
  { href: '/customers', label: 'Customers', permission: 'customers:read' },
  { href: '/products', label: 'Products', permission: 'products:read' },
  { href: '/promotions', label: 'Promotions', permission: 'promotions:read' },
  { href: '/inventory', label: 'Inventory', permission: 'inventory:read' },
  { href: '/accounting', label: 'Accounting', permission: 'accounting:read' },
  { href: '/audit', label: 'Audit', permission: 'audit:read' },
  { href: '/staff', label: 'Staff', permission: 'admins:manage' },
  { href: '/roles', label: 'Roles', permission: 'admins:manage' },
  { href: '/permissions', label: 'Permissions', permission: 'admins:manage' },
];

/** Map pathname → required permission (longest prefix wins). */
export function permissionForPath(pathname: string): string | null {
  const normalized = pathname.split('?')[0] || '/';
  if (normalized === '/login') {
    return null;
  }
  const matches = ADMIN_NAV_ITEMS.filter((item) => {
    if (item.href === '/') {
      return normalized === '/';
    }
    return (
      normalized === item.href || normalized.startsWith(`${item.href}/`)
    );
  });
  if (matches.length === 0) {
    return null;
  }
  matches.sort((a, b) => b.href.length - a.href.length);
  return matches[0]?.permission ?? null;
}

export function firstAllowedPath(
  user: AdminPermissionUser | null | undefined,
): string | null {
  for (const item of ADMIN_NAV_ITEMS) {
    if (hasPermission(user, item.permission)) {
      return item.href;
    }
  }
  return null;
}

export function visibleNavItems(
  user: AdminPermissionUser | null | undefined,
): AdminNavItem[] {
  return ADMIN_NAV_ITEMS.filter((item) =>
    hasPermission(user, item.permission),
  );
}
