import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supportAccessApi } from "../api/support-access.api";

export const supportKeys = {
  all: ["support-access"] as const,
  myGrants: () => [...supportKeys.all, "my-grants"] as const,
  allGrants: () => [...supportKeys.all, "all-grants"] as const,
};

export function useMySupportGrants() {
  return useQuery({
    queryKey: supportKeys.myGrants(),
    queryFn: () => supportAccessApi.listMyGrants(),
  });
}

export function useAllSupportGrants() {
  return useQuery({
    queryKey: supportKeys.allGrants(),
    queryFn: () => supportAccessApi.listAll(),
  });
}

export function useRequestSupportAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { reason: string; duration_hours: number }) => 
      supportAccessApi.request(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportKeys.myGrants() });
    },
  });
}

export function useApproveSupportGrant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => supportAccessApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportKeys.allGrants() });
    },
  });
}

export function useRevokeSupportGrant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => supportAccessApi.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportKeys.allGrants() });
      queryClient.invalidateQueries({ queryKey: supportKeys.myGrants() });
    },
  });
}
