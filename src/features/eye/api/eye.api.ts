import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

export type PatientBrief = {
  id: number; name: string; hospital_number?: string | null;
  gender?: string | null; age?: number | null; phone_number?: string | null;
};

export type SpectacleLensType =
  | "SINGLE_VISION" | "BIFOCAL" | "PROGRESSIVE" | "READING" | "DISTANCE" | "OTHER";

export type SpectaclePrescription = {
  id: number; patient_id: number; exam_id?: number | null;
  prescriber?: string | null; prescriber_staff_id?: number | null; prescribed_date?: string | null;
  od_sphere?: string | null; od_cyl?: string | null; od_axis?: number | null; od_add?: string | null;
  os_sphere?: string | null; os_cyl?: string | null; os_axis?: number | null; os_add?: string | null;
  pd?: string | null; lens_type: SpectacleLensType; usage?: string | null; notes?: string | null;
  created_at?: string | null; patient?: PatientBrief;
};

export type EyeExam = {
  id: number; patient_id: number; visit_id?: number | null; consultation_id?: number | null;
  clinician?: string | null; clinician_staff_id?: number | null; status: string;
  examined_at?: string | null; created_at?: string | null; patient: PatientBrief;
  chief_complaint?: string | null; history_note?: string | null; external_note?: string | null;
  va_dist_unaided_od?: string | null; va_dist_unaided_os?: string | null;
  va_dist_aided_od?: string | null; va_dist_aided_os?: string | null;
  va_near_od?: string | null; va_near_os?: string | null;
  pinhole_od?: string | null; pinhole_os?: string | null;
  ref_sphere_od?: string | null; ref_sphere_os?: string | null;
  ref_cyl_od?: string | null; ref_cyl_os?: string | null;
  ref_axis_od?: number | null; ref_axis_os?: number | null;
  ref_add_od?: string | null; ref_add_os?: string | null;
  iop_od?: string | null; iop_os?: string | null; iop_method?: string | null;
  anterior_od?: string | null; anterior_os?: string | null;
  posterior_od?: string | null; posterior_os?: string | null;
  impression?: string | null; plan_note?: string | null;
  prescriptions?: SpectaclePrescription[];
};

export type EyeStats = {
  exams_total: number; exams_open: number;
  prescriptions_total: number; raised_iop_flagged: number;
  contact_lens_rx_total?: number; optical_orders_open?: number; recalls_due?: number;
  optical_products?: number; optical_low_stock?: number;
};

export type ContactLensPrescription = {
  id: number; patient_id: number; exam_id?: number | null;
  prescriber?: string | null; prescriber_staff_id?: number | null; prescribed_date?: string | null;
  modality?: string | null;
  od_sphere?: string | null; od_cyl?: string | null; od_axis?: number | null; od_add?: string | null;
  od_base_curve?: string | null; od_diameter?: string | null; od_brand?: string | null;
  os_sphere?: string | null; os_cyl?: string | null; os_axis?: number | null; os_add?: string | null;
  os_base_curve?: string | null; os_diameter?: string | null; os_brand?: string | null;
  notes?: string | null; created_at?: string | null;
};

export type OpticalItemType = "FRAME" | "LENS" | "COATING" | "SERVICE" | "OTHER";
export type OpticalOrderStatus = "PENDING" | "ORDERED" | "READY" | "COLLECTED" | "CANCELLED";

export type OpticalOrderItem = {
  id: number; item_type: OpticalItemType;
  optical_product_id?: number | null; stock_item_id?: number | null;
  item_name: string; quantity: string; unit_price: string; line_total: string;
};

