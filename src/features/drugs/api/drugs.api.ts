import { apiClient } from "@/lib/api/api-client";
import { hydrateBlobError } from "@/lib/api/api-error";
import { fetchAllPaged } from "@/lib/api/paginate";
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
  return fetchAllPaged<DrugCategory>(apiClient, "/drugs/categories", {
    skip: params.skip,
    limit: params.limit ?? 200,
    defaultMessage: "Categories fetched successfully.",
  });
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
  return fetchAllPaged<Drug>(apiClient, "/drugs/", {
    skip: params.skip,
    limit: params.limit ?? 500,
    defaultMessage: "Drugs fetched successfully.",
  });
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


// ---------- Bulk upload ----------

export type BulkUploadRowError = { row?: number | null; message: string };

export type BulkDrugUploadResult = {
  success: boolean;
  message: string;
  total_rows: number;
  created: number;
  failed: number;
  errors: BulkUploadRowError[];
};

/** Download the .xlsx drug bulk-upload template. */
export async function downloadDrugTemplate(): Promise<void> {
  let response;
  try {
    response = await apiClient.get("/drugs/template", { responseType: "blob" });
  } catch (err) {
    // A blob request hides the server's JSON error — surface the real reason.
    throw await hydrateBlobError(err);
  }
  const blob = response.data as Blob;
  // Defensive: some setups return a JSON error body with a 2xx status.
  if (blob.type && blob.type.includes("application/json")) {
    let parsed: any = undefined;
    try {
      parsed = JSON.parse(await blob.text());
    } catch {
      /* ignore */
    }
    throw { response: { data: parsed } };
  }
  triggerBrowserDownload(blob, "drugs_template.xlsx");
}

/** Trigger a browser download for a Blob. */
function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Upload a filled drug template. */
export async function bulkUploadDrugs(file: File): Promise<BulkDrugUploadResult> {
  const form = new FormData();
  form.append("file", file);
  const response = await apiClient.post<BulkDrugUploadResult>(
    "/drugs/bulk-upload",
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data;
}

/** Download the .xlsx drug-category bulk-upload template. */
export async function downloadDrugCategoryTemplate(): Promise<void> {
  let response;
  try {
    response = await apiClient.get("/drugs/categories/template", { responseType: "blob" });
  } catch (err) {
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
  triggerBrowserDownload(blob, "drug_categories_template.xlsx");
}

/** Upload a filled drug-category template. */
export async function bulkUploadDrugCategories(file: File): Promise<BulkDrugUploadResult> {
  const form = new FormData();
  form.append("file", file);
  const response = await apiClient.post<BulkDrugUploadResult>(
    "/drugs/categories/bulk-upload",
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data;
}
