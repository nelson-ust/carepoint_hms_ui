import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { connectivityApi } from "../api/connectivity.api";

export const connectivityKeys = {
  all: ["connectivity"] as const,
  stats: () => [...connectivityKeys.all, "stats"] as const,
};

export function useConnectivityStats() {
  return useQuery({
    queryKey: connectivityKeys.stats(),
    queryFn: () => connectivityApi.getStats(),
  });
}

export function useConnectivityProbe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { target_url: string }) => connectivityApi.probe(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: connectivityKeys.stats() });
    },
  });
}
