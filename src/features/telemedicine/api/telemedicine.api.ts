import { apiClient } from "@/lib/api/api-client";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
export type ListResult<T> = { items: T[]; total: number; meta?: Record<string, unknown> };

function cleanParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  });
  return out;
}

function toList<T>(data: unknown): ListResult<T> {
  const d = (data ?? {}) as Record<string, any>;
  const items: T[] = Array.isArray(d.items) ? d.items : [];
  const total: number =
    typeof d?.meta?.total === "number" ? d.meta.total : d.count ?? items.length;
  return { items, total, meta: d.meta };
}

export function labelize(v?: string | null): string {
  if (!v) return "—";
  return String(v)
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type TelemedicineStatus =
  | "SCHEDULED" | "WAITING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export type TelemedicineModality = "VIDEO" | "AUDIO" | "CHAT";
export type TelemedicineProvider = "JITSI" | "TWILIO" | "EXTERNAL";
export type TelemedicineSenderRole = "CLINICIAN" | "PATIENT" | "SYSTEM";

export type TelemedicineSession = {
  id: number;
  session_code: string;
  patient_id: number;
  clinician_staff_id?: number | null;
  appointment_id?: number | null;
  home_visit_id?: number | null;
  care_plan_id?: number | null;
  modality: TelemedicineModality | string;
  status: TelemedicineStatus | string;
  reason?: string | null;
  provider: TelemedicineProvider | string;
  room_name: string;
  room_url?: string | null;
  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;
  waiting_since?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  duration_seconds?: number | null;
  patient_joined_at?: string | null;
  clinician_joined_at?: string | null;
  subjective_note?: string | null;
  objective_note?: string | null;
  assessment_note?: string | null;
  plan_note?: string | null;
  summary?: string | null;
  follow_up_required?: boolean;
  follow_up_notes?: string | null;
  cancellation_reason?: string | null;
  patient_name?: string | null;
  clinician_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TelemedicineCreatePayload = {
  patient_id: number;
  clinician_staff_id?: number | null;
  appointment_id?: number | null;
  home_visit_id?: number | null;
  care_plan_id?: number | null;
  modality?: TelemedicineModality;
  reason?: string | null;
  provider?: TelemedicineProvider;
  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;
};

export type TelemedicineNotesPayload = {
  subjective_note?: string | null;
  objective_note?: string | null;
  assessment_note?: string | null;
  plan_note?: string | null;
  summary?: string | null;
  follow_up_required?: boolean | null;
  follow_up_notes?: string | null;
};

export type TelemedicineJoinInfo = {
  session_code: string;
  provider: string;
  modality: string;
  status: string;
  room_name: string;
  room_url?: string | null;
  domain: string;
  display_name?: string | null;
  is_clinician: boolean;
};

export type TelemedicineMessage = {
  id: number;
  session_id: number;
  sender_user_id?: number | null;
  sender_role: TelemedicineSenderRole | string;
  sender_name?: string | null;
  body: string;
  attachment_key?: string | null;
  attachment_name?: string | null;
  sent_at: string;
};

// ---------------------------------------------------------------------------
// API (staff)
// ---------------------------------------------------------------------------
export const telemedicineApi = {
  list: (params: Record<string, unknown> = {}): Promise<ListResult<TelemedicineSession>> =>
    apiClient.get("/telemedicine/sessions/", { params: cleanParams(params) }).then((r) => toList<TelemedicineSession>(r.data)),
  get: (id: number): Promise<TelemedicineSession> =>
    apiClient.get(`/telemedicine/sessions/${id}`).then((r) => r.data.session),
  create: (payload: TelemedicineCreatePayload): Promise<TelemedicineSession> =>
    apiClient.post("/telemedicine/sessions/", payload).then((r) => r.data.session),
  update: (id: number, payload: Partial<TelemedicineCreatePayload>): Promise<TelemedicineSession> =>
    apiClient.patch(`/telemedicine/sessions/${id}`, payload).then((r) => r.data.session),
  join: (id: number): Promise<{ join: TelemedicineJoinInfo; session: TelemedicineSession }> =>
    apiClient.post(`/telemedicine/sessions/${id}/join`).then((r) => ({ join: r.data.join, session: r.data.session })),
  start: (id: number): Promise<TelemedicineSession> =>
    apiClient.post(`/telemedicine/sessions/${id}/start`).then((r) => r.data.session),
  saveNotes: (id: number, payload: TelemedicineNotesPayload): Promise<TelemedicineSession> =>
    apiClient.put(`/telemedicine/sessions/${id}/notes`, payload).then((r) => r.data.session),
  complete: (id: number, payload: TelemedicineNotesPayload = {}): Promise<TelemedicineSession> =>
    apiClient.post(`/telemedicine/sessions/${id}/complete`, payload).then((r) => r.data.session),
  cancel: (id: number, reason?: string): Promise<TelemedicineSession> =>
    apiClient.post(`/telemedicine/sessions/${id}/cancel`, { reason }).then((r) => r.data.session),
  noShow: (id: number): Promise<TelemedicineSession> =>
    apiClient.post(`/telemedicine/sessions/${id}/no-show`).then((r) => r.data.session),
  listMessages: (id: number): Promise<TelemedicineMessage[]> =>
    apiClient.get(`/telemedicine/sessions/${id}/messages`).then((r) => r.data.items ?? []),
  sendMessage: (id: number, body: string): Promise<TelemedicineMessage> =>
    apiClient.post(`/telemedicine/sessions/${id}/messages`, { body }).then((r) => r.data.chat_message),
};

// ---------------------------------------------------------------------------
// Option lists + status styling
// ---------------------------------------------------------------------------
export const TELEMEDICINE_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "WAITING", label: "Waiting room" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "NO_SHOW", label: "No-show" },
];

export const TELEMEDICINE_MODALITY_OPTIONS: { value: string; label: string }[] = [
  { value: "VIDEO", label: "Video" },
  { value: "AUDIO", label: "Audio" },
  { value: "CHAT", label: "Chat" },
];

export function telemedicineStatusVariant(status: string): any {
  switch (status) {
    case "IN_PROGRESS": return "success";
    case "WAITING": return "soft-warning";
    case "SCHEDULED": return "info";
    case "COMPLETED": return "secondary";
    case "CANCELLED": return "soft-danger";
    case "NO_SHOW": return "soft-danger";
    default: return "secondary";
  }
}

/** Build the embeddable Jitsi room URL for an iframe. */
export function buildJitsiUrl(join: { domain: string; room_name: string; room_url?: string | null }, displayName?: string | null): string {
  const domain = join.domain || "meet.jit.si";
  const base = `https://${domain}/${join.room_name}`;
  const cfg = [
    "config.prejoinPageEnabled=false",
    "config.disableDeepLinking=true",
  ];
  if (displayName) cfg.push(`userInfo.displayName=%22${encodeURIComponent(displayName)}%22`);
  return `${base}#${cfg.join("&")}`;
}
