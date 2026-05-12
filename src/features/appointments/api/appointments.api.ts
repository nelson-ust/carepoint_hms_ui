import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

export type AppointmentStatus = 'SCHEDULED' | 'CHECKED_IN' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';

export type Appointment = {
  id: number;
  patient_id: number;
  patient_name: string;
  clinician_staff_id: number;
  clinician_name: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  reason?: string;
  created_at: string;
};

export const appointmentsApi = {
  list: (params: { skip?: number; limit?: number; date?: string; clinician_id?: number } = {}) =>
    apiClient.get<PaginatedResponse<Appointment>>("/appointments", { params }).then((res) => res.data),
  
  create: (payload: Partial<Appointment>) =>
    apiClient.post("/appointments", payload).then((res) => res.data),
  
  updateStatus: (id: number, status: AppointmentStatus) =>
    apiClient.patch(`/appointments/${id}/status`, { status }).then((res) => res.data),
  
  cancel: (id: number, reason: string) =>
    apiClient.post(`/appointments/${id}/cancel`, { reason }).then((res) => res.data),
};
