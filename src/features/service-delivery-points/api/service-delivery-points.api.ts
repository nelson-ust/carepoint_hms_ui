import { apiClient } from "@/lib/api/api-client";
import type {
  DeleteResponse,
  PaginatedResponse,
  ServiceDeliveryPoint,
} from "@/features/visits/api/visits.api";

export type { ServiceDeliveryPoint } from "@/features/visits/api/visits.api";

export type CreateServiceDeliveryPointPayload = {
  name: string;
  code: string;
  service_point_type: string;
  department_id?: number;
  location_description?: string;
  queue_prefix?: string;
  supports_appointments?: boolean;
  supports_walk_in?: boolean;
  is_active?: boolean;
};

export type UpdateServiceDeliveryPointPayload = Partial<CreateServiceDeliveryPointPayload>;

export type ServicePointStatusPayload = {
  is_active: boolean;
};

export type ListServicePointsParams = {
  skip?: number;
  limit?: number;
};

export async function listServiceDeliveryPoints(
  params: ListServicePointsParams = {},
): Promise<PaginatedResponse<ServiceDeliveryPoint>> {
  const { skip = 0, limit = 100 } = params;
  const response = await apiClient.get<PaginatedResponse<ServiceDeliveryPoint>>(
    "/service-delivery-points/",
    { params: { skip, limit } },
  );
  return response.data;
}

export async function listActiveServiceDeliveryPoints(
  params: ListServicePointsParams = {},
): Promise<PaginatedResponse<ServiceDeliveryPoint>> {
  const { skip = 0, limit = 100 } = params;
  const response = await apiClient.get<PaginatedResponse<ServiceDeliveryPoint>>(
    "/service-delivery-points/active",
    { params: { skip, limit } },
  );
  return response.data;
}

export async function getServiceDeliveryPoint(id: number): Promise<ServiceDeliveryPoint> {
  const response = await apiClient.get<ServiceDeliveryPoint>(`/service-delivery-points/${id}`);
  return response.data;
}

export async function getServiceDeliveryPointByCode(code: string): Promise<ServiceDeliveryPoint> {
  const response = await apiClient.get<ServiceDeliveryPoint>(
    `/service-delivery-points/by-code/${encodeURIComponent(code)}`,
  );
  return response.data;
}

export async function createServiceDeliveryPoint(
  payload: CreateServiceDeliveryPointPayload,
): Promise<ServiceDeliveryPoint> {
  const response = await apiClient.post<ServiceDeliveryPoint>(
    "/service-delivery-points/",
    payload,
  );
  return response.data;
}

export async function updateServiceDeliveryPoint(
  id: number,
  payload: UpdateServiceDeliveryPointPayload,
): Promise<ServiceDeliveryPoint> {
  const response = await apiClient.put<ServiceDeliveryPoint>(
    `/service-delivery-points/${id}`,
    payload,
  );
  return response.data;
}

export async function setServiceDeliveryPointStatus(
  id: number,
  isActive: boolean,
): Promise<ServiceDeliveryPoint> {
  const response = await apiClient.patch<ServiceDeliveryPoint>(
    `/service-delivery-points/${id}/status`,
    { is_active: isActive } satisfies ServicePointStatusPayload,
  );
  return response.data;
}

export async function deleteServiceDeliveryPoint(id: number): Promise<DeleteResponse> {
  const response = await apiClient.delete<DeleteResponse>(`/service-delivery-points/${id}`);
  return response.data;
}
