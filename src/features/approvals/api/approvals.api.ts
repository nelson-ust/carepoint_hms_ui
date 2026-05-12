import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

export type ApprovalRequest = {
  id: number;
  request_type: 'INVENTORY_REQUISITION' | 'EXPENSE_CLAIM' | 'LEAVE_REQUEST' | 'LAB_ORDER';
  title: string;
  requester_name: string;
  amount?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
  details?: any;
};

export const approvalsApi = {
  list: () =>
    apiClient.get<PaginatedResponse<ApprovalRequest>>("/approvals").then((res) => res.data),
  
  approve: (id: number, comment?: string) =>
    apiClient.post(`/approvals/${id}/approve`, { comment }).then((res) => res.data),
  
  reject: (id: number, reason: string) =>
    apiClient.post(`/approvals/${id}/reject`, { reason }).then((res) => res.data),
};
