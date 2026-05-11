import { apiClient } from "@/lib/api/api-client";
import { VisitStep, VisitTemplate } from "./visit-flows.api";

export type PatientSummary = {
  id: number;
  hospital_number: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  gender: string;
  phone_number: string;
};

export type AppointmentSummary = {
  id: number;
  appointment_code: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  reason?: string;
  status: string;
  patient_id: number;
  service_delivery_point_id: number;
  staff_profile_id?: number;
};

export type ServiceDeliveryPoint = {
  id: number;
  name: string;
  code: string;
  service_point_type: string;
  department_id?: number;
  location_description?: string;
  queue_prefix?: string;
  supports_appointments: boolean;
  supports_walk_in: boolean;
  is_active: boolean;
};

export type QueueTicket = {
  id: number;
  visit_id: number;
  visit_flow_step_id?: number;
  patient_id: number;
  service_delivery_point_id: number;
  queue_number: string;
  queue_position: number;
  status: string;
  called_at?: string;
  service_started_at?: string;
  service_ended_at?: string;
  transferred_from_ticket_id?: number;
  created_at: string;
  updated_at: string;
};

export type Visit = {
  id: number;
  patient_id: number;
  appointment_id?: number;
  visit_code: string;
  visit_date: string;
  status: string;
  priority: string;
  first_service_delivery_point_id: number;
  current_service_delivery_point_id: number;
  referred_from?: string;
  visit_reason?: string;
  check_in_time?: string;
  check_out_time?: string;
  created_at: string;
  updated_at: string;
  patient?: PatientSummary;
  appointment?: AppointmentSummary;
  first_service_delivery_point?: ServiceDeliveryPoint;
  current_service_delivery_point?: ServiceDeliveryPoint;
  flow_steps?: VisitStep[];
  queue_tickets?: QueueTicket[];
};

export type InitiateVisitPayload = {
  patient_id: number;
  appointment_id?: number;
  visit_reason?: string;
  referred_from?: string;
  priority?: string;
  status?: string;
  first_service_delivery_point_id?: number;
  use_appointment_service_point?: boolean;
  visit_flow_template_id?: number;
  visit_date?: string;
  check_in_time?: string;
  create_first_flow_step?: boolean;
  create_queue_ticket?: boolean;
  first_step_status?: string;
  first_queue_status?: string;
  mark_visit_waiting?: boolean;
  fast_track?: boolean;
  queue_position?: number;
  flow_step_notes?: string;
  queue_notes?: string;
};

export type RerouteVisitPayload = {
  service_delivery_point_id: number;
  routed_by_id?: number;
  reason?: string;
  create_queue_ticket?: boolean;
  queue_status?: string;
  queue_position?: number;
  mark_as_current?: boolean;
};

export type UpdateVisitPayload = {
  appointment_id?: number;
  visit_reason?: string;
  referred_from?: string;
  priority?: string;
  status?: string;
  first_service_delivery_point_id?: number;
  current_service_delivery_point_id?: number;
  check_in_time?: string;
  check_out_time?: string;
};

export type InitiateVisitResponse = {
  success: boolean;
  message: string;
  visit: Visit;
  first_flow_step?: VisitStep;
  first_queue_ticket?: QueueTicket;
  applied_template?: VisitTemplate;
  inherited_from_appointment: boolean;
  fast_tracked: boolean;
};

export type RerouteVisitResponse = {
  success: boolean;
  message: string;
  visit: Visit;
  new_flow_step?: VisitStep;
  new_queue_ticket?: QueueTicket;
};

export type ListMeta = {
  total?: number;
  skip?: number;
  limit?: number;
  current_page?: number;
  total_pages?: number;
  has_next?: boolean;
  has_previous?: boolean;
  [key: string]: any;
};

export type PaginatedResponse<T> = {
  success: boolean;
  message: string;
  items: T[];
  count: number;
  meta: ListMeta;
};

export type VisitListFilters = {
  skip?: number;
  limit?: number;
  status?: string;
  priority?: string;
  patient_id?: number;
  service_delivery_point_id?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
};

export type DeleteResponse = {
  success: boolean;
  message: string;
};

export async function initiateVisit(payload: InitiateVisitPayload) {
  const response = await apiClient.post<InitiateVisitResponse>("/visits/initiate", payload);
  return response.data;
}

export async function getVisits(filters: VisitListFilters = {}) {
  const { skip = 0, limit = 20, ...rest } = filters;
  const params: Record<string, any> = { skip, limit };
  Object.entries(rest).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params[key] = value;
  });
  const response = await apiClient.get<PaginatedResponse<Visit>>("/visits/", { params });
  return response.data;
}

export async function getVisit(visitId: number) {
  const response = await apiClient.get<Visit>(`/visits/${visitId}`);
  return response.data;
}

export async function getVisitDetails(visitId: number) {
  const response = await apiClient.get<Visit>(`/visits/${visitId}/detailed`);
  return response.data;
}

export async function updateVisit(visitId: number, payload: UpdateVisitPayload) {
  const response = await apiClient.put<Visit>(`/visits/${visitId}`, payload);
  return response.data;
}

export async function deleteVisit(visitId: number) {
  const response = await apiClient.delete<DeleteResponse>(`/visits/${visitId}`);
  return response.data;
}

export async function rerouteVisit(visitId: number, payload: RerouteVisitPayload) {
  const response = await apiClient.post<RerouteVisitResponse>(`/visits/${visitId}/reroute`, payload);
  return response.data;
}

export async function getServiceDeliveryPoints(
  options: { skip?: number; limit?: number } = {},
): Promise<ServiceDeliveryPoint[]> {
  const { skip = 0, limit = 100 } = options;
  const response = await apiClient.get<PaginatedResponse<ServiceDeliveryPoint>>(
    "/service-delivery-points/active",
    { params: { skip, limit } },
  );
  return response.data.items ?? [];
}
