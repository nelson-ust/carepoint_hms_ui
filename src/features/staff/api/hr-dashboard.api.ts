import { apiClient } from "@/lib/api/api-client";

// =====================================================================
// HR dashboard aggregates (hr_routes.py — /hr/reports/headcount)
// =====================================================================

export type HeadcountRow = {
  department_id: number | null;
  facility_id: number | null;
  employment_status: string;
  count: number;
};

/** Accept a bare array or the `{ items: [...] }` envelope. */
function asArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const items = (data as { items?: unknown })?.items;
  if (Array.isArray(items)) return items as T[];
  return [];
}

/** Headcount grouped by department / facility / employment status. */
export async function getHeadcountReport(): Promise<HeadcountRow[]> {
  const response = await apiClient.get<unknown>("/hr/reports/headcount");
  return asArray<HeadcountRow>(response.data);
}
