import { apiClient } from "@/lib/api/api-client";

// =====================================================================
// Attendance (hr_routes.py — /hr/attendance, returns bare arrays)
// =====================================================================

export type AttendanceMethod = "MANUAL" | "BIOMETRIC" | "QR_CODE" | "MOBILE" | "DEVICE";

export type AttendanceRecord = {
  id: number;
  staff_profile_id: number;
  duty_assignment_id?: number | null;
  work_date: string;
  clock_in_at?: string | null;
  clock_out_at?: string | null;
  method: AttendanceMethod;
  device_identifier?: string | null;
  location?: string | null;
  is_late: boolean;
  is_absent: boolean;
  minutes_late: number;
  minutes_overtime: number;
  note?: string | null;
  created_at?: string;
};

export type AttendanceFilters = {
  staff_profile_id?: number;
  from_date?: string;
  to_date?: string;
};

/** Accept a bare array or the `{ items: [...] }` envelope. */
function asArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const items = (data as { items?: unknown })?.items;
  if (Array.isArray(items)) return items as T[];
  return [];
}

export async function listAttendance(params: AttendanceFilters = {}): Promise<AttendanceRecord[]> {
  const response = await apiClient.get<unknown>("/hr/attendance", { params });
  return asArray<AttendanceRecord>(response.data);
}

export type ClockInPayload = {
  staff_profile_id: number;
  method?: AttendanceMethod;
  location?: string;
  when?: string;
};

export async function clockIn(payload: ClockInPayload): Promise<AttendanceRecord> {
  const response = await apiClient.post<AttendanceRecord>("/hr/attendance/clock-in", payload);
  return response.data;
}

export async function clockOut(payload: {
  attendance_record_id: number;
  when?: string;
}): Promise<AttendanceRecord> {
  const response = await apiClient.post<AttendanceRecord>("/hr/attendance/clock-out", payload);
  return response.data;
}

// =====================================================================
// Leave requests (hr_routes.py — /hr/leave/requests, bare arrays)
// =====================================================================

export type LeaveRequestStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type HrLeaveRequest = {
  id: number;
  staff_profile_id: number;
  leave_type_id: number;
  start_date: string;
  end_date: string;
  reason?: string | null;
  status: LeaveRequestStatus;
  created_at?: string;
};

export async function listHrLeaveRequests(
  params: { staff_profile_id?: number; leave_status?: LeaveRequestStatus } = {},
): Promise<HrLeaveRequest[]> {
  const response = await apiClient.get<unknown>("/hr/leave/requests", { params });
  return asArray<HrLeaveRequest>(response.data);
}

// =====================================================================
// Shifts (shift_routes.py — /shifts, `{success, items, count}` envelope)
// =====================================================================

export type StaffShiftType =
  | "MORNING"
  | "AFTERNOON"
  | "NIGHT"
  | "WEEKEND"
  | "EMERGENCY"
  | "ON_CALL"
  | "OFF_DUTY";

export type ShiftStatus = "SCHEDULED" | "ON_DUTY" | "COMPLETED" | "MISSED" | "CANCELLED";

export type ShiftDefinition = {
  id: number;
  name: string;
  code: string;
  shift_type: StaffShiftType;
  start_time: string; // "HH:MM:SS"
  end_time: string;
  break_duration_minutes: number;
  color_hex?: string | null;
  description?: string | null;
  department_id: number;
  /** Optional "unit" scope — a service delivery point within the department. */
  service_delivery_point_id?: number | null;
  department_name?: string | null;
  service_delivery_point_name?: string | null;
};

export type ShiftAssignment = {
  id: number;
  staff_profile_id: number;
  shift_definition_id: number;
  shift_date: string;
  status: ShiftStatus;
  check_in_at?: string | null;
  check_out_at?: string | null;
  assigned_by_user_id?: number | null;
  notes?: string | null;
};

type ShiftListEnvelope<T> = {
  success?: boolean;
  items?: T[];
  count?: number;
};

export async function listShiftDefinitions(
  params: {
    department_id?: number;
    service_delivery_point_id?: number;
    skip?: number;
    limit?: number;
  } = {},
): Promise<{ items: ShiftDefinition[]; count: number }> {
  const { skip = 0, limit = 100, department_id, service_delivery_point_id } = params;
  const response = await apiClient.get<ShiftListEnvelope<ShiftDefinition>>("/shifts/definitions", {
    params: { skip, limit, department_id, service_delivery_point_id },
  });
  const items = asArray<ShiftDefinition>(response.data);
  return { items, count: response.data?.count ?? items.length };
}

