import { apiClient } from "@/lib/api/api-client";

// ---------- Types ----------

export type SubscriptionPlan = {
  id: number | string;
  name?: string;
  code?: string;
  description?: string;
  monthly_price?: number;
  annual_price?: number;
  features?: string[] | string;
};

export type TenantSubscription = {
  id: number | string;
  tenant_id: number | string;
  plan_id: number | string;
  status: string;
  start_date?: string;
  end_date?: string;
  trial_end_date?: string;
  auto_renew?: boolean;
  plan?: SubscriptionPlan;
};

export type Tenant = {
  id: number;
  name: string;
  code: string;
  db_connection_string?: string;
  status: string;
  domain_url?: string;
  custom_domain?: string;
  billing_email?: string;
  billing_phone?: string;
  billing_contact_name?: string;
  billing_address?: string;
  tax_id?: string;
  subscriptions?: TenantSubscription[];
};

export type TenantsListResponse = {
  total_count: number;
  page: number;
  page_size: number;
  tenants: Tenant[];
};

export const TENANT_STATUSES = [
  "PENDING",
  "ACTIVE",
  "SUSPENDED",
  "TERMINATED",
  "TRIAL",
] as const;

// ---------- Payloads ----------

export type TenantRegistrationPayload = {
  tenant_name: string;
  tenant_code: string;
  domain_url?: string;
  billing_email: string;
  billing_phone: string;
  billing_contact_name: string;
  billing_address: string;
  tax_id?: string;
  plan_code: string;
  admin_email: string;
  admin_username: string;
  admin_password: string;
  admin_first_name: string;
  admin_last_name: string;
};

export type UpdateTenantStatusPayload = {
  status: string;
};

// ---------- Endpoints ----------

export async function listTenants(
  params: { page?: number; page_size?: number } = {},
): Promise<TenantsListResponse> {
  const { page = 1, page_size = 50 } = params;
  const response = await apiClient.get<TenantsListResponse | { tenants?: Tenant[] }>(
    "/tenants",
    { params: { page, page_size } },
  );
  const data = response.data as any;
  // Defensive normalization in case the backend ever switches shape
  return {
    total_count: data?.total_count ?? data?.count ?? data?.tenants?.length ?? 0,
    page: data?.page ?? page,
    page_size: data?.page_size ?? page_size,
    tenants: Array.isArray(data?.tenants)
      ? data.tenants
      : Array.isArray(data?.items)
        ? data.items
        : [],
  };
}

export async function getTenant(tenantId: number | string): Promise<Tenant> {
  const response = await apiClient.get<Tenant>(`/tenants/${tenantId}`);
  return response.data;
}

export async function registerTenant(
  payload: TenantRegistrationPayload,
): Promise<unknown> {
  const response = await apiClient.post("/tenants/register", payload);
  return response.data;
}

export async function approveTenant(tenantId: number | string): Promise<unknown> {
  const response = await apiClient.post(`/tenants/${tenantId}/approve`);
  return response.data;
}

export async function updateTenantStatus(
  tenantId: number | string,
  status: string,
): Promise<Tenant> {
  const response = await apiClient.put<Tenant>(`/tenants/${tenantId}/status`, {
    status,
  } satisfies UpdateTenantStatusPayload);
  return response.data;
}
