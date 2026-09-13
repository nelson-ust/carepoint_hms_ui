import { apiClient } from "@/lib/api/api-client";
import { hydrateBlobError } from "@/lib/api/api-error";
import { fetchAllPaged } from "@/lib/api/paginate";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";
import type { Drug } from "@/features/drugs/api/drugs.api";

// ---------- Types ----------

export type Store = {
  id: number;
  name: string;
  code: string;
  location_description?: string;
  description?: string;
  created_at: string;
  updated_at: string;
};

// Must match the backend InventoryItemType enum / create-schema validator.
export const STOCK_ITEM_TYPES = [
  "DRUG",
  "CONSUMABLE",
  "EQUIPMENT",
  "SUPPLY",
  "OTHER",
] as const;

export type StockItem = {
  id: number;
  store_id: number;
  drug_id?: number;
  item_type: string;
  item_name: string;
  sku?: string;
  unit_of_measure?: string;
  quantity_on_hand: number;
  reorder_level?: number;
  effective_reorder_level?: number;
  unit_cost?: number;
  expiry_date?: string;
  batch_no?: string;
  created_at: string;
  updated_at: string;
  store?: Store;
  drug?: Drug;
};

export const MOVEMENT_TYPES = [
  "RECEIPT",
  "ISSUE",
  "ADJUSTMENT",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "RETURN",
  "WASTAGE",
] as const;

export type StockMovement = {
  id: number;
  store_id: number;
  stock_item_id: number;
  performed_by_staff_id?: number;
  movement_type: string;
  reference_no?: string;
  quantity: number;
  balance_after: number;
  movement_date?: string;
  note?: string;
  created_at: string;
  stock_item?: StockItem;
  store?: Store;
};

// ---------- Payloads ----------

export type CreateStorePayload = {
  name: string;
  code: string;
  location_description?: string;
  description?: string;
};

export type UpdateStorePayload = {
  name?: string;
  location_description?: string;
  description?: string;
};

export type CreateStockItemPayload = {
  store_id: number;
  drug_id?: number;
  item_type: string;
  item_name: string;
  sku?: string;
  unit_of_measure?: string;
  quantity_on_hand: number;
  reorder_level?: number;
  unit_cost?: number;
  expiry_date?: string;
  batch_no?: string;
};

export type UpdateStockItemPayload = {
  item_name?: string;
  sku?: string;
  unit_of_measure?: string;
  reorder_level?: number;
  unit_cost?: number;
  expiry_date?: string;
  batch_no?: string;
};

export type RecordMovementPayload = {
  store_id: number;
  stock_item_id: number;
  movement_type: string;
  quantity: number;
  reference_no?: string;
  note?: string;
  performed_by_staff_id?: number;
};

// ---------- Responses ----------

export type StoreActionResponse = {
  success: boolean;
  message: string;
  store: Store;
};

export type StockItemActionResponse = {
  success: boolean;
  message: string;
  stock_item: StockItem;
};

export type MovementActionResponse = {
  success: boolean;
  message: string;
  movement: StockMovement;
};

// ---------- Normalization helpers ----------

/** The backend serializes Decimal columns (quantities, costs) as strings — coerce to numbers. */
function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  return toNumber(value);
}

function normalizeStockItem(raw: StockItem): StockItem {
  return {
    ...raw,
    quantity_on_hand: toNumber(raw.quantity_on_hand),
    reorder_level: toOptionalNumber(raw.reorder_level),
    unit_cost: toOptionalNumber(raw.unit_cost),
  };
}

function normalizeMovement(raw: StockMovement): StockMovement {
  return {
    ...raw,
    quantity: toNumber(raw.quantity),
    balance_after: toNumber(raw.balance_after),
    stock_item: raw.stock_item ? normalizeStockItem(raw.stock_item) : raw.stock_item,
  };
}

// ---------- Stores ----------

export async function listStores(
  params: { skip?: number; limit?: number } = {},
): Promise<PaginatedResponse<Store>> {
  // Paged in backend-safe chunks so the list loads regardless of the live
  // backend's limit cap. See lib/api/paginate.ts.
  return fetchAllPaged<Store>(apiClient, "/inventory/stores", {
    skip: params.skip,
    limit: params.limit ?? 200,
    defaultMessage: "Stores fetched successfully.",
  });
}

export async function getStore(storeId: number): Promise<Store> {
  const response = await apiClient.get<Store>(`/inventory/stores/${storeId}`);
  return response.data;
}

