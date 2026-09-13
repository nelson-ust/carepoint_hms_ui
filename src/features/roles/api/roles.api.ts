import { apiClient } from "@/lib/api/api-client";

// =====================================================================
// Types — mirror app/schemas/role_schemas.py & permission_schema.py
// =====================================================================

export type PermissionLite = {
  id: number;
  name: string;
  code: string;
  module?: string | null;
  description?: string | null;
};

export type Permission = PermissionLite & {
  is_system?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type RoleListItem = {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  permission_count: number;
  user_count: number;
  is_system?: boolean;
};

export type Role = {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  permissions: PermissionLite[];
  is_system?: boolean;
};

export type ListMeta = {
  skip?: number;
  limit?: number;
  total?: number;
  has_next?: boolean;
  [key: string]: unknown;
};

export type Paginated<T> = {
  success?: boolean;
  message?: string;
  items: T[];
  count: number;
  meta?: ListMeta;
};

export type RoleCreatePayload = {
  name: string;
  code: string;
  description?: string;
  permission_ids?: number[];
};

export type RoleUpdatePayload = {
  name?: string;
  code?: string;
  description?: string | null;
};

export type MyPermissions = {
  is_superuser: boolean;
  permissions: string[];
};

/**
 * Built-in role codes the backend protects (`Role.is_system`). The role
 * responses don't expose the flag, so we fall back to this known set to
 * decide when to show a "System" badge / warn before deletion.
 */
const SYSTEM_ROLE_CODES = new Set([
  "SUPER_ADMIN",
  "TENANT_ADMIN",
  "ADMIN",
  "DOCTOR",
  "NURSE",
  "PHARMACIST",
  "LAB_TECHNICIAN",
  "RECEPTIONIST",
  "BILLING_OFFICER",
]);

export function isSystemRole(role: { code?: string; is_system?: boolean }): boolean {
  if (role.is_system) return true;
  return role.code ? SYSTEM_ROLE_CODES.has(role.code.toUpperCase()) : false;
}

// =====================================================================
// Normalization helpers — endpoints return either a bare resource or a
// `{ success, message, ... }` envelope; flatten both here.
// =====================================================================

function normalizeRole(data: unknown): Role {
  const record = data as Record<string, unknown>;
  if (record && typeof record === "object" && "role" in record && record.role) {
    return record.role as Role;
  }
  return record as unknown as Role;
}

function normalizePaginated<T>(data: unknown): Paginated<T> {
  const record = data as Record<string, unknown>;
  if (record && typeof record === "object" && Array.isArray(record.items)) {
    return {
      success: (record.success as boolean) ?? true,
      message: (record.message as string) ?? "",
      items: record.items as T[],
      count: (record.count as number) ?? (record.items as T[]).length,
      meta: (record.meta as ListMeta) ?? {},
    };
  }
  const items = (Array.isArray(data) ? data : []) as T[];
  return { success: true, message: "", items, count: items.length, meta: {} };
}

// =====================================================================
// Roles — /roles (app/api/v1/endpoints/role_routes.py)
// =====================================================================

export async function listRoles(
  params: { skip?: number; limit?: number } = {}
): Promise<Paginated<RoleListItem>> {
  const response = await apiClient.get("/roles/", { params });
  return normalizePaginated<RoleListItem>(response.data);
}

export async function getRole(roleId: number): Promise<Role> {
  const response = await apiClient.get(`/roles/${roleId}`);
  return normalizeRole(response.data);
}

export async function createRole(payload: RoleCreatePayload): Promise<Role> {
  const response = await apiClient.post("/roles/", {
    ...payload,
    permission_ids: payload.permission_ids ?? [],
  });
  return normalizeRole(response.data);
}

export async function updateRole(roleId: number, payload: RoleUpdatePayload): Promise<Role> {
  const response = await apiClient.put(`/roles/${roleId}`, payload);
  return normalizeRole(response.data);
}

export async function deleteRole(
  roleId: number
): Promise<{ success: boolean; message: string; role_id: number }> {
  const response = await apiClient.delete(`/roles/${roleId}`);
  return response.data;
}

export async function assignRolePermissions(
  roleId: number,
  permissionIds: number[]
): Promise<Role> {
  const response = await apiClient.post(`/roles/${roleId}/permissions`, {
    permission_ids: permissionIds,
  });
  return normalizeRole(response.data);
}

export async function revokeRolePermissions(
  roleId: number,
  permissionIds: number[]
): Promise<Role> {
  // DELETE with a JSON body — axios requires the `data` config key.
  const response = await apiClient.delete(`/roles/${roleId}/permissions`, {
    data: { permission_ids: permissionIds },
  });
  return normalizeRole(response.data);
}

// =====================================================================
// Permissions — /permissions (app/api/v1/endpoints/permission_routes.py)
// =====================================================================

export async function listPermissions(
  params: { skip?: number; limit?: number; module?: string; search?: string } = {}
): Promise<Paginated<Permission>> {
  const response = await apiClient.get("/permissions/", { params });
  return normalizePaginated<Permission>(response.data);
}

/** Walk every page of the permission catalog (backend caps `limit` at 100). */
export async function listAllPermissions(): Promise<Permission[]> {
  const pageSize = 100;
  const all: Permission[] = [];
  let skip = 0;
  // Safety bound of 50 pages (5000 permissions).
  for (let page = 0; page < 50; page += 1) {
    const { items, count } = await listPermissions({ skip, limit: pageSize });
    all.push(...items);
    skip += pageSize;
    if (items.length === 0 || all.length >= count) break;
  }
  return all;
}

export async function listPermissionModules(): Promise<string[]> {
  const response = await apiClient.get("/permissions/modules");
  const data = response.data as { modules?: string[] } | string[];
  if (Array.isArray(data)) return data;
  return data.modules ?? [];
}

export async function getMyPermissions(): Promise<MyPermissions> {
  const response = await apiClient.get("/permissions/me");
  const data = response.data as { is_superuser?: boolean; permissions?: string[] };
  return {
    is_superuser: data.is_superuser ?? false,
    permissions: data.permissions ?? [],
  };
}

// =====================================================================
// Client-side grouping helper for the permission matrix
// =====================================================================

export type PermissionGroup = {
  module: string;
  permissions: Permission[];
};

export function groupPermissionsByModule(permissions: Permission[]): PermissionGroup[] {
  const groups = new Map<string, Permission[]>();
  for (const permission of permissions) {
    const moduleLabel = (permission.module ?? "GENERAL").toUpperCase();
    const bucket = groups.get(moduleLabel);
    if (bucket) {
      bucket.push(permission);
    } else {
      groups.set(moduleLabel, [permission]);
    }
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([module, perms]) => ({
      module,
      permissions: [...perms].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

/** Best-effort extraction of a human message from a FastAPI error response. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { detail?: unknown; message?: unknown } } })
    ?.response?.data;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.detail === "string") return data.detail;
  const nested = data?.detail as { message?: unknown } | undefined;
  if (nested && typeof nested.message === "string") return nested.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
