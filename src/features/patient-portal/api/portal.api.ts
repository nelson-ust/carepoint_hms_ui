import axios from "axios";
import { apiClient } from "@/lib/api/api-client";
import { env } from "@/config/env";

// =====================================================================
// Patient-portal session storage
// =====================================================================
//
// The patient portal keeps its OWN auth session, fully separate from the
// staff session (`carepoint.access_token`). The portal access token and
// tenant code are stored under dedicated keys and are passed explicitly
// on every call via header overrides — the api-client interceptor only
// injects the staff token when no Authorization header is present, and
// respects an explicit X-Tenant-Code header verbatim.

export const PORTAL_STORAGE_KEYS = {
  /** Portal JWT access token (never the staff token). */
  token: "carepoint.portal_token",
  /** Portal refresh token (kept for future refresh support). */
  refreshToken: "carepoint.portal_refresh_token",
  /** Hospital (tenant) code entered at portal login. */
  tenant: "carepoint.portal_tenant",
  /** Lightweight identity blob from the verify-otp response. */
  session: "carepoint.portal_session",
} as const;

export type StoredPortalSession = {
  patient_id: number;
  user_id: number;
  hospital_number: string;
  full_name: string;
};

export function getPortalToken(): string | null {
  return window.localStorage.getItem(PORTAL_STORAGE_KEYS.token);
}

export function getPortalTenant(): string | null {
  return window.localStorage.getItem(PORTAL_STORAGE_KEYS.tenant);
}

export function getStoredPortalSession(): StoredPortalSession | null {
  const raw = window.localStorage.getItem(PORTAL_STORAGE_KEYS.session);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredPortalSession;
  } catch {
    return null;
  }
}

export function hasPortalSession(): boolean {
  return !!getPortalToken();
}

/** Persist the portal session after a successful OTP verification. */
export function storePortalSession(
  tenantCode: string,
  login: VerifyPortalOtpResponse,
): void {
  window.localStorage.setItem(PORTAL_STORAGE_KEYS.token, login.tokens.access_token);
  window.localStorage.setItem(
    PORTAL_STORAGE_KEYS.refreshToken,
    login.tokens.refresh_token,
  );
  window.localStorage.setItem(PORTAL_STORAGE_KEYS.tenant, tenantCode);
  window.localStorage.setItem(
    PORTAL_STORAGE_KEYS.session,
    JSON.stringify({
      patient_id: login.patient_id,
      user_id: login.user_id,
      hospital_number: login.hospital_number,
      full_name: login.full_name,
    } satisfies StoredPortalSession),
  );
}

/** Clear every portal key (logout). Staff keys are untouched. */
export function clearPortalSession(): void {
  window.localStorage.removeItem(PORTAL_STORAGE_KEYS.token);
  window.localStorage.removeItem(PORTAL_STORAGE_KEYS.refreshToken);
  window.localStorage.removeItem(PORTAL_STORAGE_KEYS.tenant);
  window.localStorage.removeItem(PORTAL_STORAGE_KEYS.session);
}

/** Overwrite just the portal access token (used after a silent refresh). */
export function setPortalAccessToken(token: string): void {
  window.localStorage.setItem(PORTAL_STORAGE_KEYS.token, token);
}

/**
 * Silently refresh the portal access token using the stored refresh token.
 *
 * The portal shares the tenant auth infrastructure, so `POST /auth/refresh`
 * (with the tenant header and the refresh token in the body) returns a fresh
 * access token. Uses a bare axios call — NOT the shared apiClient — so this
 * never recurses through apiClient's own 401 interceptor.
 *
 * Returns true when a new access token was stored.
 */
export async function refreshPortalToken(): Promise<boolean> {
  const refreshToken = window.localStorage.getItem(PORTAL_STORAGE_KEYS.refreshToken);
  const tenant = getPortalTenant();
  if (!refreshToken) return false;
  try {
    const res = await axios.post(
      `${env.apiBaseUrl}/auth/refresh`,
      { refresh_token: refreshToken },
      {
        headers: tenant ? { "X-Tenant-Code": tenant } : {},
        withCredentials: true,
      },
    );
    const data = (res.data ?? {}) as any;
    const newToken: string | undefined = data.access_token ?? data?.data?.access_token;
    if (!newToken) return false;
    setPortalAccessToken(newToken);
    return true;
  } catch {
    return false;
  }
}

