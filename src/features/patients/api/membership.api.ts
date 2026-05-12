import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

export type MembershipCard = {
  id: number;
  patient_id: number;
  patient_name: string;
  card_number: string;
  issue_date: string;
  expiry_date: string;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'LOST';
  created_at: string;
};

export const membershipApi = {
  list: (params: { skip?: number; limit?: number; patient_id?: number } = {}) =>
    apiClient.get<PaginatedResponse<MembershipCard>>("/membership-cards", { params }).then((res) => res.data),
  
  create: (payload: Partial<MembershipCard>) =>
    apiClient.post("/membership-cards", payload).then((res) => res.data),
  
  activate: (id: number) =>
    apiClient.post(`/membership-cards/${id}/activate`).then((res) => res.data),
};
