import { apiClient } from "@/lib/api/api-client";

// ---------- Types ----------

export type ConnectivityStats = {
  total_probes: number;
  success_rate: number;
  avg_latency: number;
  last_probe_at: string;
};

// ---------- Endpoints ----------

export const connectivityApi = {
  probe: (payload: { target_url: string }) =>
    apiClient.post<{ success: boolean; latency: number }>("/connectivity/probe", payload).then((res) => res.data),
  
  getStats: () =>
    apiClient.get<ConnectivityStats>("/connectivity/stats").then((res) => res.data),
};
