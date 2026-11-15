import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";

export type ConnectivityMode = "cloud" | "edge" | "forced";

export type ConnectivityStatus = {
  online: boolean;
  mode: ConnectivityMode;
  reason: string;
  server_time: string;
  cloud_time?: string | null;
  last_checked_seconds_ago?: number | null;
  cloud_base_url?: string | null;
  gated_operations: string[];
};

export const connectivityQueryKey = ["system", "connectivity-status"] as const;

async function fetchConnectivity(): Promise<ConnectivityStatus> {
  const r = await apiClient.get("/connectivity/status");
  return r.data as ConnectivityStatus;
}

/**
 * Live cloud-connectivity posture for this deployment.
 *
 * On the central cloud this is always online. On an on-site ("edge") node it
 * reflects whether the hospital can currently reach the cloud. We poll every
 * 20s so the offline banner and the cross-hospital gates react quickly when the
 * link drops or returns. While the first request is in flight we optimistically
 * assume online (so gates don't flash); a hard error (even the local server
 * unreachable) is treated as offline.
 */
export function useConnectivity() {
  const query = useQuery({
    queryKey: connectivityQueryKey,
    queryFn: fetchConnectivity,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 10_000,
    retry: false,
  });

  const status = query.data;
  const online = query.isError ? false : status?.online ?? true;

  return {
    ...query,
    status,
    online,
    reason: query.isError ? "Unable to reach the server." : status?.reason ?? "",
    mode: status?.mode,
    gatedOperations: status?.gated_operations ?? [],
  };
}

/** Force an immediate, cache-bypassing re-check (used by "Retry" buttons). */
export function useRefreshConnectivity() {
  const qc = useQueryClient();
  return async () => {
    try {
      const r = await apiClient.post("/connectivity/refresh");
      qc.setQueryData(connectivityQueryKey, r.data);
    } catch {
      await qc.invalidateQueries({ queryKey: connectivityQueryKey });
    }
  };
}
