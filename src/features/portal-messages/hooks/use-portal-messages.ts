import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  getUnreadPatientMessageCount,
  listPatientMessages,
  markPatientMessageRead,
  type ListPatientMessagesParams,
} from "../api/portal-messages.api";

export const patientMessageKeys = {
  all: ["patient-messages"] as const,
  list: (params: ListPatientMessagesParams) =>
    [...patientMessageKeys.all, "list", params] as const,
  unreadCount: [...["patient-messages"], "unread-count"] as const,
};

/** Paginated inbox of patient-sent messages. */
export function usePatientMessages(params: ListPatientMessagesParams = {}) {
  return useQuery({
    queryKey: patientMessageKeys.list(params),
    queryFn: () => listPatientMessages(params),
    placeholderData: keepPreviousData,
  });
}

/** Unread patient-message count (for the dashboard tile), polled every 60s. */
export function useUnreadPatientMessageCount(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled ?? true;
  return useQuery({
    queryKey: patientMessageKeys.unreadCount,
    queryFn: getUnreadPatientMessageCount,
    refetchInterval: enabled ? 60_000 : false,
    staleTime: 30_000,
    enabled,
  });
}

export function useMarkPatientMessageRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId: number) => markPatientMessageRead(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: patientMessageKeys.all });
    },
  });
}
