import { useQuery } from "@tanstack/react-query";
import { saasDashboardApi } from "../api/saas-dashboard.api";

export function useSystemHealth() {
  return useQuery({
    queryKey: ["system-health"],
    queryFn: () => saasDashboardApi.getHealth(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}
