import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

// ------------------------------------------------------------------
// Types (mirroring backend invoice_schema.py / billing_schemas.py /
// payment_schema.py — Decimal fields may arrive as strings, so every
// api function normalizes amounts to numbers before returning)
// ------------------------------------------------------------------

export type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "WAIVED"
  | "VOIDED"
  | "CANCELLED";

export const INVOICE_STATUSES: InvoiceStatus[] = [
  "DRAFT",
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "WAIVED",
  "VOIDED",
  "CANCELLED",
];

export type InvoiceItem = {
  id: number;
  invoice_id: number;
  billable_service_id?: number | null;
  service_name: string;
  service_code?: string | null;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  line_total: number;
  source_reference?: string | null;
  created_at?: string | null;
};

export type Invoice = {
  id: number;
  patient_id: number;
  visit_id?: number | null;
  billing_id?: number | null;
  payer_id?: number | null;
  invoice_no: string;
  status: string;
  invoice_date: string;
  due_date?: string | null;
  subtotal_amount: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  note?: string | null;
  items: InvoiceItem[];
  created_at?: string | null;
  updated_at?: string | null;
};

export type InvoicePayment = {
  id: number;
  invoice_id: number;
  received_by_staff_id?: number | null;
  payment_reference: string;
  payment_method?: string | null;
  payment_status: string;
  amount: number;
  currency: string;
  paid_at?: string | null;
  note?: string | null;
  created_at?: string | null;
};

export type Billing = {
  id: number;
  patient_id: number;
  visit_id?: number | null;
  billing_no: string;
  billing_date: string;
  status?: string | null;
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
  notes?: string | null;
};

export type InvoiceListFilters = {
  skip?: number;
  limit?: number;
  patient_id?: number;
  visit_id?: number;
  status?: string;
};

export type BillingItemCreatePayload = {
  service_name: string;
  service_code?: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  billable_service_id?: number;
};

export type CreateInvoicePayload = {
  patient_id: number;
  visit_id?: number;
  notes?: string;
  due_date?: string;
  items: BillingItemCreatePayload[];
};

export type ReceivePaymentPayload = {
  invoice_id: number;
  amount: number;
  currency?: string;
  payment_method?: string;
  membership_card_id?: number;
  note?: string;
};

export type BillingSummary = {
  totalInvoices: number;
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  overdueCount: number;
};

// ------------------------------------------------------------------
// Normalization helpers
// ------------------------------------------------------------------

export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "string" ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeInvoiceItem(raw: any): InvoiceItem {
  return {
    ...raw,
    quantity: toNumber(raw?.quantity),
    unit_price: toNumber(raw?.unit_price),
    discount_amount: toNumber(raw?.discount_amount),
    line_total: toNumber(raw?.line_total),
  };
}

function normalizeInvoice(raw: any): Invoice {
  return {
    ...raw,
    subtotal_amount: toNumber(raw?.subtotal_amount),
    discount_amount: toNumber(raw?.discount_amount),
    tax_amount: toNumber(raw?.tax_amount),
    total_amount: toNumber(raw?.total_amount),
    amount_paid: toNumber(raw?.amount_paid),
    balance_due: toNumber(raw?.balance_due),
    status: String(raw?.status ?? "").toUpperCase(),
    items: Array.isArray(raw?.items) ? raw.items.map(normalizeInvoiceItem) : [],
  };
}

function normalizePayment(raw: any): InvoicePayment {
  return {
    ...raw,
    amount: toNumber(raw?.amount),
    payment_status: String(raw?.payment_status ?? "").toUpperCase(),
  };
}

/** Unwraps either an action envelope ({success, message, <key>}) or a bare resource. */
function unwrap<T>(data: any, key: string): T {
  if (data && typeof data === "object" && key in data) return data[key] as T;
  return data as T;
}

function cleanParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  });
  return out;
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
// API calls
// ------------------------------------------------------------------

/** GET /invoices/ — paginated invoice list with filters. */
export async function listInvoices(
  filters: InvoiceListFilters = {},
): Promise<PaginatedResponse<Invoice>> {
  const { skip = 0, limit = 20, ...rest } = filters;
  const response = await apiClient.get<PaginatedResponse<Invoice>>("/invoices/", {
    params: cleanParams({ skip, limit, ...rest }),
  });
  const data = response.data;
  return {
    success: data?.success ?? true,
    message: data?.message ?? "",
    items: (data?.items ?? []).map(normalizeInvoice),
    count: data?.count ?? data?.items?.length ?? 0,
    meta: data?.meta ?? {},
  };
}

/** GET /invoices/{id} — bare invoice resource. */
export async function getInvoice(invoiceId: number): Promise<Invoice> {
  const response = await apiClient.get(`/invoices/${invoiceId}`);
  return normalizeInvoice(unwrap(response.data, "invoice"));
}

/**
 * Create an invoice: POST /billing/ to create the billing record with its
 * charge lines, then POST /invoices/issue-from-billing to issue the invoice.
 */
export async function createInvoice(payload: CreateInvoicePayload): Promise<Invoice> {
  const billingRes = await apiClient.post("/billing/", {
    patient_id: payload.patient_id,
    visit_id: payload.visit_id,
    notes: payload.notes,
    items: payload.items.map((item) => ({
      service_name: item.service_name,
      service_code: item.service_code,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_amount: item.discount_amount ?? 0,
      billable_service_id: item.billable_service_id,
    })),
  });
  const billing = unwrap<any>(billingRes.data, "billing");

  const invoiceRes = await apiClient.post("/invoices/issue-from-billing", {
    billing_id: billing.id,
    due_date: payload.due_date,
    note: payload.notes,
  });
  return normalizeInvoice(unwrap(invoiceRes.data, "invoice"));
}

