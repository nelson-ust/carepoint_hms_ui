import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

// ============================================================
// Enums / option sets
// ============================================================

export type SurgicalCaseStatus =
  | "BOOKED"
  | "CONFIRMED"
  | "PRE_OP"
  | "IN_THEATRE"
  | "PROCEDURE_STARTED"
  | "PROCEDURE_ENDED"
  | "POST_OP"
  | "COMPLETED"
  | "CANCELLED"
  | "POSTPONED";

export type TheatreStatus =
  | "AVAILABLE"
  | "OCCUPIED"
  | "CLEANING"
  | "OUT_OF_SERVICE"
  | "UNDER_MAINTENANCE";

export type SterilizationStatus =
  | "DIRTY"
  | "PRE_CLEAN"
  | "AUTOCLAVE"
  | "READY"
  | "IN_USE"
  | "QUARANTINED";

export type SurgicalRole =
  | "PRIMARY_SURGEON"
  | "ASSISTANT_SURGEON"
  | "ANAESTHETIST"
  | "SCRUB_NURSE"
  | "CIRCULATING_NURSE"
  | "PERFUSIONIST"
  | "OBSERVER"
  | "OTHER";

export type AnaesthesiaType =
  | "GENERAL"
  | "SPINAL"
  | "EPIDURAL"
  | "REGIONAL"
  | "LOCAL"
  | "SEDATION"
  | "NONE";

export type ASAClass = "ASA_I" | "ASA_II" | "ASA_III" | "ASA_IV" | "ASA_V" | "ASA_VI";

export type ChecklistPhase = "SIGN_IN" | "TIME_OUT" | "SIGN_OUT";

export const SURGICAL_ROLE_OPTIONS: { value: SurgicalRole; label: string }[] = [
  { value: "PRIMARY_SURGEON", label: "Primary Surgeon" },
  { value: "ASSISTANT_SURGEON", label: "Assistant Surgeon" },
  { value: "ANAESTHETIST", label: "Anaesthetist" },
  { value: "SCRUB_NURSE", label: "Scrub Nurse" },
  { value: "CIRCULATING_NURSE", label: "Circulating Nurse" },
  { value: "PERFUSIONIST", label: "Perfusionist" },
  { value: "OBSERVER", label: "Observer" },
  { value: "OTHER", label: "Other" },
];

export const ANAESTHESIA_OPTIONS: { value: AnaesthesiaType; label: string }[] = [
  { value: "GENERAL", label: "General" },
  { value: "SPINAL", label: "Spinal" },
  { value: "EPIDURAL", label: "Epidural" },
  { value: "REGIONAL", label: "Regional" },
  { value: "LOCAL", label: "Local" },
  { value: "SEDATION", label: "Sedation" },
  { value: "NONE", label: "None" },
];

export const ASA_OPTIONS: { value: ASAClass; label: string }[] = [
  { value: "ASA_I", label: "ASA I — Healthy" },
  { value: "ASA_II", label: "ASA II — Mild systemic disease" },
  { value: "ASA_III", label: "ASA III — Severe systemic disease" },
  { value: "ASA_IV", label: "ASA IV — Life-threatening disease" },
  { value: "ASA_V", label: "ASA V — Moribund" },
  { value: "ASA_VI", label: "ASA VI — Brain-dead / organ donor" },
];

export const THEATRE_STATUS_OPTIONS: { value: TheatreStatus; label: string }[] = [
  { value: "AVAILABLE", label: "Available" },
  { value: "OCCUPIED", label: "Occupied" },
  { value: "CLEANING", label: "Cleaning" },
  { value: "OUT_OF_SERVICE", label: "Out of service" },
  { value: "UNDER_MAINTENANCE", label: "Under maintenance" },
];

