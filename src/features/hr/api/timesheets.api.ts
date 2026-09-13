import { apiClient } from "@/lib/api/api-client";

export type TimesheetStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "LOCKED";

export type TimesheetEntry = {
  id?: number;
  work_date: string;
  regular_hours: number | string;
  overtime_hours: number | string;
  night_hours: number | string;
  weekend_hours: number | string;
  holiday_hours: number | string;
  is_absent: boolean;
  is_leave?: boolean;
  note?: string | null;
};

// Mirrors TimesheetReadSchema (app/schemas/timesheet_schemas.py)
export type Timesheet = {
  id: number;
  staff_profile_id: number;
  period_start: string;
  period_end: string;
  notes?: string | null;
  total_regular_hours: number | string;
  total_overtime_hours: number | string;
  total_night_hours: number | string;
  total_weekend_hours: number | string;
  total_holiday_hours: number | string;
  absence_days: number;
  status: TimesheetStatus;
  submitted_at?: string | null;
  approved_by_user_id?: number | null;
  approved_at?: string | null;
  locked_at?: string | null;
  approval_request_id?: number | null;
  entries: TimesheetEntry[];
};

export type CreateTimesheetPayload = {
  staff_profile_id: number;
  period_start: string;
  period_end: string;
  notes?: string;
  entries?: Array<Omit<TimesheetEntry, "id">>;
};

export type SelfCreateTimesheetPayload = {
  period_start: string;
  period_end: string;
  notes?: string;
  entries?: Array<Omit<TimesheetEntry, "id">>;
};

export const timesheetsApi = {
  list: (params: { staff_profile_id?: number; skip?: number; limit?: number } = {}) =>
    apiClient
      .get<{ success: boolean; total: number; items: Timesheet[] }>("/timesheets", { params })
      .then((res) => ({ items: res.data.items ?? [], total: res.data.total ?? 0 })),

  create: (payload: CreateTimesheetPayload) =>
    apiClient.post<{ timesheet: Timesheet }>("/timesheets", payload).then((res) => res.data.timesheet),

  get: (id: number) =>
    apiClient.get<{ timesheet: Timesheet }>(`/timesheets/${id}`).then((res) => res.data.timesheet),

  remove: (id: number) => apiClient.delete(`/timesheets/${id}`).then((res) => res.data),

  /** Submit a DRAFT timesheet into the approval engine. flow_id optional → default flow. */
  submit: (id: number, payload: { title: string; flow_id?: number | null; assigned_approver_user_id?: number }) =>
    apiClient
      .post<{ timesheet: Timesheet }>(`/timesheets/${id}/submit`, {
        title: payload.title,
        flow_id: payload.flow_id ?? null,
        assigned_approver_user_id: payload.assigned_approver_user_id,
        submit_now: true,
      })
      .then((res) => res.data.timesheet),

  /** ---- Self-service (current staff acts on their own records) ---- */
  listMine: (params: { skip?: number; limit?: number } = {}) =>
    apiClient
      .get<{ success: boolean; total: number; items: Timesheet[] }>("/timesheets/me", { params })
      .then((res) => ({ items: res.data.items ?? [], total: res.data.total ?? 0 })),

  createMine: (payload: SelfCreateTimesheetPayload) =>
    apiClient
      .post<{ timesheet: Timesheet }>("/timesheets/me", payload)
      .then((res) => res.data.timesheet),

  submitMine: (id: number, payload: { title: string; flow_id?: number | null; assigned_approver_user_id?: number }) =>
    apiClient
      .post<{ timesheet: Timesheet }>(`/timesheets/me/${id}/submit`, {
        title: payload.title,
        flow_id: payload.flow_id ?? null,
        assigned_approver_user_id: payload.assigned_approver_user_id,
        submit_now: true,
      })
      .then((res) => res.data.timesheet),

  removeMine: (id: number) => apiClient.delete(`/timesheets/me/${id}`).then((res) => res.data),
};
