import { apiClient } from "@/lib/api/api-client";
import { formatDistanceToNow } from "date-fns";

// =====================================================================
// Types — mirror app/schemas/staff_profile_schemas.py exactly
// (staff-profiles admin surface, /api/v1 prefix lives in the axios baseURL)
// =====================================================================

export type RoleLite = {
  id: number;
  name: string;
  code: string;
  description?: string | null;
};

export type PermissionLite = {
  id: number;
  name: string;
  code: string;
  module?: string | null;
  description?: string | null;
};

/** StaffProfileReadSchema */
export type StaffProfileRead = {
  id: number;
  user_id: number;
  department_id?: number | null;
  service_delivery_point_ids: number[];
  staff_no: string;
  job_title?: string | null;
  professional_license_no?: string | null;
  specialty?: string | null;
  facility_id?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/** UserReadSchema — full detail returned by GET/POST/PUT /staff-profiles/users/{id} */
export type AdminUser = {
  id: number;
  username: string;
  email: string;
  phone_number?: string | null;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  status: string;
  is_superuser: boolean;
  is_two_factor_enabled: boolean;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  last_login_at?: string | null;
  password_changed_at?: string | null;
  failed_login_attempts?: number;
  locked_until?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  roles: RoleLite[];
  staff_profile?: StaffProfileRead | null;
};

/** UserListItemSchema — lightweight rows from GET /staff-profiles/users */
export type AdminUserListItem = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  is_superuser: boolean;
  is_two_factor_enabled: boolean;
  last_login_at?: string | null;
  role_count: number;
  staff_no?: string | null;
  job_title?: string | null;
  department_id?: number | null;
  department_name?: string | null;
  service_delivery_point_ids: number[];
};

/** build_pagination_meta() output (app/utils/pagination.py) */
export type StaffAdminListMeta = {
  total: number;
  skip: number;
  limit: number;
  current_page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
  next_skip?: number | null;
  previous_skip?: number | null;
};

export type PaginatedUsers = {
  success: boolean;
  message: string;
  items: AdminUserListItem[];
  count: number;
  meta: StaffAdminListMeta;
};

/** UserSessionReadSchema */
export type UserSession = {
  id: number;
  session_token_jti: string;
  refresh_token_jti?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  login_at: string;
  expires_at?: string | null;
  revoked_at?: string | null;
  is_current: boolean;
};

/** UserAccessSummarySchema */
export type UserAccessSummary = {
  user: AdminUser;
  permissions: PermissionLite[];
};

export type ActionResponse = {
  success: boolean;
  message: string;
};

export type Department = {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  is_active?: boolean;
};

// ---------------------------------------------------------------------
// Payloads — mirror the create/update Pydantic schemas
// ---------------------------------------------------------------------

/** StaffProfileCreateSchema — staff_no is required (min 2 chars). */
export type StaffProfileCreatePayload = {
  staff_no: string;
  department_id?: number;
  service_delivery_point_ids?: number[];
  facility_id?: number;
  job_title?: string;
  professional_license_no?: string;
  specialty?: string;
};

/** UserCreateSchema — password + nested staff_profile are required. */
export type UserCreatePayload = {
  username: string;
  email: string;
  phone_number?: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  is_superuser?: boolean;
  is_two_factor_enabled?: boolean;
  is_email_verified?: boolean;
  is_phone_verified?: boolean;
  password: string;
  role_ids?: number[];
  staff_profile: StaffProfileCreatePayload;
};

/** StaffProfileUpdateSchema — everything optional. */
export type StaffProfileUpdatePayload = Partial<StaffProfileCreatePayload>;

/** UserUpdateSchema */
export type UserUpdatePayload = {
  username?: string;
  email?: string;
  phone_number?: string | null;
  first_name?: string;
  last_name?: string;
  middle_name?: string | null;
  is_superuser?: boolean;
  is_two_factor_enabled?: boolean;
  is_email_verified?: boolean;
  is_phone_verified?: boolean;
  status?: string;
  staff_profile?: StaffProfileUpdatePayload;
};

/**
 * PasswordResetSchema — NOTE: the backend does NOT generate/return a temp
 * password; the administrator supplies `new_password`. The UI generates a
 * strong password client-side, submits it, and surfaces it copyably.
 */
export type PasswordResetPayload = {
  new_password: string;
  force_password_change_on_next_login?: boolean;
};

export type ListUsersParams = {
  skip?: number;
  limit?: number;
  search?: string;
  status?: string;
};

// =====================================================================
// Envelope normalization
// =====================================================================

