export type AccessTokenPayload = {
  active_tenant_id?: string;
  global_roles?: string[];
  tenant_roles?: string[];
  permissions?: string[];
  exp?: number;
  token_type?: string;
};

const TOKEN_KEY = 'pda_access_token';
const SUPPORT_GRANT_KEY = 'pda_support_grant_id';

export function getStoredAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeAccessToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthState() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SUPPORT_GRANT_KEY);
}

export function readAccessToken(token: string | null): AccessTokenPayload | null {
  if (!token) return null;
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const parsed = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as
      | AccessTokenPayload
      | undefined;
    if (parsed?.exp && parsed.exp * 1000 <= Date.now()) return null;
    return parsed ?? null;
  } catch {
    return null;
  }
}

export function isUsableAccessToken(token: string | null) {
  const parsed = readAccessToken(token);
  if (!parsed) return false;
  if (parsed.token_type && parsed.token_type !== 'access') return false;
  return Boolean(parsed.active_tenant_id || parsed.global_roles?.length);
}

export function getLoginRedirectPath() {
  if (typeof window === 'undefined') return '/login';
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (window.location.pathname === '/login') return '/login';
  return `/login?next=${encodeURIComponent(currentPath)}`;
}

export function redirectToLogin() {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === '/login') return;
  clearAuthState();
  window.location.assign(getLoginRedirectPath());
}

export function redirectToLoginIfUnauthenticated(hasAccess: boolean) {
  if (hasAccess) return;
  redirectToLogin();
}

