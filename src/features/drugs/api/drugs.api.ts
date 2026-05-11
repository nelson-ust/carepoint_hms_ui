import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

// ---------- Types ----------

export type DrugCategory = {
  id: number;
  name: string;
  code: string;
  description?: string;
  created_at: string;
  updated_at: string;
};

export type Drug = {
  id: number;
  name: string;
  generic_name?: string;
  brand_name?: string;
  strength?: string;
  dosage_form?: string;
  pack_size?: string;
  sku?: string;
  drug_category_id?: number;
  unit_price?: number;
  reorder_level?: number;
  is_controlled: boolean;
  created_at: string;
  updated_at: string;
  category?: DrugCategory;
};

export const DOSAGE_FORMS = [
  "Tablet",
  "Capsule",
  "Syrup",
  "Suspension",
  "Injection",
  "Cream",
  "Ointment",
  "Drops",
  "Inhaler",
  "Patch",
  "Powder",
  "Other",
] as const;

// ---------- Payloads ----------

export type CreateDrugCategoryPayload = {
  name: string;
  code: string;
  description?: string;
};

export type UpdateDrugCategoryPayload = Partial<CreateDrugCategoryPayload>;

export type CreateDrugPayload = {
  name: string;
  generic_name?: string;
  brand_name?: string;
  strength?: string;
  dosage_form?: string;
  pack_size?: string;
  sku?: string;
  drug_category_id?: number;
  unit_price?: number;
  reorder_level?: number;
  is_controlled?: boolean;
};

export type UpdateDrugPayload = Partial<CreateDrugPayload>;

// ---------- Responses ----------

export type DrugCategoryActionResponse = {
  success: boolean;
  message: string;
  category: DrugCategory;
};

export type DrugActionResponse = {
  success: boolean;
  message: string;
  drug: Drug;
};

// ---------- Categories ----------

export async function listDrugCategories(
  params: { skip?: number; limit?: number } = {},
): Promise<PaginatedResponse<DrugCategory>> {
  const { skip = 0, limit = 200 } = params;
  const response = await apiClient.get<PaginatedResponse<DrugCategory>>("/drugs/categories", {
    params: { skip, limit },
  });
  return response.data;
}

export async function createDrugCategory(
  payload: CreateDrugCategoryPayload,
): Promise<DrugCategoryActionResponse> {
  const response = await apiClient.post<DrugCategoryActionResponse>(
    "/drugs/categories",
    payload,
  );
  return response.data;
}

export async function updateDrugCategory(
  catId: number,
  payload: UpdateDrugCategoryPayload,
): Promise<DrugCategoryActionResponse> {
  const response = await apiClient.put<DrugCategoryActionResponse>(
    `/drugs/categories/${catId}`,
    payload,
  );
  return response.data;
}

export async function deleteDrugCategory(
  catId: number,
): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.delete<{ success: boolean; message: string }>(
    `/drugs/categories/${catId}`,
  );
  return response.data;
}

// ---------- Drugs ----------

export async function listDrugs(
  params: { skip?: number; limit?: number } = {},
): Promise<PaginatedResponse<Drug>> {
  const { skip = 0, limit = 500 } = params;
  const response = await apiClient.get<PaginatedResponse<Drug>>("/drugs/", {
    params: { skip, limit },
  });
  return response.data;
}

export async function getDrug(drugId: number): Promise<Drug> {
  const response = await apiClient.get<Drug>(`/drugs/${drugId}`);
  return response.data;
}

export async function createDrug(payload: CreateDrugPayload): Promise<DrugActionResponse> {
  const response = await apiClient.post<DrugActionResponse>("/drugs/", payload);
  return response.data;
}

export async function updateDrug(
  drugId: number,
  payload: UpdateDrugPayload,
): Promise<DrugActionResponse> {
  const response = await apiClient.put<DrugActionResponse>(`/drugs/${drugId}`, payload);
  return response.data;
}

export async function deleteDrug(
  drugId: number,
): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.delete<{ success: boolean; message: string }>(
    `/drugs/${drugId}`,
  );
  return response.data;
}
