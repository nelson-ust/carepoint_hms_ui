import { apiClient } from "@/lib/api/api-client";
import type { SubscriptionPlan } from "@/features/tenants/api/tenants.api";

export type { SubscriptionPlan };

/**
 * The nine feature toggles surfaced in the plan editor. The backend accepts
 * more (dietary/ambulance/compliance); these are the ones the console edits.
 */
export const PLAN_FEATURE_FLAGS = [
  { key: "has_clinical", label: "Clinical" },
  { key: "has_inpatient", label: "Inpatient" },
  { key: "has_laboratory", label: "Laboratory" },
  { key: "has_pharmacy", label: "Pharmacy" },
  { key: "has_inventory", label: "Inventory" },
  { key: "has_billing", label: "Billing" },
  { key: "has_reporting", label: "Reporting" },
  { key: "has_appointments", label: "Appointments" },
  { key: "has_patient_portal", label: "Patient Portal" },
  { key: "has_insurance", label: "Insurance / HMO" },
  { key: "has_radiology", label: "Radiology" },
  { key: "has_surgical", label: "Surgical" },
  { key: "has_hr", label: "HR & Payroll" },
] as const;

export type PlanFeatureKey = (typeof PLAN_FEATURE_FLAGS)[number]["key"];

export type SubscriptionPlanCreatePayload = {
  name: string;
  code: string;
  description?: string;
  price: number;
  currency: string;
  interval: "MONTHLY" | "YEARLY";
  max_facilities: number;
  max_users: number;
  max_patients?: number | null;
  is_active: boolean;
} & Partial<Record<PlanFeatureKey, boolean>>;

/** Update omits code/currency/interval — those are fixed at creation. */
export type SubscriptionPlanUpdatePayload = Partial<
  Omit<SubscriptionPlanCreatePayload, "code" | "currency" | "interval">
>;

const SAAS_HEADERS = { headers: { "X-Tenant-Code": "" } }; // platform-scoped

export async function listPlansAdmin(
  includeInactive = true,
): Promise<SubscriptionPlan[]> {
  const response = await apiClient.get<SubscriptionPlan[]>("/saas/plans", {
    params: { include_inactive: includeInactive },
    ...SAAS_HEADERS,
  });
  return response.data;
}

export async function createPlan(
  payload: SubscriptionPlanCreatePayload,
): Promise<SubscriptionPlan> {
  const response = await apiClient.post<SubscriptionPlan>("/saas/plans", payload, SAAS_HEADERS);
  return response.data;
}

export async function updatePlan(
  planId: number | string,
  payload: SubscriptionPlanUpdatePayload,
): Promise<SubscriptionPlan> {
  const response = await apiClient.put<SubscriptionPlan>(`/saas/plans/${planId}`, payload, SAAS_HEADERS);
  return response.data;
}

/** Activate / deactivate is just an is_active update. */
export async function setPlanActive(
  planId: number | string,
  isActive: boolean,
): Promise<SubscriptionPlan> {
  return updatePlan(planId, { is_active: isActive });
}