export type ShiftAssignmentFilters = {
  department_id?: number;
  staff_profile_id?: number;
  service_delivery_point_id?: number;
  date_from?: string;
  date_to?: string;
  skip?: number;
  limit?: number;
};

export async function listShiftAssignments(
  params: ShiftAssignmentFilters = {},
): Promise<{ items: ShiftAssignment[]; count: number }> {
  const {
    skip = 0,
    limit = 100,
    department_id,
    staff_profile_id,
    service_delivery_point_id,
    date_from,
    date_to,
  } = params;
  const response = await apiClient.get<ShiftListEnvelope<ShiftAssignment>>("/shifts/assignments", {
    params: {
      skip,
      limit,
      department_id,
      staff_profile_id,
      service_delivery_point_id,
      date_from,
      date_to,
    },
  });
  const items = asArray<ShiftAssignment>(response.data);
  return { items, count: response.data?.count ?? items.length };
}

// ---------------------------------------------------------------------
// Shift writes (create / update / delete definitions & assignments)
// ---------------------------------------------------------------------

export type ShiftDefinitionPayload = {
  name: string;
  code: string;
  shift_type: StaffShiftType;
  start_time: string; // "HH:MM" or "HH:MM:SS"
  end_time: string;
  break_duration_minutes?: number;
  color_hex?: string | null;
  description?: string | null;
  department_id: number;
  service_delivery_point_id?: number | null;
};

export type ShiftDefinitionUpdatePayload = Partial<
  Omit<ShiftDefinitionPayload, "department_id" | "code">
> & {
  service_delivery_point_id?: number | null;
};

export async function createShiftDefinition(
  payload: ShiftDefinitionPayload,
): Promise<ShiftDefinition> {
  const response = await apiClient.post<{ definition: ShiftDefinition }>(
    "/shifts/definitions",
    payload,
  );
  return response.data.definition;
}

export async function updateShiftDefinition(
  id: number,
  payload: ShiftDefinitionUpdatePayload,
): Promise<ShiftDefinition> {
  const response = await apiClient.patch<{ definition: ShiftDefinition }>(
    `/shifts/definitions/${id}`,
    payload,
  );
  return response.data.definition;
}

export async function deleteShiftDefinition(id: number): Promise<void> {
  await apiClient.delete(`/shifts/definitions/${id}`);
}

export type ShiftQuickSetupPayload = {
  department_id: number;
  service_delivery_point_id?: number | null;
  preset: "TWO" | "THREE";
  replace_existing?: boolean;
};

export async function quickSetupShifts(
  payload: ShiftQuickSetupPayload,
): Promise<{ items: ShiftDefinition[]; count: number }> {
  const response = await apiClient.post<ShiftListEnvelope<ShiftDefinition>>(
    "/shifts/definitions/quick-setup",
    payload,
  );
  const items = asArray<ShiftDefinition>(response.data);
  return { items, count: response.data?.count ?? items.length };
}

export type ShiftAssignmentPayload = {
  staff_profile_id: number;
  shift_definition_id: number;
  shift_date: string; // "YYYY-MM-DD"
  notes?: string | null;
};

export type ShiftAssignmentUpdatePayload = {
  shift_definition_id?: number;
  shift_date?: string;
  status?: ShiftStatus;
  notes?: string | null;
};

export async function createShiftAssignment(
  payload: ShiftAssignmentPayload,
): Promise<ShiftAssignment> {
  const response = await apiClient.post<{ assignment: ShiftAssignment }>(
    "/shifts/assignments",
    payload,
  );
  return response.data.assignment;
}

export async function updateShiftAssignment(
  id: number,
  payload: ShiftAssignmentUpdatePayload,
): Promise<ShiftAssignment> {
  const response = await apiClient.patch<{ assignment: ShiftAssignment }>(
    `/shifts/assignments/${id}`,
    payload,
  );
  return response.data.assignment;
}

export async function deleteShiftAssignment(id: number): Promise<void> {
  await apiClient.delete(`/shifts/assignments/${id}`);
}
