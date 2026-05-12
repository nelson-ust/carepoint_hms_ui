import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

export type StaffFinanceStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';

export type SalaryAdvance = {
  id: number;
  staff_profile_id: number;
  staff_name: string;
  amount: number;
  reason: string;
  repayment_months: number;
  status: StaffFinanceStatus;
  created_at: string;
};

export type Reimbursement = {
  id: number;
  staff_profile_id: number;
  staff_name: string;
  category: string;
  amount: number;
  description: string;
  receipt_url?: string;
  status: StaffFinanceStatus;
  created_at: string;
};

export const staffFinanceApi = {
  listAdvances: (params: { skip?: number; limit?: number } = {}) =>
    apiClient.get<PaginatedResponse<SalaryAdvance>>("/salary-advance", { params }).then((res) => res.data),
  
  createAdvance: (payload: Partial<SalaryAdvance>) =>
    apiClient.post("/salary-advance", payload).then((res) => res.data),

  listReimbursements: (params: { skip?: number; limit?: number } = {}) =>
    apiClient.get<PaginatedResponse<Reimbursement>>("/reimbursements", { params }).then((res) => res.data),
  
  createReimbursement: (payload: Partial<Reimbursement>) =>
    apiClient.post("/reimbursements", payload).then((res) => res.data),
};
