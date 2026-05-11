import { apiClient } from "@/lib/api/api-client";

export type VitalSigns = {
  temperature?: number;
  pulse_rate?: number;
  respiratory_rate?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
  oxygen_saturation?: number;
  weight?: number;
  height?: number;
  bmi?: number;
};

export async function recordVitals(visitId: number, vitals: VitalSigns) {
  const response = await apiClient.post(`/vital-signs`, {
    visit_id: visitId,
    ...vitals,
  });
  return response.data;
}

export async function recordTriage(visitId: number, triageData: any) {
  const response = await apiClient.post(`/triage`, {
    visit_id: visitId,
    ...triageData,
  });
  return response.data;
}

export async function createConsultation(visitId: number, data: any) {
  const response = await apiClient.post(`/consultations`, {
    visit_id: visitId,
    ...data,
  });
  return response.data;
}
