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

export type RestoreRequest = {
  /** The operator must re-type the hospital's workspace code to confirm. */
  confirm_tenant_code: string;
  /** Take a fresh pre-restore snapshot before overwriting (recommended). */
  safety_backup?: boolean;
  /** Drop existing objects before restoring (clean restore). */
  drop_existing?: boolean;
};

export type RestoreResult = {
  success: boolean;
  backup_id: number;
  filename: string;
  restored_at: string;
  duration_ms: number;
  safety_backup_id?: number | null;
};

export const backupsApi = {
  getDashboard: () =>
    apiClient.get<BackupDashboard>("/backups/dashboard").then((res) => ({
      summary: res.data.summary,
      backups: res.data.backups ?? [],
    })),

  trigger: () =>
    apiClient.post("/backups").then((res) => res.data),

  // The artifact is decrypted server-side and streamed back as a restorable
  // .dump, so we pull it as a Blob and surface the server filename when the
  // browser is allowed to read it (Content-Disposition / X-Backup-Filename).
  download: (id: number) =>
    apiClient
      .get(`/backups/${id}/download`, { responseType: "blob" })
      .then((res) => {
        const headers = (res.headers ?? {}) as Record<string, string>;
        const disposition = headers["content-disposition"] ?? "";
        const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
        const filename =
          headers["x-backup-filename"] ||
          (match ? decodeURIComponent(match[1]) : undefined);
        return { blob: res.data as Blob, filename };
      }),

  restore: (id: number, payload: RestoreRequest) =>
    apiClient
      .post<RestoreResult>(`/backups/${id}/restore`, payload)
      .then((res) => res.data),

  remove: (id: number) =>
    apiClient.delete<{ success: boolean; message: string }>(`/backups/${id}`).then((res) => res.data),
};
