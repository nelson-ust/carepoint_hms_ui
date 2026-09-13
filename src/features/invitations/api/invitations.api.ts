import { apiClient } from "@/lib/api/api-client";

// ---------- Types (mirror app/api/v1/endpoints/invitation_routes.py) ----------

export type InvitationStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";

export type Invitation = {
  id: number;
  email?: string | null;
  phone_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  status: InvitationStatus;
  expires_at: string;
  role_ids?: number[] | null;
  invited_by_user_id?: number | null;
  accepted_by_user_id?: number | null;
  accepted_at?: string | null;
  cancelled_at?: string | null;
  last_sent_at?: string | null;
  resend_count: number;
  date_created?: string | null;
};

export type CreateInvitationPayload = {
  email?: string;
  phone_number?: string;
  first_name?: string;
  last_name?: string;
  role_ids?: number[];
  /** 1–30 days; backend default applies when omitted. */
  expiry_days?: number;
};

export type InvitationCreateResponse = {
  invitation: Invitation;
  /** Plain token — returned so the inviter can copy/paste if email is down. */
  token: string;
  accept_url?: string | null;
};

export type AcceptInvitationPayload = {
  token: string;
  username: string;
  password: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
};

// ---------- Helpers ----------

/** The list endpoint returns a bare array; tolerate an envelope too. */
function normalizeList(data: unknown): Invitation[] {
  if (Array.isArray(data)) return data as Invitation[];
  const anyData = data as { items?: unknown };
  if (Array.isArray(anyData?.items)) return anyData.items as Invitation[];
  return [];
}

/**
 * Build a shareable accept link, preferring the backend-configured base URL.
 * The tenant code is embedded so the anonymous invitee's browser can send
 * X-Tenant-Code when accepting (the endpoint needs tenant context).
 */
export function buildAcceptUrl(token: string, backendUrl?: string | null): string {
  if (backendUrl) return backendUrl;
  const tenant = localStorage.getItem("carepoint.tenant_code") ?? "";
  const qs = new URLSearchParams({ token });
  if (tenant) qs.set("tenant", tenant);
  return `${window.location.origin}/invitations/accept?${qs.toString()}`;
}

export function invitationRecipient(inv: Invitation): string {
  return inv.email || inv.phone_number || "—";
}

export function invitationName(inv: Invitation): string {
  const name = [inv.first_name, inv.last_name].filter(Boolean).join(" ").trim();
  return name || "—";
}

// ---------- Endpoints (paths have NO trailing slash — avoids 307 redirects) ----------

export const invitationsApi = {
  list: (params: { status?: InvitationStatus } = {}) =>
    apiClient
      .get<unknown>("/invitations", {
        params: params.status ? { invitation_status: params.status } : {},
      })
      .then((res) => normalizeList(res.data)),

  create: (payload: CreateInvitationPayload) =>
    apiClient
      .post<InvitationCreateResponse>("/invitations", payload)
      .then((res) => res.data),

  cancel: (id: number) =>
    apiClient.post<Invitation>(`/invitations/${id}/cancel`).then((res) => res.data),

  resend: (id: number) =>
    apiClient
      .post<InvitationCreateResponse>(`/invitations/${id}/resend`)
      .then((res) => res.data),

  sweep: () =>
    apiClient
      .post<{ success?: boolean; message?: string }>("/invitations/sweep")
      .then((res) => res.data),

  accept: (payload: AcceptInvitationPayload, tenantCode?: string) =>
    apiClient
      .post<{ success: boolean; message: string; user?: { id: number; username: string; email?: string } }>(
        "/invitations/accept",
        payload,
        tenantCode ? { headers: { "X-Tenant-Code": tenantCode } } : undefined,
      )
      .then((res) => res.data),
};
