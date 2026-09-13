import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAttendance,
  listHrLeaveRequests,
  listShiftAssignments,
  listShiftDefinitions,
  createShiftDefinition,
  updateShiftDefinition,
  deleteShiftDefinition,
  quickSetupShifts,
  createShiftAssignment,
  updateShiftAssignment,
  deleteShiftAssignment,
  type AttendanceFilters,
  type LeaveRequestStatus,
  type ShiftAssignmentFilters,
  type ShiftDefinitionPayload,
  type ShiftDefinitionUpdatePayload,
  type ShiftQuickSetupPayload,
  type ShiftAssignmentPayload,
  type ShiftAssignmentUpdatePayload,
} from "../api/hr.api";

type ShiftDefinitionFilters = {
  department_id?: number;
  service_delivery_point_id?: number;
};

export const hrKeys = {
  all: ["hr"] as const,
  attendance: (filters: AttendanceFilters) => [...hrKeys.all, "attendance", filters] as const,
  leaveRequests: (filters: { leave_status?: LeaveRequestStatus }) =>
    [...hrKeys.all, "leave-requests", filters] as const,
  shiftDefinitions: (filters: ShiftDefinitionFilters = {}) =>
    [...hrKeys.all, "shift-definitions", filters] as const,
  shiftAssignments: (filters: ShiftAssignmentFilters = {}) =>
    [...hrKeys.all, "shift-assignments", filters] as const,
};

export function useAttendance(params: AttendanceFilters = {}) {
  return useQuery({
    queryKey: hrKeys.attendance(params),
    queryFn: () => listAttendance(params),
  });
}

export function useHrLeaveRequests(params: { leave_status?: LeaveRequestStatus } = {}) {
  return useQuery({
    queryKey: hrKeys.leaveRequests(params),
    queryFn: () => listHrLeaveRequests(params),
  });
}

export function useShiftDefinitions(filters: ShiftDefinitionFilters = {}) {
  return useQuery({
    queryKey: hrKeys.shiftDefinitions(filters),
    queryFn: () => listShiftDefinitions({ ...filters, limit: 200 }),
    staleTime: 60 * 1000,
  });
}

export function useShiftAssignments(params: ShiftAssignmentFilters = {}) {
  return useQuery({
    queryKey: hrKeys.shiftAssignments(params),
    queryFn: () => listShiftAssignments(params),
  });
}

// ── Mutations ────────────────────────────────────────────────────────

function useInvalidateShifts() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [...hrKeys.all, "shift-definitions"] });
    qc.invalidateQueries({ queryKey: [...hrKeys.all, "shift-assignments"] });
  };
}

export function useCreateShiftDefinition() {
  const invalidate = useInvalidateShifts();
  return useMutation({
    mutationFn: (payload: ShiftDefinitionPayload) => createShiftDefinition(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateShiftDefinition() {
  const invalidate = useInvalidateShifts();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ShiftDefinitionUpdatePayload }) =>
      updateShiftDefinition(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteShiftDefinition() {
  const invalidate = useInvalidateShifts();
  return useMutation({
    mutationFn: (id: number) => deleteShiftDefinition(id),
    onSuccess: invalidate,
  });
}

export function useQuickSetupShifts() {
  const invalidate = useInvalidateShifts();
  return useMutation({
    mutationFn: (payload: ShiftQuickSetupPayload) => quickSetupShifts(payload),
    onSuccess: invalidate,
  });
}

export function useCreateShiftAssignment() {
  const invalidate = useInvalidateShifts();
  return useMutation({
    mutationFn: (payload: ShiftAssignmentPayload) => createShiftAssignment(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateShiftAssignment() {
  const invalidate = useInvalidateShifts();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ShiftAssignmentUpdatePayload }) =>
      updateShiftAssignment(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteShiftAssignment() {
  const invalidate = useInvalidateShifts();
  return useMutation({
    mutationFn: (id: number) => deleteShiftAssignment(id),
    onSuccess: invalidate,
  });
}
