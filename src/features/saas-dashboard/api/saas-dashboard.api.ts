import { apiClient } from "@/lib/api/api-client";

export interface SaasMetrics {
  total_arr: number;
  active_tenants: number;
  platform_uptime: number;
  net_expansion: number;
  revenue_trend: { month: string; revenue: number; users: number }[];
  plan_distribution: { name: string; value: number; color: string }[];
  recent_activities: { id: string; action: string; tenant: string; timestamp: string; status: string }[];
  top_tenants: { id: number; name: string; code: string; revenue: number; growth: number }[];
}

export interface TenantListResponse {
  total_count: number;
  page: number;
  page_size: number;
  tenants: any[];
}

/**
 * SaaS Dashboard API
 * 
 * Handles platform-wide metrics, tenant analytics, and system health.
 * Most endpoints wrap data in a { success: boolean, data: T } structure.
 */
/**
 * The liveness endpoint is mounted at the server ROOT (``/health``), not under
 * ``/api/v1``. Strip the API prefix from the configured base URL so the health
 * probe targets the right path instead of 404-ing on ``/api/v1/health``.
 */
function rootBaseUrl(): string | undefined {
  const base = apiClient.defaults.baseURL || "";
  const stripped = base.replace(/\/api(\/v\d+)?\/?$/, "");
  return stripped || undefined;
}

export const saasDashboardApi = {
  getHealth: () =>
    apiClient
      .get<any>("/health", { baseURL: rootBaseUrl() })
      .then((res) => res.data?.data || res.data),

  getMetrics: () =>
    apiClient.get<any>("/saas/dashboard/metrics").then((res) => (res.data?.data ?? res.data) as SaasMetrics),

  getOverview: () =>
    apiClient.get<any>("/saas/dashboard/overview").then((res) => res.data.data || res.data),

  getTenants: (page = 1, pageSize = 10) =>
    apiClient.get<any>(`/tenants?page=${page}&page_size=${pageSize}`).then((res) => (res.data?.data ?? res.data) as TenantListResponse),

  getSubscriptions: () =>
    apiClient.get<any>("/saas/dashboard/subscriptions").then((res) => res.data.data || res.data),

  getUsage: () =>
    apiClient.get<any>("/saas/dashboard/usage").then((res) => res.data.data || res.data),
};
