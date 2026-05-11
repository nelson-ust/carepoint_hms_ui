import { apiClient } from "@/lib/api/api-client";

// ---------- Types ----------

export type ModuleCatalogEntry = {
  code: string;
  name: string;
  description?: string;
  category?: string;
  default_enabled?: boolean;
};

export type TenantModule = {
  module_code: string;
  module_name?: string;
  is_enabled: boolean;
  enabled_at?: string;
  category?: string;
  description?: string;
  /** Optional aggregate fields the backend may include */
  notes?: string;
};

export type ModuleSettingPayload = {
  module_code: string;
  is_enabled: boolean;
  notes?: string;
};

export type BulkModuleSettingPayload = ModuleSettingPayload[];

// ---------- Helpers ----------

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

// ---------- Endpoints ----------

export async function listModuleCatalog(): Promise<ModuleCatalogEntry[]> {
  const response = await apiClient.get<unknown>("/tenant-modules/catalog");
  const data = response.data as any;
  if (Array.isArray(data)) return data as ModuleCatalogEntry[];
  if (Array.isArray(data?.items)) return data.items as ModuleCatalogEntry[];
  if (Array.isArray(data?.modules)) return data.modules as ModuleCatalogEntry[];
  return [];
}

export async function listTenantModules(
  tenantId: number | string,
): Promise<TenantModule[]> {
  const response = await apiClient.get<unknown>(`/tenant-modules/${tenantId}`);
  const data = response.data as any;
  return asArray<TenantModule>(
    Array.isArray(data) ? data : data?.items ?? data?.modules ?? [],
  );
}

export async function listMyTenantModules(): Promise<TenantModule[]> {
  const response = await apiClient.get<unknown>("/tenant-modules/me/list");
  const data = response.data as any;
  return asArray<TenantModule>(
    Array.isArray(data) ? data : data?.items ?? data?.modules ?? [],
  );
}

export async function setTenantModule(
  tenantId: number | string,
  payload: ModuleSettingPayload,
): Promise<unknown> {
  const response = await apiClient.put(`/tenant-modules/${tenantId}`, payload);
  return response.data;
}

export async function bulkSetTenantModules(
  tenantId: number | string,
  payload: BulkModuleSettingPayload,
): Promise<unknown> {
  const response = await apiClient.put(`/tenant-modules/${tenantId}/bulk`, payload);
  return response.data;
}

export async function resetTenantModule(
  tenantId: number | string,
  moduleCode: string,
): Promise<unknown> {
  const response = await apiClient.delete(
    `/tenant-modules/${tenantId}/${encodeURIComponent(moduleCode)}`,
  );
  return response.data;
}
