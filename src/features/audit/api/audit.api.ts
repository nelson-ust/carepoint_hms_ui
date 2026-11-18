import { apiClient } from "@/lib/api/api-client";

// Mirrors backend app/api/v1/endpoints/audit_routes.py
export type AuditLog = {
  id: number;
  action: string;
  entity_name: string;
  entity_id?: number | null;
  actor_user_id?: number | null;
  actor_label?: string | null;
  actor_type?: string | null;
  request_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  http_method?: string | null;
  path?: string | null;
  status_code?: number | null;
  before_data?: Record<string, unknown> | null;
  after_data?: Record<string, unknown> | null;
  extra_metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type SaaSAuditLog = AuditLog & {
  actor_admin_id?: number | null;
  target_tenant_id?: number | null;
  target_tenant_code?: string | null;
};

export type AuditListResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type AuditQuery = {
  action?: string;
  entity_name?: string;
  q?: string;
  date_from?: string;
  date_to?: string;
  target_tenant_code?: string;
  limit?: number;
  offset?: number;
};

function cleanParams(params: AuditQuery): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  });
  return out;
}

export const auditApi = {
  listTenant: (params: AuditQuery = {}) =>
    apiClient
      .get<AuditListResponse<AuditLog>>("/audit-logs", { params: cleanParams(params) })
      .then((r) => r.data),

  listSaas: (params: AuditQuery = {}) =>
    apiClient
      .get<AuditListResponse<SaaSAuditLog>>("/saas/audit-logs", { params: cleanParams(params) })
      .then((r) => r.data),
};