function normalizeUser(data: unknown): AdminUser {
  const record = data as Record<string, unknown>;
  if (record && typeof record === "object") {
    if ("user" in record && record.user && typeof record.user === "object") {
      return record.user as AdminUser;
    }
    if ("data" in record && record.data && typeof record.data === "object") {
      return record.data as AdminUser;
    }
  }
  return record as unknown as AdminUser;
}

function normalizeMeta(meta: unknown, itemCount: number): StaffAdminListMeta {
  const raw = (meta ?? {}) as Record<string, unknown>;
  const limit = typeof raw.limit === "number" && raw.limit > 0 ? raw.limit : 20;
  const skip = typeof raw.skip === "number" ? raw.skip : 0;
  const total = typeof raw.total === "number" ? raw.total : itemCount;
  return {
    total,
    skip,
    limit,
    current_page:
      typeof raw.current_page === "number" ? raw.current_page : Math.floor(skip / limit) + 1,
    page_size: typeof raw.page_size === "number" ? raw.page_size : limit,
    total_pages:
      typeof raw.total_pages === "number" ? raw.total_pages : Math.max(Math.ceil(total / limit), 1),
    has_next: typeof raw.has_next === "boolean" ? raw.has_next : skip + limit < total,
    has_previous: typeof raw.has_previous === "boolean" ? raw.has_previous : skip > 0,
    next_skip: (raw.next_skip as number | null | undefined) ?? null,
    previous_skip: (raw.previous_skip as number | null | undefined) ?? null,
  };
}

function normalizePaginatedUsers(data: unknown): PaginatedUsers {
  const record = data as Record<string, unknown>;
  if (record && typeof record === "object" && Array.isArray(record.items)) {
    const items = record.items as AdminUserListItem[];
    return {
      success: (record.success as boolean) ?? true,
      message: (record.message as string) ?? "",
      items,
      count: (record.count as number) ?? items.length,
      meta: normalizeMeta(record.meta, items.length),
    };
  }
  const items = (Array.isArray(data) ? data : []) as AdminUserListItem[];
  return {
    success: true,
    message: "",
    items,
    count: items.length,
    meta: normalizeMeta(undefined, items.length),
  };
}

// =====================================================================
// User administration — /staff-profiles/users
// =====================================================================

export async function listAdminUsers(params: ListUsersParams = {}): Promise<PaginatedUsers> {
  const { skip = 0, limit = 20, search, status } = params;
  const response = await apiClient.get("/staff-profiles/users", {
    params: {
      skip,
      limit,
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
    },
  });
  return normalizePaginatedUsers(response.data);
}

export async function getAdminUser(userId: number): Promise<AdminUser> {
  const response = await apiClient.get(`/staff-profiles/users/${userId}`);
  return normalizeUser(response.data);
}

export async function createAdminUser(payload: UserCreatePayload): Promise<AdminUser> {
  const response = await apiClient.post("/staff-profiles/users", payload);
  return normalizeUser(response.data);
}

export async function updateAdminUser(
  userId: number,
  payload: UserUpdatePayload,
): Promise<AdminUser> {
  const response = await apiClient.put(`/staff-profiles/users/${userId}`, payload);
  return normalizeUser(response.data);
}

export async function activateUser(userId: number): Promise<AdminUser> {
  const response = await apiClient.post(`/staff-profiles/users/${userId}/activate`);
  return normalizeUser(response.data);
}

export async function deactivateUser(userId: number): Promise<AdminUser> {
  const response = await apiClient.post(`/staff-profiles/users/${userId}/deactivate`);
  return normalizeUser(response.data);
}

// =====================================================================
// Roles — assign / replace / remove
// =====================================================================

export async function assignUserRoles(userId: number, roleIds: number[]): Promise<AdminUser> {
  const response = await apiClient.post(`/staff-profiles/users/${userId}/roles/assign`, {
    role_ids: roleIds,
  });
  return normalizeUser(response.data);
}

export async function replaceUserRoles(userId: number, roleIds: number[]): Promise<AdminUser> {
  const response = await apiClient.put(`/staff-profiles/users/${userId}/roles`, {
    role_ids: roleIds,
  });
  return normalizeUser(response.data);
}

export async function removeUserRoles(userId: number, roleIds: number[]): Promise<AdminUser> {
  // DELETE with a JSON body — axios needs the `data` config key.
  const response = await apiClient.delete(`/staff-profiles/users/${userId}/roles`, {
    data: { role_ids: roleIds },
  });
  return normalizeUser(response.data);
}

// =====================================================================
// Password / MFA
// =====================================================================

export async function resetUserPassword(
  userId: number,
  payload: PasswordResetPayload,
): Promise<AdminUser> {
  const response = await apiClient.post(`/staff-profiles/users/${userId}/password/reset`, {
    new_password: payload.new_password,
    force_password_change_on_next_login: payload.force_password_change_on_next_login ?? true,
  });
  return normalizeUser(response.data);
}