export type OpticalOrder = {
  id: number; order_no: string; patient_id: number; exam_id?: number | null;
  spectacle_prescription_id?: number | null; visit_id?: number | null;
  dispensed_by?: string | null; dispensed_by_staff_id?: number | null;
  status: OpticalOrderStatus; subtotal?: string | null; discount_amount?: string | null;
  total_amount?: string | null; note?: string | null;
  ordered_at?: string | null; ready_at?: string | null; collected_at?: string | null;
  billed_at?: string | null; is_billed?: boolean; created_at?: string | null;
  patient: PatientBrief; items: OpticalOrderItem[];
};

export type OpticalProductCategory =
  | "FRAME" | "LENS" | "CONTACT_LENS" | "SOLUTION" | "ACCESSORY" | "OTHER";

export type OpticalProduct = {
  id: number; category: OpticalProductCategory; name: string;
  brand?: string | null; sku?: string | null; spec?: string | null;
  unit_cost?: string | null; sell_price: string; quantity_on_hand: string;
  reorder_level?: string | null; is_active: boolean; note?: string | null;
  is_low_stock?: boolean;
};

export type EyeFlowStage = {
  order: number; label: string; required: boolean; eye_specific: boolean;
  service_delivery_point_id?: number | null; service_delivery_point?: string | null;
  code?: string | null; type?: string | null; configured: boolean;
};

export type EyeFlow = {
  template_code: string; template_name: string; template_id?: number | null;
  seeded: boolean; is_default: boolean; from_template?: boolean; stages: EyeFlowStage[];
};

export type EyeRecallStatus = "DUE" | "SCHEDULED" | "COMPLETED" | "CANCELLED";

export type EyeRecall = {
  id: number; patient_id: number; exam_id?: number | null;
  recall_type?: string | null; due_date: string; interval_months?: number | null;
  status: EyeRecallStatus; note?: string | null;
  created_by?: string | null; completed_at?: string | null; is_overdue?: boolean;
  patient: PatientBrief;
};

const g = <T,>(u: string, params?: Record<string, unknown>) =>
  apiClient.get<T>(u, { params }).then((r) => r.data);
const post = <T,>(u: string, body?: unknown) => apiClient.post<T>(u, body).then((r) => r.data);
const patch = <T,>(u: string, body?: unknown) => apiClient.patch<T>(u, body).then((r) => r.data);

