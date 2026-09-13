import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

// ============================================================
// Types — mirror app/api/v1/endpoints/radiology_routes.py
// ============================================================

export type RadiologyModality =
  | "X_RAY"
  | "CT"
  | "MRI"
  | "ULTRASOUND"
  | "MAMMOGRAPHY"
  | "FLUOROSCOPY"
  | "NUCLEAR_MEDICINE"
  | "PET"
  | "DEXA"
  | "ANGIOGRAPHY"
  | "INTERVENTIONAL"
  | "OTHER";

export type RadiologyOrderStatus =
  | "DRAFT"
  | "ORDERED"
  | "SCHEDULED"
  | "CHECKED_IN"
  | "IN_PROGRESS"
  | "PERFORMED"
  | "REPORTED"
  | "RELEASED"
  | "COMPLETED"
  | "CANCELLED";

export type RadiologyExamStatus =
  | "SCHEDULED"
  | "PATIENT_PREP"
  | "IN_PROGRESS"
  | "PERFORMED"
  | "INCOMPLETE"
  | "CANCELLED";

export type RadiologyReportStatus =
  | "DRAFT"
  | "PRELIMINARY"
  | "FINAL"
  | "AMENDED"
  | "CANCELLED";

export type RadiologyPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT" | "EMERGENCY";

export type RadiologyProcedure = {
  id: number;
  code: string;
  name: string;
  modality: RadiologyModality | string;
  body_part?: string | null;
  cpt_code?: string | null;
  typical_duration_minutes?: number | null;
  contrast_required: boolean;
  radiation_dose_msv?: number | null;
  preparation_instructions?: string | null;
  default_price?: number | string | null;
  description?: string | null;
  created_at?: string | null;
};

