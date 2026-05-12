import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { emailSettingsApi } from "../api/email-settings.api";
import type { CreateEmailConfigPayload, UpdateEmailConfigPayload } from "../api/email-settings.api";

export const emailKeys = {
  all: ["email-settings"] as const,
  configs: () => [...emailKeys.all, "configs"] as const,
};

export function useEmailConfigs() {
  return useQuery({
    queryKey: emailKeys.configs(),
    queryFn: () => emailSettingsApi.list(),
  });
}

export function useCreateEmailConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEmailConfigPayload) => emailSettingsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailKeys.configs() });
    },
  });
}

export function useUpdateEmailConfig(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateEmailConfigPayload) => emailSettingsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailKeys.configs() });
    },
  });
}

export function useDeleteEmailConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => emailSettingsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailKeys.configs() });
    },
  });
}

export function useTestEmailConfig() {
  return useMutation({
    mutationFn: (id: number) => emailSettingsApi.test(id),
  });
}