// =====================================================================
// Header helpers
// =====================================================================

/**
 * X-Tenant-Code header for portal calls. The value comes from the
 * hospital code the patient typed at login (stored under
 * `carepoint.portal_tenant`); an explicit `tenantCode` argument wins
 * (used on the login page before anything is stored).
 */
function portalTenantHeader(tenantCode?: string): Record<string, string> {
  const tenant = tenantCode ?? getPortalTenant() ?? "";
  return tenant ? { "X-Tenant-Code": tenant } : {};
}

/** Unauthenticated portal call options (OTP flow, registration). */
function portalPublicOptions(tenantCode?: string) {
  return { headers: portalTenantHeader(tenantCode) };
}

/**
 * Authenticated portal call options — the portal token is passed as an
 * explicit Authorization override so the interceptor never substitutes
 * the staff token.
 */
function portalAuthOptions(extra?: { params?: Record<string, unknown> }) {
  const token = getPortalToken() ?? "";
  return {
    ...extra,
    headers: {
      Authorization: `Bearer ${token}`,
      ...portalTenantHeader(),
    },
  };
}

/**
 * Some deployments wrap responses in `{ success, message, data }`; most of
 * the portal endpoints return the resource directly. Normalize both.
 */
function unwrap<T>(raw: unknown): T {
  if (
    raw &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    "data" in (raw as Record<string, unknown>) &&
    (raw as Record<string, unknown>).data !== null &&
    typeof (raw as Record<string, unknown>).data === "object"
  ) {
    return (raw as { data: T }).data;
  }
  return raw as T;
}

// =====================================================================
// Types — OTP auth flow (app/schemas/patient_portal_schema.py)
// =====================================================================

export type PortalOtpChannel = "EMAIL" | "SMS";

export type RequestPortalOtpPayload = {
  /** Email address, phone number, or hospital (MRN) number. */
  identifier: string;
  /** Optional channel override; the backend infers it when omitted. */
  channel?: PortalOtpChannel | null;
};

export type RequestPortalOtpResponse = {
  success: boolean;
  message: string;
  otp_id: number;
  channel: string;
  masked_destination: string;
  expires_in_seconds: number;
};

export type VerifyPortalOtpPayload = {
  otp_id: number;
  otp_code: string;
};

export type PortalTokens = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type VerifyPortalOtpResponse = {
  success: boolean;
  message: string;
  tokens: PortalTokens;
  patient_id: number;
  user_id: number;
  hospital_number: string;
  full_name: string;
};

export type ResendPortalOtpPayload = {
  otp_id: number;
};

// =====================================================================
// Types — dashboard / profile (app/schemas/patient_portal_schemas.py)
// =====================================================================

export type PortalPatientPhoto = {
  file_name?: string | null;
  file_key?: string | null;
  file_url?: string | null;
};

