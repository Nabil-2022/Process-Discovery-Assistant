const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export type DashboardSummary = {
  total_clients: number;
  active_clients: number;
  suspended_clients: number;
  active_campaigns: number;
  processes: number;
  active_users: number;
  subscriptions: number;
  global_completeness_rate: number;
  alerts: number;
};

export type TenantListItem = {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  users: number;
  directions: number;
  processes: number;
  created_at: string;
  last_activity_at: string;
  subscription: { plan: string; status: string } | null;
};

export type TenantListResponse = {
  page: number;
  page_size: number;
  total: number;
  items: TenantListItem[];
};

export type AttentionTenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
  subscription_status: string | null;
  processes: number;
  users: number;
};

export type CampaignOverview = {
  id: string;
  name: string;
  tenant_name: string;
  status: string;
  processes: number;
  directions: number;
};

export type ActivityItem = {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  result: string;
  created_at: string;
};

export type SupportAccessGrant = {
  id: string;
  tenantId: string;
  supportUserId: string;
  status: string;
  effective_status: string;
  reason: string;
  expiresAt: string;
  tenant?: { name: string; slug: string };
};

export type FeatureItem = {
  code: string;
  name: string;
  description?: string | null;
  enabled?: boolean;
};

export type TenantFilters = {
  search?: string;
  status?: string;
  page?: number;
};

function authHeaders() {
  const token = localStorage.getItem('pda_access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  for (const [key, value] of Object.entries(authHeaders())) {
    headers.set(key, value);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const adminApi = {
  summary: () => request<DashboardSummary>('/admin/dashboard/summary'),
  attentionTenants: () => request<AttentionTenant[]>('/admin/dashboard/tenants-attention'),
  campaigns: () => request<CampaignOverview[]>('/admin/dashboard/campaigns-overview'),
  recentActivity: () => request<ActivityItem[]>('/admin/dashboard/recent-activity'),
  tenants: (filters: TenantFilters) => {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.status) params.set('status', filters.status);
    if (filters.page) params.set('page', String(filters.page));
    return request<TenantListResponse>(`/admin/tenants?${params}`);
  },
  createTenant: (payload: Record<string, unknown>) =>
    request('/admin/tenants', { method: 'POST', body: JSON.stringify(payload) }),
  suspendTenant: (id: string, reason: string) =>
    request(`/admin/tenants/${id}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  reactivateTenant: (id: string) =>
    request(`/admin/tenants/${id}/reactivate`, { method: 'POST', body: JSON.stringify({}) }),
  applyTemplate: (id: string) =>
    request(`/admin/tenants/${id}/apply-template`, {
      method: 'POST',
      body: JSON.stringify({ dry_run: false }),
    }),
  createInitialAdmin: (id: string, payload: Record<string, unknown>) =>
    request(`/admin/tenants/${id}/initial-admin`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  features: () => request<FeatureItem[]>('/admin/features'),
  tenantFeatures: (id: string) => request<FeatureItem[]>(`/admin/tenants/${id}/features`),
  updateTenantFeatures: (id: string, features: { code: string; enabled: boolean }[]) =>
    request(`/admin/tenants/${id}/features`, {
      method: 'PUT',
      body: JSON.stringify({ features }),
    }),
  updateSubscription: (id: string, payload: Record<string, unknown>) =>
    request(`/admin/tenants/${id}/subscription`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  supportAccessGrants: () => request<SupportAccessGrant[]>('/admin/support-access-grants'),
  createSupportAccessGrant: (payload: Record<string, unknown>) =>
    request('/admin/support-access-grants', { method: 'POST', body: JSON.stringify(payload) }),
  revokeSupportAccessGrant: (id: string, reason: string) =>
    request(`/admin/support-access-grants/${id}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  auditLogs: () => request<ActivityItem[]>('/admin/audit-logs?limit=20'),
};

export function hasSuperAdminAccess() {
  const token = localStorage.getItem('pda_access_token');
  if (!token) {
    return false;
  }
  try {
    const [, payload] = token.split('.');
    if (!payload) return false;
    const parsed = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      global_roles?: string[];
    };
    return parsed.global_roles?.includes('super_admin') ?? false;
  } catch {
    return false;
  }
}
