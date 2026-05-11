import { apiClient } from "@/lib/api/api-client";

export type VitalSign = {
  id: number;
  visit_id: number;
  recorded_by_staff_id: number;
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

export type RecordVitalSignPayload = Omit<VitalSign, "id" | "recorded_at" | "created_at" | "bmi">;

export async function getVisitVitalSigns(visitId: number) {
  const response = await apiClient.get<{ items: VitalSign[] }>(`/vital-signs/visits/${visitId}`);
  return response.data;
}

export async function getLatestVitalSigns(visitId: number) {
  const response = await apiClient.get<VitalSign>(`/vital-signs/visits/${visitId}/latest`);
  return response.data;
}

export async function recordVitalSigns(payload: RecordVitalSignPayload) {
  const response = await apiClient.post<{ vital_sign: VitalSign }>("/vital-signs/", payload);
  return response.data;
}
