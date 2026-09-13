import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

// ---------- Types ----------

export type Ward = {
  id: number;
  name: string;
  code: string;
  ward_type?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  /** Optional aggregate fields the backend may include on the list endpoint */
  total_beds?: number;
  available_beds?: number;
  occupied_beds?: number;
  active_admissions?: number;
};

/** Detailed ward response from /wards/{id}/summary */
export type WardSummary = Ward & {
  total_beds: number;
  available_beds: number;
  occupied_beds: number;
  total_admissions: number;
  active_admissions: number;
};

export const WARD_TYPES = [
  "GENERAL",
  "PRIVATE",
  "ICU",
  "MATERNITY",
  "PEDIATRIC",
  "SURGICAL",
  "ISOLATION",
  "OTHER",
] as const;

// ---------- Payloads ----------

export type CreateWardPayload = {
  name: string;
  code: string;
  ward_type?: string;
  description?: string;
};

export type UpdateWardPayload = Partial<CreateWardPayload>;

// ---------- Endpoints (Wards) ----------

/**
 * Largest page size that EVERY backend revision is guaranteed to accept.
 * Older builds capped the `limit` query param at 100, so requesting more
 * returned a 422 and broke the list whenever the server was running stale
 * code. We always fetch in <=100 chunks to stay compatible regardless of
 * which backend revision is live.
 */
const SAFE_PAGE = 100;

export async function listWards(
  params: { skip?: number; limit?: number } = {},
): Promise<PaginatedResponse<Ward>> {
  const startSkip = params.skip ?? 0;
  const desired = params.limit ?? SAFE_PAGE;

  const items: Ward[] = [];
  let skip = startSkip;
  let last: PaginatedResponse<Ward> | null = null;

  // Page through in backend-safe chunks until we've collected everything the
  // caller asked for (or the server runs out of rows). A guard caps the loop
  // so a malformed `meta` can never spin forever.
  for (let guard = 0; guard < 200; guard += 1) {
    const pageSize = Math.min(SAFE_PAGE, desired - items.length);
    if (pageSize <= 0) break;

    const response = await apiClient.get<PaginatedResponse<Ward>>("/wards/", {
      params: { skip, limit: pageSize },
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
    message: last?.message ?? "Wards fetched successfully.",
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

export async function getWard(wardId: number): Promise<Ward> {
  const response = await apiClient.get<Ward>(`/wards/${wardId}`);
  return response.data;
}

export async function getWardSummary(wardId: number): Promise<WardSummary> {
  const response = await apiClient.get<WardSummary>(`/wards/${wardId}/summary`);
  return response.data;
}

export async function createWard(payload: CreateWardPayload): Promise<Ward> {
  const response = await apiClient.post<Ward>("/wards/", payload);
  return response.data;
}

export async function updateWard(
  wardId: number,
  payload: UpdateWardPayload,
): Promise<Ward> {
  const response = await apiClient.put<Ward>(`/wards/${wardId}`, payload);
  return response.data;
}

export async function deleteWard(
  wardId: number,
): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.delete<{ success: boolean; message: string }>(
    `/wards/${wardId}`,
  );
  return response.data;
}

