import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

// ---------- Types ----------

export type TenantJob = {
  id: number;
  job_name: string;
  handler_name: string;
  schedule_type: "CRON" | "INTERVAL";
  schedule_value: string;
  is_active: boolean;
  last_run_at?: string;
  next_run_at?: string;
  created_at: string;
};

export type JobHandler = {
  name: string;
  description: string;
};

// ---------- Endpoints ----------

export const tenantJobsApi = {
  listHandlers: () =>
    apiClient.get<JobHandler[]>("/tenant-jobs/handlers").then((res) => res.data),
  
  listJobs: () =>
    apiClient.get<PaginatedResponse<TenantJob>>("/tenant-jobs").then((res) => res.data),
  
  create: (payload: any) =>
    apiClient.post<{ success: boolean; message: string; job: TenantJob }>("/tenant-jobs", payload).then((res) => res.data),
  
  update: (id: number, payload: any) =>
    apiClient.put<{ success: boolean; message: string; job: TenantJob }>(`/tenant-jobs/${id}`, payload).then((res) => res.data),
  
  delete: (id: number) =>
    apiClient.delete(`/tenant-jobs/${id}`).then((res) => res.data),
};
