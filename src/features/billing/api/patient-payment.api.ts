import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

// ---------- Types ----------

export type PaymentGateway = {
  id: number;
  gateway_name: string; // e.g., 'Paystack', 'Flutterwave', 'Stripe'
  is_active: boolean;
  config: Record<string, any>;
  created_at: string;
};

// ---------- Endpoints ----------

export const patientPaymentApi = {
  listGateways: () =>
    apiClient.get<PaginatedResponse<PaymentGateway>>("/patient-payment/gateways").then((res) => res.data),
  
  createGateway: (payload: any) =>
    apiClient.post<{ success: boolean; gateway: PaymentGateway }>("/patient-payment/gateways", payload).then((res) => res.data),
  
  testGateway: (id: number) =>
    apiClient.post<{ success: boolean; message: string }>(`/patient-payment/gateways/${id}/test`).then((res) => res.data),
  
  initiatePayment: (payload: { amount: number; patient_id: number; visit_id?: number; gateway_id: number }) =>
    apiClient.post<{ success: boolean; payment_url: string; reference: string }>("/patient-payment/pay", payload).then((res) => res.data),
};
