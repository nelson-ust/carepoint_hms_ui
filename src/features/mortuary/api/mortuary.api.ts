import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

// ---------- Types ----------

export type MortuaryUnitType = "COLD_CHAMBER" | "FREEZER" | "SHELF" | "OTHER";
export type MortuaryUnitStatus = "AVAILABLE" | "PARTIAL" | "FULL" | "OUT_OF_SERVICE";
export type DeceasedSource = "IN_HOSPITAL" | "BROUGHT_IN";
export type DeceasedStatus = "REGISTERED" | "IN_STORAGE" | "RELEASED" | "TRANSFERRED";

export type MortuaryUnit = {
  id: number;
  code: string;
  name: string;
  unit_type: MortuaryUnitType;
  capacity: number;
  status: MortuaryUnitStatus;
  location?: string | null;
  temperature_c?: number | null;
  notes?: string | null;
  occupied: number;
  available_slots: number;
  created_at?: string;
  updated_at?: string;
};

export type DeceasedRecord = {
  id: number;
  tag_number: string;
  source: DeceasedSource;
  status: DeceasedStatus;
  patient_id?: number | null;
  visit_id?: number | null;
  deceased_name: string;
  gender?: string | null;
  age_years?: number | null;
  date_of_death?: string | null;
  cause_of_death?: string | null;
  brought_in_by?: string | null;
  brought_in_contact?: string | null;
  from_location?: string | null;
  next_of_kin_name?: string | null;
  next_of_kin_phone?: string | null;
  next_of_kin_relationship?: string | null;
  is_police_case: boolean;
  police_reference?: string | null;
  mortuary_unit_id?: number | null;
  mortuary_unit_name?: string | null;
  received_by_staff_id?: number | null;
  registered_at?: string | null;
  released_to_name?: string | null;
  released_to_relationship?: string | null;
  released_to_contact?: string | null;
  release_authorized_by?: string | null;
  released_by_staff_id?: number | null;
  released_at?: string | null;
  release_notes?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type MortuaryStats = {
  in_storage: number;
  registered: number;
  released: number;
  in_hospital_total: number;
  brought_in_total: number;
  police_cases: number;
  units_total: number;
  capacity_total: number;
  occupied_total: number;
  by_status: Record<string, number>;
};

// ---------- Payloads ----------

export type CreateUnitPayload = {
  code: string;
  name: string;
  unit_type: MortuaryUnitType;
  capacity: number;
  location?: string;
  temperature_c?: number;
  notes?: string;
};
export type UpdateUnitPayload = Partial<Omit<CreateUnitPayload, "code">> & { status?: MortuaryUnitStatus };

export type RegisterDeceasedPayload = {
  source: DeceasedSource;
  patient_id?: number;
  visit_id?: number;
  death_record_id?: number;
  deceased_name: string;
  gender?: string;
  age_years?: number;
  date_of_death?: string;
  cause_of_death?: string;
  brought_in_by?: string;
  brought_in_contact?: string;
  from_location?: string;
  next_of_kin_name?: string;
  next_of_kin_phone?: string;
  next_of_kin_relationship?: string;
  is_police_case?: boolean;
  police_reference?: string;
  mortuary_unit_id?: number;
  received_by_staff_id?: number;
  tag_number?: string;
  notes?: string;
};

export type AssignStoragePayload = { mortuary_unit_id: number; received_by_staff_id?: number };

export type ReleaseDeceasedPayload = {
  released_to_name: string;
  released_to_relationship?: string;
  released_to_contact?: string;
  release_authorized_by?: string;
  released_by_staff_id?: number;
  released_at?: string;
  release_notes?: string;
  transfer?: boolean;
  // settlement
  storage_daily_rate?: number;
  payment?: { amount: number; method: string; reference?: string; payer_name?: string; notes?: string };
  waive_outstanding?: boolean;
  waiver_reason?: string;
};

export type PatientDeath = {
  id: number;
  patient_id: number;
  visit_id: number;
  patient_name?: string | null;
  hospital_number?: string | null;
  visit_code?: string | null;
  date_of_death?: string | null;
  cause_of_death?: string | null;
  place_of_death?: string | null;
  declared_by_staff_id?: number | null;
  notes?: string | null;
  is_deposited: boolean;
  deceased_record_id?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type RecordDeathPayload = {
  patient_id: number;
  visit_id: number;
  date_of_death: string;
  cause_of_death?: string;
  place_of_death?: string;
  declared_by_staff_id?: number;
  notes?: string;
  deposit_to_mortuary?: boolean;
  mortuary_unit_id?: number;
  next_of_kin_name?: string;
  next_of_kin_phone?: string;
  next_of_kin_relationship?: string;
  is_police_case?: boolean;
  police_reference?: string;
  tag_number?: string;
};

export type Autopsy = {
  id: number; deceased_record_id: number; autopsy_type: "CLINICAL" | "MEDICO_LEGAL";
  status: "REQUESTED" | "SCHEDULED" | "COMPLETED" | "CANCELLED";
  requested_by?: string | null; pathologist?: string | null;
  scheduled_at?: string | null; performed_at?: string | null;
  findings?: string | null; cause_of_death_confirmed?: string | null;
  consent_by?: string | null; notes?: string | null;
  deceased_name?: string | null; tag_number?: string | null;
  created_at?: string; updated_at?: string;
};
export type Embalming = {
  id: number; deceased_record_id: number; status: "PENDING" | "COMPLETED";
  embalmer_name?: string | null; method?: string | null; chemicals_used?: string | null;
  embalmed_at?: string | null; notes?: string | null; created_at?: string;
};
export type Effect = {
  id: number; deceased_record_id: number; status: "HELD" | "RELEASED";
  item: string; quantity: number; description?: string | null; received_from?: string | null;
  received_at?: string | null; released_to?: string | null; released_at?: string | null;
};
export type Viewing = {
  id: number; deceased_record_id: number; visitor_name: string;
  relationship_to_deceased?: string | null; contact?: string | null;
  viewed_at?: string | null; authorized_by?: string | null; notes?: string | null;
};
export type Charge = {
  id: number; deceased_record_id: number;
  charge_type: "STORAGE" | "EMBALMING" | "AUTOPSY" | "BODY_PREP" | "MORTUARY_FEE" | "OTHER";
  status: "PENDING" | "PAID" | "WAIVED"; description?: string | null;
  quantity: number; unit_amount: number; amount: number; charged_at?: string | null;
  notes?: string | null; deceased_name?: string | null; tag_number?: string | null;
};
export type Certificate = {
  id: number; deceased_record_id: number; certificate_number: string;
  issued_by?: string | null; certifying_doctor?: string | null; issued_at?: string | null;
  cause_of_death?: string | null; manner_of_death?: string | null; place_of_death?: string | null;
  notes?: string | null;
};

export type MortuaryAnalytics = {
  summary: {
    total_records: number; in_storage: number; registered_pending: number; released: number;
    transferred: number; in_hospital: number; brought_in: number; police_cases: number;
    capacity_total: number; occupied_total: number; utilization_pct: number;
    avg_released_los_days: number; avg_current_los_days: number; pending_deposits: number;
  };
  source_split: { name: string; value: number }[];
  status_breakdown: { name: string; value: number }[];
  intake_trend: { month: string; registrations: number; releases: number; deaths: number }[];
  unit_utilization: { name: string; code: string; capacity: number; occupied: number; pct: number; status: string }[];
  los_buckets: { bucket: string; count: number }[];
  long_stay: { id: number; tag_number: string; deceased_name: string; unit: string | null; days: number }[];
  autopsy: { requested: number; scheduled: number; completed: number; cancelled: number; clinical: number; medico_legal: number; total: number };
  billing: { total: string; collected: string; outstanding: string; waived: string; collection_rate: number; by_type: { type: string; amount: string }[] };
  top_causes: { cause: string; count: number }[];
};

export type MortuaryPayment2 = {
  id: number; deceased_record_id: number; amount: number | string; method: string;
  reference?: string | null; payer_name?: string | null; paid_at?: string | null; notes?: string | null;
};
export type BillSummary = {
  deceased_record_id: number; total_billed: string; total_paid: string; waived: string; outstanding: string;
  days_in_storage: number; charges: Charge[]; payments: MortuaryPayment2[];
};

// ---------- Endpoints ----------

export const mortuaryApi = {
  getAnalytics: (months = 6) =>
    apiClient
      .get<{ success: boolean; message: string } & MortuaryAnalytics>("/mortuary/analytics", { params: { months } })
      .then((res) => {
        const { success: _s, message: _m, ...rest } = res.data;
        return rest as MortuaryAnalytics;
      }),

  getStats: () =>
    apiClient
      .get<{ success: boolean; message: string } & MortuaryStats>("/mortuary/stats")
      .then((res) => {
        const { success: _s, message: _m, ...stats } = res.data;
        return { ...stats, by_status: stats.by_status ?? {} } as MortuaryStats;
      }),

  // Storage units
  listUnits: (params: { skip?: number; limit?: number; status?: string } = {}) =>
    apiClient.get<PaginatedResponse<MortuaryUnit>>("/mortuary/units", { params }).then((res) => res.data),
  createUnit: (payload: CreateUnitPayload) =>
    apiClient.post<{ success: boolean; message: string; unit: MortuaryUnit }>("/mortuary/units", payload).then((res) => res.data),
  updateUnit: (id: number, payload: UpdateUnitPayload) =>
    apiClient.put<{ success: boolean; message: string; unit: MortuaryUnit }>(`/mortuary/units/${id}`, payload).then((res) => res.data),
  deleteUnit: (id: number) => apiClient.delete(`/mortuary/units/${id}`).then((res) => res.data),

  // Deceased records
  listDeceased: (
    params: { skip?: number; limit?: number; status?: string; source?: string; unit_id?: number; police_only?: boolean; search?: string } = {},
  ) => apiClient.get<PaginatedResponse<DeceasedRecord>>("/mortuary/deceased", { params }).then((res) => res.data),
  getDeceased: (id: number) => apiClient.get<DeceasedRecord>(`/mortuary/deceased/${id}`).then((res) => res.data),
  register: (payload: RegisterDeceasedPayload) =>
    apiClient.post<{ success: boolean; message: string; record: DeceasedRecord }>("/mortuary/deceased", payload).then((res) => res.data),
  assignStorage: (id: number, payload: AssignStoragePayload) =>
    apiClient.post<{ success: boolean; message: string; record: DeceasedRecord }>(`/mortuary/deceased/${id}/assign-storage`, payload).then((res) => res.data),
  release: (id: number, payload: ReleaseDeceasedPayload) =>
    apiClient.post<{ success: boolean; message: string; record: DeceasedRecord }>(`/mortuary/deceased/${id}/release`, payload).then((res) => res.data),

  // Patient deaths
  recordDeath: (payload: RecordDeathPayload) =>
    apiClient
      .post<{ success: boolean; message: string; death: PatientDeath; record: DeceasedRecord | null }>("/mortuary/deaths", payload)
      .then((res) => res.data),
  listPendingDeaths: () =>
    apiClient.get<PaginatedResponse<PatientDeath>>("/mortuary/deaths/pending").then((res) => res.data),

  // Autopsies
  listAutopsies: (params: { status?: string } = {}) =>
    apiClient.get<PaginatedResponse<Autopsy>>("/mortuary/autopsies", { params }).then((res) => res.data),
  listRecordAutopsies: (recordId: number) =>
    apiClient.get<PaginatedResponse<Autopsy>>(`/mortuary/deceased/${recordId}/autopsies`).then((res) => res.data),
  createAutopsy: (recordId: number, payload: Record<string, unknown>) =>
    apiClient.post<{ data: Autopsy }>(`/mortuary/deceased/${recordId}/autopsies`, payload).then((res) => res.data),
  updateAutopsy: (autopsyId: number, payload: Record<string, unknown>) =>
    apiClient.put<{ data: Autopsy }>(`/mortuary/autopsies/${autopsyId}`, payload).then((res) => res.data),

  // Embalming
  listEmbalming: (recordId: number) =>
    apiClient.get<PaginatedResponse<Embalming>>(`/mortuary/deceased/${recordId}/embalming`).then((res) => res.data),
  createEmbalming: (recordId: number, payload: Record<string, unknown>) =>
    apiClient.post<{ data: Embalming }>(`/mortuary/deceased/${recordId}/embalming`, payload).then((res) => res.data),

  // Personal effects
  listEffects: (recordId: number) =>
    apiClient.get<PaginatedResponse<Effect>>(`/mortuary/deceased/${recordId}/effects`).then((res) => res.data),
  createEffect: (recordId: number, payload: Record<string, unknown>) =>
    apiClient.post<{ data: Effect }>(`/mortuary/deceased/${recordId}/effects`, payload).then((res) => res.data),
  releaseEffect: (effectId: number, released_to: string) =>
    apiClient.post<{ data: Effect }>(`/mortuary/effects/${effectId}/release`, { released_to }).then((res) => res.data),

  // Viewings
  listViewings: (recordId: number) =>
    apiClient.get<PaginatedResponse<Viewing>>(`/mortuary/deceased/${recordId}/viewings`).then((res) => res.data),
  createViewing: (recordId: number, payload: Record<string, unknown>) =>
    apiClient.post<{ data: Viewing }>(`/mortuary/deceased/${recordId}/viewings`, payload).then((res) => res.data),

  // Charges / billing
  listCharges: (params: { status?: string } = {}) =>
    apiClient.get<PaginatedResponse<Charge>>("/mortuary/charges", { params }).then((res) => res.data),
  listRecordCharges: (recordId: number) =>
    apiClient.get<PaginatedResponse<Charge> & { meta: { summary?: Record<string, string> } }>(`/mortuary/deceased/${recordId}/charges`).then((res) => res.data),
  createCharge: (recordId: number, payload: Record<string, unknown>) =>
    apiClient.post<{ data: Charge }>(`/mortuary/deceased/${recordId}/charges`, payload).then((res) => res.data),
  setChargeStatus: (chargeId: number, chargeStatus: "PAID" | "WAIVED") =>
    apiClient.post<{ data: Charge }>(`/mortuary/charges/${chargeId}/status`, { status: chargeStatus }).then((res) => res.data),

  // Death certificate
  getCertificate: (recordId: number) =>
    apiClient.get<{ data: Certificate | Record<string, never> }>(`/mortuary/deceased/${recordId}/certificate`).then((res) => res.data),
  issueCertificate: (recordId: number, payload: Record<string, unknown>) =>
    apiClient.post<{ data: Certificate }>(`/mortuary/deceased/${recordId}/certificate`, payload).then((res) => res.data),

  // Billing / finance
  getBillingSummary: (recordId: number) =>
    apiClient.get<{ success: boolean; message: string } & BillSummary>(`/mortuary/deceased/${recordId}/billing-summary`).then((res) => {
      const { success: _s, message: _m, ...rest } = res.data;
      return rest as BillSummary;
    }),
  addPayment: (recordId: number, payload: { amount: number; method: string; reference?: string; payer_name?: string; notes?: string }) =>
    apiClient.post<{ data: MortuaryPayment2 }>(`/mortuary/deceased/${recordId}/payments`, payload).then((res) => res.data),
  accrueStorage: (recordId: number, daily_rate: number) =>
    apiClient.post<{ data: Charge }>(`/mortuary/deceased/${recordId}/accrue-storage`, { daily_rate }).then((res) => res.data),
};
