import { apiClient } from "@/lib/api/api-client";
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
  const { skip = 0, limit = 200, store_id, movement_type } = params;
  const response = await apiClient.get<PaginatedResponse<StockMovement>>("/stock-movements/", {
    params: { skip, limit, store_id, movement_type },
  });
  return response.data;
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
