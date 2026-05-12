import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

export type TimesheetEntry = {
  work_date: string;
  regular_hours: number;
  overtime_hours: number;
  night_hours: number;
  weekend_hours: number;
  holiday_hours: number;
  is_absent: boolean;
  note: string;
};

export type Timesheet = {
  id: number;
  staff_profile_id: number;
  staff_name: string;
  period_start: string;
  period_end: string;
  notes: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  entries: TimesheetEntry[];
  created_at: string;
};

export const timesheetsApi = {
  list: (params: { skip?: number; limit?: number; staff_id?: number } = {}) =>
    apiClient.get<PaginatedResponse<Timesheet>>("/timesheets", { params }).then((res) => res.data),
  
  create: (payload: Partial<Timesheet>) =>
    apiClient.post("/timesheets", payload).then((res) => res.data),
  
  update: (id: number, payload: Partial<Timesheet>) =>
    apiClient.put(`/timesheets/${id}`, payload).then((res) => res.data),
  
  approve: (id: number) =>
    apiClient.post(`/timesheets/${id}/approve`).then((res) => res.data),
};
