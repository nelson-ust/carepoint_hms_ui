import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";
import type { LabTest } from "./lab-tests.api";
import type { LabResult } from "./lab-results.api";

// ---------- Status Vocabulary ----------

export const LAB_ORDER_STATUSES = [
  "PENDING",
  "AWAITING_PAYMENT",
  "AWAITING_SAMPLE",
  "IN_PROGRESS",
  "PARTIAL",
  "COMPLETED",
  "CANCELLED",
] as const;

export const LAB_ORDER_ITEM_STATUSES = [
  "ORDERED",
  "AWAITING_SAMPLE",
  "COLLECTED",
  "PROCESSING",
  "COMPLETED",
  "CANCELLED",
] as const;

// ---------- Types ----------

export type LabOrderItem = {
  id: number;
  lab_order_id: number;
  lab_test_id: number;
  status: string;
  specimen_id?: string;
  collected_by_staff_id?: number;
  collected_at?: string;
  processing_started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  unit_price?: number;
  notes?: string;
  lab_test?: LabTest;
  result?: LabResult;
  created_at: string;
  updated_at: string;
};

export type LabOrder = {
  id: number;
  visit_id: number;
  consultation_id?: number;
  ordered_by_staff_id?: number;
  order_no: string;
  status: string;
  clinical_note?: string;
  ordered_at?: string;
  items: LabOrderItem[] | string; // backend doc shows "string" but it's an array
  created_at: string;
  updated_at: string;
  /** Optional enriched fields the backend may include */
  visit?: {
    id: number;
    visit_code?: string;
    patient?: {
      id: number;
      first_name?: string;
      last_name?: string;
      hospital_number?: string;
    };
  };
};

// ---------- Payloads ----------

export type CreateLabOrderItemPayload = {
  lab_test_id: number;
  unit_price?: number;
  notes?: string;
};

export type CreateLabOrderPayload = {
  visit_id: number;
  consultation_id?: number;
  ordered_by_staff_id?: number;
  clinical_note?: string;
  items: CreateLabOrderItemPayload[];
  auto_capture_charge?: boolean;
  route_to_lab_service_delivery_point_id?: number;
  route_to_cashier_service_delivery_point_id?: number;
};

export type CollectSpecimenPayload = {
  specimen_id: string;
  collected_by_staff_id: number;
  note?: string;
};

export type CancelReasonPayload = {
  reason: string;
};

// ---------- Responses ----------

export type LabOrderActionResponse = {
  success: boolean;
  message: string;
  lab_order: LabOrder;
};

// ---------- Helpers ----------

/** Defensive normaliser: backend doc shows `items: "string"` but it's an array. */
export function asLabOrderItemArray(value: LabOrderItem[] | string | undefined): LabOrderItem[] {
  return Array.isArray(value) ? value : [];
}

// ---------- Endpoints ----------

export async function listLabOrdersForVisit(
  visitId: number,
): Promise<PaginatedResponse<LabOrder>> {
  const response = await apiClient.get<PaginatedResponse<LabOrder>>(
    `/lab/orders/visits/${visitId}`,
  );
  return response.data;
}

export async function listLabWorklist(
  params: { skip?: number; limit?: number; status?: string } = {},
): Promise<PaginatedResponse<LabOrder>> {
  const { skip = 0, limit = 50, status } = params;
  const response = await apiClient.get<PaginatedResponse<LabOrder>>("/lab/orders/worklist", {
    params: { skip, limit, status },
  });
  return response.data;
}

export async function getLabOrder(orderId: number): Promise<LabOrder> {
  const response = await apiClient.get<LabOrder>(`/lab/orders/${orderId}`);
  return response.data;
}

export async function createLabOrder(
  payload: CreateLabOrderPayload,
): Promise<LabOrderActionResponse> {
  const response = await apiClient.post<LabOrderActionResponse>("/lab/orders/", payload);
  return response.data;
}

export async function collectSpecimen(
  itemId: number,
  payload: CollectSpecimenPayload,
): Promise<LabOrderActionResponse> {
  const response = await apiClient.post<LabOrderActionResponse>(
    `/lab/orders/items/${itemId}/collect-specimen`,
    payload,
  );
  return response.data;
}

export async function startProcessing(
  itemId: number,
): Promise<LabOrderActionResponse> {
  const response = await apiClient.post<LabOrderActionResponse>(
    `/lab/orders/items/${itemId}/start-processing`,
  );
  return response.data;
}

export async function cancelLabOrderItem(
  itemId: number,
  payload: CancelReasonPayload,
): Promise<LabOrderActionResponse> {
  const response = await apiClient.post<LabOrderActionResponse>(
    `/lab/orders/items/${itemId}/cancel`,
    payload,
  );
  return response.data;
}

export async function cancelLabOrder(
  orderId: number,
  payload: CancelReasonPayload,
): Promise<LabOrderActionResponse> {
  const response = await apiClient.post<LabOrderActionResponse>(
    `/lab/orders/${orderId}/cancel`,
    payload,
  );
  return response.data;
}
