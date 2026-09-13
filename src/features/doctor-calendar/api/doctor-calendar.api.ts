import { apiClient } from "@/lib/api/api-client";

// ============================================================
// Types — mirror app/api/v1/endpoints/doctor_calendar_routes.py
// ============================================================

export type DoctorAvailabilityType = "REGULAR" | "OVERRIDE" | "BLOCKED";

export type AppointmentSlotStatus = "OPEN" | "BOOKED" | "BLOCKED" | "EXPIRED";

export type AvailabilityTemplate = {
  id: number;
  staff_profile_id: number;
  /** 0 = Monday … 6 = Sunday */
  weekday: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  max_patients_per_slot: number;
  appointment_type?: string | null;
  facility_id?: number | null;
  service_delivery_point_id?: number | null;
  is_active: boolean;
  timezone?: string | null;
  notes?: string | null;
};

export type CreateTemplatePayload = {
  staff_profile_id: number;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes?: number;
  max_patients_per_slot?: number;
  appointment_type?: string;
  facility_id?: number;
  service_delivery_point_id?: number;
  timezone_name?: string;
  notes?: string;
};

export type TimeOff = {
  id: number;
  staff_profile_id: number;
  starts_at: string;
  ends_at: string;
  availability_type: DoctorAvailabilityType;
  reason?: string | null;
  approved_by_user_id?: number | null;
};

export type CreateTimeOffPayload = {
  staff_profile_id: number;
  starts_at: string;
  ends_at: string;
  availability_type?: DoctorAvailabilityType;
  reason?: string;
  approved_by_user_id?: number;
};

export type CalendarSlot = {
  id: number;
  staff_profile_id: number;
  facility_id?: number | null;
  service_delivery_point_id?: number | null;
  appointment_id?: number | null;
  starts_at: string;
  ends_at: string;
  capacity: number;
  booked_count: number;
  appointment_type?: string | null;
  status: AppointmentSlotStatus;
  block_reason?: string | null;
};

export type MaterialiseSlotsPayload = {
  staff_profile_id: number;
  /** ISO date, e.g. 2026-07-13 */
  from_date: string;
  /** ISO date, e.g. 2026-07-19 */
  through_date: string;
};

export type DoctorWorkload = Record<string, unknown> & {
  total_slots?: number;
  booked?: number;
  open?: number;
};

// Doctors are sourced from the staff module (GET /staff/ lists users; the
// detail endpoint exposes the staff_profile_id the calendar endpoints need).
export type StaffUser = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  staff_no?: string | null;
  department_id?: number | null;
  role_count?: number;
};

export type StaffProfileDetail = {
  /** The staff_profile_id used by doctor-calendar endpoints. */
  id: number;
  user_id: number;
  staff_no: string;
  job_title?: string | null;
  specialty?: string | null;
  department_id?: number | null;
  facility_id?: number | null;
  user?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
};

// ============================================================
// Envelope normalization
// ============================================================

/** Lists come back either bare (`[...]`) or wrapped (`{ success, items }`). */
function normalizeArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const items = (data as { items?: unknown }).items;
    if (Array.isArray(items)) return items as T[];
  }
  return [];
}

function unwrap<T>(data: unknown, key: string): T {
  if (data && typeof data === "object" && key in (data as Record<string, unknown>)) {
    return (data as Record<string, unknown>)[key] as T;
  }
  return data as T;
}

// ============================================================
// Availability templates
// ============================================================

export async function listAvailabilityTemplates(
  params: { staff_profile_id?: number; only_active?: boolean } = {},
): Promise<AvailabilityTemplate[]> {
  const response = await apiClient.get("/doctor-calendar/templates", { params });
  return normalizeArray<AvailabilityTemplate>(response.data);
}

export async function createAvailabilityTemplate(
  payload: CreateTemplatePayload,
): Promise<AvailabilityTemplate> {
  const response = await apiClient.post("/doctor-calendar/templates", payload);
  return unwrap<AvailabilityTemplate>(response.data, "template");
}

export async function deactivateAvailabilityTemplate(
  templateId: number,
): Promise<AvailabilityTemplate> {
  const response = await apiClient.post(`/doctor-calendar/templates/${templateId}/deactivate`);
  return unwrap<AvailabilityTemplate>(response.data, "template");
}

// ============================================================
// Time off (block calendar)
// ============================================================

export async function addTimeOff(payload: CreateTimeOffPayload): Promise<TimeOff> {
  const response = await apiClient.post("/doctor-calendar/time-off", payload);
  return unwrap<TimeOff>(response.data, "time_off");
}

// ============================================================
// Slots
// ============================================================

export async function materialiseSlots(
  payload: MaterialiseSlotsPayload,
): Promise<{ created: number }> {
  const response = await apiClient.post("/doctor-calendar/slots/materialise", payload);
  const data = response.data as { created?: number };
  return { created: data?.created ?? 0 };
}

export async function listCalendarSlots(params: {
  staff_profile_id?: number;
  from_dt: string;
  to_dt: string;
  appointment_type?: string;
  only_open?: boolean;
}): Promise<CalendarSlot[]> {
  const response = await apiClient.get("/doctor-calendar/slots", { params });
  return normalizeArray<CalendarSlot>(response.data);
}

export async function reserveSlot(slotId: number, appointmentId: number): Promise<CalendarSlot> {
  const response = await apiClient.post(
    `/doctor-calendar/slots/${slotId}/reserve`,
    undefined,
    { params: { appointment_id: appointmentId } },
  );
  return unwrap<CalendarSlot>(response.data, "slot");
}

export async function releaseSlot(slotId: number): Promise<CalendarSlot> {
  const response = await apiClient.post(`/doctor-calendar/slots/${slotId}/release`);
  return unwrap<CalendarSlot>(response.data, "slot");
}

// ============================================================
// Workload
// ============================================================

export async function getDoctorWorkload(
  staffProfileId: number,
  onDate: string,
): Promise<DoctorWorkload> {
  const response = await apiClient.get(`/doctor-calendar/workload/${staffProfileId}`, {
    params: { on_date: onDate },
  });
  return (response.data ?? {}) as DoctorWorkload;
}

// ============================================================
// Doctors (staff module)
// ============================================================

export async function listDoctors(
  params: { skip?: number; limit?: number } = {},
): Promise<StaffUser[]> {
  const { skip = 0, limit = 200 } = params;
  const response = await apiClient.get("/staff/", { params: { skip, limit } });
  return normalizeArray<StaffUser>(response.data);
}

/** Resolve a user id to their staff profile (calendar APIs key on staff_profile_id). */
export async function getStaffProfileByUserId(userId: number): Promise<StaffProfileDetail> {
  const response = await apiClient.get(`/staff/${userId}`);
  return unwrap<StaffProfileDetail>(response.data, "staff_profile");
}