export const eyeApi = {
  listExams: (params?: { patient_id?: number; skip?: number; limit?: number }) =>
    g<PaginatedResponse<EyeExam>>("/eye-clinic/exams", params),
  getExam: (id: number) =>
    g<{ success: boolean; data: EyeExam }>(`/eye-clinic/exams/${id}`).then((d) => d.data),
  createExam: (body: Record<string, unknown>) =>
    post<{ success: boolean; data: EyeExam }>("/eye-clinic/exams", body).then((d) => d.data),
  updateExam: (id: number, body: Record<string, unknown>) =>
    patch<{ success: boolean; data: EyeExam }>(`/eye-clinic/exams/${id}`, body).then((d) => d.data),
  listPrescriptions: (params?: { patient_id?: number; skip?: number; limit?: number }) =>
    g<PaginatedResponse<SpectaclePrescription>>("/eye-clinic/prescriptions", params),
  createPrescription: (body: Record<string, unknown>) =>
    post<{ success: boolean; data: SpectaclePrescription }>("/eye-clinic/prescriptions", body).then((d) => d.data),
  worklist: (limit = 50) =>
    g<{ success: boolean; items: EyeExam[] }>("/eye-clinic/worklist", { limit }).then((d) => d.items),
  stats: () => g<{ success: boolean; data: EyeStats }>("/eye-clinic/stats").then((d) => d.data),

  // ---- Contact-lens prescriptions ----
  listContactLens: (params?: { patient_id?: number; skip?: number; limit?: number }) =>
    g<PaginatedResponse<ContactLensPrescription>>("/eye-clinic/contact-lens", params),
  createContactLens: (body: Record<string, unknown>) =>
    post<{ success: boolean; data: ContactLensPrescription }>("/eye-clinic/contact-lens", body).then((d) => d.data),

  // ---- Optical dispensing orders ----
  listOrders: (params?: { patient_id?: number; status?: string; skip?: number; limit?: number }) =>
    g<PaginatedResponse<OpticalOrder>>("/eye-clinic/optical-orders", params),
  getOrder: (id: number) =>
    g<{ success: boolean; data: OpticalOrder }>(`/eye-clinic/optical-orders/${id}`).then((d) => d.data),
  createOrder: (body: Record<string, unknown>) =>
    post<{ success: boolean; data: OpticalOrder }>("/eye-clinic/optical-orders", body).then((d) => d.data),
  setOrderStatus: (id: number, status: string) =>
    patch<{ success: boolean; data: OpticalOrder }>(`/eye-clinic/optical-orders/${id}/status`, { status }).then((d) => d.data),
  billOrder: (id: number) =>
    post<{ success: boolean; message: string; data: { order: OpticalOrder; billing: Record<string, unknown> } }>(`/eye-clinic/optical-orders/${id}/bill`),

  // ---- Optical inventory (frames, lenses, products) ----
  listProducts: (params?: { search?: string; category?: string; active_only?: boolean; low_stock?: boolean; skip?: number; limit?: number }) =>
    g<PaginatedResponse<OpticalProduct>>("/eye-clinic/optical-products", params),
  createProduct: (body: Record<string, unknown>) =>
    post<{ success: boolean; data: OpticalProduct }>("/eye-clinic/optical-products", body).then((d) => d.data),
  updateProduct: (id: number, body: Record<string, unknown>) =>
    patch<{ success: boolean; data: OpticalProduct }>(`/eye-clinic/optical-products/${id}`, body).then((d) => d.data),
  adjustProductStock: (id: number, delta: number, note?: string) =>
    post<{ success: boolean; data: OpticalProduct }>(`/eye-clinic/optical-products/${id}/stock`, { delta, note }).then((d) => d.data),
  deleteProduct: (id: number) =>
    apiClient.delete<{ success: boolean }>(`/eye-clinic/optical-products/${id}`).then((r) => r.data),

  // ---- Eye Clinic flow (dedicated pathway) ----
  getFlow: () =>
    g<{ success: boolean; data: EyeFlow }>("/eye-clinic/flow").then((d) => d.data),
  seedFlow: () =>
    post<{ success: boolean; message: string; data: Record<string, unknown> }>("/eye-clinic/seed-flow"),

  // ---- Recalls ----
  listRecalls: (params?: { patient_id?: number; status?: string; due_before?: string; skip?: number; limit?: number }) =>
    g<PaginatedResponse<EyeRecall>>("/eye-clinic/recalls", params),
  createRecall: (body: Record<string, unknown>) =>
    post<{ success: boolean; data: EyeRecall }>("/eye-clinic/recalls", body).then((d) => d.data),
  updateRecall: (id: number, body: Record<string, unknown>) =>
    patch<{ success: boolean; data: EyeRecall }>(`/eye-clinic/recalls/${id}`, body).then((d) => d.data),
};

export const OPTICAL_ITEM_TYPES: OpticalItemType[] = ["FRAME", "LENS", "COATING", "SERVICE", "OTHER"];
export const OPTICAL_CATEGORIES: OpticalProductCategory[] = ["FRAME", "LENS", "CONTACT_LENS", "SOLUTION", "ACCESSORY", "OTHER"];
export const CONTACT_LENS_MODALITIES = ["DAILY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL", "RGP", "OTHER"];

export const LENS_TYPES: { value: SpectacleLensType; label: string }[] = [
  { value: "SINGLE_VISION", label: "Single vision" },
  { value: "BIFOCAL", label: "Bifocal" },
  { value: "PROGRESSIVE", label: "Progressive" },
  { value: "READING", label: "Reading" },
  { value: "DISTANCE", label: "Distance" },
  { value: "OTHER", label: "Other" },
];
