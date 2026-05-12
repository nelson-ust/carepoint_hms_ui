import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

// ---------- Types ----------

export type SupportGrant = {
  id: number;
  tenant_id: number;
  support_staff_id: number;
  reason: string;
  expires_at: string;
  status: "REQUESTED" | "APPROVED" | "REVOKED" | "EXPIRED";
  created_at: string;
};

// ---------- Endpoints ----------

export const supportAccessApi = {
  request: (payload: { reason: string; duration_hours: number }) =>
    apiClient.post<{ success: boolean; message: string; grant: SupportGrant }>("/support-access/request", payload).then((res) => res.data),
  
  listMyGrants: () =>
    apiClient.get<PaginatedResponse<SupportGrant>>("/support-access/me").then((res) => res.data),
  
  listAll: () =>
    apiClient.get<PaginatedResponse<SupportGrant>>("/support-access").then((res) => res.data),
  
  approve: (grantId: number) =>
    apiClient.post<{ success: boolean; message: string }>("/support-access/" + grantId + "/approve").then((res) => res.data),
  
  revoke: (grantId: number) =>
    apiClient.post<{ success: boolean; message: string }>("/support-access/" + grantId + "/revoke").then((res) => res.data),
};
