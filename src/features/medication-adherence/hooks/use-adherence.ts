import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adherenceApi, type AdherenceDoseStatus } from "../api/adherence.api";

export const adherenceKeys = {
  all: ["medication-adherence"] as const,
  profiles: (patientId?: number) => [...adherenceKeys.all, "profiles", patientId] as const,
  schedules: (patientId?: number) => [...adherenceKeys.all, "schedules", patientId] as const,
  doses: (patientId?: number) => [...adherenceKeys.all, "doses", patientId] as const,
  alerts: () => [...adherenceKeys.all, "alerts"] as const,
  snapshots: (patientId?: number) => [...adherenceKeys.all, "snapshots", patientId] as const,
};

export function useAdherenceProfiles(patientId?: number) {
  return useQuery({
    queryKey: adherenceKeys.profiles(patientId),
    queryFn: () => adherenceApi.listProfiles({ patient_id: patientId }),
  });
}

export function useAdherenceSchedules(patientId?: number) {
  return useQuery({
    queryKey: adherenceKeys.schedules(patientId),
    queryFn: () => adherenceApi.listSchedules({ patient_id: patientId }),
  });
}

/** Doses across the tenant, or for a single patient when patientId is given. */
export function useAdherenceDoses(patientId?: number) {
  return useQuery({
    queryKey: adherenceKeys.doses(patientId),
    queryFn: () => adherenceApi.listDoses(patientId ? { patient_id: patientId } : {}),
  });
}

export function useAdherenceAlerts() {
  return useQuery({
    queryKey: adherenceKeys.alerts(),
    queryFn: () => adherenceApi.listAlerts(),
  });
}

export function useAdherenceSnapshots(patientId?: number) {
  return useQuery({
    queryKey: adherenceKeys.snapshots(patientId),
    queryFn: () => adherenceApi.listSnapshots(patientId ? { patient_id: patientId } : {}),
  });
}

export function useConfirmDose() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ doseId, payload }: { doseId: number; payload: { status: AdherenceDoseStatus; taken_at?: string; source?: string } }) =>
      adherenceApi.confirmDose(doseId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adherenceKeys.all });
    },
  });
}
