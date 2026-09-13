import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  listBroadcasts,
  previewAudience,
  sendBroadcast,
  type BroadcastAudience,
  type ListBroadcastsParams,
  type SendBroadcastPayload,
} from "../api/patient-broadcasts.api";

export const broadcastKeys = {
  all: ["patient-broadcasts"] as const,
  list: (params: ListBroadcastsParams) =>
    [...broadcastKeys.all, "list", params] as const,
  preview: (audience: BroadcastAudience, ids: number[]) =>
    [...broadcastKeys.all, "preview", audience, ids] as const,
};

/** Paginated history of hospital→patient messages. */
export function useBroadcasts(params: ListBroadcastsParams = {}) {
  return useQuery({
    queryKey: broadcastKeys.list(params),
    queryFn: () => listBroadcasts(params),
    placeholderData: keepPreviousData,
  });
}

/** Live count of how many patients the current audience selection reaches. */
export function useAudiencePreview(
  audience: BroadcastAudience,
  patientIds: number[],
  enabled = true,
) {
  return useQuery({
    queryKey: broadcastKeys.preview(audience, patientIds),
    queryFn: () => previewAudience(audience, patientIds),
    enabled,
    staleTime: 30_000,
  });
}

export function useSendBroadcast() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SendBroadcastPayload) => sendBroadcast(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: broadcastKeys.all });
    },
  });
}
