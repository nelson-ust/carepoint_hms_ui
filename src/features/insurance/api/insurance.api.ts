import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

// ------------------------------------------------------------------
// Types (mirroring backend insurance_claim_schemas.py and the dict
// serializers in insurance_claim_routes.py — Decimal fields may arrive
// as strings, so api functions normalize amounts to numbers)
// ------------------------------------------------------------------

export type ClaimStatus =
  | "DRAFT"
  | "PENDING_AUTH"
  | "AUTHORIZED"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "PARTIALLY_APPROVED"
  | "REJECTED"
  | "PAID"
  | "APPEALED"
  | "CLOSED";

export const CLAIM_STATUSES: ClaimStatus[] = [
  "DRAFT",
  "PENDING_AUTH",
  "AUTHORIZED",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "PARTIALLY_APPROVED",
  "REJECTED",
  "PAID",
  "APPEALED",
  "CLOSED",
];

export type InsuranceProvider = {
  id: number;
  name: string;
  code?: string;
  contact_person?: string;
  email?: string;
  is_active?: boolean;
};

/** A patient's linked insurance policy (app/schemas/patient_identity_schemas.py). */
export type PatientInsurancePolicy = {
  id: number;
  patient_id: number;
  insurance_provider_id: number;
  provider_name?: string | null;
  policy_number: string;
  member_name?: string | null;
  plan_name?: string | null;
  is_active?: boolean;
};

export type InsuranceClaimItem = {
  id: number;
  claim_id: number;
  invoice_item_id?: number | null;
  billable_service_id?: number | null;
  service_date?: string | null;
  procedure_code?: string | null;
  diagnosis_code?: string | null;
  description?: string | null;
  quantity: number;
  unit_price: number;
  billed_amount: number;
  approved_amount: number;
  rejected_amount: number;
};

export type InsuranceClaim = {
  id: number;
  claim_no: string;
  batch_id?: number | null;
  patient_id: number;
  patient_insurance_id: number;
  insurance_provider_id: number;
  visit_id?: number | null;
  invoice_id?: number | null;
  facility_id?: number | null;
  status: string;
  service_date?: string | null;
  primary_diagnosis_text?: string | null;
  billed_amount: number;
  approved_amount: number;
  rejected_amount: number;
  patient_responsibility_amount: number;
  paid_amount: number;
  submitted_at?: string | null;
  notes?: string | null;
  items: InsuranceClaimItem[];
  created_at?: string | null;
};

export type ClaimAppeal = {
  id: number;
  claim_id: number;
  appeal_no: string;
  status: string;
  submitted_at?: string | null;
  decided_at?: string | null;
  decision_text?: string | null;
  appeal_text: string;
  additional_amount_requested?: number | null;
  additional_amount_approved?: number | null;
};

export type ClaimListFilters = {
  skip?: number;
  limit?: number;
  statuses?: string[];
  insurance_provider_id?: number;
  patient_id?: number;
  visit_id?: number;
  invoice_id?: number;
  batch_id?: number;
};

export type CreateClaimPayload = {
  patient_id: number;
  patient_insurance_id: number;
  insurance_provider_id: number;
  visit_id?: number;
  invoice_id?: number;
  service_date?: string;
  primary_diagnosis_text?: string;
  notes?: string;
};

export type SubmitAppealPayload = {
  claim_id: number;
  appeal_text: string;
  additional_amount_requested?: number;
};

export type ClaimsSummary = {
  totalClaims: number;
  pendingCount: number;
  approvedValue: number;
  rejectedCount: number;
};

// ------------------------------------------------------------------
// Normalization helpers
// ------------------------------------------------------------------

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "string" ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeClaimItem(raw: any): InsuranceClaimItem {
  return {
    ...raw,
    quantity: toNumber(raw?.quantity),
    unit_price: toNumber(raw?.unit_price),
    billed_amount: toNumber(raw?.billed_amount),
    approved_amount: toNumber(raw?.approved_amount),
    rejected_amount: toNumber(raw?.rejected_amount),
  };
}

function normalizeClaim(raw: any): InsuranceClaim {
  // Statuses can come back as enum reprs like "ClaimStatus.SUBMITTED".
  const rawStatus = String(raw?.status ?? "");
  const status = (rawStatus.includes(".") ? rawStatus.split(".").pop()! : rawStatus).toUpperCase();
  return {
    ...raw,
    status,
    billed_amount: toNumber(raw?.billed_amount),
    approved_amount: toNumber(raw?.approved_amount),
    rejected_amount: toNumber(raw?.rejected_amount),
    patient_responsibility_amount: toNumber(raw?.patient_responsibility_amount),
    paid_amount: toNumber(raw?.paid_amount),
    items: Array.isArray(raw?.items) ? raw.items.map(normalizeClaimItem) : [],
  };
}

function normalizeAppeal(raw: any): ClaimAppeal {
  const rawStatus = String(raw?.status ?? "");
  return {
    ...raw,
    status: (rawStatus.includes(".") ? rawStatus.split(".").pop()! : rawStatus).toUpperCase(),
    additional_amount_requested:
      raw?.additional_amount_requested != null ? toNumber(raw.additional_amount_requested) : null,
    additional_amount_approved:
      raw?.additional_amount_approved != null ? toNumber(raw.additional_amount_approved) : null,
  };
}

