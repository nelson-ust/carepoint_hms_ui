import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";
import type { Ward } from "./wards.api";

// ---------- Types ----------

export type Bed = {
  id: number;
  ward_id: number;
  bed_no: string;
  bed_status: string;
  bed_type?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  ward?: Ward;
};

/** Detailed bed response from /beds/{id}/summary */
export type BedSummary = Bed & {
  ward?: Ward;
  admission_count: number;
  has_active_admission: boolean;
};

export const BED_STATUSES = [
  "AVAILABLE",
  "OCCUPIED",
  "RESERVED",
  "OUT_OF_SERVICE",
  "MAINTENANCE",
  "CLEANING",
] as const;

export const BED_TYPES = [
  "STANDARD",
  "SEMI_PRIVATE",
  "PRIVATE",
  "ICU",
  "BASSINETTE",
  "PEDIATRIC",
  "ISOLATION",
  "OTHER",
] as const;

// ---------- Payloads ----------

export type CreateBedPayload = {
  ward_id: number;
  bed_no: string;
  bed_status?: string;
  bed_type?: string;
  notes?: string;
};

export type UpdateBedPayload = Partial<CreateBedPayload>;

// ---------- Endpoints ----------

export async function listBeds(
  params: {
    skip?: number;
    limit?: number;
    ward_id?: number;
    bed_status?: string;
  } = {},
): Promise<PaginatedResponse<Bed>> {
  const { skip = 0, limit = 500, ward_id, bed_status } = params;
  const response = await apiClient.get<PaginatedResponse<Bed>>("/beds/", {
    params: { skip, limit, ward_id, bed_status },
  });
  return response.data;
}

export async function getBed(bedId: number): Promise<Bed> {
  const response = await apiClient.get<Bed>(`/beds/${bedId}`);
  return response.data;
}

export async function getBedSummary(bedId: number): Promise<BedSummary> {
  const response = await apiClient.get<BedSummary>(`/beds/${bedId}/summary`);
  return response.data;
}

export async function createBed(payload: CreateBedPayload): Promise<Bed> {
  const response = await apiClient.post<Bed>("/beds/", payload);
  return response.data;
}

export async function updateBed(bedId: number, payload: UpdateBedPayload): Promise<Bed> {
  const response = await apiClient.put<Bed>(`/beds/${bedId}`, payload);
  return response.data;
}

export async function deleteBed(
  bedId: number,
): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.delete<{ success: boolean; message: string }>(
    `/beds/${bedId}`,
  );
  return response.data;
}
