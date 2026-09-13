import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

// ============================================================
// Types
// ============================================================

/** Full queue ticket lifecycle (see queue_service.py). */
export type QueueTicketStatus =
  | "WAITING"
  | "CALLED"
  | "SERVING"
  | "SERVED"
  | "MISSED"
  | "CANCELLED"
  | "TRANSFERRED";

export const QUEUE_TICKET_STATUSES: QueueTicketStatus[] = [
  "WAITING",
  "CALLED",
  "SERVING",
  "SERVED",
  "MISSED",
  "CANCELLED",
  "TRANSFERRED",
];

/** A previous step in the patient's current visit (provider context). */
export type QueueTicketPreviousStep = {
  service_delivery_point_id: number;
  service_delivery_point_name: string;
  status: string;
  services_provided: string[];
  started_at?: string | null;
  ended_at?: string | null;
};

export type QueueTicket = {
  id: number;
  visit_id: number;
  visit_flow_step_id?: number | null;
  patient_id: number;
  service_delivery_point_id: number;
  queue_number: string;
  queue_position?: number | null;
  status: QueueTicketStatus;
  called_at?: string | null;
  service_started_at?: string | null;
  service_ended_at?: string | null;
  transferred_from_ticket_id?: number | null;
  created_at?: string | null;
  updated_at?: string | null;

  // Demographic context populated by the backend read schema.
  patient_name?: string | null;
  patient_phone?: string | null;
  hospital_number?: string | null;

  // History of earlier steps in this visit.
  previous_steps: QueueTicketPreviousStep[];
};

export type Worklist = {
  success: boolean;
  message: string;
  service_delivery_point_id: number;
  service_delivery_point_name?: string | null;
  waiting: QueueTicket[];
  serving: QueueTicket[];
  served_today: number;
  cancelled_today: number;
};

export type TicketActionResponse = {
  success: boolean;
  message: string;
  ticket: QueueTicket;
};

/** `complete-and-end-visit` returns a visit summary, NOT a ticket. */
export type CompleteAndEndVisitResponse = {
  success: boolean;
  message: string;
  visit_id: number;
  visit_status: string;
  check_out_time?: string | null;
};

// ---------- Analytics ----------

export type QueueStatsTotals = {
  waiting_now: number;
  called_now: number;
  serving_now: number;
  issued: number;
  served: number;
  missed: number;
  cancelled: number;
  transferred: number;
  avg_wait_minutes?: number | null;
  avg_service_minutes?: number | null;
  /** MISSED / (SERVED + MISSED), in 0..1. */
  no_show_rate?: number | null;
};

export type ServicePointQueueStats = QueueStatsTotals & {
  service_delivery_point_id: number;
  service_delivery_point_name: string;
  service_delivery_point_code?: string | null;
};

export type QueueStatsResponse = {
  success: boolean;
  message: string;
  date_from: string;
  date_to: string;
  totals: QueueStatsTotals;
  service_points: ServicePointQueueStats[];
};

// ---------- Waiting-room display board ----------

export type DisplayBoardTicket = {
  queue_number: string;
  status: string;
  called_at?: string | null;
};

export type DisplayBoardEntry = {
  service_delivery_point_id: number;
  service_delivery_point_name: string;
  service_delivery_point_code?: string | null;
  now_serving: DisplayBoardTicket[];
  now_called: DisplayBoardTicket[];
  next_waiting: DisplayBoardTicket[];
  waiting_count: number;
};

export type DisplayBoardResponse = {
  success: boolean;
  message: string;
  generated_at: string;
  service_points: DisplayBoardEntry[];
};

// ============================================================
// Normalizers
// ============================================================

/** Uppercase a status and strip any `QueueStatus.` enum prefix. */
export function normalizeTicketStatus(value: unknown): QueueTicketStatus {
  const raw = String(value ?? "").split(".").pop() ?? "";
  return raw.trim().toUpperCase() as QueueTicketStatus;
}

function normalizeTicket(ticket: QueueTicket): QueueTicket {
  return {
    ...ticket,
    status: normalizeTicketStatus(ticket.status),
    previous_steps: Array.isArray(ticket.previous_steps) ? ticket.previous_steps : [],
  };
}