export type RadiologyOrderItem = {
  id: number;
  radiology_order_id: number;
  procedure_catalog_id: number;
  status: RadiologyOrderStatus | string;
  laterality?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

export type RadiologyOrder = {
  id: number;
  visit_id: number;
  consultation_id?: number | null;
  facility_id?: number | null;
  ordered_by_staff_id?: number | null;
  order_no: string;
  status: RadiologyOrderStatus | string;
  priority: RadiologyPriority | string;
  clinical_indication?: string | null;
  pregnancy_screening?: boolean | null;
  creatinine_value?: number | string | null;
  ordered_at?: string | null;
  items: RadiologyOrderItem[];
  created_at?: string | null;
  updated_at?: string | null;
};

export type RadiologyExam = {
  id: number;
  order_item_id: number;
  facility_id?: number | null;
  performed_by_staff_id?: number | null;
  machine_identifier?: string | null;
  accession_number?: string | null;
  status: RadiologyExamStatus | string;
  scheduled_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  contrast_administered?: boolean | null;
  technical_notes?: string | null;
  created_at?: string | null;
};

export type RadiologyImage = {
  id: number;
  exam_id: number;
  sop_instance_uid?: string | null;
  series_instance_uid?: string | null;
  study_instance_uid?: string | null;
  image_url?: string | null;
  pacs_archive_id?: string | null;
  image_count?: number | null;
  captured_at?: string | null;
  notes?: string | null;
};

export type RadiologyReport = {
  id: number;
  exam_id: number;
  reported_by_staff_id?: number | null;
  verified_by_staff_id?: number | null;
  status: RadiologyReportStatus | string;
  findings?: string | null;
  impression?: string | null;
  recommendations?: string | null;
  drafted_at?: string | null;
  finalized_at?: string | null;
  released_at?: string | null;
};

// ---------- Payloads ----------

export type RadiologyOrderItemCreatePayload = {
  procedure_catalog_id: number;
  laterality?: string;
  notes?: string;
};

export type CreateRadiologyOrderPayload = {
  visit_id: number;
  consultation_id?: number;
  ordered_by_staff_id?: number;
  facility_id?: number;
  priority?: RadiologyPriority | string;
  clinical_indication?: string;
  pregnancy_screening?: boolean;
  creatinine_value?: number;
  items: RadiologyOrderItemCreatePayload[];
  auto_capture_charge?: boolean;
};

export type ScheduleExamPayload = {
  order_item_id: number;
  facility_id?: number;
  scheduled_at: string;
  machine_identifier?: string;
};

export type StartExamPayload = {
  performed_by_staff_id?: number;
  machine_identifier?: string;
  contrast_administered?: boolean;
  technical_notes?: string;
};

export type CompleteExamPayload = {
  technical_notes?: string;
};

export type DraftReportPayload = {
  exam_id: number;
  reported_by_staff_id?: number;
  findings?: string;
  impression?: string;
  recommendations?: string;
};

export type FinalizeReportPayload = {
  verified_by_staff_id?: number;
  findings?: string;
  impression?: string;
  recommendations?: string;
};

export type ReleaseReportPayload = {
  notify_clinician?: boolean;
  note?: string;
};

// ============================================================
// Envelope normalization
// ============================================================

/**
 * Backend action endpoints answer with `{ success, message, <key>: resource }`
 * while plain reads answer with the bare resource. Normalize both shapes.
 */
function unwrap<T>(data: unknown, key: string): T {
  if (data && typeof data === "object" && key in (data as Record<string, unknown>)) {
    return (data as Record<string, unknown>)[key] as T;
  }
  return data as T;
}

function normalizeList<T>(data: unknown): PaginatedResponse<T> {
  if (Array.isArray(data)) {
    return {
      success: true,
      message: "",
      items: data as T[],
      count: data.length,
      meta: { total: data.length },
    };
  }
  const record = (data ?? {}) as Partial<PaginatedResponse<T>>;
  const items = Array.isArray(record.items) ? record.items : [];
  return {
    success: record.success ?? true,
    message: record.message ?? "",
    items,
    count: record.count ?? items.length,
    meta: record.meta ?? { total: items.length },
  };
}

// ============================================================
// Procedures catalog — /radiology/procedures
// ============================================================

export async function listRadiologyProcedures(
  params: { skip?: number; limit?: number; modality?: string; search?: string } = {},
): Promise<PaginatedResponse<RadiologyProcedure>> {
  const { skip = 0, limit = 50, modality, search } = params;
  const response = await apiClient.get("/radiology/procedures/", {
    params: {
      skip,
      limit,
      ...(modality ? { modality } : {}),
      ...(search ? { search } : {}),
    },
  });
  return normalizeList<RadiologyProcedure>(response.data);
}

export async function getRadiologyProcedure(procedureId: number): Promise<RadiologyProcedure> {
  const response = await apiClient.get(`/radiology/procedures/${procedureId}`);
  return unwrap<RadiologyProcedure>(response.data, "procedure");
}

// ============================================================
// Orders — /radiology/orders
// ============================================================

export async function listRadiologyWorklist(
  params: { skip?: number; limit?: number; statuses?: string[] } = {},
): Promise<PaginatedResponse<RadiologyOrder>> {
  const { skip = 0, limit = 50, statuses } = params;
  // FastAPI expects repeated `statuses=A&statuses=B` params — build explicitly
  // (axios' default array serialization appends brackets).
  const query = new URLSearchParams();
  query.set("skip", String(skip));
  query.set("limit", String(limit));
  (statuses ?? []).forEach((s) => query.append("statuses", s));
  const response = await apiClient.get(`/radiology/orders/worklist?${query.toString()}`);
  return normalizeList<RadiologyOrder>(response.data);
}

export async function listRadiologyOrdersForVisit(
  visitId: number,
  params: { skip?: number; limit?: number } = {},
): Promise<PaginatedResponse<RadiologyOrder>> {
  const { skip = 0, limit = 50 } = params;
  const response = await apiClient.get(`/radiology/orders/visits/${visitId}`, {
    params: { skip, limit },
  });
  return normalizeList<RadiologyOrder>(response.data);
}

export async function getRadiologyOrder(orderId: number): Promise<RadiologyOrder> {
  const response = await apiClient.get(`/radiology/orders/${orderId}`);
  return unwrap<RadiologyOrder>(response.data, "order");
}

export async function createRadiologyOrder(
  payload: CreateRadiologyOrderPayload,
): Promise<RadiologyOrder> {
  const response = await apiClient.post("/radiology/orders/", payload);
  return unwrap<RadiologyOrder>(response.data, "order");
}

export async function cancelRadiologyOrder(
  orderId: number,
  reason?: string,
): Promise<RadiologyOrder> {
  const response = await apiClient.post(`/radiology/orders/${orderId}/cancel`, {
    reason: reason ?? null,
  });
  return unwrap<RadiologyOrder>(response.data, "order");
}

// ============================================================
// Exams — /radiology/exams
// ============================================================

export async function scheduleRadiologyExam(payload: ScheduleExamPayload): Promise<RadiologyExam> {
  const response = await apiClient.post("/radiology/exams/schedule", payload);
  return unwrap<RadiologyExam>(response.data, "exam");
}

export async function startRadiologyExam(
  examId: number,
  payload: StartExamPayload = {},
): Promise<RadiologyExam> {
  const response = await apiClient.post(`/radiology/exams/${examId}/start`, payload);
  return unwrap<RadiologyExam>(response.data, "exam");
}

export async function completeRadiologyExam(
  examId: number,
  payload: CompleteExamPayload = {},
): Promise<RadiologyExam> {
  const response = await apiClient.post(`/radiology/exams/${examId}/complete`, payload);
  return unwrap<RadiologyExam>(response.data, "exam");
}

export async function listRadiologyExamImages(examId: number): Promise<RadiologyImage[]> {
  const response = await apiClient.get(`/radiology/exams/${examId}/images`);
  return normalizeList<RadiologyImage>(response.data).items;
}

// ============================================================
// Reports — /radiology/reports
// ============================================================

export async function getRadiologyReport(reportId: number): Promise<RadiologyReport> {
  const response = await apiClient.get(`/radiology/reports/${reportId}`);
  return unwrap<RadiologyReport>(response.data, "report");
}

export async function getRadiologyReportForExam(examId: number): Promise<RadiologyReport> {
  const response = await apiClient.get(`/radiology/reports/exams/${examId}`);
  return unwrap<RadiologyReport>(response.data, "report");
}

export async function draftRadiologyReport(payload: DraftReportPayload): Promise<RadiologyReport> {
  const response = await apiClient.post("/radiology/reports/draft", payload);
  return unwrap<RadiologyReport>(response.data, "report");
}

export async function finalizeRadiologyReport(
  reportId: number,
  payload: FinalizeReportPayload = {},
): Promise<RadiologyReport> {
  const response = await apiClient.post(`/radiology/reports/${reportId}/finalize`, payload);
  return unwrap<RadiologyReport>(response.data, "report");
}

export async function releaseRadiologyReport(
  reportId: number,
  payload: ReleaseReportPayload = {},
): Promise<RadiologyReport> {
  const response = await apiClient.post(`/radiology/reports/${reportId}/release`, payload);
  return unwrap<RadiologyReport>(response.data, "report");
}
