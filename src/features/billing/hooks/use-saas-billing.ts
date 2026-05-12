import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { saasBillingApi } from "../api/saas-billing.api";

export const saasBillingKeys = {
  all: ["saas-billing"] as const,
  invoices: () => [...saasBillingKeys.all, "invoices"] as const,
  invoiceList: (filters: any) => [...saasBillingKeys.invoices(), filters] as const,
  myInvoices: () => [...saasBillingKeys.all, "my-invoices"] as const,
};

export function useSaaSInvoices(params: { skip?: number; limit?: number; status?: string } = {}) {
  return useQuery({
    queryKey: saasBillingKeys.invoiceList(params),
    queryFn: () => saasBillingApi.listInvoices(params),
  });
}

export function useMySaaSInvoices() {
  return useQuery({
    queryKey: saasBillingKeys.myInvoices(),
    queryFn: () => saasBillingApi.listMyInvoices(),
  });
}

export function useIssueInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { tenant_id: number; plan_id: number }) => saasBillingApi.issueInvoice(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: saasBillingKeys.invoices() });
    },
  });
}

export function useRecordSaaSPayment(invoiceId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { amount: number; payment_method: string; reference: string }) => 
      saasBillingApi.recordPayment(invoiceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: saasBillingKeys.invoices() });
      queryClient.invalidateQueries({ queryKey: saasBillingKeys.myInvoices() });
    },
  });
}
