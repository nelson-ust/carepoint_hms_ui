import { apiClient } from "@/lib/api/api-client";
import { HealthResponse } from "@/types/system.types";

export interface SaasMetrics {
  data: SaasMetrics;
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
  data: TenantListResponse;
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
export const saasDashboardApi = {
  getHealth: () =>
    apiClient.get<any>("/health").then((res) => res.data.data || res.data),

  getMetrics: () =>
    apiClient.get<SaasMetrics>("/saas/dashboard/metrics").then((res) => {
      console.log("SaaS Metrics Response:", res.data);
      return res.data.data || res.data;
    }),

  getOverview: () =>
    apiClient.get<any>("/saas/dashboard/overview").then((res) => res.data.data || res.data),

  getTenants: (page = 1, pageSize = 10) =>
    apiClient.get<TenantListResponse>(`/tenants?page=${page}&page_size=${pageSize}`).then((res) => res.data.data || res.data),

  getSubscriptions: () =>
    apiClient.get<any>("/saas/dashboard/subscriptions").then((res) => res.data.data || res.data),

  getUsage: () =>
    apiClient.get<any>("/saas/dashboard/usage").then((res) => res.data.data || res.data),
};
