/**
 * Admin user type for React state.
 * Session token lives in an httpOnly cookie via the `/backend` BFF — never localStorage.
 */

export type AdminUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  permissions?: string[];
};

/** Clear any legacy localStorage keys from older builds. */
export function clearLegacyAdminAuthStorage(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem('zevooria_admin_token');
  window.localStorage.removeItem('zevooria_admin_user');
}
