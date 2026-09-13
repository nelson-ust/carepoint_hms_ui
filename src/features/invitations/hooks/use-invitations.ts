import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invitationsApi } from "../api/invitations.api";
import type { CreateInvitationPayload, InvitationStatus } from "../api/invitations.api";

export const invitationKeys = {
  all: ["invitations"] as const,
  lists: () => [...invitationKeys.all, "list"] as const,
  list: (filters: { status?: InvitationStatus }) => [...invitationKeys.lists(), filters] as const,
};

export function useInvitations(params: { status?: InvitationStatus } = {}) {
  return useQuery({
    queryKey: invitationKeys.list(params),
    queryFn: () => invitationsApi.list(params),
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateInvitationPayload) => invitationsApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationKeys.lists() }),
  });
}

export function useResendInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => invitationsApi.resend(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationKeys.lists() }),
  });
}

export function useCancelInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => invitationsApi.cancel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationKeys.lists() }),
  });
}

export function useSweepInvitations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => invitationsApi.sweep(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationKeys.lists() }),
  });
}

export function useAcceptInvitation() {
  return useMutation({
    mutationFn: ({ tenantCode, ...payload }: Parameters<typeof invitationsApi.accept>[0] & { tenantCode?: string }) =>
      invitationsApi.accept(payload, tenantCode),
  });
}
