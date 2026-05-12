import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

// ---------- Types ----------

export type EmailConfig = {
  id: number;
  provider_name: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  sender_email: string;
  sender_name: string;
  is_active: boolean;
  use_tls: boolean;
  created_at: string;
  updated_at: string;
};

// ---------- Payloads ----------

export type CreateEmailConfigPayload = Omit<EmailConfig, "id" | "created_at" | "updated_at"> & {
  smtp_password?: string;
};

export type UpdateEmailConfigPayload = Partial<CreateEmailConfigPayload>;

// ---------- Endpoints ----------

export const emailSettingsApi = {
  list: () =>
    apiClient.get<PaginatedResponse<EmailConfig>>("/tenant-email-config").then((res) => res.data),
  
  create: (payload: CreateEmailConfigPayload) =>
    apiClient.post<{ success: boolean; message: string; config: EmailConfig }>("/tenant-email-config", payload).then((res) => res.data),
  
  update: (id: number, payload: UpdateEmailConfigPayload) =>
    apiClient.put<{ success: boolean; message: string; config: EmailConfig }>(`/tenant-email-config/${id}`, payload).then((res) => res.data),
  
  delete: (id: number) =>
    apiClient.delete(`/tenant-email-config/${id}`).then((res) => res.data),
  
  test: (id: number) =>
    apiClient.post<{ success: boolean; message: string }>(`/tenant-email-config/${id}/test`).then((res) => res.data),
  
  sendTestEmail: (id: number, email: string) =>
    apiClient.post<{ success: boolean; message: string }>(`/tenant-email-config/${id}/send-test`, { email }).then((res) => res.data),
};
