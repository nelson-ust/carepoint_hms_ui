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

// ===========================================================================
// Retail / OTC point-of-sale (standalone pharmaceutical store)
// ===========================================================================

export const SALE_PAYMENT_METHODS = [
  "CASH",
  "CARD",
  "POS",
  "BANK_TRANSFER",
  "MOBILE_MONEY",
  "WALLET",
] as const;

export type SaleItem = {
  id: number;
  stock_item_id: number;
  item_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type Sale = {
  id: number;
  sale_no: string;
  store_id: number;
  patient_id?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  sold_by_staff_id?: number | null;
  status: string; // COMPLETED | VOIDED
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  outstanding?: number;
  change_due: number;
  payment_method: string;
  note?: string | null;
  sold_at?: string | null;
  voided_at?: string | null;
  void_reason?: string | null;
  items: SaleItem[];
};

export type SaleLinePayload = {
  stock_item_id: number;
  quantity: number;
  unit_price?: number;
};

export type CreateSalePayload = {
  store_id: number;
  items: SaleLinePayload[];
  patient_id?: number;
  customer_name?: string;
  customer_phone?: string;
  sold_by_staff_id?: number;
  payment_method?: string;
  discount_amount?: number;
  tax_amount?: number;
  amount_paid?: number;
  on_account?: boolean;
  note?: string;
};

export type SaleActionResponse = {
  success: boolean;
  message: string;
  sale: Sale;
};

export type SalesListResponse = {
  success: boolean;
  items: Sale[];
  count: number;
  meta: { total: number; skip: number; limit: number } | Record<string, unknown>;
};

export type SalesSummary = {
  success: boolean;
  sales_today: number;
  revenue_today: number;
  items_sold_today: number;
  by_method: Record<string, number>;
};

/** The backend serializes Decimal columns as strings — coerce to numbers. */
function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalizeSale(raw: Sale): Sale {
  return {
    ...raw,
    subtotal: toNumber(raw.subtotal),
    discount_amount: toNumber(raw.discount_amount),
    tax_amount: toNumber(raw.tax_amount),
    total_amount: toNumber(raw.total_amount),
    amount_paid: toNumber(raw.amount_paid),
    change_due: toNumber(raw.change_due),
    items: Array.isArray(raw.items)
      ? raw.items.map((it) => ({
          ...it,
          quantity: toNumber(it.quantity),
          unit_price: toNumber(it.unit_price),
          line_total: toNumber(it.line_total),
        }))
      : [],
  };
}

export async function createSale(payload: CreateSalePayload): Promise<SaleActionResponse> {
  const response = await apiClient.post<SaleActionResponse>("/pharmacy/sales", payload);
  return { ...response.data, sale: normalizeSale(response.data.sale) };
}

export async function listSales(
  params: {
    skip?: number;
    limit?: number;
    store_id?: number;
    status?: string;
    date_from?: string;
    date_to?: string;
  } = {},
): Promise<SalesListResponse> {
  const response = await apiClient.get<SalesListResponse>("/pharmacy/sales", { params });
  const items = Array.isArray(response.data.items)
    ? response.data.items.map(normalizeSale)
    : [];
  return { ...response.data, items };
}

export async function getSale(saleId: number): Promise<Sale> {
  const response = await apiClient.get<{ success: boolean; sale: Sale }>(`/pharmacy/sales/${saleId}`);
  return normalizeSale(response.data.sale);
}

export async function getSalesSummary(storeId?: number): Promise<SalesSummary> {
  const response = await apiClient.get<SalesSummary>("/pharmacy/sales/summary", {
    params: storeId ? { store_id: storeId } : {},
  });
  return response.data;
}

export async function voidSale(
  saleId: number,
  payload: { reason?: string; staff_id?: number } = {},
): Promise<SaleActionResponse> {
  const response = await apiClient.post<SaleActionResponse>(`/pharmacy/sales/${saleId}/void`, payload);
  return { ...response.data, sale: normalizeSale(response.data.sale) };
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

// ---- Pharmacy store dashboard ----
export type PharmacyStorePeriod = { sales: number; revenue: number; cogs: number; margin: number };
export type PharmacyStoreDashboard = {
  today: PharmacyStorePeriod;
  week: PharmacyStorePeriod;
  payment_mix: Record<string, number>;
  top_sellers: { item_name: string; quantity: number; revenue: number }[];
  low_stock: { item_name: string; quantity_on_hand: number; reorder_level: number }[];
  low_stock_count: number;
  expiring_soon: { item_name: string; expiry_date: string; quantity_on_hand: number }[];
  expiring_count: number;
  inventory_value: number;
  stock_item_count: number;
};

export const getPharmacyStoreDashboard = (storeId?: number) =>
  apiClient
    .get<PharmacyStoreDashboard & { success: boolean }>("/pharmacy/store/dashboard", {
      params: storeId ? { store_id: storeId } : {},
    })
    .then((r) => r.data);


// ---- Credit sales (customer accounts) ----
export type CreditOutstanding = {
  id: number;
  sale_no: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  patient_id?: number | null;
  total_amount: number;
  amount_paid: number;
  outstanding: number;
  sold_at?: string | null;
};

export async function settleSale(
  saleId: number,
  payload: { amount: number; payment_method?: string; staff_id?: number },
): Promise<SaleActionResponse> {
  const response = await apiClient.post<SaleActionResponse>(`/pharmacy/sales/${saleId}/settle`, payload);
  return response.data;
}

export async function getOutstandingCredit(storeId?: number): Promise<CreditOutstanding[]> {
  const response = await apiClient.get<{ success: boolean; items: CreditOutstanding[] }>(
    "/pharmacy/credit/outstanding",
    { params: storeId ? { store_id: storeId } : {} },
  );
  return Array.isArray(response.data?.items) ? response.data.items : [];
}
