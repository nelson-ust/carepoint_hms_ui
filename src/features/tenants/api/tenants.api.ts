import { apiClient } from "@/lib/api/api-client";

// ---------- Types ----------

export type SubscriptionPlan = {
  id: number | string;
  name: string;
  code: string;
  description: string;
  price: string | number;
  currency: string;
  interval: "MONTHLY" | "YEARLY";
  max_facilities: number | null;
  max_users: number | null;
  max_patients: number | null;
  has_clinical: boolean;
  has_inpatient: boolean;
  has_laboratory: boolean;
  has_pharmacy: boolean;
  has_inventory: boolean;
  has_billing: boolean;
  has_reporting: boolean;
  has_appointments?: boolean;
  has_patient_portal?: boolean;
  has_insurance?: boolean;
  has_radiology?: boolean;
  has_surgical?: boolean;
  has_hr?: boolean;
  has_dietary?: boolean;
  has_ambulance?: boolean;
  has_compliance?: boolean;
  is_active: boolean;
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
  status: string;
  is_provisioned?: boolean;
  provisioning_error?: string | null;
  aws_s3_bucket_name?: string | null;
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
  console.log("[API] registerTenant calling /tenants/register with payload:", payload);
  const response = await apiClient.post("/tenants/register", payload, {
    headers: { "X-Tenant-Code": "" } // Suppress header for registration
  });
  return response.data;
}

export type ChangeTenantPlanPayload = {
  plan_code: string;
  billing_interval?: "MONTHLY" | "YEARLY";
};

export type ChangeTenantPlanResult = {
  success: boolean;
  message?: string;
  subscription_id?: number | string;
  plan_id?: number | string;
  status?: string;
};

/** SaaS admin: switch a tenant to a different plan / billing cycle. */
export async function changeTenantPlan(
  tenantId: number | string,
  payload: ChangeTenantPlanPayload,
): Promise<ChangeTenantPlanResult> {
  const response = await apiClient.post<ChangeTenantPlanResult>(
    `/tenants/${tenantId}/change-plan`,
    payload,
  );
  return response.data;
}

export type ProvisioningStep = {
  step: string;
  detail?: string | null;
  status: "COMPLETED" | "IN_PROGRESS" | "FAILED" | "SKIPPED" | string;
  at?: string | null;
};

export type ProvisioningStatus = {
  success: boolean;
  tenant_id: number;
  status: string;
  is_provisioned: boolean;
  provisioning_error?: string | null;
  steps?: ProvisioningStep[];
  aws_s3_bucket_name?: string | null;
  registered_at?: string | null;
  company_email?: string | null;
  contact_person?: string | null;
  industry?: string | null;
};

export async function getProvisioningStatus(
  tenantId: number | string,
): Promise<ProvisioningStatus> {
  const response = await apiClient.get<ProvisioningStatus>(
    `/tenants/${tenantId}/provisioning-status`,
  );
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

export async function listSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const response = await apiClient.get<SubscriptionPlan[]>("/saas/plans", {
    headers: { "X-Tenant-Code": "" } // Suppress header for public plans list
  });
  return response.data;
}

export type ProvisionS3Result = {
  success: boolean;
  already_provisioned: boolean;
  bucket_name: string;
  message: string;
};

/** Provision the tenant's own S3 bucket (idempotent, SaaS admin). */
export async function provisionTenantS3(tenantId: number | string): Promise<ProvisionS3Result> {
  const response = await apiClient.post<ProvisionS3Result>(`/tenants/${tenantId}/provision-s3`);
  return response.data;
}

export type RepairResult = { success: boolean; message: string };

/** Repair: forward-only schema sync on the tenant DB (idempotent). */
export async function syncTenantSchema(tenantId: number | string): Promise<RepairResult> {
  const response = await apiClient.post<RepairResult>(`/tenants/${tenantId}/sync-schema`);
  return response.data;
}

/** Repair: re-seed roles/permissions/defaults on the tenant DB (idempotent). */
export async function syncTenantDefaults(tenantId: number | string): Promise<RepairResult> {
  const response = await apiClient.post<RepairResult>(`/tenants/${tenantId}/sync-defaults`);
  return response.data;
}
