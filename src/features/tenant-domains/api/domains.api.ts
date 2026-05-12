import { apiClient } from "@/lib/api/api-client";

// ---------- Types ----------

export type TenantDomain = {
  id: number;
  tenant_id: number;
  domain_name: string;
  is_primary: boolean;
  is_verified: boolean;
  ssl_enabled: boolean;
  ssl_expiry?: string;
  created_at: string;
};

export type VerificationInstructions = {
  type: "TXT" | "CNAME";
  host: string;
  value: string;
};

// ---------- Endpoints ----------

export const domainsApi = {
  list: (tenantId: number) =>
    apiClient.get<TenantDomain[]>(`/tenant-domains/${tenantId}`).then((res) => res.data),
  
  add: (tenantId: number, domain: string) =>
    apiClient.post<{ success: boolean; domain: TenantDomain }>(`/tenant-domains/${tenantId}`, { domain_name: domain }).then((res) => res.data),
  
  getVerification: (tenantId: number, domainId: number) =>
    apiClient.get<VerificationInstructions>(`/tenant-domains/${tenantId}/${domainId}/verification`).then((res) => res.data),
  
  verify: (tenantId: number, domainId: number) =>
    apiClient.post<{ success: boolean; message: string }>(`/tenant-domains/${tenantId}/${domainId}/verify`).then((res) => res.data),
  
  makePrimary: (tenantId: number, domainId: number) =>
    apiClient.post<{ success: boolean }>(`/tenant-domains/${tenantId}/${domainId}/make-primary`).then((res) => res.data),
  
  delete: (tenantId: number, domainId: number) =>
    apiClient.delete(`/tenant-domains/${tenantId}/${domainId}`).then((res) => res.data),
};
