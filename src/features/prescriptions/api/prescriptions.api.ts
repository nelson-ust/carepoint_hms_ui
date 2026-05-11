import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";
import type { Drug } from "@/features/drugs/api/drugs.api";

export const PRESCRIPTION_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "PARTIALLY_DISPENSED",
  "DISPENSED",
  "CANCELLED",
] as const;

export type PrescriptionItem = {
  id: number;
  prescription_id: number;
  drug_id: number;
  dose: string;
  route?: string;
  frequency?: string;
  duration?: string;
  quantity: number;
  unit_price?: number;
  instructions?: string;
  drug?: Drug;
  created_at: string;
  updated_at: string;
};

export type Prescription = {
  id: number;
  visit_id: number;
  consultation_id?: number;
  prescribed_by_staff_id?: number;
  prescription_no: string;
  status: string;
  note?: string;
  prescribed_at?: string;
  items: PrescriptionItem[] | string;
  created_at: string;
  updated_at: string;
  visit?: {
    id: number;
    visit_code?: string;
    patient?: {
      id: number;
      first_name?: string;
      last_name?: string;
      hospital_number?: string;
    };
  };
};

// Defensive normaliser — backend doc shows `items: "string"` but it is an array.
export function asPrescriptionItemArray(
  value: PrescriptionItem[] | string | undefined,
): PrescriptionItem[] {
  return Array.isArray(value) ? value : [];
}

// ---------- Payloads ----------

export type CreatePrescriptionItemPayload = {
  drug_id: number;
  dose: string;
  route?: string;
  frequency?: string;
  duration?: string;
  quantity: number;
  unit_price?: number;
  instructions?: string;
};

export type CreatePrescriptionPayload = {
  visit_id: number;
  consultation_id?: number;
  prescribed_by_staff_id?: number;
  note?: string;
  items: CreatePrescriptionItemPayload[];
  auto_capture_charge?: boolean;
  route_to_pharmacy_service_delivery_point_id?: number;
  route_to_cashier_service_delivery_point_id?: number;
};

export type CancelPrescriptionPayload = {
  reason: string;
};

// ---------- Responses ----------

export type PrescriptionActionResponse = {
  success: boolean;
  message: string;
  prescription: Prescription;
};

// ---------- Endpoints ----------

export async function listPrescriptionsForVisit(
  visitId: number,
): Promise<PaginatedResponse<Prescription>> {
  const response = await apiClient.get<PaginatedResponse<Prescription>>(
    `/prescriptions/visits/${visitId}`,
  );
  return response.data;
}

export async function getPrescription(prescriptionId: number): Promise<Prescription> {
  const response = await apiClient.get<Prescription>(`/prescriptions/${prescriptionId}`);
  return response.data;
}

export async function createPrescription(
  payload: CreatePrescriptionPayload,
): Promise<PrescriptionActionResponse> {
  const response = await apiClient.post<PrescriptionActionResponse>(
    "/prescriptions/",
    payload,
  );
  return response.data;
}

export async function cancelPrescription(
  prescriptionId: number,
  payload: CancelPrescriptionPayload,
): Promise<PrescriptionActionResponse> {
  const response = await apiClient.post<PrescriptionActionResponse>(
    `/prescriptions/${prescriptionId}/cancel`,
    payload,
  );
  return response.data;
}
