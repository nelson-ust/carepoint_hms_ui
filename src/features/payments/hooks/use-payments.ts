import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPaymentsSummary,
  listPayments,
  receivePayment,
  refundPayment,
  type PaymentListFilters,
  type ReceivePaymentPayload,
} from "../api/payments.api";

export const paymentKeys = {
  all: ["payments"] as const,
  lists: () => [...paymentKeys.all, "list"] as const,
  list: (filters: PaymentListFilters) => [...paymentKeys.lists(), filters] as const,
  summary: () => [...paymentKeys.all, "summary"] as const,
};

export function usePayments(filters: PaymentListFilters = {}) {
  return useQuery({
    queryKey: paymentKeys.list(filters),
    queryFn: () => listPayments(filters),
  });
}

export function usePaymentsSummary() {
  return useQuery({
    queryKey: paymentKeys.summary(),
    queryFn: getPaymentsSummary,
  });
}

export function useReceivePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReceivePaymentPayload) => receivePayment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.all });
      queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}

export function useRefundPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: number; reason?: string }) =>
      refundPayment(paymentId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.all });
      queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}
