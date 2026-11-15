import type { QueueTicket } from "../api/queues.api";

export function ticketPatientName(ticket: QueueTicket): string {
  return ticket.patient_name?.trim() || `Patient #${ticket.patient_id}`;
}

/** "Front Desk (Registration) → Triage" style summary of the earlier stops. */
export function journeyText(ticket: QueueTicket): string {
  if (!ticket.previous_steps.length) return "First stop";
  return ticket.previous_steps
    .map((s) => `${s.service_delivery_point_name}${s.services_provided.length ? ` (${s.services_provided.join(", ")})` : ""}`)
    .join(" → ");
}
