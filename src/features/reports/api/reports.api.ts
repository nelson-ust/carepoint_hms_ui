import { apiClient } from "@/lib/api/api-client";

export type ReportCategory = 'FINANCIAL' | 'CLINICAL' | 'INVENTORY' | 'STAFF';

export type ReportSummary = {
  category: ReportCategory;
  count: number;
  last_generated: string;
};

export const reportsApi = {
  getSummary: () =>
    apiClient.get<ReportSummary[]>("/reports/summary").then((res) => res.data),
  
  exportReport: (category: ReportCategory, format: 'PDF' | 'EXCEL' | 'CSV') =>
    apiClient.get(`/reports/export`, { params: { category, format }, responseType: 'blob' }).then((res) => res.data),
};