export async function createStore(payload: CreateStorePayload): Promise<StoreActionResponse> {
  const response = await apiClient.post<StoreActionResponse>("/inventory/stores", payload);
  return response.data;
}

export async function updateStore(
  storeId: number,
  payload: UpdateStorePayload,
): Promise<StoreActionResponse> {
  const response = await apiClient.put<StoreActionResponse>(
    `/inventory/stores/${storeId}`,
    payload,
  );
  return response.data;
}

export async function deleteStore(
  storeId: number,
): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.delete<{ success: boolean; message: string }>(
    `/inventory/stores/${storeId}`,
  );
  return response.data;
}

// ---------- Stock Items ----------

export async function listStockItems(
  params: {
    skip?: number;
    limit?: number;
    store_id?: number;
    drug_id?: number;
    item_type?: string;
    only_low_stock?: boolean;
    search?: string;
  } = {},
): Promise<PaginatedResponse<StockItem>> {
  const { skip, limit = 500, store_id, drug_id, item_type, only_low_stock, search } = params;
  return fetchAllPaged<StockItem>(apiClient, "/inventory/items", {
    skip,
    limit,
    params: { store_id, drug_id, item_type, only_low_stock, search },
    mapItem: normalizeStockItem,
    defaultMessage: "Stock items fetched successfully.",
  });
}

export async function getStockItem(itemId: number): Promise<StockItem> {
  const response = await apiClient.get<StockItem>(`/inventory/items/${itemId}`);
  return normalizeStockItem(response.data);
}

// ---------- Bulk import ----------

export type BulkUploadRowError = { row?: number | null; message: string };

export type BulkUploadResult = {
  success: boolean;
  message: string;
  total_rows: number;
  created: number;
  failed: number;
  errors: BulkUploadRowError[];
};

/** Download the pre-populated .xlsx template and trigger a browser save. */
export async function downloadStockItemTemplate(): Promise<void> {
  let response;
  try {
    response = await apiClient.get("/inventory/items/template", {
      responseType: "blob",
    });
  } catch (err) {
    // A blob request hides the server's JSON error — surface the real reason.
    throw await hydrateBlobError(err);
  }
  const blob = response.data as Blob;
  if (blob.type && blob.type.includes("application/json")) {
    let parsed: any = undefined;
    try {
      parsed = JSON.parse(await blob.text());
    } catch {
      /* ignore */
    }
    throw { response: { data: parsed } };
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "stock_items_template.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Upload a filled template; returns a per-row import summary. */
export async function bulkUploadStockItems(file: File): Promise<BulkUploadResult> {
  const form = new FormData();
  form.append("file", file);
  const response = await apiClient.post<BulkUploadResult>(
    "/inventory/items/bulk-upload",
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data;
}

export async function createStockItem(
  payload: CreateStockItemPayload,
): Promise<StockItemActionResponse> {
  const response = await apiClient.post<StockItemActionResponse>("/inventory/items", payload);
  return response.data;
}

export async function updateStockItem(
  itemId: number,
  payload: UpdateStockItemPayload,
): Promise<StockItemActionResponse> {
  const response = await apiClient.put<StockItemActionResponse>(
    `/inventory/items/${itemId}`,
    payload,
  );
  return response.data;
}

export async function deleteStockItem(
  itemId: number,
): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.delete<{ success: boolean; message: string }>(
    `/inventory/items/${itemId}`,
  );
  return response.data;
}

// ---------- Inventory Movements (per inventory_routes.py) ----------

export async function listInventoryMovements(
  params: {
    skip?: number;
    limit?: number;
    store_id?: number;
    stock_item_id?: number;
    movement_type?: string;
  } = {},
): Promise<PaginatedResponse<StockMovement>> {
  const { skip, limit = 200, store_id, stock_item_id, movement_type } = params;
  return fetchAllPaged<StockMovement>(apiClient, "/inventory/movements", {
    skip,
    limit,
    params: { store_id, stock_item_id, movement_type },
    mapItem: normalizeMovement,
    defaultMessage: "Movements fetched successfully.",
  });
}

export async function recordInventoryMovement(
  payload: RecordMovementPayload,
): Promise<MovementActionResponse> {
  const response = await apiClient.post<MovementActionResponse>(
    "/inventory/movements",
    payload,
  );
  return response.data;
}

export async function getInventoryMovement(movementId: number): Promise<StockMovement> {
  const response = await apiClient.get<StockMovement>(`/inventory/movements/${movementId}`);
  return normalizeMovement(response.data);
}
