import { apiClient } from "@/lib/api/api-client";
import type {
  PaginatedResponse,
  PatientSummary,
  ServiceDeliveryPoint,
} from "@/features/visits/api/visits.api";

// Visit summary that the backend may embed inside a queue ticket.
export type QueueVisitSummary = {
  id: number;
  visit_code?: string;
  status?: string;
  priority?: string;
  visit_reason?: string;
};

export type QueueTicket = {
  id: number;
  visit_id: number;
  visit_flow_step_id?: number;
  patient_id: number;
  service_delivery_point_id: number;
  queue_number: string;
  queue_position: number;
  status: string; // WAITING, CALLED, SERVING, COMPLETED, MISSED, CANCELLED, TRANSFERRED
  called_at?: string;
  service_started_at?: string;
  service_ended_at?: string;
  transferred_from_ticket_id?: number;
  created_at: string;
  updated_at: string;

  // Optional enriched fields the backend may return.
  patient?: PatientSummary;
  visit?: QueueVisitSummary;
  service_delivery_point?: ServiceDeliveryPoint;
};

export type Worklist = {
  success: boolean;
  message: string;
  service_delivery_point_id: number;
  service_delivery_point_name: string;
  // The OpenAPI doc shows these as "string", but the backend almost certainly
  // returns ticket arrays. We accept both shapes and normalise on the client.
  waiting: QueueTicket[] | string;
  serving: QueueTicket[] | string;
  served_today: number;
  cancelled_today: number;
};

export type TicketActionResponse = {
  success: boolean;
  message: string;
  ticket: QueueTicket;
};

export type CallTicketPayload = { note?: string };
export type ServeTicketPayload = { note?: string };
export type CompleteTicketPayload = { note?: string };
export type CancelTicketPayload = { reason: string };
export type TransferTicketPayload = {
  target_service_delivery_point_id: number;
  reason?: string;
};

// ---------- Worklists ----------

export async function getMyWorklist(): Promise<Worklist> {
  const response = await apiClient.get<Worklist>("/queue/my-worklist");
  return response.data;
}

export async function getServicePointWorklist(serviceDeliveryPointId: number): Promise<Worklist> {
  const response = await apiClient.get<Worklist>(
    `/queue/service-points/${serviceDeliveryPointId}/worklist`,
  );
  return response.data;
}

// ---------- Listings ----------

export async function listServicePointTickets(
  serviceDeliveryPointId: number,
  params: { skip?: number; limit?: number; status?: string } = {},
): Promise<PaginatedResponse<QueueTicket>> {
  const { skip = 0, limit = 100, status } = params;
  const response = await apiClient.get<PaginatedResponse<QueueTicket>>(
    `/queue/service-points/${serviceDeliveryPointId}/tickets`,
    { params: { skip, limit, status } },
  );
  return response.data;
}

export async function listVisitTickets(
  visitId: number,
  params: { skip?: number; limit?: number } = {},
): Promise<PaginatedResponse<QueueTicket>> {
  const { skip = 0, limit = 50 } = params;
  const response = await apiClient.get<PaginatedResponse<QueueTicket>>(
    `/queue/visits/${visitId}/tickets`,
    { params: { skip, limit } },
  );
  return response.data;
}

export async function getTicket(ticketId: number): Promise<QueueTicket> {
  const response = await apiClient.get<QueueTicket>(`/queue/tickets/${ticketId}`);
  return response.data;
}

// ---------- Ticket actions ----------

export async function callTicket(
  ticketId: number,
  payload: CallTicketPayload = {},
): Promise<TicketActionResponse> {
  const response = await apiClient.post<TicketActionResponse>(
    `/queue/tickets/${ticketId}/call`,
    payload,
  );
  return response.data;
}

export async function serveTicket(
  ticketId: number,
  payload: ServeTicketPayload = {},
): Promise<TicketActionResponse> {
  const response = await apiClient.post<TicketActionResponse>(
    `/queue/tickets/${ticketId}/serve`,
    payload,
  );
  return response.data;
}

export async function completeTicket(
  ticketId: number,
  payload: CompleteTicketPayload = {},
): Promise<TicketActionResponse> {
  const response = await apiClient.post<TicketActionResponse>(
    `/queue/tickets/${ticketId}/complete`,
    payload,
  );
  return response.data;
}

// `complete-and-route` and `complete-and-end-visit` accept a raw JSON string
// as the body (per the API spec). We send the note as a JSON-encoded string so
// the backend receives `"the note"` rather than the unquoted bare text.
export async function completeAndRouteTicket(
  ticketId: number,
  note: string = "",
): Promise<TicketActionResponse> {
  const response = await apiClient.post<TicketActionResponse>(
    `/queue/tickets/${ticketId}/complete-and-route`,
    JSON.stringify(note),
    { headers: { "Content-Type": "application/json" } },
  );
  return response.data;
}

export async function completeAndEndVisitTicket(
  ticketId: number,
  note: string = "",
): Promise<TicketActionResponse> {
  const response = await apiClient.post<TicketActionResponse>(
    `/queue/tickets/${ticketId}/complete-and-end-visit`,
    JSON.stringify(note),
    { headers: { "Content-Type": "application/json" } },
  );
  return response.data;
}

export async function missTicket(ticketId: number): Promise<TicketActionResponse> {
  const response = await apiClient.post<TicketActionResponse>(
    `/queue/tickets/${ticketId}/miss`,
  );
  return response.data;
}

export async function cancelTicket(
  ticketId: number,
  payload: CancelTicketPayload,
): Promise<TicketActionResponse> {
  const response = await apiClient.post<TicketActionResponse>(
    `/queue/tickets/${ticketId}/cancel`,
    payload,
  );
  return response.data;
}

export async function transferTicket(
  ticketId: number,
  payload: TransferTicketPayload,
): Promise<TicketActionResponse> {
  const response = await apiClient.post<TicketActionResponse>(
    `/queue/tickets/${ticketId}/transfer`,
    payload,
  );
  return response.data;
}

// ---------- Helpers ----------

/** Normalise a `Worklist.waiting` / `.serving` field that may come back as a string. */
export function asTicketArray(value: QueueTicket[] | string | undefined): QueueTicket[] {
  return Array.isArray(value) ? value : [];
}