function asTicketArray(value: unknown): QueueTicket[] {
  return Array.isArray(value) ? (value as QueueTicket[]).map(normalizeTicket) : [];
}

function normalizeWorklist(worklist: Worklist): Worklist {
  return {
    ...worklist,
    waiting: asTicketArray(worklist.waiting),
    serving: asTicketArray(worklist.serving),
    served_today: worklist.served_today ?? 0,
    cancelled_today: worklist.cancelled_today ?? 0,
  };
}

// ============================================================
// Worklists
// ============================================================

export async function getMyWorklist(serviceDeliveryPointId?: number): Promise<Worklist> {
  const response = await apiClient.get<Worklist>("/queue/my-worklist", {
    params:
      serviceDeliveryPointId != null
        ? { service_delivery_point_id: serviceDeliveryPointId }
        : undefined,
  });
  return normalizeWorklist(response.data);
}

export async function getServicePointWorklist(serviceDeliveryPointId: number): Promise<Worklist> {
  const response = await apiClient.get<Worklist>(
    `/queue/service-points/${serviceDeliveryPointId}/worklist`,
  );
  return normalizeWorklist(response.data);
}

// ============================================================
// Listings
// ============================================================

export type ListServicePointTicketsParams = {
  skip?: number;
  limit?: number;
  /** Repeated `statuses=` query params (backend expects the plural key). */
  statuses?: QueueTicketStatus[];
};

export async function listServicePointTickets(
  serviceDeliveryPointId: number,
  params: ListServicePointTicketsParams = {},
): Promise<PaginatedResponse<QueueTicket>> {
  const { skip = 0, limit = 50, statuses } = params;
  const search = new URLSearchParams();
  search.set("skip", String(skip));
  search.set("limit", String(limit));
  (statuses ?? []).forEach((status) => search.append("statuses", status));

  const response = await apiClient.get<PaginatedResponse<QueueTicket>>(
    `/queue/service-points/${serviceDeliveryPointId}/tickets`,
    { params: search },
  );
  return { ...response.data, items: asTicketArray(response.data.items) };
}

export async function listVisitTickets(visitId: number): Promise<PaginatedResponse<QueueTicket>> {
  const response = await apiClient.get<PaginatedResponse<QueueTicket>>(
    `/queue/visits/${visitId}/tickets`,
  );
  return { ...response.data, items: asTicketArray(response.data.items) };
}

export async function getTicket(ticketId: number): Promise<QueueTicket> {
  const response = await apiClient.get<QueueTicket>(`/queue/tickets/${ticketId}`);
  return normalizeTicket(response.data);
}

// ============================================================
// Analytics & display board
// ============================================================

export type QueueStatsParams = {
  /** ISO 8601 window start. Defaults to start of today (UTC) server-side. */
  dateFrom?: string;
  /** ISO 8601 window end (exclusive). Defaults to end of today (UTC). */
  dateTo?: string;
};

export async function getQueueStats(params: QueueStatsParams = {}): Promise<QueueStatsResponse> {
  const response = await apiClient.get<QueueStatsResponse>("/queue/stats", {
    params: { date_from: params.dateFrom, date_to: params.dateTo },
  });
  const data = response.data;
  return { ...data, service_points: data.service_points ?? [] };
}

export async function getDisplayBoard(waitingLimit = 5): Promise<DisplayBoardResponse> {
  const response = await apiClient.get<DisplayBoardResponse>("/queue/display-board", {
    params: { waiting_limit: waitingLimit },
  });
  const data = response.data;
  return { ...data, service_points: data.service_points ?? [] };
}

// ============================================================
// Ticket actions
// ============================================================

function normalizeActionResponse(data: TicketActionResponse): TicketActionResponse {
  return { ...data, ticket: normalizeTicket(data.ticket) };
}

export async function callTicket(ticketId: number, note?: string): Promise<TicketActionResponse> {
  const response = await apiClient.post<TicketActionResponse>(
    `/queue/tickets/${ticketId}/call`,
    { note: note || undefined },
  );
  return normalizeActionResponse(response.data);
}

export async function serveTicket(ticketId: number, note?: string): Promise<TicketActionResponse> {
  const response = await apiClient.post<TicketActionResponse>(
    `/queue/tickets/${ticketId}/serve`,
    { note: note || undefined },
  );
  return normalizeActionResponse(response.data);
}