export const STERILIZATION_OPTIONS: { value: SterilizationStatus; label: string }[] = [
  { value: "DIRTY", label: "Dirty" },
  { value: "PRE_CLEAN", label: "Pre-clean" },
  { value: "AUTOCLAVE", label: "Autoclave" },
  { value: "READY", label: "Ready" },
  { value: "IN_USE", label: "In use" },
  { value: "QUARANTINED", label: "Quarantined" },
];

/** Ordered lifecycle stages for the case stepper. */
export const CASE_LIFECYCLE: SurgicalCaseStatus[] = [
  "BOOKED",
  "CONFIRMED",
  "PRE_OP",
  "IN_THEATRE",
  "PROCEDURE_STARTED",
  "PROCEDURE_ENDED",
  "POST_OP",
  "COMPLETED",
];

// ============================================================
// Types
// ============================================================

export type OperatingTheatre = {
  id: number;
  code: string;
  name: string;
  facility_id?: number | null;
  location_description?: string | null;
  status: TheatreStatus | string;
  is_emergency_capable: boolean;
  capabilities?: Record<string, unknown> | null;
  notes?: string | null;
  created_at?: string | null;
};

export type SurgicalProcedure = {
  id: number;
  code: string;
  name: string;
  cpt_code?: string | null;
  typical_duration_minutes?: number | null;
  requires_blood_products: boolean;
  average_blood_loss_ml?: number | null;
  default_price?: number | null;
  description?: string | null;
  pre_op_instructions?: string | null;
  post_op_instructions?: string | null;
};

export type SurgicalCase = {
  id: number;
  case_no: string;
  patient_id: number;
  visit_id?: number | null;
  facility_id?: number | null;
  procedure_catalog_id: number;
  operating_theatre_id?: number | null;
  status: SurgicalCaseStatus | string;
  is_emergency: boolean;
  asa_class?: string | null;
  anaesthesia_type?: string | null;
  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;
  pre_op_started_at?: string | null;
  incision_at?: string | null;
  closure_at?: string | null;
  out_of_theatre_at?: string | null;
  diagnosis_text?: string | null;
  findings_text?: string | null;
  cancellation_reason?: string | null;
  created_at?: string | null;
};

export type SurgicalTeamMember = {
  id: number;
  surgical_case_id: number;
  staff_profile_id: number;
  role: SurgicalRole | string;
  is_lead: boolean;
  notes?: string | null;
};

export type SurgicalConsent = {
  id: number;
  surgical_case_id: number;
  consent_text: string;
  consent_signed_by?: string | null;
  relationship_to_patient?: string | null;
  witnessed_by_staff_id?: number | null;
  signed_at?: string | null;
  signature_image_url?: string | null;
};

export type SurgicalChecklist = {
  id: number;
  surgical_case_id: number;
  phase: ChecklistPhase | string;
  completed_at?: string | null;
  completed_by_staff_id?: number | null;
  items?: Record<string, unknown> | null;
  notes?: string | null;
};

export type AnaesthesiaRecord = {
  id: number;
  surgical_case_id: number;
  anaesthetist_staff_id?: number | null;
  anaesthesia_type: AnaesthesiaType | string;
  induction_time?: string | null;
  emergence_time?: string | null;
  agents?: Record<string, unknown> | null;
  monitoring_intervals?: Record<string, unknown> | null;
  complications?: string | null;
  notes?: string | null;
};

export type TheatreNote = {
  id: number;
  surgical_case_id: number;
  author_staff_id?: number | null;
  note_type?: string | null;
  note: string;
  captured_at?: string | null;
};

export type InstrumentSet = {
  id: number;
  code: string;
  name: string;
  facility_id?: number | null;
  surgical_case_id?: number | null;
  sterilization_status: SterilizationStatus | string;
  last_autoclaved_at?: string | null;
  next_required_sterilization_at?: string | null;
  contents?: Record<string, unknown> | null;
  notes?: string | null;
};

