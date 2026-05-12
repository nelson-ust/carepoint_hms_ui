import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

// ---------- Types ----------

export type SaaSInvoice = {
  id: number;
  invoice_no: string;
  status: "DRAFT" | "ISSUED" | "PAID" | "OVERDUE" | "CANCELLED";
  invoice_date: string;
  due_date: string;
  subtotal_amount: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  note?: string;
  created_at: string;
  updated_at: string;
};

export type SaaSPayment = {
  id: number;
  invoice_id: number;
  payment_reference: string;
  payment_method: string;
  payment_status: string;
  amount: number;
  currency: string;
  paid_at: string;
  note?: string;
  created_at: string;
};

// ---------- Endpoints ----------

export const saasBillingApi = {
  listInvoices: (params: { skip?: number; limit?: number; status?: string } = {}) =>
    apiClient.get<PaginatedResponse<SaaSInvoice>>("/subscription-billing/invoices", { params }).then((res) => res.data),
  
  issueInvoice: (payload: { tenant_id: number; plan_id: number }) =>
    apiClient.post<{ success: boolean; message: string; invoice: SaaSInvoice }>("/subscription-billing/invoices/issue", payload).then((res) => res.data),
  
  recordPayment: (invoiceId: number, payload: { amount: number; payment_method: string; reference: string }) =>
    apiClient.post<SaaSPayment>(`/subscription-billing/invoices/${invoiceId}/payments`, payload).then((res) => res.data),
  
  listMyInvoices: () =>
    apiClient.get<PaginatedResponse<SaaSInvoice>>("/subscription-billing/invoices/me").then((res) => res.data),
};
