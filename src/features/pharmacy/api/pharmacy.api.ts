import { apiClient } from "@/lib/api/api-client";
import type { Prescription } from "@/features/prescriptions/api/prescriptions.api";
import type { StockItem } from "@/features/inventory/api/inventory.api";

export type PharmacyWorklistRow = {
  prescription?: Prescription;
  /** Optional fields the backend may include with each worklist row */
  patient_name?: string;
  hospital_number?: string;
  visit_code?: string;
  prescription_no?: string;
  status?: string;
  prescribed_at?: string;
  total_items?: number;
};

export type PharmacyWorklist = {
  success: boolean;
  message: string;
  items: PharmacyWorklistRow[] | Prescription[] | string;
  count: number;
  meta: Record<string, any> | string;
};

export type StockAlert = {
  stock_item_id: number;
  stock_item?: StockItem;
  alert_type: string; // LOW_STOCK, EXPIRING, EXPIRED, OUT_OF_STOCK
  quantity_on_hand?: number;
  reorder_level?: number;
  expiry_date?: string;
  days_to_expiry?: number;
  store_id?: number;
  store_name?: string;
};

export type StockAlertsResponse = {
  success: boolean;
  message: string;
  items: StockAlert[] | string;
  count: number;
};

export async function getPharmacyWorklist(): Promise<PharmacyWorklist> {
  const response = await apiClient.get<PharmacyWorklist>("/pharmacy/worklist");
  return response.data;
}

export async function getPharmacyStockAlerts(): Promise<StockAlertsResponse> {
  const response = await apiClient.get<StockAlertsResponse>("/pharmacy/stock-alerts");
  return response.data;
}

// ---------- Helpers ----------

export function asPrescriptionFromWorklist(value: unknown): Prescription | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  if (obj.prescription && typeof obj.prescription === "object") {
    return obj.prescription as Prescription;
  }
  if (typeof obj.id === "number") return obj as unknown as Prescription;
  return null;
}

export function asStockAlertArray(value: unknown): StockAlert[] {
  return Array.isArray(value) ? (value as StockAlert[]) : [];
}
