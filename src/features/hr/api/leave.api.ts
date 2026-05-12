import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type LeaveRequest = {
  id: number;
  staff_profile_id: number;
  staff_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: LeaveStatus;
  approved_by_id?: number;
  created_at: string;
};

export const leaveApi = {
  list: (params: { skip?: number; limit?: number; status?: LeaveStatus } = {}) =>
    apiClient.get<PaginatedResponse<LeaveRequest>>("/hr/leave-requests", { params }).then((res) => res.data),
  
  create: (payload: Partial<LeaveRequest>) =>
    apiClient.post("/hr/leave-requests", payload).then((res) => res.data),
  
  respond: (id: number, status: 'APPROVED' | 'REJECTED', note?: string) =>
    apiClient.post(`/hr/leave-requests/${id}/respond`, { status, note }).then((res) => res.data),
};
