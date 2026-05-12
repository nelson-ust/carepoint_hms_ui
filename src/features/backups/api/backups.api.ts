import { apiClient } from "@/lib/api/api-client";

export type Backup = {
  id: number;
  filename: string;
  s3_url?: string;
  size_bytes: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  created_at: string;
};

export const backupsApi = {
  list: () =>
    apiClient.get<Backup[]>("/backups/").then((res) => res.data),
  
  trigger: () =>
    apiClient.post<{ success: boolean; backup: Backup }>("/backups/").then((res) => res.data),
  
  download: (id: number) =>
    apiClient.get(`/backups/${id}/download/`).then((res) => res.data),
};
