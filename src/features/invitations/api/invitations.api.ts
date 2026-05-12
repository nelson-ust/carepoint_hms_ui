import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

// ---------- Types ----------

export type Invitation = {
  id: number;
  email: string;
  role_id: number;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
  invited_by_staff_id: number;
  expires_at: string;
  created_at: string;
  updated_at: string;
  
  // Enriched fields
  role?: { id: number; name: string };
  inviter?: { id: number; first_name: string; last_name: string };
};

// ---------- Payloads ----------

export type CreateInvitationPayload = {
  email: string;
  role_id: number;
  notes?: string;
};

export type AcceptInvitationPayload = {
  token: string;
  password?: string;
  first_name?: string;
  last_name?: string;
};

// ---------- Endpoints ----------

export const invitationsApi = {
  list: (params: { skip?: number; limit?: number; status?: string } = {}) =>
    apiClient.get<PaginatedResponse<Invitation>>("/invitations/", { params }).then((res) => res.data),
  
  create: (payload: CreateInvitationPayload) =>
    apiClient.post<{ success: boolean; message: string; invitation: Invitation }>("/invitations/", payload).then((res) => res.data),
  
  cancel: (id: number) =>
    apiClient.post<{ success: boolean; message: string }>("/invitations/" + id + "/cancel").then((res) => res.data),
  
  resend: (id: number) =>
    apiClient.post<{ success: boolean; message: string }>("/invitations/" + id + "/resend").then((res) => res.data),
  
  sweep: () =>
    apiClient.post<{ success: boolean; message: string }>("/invitations/sweep").then((res) => res.data),
  
  accept: (payload: AcceptInvitationPayload) =>
    apiClient.post<{ success: boolean; message: string }>("/invitations/accept", payload).then((res) => res.data),
};
