import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { loyaltyApi } from "../api/loyalty.api";

export const loyaltyKeys = {
  all: ["loyalty"] as const,
  points: (patientId: number) => [...loyaltyKeys.all, "points", patientId] as const,
  history: (patientId: number) => [...loyaltyKeys.all, "history", patientId] as const,
};

export function usePatientPoints(patientId: number) {
  return useQuery({
    queryKey: loyaltyKeys.points(patientId),
    queryFn: () => loyaltyApi.getPoints(patientId),
    enabled: !!patientId,
  });
}

export function useLoyaltyHistory(patientId: number) {
  return useQuery({
    queryKey: loyaltyKeys.history(patientId),
    queryFn: () => loyaltyApi.getHistory(patientId),
    enabled: !!patientId,
  });
}

export function useEarnPoints() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { patient_id: number; points: number; reason: string }) => 
      loyaltyApi.earn(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: loyaltyKeys.points(variables.patient_id) });
      queryClient.invalidateQueries({ queryKey: loyaltyKeys.history(variables.patient_id) });
    },
  });
}

export function useRedeemPoints() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { patient_id: number; points: number; reason: string }) => 
      loyaltyApi.redeem(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: loyaltyKeys.points(variables.patient_id) });
      queryClient.invalidateQueries({ queryKey: loyaltyKeys.history(variables.patient_id) });
    },
  });
}
