import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { auditApi, type AuditQuery } from "../api/audit.api";

export const auditKeys = {
  all: ["audit-logs"] as const,
  tenant: (q: AuditQuery) => [...auditKeys.all, "tenant", q] as const,
  saas: (q: AuditQuery) => [...auditKeys.all, "saas", q] as const,
};

export function useTenantAuditLogs(query: AuditQuery) {
  return useQuery({
    queryKey: auditKeys.tenant(query),
    queryFn: () => auditApi.listTenant(query),
    placeholderData: keepPreviousData,
  });
}

export function useSaasAuditLogs(query: AuditQuery) {
  return useQuery({
    queryKey: auditKeys.saas(query),
    queryFn: () => auditApi.listSaas(query),
    placeholderData: keepPreviousData,
  });
}
