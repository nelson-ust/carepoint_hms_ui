import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invitationsApi } from "../api/invitations.api";
import type { CreateInvitationPayload } from "../api/invitations.api";

export const invitationKeys = {
  all: ["invitations"] as const,
  lists: () => [...invitationKeys.all, "list"] as const,
  list: (filters: any) => [...invitationKeys.lists(), filters] as const,
};

export function useInvitations(params: { skip?: number; limit?: number; status?: string } = {}) {
  return useQuery({
    queryKey: invitationKeys.list(params),
    queryFn: () => invitationsApi.list(params),
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateInvitationPayload) => invitationsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.lists() });
    },
  });
}

export function useResendInvitation() {
  return useMutation({
    mutationFn: (id: number) => invitationsApi.resend(id),
  });
}

export function useCancelInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => invitationsApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.lists() });
    },
  });
}
