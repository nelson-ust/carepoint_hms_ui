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
  // Support both snake_case and the flat response seen in logs
  code?: string;
  module_code?: string;
  
  label?: string;
  module_name?: string;
  
  effective?: boolean;
  is_enabled?: boolean;
  
  plan_default?: boolean;
  override?: boolean | null;
  
  enabled_at?: string;
  category?: string;
  description?: string;
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
  // The backend expects an object wrapper: { modules: [...] }.
  const response = await apiClient.put(`/tenant-modules/${tenantId}/bulk`, { modules: payload });
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

// ---------- Facility profiles (verticals) ----------

export type FacilityProfileCode = "HOSPITAL" | "DENTAL" | "EYE" | "PHARMACY";

export type FacilityProfile = {
  code: FacilityProfileCode;
  label: string;
  workspace_name: string;
  home: string;
  description: string;
  modules?: string[];
  is_default?: boolean;
};

export type CurrentFacilityProfile = {
  code: FacilityProfileCode;
  label: string;
  workspace_name: string;
  home: string;
  description: string;
};

/** Catalog of selectable facility profiles (verticals). */
export async function listFacilityProfiles(): Promise<FacilityProfile[]> {
  const response = await apiClient.get<unknown>("/tenant-modules/profiles");
  return asArray<FacilityProfile>(response.data);
}

/** The current tenant's facility profile. */
export async function getMyFacilityProfile(): Promise<CurrentFacilityProfile> {
  const response = await apiClient.get<CurrentFacilityProfile>("/tenant-modules/me/profile");
  return response.data;
}

/**
 * SaaS-admin: apply a facility profile to any tenant. This is the only path for
 * switching a tenant's facility type — tenants cannot change their own.
 */
export async function applyFacilityProfile(
  tenantId: number | string,
  profile: string,
): Promise<unknown> {
  const response = await apiClient.put(`/tenant-modules/${tenantId}/profile`, { profile });
  return response.data;
}
