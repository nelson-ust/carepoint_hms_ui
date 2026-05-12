import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

export type ComplianceRecord = {
  id: number;
  title: string;
  category: string;
  department_id?: number;
  department_name?: string;
  description: string;
  status: 'PENDING' | 'VALID' | 'EXPIRED' | 'REJECTED';
  expiry_date?: string;
  attachment_url?: string;
  created_at: string;
};

export const complianceApi = {
  list: (params: { skip?: number; limit?: number; status?: string } = {}) =>
    apiClient.get<PaginatedResponse<ComplianceRecord>>("/compliance/records", { params }).then((res) => res.data),
  
  create: (payload: Partial<ComplianceRecord>) =>
    apiClient.post("/compliance/records", payload).then((res) => res.data),
  
  update: (id: number, payload: Partial<ComplianceRecord>) =>
    apiClient.put(`/compliance/records/${id}`, payload).then((res) => res.data),
};
