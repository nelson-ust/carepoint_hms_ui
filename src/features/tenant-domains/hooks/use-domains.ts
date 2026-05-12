import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { domainsApi } from "../api/domains.api";

export const domainKeys = {
  all: ["tenant-domains"] as const,
  list: (tenantId: number) => [...domainKeys.all, "list", tenantId] as const,
  verification: (tenantId: number, domainId: number) => [...domainKeys.all, "verification", tenantId, domainId] as const,
};

export function useTenantDomains(tenantId: number) {
  return useQuery({
    queryKey: domainKeys.list(tenantId),
    queryFn: () => domainsApi.list(tenantId),
    enabled: !!tenantId,
  });
}

export function useDomainVerification(tenantId: number, domainId: number) {
  return useQuery({
    queryKey: domainKeys.verification(tenantId, domainId),
    queryFn: () => domainsApi.getVerification(tenantId, domainId),
    enabled: !!tenantId && !!domainId,
  });
}

export function useVerifyDomain(tenantId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (domainId: number) => domainsApi.verify(tenantId, domainId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: domainKeys.list(tenantId) });
    },
  });
}

export function useAddDomain(tenantId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (domain: string) => domainsApi.add(tenantId, domain),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: domainKeys.list(tenantId) });
    },
  });
}