/** PatientReadSchema (subset relevant to the portal UI). */
export type PortalPatient = {
  id: number;
  global_patient_id?: string | null;
  hospital_number: string;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  marital_status?: string | null;
  phone_number?: string | null;
  alternate_phone_number?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  blood_group?: string | null;
  genotype?: string | null;
  chronic_conditions?: string | null;
  allergies?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relationship?: string | null;
  next_of_kin_name?: string | null;
  next_of_kin_phone?: string | null;
  next_of_kin_relationship?: string | null;
  next_of_kin_address?: string | null;
  patient_type?: string | null;
  national_identifier?: string | null;
  national_identifier_type?: string | null;
  photo?: PortalPatientPhoto | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/** MembershipCardRead. Decimals may serialize as strings. */
export type PortalMembershipCard = {
  id: number;
  card_number: string;
  status: string;
  expiry_date?: string | null;
  patient_id: number;
  balance: number | string;
  issuing_facility_id: number;
  issued_by_id: number;
  date_issued: string;
  patient_name?: string | null;
  patient_phone?: string | null;
};

/** MembershipCardTransactionRead. */
export type PortalCardTransaction = {
  id: number;
  membership_card_id: number;
  patient_id: number;
  amount: number | string;
  transaction_type: string;
  payment_source?: string | null;
  payment_reference?: string | null;
  narration?: string | null;
  balance_before: number | string;
  balance_after: number | string;
  facility_id: number;
  processed_by_id: number;
  transaction_date: string;
  invoice_id?: number | null;
  visit_id?: number | null;
  payment_id?: number | null;
};

/** LabResultReadSchema. */
export type PortalLabResult = {
  id: number;
  lab_order_item_id: number;
  entered_by_staff_id?: number | null;
  verified_by_staff_id?: number | null;
  result_status: string;
  result_value?: string | null;
  result_text?: string | null;
  unit_of_measure?: string | null;
  reference_range?: string | null;
  interpretation?: string | null;
  entered_at?: string | null;
  verified_at?: string | null;
  released_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/** GET /portal/dashboard → PatientPortalDashboard. */
export type PortalDashboard = {
  patient: PortalPatient;
  card?: PortalMembershipCard | null;
  wallet_balance: number | string;
  recent_transactions: PortalCardTransaction[];
  recent_lab_results: PortalLabResult[];
  unread_notifications_count: number;
  recent_notifications?: PortalNotification[];
};

/** GET /portal/profile → PatientPortalProfile. */
export type PortalProfile = {
  patient: PortalPatient;
  username: string;
  email: string;
};

/** PATCH /portal/profile payload — patient self-editable fields only. */
export type PortalProfileUpdatePayload = {
  national_identifier?: string | null;
  national_identifier_type?: string | null;
  phone_number?: string | null;
  alternate_phone_number?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relationship?: string | null;
  next_of_kin_name?: string | null;
  next_of_kin_phone?: string | null;
  next_of_kin_relationship?: string | null;
};

// =====================================================================
// Types — appointments (app/schemas/appointment_schemas.py)
// =====================================================================

/** AppointmentReadSchema (as returned to the portal). */
export type PortalAppointment = {
  id: number;
  appointment_code: string;
  patient_id: number;
  facility_id?: number | null;
  service_delivery_point_id?: number | null;
  staff_profile_id?: number | null;
  scheduled_start_at: string;
  scheduled_end_at?: string | null;
  reason?: string | null;
  status: string;
  patient_name?: string | null;
  patient_phone?: string | null;
  staff_name?: string | null;
  service_delivery_point_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/** GET /portal/appointments → PatientPortalAppointments. */
export type PortalAppointments = {
  total: number;
  upcoming_count: number;
  past_count: number;
  next_appointment?: PortalAppointment | null;
  upcoming: PortalAppointment[];
  past: PortalAppointment[];
};

// =====================================================================
// Types — notifications (app/schemas/notification_schema.py)
// =====================================================================

/** NotificationReadSchema. */
export type PortalNotification = {
  id: number;
  user_id?: number | null;
  patient_id?: number | null;
  template_id?: number | null;
  channel: string;
  status: string;
  recipient_address?: string | null;
  subject?: string | null;
  body: string;
  payload_metadata?: Record<string, unknown> | null;
  scheduled_at?: string | null;
  read_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/** True when the patient has already acknowledged (read) the notification. */
export function isNotificationRead(n: PortalNotification): boolean {
  return n.status?.toUpperCase() === "READ" || !!n.read_at;
}

// =====================================================================
// Types — fund card (Paystack)
// =====================================================================

export type FundCardPayload = {
  amount: number;
};

/** POST /portal/fund-card → PaystackTransactionRead. */
export type PaystackTransaction = {
  id: number;
  amount: number | string;
  currency: string;
  reference: string;
  access_code?: string | null;
  authorization_url?: string | null;
  status: string;
  paid_at?: string | null;
  date_created: string;
};

// =====================================================================
// Types — portal account routes (app/schemas/portal_schemas.py)
// =====================================================================

export type PortalAccountCreatePayload = {
  patient_id: number;
  portal_username: string;
  password: string;
  email?: string | null;
  phone_number?: string | null;
  status?: string;
};

export type PortalAccount = {
  id: number;
  patient_id: number;
  portal_username: string;
  email?: string | null;
  phone_number?: string | null;
  status: string;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  last_login_at?: string | null;
};

export type AppointmentRequestPayload = {
  /** ISO datetime string. */
  requested_date: string;
  requested_sdp_id?: number | null;
  requested_clinician_id?: number | null;
  reason: string;
  priority?: string;
};

export type AppointmentRequest = {
  id: number;
  account_id: number;
  requested_date: string;
  reason: string;
  status: string;
  created_at: string;
};

export type PortalMessagePayload = {
  subject: string;
  body: string;
  parent_message_id?: number | null;
};

export type PortalMessage = {
  id: number;
  subject: string;
  body: string;
  sender_type: string;
  is_read: boolean;
  created_at: string;
};

export type DocumentSharePayload = {
  document_title: string;
  attachment_id?: number | null;
  /** ISO datetime string. */
  share_expiry?: string | null;
  note?: string | null;
};

export type DocumentShare = {
  id: number;
  document_title: string;
  file_url?: string | null;
  share_expiry?: string | null;
  is_revoked: boolean;
};

// =====================================================================
// API — OTP auth flow (patient_portal_routes.py, prefix /portal)
// =====================================================================

export async function requestPortalOtp(
  payload: RequestPortalOtpPayload,
  tenantCode?: string,
): Promise<RequestPortalOtpResponse> {
  const response = await apiClient.post<RequestPortalOtpResponse>(
    "/portal/auth/request-otp",
    payload,
    portalPublicOptions(tenantCode),
  );
  return unwrap<RequestPortalOtpResponse>(response.data);
}

export async function verifyPortalOtp(
  payload: VerifyPortalOtpPayload,
  tenantCode?: string,
): Promise<VerifyPortalOtpResponse> {
  const response = await apiClient.post<VerifyPortalOtpResponse>(
    "/portal/auth/verify-otp",
    payload,
    portalPublicOptions(tenantCode),
  );
  return unwrap<VerifyPortalOtpResponse>(response.data);
}

export async function resendPortalOtp(
  payload: ResendPortalOtpPayload,
  tenantCode?: string,
): Promise<RequestPortalOtpResponse> {
  const response = await apiClient.post<RequestPortalOtpResponse>(
    "/portal/auth/resend-otp",
    payload,
    portalPublicOptions(tenantCode),
  );
  return unwrap<RequestPortalOtpResponse>(response.data);
}

// =====================================================================
// API — authenticated portal reads / actions
// =====================================================================

export async function getPortalDashboard(): Promise<PortalDashboard> {
  const response = await apiClient.get<PortalDashboard>(
    "/portal/dashboard",
    portalAuthOptions(),
  );
  return unwrap<PortalDashboard>(response.data);
}

/** GET /portal/branding → PortalBranding (public; resolved from tenant code). */
export type PortalBranding = {
  hospital_name?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
};

export async function getPortalBranding(): Promise<PortalBranding> {
  const response = await apiClient.get<PortalBranding>(
    "/portal/branding",
    portalPublicOptions(),
  );
  return unwrap<PortalBranding>(response.data);
}

export async function getPortalAppointments(): Promise<PortalAppointments> {
  const response = await apiClient.get<PortalAppointments>(
    "/portal/appointments",
    portalAuthOptions(),
  );
  const data = unwrap<PortalAppointments>(response.data);
  return {
    total: data?.total ?? 0,
    upcoming_count: data?.upcoming_count ?? 0,
    past_count: data?.past_count ?? 0,
    next_appointment: data?.next_appointment ?? null,
    upcoming: Array.isArray(data?.upcoming) ? data.upcoming : [],
    past: Array.isArray(data?.past) ? data.past : [],
  };
}

export async function getPortalProfile(): Promise<PortalProfile> {
  const response = await apiClient.get<PortalProfile>(
    "/portal/profile",
    portalAuthOptions(),
  );
  return unwrap<PortalProfile>(response.data);
}

/** PATCH /portal/profile — patient self-service update of allowed fields. */
export async function updatePortalProfile(
  payload: PortalProfileUpdatePayload,
): Promise<PortalProfile> {
  const response = await apiClient.patch<PortalProfile>(
    "/portal/profile",
    payload,
    portalAuthOptions(),
  );
  return unwrap<PortalProfile>(response.data);
}

/** POST /portal/profile/photo — patient uploads their profile picture. */
export async function uploadPortalProfilePhoto(file: File): Promise<PortalProfile> {
  const form = new FormData();
  form.append("photo", file);
  const base = portalAuthOptions();
  const response = await apiClient.post<PortalProfile>(
    "/portal/profile/photo",
    form,
    {
      ...base,
      headers: { ...base.headers, "Content-Type": "multipart/form-data" },
    },
  );
  return unwrap<PortalProfile>(response.data);
}


// ---------------------------------------------------------------------------
// Laboratory results
// ---------------------------------------------------------------------------

export type PortalLabResultRow = {
  test: string;
  result: string;
  unit?: string | null;
  reference_range?: string | null;
  released_at?: string | null;
};

export type PortalLabOrder = {
  order_id: number;
  order_no: string;
  ordered_at?: string | null;
  visit_id?: number | null;
  results: PortalLabResultRow[];
};

/** GET /portal/lab-results → released results grouped per request. */
export async function getPortalLabResults(): Promise<PortalLabOrder[]> {
  const response = await apiClient.get<{ items: PortalLabOrder[] }>(
    "/portal/lab-results",
    portalAuthOptions(),
  );
  const data = unwrap<{ items: PortalLabOrder[] }>(response.data);
  return Array.isArray(data?.items) ? data.items : [];
}

/** Download the branded laboratory report PDF for one of my orders. */
export async function downloadPortalLabReport(orderId: number, orderNo: string): Promise<void> {
  const response = await apiClient.get(`/portal/lab-results/${orderId}/report.pdf`, {
    ...portalAuthOptions(),
    responseType: "blob",
  } as any);
  const url = URL.createObjectURL(response.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lab-report-${orderNo}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export type PortalInvoice = {
  visit_id: number;
  visit_number?: string | null;
  visit_date?: string | null;
  billing_no?: string | null;
  invoice_no?: string | null;
  total: string;
  paid: string;
  outstanding: string;
  payment_status: "PAID" | "PARTIALLY_PAID" | "UNPAID";
  payments_count: number;
};

/** GET /portal/invoices → my visit bills with payment status. */
export async function getPortalInvoices(): Promise<PortalInvoice[]> {
  const response = await apiClient.get<{ items: PortalInvoice[] }>(
    "/portal/invoices",
    portalAuthOptions(),
  );
  const data = unwrap<{ items: PortalInvoice[] }>(response.data);
  return Array.isArray(data?.items) ? data.items : [];
}

/** Download my branded invoice PDF for a visit. */
export async function downloadPortalInvoice(visitId: number, ref: string): Promise<void> {
  const response = await apiClient.get(`/portal/invoices/${visitId}/invoice.pdf`, {
    ...portalAuthOptions(),
    responseType: "blob",
  } as any);
  const url = URL.createObjectURL(response.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoice-${ref}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}


// ---------------------------------------------------------------------------
// Baseline Diagnostic Profile (read-only, lifelong)
// ---------------------------------------------------------------------------

export type PortalBaselineStatus = "VERIFIED" | "RECORDED" | "NOT_RECORDED";

export type PortalBaselineRecord = {
  key: string;
  label: string;
  category: string;
  value: string | null;
  interpretation?: string | null;
  verification_status: PortalBaselineStatus;
  verified_by?: string | null;
  recorded_at?: string | null;
  updated_at?: string | null;
};

export type PortalBaselineCategory = {
  name: string;
  records: PortalBaselineRecord[];
};

export type PortalBaselinePatient = {
  id: number;
  name: string;
  hospital_number?: string | null;
  global_patient_id?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
};

export type PortalBaselineDiagnostics = {
  patient: PortalBaselinePatient | null;
  version: number;
  recorded_at?: string | null;
  updated_at?: string | null;
  categories: PortalBaselineCategory[];
  record_count: number;
};

/** GET /portal/baseline-diagnostics → my lifelong baseline diagnostic profile. */
export async function getPortalBaselineDiagnostics(): Promise<PortalBaselineDiagnostics> {
  const response = await apiClient.get<PortalBaselineDiagnostics>(
    "/portal/baseline-diagnostics",
    portalAuthOptions(),
  );
  const data = unwrap<PortalBaselineDiagnostics>(response.data);
  return {
    patient: data?.patient ?? null,
    version: data?.version ?? 0,
    recorded_at: data?.recorded_at ?? null,
    updated_at: data?.updated_at ?? null,
    categories: Array.isArray(data?.categories) ? data.categories : [],
    record_count: data?.record_count ?? 0,
  };
}

/** Download the branded Baseline Diagnostic Profile PDF. */
export async function downloadPortalBaselineReport(ref: string): Promise<void> {
  const response = await apiClient.get(`/portal/baseline-diagnostics/report.pdf`, {
    ...portalAuthOptions(),
    responseType: "blob",
  } as any);
  const url = URL.createObjectURL(response.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `baseline-diagnostics-${ref}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function getPortalNotifications(
  skip = 0,
  limit = 20,
  unreadOnly = true,
): Promise<PortalNotification[]> {
  const response = await apiClient.get<PortalNotification[]>(
    "/portal/notifications",
    portalAuthOptions({ params: { skip, limit, unread_only: unreadOnly } }),
  );
  const data = unwrap<PortalNotification[] | { items?: PortalNotification[] }>(
    response.data,
  );
  if (Array.isArray(data)) return data;
  return data?.items ?? [];
}

/** Mark one notification as read; it then drops out of the unread feed. */
export async function markPortalNotificationRead(
  notificationId: number,
): Promise<PortalNotification> {
  const response = await apiClient.post<PortalNotification>(
    `/portal/notifications/${notificationId}/read`,
    null,
    portalAuthOptions(),
  );
  return unwrap<PortalNotification>(response.data);
}

export type MarkAllNotificationsReadResponse = {
  success: boolean;
  message: string;
  updated: number;
};

/** Mark every unread notification as read (clears the feed at once). */
export async function markAllPortalNotificationsRead(): Promise<MarkAllNotificationsReadResponse> {
  const response = await apiClient.post<MarkAllNotificationsReadResponse>(
    "/portal/notifications/read-all",
    null,
    portalAuthOptions(),
  );
  const data = unwrap<MarkAllNotificationsReadResponse>(response.data);
  return {
    success: !!data?.success,
    message: data?.message ?? "Notifications marked as read.",
    updated: data?.updated ?? 0,
  };
}

// =====================================================================
// Types & API — hospital -> patient messages (inbox)
// (patient_portal_routes.py /portal/messages)
// =====================================================================

export type PortalInboxMessage = {
  id: number;
  broadcast_id: number;
  subject?: string | null;
  body: string;
  is_read: boolean;
  sent_at?: string | null;
  read_at?: string | null;
};

type PortalInboxEnvelope = {
  success?: boolean;
  message?: string;
  items?: PortalInboxMessage[];
  count?: number;
};

export async function getPortalMessages(
  skip = 0,
  limit = 20,
  unreadOnly = false,
): Promise<PortalInboxMessage[]> {
  const response = await apiClient.get<PortalInboxEnvelope | PortalInboxMessage[]>(
    "/portal/messages",
    portalAuthOptions({ params: { skip, limit, unread_only: unreadOnly } }),
  );
  const data = unwrap<PortalInboxEnvelope | PortalInboxMessage[]>(response.data);
  if (Array.isArray(data)) return data;
  return data?.items ?? [];
}

export async function getPortalMessagesUnreadCount(): Promise<number> {
  const response = await apiClient.get<{ success?: boolean; count?: number }>(
    "/portal/messages/unread-count",
    portalAuthOptions(),
  );
  return unwrap<{ count?: number }>(response.data)?.count ?? 0;
}

export async function markPortalMessageRead(
  recipientId: number,
): Promise<PortalInboxMessage> {
  const response = await apiClient.post<PortalInboxMessage>(
    `/portal/messages/${recipientId}/read`,
    null,
    portalAuthOptions(),
  );
  return unwrap<PortalInboxMessage>(response.data);
}

export async function markAllPortalMessagesRead(): Promise<MarkAllNotificationsReadResponse> {
  const response = await apiClient.post<MarkAllNotificationsReadResponse>(
    "/portal/messages/read-all",
    null,
    portalAuthOptions(),
  );
  const data = unwrap<MarkAllNotificationsReadResponse>(response.data);
  return {
    success: !!data?.success,
    message: data?.message ?? "Messages marked as read.",
    updated: data?.updated ?? 0,
  };
}

export async function fundPortalCard(
  payload: FundCardPayload,
): Promise<PaystackTransaction> {
  const response = await apiClient.post<PaystackTransaction>(
    "/portal/fund-card",
    payload,
    portalAuthOptions(),
  );
  return unwrap<PaystackTransaction>(response.data);
}

// =====================================================================
// Manual card funding (upload proof of payment → staff approval)
// =====================================================================

export type ManualFundingStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ManualFundingPayload = {
  amount: number;
  payment_method: string;
  payment_reference?: string | null;
  depositor_name?: string | null;
  note?: string | null;
  /** The proof-of-payment file (image or PDF). */
  evidence: File;
};

/** CardFundingRequestRead. */
export type ManualFundingRequest = {
  id: number;
  patient_id: number;
  membership_card_id: number;
  amount: number | string;
  payment_method: string;
  payment_reference?: string | null;
  depositor_name?: string | null;
  note?: string | null;
  evidence_file_name?: string | null;
  evidence_file_url?: string | null;
  evidence_content_type?: string | null;
  status: ManualFundingStatus;
  reviewed_by_id?: number | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  transaction_id?: number | null;
  date_created: string;
  card_number?: string | null;
  patient_name?: string | null;
};

export async function submitManualCardFunding(
  payload: ManualFundingPayload,
): Promise<ManualFundingRequest> {
  const form = new FormData();
  form.append("amount", String(payload.amount));
  form.append("payment_method", payload.payment_method);
  if (payload.payment_reference) form.append("payment_reference", payload.payment_reference);
  if (payload.depositor_name) form.append("depositor_name", payload.depositor_name);
  if (payload.note) form.append("note", payload.note);
  form.append("evidence", payload.evidence);

  // IMPORTANT: set Content-Type to "multipart/form-data" explicitly.
  // The apiClient's default Content-Type is "application/json"; axios v1's
  // transformRequest will JSON-serialize a FormData body when the content-type
  // is application/json (fields then arrive empty → 422 "Field required").
  // Setting "multipart/form-data" makes axios keep the FormData as-is; it then
  // strips this header so the browser sets it *with the required boundary*.
  const base = portalAuthOptions();
  const response = await apiClient.post<ManualFundingRequest>(
    "/portal/fund-card/manual",
    form,
    {
      ...base,
      headers: { ...base.headers, "Content-Type": "multipart/form-data" },
    },
  );
  return unwrap<ManualFundingRequest>(response.data);
}

// =====================================================================
// Card-funding method availability (which options to show the patient)
// =====================================================================

export type PortalPaymentConfig = {
  online_enabled: boolean;
  online_provider?: string | null;
  manual_enabled: boolean;
};

export async function getPortalPaymentConfig(): Promise<PortalPaymentConfig> {
  try {
    const response = await apiClient.get<PortalPaymentConfig>(
      "/portal/payment-config",
      portalAuthOptions(),
    );
    const data = unwrap<PortalPaymentConfig>(response.data);
    return {
      online_enabled: !!data?.online_enabled,
      online_provider: data?.online_provider ?? null,
      manual_enabled: data?.manual_enabled !== false,
    };
  } catch {
    // Older backend without this endpoint → assume both methods are available
    // so the modal keeps working (online failures still surface as a toast).
    return { online_enabled: true, online_provider: null, manual_enabled: true };
  }
}

export async function listMyManualCardFunding(): Promise<ManualFundingRequest[]> {
  const response = await apiClient.get<ManualFundingRequest[]>(
    "/portal/fund-card/manual",
    portalAuthOptions(),
  );
  const data = unwrap<ManualFundingRequest[] | { items?: ManualFundingRequest[] }>(
    response.data,
  );
  if (Array.isArray(data)) return data;
  return data?.items ?? [];
}

// =====================================================================
// API — portal account routes (portal_routes.py, prefix /portal)
// =====================================================================

export async function registerPortalAccount(
  payload: PortalAccountCreatePayload,
  tenantCode?: string,
): Promise<PortalAccount> {
  const response = await apiClient.post<PortalAccount>(
    "/portal/register",
    payload,
    portalPublicOptions(tenantCode),
  );
  return unwrap<PortalAccount>(response.data);
}

export async function requestPortalAppointment(
  accountId: number,
  payload: AppointmentRequestPayload,
): Promise<AppointmentRequest> {
  const response = await apiClient.post<AppointmentRequest>(
    `/portal/${accountId}/appointment-requests`,
    payload,
    portalAuthOptions(),
  );
  return unwrap<AppointmentRequest>(response.data);
}

export type PortalClinicianOption = {
  id: number;
  name: string;
  specialty?: string | null;
};

/** Doctors the patient can optionally request when booking. */
export async function getPortalClinicians(patientId: number): Promise<PortalClinicianOption[]> {
  const response = await apiClient.get<PortalClinicianOption[]>(
    `/portal/${patientId}/clinicians`,
    portalAuthOptions(),
  );
  const data = unwrap<PortalClinicianOption[]>(response.data);
  return Array.isArray(data) ? data : [];
}

export async function sendPortalMessage(
  accountId: number,
  payload: PortalMessagePayload,
): Promise<PortalMessage> {
  const response = await apiClient.post<PortalMessage>(
    `/portal/${accountId}/messages`,
    payload,
    portalAuthOptions(),
  );
  return unwrap<PortalMessage>(response.data);
}

export async function sharePortalDocument(
  accountId: number,
  payload: DocumentSharePayload,
): Promise<DocumentShare> {
  const response = await apiClient.post<DocumentShare>(
    `/portal/${accountId}/document-shares`,
    payload,
    portalAuthOptions(),
  );
  return unwrap<DocumentShare>(response.data);
}

// =====================================================================
// Small shared helpers
// =====================================================================

/** Format a backend Decimal (string or number) as Naira. */
export function formatNaira(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? Number(value) : (value ?? 0);
  if (!Number.isFinite(num)) return "₦0.00";
  return `₦${num.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Extract a human-friendly message from an axios error. */
export function portalErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as {
    response?: { data?: { message?: string; detail?: unknown } };
    message?: string;
  };
  const data = anyErr?.response?.data;
  if (data?.message) return data.message;
  if (typeof data?.detail === "string") return data.detail;
  if (Array.isArray(data?.detail) && data.detail.length > 0) {
    const first = data.detail[0] as { msg?: string };
    if (first?.msg) return first.msg;
  }
  if (!anyErr?.response && anyErr?.message) {
    return "Cannot reach the server. Please check your connection and try again.";
  }
  return fallback;
}
