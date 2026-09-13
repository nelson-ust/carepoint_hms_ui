import { useQuery } from "@tanstack/react-query";
import { getHeadcountReport } from "../api/hr-dashboard.api";

export const hrDashboardKeys = {
  all: ["hr-dashboard"] as const,
  headcount: () => [...hrDashboardKeys.all, "headcount"] as const,
};

export function useHeadcountReport() {
  return useQuery({
    queryKey: hrDashboardKeys.headcount(),
    queryFn: () => getHeadcountReport(),
    staleTime: 5 * 60 * 1000,
  });
}
