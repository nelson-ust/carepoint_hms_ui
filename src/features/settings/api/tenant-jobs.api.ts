import { apiClient } from "@/lib/api/api-client";

// ---------- Types ----------
// These mirror the backend contract in tenant_job_routes.py:
//   GET /tenant-jobs           -> JobReadSchema[]            (a plain array)
//   GET /tenant-jobs/handlers  -> { name, description }[]    (a plain array)

export type TenantJob = {
  id: number;
  job_code: string;
  handler: string;
  schedule_cron?: string | null;
  schedule_interval_minutes?: number | null;
  params?: Record<string, unknown> | null;
  is_enabled: boolean;
  last_run_at?: string | null;
  next_run_at?: string | null;
  last_status?: string | null;
  last_error?: string | null;
  last_duration_ms?: number | null;
  run_count: number;
  timezone?: string | null;
  consecutive_failures?: number | null;
  max_failures?: number | null;
  locked_at?: string | null;
};

export type JobHandler = {
  name: string;
  description: string;
};

export type JobCreatePayload = {
  job_code: string;
  handler: string;
  schedule_cron?: string | null;
  schedule_interval_minutes?: number | null;
  params?: Record<string, unknown> | null;
  is_enabled?: boolean;
  timezone?: string | null;
  max_failures?: number | null;
};

export type JobUpdatePayload = Partial<Omit<JobCreatePayload, "job_code" | "handler">>;

// ---------- Endpoints ----------

export const tenantJobsApi = {
  // The endpoint returns a plain array; `?? []` keeps the UI safe even if a
  // proxy or error page ever hands back something unexpected.
  listHandlers: () =>
    apiClient
      .get<JobHandler[]>("/tenant-jobs/handlers")
      .then((res) => (Array.isArray(res.data) ? res.data : [])),

  listJobs: () =>
    apiClient
      .get<TenantJob[]>("/tenant-jobs")
      .then((res) => (Array.isArray(res.data) ? res.data : [])),

  create: (payload: JobCreatePayload) =>
    apiClient.post<TenantJob>("/tenant-jobs", payload).then((res) => res.data),

  update: (id: number, payload: JobUpdatePayload) =>
    apiClient.put<TenantJob>(`/tenant-jobs/${id}`, payload).then((res) => res.data),

  runNow: (id: number) =>
    apiClient.post<TenantJob>(`/tenant-jobs/${id}/run`).then((res) => res.data),

  delete: (id: number) =>
    apiClient.delete(`/tenant-jobs/${id}`).then((res) => res.data),
};
