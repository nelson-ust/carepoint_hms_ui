import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

// ---------- Types ----------

export type Admission = {
  id: number;
  admission_no: string;
  patient_id: number;
  visit_id?: number;
  ward_id: number;
  bed_id: number;
  admitted_by_staff_id?: number;
  admission_status: string;
  admission_reason?: string;
  admitted_at?: string;
  expected_discharge_at?: string;
  actual_discharge_at?: string;
  created_at: string;
  updated_at: string;

  // Optional enriched fields the backend may include
  patient?: {
    id: number;
    hospital_number?: string;
    first_name?: string;
    last_name?: string;
    gender?: string;
    phone_number?: string;
  };
  ward?: { id: number; name?: string; code?: string };
  bed?: { id: number; bed_number?: string; ward_id?: number };
};

export const ADMISSION_STATUSES = [
  "ADMITTED",
  "ON_LEAVE",
  "TRANSFERRED",
  "AWAITING_DISCHARGE",
  "DISCHARGED",
  "CANCELLED",
] as const;

// ---------- Payloads ----------

export type AdmitPatientPayload = {
  patient_id: number;
  visit_id?: number;
  ward_id: number;
  bed_id: number;
  admitting_staff_id?: number;
  admission_reason?: string;
  admitted_at?: string;
  expected_discharge_at?: string;
  capture_first_bed_day_charge?: boolean;
};

export type ConvertVisitToAdmissionPayload = {
  visit_id: number;
  ward_id: number;
  bed_id: number;
  admitting_staff_id?: number;
  admission_reason?: string;
  expected_discharge_at?: string;
  capture_first_bed_day_charge?: boolean;
  route_to_service_delivery_point_id?: number;
};

export type TransferBedPayload = {
  new_bed_id: number;
  new_ward_id?: number;
  reason?: string;
};

export type UpdateAdmissionStatusPayload = {
  new_status: string;
  reason?: string;
};

export type CaptureBedDayChargesPayload = {
  through_date: string;
};

// ---------- Responses ----------

export type AdmissionActionResponse = {
  success: boolean;
  message: string;
  admission: Admission;
};

export type CaptureBedDayChargesResponse = {
  success: boolean;
  message: string;
  admission_id: number;
  charges_captured: number;
  total_amount_captured: number;
  captured_through: string;
};

// ---------- Endpoints ----------

export async function listAdmissions(
  params: { skip?: number; limit?: number; status?: string } = {},
): Promise<PaginatedResponse<Admission>> {
  const { skip = 0, limit = 100, status } = params;
  const response = await apiClient.get<PaginatedResponse<Admission>>("/admissions/", {
    params: { skip, limit, status },
  });
  return response.data;
}

export async function listActiveAdmissionsForWard(
  wardId: number,
): Promise<PaginatedResponse<Admission>> {
  const response = await apiClient.get<PaginatedResponse<Admission>>(
    `/admissions/wards/${wardId}/active`,
  );
  return response.data;
}

export async function getAdmission(admissionId: number): Promise<Admission> {
  const response = await apiClient.get<Admission>(`/admissions/${admissionId}`);
  return response.data;
}

export async function admitPatient(
  payload: AdmitPatientPayload,
): Promise<AdmissionActionResponse> {
  const response = await apiClient.post<AdmissionActionResponse>("/admissions/", payload);
  return response.data;
}

export async function convertVisitToAdmission(
  payload: ConvertVisitToAdmissionPayload,
): Promise<AdmissionActionResponse> {
  const response = await apiClient.post<AdmissionActionResponse>(
    "/admissions/from-visit",
    payload,
  );
  return response.data;
}

export async function transferAdmissionBed(
  admissionId: number,
  payload: TransferBedPayload,
): Promise<AdmissionActionResponse> {
  const response = await apiClient.post<AdmissionActionResponse>(
    `/admissions/${admissionId}/transfer`,
    payload,
  );
  return response.data;
}

export async function updateAdmissionStatus(
  admissionId: number,
  payload: UpdateAdmissionStatusPayload,
): Promise<AdmissionActionResponse> {
  const response = await apiClient.post<AdmissionActionResponse>(
    `/admissions/${admissionId}/status`,
    payload,
  );
  return response.data;
}

export async function captureBedDayCharges(
  admissionId: number,
  payload: CaptureBedDayChargesPayload,
): Promise<CaptureBedDayChargesResponse> {
  const response = await apiClient.post<CaptureBedDayChargesResponse>(
    `/admissions/${admissionId}/bed-days`,
    payload,
  );
  return response.data;
}
