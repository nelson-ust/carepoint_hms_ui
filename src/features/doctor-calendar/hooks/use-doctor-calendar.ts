import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addTimeOff,
  createAvailabilityTemplate,
  deactivateAvailabilityTemplate,
  getDoctorWorkload,
  getStaffProfileByUserId,
  listAvailabilityTemplates,
  listCalendarSlots,
  listDoctors,
  materialiseSlots,
  releaseSlot,
  reserveSlot,
} from "../api/doctor-calendar.api";
import type {
  CreateTemplatePayload,
  CreateTimeOffPayload,
  MaterialiseSlotsPayload,
} from "../api/doctor-calendar.api";

export const doctorCalendarKeys = {
  all: ["doctor-calendar"] as const,
  doctors: () => [...doctorCalendarKeys.all, "doctors"] as const,
  staffProfile: (userId: number) => [...doctorCalendarKeys.all, "staff-profile", userId] as const,
  templates: (filters: Record<string, unknown>) =>
    [...doctorCalendarKeys.all, "templates", filters] as const,
  slots: (filters: Record<string, unknown>) =>
    [...doctorCalendarKeys.all, "slots", filters] as const,
  workload: (staffProfileId: number, onDate: string) =>
    [...doctorCalendarKeys.all, "workload", staffProfileId, onDate] as const,
};

// ---------- Doctors ----------

export function useDoctors() {
  return useQuery({
    queryKey: doctorCalendarKeys.doctors(),
    queryFn: () => listDoctors(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useStaffProfile(userId: number) {
  return useQuery({
    queryKey: doctorCalendarKeys.staffProfile(userId),
    queryFn: () => getStaffProfileByUserId(userId),
    enabled: userId > 0,
    staleTime: 5 * 60 * 1000,
  });
}

// ---------- Templates ----------

export function useAvailabilityTemplates(
  params: { staff_profile_id?: number; only_active?: boolean } = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: doctorCalendarKeys.templates(params),
    queryFn: () => listAvailabilityTemplates(params),
    enabled: options.enabled ?? true,
  });
}

export function useCreateAvailabilityTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTemplatePayload) => createAvailabilityTemplate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorCalendarKeys.all });
    },
  });
}

export function useDeactivateAvailabilityTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateId: number) => deactivateAvailabilityTemplate(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorCalendarKeys.all });
    },
  });
}

// ---------- Time off ----------

export function useAddTimeOff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTimeOffPayload) => addTimeOff(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorCalendarKeys.all });
    },
  });
}

// ---------- Slots ----------

export function useCalendarSlots(
  params: {
    staff_profile_id?: number;
    from_dt: string;
    to_dt: string;
    appointment_type?: string;
    only_open?: boolean;
  },
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: doctorCalendarKeys.slots(params),
    queryFn: () => listCalendarSlots(params),
    enabled: options.enabled ?? true,
  });
}

export function useMaterialiseSlots() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MaterialiseSlotsPayload) => materialiseSlots(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorCalendarKeys.all });
    },
  });
}

export function useReserveSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slotId, appointmentId }: { slotId: number; appointmentId: number }) =>
      reserveSlot(slotId, appointmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorCalendarKeys.all });
    },
  });
}

export function useReleaseSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slotId: number) => releaseSlot(slotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doctorCalendarKeys.all });
    },
  });
}

// ---------- Workload ----------

export function useDoctorWorkload(staffProfileId: number, onDate: string) {
  return useQuery({
    queryKey: doctorCalendarKeys.workload(staffProfileId, onDate),
    queryFn: () => getDoctorWorkload(staffProfileId, onDate),
    enabled: staffProfileId > 0,
  });
}
