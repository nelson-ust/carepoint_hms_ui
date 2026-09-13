import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/api-client";

export type DeploymentInfo = {
  mode: "saas" | "dedicated";
  hospital_name?: string | null;
  license?: {
    licensed_until: string | null;
    days_left: number | null;
    in_grace: boolean;
    blocked: boolean;
    message: string | null;
  } | null;
};

/** Deployment mode + licence posture (cached; refetched hourly). */
export function useDeploymentInfo() {
  return useQuery({
    queryKey: ["system", "deployment-info"],
    queryFn: () =>
      apiClient.get("/system/deployment-info").then((r) => r.data as DeploymentInfo),
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}
