import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

// Mirrors app/core/enums.py :: ProcurementRequisitionStatus
export type RequisitionStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "DEPARTMENT_APPROVED"
  | "FINANCE_APPROVED"
  | "REJECTED"
  | "CONVERTED_TO_RFQ"
  | "CONVERTED_TO_PO"
  | "CANCELLED";

export type RequisitionItem = {
  id?: number;
  requisition_id?: number;
  drug_id?: number | null;
  inventory_stock_item_id?: number | null;
  item_name: string;
  item_description?: string | null;
  quantity_requested: number;
  unit_of_measure?: string | null;
  estimated_unit_price: number;
  estimated_line_total?: number;
};

/** Mirrors PurchaseRequisitionReadSchema (with route-enriched display fields). */
export type Requisition = {
  id: number;
  requisition_no: string;
  facility_id?: number | null;
  department_id?: number | null;
  department_name?: string | null;
  requested_by_staff_id?: number | null;
  requested_by_name?: string | null;
  status: RequisitionStatus;
  estimated_total: number;
  needed_by?: string | null;
  justification?: string | null;
  submitted_at?: string | null;
  approval_request_id?: number | null;
  items: RequisitionItem[];
  created_at?: string | null;
};

export type ProcurementStats = {
  open_requisitions: number;
  pending_approval: number;
  low_stock_items: number;
  total_requisitions: number;
  total_estimated_value: number;
};

export type CreateRequisitionPayload = {
  requested_by_staff_id?: number;
  department_id?: number | null;
  facility_id?: number | null;
  needed_by?: string | null;
  justification?: string | null;
  items: Array<{
    item_name: string;
    item_description?: string | null;
    quantity_requested: number;
    unit_of_measure?: string | null;
    estimated_unit_price: number;
    drug_id?: number | null;
    inventory_stock_item_id?: number | null;
  }>;
};

const BASE = "/procurements";

export const procurementApi = {
  listRequisitions: (params: { skip?: number; limit?: number; department_id?: number } = {}) =>
    apiClient
      .get<PaginatedResponse<Requisition>>(`${BASE}/requisitions`, { params })
      .then((res) => res.data),

  getStats: () =>
    apiClient
      .get<{ success: boolean } & ProcurementStats>(`${BASE}/stats`)
      .then((res) => res.data),

  createRequisition: (payload: CreateRequisitionPayload) =>
    apiClient
      .post<{ success: boolean; message: string; requisition: Requisition }>(
        `${BASE}/requisitions`,
        payload,
      )
      .then((res) => res.data),

  submitRequisition: (id: number, payload: { flow_id: number; title?: string; submit_now?: boolean }) =>
    apiClient.post(`${BASE}/requisitions/${id}/submit`, payload).then((res) => res.data),

  deleteRequisition: (id: number) =>
    apiClient.delete(`${BASE}/requisitions/${id}`).then((res) => res.data),
};

// ── Display helpers ───────────────────────────────────────────────────
export const REQUISITION_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  DEPARTMENT_APPROVED: "Dept. Approved",
  FINANCE_APPROVED: "Finance Approved",
  REJECTED: "Rejected",
  CONVERTED_TO_RFQ: "Converted to RFQ",
  CONVERTED_TO_PO: "Converted to PO",
  CANCELLED: "Cancelled",
};

export function requisitionStatusStyle(status: string): string {
  switch (status) {
    case "FINANCE_APPROVED":
    case "DEPARTMENT_APPROVED":
      return "bg-emerald-50 text-emerald-600 border-emerald-100";
    case "SUBMITTED":
      return "bg-amber-50 text-amber-600 border-amber-100";
    case "REJECTED":
    case "CANCELLED":
      return "bg-rose-50 text-rose-600 border-rose-100";
    case "CONVERTED_TO_PO":
    case "CONVERTED_TO_RFQ":
      return "bg-primary-50 text-primary-600 border-primary-100";
    default:
      return "bg-secondary-50 text-secondary-500 border-secondary-200";
  }
}
