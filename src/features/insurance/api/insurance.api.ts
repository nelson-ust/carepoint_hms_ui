import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

export type InsuranceProvider = {
  id: number;
  name: string;
  code: string;
  contact_person?: string;
  email?: string;
  is_active: boolean;
};

export type InsuranceClaim = {
  id: number;
  invoice_number: string;
  patient_name: string;
  provider_name: string;
  amount: number;
  status: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PAID';
  submitted_at: string;
};

export const insuranceApi = {
  listProviders: () =>
    apiClient.get<PaginatedResponse<InsuranceProvider>>("/insurance-providers").then((res) => res.data),
  
  listClaims: () =>
    apiClient.get<PaginatedResponse<InsuranceClaim>>("/insurance-claims").then((res) => res.data),
  
  submitClaim: (payload: { invoice_id: number; provider_id: number }) =>
    apiClient.post<{ success: boolean; claim: InsuranceClaim }>("/insurance-claims", payload).then((res) => res.data),
};
