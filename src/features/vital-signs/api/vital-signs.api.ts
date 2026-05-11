import { apiClient } from "@/lib/api/api-client";
import { PaginatedResponse } from "@/features/visits/api/visits.api";

export type VitalSign = {
  id: number;
  visit_id: number;
  recorded_by_staff_id?: number;
  temperature_celsius?: number;
  pulse_rate?: number;
  respiratory_rate?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
  oxygen_saturation?: number;
  weight_kg?: number;
  height_cm?: number;
  bmi?: number;
  pain_score?: number;
  recorded_at: string;
  created_at: string;
};

export type CreateVitalSignPayload = {
  visit_id: number;
  recorded_by_staff_id?: number;
  temperature_celsius?: number;
  pulse_rate?: number;
  respiratory_rate?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
  oxygen_saturation?: number;
  weight_kg?: number;
  height_cm?: number;
  bmi?: number;
  pain_score?: number;
};

export type CreateVitalSignResponse = {
  success: boolean;
  message: string;
  vital_sign: VitalSign;
};

export async function getVitalSignsForVisit(visitId: number) {
  const response = await apiClient.get<PaginatedResponse<VitalSign>>(
    `/vital-signs/visits/${visitId}`,
  );
  return response.data;
}

export async function getLatestVitalSignForVisit(visitId: number) {
  const response = await apiClient.get<VitalSign>(`/vital-signs/visits/${visitId}/latest`);
  return response.data;
}

export async function recordVitalSign(payload: CreateVitalSignPayload) {
  const response = await apiClient.post<CreateVitalSignResponse>("/vital-signs/", payload);
  return response.data;
}
