import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sdpApi } from "../api/sdp.api";

export const sdpKeys = {
  all: ["service-delivery-points"] as const,
  list: () => [...sdpKeys.all, "list"] as const,
  detail: (id: number) => [...sdpKeys.all, "detail", id] as const,
};

export function useServicePoints() {
  return useQuery({
    queryKey: sdpKeys.list(),
    queryFn: () => sdpApi.list(),
  });
}

export function useServicePoint(id: number) {
  return useQuery({
    queryKey: sdpKeys.detail(id),
    queryFn: () => sdpApi.get(id),
    enabled: !!id,
  });
}

export function useCreateServicePoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; description?: string; queue_prefix: string }) => 
      sdpApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sdpKeys.all });
    },
  });
}

export function useDeleteServicePoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => sdpApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sdpKeys.all });
    },
  });
}
