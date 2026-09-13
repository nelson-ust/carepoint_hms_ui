import axios from "axios";
import { apiClient } from "@/lib/api/api-client";
import { env } from "@/config/env";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type DevScope = { code: string; description: string };

export type DevApp = {
  id: number;
  developer_account_id: number;
  name: string;
  environment: "SANDBOX" | "LIVE";
  status: "ACTIVE" | "REVOKED";
  key_prefix: string;
  scopes: string[];
  expires_at?: string | null;
  last_used_at?: string | null;
  created_at?: string | null;
  api_key?: string; // present only on create/rotate responses
};

export type DevAccount = {
  id: number;
  organization_name: string;
  contact_name: string;
  email: string;
  website?: string | null;
  description?: string | null;
  status: string;
  email_verified: boolean;
  created_at?: string | null;
  apps?: DevApp[];
};

export type DevGrant = {
  id: number;
  developer_app_id: number;
  developer_account_id: number;
  tenant_id: number;
  tenant_name?: string | null;
  status: "PENDING" | "APPROVED" | "REVOKED" | "DENIED";
  requested_scopes: string[];
  approved_scopes: string[];
  justification?: string | null;
  requested_at?: string | null;
  decided_at?: string | null;
  decision_note?: string | null;
  developer?: DevAccount | null;
  app_name?: string | null;
  app_environment?: string | null;
};

// ---------------------------------------------------------------------------
// Dashboard-token client (used by 3rd-party developers; NOT hospital JWT).
// Kept separate from apiClient so a 401 here never bounces to the staff login.
// ---------------------------------------------------------------------------
const DEV_TOKEN_KEY = "carepoint.developer.dashboardToken";

export const developerToken = {
  get: () => {
    try { return localStorage.getItem(DEV_TOKEN_KEY) || ""; } catch { return ""; }
  },
  set: (t: string) => {
    try { localStorage.setItem(DEV_TOKEN_KEY, t); } catch { /* ignore */ }
  },
  clear: () => {
    try { localStorage.removeItem(DEV_TOKEN_KEY); } catch { /* ignore */ }
  },
};

const devClient = axios.create({
  baseURL: env.apiBaseUrl,
  headers: { "Content-Type": "application/json" },
});

devClient.interceptors.request.use((config) => {
  const token = developerToken.get();
  if (token) config.headers["X-Developer-Token"] = token;
  return config;
});

function errMsg(e: any, fallback: string): string {
  return e?.response?.data?.detail || e?.response?.data?.message || fallback;
}

// ---------------------------------------------------------------------------
// Public + portal (developer-facing)
// ---------------------------------------------------------------------------
export const developerApi = {
  scopes: () =>
    devClient.get("/developer/public/scopes").then((r) => (r.data?.scopes ?? []) as DevScope[]),

  register: (payload: {
    organization_name: string; contact_name: string; email: string;
    website?: string; description?: string;
  }) => devClient.post("/developer/public/register", payload).then((r) => r.data),

  verify: (payload: { email: string; token: string }) =>
    devClient.post("/developer/public/verify", payload).then((r) => r.data),

  resend: (email: string) =>
    devClient.post("/developer/public/resend-verification", { email }).then((r) => r.data),

  me: () => devClient.get("/developer/portal/me").then((r) => r.data?.account as DevAccount),

  listApps: () => devClient.get("/developer/portal/apps").then((r) => (r.data?.items ?? []) as DevApp[]),

  createApp: (payload: { name: string; environment: string; scopes: string[] }) =>
    devClient.post("/developer/portal/apps", payload).then((r) => r.data?.app as DevApp),

  rotateKey: (appId: number) =>
    devClient.post(`/developer/portal/apps/${appId}/rotate-key`, {}).then((r) => r.data?.app as DevApp),

  revokeApp: (appId: number) =>
    devClient.post(`/developer/portal/apps/${appId}/revoke`, {}).then((r) => r.data?.app as DevApp),

  listGrants: () => devClient.get("/developer/portal/grants").then((r) => (r.data?.items ?? []) as DevGrant[]),

  requestGrant: (payload: { app_id: number; tenant_code: string; requested_scopes?: string[]; justification?: string }) =>
    devClient.post("/developer/portal/grants", payload).then((r) => r.data?.grant as DevGrant),

  errMsg,
};

// ---------------------------------------------------------------------------
// Admin (hospital staff, JWT) — governance of developer access
// ---------------------------------------------------------------------------
export const developerAdminApi = {
  listGrants: (status?: string) =>
    apiClient.get("/admin/developer/grants", { params: status ? { status } : {} })
      .then((r) => (r.data?.items ?? []) as DevGrant[]),

  decide: (grantId: number, payload: { approve: boolean; approved_scopes?: string[]; note?: string }) =>
    apiClient.post(`/admin/developer/grants/${grantId}/decision`, payload).then((r) => r.data?.grant as DevGrant),

  revoke: (grantId: number, note?: string) =>
    apiClient.post(`/admin/developer/grants/${grantId}/revoke`, { note }).then((r) => r.data?.grant as DevGrant),

  listAccounts: (status?: string) =>
    apiClient.get("/admin/developer/accounts", { params: status ? { status } : {} })
      .then((r) => (r.data?.items ?? []) as DevAccount[]),

  setAccountStatus: (accountId: number, active: boolean, reason?: string) =>
    apiClient.post(`/admin/developer/accounts/${accountId}/status`, { active, reason }).then((r) => r.data?.account as DevAccount),
};
