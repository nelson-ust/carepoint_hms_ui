import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

// ---------- Types ----------

export type ServiceDeliveryPoint = {
  id: number;
  name: string;
  description?: string;
  queue_prefix: string;
  is_active: boolean;
  created_at: string;
};

// ---------- Endpoints ----------

export const sdpApi = {
  list: () =>
    apiClient.get<PaginatedResponse<ServiceDeliveryPoint>>("/service-delivery-points").then((res) => res.data),
  
  get: (id: number) =>
    apiClient.get<ServiceDeliveryPoint>(`/service-delivery-points/${id}`).then((res) => res.data),
  
  create: (payload: { name: string; description?: string; queue_prefix: string }) =>
    apiClient.post<{ success: boolean; sdp: ServiceDeliveryPoint }>("/service-delivery-points", payload).then((res) => res.data),
  
  update: (id: number, payload: Partial<ServiceDeliveryPoint>) =>
    apiClient.put<{ success: boolean; sdp: ServiceDeliveryPoint }>(`/service-delivery-points/${id}`, payload).then((res) => res.data),
  
  delete: (id: number) =>
    apiClient.delete(`/service-delivery-points/${id}`).then((res) => res.data),
};
