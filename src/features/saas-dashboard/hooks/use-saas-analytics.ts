import { useQuery } from "@tanstack/react-query";
import { saasDashboardApi, SaasMetrics, TenantListResponse } from "../api/saas-dashboard.api";

export function useSaasMetrics() {
  return useQuery<SaasMetrics>({
    queryKey: ["saas-metrics"],
    queryFn: () => saasDashboardApi.getMetrics(),
    refetchInterval: 60000, // Refresh metrics every minute
  });
}

export function useSaasTenants(page = 1, pageSize = 10) {
  return useQuery<TenantListResponse>({
    queryKey: ["saas-tenants", page, pageSize],
    queryFn: () => saasDashboardApi.getTenants(page, pageSize),
  });
}

export function useSaasOverview() {
  return useQuery<any>({
    queryKey: ["saas-overview"],
    queryFn: () => saasDashboardApi.getOverview(),
  });
}