export async function completeTicket(
  ticketId: number,
  note?: string,
): Promise<TicketActionResponse> {
  const response = await apiClient.post<TicketActionResponse>(
    `/queue/tickets/${ticketId}/complete`,
    { note: note || undefined },
  );
  return normalizeActionResponse(response.data);
}

/**
 * Complete the current ticket and queue the patient at the next SDP.
 * Body: `{ target_service_delivery_point_id, notes? }` — returns the NEW ticket.
 */
export async function completeAndRouteTicket(
  ticketId: number,
  targetServiceDeliveryPointId: number,
  notes?: string,
): Promise<TicketActionResponse> {
  const response = await apiClient.post<TicketActionResponse>(
    `/queue/tickets/${ticketId}/complete-and-route`,
    {
      target_service_delivery_point_id: targetServiceDeliveryPointId,
      notes: notes || undefined,
    },
  );
  return normalizeActionResponse(response.data);
}

/**
 * Complete the current ticket and close the visit.
 * Body: `{ note? }` — the response carries the visit summary, not a ticket.
 */
export async function completeAndEndVisitTicket(
  ticketId: number,
  note?: string,
): Promise<CompleteAndEndVisitResponse> {
  const response = await apiClient.post<CompleteAndEndVisitResponse>(
    `/queue/tickets/${ticketId}/complete-and-end-visit`,
    { note: note || undefined },
  );
  return response.data;
}

export async function missTicket(ticketId: number): Promise<TicketActionResponse> {
  const response = await apiClient.post<TicketActionResponse>(`/queue/tickets/${ticketId}/miss`);
  return normalizeActionResponse(response.data);
}

export async function cancelTicket(
  ticketId: number,
  reason: string,
): Promise<TicketActionResponse> {
  const response = await apiClient.post<TicketActionResponse>(
    `/queue/tickets/${ticketId}/cancel`,
    { reason },
  );
  return normalizeActionResponse(response.data);
}

/** Transfer a misqueued ticket; returns the NEW ticket at the target SDP. */
export async function transferTicket(
  ticketId: number,
  targetServiceDeliveryPointId: number,
  reason?: string,
): Promise<TicketActionResponse> {
  const response = await apiClient.post<TicketActionResponse>(
    `/queue/tickets/${ticketId}/transfer`,
    {
      target_service_delivery_point_id: targetServiceDeliveryPointId,
      reason: reason || undefined,
    },
  );
  return normalizeActionResponse(response.data);
}


// ============================================================
// Billable services + record services rendered at the current SDP
// ============================================================

export type BillableService = {
  id: number;
  code: string;
  name: string;
  category?: string | null;
  default_price: number | string;
};

export type RecordServiceLine = {
  billable_service_id?: number | null;
  service_name?: string | null;
  service_code?: string | null;
  quantity: number | string;
  unit_price?: number | string | null;
  discount_amount?: number | string;
};

export type RecordServicesPayload = {
  service_delivery_point_id?: number | null;
  items: RecordServiceLine[];
};

export type VisitBillingSummary = {
  billing_id?: number | null;
  billing_no?: string | null;
  total_charges?: number | string;
  amount_paid?: number | string;
  outstanding?: number | string;
  items?: Array<Record<string, unknown>>;
};

export type RecordServicesResponse = {
  success: boolean;
  message: string;
  recorded: number;
  billing_summary: VisitBillingSummary;
};

/** Active billable services catalogue for the service picker. */
export async function listBillableServices(search?: string): Promise<BillableService[]> {
  const response = await apiClient.get<PaginatedResponse<BillableService>>("/billing/services", {
    params: { search: search || undefined, limit: 100 },
  });
  const data = response.data as any;
  return (data?.items ?? data?.data ?? []) as BillableService[];
}

/** Record services rendered for a visit at the current service delivery point. */
export async function recordVisitServices(
  visitId: number,
  payload: RecordServicesPayload,
): Promise<RecordServicesResponse> {
  const response = await apiClient.post<RecordServicesResponse>(
    `/billing/visits/${visitId}/record-services`,
    payload,
  );
  return response.data;
}