/** POST /invoices/{id}/void */
export async function voidInvoice(invoiceId: number, reason?: string): Promise<Invoice> {
  const response = await apiClient.post(`/invoices/${invoiceId}/void`, {
    reason: reason || undefined,
  });
  return normalizeInvoice(unwrap(response.data, "invoice"));
}

/** GET /payments/invoices/{invoice_id} — payment history for one invoice. */
export async function listPaymentsForInvoice(invoiceId: number): Promise<InvoicePayment[]> {
  const response = await apiClient.get<PaginatedResponse<InvoicePayment>>(
    `/payments/invoices/${invoiceId}`,
  );
  return (response.data?.items ?? []).map(normalizePayment);
}

/** POST /payments/ — receive a payment against an invoice. */
export async function receivePayment(payload: ReceivePaymentPayload): Promise<InvoicePayment> {
  const response = await apiClient.post("/payments/", {
    invoice_id: payload.invoice_id,
    amount: payload.amount,
    currency: payload.currency ?? "NGN",
    payment_method: payload.payment_method ?? "CASH",
    membership_card_id: payload.membership_card_id,
    note: payload.note || undefined,
  });
  return normalizePayment(unwrap(response.data, "payment"));
}

/**
 * The backend exposes no dedicated aggregates endpoint for patient billing,
 * so the summary is computed client-side from a wide invoice page.
 */
export async function getBillingSummary(): Promise<BillingSummary> {
  const { items, meta } = await listInvoices({ skip: 0, limit: 200 });
  const now = Date.now();
  const active = items.filter(
    (inv) => !["VOIDED", "CANCELLED", "WAIVED", "DRAFT"].includes(inv.status),
  );
  return {
    totalInvoices: toNumber(meta?.total ?? items.length),
    totalBilled: active.reduce((sum, inv) => sum + inv.total_amount, 0),
    totalCollected: active.reduce((sum, inv) => sum + inv.amount_paid, 0),
    totalOutstanding: active.reduce((sum, inv) => sum + inv.balance_due, 0),
    overdueCount: active.filter(
      (inv) =>
        inv.balance_due > 0 && inv.due_date && new Date(inv.due_date).getTime() < now,
    ).length,
  };
}

// ------------------------------------------------------------------
// Visit charge sheet — running total, partial payments, outstanding
// (backend: /billing/visits/{visit_id}/summary | /payments | /finalize)
// ------------------------------------------------------------------

export type VisitBillingItem = {
  id: number;
  service_name: string;
  service_code?: string | null;
  category?: string | null;
  quantity: number | string;
  unit_price: number | string;
  discount_amount: number | string;
  line_total: number | string;
  covered_amount?: number | string | null;
  patient_amount?: number | string | null;
  is_covered?: boolean;
  source_reference?: string | null;
  account_code?: string | null;
  account_name?: string | null;
};

export type VisitBillingPayment = {
  id: number;
  amount: number | string;
  currency?: string;
  payment_method?: string | null;
  payment_reference: string;
  paid_at?: string | null;
  note?: string | null;
  transaction_metadata?: Record<string, unknown> | null;
  account_code?: string | null;
  account_name?: string | null;
};

export type VisitBillingSummary = {
  visit_id: number;
  billing_id?: number | null;
  billing_no?: string | null;
  patient_id?: number | null;
  status?: string | null;
  currency: string;
  total_charges: number | string;
  gross_amount: number | string;
  discount_amount: number | string;
  amount_paid: number | string;
  outstanding: number | string;
  unmapped_count?: number;
  unaccounted_amount?: number | string;
  items: VisitBillingItem[];
  payments: VisitBillingPayment[];
  invoice?: {
    id: number;
    invoice_no: string;
    status: string;
    total_amount: number | string;
    amount_paid: number | string;
    balance_due: number | string;
  } | null;
};

export type RecordVisitPaymentPayload = {
  amount: number;
  payment_method?: string;
  payment_reference?: string;
  membership_card_id?: number;
  note?: string;
};

/** GET /billing/visits/{visitId}/summary */
export async function getVisitBillingSummary(visitId: number): Promise<VisitBillingSummary> {
  const response = await apiClient.get<VisitBillingSummary>(
    `/billing/visits/${visitId}/summary`,
  );
  return response.data;
}

/** POST /billing/visits/{visitId}/payments — record a partial payment. */
export async function recordVisitPayment(
  visitId: number,
  payload: RecordVisitPaymentPayload,
): Promise<VisitBillingSummary> {
  const response = await apiClient.post<VisitBillingSummary>(
    `/billing/visits/${visitId}/payments`,
    payload,
  );
  return response.data;
}

export type FinalizeVisitBillingPayload = {
  due_date?: string;
  note?: string;
  payer_id?: number;
};

/** POST /billing/visits/{visitId}/finalize — issue the final invoice. */
export async function finalizeVisitBilling(
  visitId: number,
  payload?: FinalizeVisitBillingPayload,
): Promise<{
  success: boolean;
  message: string;
  invoice_id: number;
  invoice_no: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: string;
}> {
  const response = await apiClient.post(
    `/billing/visits/${visitId}/finalize`,
    payload ?? {},
  );
  return response.data;
}
