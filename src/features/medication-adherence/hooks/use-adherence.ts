import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adherenceApi } from "../api/adherence.api";

export const adherenceKeys = {
  all: ["medication-adherence"] as const,
  profiles: (patientId?: number) => [...adherenceKeys.all, "profiles", patientId] as const,
  doses: (patientId?: number) => [...adherenceKeys.all, "doses", patientId] as const,
  alerts: () => [...adherenceKeys.all, "alerts"] as const,
};

export function useAdherenceProfiles(patientId?: number) {
  return useQuery({
    queryKey: adherenceKeys.profiles(patientId),
    queryFn: () => adherenceApi.listProfiles({ patient_id: patientId }),
  });
}

export function useAdherenceDoses(patientId: number) {
  return useQuery({
    queryKey: adherenceKeys.doses(patientId),
    queryFn: () => adherenceApi.listDoses({ patient_id: patientId }),
    enabled: !!patientId,
  });
}

export function useAdherenceAlerts() {
  return useQuery({
    queryKey: adherenceKeys.alerts(),
    queryFn: () => adherenceApi.listAlerts(),
  });
}

export function useConfirmDose() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ doseId, payload }: { doseId: number; payload: { status: string; taken_at?: string } }) => 
      adherenceApi.confirmDose(doseId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adherenceKeys.all });
    },
  });
}
