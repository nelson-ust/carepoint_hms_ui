import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { patientPaymentApi } from "../api/patient-payment.api";

export const paymentKeys = {
  all: ["patient-payment"] as const,
  gateways: () => [...paymentKeys.all, "gateways"] as const,
};

export function usePaymentGateways() {
  return useQuery({
    queryKey: paymentKeys.gateways(),
    queryFn: () => patientPaymentApi.listGateways(),
  });
}

export function useCreateGateway() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => patientPaymentApi.createGateway(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.gateways() });
    },
  });
}

export function useTestGateway() {
  return useMutation({
    mutationFn: (id: number) => patientPaymentApi.testGateway(id),
  });
}

export function useInitiatePayment() {
  return useMutation({
    mutationFn: (payload: { amount: number; patient_id: number; visit_id?: number; gateway_id: number }) => 
      patientPaymentApi.initiatePayment(payload),
  });
}
