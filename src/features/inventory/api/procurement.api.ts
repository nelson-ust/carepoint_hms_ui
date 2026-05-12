import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

export type RequisitionStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'FULFILLED';

export type Requisition = {
  id: number;
  request_no: string;
  department_id: number;
  department_name: string;
  requested_by_id: number;
  requested_by_name: string;
  status: RequisitionStatus;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  total_amount: number;
  items: any[];
  created_at: string;
};

export const procurementApi = {
  listRequisitions: (params: { skip?: number; limit?: number; status?: string } = {}) =>
    apiClient.get<PaginatedResponse<Requisition>>("/procurement/requisitions", { params }).then((res) => res.data),
  
  createRequisition: (payload: Partial<Requisition>) =>
    apiClient.post("/procurement/requisitions", payload).then((res) => res.data),

  approveRequisition: (id: number) =>
    apiClient.post(`/procurement/requisitions/${id}/approve`).then((res) => res.data),
};
