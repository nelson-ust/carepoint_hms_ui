import { apiClient } from "@/lib/api/api-client";

const SAAS_HEADERS = { headers: { "X-Tenant-Code": "" } }; // platform-scoped

export type PlanCampaignStatus = "ACTIVE" | "REVERTED" | "CANCELLED";

export type PlanCampaign = {
  id: number;
  name: string;
  status: PlanCampaignStatus;
  target_plan_id: number;
  target_plan_name?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  reverted_at?: string | null;
  tenant_count: number;
  message?: string | null;
  created_by?: string | null;
  created_at?: string | null;
};

export type PlanCampaignCreatePayload = {
  name: string;
  target_plan_code: string;
  days?: number;
  months?: number;
  message?: string;
  tenant_ids?: number[];
  from_plan_code?: string;
};

export async function listPlanCampaigns(): Promise<PlanCampaign[]> {
  const res = await apiClient.get<{ items: PlanCampaign[] }>("/plan-campaigns", SAAS_HEADERS);
  return res.data.items ?? [];
}

export async function createPlanCampaign(
  payload: PlanCampaignCreatePayload,
): Promise<{ success: boolean; message?: string; campaign: PlanCampaign }> {
  const res = await apiClient.post("/plan-campaigns", payload, SAAS_HEADERS);
  return res.data;
}

export async function revertPlanCampaign(
  id: number,
): Promise<{ success: boolean; message?: string; campaign: PlanCampaign }> {
  const res = await apiClient.post(`/plan-campaigns/${id}/revert`, null, SAAS_HEADERS);
  return res.data;
}
