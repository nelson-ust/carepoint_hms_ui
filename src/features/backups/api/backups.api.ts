import { apiClient } from "@/lib/api/api-client";

// Mirrors DatabaseBackupReadSchema (tenant_backup_routes.py → /backups/dashboard).
export type Backup = {
  id: number;
  filename: string;
  s3_url?: string | null;
  s3_key?: string | null;
  size_bytes?: number | null;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  storage_location: string;
  error_message?: string | null;
  backup_type: string;
  backup_started_at?: string | null;
  backup_finished_at?: string | null;
  retention_until?: string | null;
  triggered_by: string;
  date_created: string;
};

// Mirrors BackupSummarySchema.
export type BackupSummary = {
  health_status: string;
  health_description: string;
  last_backup_at?: string | null;
  next_backup_scheduled_at?: string | null;
  retention_policy: string;
  storage_usage_gb: number;
  recovery_points_count: number;
};

export type BackupDashboard = {
  summary: BackupSummary;
  backups: Backup[];
};

export const backupsApi = {
  getDashboard: () =>
    apiClient.get<BackupDashboard>("/backups/dashboard").then((res) => ({
      summary: res.data.summary,
      backups: res.data.backups ?? [],
    })),

  trigger: () =>
    apiClient.post("/backups").then((res) => res.data),

  download: (id: number) =>
    apiClient.get(`/backups/${id}/download`).then((res) => res.data),
};
