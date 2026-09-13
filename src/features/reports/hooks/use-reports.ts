import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  generateReport,
  getAggregationSummary,
  getFinancialSummary,
  getOperationalSummary,
  getPlatformOverview,
  type ReportFileType,
  type ReportType,
} from "../api/reports.api";

export const reportKeys = {
  all: ["reports"] as const,
  aggregation: () => [...reportKeys.all, "aggregation-summary"] as const,
  operational: () => [...reportKeys.all, "operational-summary"] as const,
  financial: (range?: { startDate?: string; endDate?: string }) =>
    [...reportKeys.all, "financial-summary", range ?? {}] as const,
  platform: () => [...reportKeys.all, "platform-overview"] as const,
};

/** One-shot dashboard payload: financial + clinical + inventory + workforce. */
export function useAggregationSummary() {
  return useQuery({
    queryKey: reportKeys.aggregation(),
    queryFn: getAggregationSummary,
    staleTime: 60_000,
  });
}

export function useOperationalSummary() {
  return useQuery({
    queryKey: reportKeys.operational(),
    queryFn: getOperationalSummary,
    staleTime: 60_000,
  });
}

export function useFinancialSummary(range?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: reportKeys.financial(range),
    queryFn: () => getFinancialSummary(range),
    staleTime: 60_000,
  });
}

/** SaaS-admin only platform stats — disabled unless explicitly enabled. */
export function usePlatformOverview(enabled = false) {
  return useQuery({
    queryKey: reportKeys.platform(),
    queryFn: getPlatformOverview,
    enabled,
    staleTime: 60_000,
  });
}

/** Generate + stream a report file (pdf/excel). */
export function useGenerateReport() {
  return useMutation({
    mutationFn: ({
      reportType,
      fileType,
    }: {
      reportType: ReportType;
      fileType: ReportFileType;
    }) => generateReport(reportType, fileType),
  });
}

/** Invalidate every report query (Refresh button). */
export function useRefreshReports() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: reportKeys.all });
}