export type SterilizationLog = {
  id: number;
  instrument_set_id: number;
  performed_by_staff_id?: number | null;
  cycle_started_at: string;
  cycle_ended_at?: string | null;
  method?: string | null;
  machine_identifier?: string | null;
  indicator_passed?: boolean | null;
  notes?: string | null;
};

// ============================================================
// Payloads
// ============================================================

export type TheatrePayload = {
  code: string;
  name: string;
  facility_id?: number | null;
  location_description?: string | null;
  is_emergency_capable?: boolean;
  notes?: string | null;
};

export type ProcedurePayload = {
  code: string;
  name: string;
  cpt_code?: string | null;
  typical_duration_minutes?: number | null;
  requires_blood_products?: boolean;
  average_blood_loss_ml?: number | null;
  default_price?: number | null;
  description?: string | null;
  pre_op_instructions?: string | null;
  post_op_instructions?: string | null;
};

export type BookCasePayload = {
  patient_id: number;
  procedure_catalog_id: number;
  visit_id?: number | null;
  operating_theatre_id?: number | null;
  is_emergency?: boolean;
  asa_class?: string | null;
  anaesthesia_type?: string | null;
  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;
  diagnosis_text?: string | null;
  auto_capture_charge?: boolean;
};

export type CaseTransitionPayload = {
  note?: string;
  findings?: string;
};

// ============================================================
// Helpers
// ============================================================

function unwrapList<T>(data: unknown): { items: T[]; count: number } {
  const d = (data ?? {}) as any;
  const items: T[] = Array.isArray(d) ? d : Array.isArray(d.items) ? d.items : [];
  const count = typeof d?.meta?.total === "number" ? d.meta.total : d.count ?? items.length;
  return { items, count };
}

function clean(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  }
  return out;
}

// ============================================================
// Theatres
// ============================================================

export async function listTheatres(
  params: { skip?: number; limit?: number; status?: string; emergency_only?: boolean; search?: string } = {},
): Promise<{ items: OperatingTheatre[]; count: number }> {
  const { skip = 0, limit = 100, ...rest } = params;
  const res = await apiClient.get<PaginatedResponse<OperatingTheatre>>("/theatres/", {
    params: clean({ skip, limit, ...rest }),
  });
  return unwrapList<OperatingTheatre>(res.data);
}

export async function createTheatre(payload: TheatrePayload): Promise<OperatingTheatre> {
  const res = await apiClient.post<{ theatre: OperatingTheatre }>("/theatres/", payload);
  return res.data.theatre;
}

export async function updateTheatre(id: number, payload: Partial<TheatrePayload>): Promise<OperatingTheatre> {
  const res = await apiClient.put<{ theatre: OperatingTheatre }>(`/theatres/${id}`, payload);
  return res.data.theatre;
}

export async function changeTheatreStatus(
  id: number,
  new_status: string,
  reason?: string,
): Promise<OperatingTheatre> {
  const res = await apiClient.post<{ theatre: OperatingTheatre }>(`/theatres/${id}/status`, {
    new_status,
    reason,
  });
  return res.data.theatre;
}

export async function deleteTheatre(id: number): Promise<void> {
  await apiClient.delete(`/theatres/${id}`);
}

// ============================================================
// Procedure catalog
// ============================================================

export async function listProcedures(
  params: { skip?: number; limit?: number; search?: string } = {},
): Promise<{ items: SurgicalProcedure[]; count: number }> {
  const { skip = 0, limit = 200, ...rest } = params;
  const res = await apiClient.get<PaginatedResponse<SurgicalProcedure>>("/surgical/procedures/", {
    params: clean({ skip, limit, ...rest }),
  });
  return unwrapList<SurgicalProcedure>(res.data);
}

export async function createProcedure(payload: ProcedurePayload): Promise<SurgicalProcedure> {
  const res = await apiClient.post<{ procedure: SurgicalProcedure }>("/surgical/procedures/", payload);
  return res.data.procedure;
}

