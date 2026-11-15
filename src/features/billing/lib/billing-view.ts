import { INVOICE_STATUSES, toNumber, type Invoice, type InvoiceItem, type VisitBillingItem } from "../api/billing.api";

/** Status filter options for the invoice grid. */
export const INVOICE_STATUS_OPTIONS = INVOICE_STATUSES.map((status) => ({
  value: status,
  label: status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
}));

/**
 * Payment methods accepted by POST /payments/. The cashier-facing ones come
 * first (Cash, Card/POS, Transfer, Membership card); the rest stay available
 * so existing behaviour is preserved.
 */
export const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "POS", label: "Card / POS terminal" },
  { value: "CARD", label: "Card (manual)" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "MEMBERSHIP_CARD", label: "Membership card" },
  { value: "MOBILE_MONEY", label: "Mobile money" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "LOYALTY", label: "Loyalty" },
  { value: "WAIVER", label: "Waiver" },
  { value: "OTHER", label: "Other" },
];

export const PAYABLE_STATUSES = ["ISSUED", "PARTIALLY_PAID"];
export const TERMINAL_STATUSES = ["VOIDED", "CANCELLED", "PAID"];

export function canReceivePayment(invoice: Invoice | null | undefined): boolean {
  return !!invoice && invoice.balance_due > 0 && PAYABLE_STATUSES.includes(invoice.status);
}

export function canVoidInvoice(invoice: Invoice | null | undefined): boolean {
  return !!invoice && !TERMINAL_STATUSES.includes(invoice.status);
}

/** Bill is settled when nothing is owed and the invoice is not void/cancelled. */
export function isSettled(invoice: Invoice | null | undefined): boolean {
  return !!invoice && invoice.balance_due <= 0 && !["VOIDED", "CANCELLED", "DRAFT"].includes(invoice.status);
}

/** `YYYY-MM-DD` of a date string in local time, or null. */
export function localDay(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return localDay(new Date().toISOString()) ?? "";
}

/** Client-side date-range filter on `invoice_date` (inclusive, `YYYY-MM-DD`). */
export function inDateRange(invoice: Invoice, from: string, to: string): boolean {
  if (!from && !to) return true;
  const day = localDay(invoice.invoice_date);
  if (!day) return false;
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

/** Sum of `amount_paid` on invoices touched today (issued or updated today). */
export function paidToday(invoices: Invoice[]): number {
  const today = todayKey();
  return invoices
    .filter((inv) => inv.amount_paid > 0 && (localDay(inv.updated_at) === today || localDay(inv.invoice_date) === today))
    .reduce((sum, inv) => sum + inv.amount_paid, 0);
}

// ------------------------------------------------------------------
// HMO / patient split per charge line
// ------------------------------------------------------------------

export type LineSplit = {
  /** Amount the payer (HMO) covers; null when the split is unknown. */
  covered: number | null;
  /** Amount the patient pays. Falls back to the line total when no split data exists. */
  patient: number;
};

function matchKey(serviceName: string, quantity: number, unitPrice: number): string {
  return `${serviceName.trim().toLowerCase()}|${quantity}|${unitPrice}`;
}

/**
 * Invoice items do not carry the HMO split; the visit charge sheet
 * (`/billing/visits/{id}/summary`) does, per billing item. Match the invoice
 * line to its charge-sheet line by `source_reference`, else by
 * service name + qty + unit price.
 */
export function splitForItem(item: InvoiceItem, chargeItems: VisitBillingItem[] | undefined): LineSplit {
  if (!chargeItems?.length) return { covered: null, patient: item.line_total };
  const bySource = item.source_reference
    ? chargeItems.find((c) => c.source_reference && c.source_reference === item.source_reference)
    : undefined;
  const key = matchKey(item.service_name, item.quantity, item.unit_price);
  const match =
    bySource ??
    chargeItems.find((c) => matchKey(c.service_name ?? "", toNumber(c.quantity), toNumber(c.unit_price)) === key);
  if (!match) return { covered: null, patient: item.line_total };
  const hasSplit = match.covered_amount != null || match.patient_amount != null;
  if (!hasSplit) return { covered: null, patient: item.line_total };
  const covered = toNumber(match.covered_amount);
  const patient = match.patient_amount != null ? toNumber(match.patient_amount) : Math.max(0, item.line_total - covered);
  return { covered, patient };
}

export type ChargeTotals = {
  gross: number;
  discount: number;
  /** null when no line carried split data. */
  covered: number | null;
  patient: number;
};

export function chargeTotals(items: InvoiceItem[], splits: LineSplit[]): ChargeTotals {
  const gross = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
  const discount = items.reduce((s, it) => s + it.discount_amount, 0);
  const anyCovered = splits.some((s) => s.covered != null);
  const covered = anyCovered ? splits.reduce((s, sp) => s + (sp.covered ?? 0), 0) : null;
  const patient = splits.reduce((s, sp) => s + sp.patient, 0);
  return { gross, discount, covered, patient };
}

/** Human label for a payment-method code. */
export function paymentMethodLabel(code?: string | null): string {
  if (!code) return "—";
  const found = PAYMENT_METHOD_OPTIONS.find((o) => o.value === String(code).toUpperCase());
  return found?.label ?? String(code).replace(/_/g, " ");
}

/** Whether a visit is already closed (no further flow actions make sense). */
export function visitIsClosed(status?: string | null): boolean {
  return /(COMPLETED|CHECKED_OUT|CLOSED|CANCELLED|DISCHARGED)/.test(String(status ?? "").toUpperCase());
}
