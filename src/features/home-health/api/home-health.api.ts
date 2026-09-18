import { apiClient } from "@/lib/api/api-client";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
export type ListResult<T> = {
  items: T[];
  total: number;
  meta?: Record<string, unknown>;
};

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

// ===========================================================================
// Home Visits
// ===========================================================================
export type HomeVisitStatus =
  | "REQUESTED" | "APPROVED" | "ASSIGNED" | "EN_ROUTE"
  | "ARRIVED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "MISSED";

export type HomeVisitType =
  | "ROUTINE" | "FOLLOW_UP" | "ASSESSMENT" | "RECURRING" | "EMERGENCY"
  | "WOUND_CARE" | "MEDICATION" | "REHABILITATION" | "PALLIATIVE";

export type HomeVisitPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type HomeVisit = {
  id: number;
  visit_code: string;
  patient_id: number;
  facility_id?: number | null;
  care_plan_id?: number | null;
  assigned_staff_id?: number | null;
  requested_by_user_id?: number | null;
  visit_type: HomeVisitType | string;
  status: HomeVisitStatus | string;
  priority: HomeVisitPriority | string;
  reason?: string | null;
  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;
  eta_minutes?: number | null;
  en_route_at?: string | null;
  arrived_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_recurring?: boolean;
  recurrence_rule?: string | null;
  cancellation_reason?: string | null;
  patient_name?: string | null;
  assigned_staff_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type HomeVisitCreatePayload = {
  patient_id: number;
  care_plan_id?: number | null;
  facility_id?: number | null;
  assigned_staff_id?: number | null;
  visit_type?: HomeVisitType;
  priority?: HomeVisitPriority;
  reason?: string | null;
  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;
  eta_minutes?: number | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  is_recurring?: boolean;
  recurrence_rule?: string | null;
};

export type HomeVisitStatusEvent = {
  id: number;
  home_visit_id: number;
  from_status?: string | null;
  to_status: string;
  note?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  changed_by_user_id?: number | null;
  occurred_at: string;
};

export type HomeVisitNote = {
  id: number;
  home_visit_id: number;
  patient_id: number;
  reason_for_visit?: string | null;
  symptoms?: string | null;
  physical_assessment?: string | null;
  nursing_assessment?: string | null;
  clinical_observations?: string | null;
  assessment_diagnosis?: string | null;
  procedures_performed?: string | null;
  medication_administered?: string | null;
  wound_notes?: string | null;
  patient_education?: string | null;
  care_plan_updates?: string | null;
  follow_up_required?: boolean;
  follow_up_notes?: string | null;
  temperature_celsius?: number | null;
  pulse_rate?: number | null;
  respiratory_rate?: number | null;
  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  oxygen_saturation?: number | null;
  blood_glucose?: number | null;
  weight_kg?: number | null;
  pain_score?: number | null;
  signed_by_staff_id?: number | null;
  signed_at?: string | null;
};

export type HomeVisitNotePayload = Partial<Omit<HomeVisitNote, "id" | "home_visit_id" | "patient_id" | "signed_at">> & {
  record_vitals_as_readings?: boolean;
};

export const homeVisitsApi = {
  list: (params: {
    skip?: number; limit?: number; status?: string; patient_id?: number;
    assigned_staff_id?: number; visit_type?: string; priority?: string;
    from_dt?: string; to_dt?: string;
  } = {}): Promise<ListResult<HomeVisit>> =>
    apiClient.get("/home-visits/", { params: cleanParams(params) }).then((r) => toList<HomeVisit>(r.data)),
  get: (id: number): Promise<HomeVisit> =>
    apiClient.get(`/home-visits/${id}`).then((r) => r.data.home_visit),
  create: (payload: HomeVisitCreatePayload): Promise<HomeVisit> =>
    apiClient.post("/home-visits/", payload).then((r) => r.data.home_visit),
  update: (id: number, payload: Partial<HomeVisitCreatePayload>): Promise<HomeVisit> =>
    apiClient.patch(`/home-visits/${id}`, payload).then((r) => r.data.home_visit),
  assign: (id: number, payload: { assigned_staff_id: number; eta_minutes?: number; note?: string }): Promise<HomeVisit> =>
    apiClient.post(`/home-visits/${id}/assign`, payload).then((r) => r.data.home_visit),
  changeStatus: (id: number, payload: { status: HomeVisitStatus; note?: string; latitude?: number; longitude?: number; eta_minutes?: number }): Promise<HomeVisit> =>
    apiClient.post(`/home-visits/${id}/status`, payload).then((r) => r.data.home_visit),
  cancel: (id: number, reason?: string): Promise<HomeVisit> =>
    apiClient.post(`/home-visits/${id}/cancel`, { reason }).then((r) => r.data.home_visit),
  events: (id: number): Promise<HomeVisitStatusEvent[]> =>
    apiClient.get(`/home-visits/${id}/events`).then((r) => r.data.items ?? []),
  getNote: (id: number): Promise<HomeVisitNote | null> =>
    apiClient.get(`/home-visits/${id}/documentation`).then((r) => r.data.note).catch(() => null),
  saveNote: (id: number, payload: HomeVisitNotePayload): Promise<HomeVisitNote> =>
    apiClient.put(`/home-visits/${id}/documentation`, payload).then((r) => r.data.note),
};

// ===========================================================================
// Care Plans
// ===========================================================================
export type CarePlanStatus = "DRAFT" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";

export type CarePlan = {
  id: number;
  patient_id: number;
  title: string;
  condition?: string | null;
  description?: string | null;
  status: CarePlanStatus | string;
  priority: string;
  start_date?: string | null;
  end_date?: string | null;
  lead_staff_id?: number | null;
  review_frequency_days?: number | null;
  next_review_date?: string | null;
  patient_name?: string | null;
  lead_staff_name?: string | null;
  goal_count?: number | null;
  open_task_count?: number | null;
  created_at?: string | null;
};

export type CarePlanGoal = {
  id: number; care_plan_id: number; description: string; goal_type: string;
  status: string; target_date?: string | null; baseline_value?: string | null;
  target_value?: string | null; current_value?: string | null; measure_unit?: string | null;
  progress_percent?: number | null;
};

export type CarePlanIntervention = {
  id: number; care_plan_id: number; goal_id?: number | null; title: string;
  description?: string | null; category?: string | null; assigned_staff_id?: number | null;
  frequency: string; frequency_detail?: string | null; start_date?: string | null;
  end_date?: string | null; status: string;
};

export type CareTask = {
  id: number; care_plan_id: number; intervention_id?: number | null; home_visit_id?: number | null;
  patient_id: number; title: string; description?: string | null; assigned_staff_id?: number | null;
  due_at?: string | null; status: string; completed_at?: string | null;
  completed_by_staff_id?: number | null; completion_note?: string | null;
};

export type CarePlanProgressNote = {
  id: number; care_plan_id: number; goal_id?: number | null; note: string;
  progress_value?: string | null; recorded_by_staff_id?: number | null; recorded_at: string;
};

export type CarePlanReview = {
  id: number; care_plan_id: number; reviewed_by_staff_id?: number | null; review_date: string;
  summary?: string | null; outcome: string; next_review_date?: string | null;
};

export type CarePlanDetail = CarePlan & {
  goals: CarePlanGoal[];
  interventions: CarePlanIntervention[];
  tasks: CareTask[];
  progress_notes: CarePlanProgressNote[];
  reviews: CarePlanReview[];
};

export const carePlansApi = {
  list: (params: { skip?: number; limit?: number; patient_id?: number; status?: string; lead_staff_id?: number } = {}): Promise<ListResult<CarePlan>> =>
    apiClient.get("/care-plans/", { params: cleanParams(params) }).then((r) => toList<CarePlan>(r.data)),
  get: (id: number): Promise<CarePlanDetail> =>
    apiClient.get(`/care-plans/${id}`).then((r) => r.data),
  create: (payload: { patient_id: number; title: string; condition?: string; description?: string; status?: CarePlanStatus; priority?: string; start_date?: string; end_date?: string; lead_staff_id?: number; review_frequency_days?: number; next_review_date?: string }): Promise<CarePlan> =>
    apiClient.post("/care-plans/", payload).then((r) => r.data.care_plan),
  update: (id: number, payload: Record<string, unknown>): Promise<CarePlan> =>
    apiClient.patch(`/care-plans/${id}`, payload).then((r) => r.data.care_plan),
  addGoal: (planId: number, payload: Record<string, unknown>): Promise<CarePlanGoal> =>
    apiClient.post(`/care-plans/${planId}/goals`, payload).then((r) => r.data),
  updateGoal: (goalId: number, payload: Record<string, unknown>): Promise<CarePlanGoal> =>
    apiClient.patch(`/care-plans/goals/${goalId}`, payload).then((r) => r.data),
  addIntervention: (planId: number, payload: Record<string, unknown>): Promise<CarePlanIntervention> =>
    apiClient.post(`/care-plans/${planId}/interventions`, payload).then((r) => r.data),
  updateIntervention: (id: number, payload: Record<string, unknown>): Promise<CarePlanIntervention> =>
    apiClient.patch(`/care-plans/interventions/${id}`, payload).then((r) => r.data),
  addTask: (planId: number, payload: Record<string, unknown>): Promise<CareTask> =>
    apiClient.post(`/care-plans/${planId}/tasks`, payload).then((r) => r.data),
  updateTask: (taskId: number, payload: Record<string, unknown>): Promise<CareTask> =>
    apiClient.patch(`/care-plans/tasks/${taskId}`, payload).then((r) => r.data),
  completeTask: (taskId: number, payload: { completion_note?: string; completed_by_staff_id?: number } = {}): Promise<CareTask> =>
    apiClient.post(`/care-plans/tasks/${taskId}/complete`, payload).then((r) => r.data),
  listTasks: (params: { skip?: number; limit?: number; patient_id?: number; assigned_staff_id?: number; status?: string } = {}): Promise<ListResult<CareTask>> =>
    apiClient.get("/care-plans/tasks", { params: cleanParams(params) }).then((r) => toList<CareTask>(r.data)),
  addProgressNote: (planId: number, payload: { note: string; goal_id?: number; progress_value?: string; recorded_by_staff_id?: number }): Promise<CarePlanProgressNote> =>
    apiClient.post(`/care-plans/${planId}/progress-notes`, payload).then((r) => r.data),
  addReview: (planId: number, payload: { summary?: string; outcome?: string; review_date?: string; next_review_date?: string; reviewed_by_staff_id?: number }): Promise<CarePlanReview> =>
    apiClient.post(`/care-plans/${planId}/reviews`, payload).then((r) => r.data),
};

// ===========================================================================
// Remote Monitoring
// ===========================================================================
export type MonitoringReadingType =
  | "BLOOD_PRESSURE" | "PULSE" | "TEMPERATURE" | "BLOOD_GLUCOSE" | "OXYGEN_SATURATION"
  | "RESPIRATORY_RATE" | "WEIGHT" | "ECG" | "PAIN_SCORE" | "SLEEP" | "ACTIVITY" | "OTHER";

export type MonitoringSource =
  | "MANUAL" | "PATIENT_APP" | "CAREGIVER" | "DEVICE_BLUETOOTH" | "WEARABLE" | "IMPORT";

export type MonitoringReading = {
  id: number; patient_id: number; care_plan_id?: number | null; home_visit_id?: number | null;
  device_id?: number | null; reading_type: string; source: string;
  primary_value?: number | null; secondary_value?: number | null;
  systolic?: number | null; diastolic?: number | null; unit?: string | null;
  is_abnormal?: boolean; severity?: string | null; recorded_at: string;
  received_at?: string | null; notes?: string | null;
};

export type MonitoringDevice = {
  id: number; patient_id: number; device_type: string; name: string;
  manufacturer?: string | null; model?: string | null; serial_number?: string | null;
  connection_type: string; last_sync_at?: string | null; is_active?: boolean;
};

export type TrendPoint = {
  recorded_at: string; primary_value?: number | null; secondary_value?: number | null;
  systolic?: number | null; diastolic?: number | null; is_abnormal?: boolean; severity?: string | null;
};

export type MonitoringTrend = {
  patient_id: number; reading_type: string; unit?: string | null; points: TrendPoint[]; count: number;
};

export type RecordReadingResult = {
  reading: MonitoringReading; alert_raised: boolean; alert_id?: number | null; alert_severity?: string | null;
};

export const monitoringApi = {
  listReadings: (params: { skip?: number; limit?: number; patient_id?: number; reading_type?: string; abnormal_only?: boolean; from_dt?: string; to_dt?: string } = {}): Promise<ListResult<MonitoringReading>> =>
    apiClient.get("/remote-monitoring/readings", { params: cleanParams(params) }).then((r) => toList<MonitoringReading>(r.data)),
  recordReading: (payload: {
    patient_id: number; reading_type: MonitoringReadingType; source?: MonitoringSource;
    primary_value?: number; secondary_value?: number; systolic?: number; diastolic?: number;
    unit?: string; recorded_at?: string; notes?: string; care_plan_id?: number; device_id?: number;
  }): Promise<RecordReadingResult> =>
    apiClient.post("/remote-monitoring/readings", payload).then((r) => r.data),
  trend: (patientId: number, readingType: string, limit = 100): Promise<MonitoringTrend> =>
    apiClient.get(`/remote-monitoring/patients/${patientId}/trends`, { params: { reading_type: readingType, limit } }).then((r) => r.data),
  listDevices: (params: { skip?: number; limit?: number; patient_id?: number } = {}): Promise<ListResult<MonitoringDevice>> =>
    apiClient.get("/remote-monitoring/devices", { params: cleanParams(params) }).then((r) => toList<MonitoringDevice>(r.data)),
  registerDevice: (payload: { patient_id: number; device_type: string; name: string; manufacturer?: string; model?: string; serial_number?: string; connection_type?: string; notes?: string }): Promise<MonitoringDevice> =>
    apiClient.post("/remote-monitoring/devices", payload).then((r) => r.data.device),
  listThresholds: (params: { patient_id?: number; include_defaults?: boolean } = {}): Promise<ListResult<any>> =>
    apiClient.get("/remote-monitoring/thresholds", { params: cleanParams(params) }).then((r) => toList<any>(r.data)),
};

// ===========================================================================
// Clinical Alerts
// ===========================================================================
export type AlertSeverity = "INFORMATION" | "WARNING" | "URGENT" | "EMERGENCY";
export type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "IN_REVIEW" | "ESCALATED" | "RESOLVED" | "DISMISSED";

export type ClinicalAlert = {
  id: number; patient_id: number; care_plan_id?: number | null; home_visit_id?: number | null;
  reading_id?: number | null; alert_type: string; severity: AlertSeverity | string;
  status: AlertStatus | string; title: string; message?: string | null; context?: Record<string, unknown> | null;
  triggered_at: string; assigned_to_staff_id?: number | null; acknowledged_at?: string | null;
  escalated_at?: string | null; resolved_at?: string | null; resolution_note?: string | null;
  patient_name?: string | null;
};

export type AlertSummary = {
  open_total: number;
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
};

export const alertsApi = {
  list: (params: { skip?: number; limit?: number; status?: string; severity?: string; alert_type?: string; patient_id?: number; open_only?: boolean } = {}): Promise<ListResult<ClinicalAlert>> =>
    apiClient.get("/clinical-alerts/", { params: cleanParams(params) }).then((r) => toList<ClinicalAlert>(r.data)),
  get: (id: number): Promise<ClinicalAlert> =>
    apiClient.get(`/clinical-alerts/${id}`).then((r) => r.data.alert),
  create: (payload: { patient_id: number; title: string; alert_type?: string; severity?: AlertSeverity; message?: string; care_plan_id?: number; home_visit_id?: number; assigned_to_staff_id?: number }): Promise<ClinicalAlert> =>
    apiClient.post("/clinical-alerts/", payload).then((r) => r.data.alert),
  acknowledge: (id: number, note?: string): Promise<ClinicalAlert> =>
    apiClient.post(`/clinical-alerts/${id}/acknowledge`, { note }).then((r) => r.data.alert),
  resolve: (id: number, resolution_note?: string): Promise<ClinicalAlert> =>
    apiClient.post(`/clinical-alerts/${id}/resolve`, { resolution_note }).then((r) => r.data.alert),
  dismiss: (id: number, resolution_note?: string): Promise<ClinicalAlert> =>
    apiClient.post(`/clinical-alerts/${id}/dismiss`, { resolution_note }).then((r) => r.data.alert),
  escalate: (id: number, payload: { escalated_to_staff_id?: number; note?: string } = {}): Promise<ClinicalAlert> =>
    apiClient.post(`/clinical-alerts/${id}/escalate`, payload).then((r) => r.data.alert),
  summary: (): Promise<AlertSummary> =>
    apiClient.get("/clinical-alerts/summary").then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Shared option lists + label helpers
// ---------------------------------------------------------------------------
export const HOME_VISIT_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "REQUESTED", label: "Requested" },
  { value: "APPROVED", label: "Approved" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "EN_ROUTE", label: "En route" },
  { value: "ARRIVED", label: "Arrived" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "MISSED", label: "Missed" },
];

