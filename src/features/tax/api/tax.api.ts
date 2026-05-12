import { apiClient } from "@/lib/api/api-client";

export type TaxRule = {
  id: number;
  name: string;
  rate_percentage: number;
  tax_code: string;
  is_active: boolean;
  apply_to_consultations: boolean;
  apply_to_drugs: boolean;
  apply_to_lab_tests: boolean;
  apply_to_radiology: boolean;
  created_at: string;
};

export const taxApi = {
  listRules: () =>
    apiClient.get<{ success: boolean; items: TaxRule[] }>("/tax/rules").then((res) => res.data),
  
  createRule: (payload: Partial<TaxRule>) =>
    apiClient.post("/tax/rules", payload).then((res) => res.data),
  
  updateRule: (id: number, payload: Partial<TaxRule>) =>
    apiClient.put(`/tax/rules/${id}`, payload).then((res) => res.data),
  
  getAuditReport: (params: { start_date: string; end_date: string }) =>
    apiClient.get("/tax/reports/audit", { params }).then((res) => res.data),
};
