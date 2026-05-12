import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tenantJobsApi } from "../api/tenant-jobs.api";

export const jobKeys = {
  all: ["tenant-jobs"] as const,
  handlers: () => [...jobKeys.all, "handlers"] as const,
  list: () => [...jobKeys.all, "list"] as const,
};

export function useJobHandlers() {
  return useQuery({
    queryKey: jobKeys.handlers(),
    queryFn: () => tenantJobsApi.listHandlers(),
  });
}

export function useTenantJobs() {
  return useQuery({
    queryKey: jobKeys.list(),
    queryFn: () => tenantJobsApi.listJobs(),
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => tenantJobsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobKeys.list() });
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => tenantJobsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobKeys.list() });
    },
  });
}
