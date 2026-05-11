import { apiClient } from "@/lib/api/api-client";
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

export const STOCK_ITEM_TYPES = [
  "DRUG",
  "CONSUMABLE",
  "REAGENT",
  "EQUIPMENT",
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

// ---------- Stores ----------

export async function listStores(
  params: { skip?: number; limit?: number } = {},
): Promise<PaginatedResponse<Store>> {
  const { skip = 0, limit = 200 } = params;
  const response = await apiClient.get<PaginatedResponse<Store>>("/inventory/stores", {
    params: { skip, limit },
  });
  return response.data;
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
  params: { skip?: number; limit?: number; store_id?: number } = {},
): Promise<PaginatedResponse<StockItem>> {
  const { skip = 0, limit = 500, store_id } = params;
  const response = await apiClient.get<PaginatedResponse<StockItem>>("/inventory/items", {
    params: { skip, limit, store_id },
  });
  return response.data;
}

export async function getStockItem(itemId: number): Promise<StockItem> {
  const response = await apiClient.get<StockItem>(`/inventory/items/${itemId}`);
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
  params: { skip?: number; limit?: number; store_id?: number } = {},
): Promise<PaginatedResponse<StockMovement>> {
  const { skip = 0, limit = 200, store_id } = params;
  const response = await apiClient.get<PaginatedResponse<StockMovement>>(
    "/inventory/movements",
    { params: { skip, limit, store_id } },
  );
  return response.data;
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
  return response.data;
}
