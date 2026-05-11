import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

export type Staff = {
  id: number;
  user_id: number;
  staff_number: string;
  designation: string;
  department: string;
  status: string;
  /** Some endpoints embed the user object; others put names at the root.
   *  Both shapes are supported by the helpers below. */
  user?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    middle_name?: string;
    phone_number?: string;
  };
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
};

// ---------- Display helpers ----------

/** Best-effort first name lookup that tolerates both record shapes. */
export function staffFirstName(s: Staff): string {
  return s.user?.first_name ?? s.first_name ?? "";
}

/** Best-effort last name lookup that tolerates both record shapes. */
export function staffLastName(s: Staff): string {
  return s.user?.last_name ?? s.last_name ?? "";
}

/** Build a display name with sensible fallbacks (staff number, then ID). */
export function staffDisplayName(s: Staff): string {
  const full = `${staffFirstName(s)} ${staffLastName(s)}`.trim();
  if (full) return full;
  if (s.staff_number) return s.staff_number;
  return `Staff #${s.id}`;
}

/** Initials for an avatar — never throws on missing fields. */
export function staffInitials(s: Staff): string {
  const first = staffFirstName(s);
  const last = staffLastName(s);
  if (first || last) {
    return `${first.charAt(0) || "?"}${last.charAt(0) || "?"}`.toUpperCase();
  }
  if (s.staff_number) return s.staff_number.slice(0, 2).toUpperCase();
  return "??";
}

export function staffEmail(s: Staff): string {
  return s.user?.email ?? s.email ?? "";
}

export type CreateStaffPayload = {
  user_id?: number;
  staff_number?: string;
  designation: string;
  department: string;
  status?: string;
  // Allow extra fields the backend may accept (e.g. profile sub-form).
  [key: string]: unknown;
};

export type StaffActionResponse = {
  success: boolean;
  message: string;
  staff: Staff;
};

/**
 * List staff members.
 *
 * Returns a plain `Staff[]` for ergonomic call-sites. The backend wraps the
 * payload in the standard pagination envelope `{ items, count, meta, ... }`,
 * so we unwrap it here. If the endpoint ever returns a bare array (older API
 * shapes), we accept that too.
 */
export async function getStaff(skip = 0, limit = 200): Promise<Staff[]> {
  const response = await apiClient.get<PaginatedResponse<Staff> | Staff[]>("/staff/", {
    params: { skip, limit },
  });
  const data = response.data as any;
  if (Array.isArray(data)) return data as Staff[];
  if (Array.isArray(data?.items)) return data.items as Staff[];
  return [];
}

/**
 * Listing variant that preserves the full paginated envelope (count + meta)
 * for pages that need pagination controls.
 */
export async function listStaff(
  params: { skip?: number; limit?: number } = {},
): Promise<PaginatedResponse<Staff>> {
  const { skip = 0, limit = 50 } = params;
  const response = await apiClient.get<PaginatedResponse<Staff>>("/staff/", {
    params: { skip, limit },
  });
  return response.data;
}

export async function createStaff(payload: CreateStaffPayload): Promise<Staff> {
  const response = await apiClient.post<StaffActionResponse | Staff>("/staff/", payload);
  const data = response.data as any;
  // Some endpoints return `{ success, staff }`, others the raw entity.
  return (data?.staff ?? data) as Staff;
}