export const HOME_VISIT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "ROUTINE", label: "Routine" },
  { value: "FOLLOW_UP", label: "Follow-up" },
  { value: "ASSESSMENT", label: "Assessment" },
  { value: "RECURRING", label: "Recurring" },
  { value: "EMERGENCY", label: "Emergency" },
  { value: "WOUND_CARE", label: "Wound care" },
  { value: "MEDICATION", label: "Medication" },
  { value: "REHABILITATION", label: "Rehabilitation" },
  { value: "PALLIATIVE", label: "Palliative" },
];

export const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

export const READING_TYPE_OPTIONS: { value: MonitoringReadingType; label: string; unit: string }[] = [
  { value: "BLOOD_PRESSURE", label: "Blood pressure", unit: "mmHg" },
  { value: "PULSE", label: "Pulse", unit: "bpm" },
  { value: "TEMPERATURE", label: "Temperature", unit: "°C" },
  { value: "BLOOD_GLUCOSE", label: "Blood glucose", unit: "mg/dL" },
  { value: "OXYGEN_SATURATION", label: "Oxygen saturation", unit: "%" },
  { value: "RESPIRATORY_RATE", label: "Respiratory rate", unit: "/min" },
  { value: "WEIGHT", label: "Weight", unit: "kg" },
  { value: "PAIN_SCORE", label: "Pain score", unit: "/10" },
];

