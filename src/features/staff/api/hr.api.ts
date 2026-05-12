import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

export type AttendanceRecord = {
  id: number;
  staff_name: string;
  check_in: string;
  check_out?: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT';
};

export type PayrollRecord = {
  id: number;
  staff_name: string;
  base_salary: number;
  allowances: number;
  deductions: number;
  net_salary: number;
  month: string;
  status: 'PENDING' | 'PROCESSED' | 'PAID';
};

export const hrApi = {
  listAttendance: () =>
    apiClient.get<PaginatedResponse<AttendanceRecord>>("/hr/attendance").then((res) => res.data),
  
  listPayroll: (month: string) =>
    apiClient.get<PaginatedResponse<PayrollRecord>>("/hr/payroll", { params: { month } }).then((res) => res.data),
  
  processPayroll: (payload: { month: string }) =>
    apiClient.post("/hr/payroll/process", payload).then((res) => res.data),
};
