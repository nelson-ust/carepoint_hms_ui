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
  // The backend probe is a lightweight GET (app/api/v1/endpoints/edge_node_routes.py:
  // connectivity_router GET /probe). We measure round-trip latency client-side.
  probe: async (_payload?: { target_url: string }) => {
    const start =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const res = await apiClient.get<{ ok?: boolean }>("/connectivity/probe");
    const end = typeof performance !== "undefined" ? performance.now() : Date.now();
    return { success: !!res.data?.ok, latency: Math.round(end - start) };
  },

  getStats: () =>
    apiClient.get<ConnectivityStats>("/connectivity/stats").then((res) => res.data),
};
