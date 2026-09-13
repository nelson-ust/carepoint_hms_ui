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
  created_at?: string;
  updated_at?: string;
  ward?: Ward;
  /** Flat ward context the list endpoint returns per row. */
  ward_name?: string;
  ward_code?: string;
  /** Admission summary the list endpoint includes per row. */
  admission_count?: number;
  has_active_admission?: boolean;
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

/**
 * Largest page size EVERY backend revision is guaranteed to accept. Older
 * builds capped the `limit` query param at 100; requesting more returned a
 * 422 and broke the page whenever the server ran stale code. We always fetch
 * in <=100 chunks to stay compatible regardless of the live backend revision.
 */
const SAFE_PAGE = 100;

export async function listBeds(
  params: {
    skip?: number;
    limit?: number;
    ward_id?: number;
    bed_status?: string;
  } = {},
): Promise<PaginatedResponse<Bed>> {
  const startSkip = params.skip ?? 0;
  const desired = params.limit ?? SAFE_PAGE;
  const { ward_id, bed_status } = params;

  const items: Bed[] = [];
  let skip = startSkip;
  let last: PaginatedResponse<Bed> | null = null;

  // Page through in backend-safe chunks until we've collected everything the
  // caller asked for (or the server runs out of rows). The filters ride along
  // on every request. A guard caps the loop so malformed `meta` can't spin.
  for (let guard = 0; guard < 200; guard += 1) {
    const pageSize = Math.min(SAFE_PAGE, desired - items.length);
    if (pageSize <= 0) break;

    const response = await apiClient.get<PaginatedResponse<Bed>>("/beds/", {
      params: { skip, limit: pageSize, ward_id, bed_status },
    });
    last = response.data;

    const pageItems = response.data?.items ?? [];
    items.push(...pageItems);

    const total = response.data?.meta?.total;
    const reachedEnd =
      pageItems.length < pageSize ||
      (typeof total === "number" && items.length >= total);
    if (reachedEnd) break;

    skip += pageSize;
  }

  return {
    success: last?.success ?? true,
    message: last?.message ?? "Beds fetched successfully.",
    items,
    count: items.length,
    meta: {
      ...(last?.meta ?? {}),
      total: last?.meta?.total ?? items.length,
      skip: startSkip,
      limit: items.length,
    },
  };
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