export function labelize(v?: string | null): string {
  if (!v) return "—";
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function severityVariant(sev?: string | null): "soft-success" | "soft-warning" | "soft-danger" | "soft-info" | "secondary" {
  switch (sev) {
    case "EMERGENCY":
    case "URGENT":
      return "soft-danger";
    case "WARNING":
      return "soft-warning";
    case "INFORMATION":
      return "soft-info";
    default:
      return "secondary";
  }
}

export function homeVisitStatusVariant(status?: string | null): "soft-success" | "soft-warning" | "soft-danger" | "soft-info" | "secondary" {
  switch (status) {
    case "COMPLETED":
      return "soft-success";
    case "REQUESTED":
    case "APPROVED":
    case "ASSIGNED":
      return "soft-info";
    case "EN_ROUTE":
    case "ARRIVED":
    case "IN_PROGRESS":
      return "soft-warning";
    case "CANCELLED":
    case "MISSED":
      return "soft-danger";
    default:
      return "secondary";
  }
}

/** Valid next statuses a user can move a visit to from its current state. */
export function nextStatuses(status: string): HomeVisitStatus[] {
  const map: Record<string, HomeVisitStatus[]> = {
    REQUESTED: ["APPROVED", "ASSIGNED", "CANCELLED"],
    APPROVED: ["ASSIGNED", "CANCELLED"],
    ASSIGNED: ["EN_ROUTE", "MISSED", "CANCELLED"],
    EN_ROUTE: ["ARRIVED", "MISSED", "CANCELLED"],
    ARRIVED: ["IN_PROGRESS", "CANCELLED"],
    IN_PROGRESS: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
    MISSED: [],
  };
  return map[status] ?? [];
}

// ===========================================================================
// Home Lab Orders
// ===========================================================================
export type HomeLabItem = {
  id: number; home_lab_order_id: number; lab_test_catalog_id: number; status: string;
  result_value?: string | null; result_unit?: string | null; reference_range?: string | null;
  is_abnormal?: boolean; interpretation?: string | null; resulted_at?: string | null;
  test_name?: string | null; test_code?: string | null;
};
export type HomeLabOrder = {
  id: number; order_no: string; patient_id: number; home_visit_id?: number | null;
  care_plan_id?: number | null; status: string; priority: string; clinical_note?: string | null;
  collection_address?: string | null; scheduled_collection_at?: string | null;
  sample_collected_at?: string | null; resulted_at?: string | null; ordered_at: string;
  patient_name?: string | null; items: HomeLabItem[];
};

export const homeLabApi = {
  list: (params: { patient_id?: number; home_visit_id?: number; care_plan_id?: number; status?: string; limit?: number } = {}): Promise<ListResult<HomeLabOrder>> =>
    apiClient.get("/home-lab-orders/", { params: cleanParams(params) }).then((r) => toList<HomeLabOrder>(r.data)),
  get: (id: number): Promise<HomeLabOrder> => apiClient.get(`/home-lab-orders/${id}`).then((r) => r.data.order),
  create: (payload: { patient_id: number; home_visit_id?: number; care_plan_id?: number; priority?: string; clinical_note?: string; collection_address?: string; items: { lab_test_catalog_id: number }[] }): Promise<HomeLabOrder> =>
    apiClient.post("/home-lab-orders/", payload).then((r) => r.data.order),
  setStatus: (id: number, status: string, note?: string): Promise<HomeLabOrder> =>
    apiClient.post(`/home-lab-orders/${id}/status`, { status, note }).then((r) => r.data.order),
  enterResult: (itemId: number, payload: { result_value?: string; result_unit?: string; reference_range?: string; is_abnormal?: boolean; interpretation?: string }): Promise<HomeLabOrder> =>
    apiClient.post(`/home-lab-orders/items/${itemId}/result`, payload).then((r) => r.data.order),
};

// ===========================================================================
// Home Medication Orders (dispense + delivery)
// ===========================================================================
export type HomeMedItem = {
  id: number; home_medication_order_id: number; drug_id: number; dosage?: string | null;
  frequency?: string | null; duration?: string | null; route?: string | null;
  quantity: number; quantity_dispensed: number; instructions?: string | null;
  drug_name?: string | null; drug_strength?: string | null;
};
export type HomeMedicationOrder = {
  id: number; order_no: string; patient_id: number; home_visit_id?: number | null;
  care_plan_id?: number | null; status: string; note?: string | null; delivery_address?: string | null;
  dispensed_at?: string | null; courier_name?: string | null; delivery_tracking_ref?: string | null;
  delivered_at?: string | null; prescribed_at: string; patient_name?: string | null; items: HomeMedItem[];
};

export const homeMedApi = {
  list: (params: { patient_id?: number; home_visit_id?: number; care_plan_id?: number; status?: string; limit?: number } = {}): Promise<ListResult<HomeMedicationOrder>> =>
    apiClient.get("/home-medication-orders/", { params: cleanParams(params) }).then((r) => toList<HomeMedicationOrder>(r.data)),
  get: (id: number): Promise<HomeMedicationOrder> => apiClient.get(`/home-medication-orders/${id}`).then((r) => r.data.order),
  create: (payload: { patient_id: number; home_visit_id?: number; care_plan_id?: number; note?: string; delivery_address?: string; items: { drug_id: number; dosage?: string; frequency?: string; duration?: string; route?: string; quantity?: number; instructions?: string }[] }): Promise<HomeMedicationOrder> =>
    apiClient.post("/home-medication-orders/", payload).then((r) => r.data.order),
  dispense: (id: number, payload: { dispensed_by_staff_id?: number; note?: string } = {}): Promise<HomeMedicationOrder> =>
    apiClient.post(`/home-medication-orders/${id}/dispense`, payload).then((r) => r.data.order),
  dispatch: (id: number, payload: { courier_name?: string; delivery_tracking_ref?: string } = {}): Promise<HomeMedicationOrder> =>
    apiClient.post(`/home-medication-orders/${id}/dispatch`, payload).then((r) => r.data.order),
  deliver: (id: number, payload: { delivered_by_staff_id?: number; note?: string } = {}): Promise<HomeMedicationOrder> =>
    apiClient.post(`/home-medication-orders/${id}/deliver`, payload).then((r) => r.data.order),
};

export function homeOrderStatusVariant(status?: string | null): "soft-success" | "soft-warning" | "soft-danger" | "soft-info" | "secondary" {
  switch (status) {
    case "RESULTED": case "DELIVERED": case "ADMINISTERED": return "soft-success";
    case "CANCELLED": case "RETURNED": return "soft-danger";
    case "REQUESTED": case "PRESCRIBED": return "soft-info";
    default: return "soft-warning";
  }
}
