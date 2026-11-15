import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

export type PatientBrief = {
  id: number; name: string; hospital_number?: string | null;
  gender?: string | null; age?: number | null; phone_number?: string | null;
};

export type SpectacleLensType =
  | "SINGLE_VISION" | "BIFOCAL" | "PROGRESSIVE" | "READING" | "DISTANCE" | "OTHER";

export type SpectaclePrescription = {
  id: number; patient_id: number; exam_id?: number | null;
  prescriber?: string | null; prescriber_staff_id?: number | null; prescribed_date?: string | null;
  od_sphere?: string | null; od_cyl?: string | null; od_axis?: number | null; od_add?: string | null;
  os_sphere?: string | null; os_cyl?: string | null; os_axis?: number | null; os_add?: string | null;
  pd?: string | null; lens_type: SpectacleLensType; usage?: string | null; notes?: string | null;
  created_at?: string | null; patient?: PatientBrief;
};

export type EyeExam = {
  id: number; patient_id: number; visit_id?: number | null; consultation_id?: number | null;
  clinician?: string | null; clinician_staff_id?: number | null; status: string;
  examined_at?: string | null; created_at?: string | null; patient: PatientBrief;
  chief_complaint?: string | null; history_note?: string | null; external_note?: string | null;
  va_dist_unaided_od?: string | null; va_dist_unaided_os?: string | null;
  va_dist_aided_od?: string | null; va_dist_aided_os?: string | null;
  va_near_od?: string | null; va_near_os?: string | null;
  pinhole_od?: string | null; pinhole_os?: string | null;
  ref_sphere_od?: string | null; ref_sphere_os?: string | null;
  ref_cyl_od?: string | null; ref_cyl_os?: string | null;
  ref_axis_od?: number | null; ref_axis_os?: number | null;
  ref_add_od?: string | null; ref_add_os?: string | null;
  iop_od?: string | null; iop_os?: string | null; iop_method?: string | null;
  anterior_od?: string | null; anterior_os?: string | null;
  posterior_od?: string | null; posterior_os?: string | null;
  impression?: string | null; plan_note?: string | null;
  prescriptions?: SpectaclePrescription[];
};

export type EyeStats = {
  exams_total: number; exams_open: number;
  prescriptions_total: number; raised_iop_flagged: number;
};

const g = <T,>(u: string, params?: Record<string, unknown>) =>
  apiClient.get<T>(u, { params }).then((r) => r.data);
const post = <T,>(u: string, body?: unknown) => apiClient.post<T>(u, body).then((r) => r.data);
const patch = <T,>(u: string, body?: unknown) => apiClient.patch<T>(u, body).then((r) => r.data);

export const eyeApi = {
  listExams: (params?: { patient_id?: number; skip?: number; limit?: number }) =>
    g<PaginatedResponse<EyeExam>>("/eye-clinic/exams", params),
  getExam: (id: number) =>
    g<{ success: boolean; data: EyeExam }>(`/eye-clinic/exams/${id}`).then((d) => d.data),
  createExam: (body: Record<string, unknown>) =>
    post<{ success: boolean; data: EyeExam }>("/eye-clinic/exams", body).then((d) => d.data),
  updateExam: (id: number, body: Record<string, unknown>) =>
    patch<{ success: boolean; data: EyeExam }>(`/eye-clinic/exams/${id}`, body).then((d) => d.data),
  listPrescriptions: (params?: { patient_id?: number; skip?: number; limit?: number }) =>
    g<PaginatedResponse<SpectaclePrescription>>("/eye-clinic/prescriptions", params),
  createPrescription: (body: Record<string, unknown>) =>
    post<{ success: boolean; data: SpectaclePrescription }>("/eye-clinic/prescriptions", body).then((d) => d.data),
  worklist: (limit = 50) =>
    g<{ success: boolean; items: EyeExam[] }>("/eye-clinic/worklist", { limit }).then((d) => d.items),
  stats: () => g<{ success: boolean; data: EyeStats }>("/eye-clinic/stats").then((d) => d.data),
};

export const LENS_TYPES: { value: SpectacleLensType; label: string }[] = [
  { value: "SINGLE_VISION", label: "Single vision" },
  { value: "BIFOCAL", label: "Bifocal" },
  { value: "PROGRESSIVE", label: "Progressive" },
  { value: "READING", label: "Reading" },
  { value: "DISTANCE", label: "Distance" },
  { value: "OTHER", label: "Other" },
];
