import { apiClient } from "@/lib/api/api-client";

// ---------- Types ----------

export type PartnerTenant = { id: number; name: string; code: string };

export type PatientLookupResult = {
  found: boolean;
  holding_tenant_id: number;
  patient_global_id: string;
  display_name?: string | null;
  sex?: string | null;
  date_of_birth?: string | null;
};

export type DataRequestStatus =
  | "PENDING" | "APPROVED" | "DENIED" | "FULFILLED" | "EXPIRED" | "CANCELLED";

export type DataRequest = {
  id: number;
  request_no: string;
  requesting_tenant_id: number;
  holding_tenant_id: number;
  patient_global_id: string;
  patient_display_name?: string | null;
  purpose: string;
  scope: string;
  status: DataRequestStatus;
  requested_by_user_id?: number | null;
  requested_at?: string | null;
  consent_confirmed: boolean;
  consent_reference?: string | null;
  approved_at?: string | null;
  denied_reason?: string | null;
  payload_generated_at?: string | null;
  retrieved_at?: string | null;
  expires_at?: string | null;
  requesting_tenant_name?: string | null;
  holding_tenant_name?: string | null;
};

export type SharedRecord = {
  id: number;
  request_no: string;
  status: string;
  patient_global_id: string;
  payload?: Record<string, any> | null;
};

export type InterFacilityReferral = {
  id: number;
  referral_no: string;
  source_tenant_id: number;
  target_tenant_id: number;
  patient_global_id: string;
  reason_for_referral: string;
  clinical_summary?: string | null;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "COMPLETED" | "CANCELLED";
  referral_date?: string | null;
  responded_at?: string | null;
  acceptance_note?: string | null;
  declined_reason?: string | null;
  is_history_access_granted?: boolean;
  access_expires_at?: string | null;
};

function asItems<T>(data: any): T[] {
  if (Array.isArray(data?.items)) return data.items as T[];
  if (Array.isArray(data)) return data as T[];
  return [];
}

// ---------- Partner directory + patient lookup ----------

export const interopApi = {
  partners: () =>
    apiClient.get("/interoperability/partners").then((r) => asItems<PartnerTenant>(r.data)),

  lookupPatient: (holding_tenant_id: number, patient_global_id: string) =>
    apiClient
      .get<PatientLookupResult>("/interoperability/patient-lookup", {
        params: { holding_tenant_id, patient_global_id },
      })
      .then((r) => r.data),

  // ----- data requests -----
  createDataRequest: (payload: {
    holding_tenant_id: number;
    patient_global_id: string;
    patient_display_name?: string;
    purpose: string;
    scope?: string;
  }) =>
    apiClient.post("/interoperability/data-requests", payload).then((r) => r.data?.request as DataRequest),

  outgoingRequests: () =>
    apiClient.get("/interoperability/data-requests/outgoing").then((r) => asItems<DataRequest>(r.data)),

  incomingRequests: () =>
    apiClient.get("/interoperability/data-requests/incoming").then((r) => asItems<DataRequest>(r.data)),

  approveRequest: (id: number, payload: { consent_confirmed: boolean; consent_reference: string; access_expiry_days: number }) =>
    apiClient.post(`/interoperability/data-requests/${id}/approve`, payload).then((r) => r.data?.request as DataRequest),

  denyRequest: (id: number, reason: string) =>
    apiClient.post(`/interoperability/data-requests/${id}/deny`, { reason }).then((r) => r.data?.request as DataRequest),

  cancelRequest: (id: number) =>
    apiClient.post(`/interoperability/data-requests/${id}/cancel`, {}).then((r) => r.data?.request as DataRequest),

  retrieveRecord: (id: number) =>
    apiClient.get<SharedRecord>(`/interoperability/data-requests/${id}/record`).then((r) => r.data),
};

// ---------- Internal facility referrals (within the same tenant) ----------

export type FacilityReferral = {
  id: number;
  referral_no: string;
  patient_id: number;
  visit_id?: number | null;
  destination_facility: string;
  destination_facility_id?: number | null;
  source_facility_id?: number | null;
  reason_for_referral: string;
  clinical_summary?: string | null;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "COMPLETED" | "CANCELLED";
  priority?: string | null;
  referral_date?: string | null;
};

export const facilityReferralApi = {
  create: (payload: {
    patient_id: number;
    destination_facility_id: number;
    reason_for_referral: string;
    clinical_summary?: string;
    priority?: string;
  }) => apiClient.post("/referrals/", payload).then((r) => r.data?.referral as FacilityReferral),

  incoming: () => apiClient.get("/referrals/facility/incoming").then((r) => asItems<FacilityReferral>(r.data)),
  outgoing: () => apiClient.get("/referrals/facility/outgoing").then((r) => asItems<FacilityReferral>(r.data)),

  updateStatus: (id: number, status: "COMPLETED" | "CANCELLED") =>
    apiClient.patch(`/referrals/${id}`, { status }).then((r) => r.data?.referral as FacilityReferral),
};

// ---------- Inter-facility referrals (existing endpoints) ----------

export const interopReferralApi = {
  create: (payload: {
    target_tenant_id: number;
    target_facility_id: number;
    patient_global_id: string;
    reason_for_referral: string;
    clinical_summary?: string;
    referral_date?: string;
  }) =>
    apiClient.post("/referrals/inter-facility", payload).then((r) => r.data?.referral as InterFacilityReferral),

  incoming: () =>
    apiClient.get("/referrals/inter-facility/incoming").then((r) => asItems<InterFacilityReferral>(r.data)),

  outgoing: () =>
    apiClient.get("/referrals/inter-facility/outgoing").then((r) => asItems<InterFacilityReferral>(r.data)),

  /** Post-acceptance: the receiving hospital pulls the referred patient's
   *  live record (history + baseline diagnostics) under the access grant. */
  record: (id: number) =>
    apiClient.get(`/referrals/inter-facility/${id}/record`).then(
      (r) => r.data?.record as {
        id: number;
        referral_no: string;
        patient_global_id: string;
        access_expires_at?: string | null;
        payload: any;
      },
    ),


  /** Receiving hospital: preview a one-click patient import from an accepted referral. */
  importPreview: (id: number) =>
    apiClient.get(`/referrals/inter-facility/${id}/import-preview`).then((r) => r.data?.preview as ReferralImportPreview),

  /** Receiving hospital: create the local patient record from the referral. */
  createPatient: (id: number, payload: { overrides?: Record<string, unknown>; force?: boolean }) =>
    apiClient.post(`/referrals/inter-facility/${id}/create-patient`, payload).then((r) => r.data?.result as ReferralImportResult),
  respond: (id: number, payload: { status: "ACCEPTED" | "DECLINED"; note?: string; access_expiry_days?: number }) =>
    apiClient.post(`/referrals/inter-facility/${id}/respond`, payload).then((r) => r.data?.referral as InterFacilityReferral),
};


// ---------- Referral-based patient import ----------

export type ReferralImportPreview = {
  referral_id: number;
  referral_no: string;
  already_imported: boolean;
  existing_patient_id?: number | null;
  package: any;
  plan: {
    will_create_patient: boolean;
    will_create_baseline_profile: boolean;
    recent_visits_to_import: number;
    clinical_records_available: Record<string, number>;
    next_hospital_number: string;
    global_patient_id_preserved: string;
  };
  possible_duplicates: { id: number; hospital_number: string; name: string }[];
  warnings: string[];
};

export type ReferralImportResult = {
  patient_id: number;
  hospital_number: string;
  global_patient_id: string;
  referral_no: string;
  full_name: string;
  records_created: Record<string, number>;
};
