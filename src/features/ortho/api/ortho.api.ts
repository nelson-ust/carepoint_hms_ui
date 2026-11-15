import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

export type OrthoLaterality = "LEFT" | "RIGHT" | "BILATERAL" | "CENTRAL" | "NOT_APPLICABLE";
export type OrthoProcedureStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type PatientBrief = {
  id: number; name: string; hospital_number?: string | null;
  gender?: string | null; age?: number | null; phone_number?: string | null;
};

export type OrthoFracture = {
  id: number; assessment_id: number; bone: string; side: OrthoLaterality;
  pattern?: string | null; classification?: string | null;
  is_open: boolean; is_displaced: boolean; management?: string | null; note?: string | null;
};

export type OrthoImmobilisation = {
  id: number; assessment_id: number; device_type: string; body_part?: string | null;
  side: OrthoLaterality; applied_date?: string | null; expected_removal_date?: string | null;
  removed_date?: string | null; active: boolean; note?: string | null;
};

export type OrthoProcedure = {
  id: number; patient_id: number; visit_id?: number | null; assessment_id?: number | null;
  procedure_code?: string | null; procedure_name: string; laterality: OrthoLaterality;
  status: OrthoProcedureStatus; cost?: string | null;
  planned_date?: string | null; performed_date?: string | null;
  performed_by?: string | null; note?: string | null; created_at?: string | null;
};

export type OrthoAssessment = {
  id: number; patient_id: number; visit_id?: number | null; consultation_id?: number | null;
  clinician?: string | null; clinician_staff_id?: number | null; status: string;
  region?: string | null; laterality: OrthoLaterality;
  chief_complaint?: string | null; mechanism_of_injury?: string | null; injury_date?: string | null;
  pain_score?: number | null; rom_note?: string | null; neurovascular_note?: string | null;
  special_tests?: string | null; provisional_diagnosis?: string | null;
  imaging_modality?: string | null; imaging_findings?: string | null;
  plan_note?: string | null; note?: string | null; examined_at?: string | null; created_at?: string | null;
  patient: PatientBrief; fracture_count?: number;
  fractures?: OrthoFracture[]; immobilisations?: OrthoImmobilisation[]; procedures?: OrthoProcedure[];
};

export type OrthoStats = {
  assessments_total: number; assessments_open: number; fractures_total: number;
  active_immobilisations: number; procedures_planned: number; procedures_completed: number;
  completed_revenue?: string | null;
};

const g = <T,>(u: string, params?: Record<string, unknown>) =>
  apiClient.get<T>(u, { params }).then((r) => r.data);
const post = <T,>(u: string, body?: unknown) => apiClient.post<T>(u, body).then((r) => r.data);
const patch = <T,>(u: string, body?: unknown) => apiClient.patch<T>(u, body).then((r) => r.data);
const del = <T,>(u: string) => apiClient.delete<T>(u).then((r) => r.data);

export const orthoApi = {
  listAssessments: (params?: { patient_id?: number; skip?: number; limit?: number }) =>
    g<PaginatedResponse<OrthoAssessment>>("/orthopaedics/assessments", params),
  getAssessment: (id: number) =>
    g<{ success: boolean; data: OrthoAssessment }>(`/orthopaedics/assessments/${id}`).then((d) => d.data),
  createAssessment: (body: Record<string, unknown>) =>
    post<{ success: boolean; data: OrthoAssessment }>("/orthopaedics/assessments", body).then((d) => d.data),
  updateAssessment: (id: number, body: Record<string, unknown>) =>
    patch<{ success: boolean; data: OrthoAssessment }>(`/orthopaedics/assessments/${id}`, body).then((d) => d.data),
  addFracture: (aid: number, body: Record<string, unknown>) =>
    post<{ success: boolean; data: OrthoAssessment }>(`/orthopaedics/assessments/${aid}/fractures`, body).then((d) => d.data),
  deleteFracture: (fid: number) =>
    del<{ success: boolean; data: OrthoAssessment }>(`/orthopaedics/fractures/${fid}`).then((d) => d.data),
  addImmobilisation: (aid: number, body: Record<string, unknown>) =>
    post<{ success: boolean; data: OrthoAssessment }>(`/orthopaedics/assessments/${aid}/immobilisations`, body).then((d) => d.data),
  removeImmobilisation: (iid: number, body: Record<string, unknown>) =>
    post<{ success: boolean; data: OrthoAssessment }>(`/orthopaedics/immobilisations/${iid}/remove`, body).then((d) => d.data),
  listProcedures: (params?: { patient_id?: number; status?: string; skip?: number; limit?: number }) =>
    g<PaginatedResponse<OrthoProcedure>>("/orthopaedics/procedures", params),
  createProcedure: (body: Record<string, unknown>) =>
    post<{ success: boolean; data: OrthoProcedure }>("/orthopaedics/procedures", body).then((d) => d.data),
  updateProcedure: (id: number, body: Record<string, unknown>) =>
    patch<{ success: boolean; data: OrthoProcedure }>(`/orthopaedics/procedures/${id}`, body).then((d) => d.data),
  worklist: (limit = 50) =>
    g<{ success: boolean; items: OrthoAssessment[] }>("/orthopaedics/worklist", { limit }).then((d) => d.items),
  stats: () => g<{ success: boolean; data: OrthoStats }>("/orthopaedics/stats").then((d) => d.data),
};

export const LATERALITY_OPTIONS: { value: OrthoLaterality; label: string }[] = [
  { value: "NOT_APPLICABLE", label: "N/A" },
  { value: "LEFT", label: "Left" },
  { value: "RIGHT", label: "Right" },
  { value: "BILATERAL", label: "Bilateral" },
  { value: "CENTRAL", label: "Central / midline" },
];

export const IMMOBILISATION_TYPES = [
  "Plaster cast", "Synthetic cast", "Backslab", "Splint", "Brace", "Sling",
  "Skin traction", "Skeletal traction", "Walker boot", "Collar",
];

export const lateralityLabel = (l?: OrthoLaterality | null) =>
  LATERALITY_OPTIONS.find((o) => o.value === l)?.label ?? "N/A";
