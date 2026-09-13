import { apiClient } from "@/lib/api/api-client";

export type IntegrationPartner = {
  id: number;
  name: string;
  description?: string | null;
  is_active: boolean;
  key_prefix: string;
  scopes: string;
  expires_at?: string | null;
  last_used_at?: string | null;
  base_url?: string | null;
  auth_header: string;
  has_outbound_secret: boolean;
  created_at?: string | null;
};

export type CreatePartnerPayload = {
  name: string;
  description?: string;
  scopes: string[];
  expiry_days?: number;
  base_url?: string;
  auth_header?: string;
  auth_secret?: string;
};

export type OutboundResult = { status_code: number; ok: boolean; data: any };

export const integrationsApi = {
  list: () =>
    apiClient.get("/integration/partners").then((r) => (r.data?.items ?? []) as IntegrationPartner[]),

  create: (payload: CreatePartnerPayload) =>
    apiClient.post("/integration/partners", payload).then((r) => r.data as { partner: IntegrationPartner; api_key: string }),

  update: (id: number, payload: Partial<CreatePartnerPayload> & { is_active?: boolean }) =>
    apiClient.patch(`/integration/partners/${id}`, payload).then((r) => r.data?.partner as IntegrationPartner),

  rotate: (id: number) =>
    apiClient.post(`/integration/partners/${id}/rotate-key`, {}).then((r) => r.data as { partner: IntegrationPartner; api_key: string }),

  revoke: (id: number) =>
    apiClient.delete(`/integration/partners/${id}`).then((r) => r.data?.partner as IntegrationPartner),

  outboundRequest: (id: number, body: { path: string; method: string; params?: any; payload?: any }) =>
    apiClient.post(`/integration/partners/${id}/request`, body).then((r) => r.data?.result as OutboundResult),
};
