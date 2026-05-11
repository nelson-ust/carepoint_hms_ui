import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";
import type { Drug } from "@/features/drugs/api/drugs.api";

export const DISPENSE_STATUSES = [
  "PENDING",
  "PARTIALLY_DISPENSED",
  "DISPENSED",
  "CANCELLED",
] as const;

export type DispenseItem = {
  id: number;
  dispense_id: number;
  prescription_item_id?: number;
  drug_id?: number;
  stock_item_id?: number;
  quantity_dispensed: number;
  unit_price?: number;
  drug?: Drug;
  created_at: string;
};

export type Dispense = {
  id: number;
  prescription_id: number;
  dispensed_by_staff_id?: number;
  dispense_no: string;
  status: string;
  dispensed_at?: string;
  note?: string;
  items: DispenseItem[] | string;
  created_at: string;
  updated_at: string;
};

export function asDispenseItemArray(
  value: DispenseItem[] | string | undefined,
): DispenseItem[] {
  return Array.isArray(value) ? value : [];
}

// ---------- Payloads ----------

export type CreateDispenseItemPayload = {
  prescription_item_id?: number;
  drug_id?: number;
  stock_item_id?: number;
  quantity_dispensed: number;
  unit_price?: number;
};

export type CreateDispensePayload = {
  prescription_id: number;
  dispensed_by_staff_id?: number;
  note?: string;
  items: CreateDispenseItemPayload[];
  store_id?: number;
};

// ---------- Responses ----------

export type DispenseActionResponse = {
  success: boolean;
  message: string;
  dispense: Dispense;
};

// ---------- Endpoints ----------

export async function createDispense(
  payload: CreateDispensePayload,
): Promise<DispenseActionResponse> {
  const response = await apiClient.post<DispenseActionResponse>("/dispenses/", payload);
  return response.data;
}

export async function listDispensesForVisit(
  visitId: number,
): Promise<PaginatedResponse<Dispense>> {
  const response = await apiClient.get<PaginatedResponse<Dispense>>(
    `/dispenses/visits/${visitId}`,
  );
  return response.data;
}

export async function listDispensesForPrescription(
  prescriptionId: number,
): Promise<PaginatedResponse<Dispense>> {
  const response = await apiClient.get<PaginatedResponse<Dispense>>(
    `/dispenses/prescriptions/${prescriptionId}`,
  );
  return response.data;
}

export async function getDispense(dispenseId: number): Promise<Dispense> {
  const response = await apiClient.get<Dispense>(`/dispenses/${dispenseId}`);
  return response.data;
}
