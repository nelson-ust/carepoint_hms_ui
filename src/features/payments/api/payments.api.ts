import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

// ------------------------------------------------------------------
// Types (mirroring backend payment_schema.py — Decimal fields may
// arrive as strings, so api functions normalize amounts to numbers)
// ------------------------------------------------------------------

export type PaymentMethod =
  | "CASH"
  | "CARD"
  | "BANK_TRANSFER"
  | "MOBILE_MONEY"
  | "INSURANCE"
  | "LOYALTY"
  | "WAIVER"
  | "MEMBERSHIP_CARD"
  | "OTHER";

export const PAYMENT_METHODS: PaymentMethod[] = [
  "CASH",
  "CARD",
  "BANK_TRANSFER",
  "MOBILE_MONEY",
  "INSURANCE",
  "LOYALTY",
  "WAIVER",
  "MEMBERSHIP_CARD",
  "OTHER",
];

export type PaymentStatus = "PENDING" | "SUCCESSFUL" | "FAILED" | "REVERSED" | "CANCELLED";

export const PAYMENT_STATUSES: PaymentStatus[] = [
  "PENDING",
  "SUCCESSFUL",
  "FAILED",
  "REVERSED",
  "CANCELLED",
];

export type Payment = {
  id: number;
  invoice_id: number;
  received_by_staff_id?: number | null;
  payment_reference: string;
  payment_method?: string | null;
  payment_status: string;
  amount: number;
  currency: string;
  paid_at?: string | null;
  transaction_metadata?: Record<string, unknown> | null;
  note?: string | null;
  created_at?: string | null;
};

export type PaymentListFilters = {
  skip?: number;
  limit?: number;
  invoice_id?: number;
  payment_method?: string;
  payment_status?: string;
};

export type ReceivePaymentPayload = {
  invoice_id: number;
  amount: number;
  currency?: string;
  payment_method?: string;
  note?: string;
};

export type PaymentsSummary = {
  totalPayments: number;
  totalCollected: number;
  pendingCount: number;
  reversedAmount: number;
};

// ------------------------------------------------------------------
// Normalization helpers
// ------------------------------------------------------------------

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "string" ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizePayment(raw: any): Payment {
  return {
    ...raw,
    amount: toNumber(raw?.amount),
    payment_status: String(raw?.payment_status ?? "").toUpperCase(),
    payment_method: raw?.payment_method ? String(raw.payment_method).toUpperCase() : null,
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

/** GET /payments/ — paginated payment ledger with filters. */
export async function listPayments(
  filters: PaymentListFilters = {},
): Promise<PaginatedResponse<Payment>> {
  const { skip = 0, limit = 20, ...rest } = filters;
  const response = await apiClient.get<PaginatedResponse<Payment>>("/payments/", {
    params: cleanParams({ skip, limit, ...rest }),
  });
  const data = response.data;
  return {
    success: data?.success ?? true,
    message: data?.message ?? "",
    items: (data?.items ?? []).map(normalizePayment),
    count: data?.count ?? data?.items?.length ?? 0,
    meta: data?.meta ?? {},
  };
}

/** GET /payments/{id} — bare payment resource. */
export async function getPayment(paymentId: number): Promise<Payment> {
  const response = await apiClient.get(`/payments/${paymentId}`);
  return normalizePayment(unwrap(response.data, "payment"));
}

/** GET /payments/invoices/{invoice_id} — payments for a given invoice. */
export async function listPaymentsForInvoice(invoiceId: number): Promise<Payment[]> {
  const response = await apiClient.get<PaginatedResponse<Payment>>(
    `/payments/invoices/${invoiceId}`,
  );
  return (response.data?.items ?? []).map(normalizePayment);
}

/** POST /payments/ — receive a payment against an invoice. */
export async function receivePayment(payload: ReceivePaymentPayload): Promise<Payment> {
  const response = await apiClient.post("/payments/", {
    invoice_id: payload.invoice_id,
    amount: payload.amount,
    currency: payload.currency ?? "NGN",
    payment_method: payload.payment_method ?? "CASH",
    note: payload.note || undefined,
  });
  return normalizePayment(unwrap(response.data, "payment"));
}

/** POST /payments/refund — refund a previous payment. */
export async function refundPayment(paymentId: number, reason?: string): Promise<Payment> {
  const response = await apiClient.post("/payments/refund", {
    payment_id: paymentId,
    reason: reason || undefined,
  });
  return normalizePayment(unwrap(response.data, "payment"));
}

/**
 * The backend exposes no dedicated payments aggregates endpoint, so the
 * summary is computed client-side from a wide payments page.
 */
export async function getPaymentsSummary(): Promise<PaymentsSummary> {
  const { items, meta } = await listPayments({ skip: 0, limit: 200 });
  return {
    totalPayments: toNumber(meta?.total ?? items.length),
    totalCollected: items
      .filter((p) => p.payment_status === "SUCCESSFUL")
      .reduce((sum, p) => sum + p.amount, 0),
    pendingCount: items.filter((p) => p.payment_status === "PENDING").length,
    reversedAmount: items
      .filter((p) => p.payment_status === "REVERSED")
      .reduce((sum, p) => sum + p.amount, 0),
  };
}
