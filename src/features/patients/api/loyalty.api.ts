import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

// ---------- Types ----------

export type LoyaltyPoint = {
  patient_id: number;
  total_points: number;
  last_updated_at: string;
};

export type LoyaltyTransaction = {
  id: number;
  patient_id: number;
  points: number;
  transaction_type: "EARN" | "REDEEM";
  reason: string;
  created_at: string;
};

// ---------- Endpoints ----------

export const loyaltyApi = {
  getPoints: (patientId: number) =>
    apiClient.get<LoyaltyPoint>(`/patient-loyalty/points/${patientId}`).then((res) => res.data),
  
  getHistory: (patientId: number) =>
    apiClient.get<PaginatedResponse<LoyaltyTransaction>>(`/patient-loyalty/history/${patientId}`).then((res) => res.data),
  
  earn: (payload: { patient_id: number; points: number; reason: string }) =>
    apiClient.post<{ success: boolean; balance: number }>("/patient-loyalty/earn", payload).then((res) => res.data),
  
  redeem: (payload: { patient_id: number; points: number; reason: string }) =>
    apiClient.post<{ success: boolean; balance: number }>("/patient-loyalty/redeem", payload).then((res) => res.data),
};