/** Unwraps either an action envelope ({success, message, <key>}) or a bare resource. */
function unwrap<T>(data: any, key: string): T {
  if (data && typeof data === "object" && key in data) return data[key] as T;
  return data as T;
}

export function formatMoney(amount: number, currency = "NGN"): string {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// ------------------------------------------------------------------
// API calls — backend prefixes are /insurance/claims, /insurance/appeals,
// etc. (see insurance_claim_routes.py). Providers are served by the
// patient-master module at /patient-master/insurance-providers.
// ------------------------------------------------------------------

/** GET /insurance/claims/ — paginated claim list with filters. */
export async function listClaims(
  filters: ClaimListFilters = {},
): Promise<PaginatedResponse<InsuranceClaim>> {
  const { skip = 0, limit = 20, statuses, ...rest } = filters;
  const params: Record<string, unknown> = { skip, limit };
  Object.entries(rest).forEach(([key, value]) => {
    if (value !== undefined && value !== null) params[key] = value;
  });
  if (statuses && statuses.length > 0) params.statuses = statuses;
  const response = await apiClient.get<PaginatedResponse<InsuranceClaim>>(
    "/insurance/claims/",
    { params },
  );
  const data = response.data;
  return {
    success: data?.success ?? true,
    message: data?.message ?? "",
    items: (data?.items ?? []).map(normalizeClaim),
    count: data?.count ?? data?.items?.length ?? 0,
    meta: data?.meta ?? {},
  };
}

/** GET /insurance/claims/{id} — bare claim resource. */
export async function getClaim(claimId: number): Promise<InsuranceClaim> {
  const response = await apiClient.get(`/insurance/claims/${claimId}`);
  return normalizeClaim(unwrap(response.data, "claim"));
}

/** POST /insurance/claims/ — create a claim header. */
export async function createClaim(payload: CreateClaimPayload): Promise<InsuranceClaim> {
  const response = await apiClient.post("/insurance/claims/", payload);
  return normalizeClaim(unwrap(response.data, "claim"));
}

/** POST /insurance/claims/{id}/submit */
export async function submitClaim(claimId: number, notes?: string): Promise<InsuranceClaim> {
  const response = await apiClient.post(`/insurance/claims/${claimId}/submit`, {
    notes: notes || undefined,
  });
  return normalizeClaim(unwrap(response.data, "claim"));
}

/** POST /insurance/claims/{id}/withdraw */
export async function withdrawClaim(claimId: number, reason?: string): Promise<InsuranceClaim> {
  const response = await apiClient.post(
    `/insurance/claims/${claimId}/withdraw`,
    undefined,
    { params: reason ? { reason } : undefined },
  );
  return normalizeClaim(unwrap(response.data, "claim"));
}

/** GET /insurance/appeals/claims/{claim_id} — appeals for a claim. */
export async function listAppealsForClaim(claimId: number): Promise<ClaimAppeal[]> {
  const response = await apiClient.get(`/insurance/appeals/claims/${claimId}`);
  const items = Array.isArray(response.data) ? response.data : response.data?.items ?? [];
  return items.map(normalizeAppeal);
}

/** POST /insurance/appeals/ — submit an appeal on a (partially) rejected claim. */
export async function submitAppeal(payload: SubmitAppealPayload): Promise<ClaimAppeal> {
  const response = await apiClient.post("/insurance/appeals/", payload);
  return normalizeAppeal(unwrap(response.data, "appeal"));
}

/** GET /patient-master/insurance-providers — bare list of providers. */
export async function listProviders(): Promise<InsuranceProvider[]> {
  const response = await apiClient.get("/patient-master/insurance-providers");
  const data = response.data;
  if (Array.isArray(data)) return data;
  return data?.items ?? [];
}

/** GET /patient-master/{patientId}/insurance — a patient's insurance policies. */
export async function listPatientInsurance(
  patientId: number,
): Promise<PatientInsurancePolicy[]> {
  const response = await apiClient.get(`/patient-master/${patientId}/insurance`);
  const data = response.data;
  if (Array.isArray(data)) return data;
  return data?.items ?? [];
}

/**
 * The backend exposes no dedicated claim aggregates endpoint, so the
 * summary is computed client-side from a wide claims page.
 */
export async function getClaimsSummary(): Promise<ClaimsSummary> {
  const { items, meta } = await listClaims({ skip: 0, limit: 200 });
  const pendingStatuses = new Set(["DRAFT", "PENDING_AUTH", "SUBMITTED", "UNDER_REVIEW"]);
  return {
    totalClaims: toNumber(meta?.total ?? items.length),
    pendingCount: items.filter((c) => pendingStatuses.has(c.status)).length,
    approvedValue: items.reduce((sum, c) => sum + c.approved_amount, 0),
    rejectedCount: items.filter((c) => c.status === "REJECTED").length,
  };
}
