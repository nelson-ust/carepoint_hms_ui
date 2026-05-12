import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

// ---------- Types ----------

export type SupportGrant = {
  id: number;
  saas_admin_id: number;
  tenant_id: number;
  reason: string;
  status: "REQUESTED" | "APPROVED" | "REVOKED" | "EXPIRED";
  valid_from: string;
  valid_until: string;
  approved_at: string | null;
  revoked_at: string | null;
  permissions: {
    actions: string[];
  };
};

export type SupportRequestPayload = {
  tenant_id: number;
  reason: string;
  valid_hours: number;
  permissions: string[];
};

// ---------- Endpoints ----------

export const supportAccessApi = {
  request: (payload: SupportRequestPayload) =>
    apiClient.post<any>("/support-access/request", payload).then((res) => res.data),

  listMyGrants: () =>
    apiClient.get<any>("/support-access/me").then((res) => {
      const d = res.data;
      if (Array.isArray(d)) {
        return { items: d as SupportGrant[], total_count: d.length, page: 1, page_size: d.length } as unknown as PaginatedResponse<SupportGrant>;
      }
      return d as PaginatedResponse<SupportGrant>;
    }),

  listAll: () =>
    apiClient.get<any>("/support-access").then((res) => {
      const d = res.data;
      if (Array.isArray(d)) {
        return { items: d as SupportGrant[], total_count: d.length, page: 1, page_size: d.length } as unknown as PaginatedResponse<SupportGrant>;
      }
      return d as PaginatedResponse<SupportGrant>;
    }),

  approve: (grantId: number) =>
    apiClient.post<{ success: boolean; message: string }>("/support-access/" + grantId + "/approve").then((res) => res.data),

  revoke: (grantId: number) =>
    apiClient.post<{ success: boolean; message: string }>("/support-access/" + grantId + "/revoke").then((res) => res.data),
};