export async function deleteProcedure(id: number): Promise<void> {
  await apiClient.delete(`/surgical/procedures/${id}`);
}

// ============================================================
// Cases + lifecycle
// ============================================================

export async function getSurgicalWorklist(
  params: {
    skip?: number;
    limit?: number;
    statuses?: string[];
    operating_theatre_id?: number;
    emergency_only?: boolean;
  } = {},
): Promise<{ items: SurgicalCase[]; count: number }> {
  const { skip = 0, limit = 200, statuses, operating_theatre_id, emergency_only } = params;
  const res = await apiClient.get<PaginatedResponse<SurgicalCase>>("/surgical/cases/worklist", {
    params: clean({ skip, limit, statuses, operating_theatre_id, emergency_only }),
  });
  return unwrapList<SurgicalCase>(res.data);
}

export async function listCasesForVisit(visitId: number): Promise<{ items: SurgicalCase[]; count: number }> {
  const res = await apiClient.get<PaginatedResponse<SurgicalCase>>(`/surgical/cases/visits/${visitId}`);
  return unwrapList<SurgicalCase>(res.data);
}

export async function bookCase(payload: BookCasePayload): Promise<SurgicalCase> {
  const res = await apiClient.post<{ case: SurgicalCase }>("/surgical/cases/", payload);
  return res.data.case;
}

export async function getCase(caseId: number): Promise<SurgicalCase> {
  const res = await apiClient.get<SurgicalCase>(`/surgical/cases/${caseId}`);
  return res.data;
}

type CaseAction =
  | "confirm"
  | "start-pre-op"
  | "into-theatre"
  | "incision"
  | "closure"
  | "post-op"
  | "cancel";

export async function transitionCase(
  caseId: number,
  action: CaseAction,
  payload: CaseTransitionPayload = {},
): Promise<SurgicalCase> {
  const res = await apiClient.post<{ case: SurgicalCase }>(`/surgical/cases/${caseId}/${action}`, payload);
  return res.data.case;
}

export async function completeCase(
  caseId: number,
  payload: CaseTransitionPayload = {},
  routeToSdpId?: number,
): Promise<SurgicalCase> {
  const res = await apiClient.post<{ case: SurgicalCase }>(
    `/surgical/cases/${caseId}/complete`,
    payload,
    { params: clean({ route_to_service_delivery_point_id: routeToSdpId }) },
  );
  return res.data.case;
}

// ============================================================
// Team
// ============================================================

export async function listTeam(caseId: number): Promise<SurgicalTeamMember[]> {
  const res = await apiClient.get<PaginatedResponse<SurgicalTeamMember>>(`/surgical/team/cases/${caseId}`);
  return unwrapList<SurgicalTeamMember>(res.data).items;
}

export async function addTeamMember(payload: {
  surgical_case_id: number;
  staff_profile_id: number;
  role: string;
  is_lead?: boolean;
  notes?: string;
}): Promise<SurgicalTeamMember> {
  const res = await apiClient.post<{ member: SurgicalTeamMember }>("/surgical/team/", payload);
  return res.data.member;
}

export async function removeTeamMember(memberId: number): Promise<void> {
  await apiClient.delete(`/surgical/team/${memberId}`);
}

// ============================================================
// Consent
// ============================================================

export async function listConsents(caseId: number): Promise<SurgicalConsent[]> {
  const res = await apiClient.get<PaginatedResponse<SurgicalConsent>>(`/surgical/consents/cases/${caseId}`);
  return unwrapList<SurgicalConsent>(res.data).items;
}

export async function recordConsent(payload: {
  surgical_case_id: number;
  consent_text: string;
  consent_signed_by?: string;
  relationship_to_patient?: string;
  witnessed_by_staff_id?: number;
}): Promise<SurgicalConsent> {
  const res = await apiClient.post<{ consent: SurgicalConsent }>("/surgical/consents/", payload);
  return res.data.consent;
}

