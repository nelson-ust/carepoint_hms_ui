import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

export type DentalToothCondition =
  | "HEALTHY" | "CARIES" | "FILLED" | "CROWN" | "ROOT_CANAL" | "BRIDGE" | "IMPLANT"
  | "EXTRACTED" | "MISSING" | "IMPACTED" | "FRACTURED" | "MOBILE" | "SEALANT"
  | "TO_EXTRACT" | "TO_FILL";

export type DentalProcedureStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type PatientBrief = {
  id: number; name: string; hospital_number?: string | null;
  gender?: string | null; age?: number | null; phone_number?: string | null;
};

export type ToothRecord = {
  id?: number; tooth_number: number; condition: DentalToothCondition;
  surfaces?: string | null; mobility?: number | null; note?: string | null;
};

export type DentalProcedure = {
  id: number; patient_id: number; visit_id?: number | null; chart_id?: number | null;
  tooth_number?: number | null; surfaces?: string | null; procedure_code?: string | null;
  procedure_name: string; status: DentalProcedureStatus; cost?: string | null;
  planned_date?: string | null; performed_date?: string | null;
  performed_by?: string | null; note?: string | null; created_at?: string | null;
  catalog_id?: number | null; billed_at?: string | null; is_billed?: boolean;
};

export type DentalCatalogItem = {
  id: number; code?: string | null; name: string; category?: string | null;
  default_cost?: string | null; tooth_specific: boolean;
  billable_service_id?: number | null; is_active: boolean; description?: string | null;
};

export type DentalRecallStatus = "DUE" | "SCHEDULED" | "COMPLETED" | "CANCELLED";

export type DentalRecall = {
  id: number; patient_id: number; chart_id?: number | null;
  recall_type?: string | null; due_date: string; interval_months?: number | null;
  status: DentalRecallStatus; note?: string | null;
  created_by?: string | null; created_by_staff_id?: number | null;
  completed_at?: string | null; is_overdue?: boolean; patient: PatientBrief;
};

export type DentalBillResult = {
  billed_count: number; billed_procedure_ids: number[]; billing: Record<string, unknown>;
};

export type DentalChart = {
  id: number; patient_id: number; visit_id?: number | null; consultation_id?: number | null;
  clinician?: string | null; clinician_staff_id?: number | null; status: string;
  numbering_system: string; dentition: string;
  chief_complaint?: string | null; oral_hygiene?: string | null; occlusion_note?: string | null;
  soft_tissue_note?: string | null; periodontal_summary?: string | null; xray_findings?: string | null;
  note?: string | null; examined_at?: string | null; created_at?: string | null;
  patient: PatientBrief; teeth_charted?: number; teeth?: ToothRecord[]; procedures?: DentalProcedure[];
};

export type DentalStats = {
  charts_total: number; charts_open: number; procedures_planned: number;
  procedures_completed: number; completed_revenue?: string | null;
  condition_distribution: { condition: string; count: number }[];
  recalls_due?: number; procedures_unbilled?: number;
};

const g = <T,>(u: string, params?: Record<string, unknown>) =>
  apiClient.get<T>(u, { params }).then((r) => r.data);
const post = <T,>(u: string, body?: unknown) => apiClient.post<T>(u, body).then((r) => r.data);
const patch = <T,>(u: string, body?: unknown) => apiClient.patch<T>(u, body).then((r) => r.data);
const put = <T,>(u: string, body?: unknown) => apiClient.put<T>(u, body).then((r) => r.data);
const del = <T,>(u: string) => apiClient.delete<T>(u).then((r) => r.data);

