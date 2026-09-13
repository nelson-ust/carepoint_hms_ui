import { apiClient } from "@/lib/api/api-client";

// ── Enum option sets (mirror app/core/enums.py) ─────────────────────
export const TAX_KINDS = ["VAT", "WHT", "SERVICE_TAX", "SALES_TAX", "CONSUMPTION_TAX", "OTHER"] as const;
export const TAX_SCOPES = ["TENANT", "FACILITY"] as const;
export const TAX_APPLICABILITIES = ["ALL", "SERVICE_TYPE", "ITEM_CATEGORY", "PAYER_TYPE", "PATIENT_TYPE"] as const;
export const TAX_PRICING_MODES = ["EXCLUSIVE", "INCLUSIVE"] as const;

export type TaxType = {
  id: number;
  code: string;
  name: string;
  kind: string;
  description?: string | null;
  country_code?: string | null;
  is_withholding: boolean;
  is_active: boolean;
};

export type TaxRule = {
  id: number;
  tax_type_id: number;
  name: string;
  scope: string;
  applicability: string;
  match_values?: string[] | null;
  pricing_mode: string;
  priority: number;
  facility_id?: number | null;
  is_active: boolean;
};

export type TaxRate = {
  id: number;
  tax_type_id: number;
  rate_percent: number | string;
  effective_from: string;
  effective_to?: string | null;
  note?: string | null;
};

export type TaxSummaryLine = {
  code: string;
  name: string;
  taxable_base: number;
  tax_amount: number;
  line_count: number;
};

export type TaxSummaryReport = {
  period_start: string;
  period_end: string;
  summary: TaxSummaryLine[];
};

export type TaxRulePayload = {
  tax_type_id: number;
  name: string;
  scope: string;
  applicability: string;
  match_values?: string[] | null;
  pricing_mode: string;
  priority: number;
  facility_id?: number | null;
  is_active: boolean;
};

export type CreateTaxTypePayload = {
  code: string;
  name: string;
  kind: string;
  is_withholding?: boolean;
};

export type UpdateTaxTypePayload = {
  name?: string;
  kind?: string;
  description?: string | null;
  is_withholding?: boolean;
  is_active?: boolean;
};

export type AddRatePayload = {
  tax_type_id: number;
  rate_percent: number;
  effective_from: string;
  note?: string;
};

export const taxApi = {
  listRules: () =>
    apiClient
      .get<{ success: boolean; items: TaxRule[] } | TaxRule[]>("/tax/rules")
      .then((res) => (Array.isArray(res.data) ? { items: res.data } : { items: res.data.items ?? [] })),

  createRule: (payload: TaxRulePayload) =>
    apiClient.post<TaxRule>("/tax/rules", payload).then((res) => res.data),

  updateRule: (id: number, payload: Partial<TaxRulePayload>) =>
    apiClient.put<TaxRule>(`/tax/rules/${id}`, payload).then((res) => res.data),

  deleteRule: (id: number) => apiClient.delete(`/tax/rules/${id}`).then((res) => res.data),

  listTypes: (onlyActive = false) =>
    apiClient
      .get<TaxType[]>("/tax/types", { params: { only_active: onlyActive } })
      .then((res) => (Array.isArray(res.data) ? res.data : [])),

  createType: (payload: CreateTaxTypePayload) =>
    apiClient.post<TaxType>("/tax/types", payload).then((res) => res.data),

  updateType: (id: number, payload: UpdateTaxTypePayload) =>
    apiClient.put<TaxType>(`/tax/types/${id}`, payload).then((res) => res.data),

  deleteType: (id: number) => apiClient.delete(`/tax/types/${id}`).then((res) => res.data),

  listRates: (taxTypeId?: number) =>
    apiClient
      .get<TaxRate[]>("/tax/rates", { params: taxTypeId ? { tax_type_id: taxTypeId } : {} })
      .then((res) => (Array.isArray(res.data) ? res.data : [])),

  addRate: (payload: AddRatePayload) =>
    apiClient.post<TaxRate>("/tax/rates", payload).then((res) => res.data),

  getSummaryReport: (params: { period_start: string; period_end: string; tax_type_id?: number }) =>
    apiClient
      .get<TaxSummaryReport>("/tax/reports/summary", { params })
      .then((res) => ({ ...res.data, summary: res.data.summary ?? [] })),

  listAuditLog: (params: { entity?: string; entity_id?: number } = {}) =>
    apiClient.get<any[]>("/tax/audit-log", { params }).then((res) => res.data ?? []),
};