// ============================================================
// Safety checklist (WHO)
// ============================================================

export async function listChecklists(caseId: number): Promise<SurgicalChecklist[]> {
  const res = await apiClient.get<PaginatedResponse<SurgicalChecklist>>(
    `/surgical/checklists/cases/${caseId}`,
  );
  return unwrapList<SurgicalChecklist>(res.data).items;
}

export async function recordChecklist(payload: {
  surgical_case_id: number;
  phase: ChecklistPhase;
  items?: Record<string, boolean>;
  notes?: string;
}): Promise<SurgicalChecklist> {
  const res = await apiClient.post<{ checklist: SurgicalChecklist }>("/surgical/checklists/", payload);
  return res.data.checklist;
}

// ============================================================
// Anaesthesia
// ============================================================

export async function listAnaesthesia(caseId: number): Promise<AnaesthesiaRecord[]> {
  const res = await apiClient.get<PaginatedResponse<AnaesthesiaRecord>>(
    `/surgical/anaesthesia/cases/${caseId}`,
  );
  return unwrapList<AnaesthesiaRecord>(res.data).items;
}

export async function recordAnaesthesia(payload: {
  surgical_case_id: number;
  anaesthesia_type: string;
  anaesthetist_staff_id?: number;
  induction_time?: string;
  emergence_time?: string;
  complications?: string;
  notes?: string;
}): Promise<AnaesthesiaRecord> {
  const res = await apiClient.post<{ record: AnaesthesiaRecord }>("/surgical/anaesthesia/", payload);
  return res.data.record;
}

// ============================================================
// Theatre notes
// ============================================================

export async function listNotes(caseId: number): Promise<TheatreNote[]> {
  const res = await apiClient.get<PaginatedResponse<TheatreNote>>(`/surgical/notes/cases/${caseId}`);
  return unwrapList<TheatreNote>(res.data).items;
}

export async function addNote(payload: {
  surgical_case_id: number;
  note: string;
  note_type?: string;
  author_staff_id?: number;
}): Promise<TheatreNote> {
  const res = await apiClient.post<{ theatre_note: TheatreNote }>("/surgical/notes/", payload);
  return res.data.theatre_note;
}

// ============================================================
// Instrument sets
// ============================================================

export async function listInstrumentSets(
  params: { skip?: number; limit?: number; sterilization_status?: string; search?: string } = {},
): Promise<{ items: InstrumentSet[]; count: number }> {
  const { skip = 0, limit = 100, ...rest } = params;
  const res = await apiClient.get<PaginatedResponse<InstrumentSet>>("/surgical/instrument-sets/", {
    params: clean({ skip, limit, ...rest }),
  });
  return unwrapList<InstrumentSet>(res.data);
}

export async function createInstrumentSet(payload: {
  code: string;
  name: string;
  notes?: string;
}): Promise<InstrumentSet> {
  const res = await apiClient.post<{ instrument_set: InstrumentSet }>("/surgical/instrument-sets/", payload);
  return res.data.instrument_set;
}

export async function assignInstrumentSet(setId: number, surgical_case_id: number): Promise<InstrumentSet> {
  const res = await apiClient.post<{ instrument_set: InstrumentSet }>(
    `/surgical/instrument-sets/${setId}/assign`,
    { surgical_case_id },
  );
  return res.data.instrument_set;
}

export async function logSterilization(
  setId: number,
  payload: {
    instrument_set_id: number;
    cycle_started_at: string;
    cycle_ended_at?: string;
    method?: string;
    machine_identifier?: string;
    indicator_passed?: boolean;
    notes?: string;
  },
): Promise<SterilizationLog> {
  const res = await apiClient.post<{ log: SterilizationLog }>(
    `/surgical/instrument-sets/${setId}/sterilization`,
    payload,
  );
  return res.data.log;
}

// ============================================================
// Display helpers
// ============================================================

export function caseStatusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function fmtDateTime(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