export const dentalApi = {
  listCharts: (params?: { patient_id?: number; skip?: number; limit?: number }) =>
    g<PaginatedResponse<DentalChart>>("/dental/charts", params),
  getChart: (id: number) =>
    g<{ success: boolean; data: DentalChart }>(`/dental/charts/${id}`).then((d) => d.data),
  createChart: (body: Record<string, unknown>) =>
    post<{ success: boolean; data: DentalChart }>("/dental/charts", body).then((d) => d.data),
  updateChart: (id: number, body: Record<string, unknown>) =>
    patch<{ success: boolean; data: DentalChart }>(`/dental/charts/${id}`, body).then((d) => d.data),
  setTeeth: (id: number, teeth: ToothRecord[]) =>
    put<{ success: boolean; data: DentalChart }>(`/dental/charts/${id}/teeth`, { teeth }).then((d) => d.data),
  listProcedures: (params?: { patient_id?: number; status?: string; skip?: number; limit?: number }) =>
    g<PaginatedResponse<DentalProcedure>>("/dental/procedures", params),
  createProcedure: (body: Record<string, unknown>) =>
    post<{ success: boolean; data: DentalProcedure }>("/dental/procedures", body).then((d) => d.data),
  updateProcedure: (id: number, body: Record<string, unknown>) =>
    patch<{ success: boolean; data: DentalProcedure }>(`/dental/procedures/${id}`, body).then((d) => d.data),
  worklist: (limit = 50) =>
    g<{ success: boolean; items: DentalChart[] }>("/dental/worklist", { limit }).then((d) => d.items),
  stats: () => g<{ success: boolean; data: DentalStats }>("/dental/stats").then((d) => d.data),

  // ---- Procedure catalogue (price list) ----
  listCatalog: (params?: { search?: string; category?: string; active_only?: boolean; skip?: number; limit?: number }) =>
    g<PaginatedResponse<DentalCatalogItem>>("/dental/catalog", params),
  createCatalog: (body: Record<string, unknown>) =>
    post<{ success: boolean; data: DentalCatalogItem }>("/dental/catalog", body).then((d) => d.data),
  updateCatalog: (id: number, body: Record<string, unknown>) =>
    patch<{ success: boolean; data: DentalCatalogItem }>(`/dental/catalog/${id}`, body).then((d) => d.data),
  deleteCatalog: (id: number) =>
    del<{ success: boolean; message: string }>(`/dental/catalog/${id}`),

  // ---- Recalls ----
  listRecalls: (params?: { patient_id?: number; status?: string; due_before?: string; skip?: number; limit?: number }) =>
    g<PaginatedResponse<DentalRecall>>("/dental/recalls", params),
  createRecall: (body: Record<string, unknown>) =>
    post<{ success: boolean; data: DentalRecall }>("/dental/recalls", body).then((d) => d.data),
  updateRecall: (id: number, body: Record<string, unknown>) =>
    patch<{ success: boolean; data: DentalRecall }>(`/dental/recalls/${id}`, body).then((d) => d.data),

  // ---- Treatment-plan billing ----
  billChart: (chartId: number, procedureIds?: number[]) =>
    post<{ success: boolean; message: string; data: DentalBillResult }>(
      `/dental/charts/${chartId}/bill`,
      { procedure_ids: procedureIds ?? null },
    ),
};

export const TOOTH_CONDITION_META: Record<DentalToothCondition, { label: string; color: string }> = {
  HEALTHY: { label: "Healthy", color: "var(--dx-border-strong)" },
  CARIES: { label: "Caries", color: "#f43f5e" },
  FILLED: { label: "Filled", color: "#2563eb" },
  CROWN: { label: "Crown", color: "#f59e0b" },
  ROOT_CANAL: { label: "Root canal", color: "#8b5cf6" },
  BRIDGE: { label: "Bridge", color: "#0891b2" },
  IMPLANT: { label: "Implant", color: "#0d9488" },
  EXTRACTED: { label: "Extracted", color: "#64748b" },
  MISSING: { label: "Missing", color: "#94a3b8" },
  IMPACTED: { label: "Impacted", color: "#d946ef" },
  FRACTURED: { label: "Fractured", color: "#ea580c" },
  MOBILE: { label: "Mobile", color: "#eab308" },
  SEALANT: { label: "Sealant", color: "#10b981" },
  TO_EXTRACT: { label: "To extract", color: "#dc2626" },
  TO_FILL: { label: "To fill", color: "#3b82f6" },
};

export const DENTAL_CONDITIONS = Object.keys(TOOTH_CONDITION_META) as DentalToothCondition[];

// FDI permanent dentition, arranged as seen facing the patient.
export const FDI_PERMANENT = {
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft: [21, 22, 23, 24, 25, 26, 27, 28],
  lowerRight: [48, 47, 46, 45, 44, 43, 42, 41],
  lowerLeft: [31, 32, 33, 34, 35, 36, 37, 38],
};

export const FDI_PRIMARY = {
  upperRight: [55, 54, 53, 52, 51],
  upperLeft: [61, 62, 63, 64, 65],
  lowerRight: [85, 84, 83, 82, 81],
  lowerLeft: [71, 72, 73, 74, 75],
};
