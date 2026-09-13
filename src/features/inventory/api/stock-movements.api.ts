import { apiClient } from "@/lib/api/api-client";
import { fetchAllPaged } from "@/lib/api/paginate";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";
import type {
  MovementActionResponse,
  RecordMovementPayload,
  StockMovement,
} from "./inventory.api";

// Re-export the shared types for convenience
export type { StockMovement, RecordMovementPayload, MovementActionResponse };

export type TransferStockPayload = {
  from_stock_item_id: number;
  to_store_id: number;
  quantity: number;
  note?: string;
  performed_by_staff_id?: number;
};

export async function listStockMovements(
  params: { skip?: number; limit?: number; store_id?: number; movement_type?: string } = {},
): Promise<PaginatedResponse<StockMovement>> {
  const { skip, limit = 200, store_id, movement_type } = params;
  return fetchAllPaged<StockMovement>(apiClient, "/stock-movements/", {
    skip,
    limit,
    params: { store_id, movement_type },
    defaultMessage: "Movements fetched successfully.",
  });
}

export async function postStockMovement(
  payload: RecordMovementPayload,
): Promise<MovementActionResponse> {
  const response = await apiClient.post<MovementActionResponse>("/stock-movements/", payload);
  return response.data;
}

export async function transferStock(
  payload: TransferStockPayload,
): Promise<MovementActionResponse> {
  const response = await apiClient.post<MovementActionResponse>(
    "/stock-movements/transfer",
    payload,
  );
  return response.data;
}

export async function getStockMovement(movementId: number): Promise<StockMovement> {
  const response = await apiClient.get<StockMovement>(`/stock-movements/${movementId}`);
  return response.data;
}