export async function toggleUserMfa(userId: number, enabled: boolean): Promise<AdminUser> {
  const response = await apiClient.post(`/staff-profiles/users/${userId}/mfa`, { enabled });
  return normalizeUser(response.data);
}

// =====================================================================
// Sessions
// =====================================================================

export async function listUserSessions(
  userId: number,
  params: { skip?: number; limit?: number } = {},
): Promise<UserSession[]> {
  const { skip = 0, limit = 20 } = params;
  const response = await apiClient.get(`/staff-profiles/users/${userId}/sessions`, {
    params: { skip, limit },
  });
  const data = response.data as unknown;
  if (Array.isArray(data)) return data as UserSession[];
  const record = data as Record<string, unknown>;
  if (record && Array.isArray(record.items)) return record.items as UserSession[];
  return [];
}

export async function revokeUserSessions(
  userId: number,
  sessionIds: number[],
): Promise<ActionResponse> {
  const response = await apiClient.post(`/staff-profiles/users/${userId}/sessions/revoke`, {
    session_ids: sessionIds,
  });
  const data = response.data as Partial<ActionResponse> | undefined;
  return {
    success: data?.success ?? true,
    message: data?.message ?? "Sessions revoked.",
  };
}

// =====================================================================
// Access summary
// =====================================================================

export async function getUserAccessSummary(userId: number): Promise<UserAccessSummary> {
  const response = await apiClient.get(`/staff-profiles/users/${userId}/access-summary`);
  const record = response.data as Record<string, unknown>;
  return {
    user: normalizeUser(record?.user ?? record),
    permissions: Array.isArray(record?.permissions)
      ? (record.permissions as PermissionLite[])
      : [],
  };
}

// =====================================================================
// Supporting selects — GET /departments (roles & SDPs come from their
// own feature APIs which we import directly in the hooks layer)
// =====================================================================

export async function listDepartments(
  params: { skip?: number; limit?: number } = {},
): Promise<Department[]> {
  const { skip = 0, limit = 100 } = params;
  const response = await apiClient.get("/departments/", { params: { skip, limit } });
  const data = response.data as unknown;
  if (Array.isArray(data)) return data as Department[];
  const record = data as Record<string, unknown>;
  if (record && Array.isArray(record.items)) return record.items as Department[];
  return [];
}

// =====================================================================
// Display + utility helpers
// =====================================================================

export function adminUserDisplayName(u: {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  id?: number;
}): string {
  const full = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
  if (full) return full;
  if (u.username) return u.username;
  return `User #${u.id ?? "?"}`;
}

export function adminUserInitials(u: {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
}): string {
  const first = (u.first_name ?? "").trim();
  const last = (u.last_name ?? "").trim();
  if (first || last) {
    return `${first.charAt(0) || "?"}${last.charAt(0) || "?"}`.toUpperCase();
  }
  if (u.username) return u.username.slice(0, 2).toUpperCase();
  return "??";
}

/** Relative "3 days ago" formatting that never throws on bad input. */
export function relativeTime(value?: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return formatDistanceToNow(date, { addSuffix: true });
}

export type StatusPillVariant = "soft-success" | "soft-warning" | "soft-danger" | "soft-info" | "secondary";

/** Map a user status to the design-system soft pill variant. */
export function statusPillVariant(status?: string | null): StatusPillVariant {
  switch ((status ?? "").toUpperCase()) {
    case "ACTIVE":
      return "soft-success";
    case "SUSPENDED":
      return "soft-warning";
    case "LOCKED":
      return "soft-danger";
    case "INACTIVE":
      return "secondary";
    case "PENDING":
      return "soft-info";
    default:
      return "secondary";
  }
}

/**
 * Generate a password satisfying the backend policy
 * (>=8 chars, upper + lower + digit + special — see app/core/security.py).
 */
export function generateStrongPassword(length = 14): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%^&*-_+=";
  const all = upper + lower + digits + special;

  const randomInt = (max: number): number => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  };
  const pick = (set: string) => set[randomInt(set.length)];

  const chars = [pick(upper), pick(lower), pick(digits), pick(special)];
  for (let i = chars.length; i < Math.max(length, 8); i += 1) {
    chars.push(pick(all));
  }
  // Fisher–Yates shuffle so the mandatory classes aren't positionally predictable.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/** Best-effort extraction of a human message from a FastAPI error response. */
export function getStaffAdminErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { detail?: unknown; message?: unknown } } })
    ?.response?.data;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.detail === "string") return data.detail;
  const nested = data?.detail as { message?: unknown } | undefined;
  if (nested && typeof nested.message === "string") return nested.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
