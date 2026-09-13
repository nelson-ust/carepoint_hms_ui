import { apiClient } from "@/lib/api/api-client";

export type LeaveStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

// Mirrors LeaveRequestReadSchema (app/schemas/leave_request_schemas.py)
export type LeaveRequest = {
  id: number;
  staff_profile_id: number;
  leave_type_id: number;
  start_date: string;
  end_date: string;
  days_requested: number | string;
  reason?: string | null;
  handover_notes?: string | null;
  cover_staff_id?: number | null;
  status: LeaveStatus;
  submitted_at?: string | null;
  decided_at?: string | null;
  decided_by_user_id?: number | null;
  decision_note?: string | null;
  approval_request_id?: number | null;
};

export type CreateLeavePayload = {
  staff_profile_id: number;
  leave_type_id: number;
  start_date: string;
  end_date: string;
  days_requested?: number;
  reason?: string;
  handover_notes?: string;
  cover_staff_id?: number;
};

export type SelfCreateLeavePayload = {
  leave_type_id: number;
  start_date: string;
  end_date: string;
  days_requested?: number;
  reason?: string;
  handover_notes?: string;
  cover_staff_id?: number;
};

export type LeaveDay = {
  date: string;
  leave_type_id: number;
  leave_type_name: string;
  leave_request_id: number;
  status: LeaveStatus;
};

// Mirrors the LeaveType model (app/models/all_models.py), served by GET /hr/leave/types.
export type LeaveType = {
  id: number;
  code: string;
  name: string;
  kind?: string;
  default_annual_days?: number | string | null;
  is_paid?: boolean;
  requires_approval?: boolean;
  description?: string | null;
  is_active?: boolean;
};

export const leaveApi = {
  /** Tenant-configured leave types (HR → Leave types). Active-only, name-sorted. */
  listTypes: () =>
    apiClient
      .get<LeaveType[]>("/hr/leave/types")
      .then((res) =>
        (Array.isArray(res.data) ? res.data : [])
          .filter((t) => t.is_active !== false)
          .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
      ),

  list: (params: { staff_profile_id?: number; skip?: number; limit?: number } = {}) =>
    apiClient
      .get<{ success: boolean; total: number; items: LeaveRequest[] }>("/leave-requests", { params })
      .then((res) => ({ items: res.data.items ?? [], total: res.data.total ?? 0 })),

  create: (payload: CreateLeavePayload) =>
    apiClient.post<{ leave_request: LeaveRequest }>("/leave-requests", payload).then((res) => res.data.leave_request),

  get: (id: number) =>
    apiClient.get<{ leave_request: LeaveRequest }>(`/leave-requests/${id}`).then((res) => res.data.leave_request),

  remove: (id: number) => apiClient.delete(`/leave-requests/${id}`).then((res) => res.data),

  /** Submit a DRAFT leave request into the approval engine. flow_id optional → default flow. */
  submit: (id: number, payload: { title: string; flow_id?: number | null; assigned_approver_user_id?: number }) =>
    apiClient
      .post<{ leave_request: LeaveRequest }>(`/leave-requests/${id}/submit`, {
        title: payload.title,
        flow_id: payload.flow_id ?? null,
        assigned_approver_user_id: payload.assigned_approver_user_id,
        submit_now: true,
      })
      .then((res) => res.data.leave_request),

  /** ---- Self-service (current staff acts on their own records) ---- */
  listMine: (params: { skip?: number; limit?: number } = {}) =>
    apiClient
      .get<{ success: boolean; total: number; items: LeaveRequest[] }>("/leave-requests/me", { params })
      .then((res) => ({ items: res.data.items ?? [], total: res.data.total ?? 0 })),

  createMine: (payload: SelfCreateLeavePayload) =>
    apiClient
      .post<{ leave_request: LeaveRequest }>("/leave-requests/me", payload)
      .then((res) => res.data.leave_request),

  submitMine: (id: number, payload: { title: string; flow_id?: number | null; assigned_approver_user_id?: number }) =>
    apiClient
      .post<{ leave_request: LeaveRequest }>(`/leave-requests/me/${id}/submit`, {
        title: payload.title,
        flow_id: payload.flow_id ?? null,
        assigned_approver_user_id: payload.assigned_approver_user_id,
        submit_now: true,
      })
      .then((res) => res.data.leave_request),

  removeMine: (id: number) => apiClient.delete(`/leave-requests/me/${id}`).then((res) => res.data),

  /** Expand my APPROVED leave into individual days within a period (for the timesheet form). */
  myLeaveDays: (start: string, end: string) =>
    apiClient
      .get<{ success: boolean; total: number; items: LeaveDay[] }>("/leave-requests/me/days", { params: { start, end } })
      .then((res) => res.data.items ?? []),
};
