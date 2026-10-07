/**
 * In-memory auth types for the storefront.
 * Session tokens live in httpOnly cookies set by the `/backend` BFF — never localStorage.
 */

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  emailVerifiedAt?: string | null;
};

/** Client-visible session payload after the BFF strips tokens. */
export type AuthSessionPayload = {
  expiresAt: string;
  expiresIn?: number;
  user: AuthUser;
};

/** Clear any legacy localStorage keys from older builds. */
export function clearLegacyAuthStorage(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem('zevooria_auth_token');
  window.localStorage.removeItem('zevooria_auth_refresh');
  window.localStorage.removeItem('zevooria_auth_expires_at');
  window.localStorage.removeItem('zevooria_auth_user');
}
