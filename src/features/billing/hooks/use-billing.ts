import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInvoice,
  finalizeVisitBilling,
  getBillingSummary,
  getInvoice,
  getVisitBillingSummary,
  listInvoices,
  listPaymentsForInvoice,
  receivePayment,
  recordVisitPayment,
  voidInvoice,
  type CreateInvoicePayload,
  type FinalizeVisitBillingPayload,
  type InvoiceListFilters,
  type ReceivePaymentPayload,
  type RecordVisitPaymentPayload,
} from "../api/billing.api";

export const billingKeys = {
  all: ["billing"] as const,
  invoices: () => [...billingKeys.all, "invoices"] as const,
  invoiceList: (filters: InvoiceListFilters) => [...billingKeys.invoices(), filters] as const,
  invoice: (id: number) => [...billingKeys.all, "invoice", id] as const,
  invoicePayments: (id: number) => [...billingKeys.all, "invoice-payments", id] as const,
  visitSummary: (visitId: number) => [...billingKeys.all, "visit-summary", visitId] as const,
  summary: () => [...billingKeys.all, "summary"] as const,
};

export function useVisitBillingSummary(visitId: number | undefined) {
  return useQuery({
    queryKey: billingKeys.visitSummary(visitId ?? 0),
    queryFn: () => getVisitBillingSummary(visitId as number),
    enabled: typeof visitId === "number" && Number.isFinite(visitId),
  });
}

export function useRecordVisitPayment(visitId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RecordVisitPaymentPayload) => recordVisitPayment(visitId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.visitSummary(visitId) });
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
      // A membership-card debit changes the card balance.
      queryClient.invalidateQueries({ queryKey: ["membership-cards"] });
    },
  });
}

export function useFinalizeVisitBilling(visitId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload?: FinalizeVisitBillingPayload) =>
      finalizeVisitBilling(visitId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.visitSummary(visitId) });
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
    },
  });
}

export function useInvoices(filters: InvoiceListFilters = {}) {
  return useQuery({
    queryKey: billingKeys.invoiceList(filters),
    queryFn: () => listInvoices(filters),
  });
}

export function useInvoice(invoiceId: number | undefined) {
  return useQuery({
    queryKey: billingKeys.invoice(invoiceId ?? 0),
    queryFn: () => getInvoice(invoiceId as number),
    enabled: typeof invoiceId === "number" && Number.isFinite(invoiceId),
  });
}

export function useInvoicePayments(invoiceId: number | undefined) {
  return useQuery({
    queryKey: billingKeys.invoicePayments(invoiceId ?? 0),
    queryFn: () => listPaymentsForInvoice(invoiceId as number),
    enabled: typeof invoiceId === "number" && Number.isFinite(invoiceId),
  });
}

export function useBillingSummary() {
  return useQuery({
    queryKey: billingKeys.summary(),
    queryFn: getBillingSummary,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateInvoicePayload) => createInvoice(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
    },
  });
}

export function useReceivePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReceivePaymentPayload) => receivePayment(payload),
    onSuccess: (_payment, variables) => {
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
      queryClient.invalidateQueries({
        queryKey: billingKeys.invoicePayments(variables.invoice_id),
      });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      // A membership-card debit changes the card balance.
      queryClient.invalidateQueries({ queryKey: ["membership-cards"] });
    },
  });
}

export function useVoidInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, reason }: { invoiceId: number; reason?: string }) =>
      voidInvoice(invoiceId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
    },
  });
}
