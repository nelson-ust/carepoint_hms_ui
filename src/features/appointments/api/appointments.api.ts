import { apiClient } from "@/lib/api/api-client";

export type AppointmentStatus =
  | "SCHEDULED"
  | "ARRIVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "MISSED"
  | "CANCELLED"
  | "RESCHEDULED";

/** Mirrors app/schemas/appointment_schemas.py :: AppointmentReadSchema. */
export type Appointment = {
  id: number;
  appointment_code: string;
  patient_id: number;
  facility_id?: number | null;
  service_delivery_point_id?: number | null;
  staff_profile_id?: number | null;
  scheduled_start_at: string;
  scheduled_end_at?: string | null;
  reason?: string | null;
  status: AppointmentStatus | string;
  patient_name?: string | null;
  patient_phone?: string | null;
  staff_name?: string | null;
  service_delivery_point_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/** Mirrors AppointmentCreateSchema — only patient_id + scheduled_start_at are required. */
export type BookAppointmentPayload = {
  patient_id: number;
  scheduled_start_at: string;
  scheduled_end_at?: string | null;
  staff_profile_id?: number | null;
  service_delivery_point_id?: number | null;
  facility_id?: number | null;
  reason?: string | null;
};

export type AppointmentListParams = {
  skip?: number;
  limit?: number;
  /** SCHEDULED / ARRIVED / IN_PROGRESS / COMPLETED / MISSED / CANCELLED / RESCHEDULED */
  status?: string;
  /** Earliest scheduled_start_at (ISO). */
  from_dt?: string;
  /** Latest exclusive scheduled_start_at (ISO). */
  to_dt?: string;
  patient_id?: number;
  staff_profile_id?: number;
  service_delivery_point_id?: number;
  facility_id?: number;
};

export type AppointmentListResult = {
  items: Appointment[];
  total: number;
  meta?: {
    total?: number;
    skip?: number;
    limit?: number;
    total_pages?: number;
    has_next?: boolean;
    has_previous?: boolean;
  };
};

function cleanParams(params: AppointmentListParams): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  });
  return out;
}

export const appointmentsApi = {
  list: (params: AppointmentListParams = {}): Promise<AppointmentListResult> =>
    apiClient
      .get("/appointments/", { params: cleanParams(params) })
      .then((res) => {
        const d = (res.data ?? {}) as any;
        const items: Appointment[] = Array.isArray(d.items) ? d.items : [];
        const total: number =
          typeof d?.meta?.total === "number" ? d.meta.total : d.count ?? items.length;
        return { items, total, meta: d.meta };
      }),

  book: (payload: BookAppointmentPayload) =>
    apiClient.post("/appointments/", payload).then((res) => res.data),

  cancel: (id: number, reason?: string) =>
    apiClient.post(`/appointments/${id}/cancel`, { reason }).then((res) => res.data),

  noShow: (id: number, reason?: string) =>
    apiClient.post(`/appointments/${id}/no-show`, { reason }).then((res) => res.data),

  /**
   * Check in an appointment and (by default) initiate the visit. The backend
   * only allows this on the appointment's scheduled date.
   */
  checkIn: (
    id: number,
    payload: {
      initiate_visit?: boolean;
      use_appointment_service_point?: boolean;
      visit_reason?: string;
      fast_track?: boolean;
      visit_flow_template_id?: number;
    } = {},
  ): Promise<AppointmentCheckInResult> =>
    apiClient
      .post(`/appointments/${id}/check-in`, { initiate_visit: true, ...payload })
      .then((res) => res.data as AppointmentCheckInResult),
};

export type AppointmentCheckInResult = {
  success: boolean;
  message: string;
  appointment: Appointment;
  visit_id?: number | null;
  visit_code?: string | null;
  queue_number?: string | null;
};

/** True when the appointment's scheduled date is today (browser-local). */
export function isAppointmentToday(a: Appointment): boolean {
  const d = new Date(a.scheduled_start_at);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/**
 * A visit can be started from an appointment only when it is still open
 * (SCHEDULED/ARRIVED) and scheduled for today. The backend enforces the same
 * rule; this just governs whether the button is shown/enabled.
 */
export function canStartVisit(a: Appointment): boolean {
  return (a.status === "SCHEDULED" || a.status === "ARRIVED") && isAppointmentToday(a);
}

export const APPOINTMENT_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "ARRIVED", label: "Arrived" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "MISSED", label: "Missed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "RESCHEDULED", label: "Rescheduled" },
];

export function appointmentStatusLabel(status: string): string {
  return (
    APPOINTMENT_STATUS_OPTIONS.find((o) => o.value === status)?.label ??
    status.replace(/_/g, " ")
  );
}
