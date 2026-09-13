import type { QueueTicketStatus } from "../api/queues.api";

/** Extract a human-readable message from an axios error envelope. */
export function apiErrorMessage(error: unknown): string {
  const err = error as { response?: { data?: { message?: string } }; message?: string };
  return err?.response?.data?.message || err?.message || "Action failed. Please retry.";
}

/** Options for the multi-status ticket filter (single Select, multi-status presets). */
export const STATUS_FILTER_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "ACTIVE", label: "Active (Waiting + Called + Serving)" },
  { value: "CLOSED", label: "Closed (Served + Missed + Cancelled + Transferred)" },
  { value: "WAITING", label: "Waiting" },
  { value: "CALLED", label: "Called" },
  { value: "SERVING", label: "Serving" },
  { value: "SERVED", label: "Served" },
  { value: "MISSED", label: "Missed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "TRANSFERRED", label: "Transferred" },
];

/** Map a filter preset to the repeated `statuses=` query params. */
export function filterToStatuses(value: string): QueueTicketStatus[] | undefined {
  if (value === "ALL") return undefined;
  if (value === "ACTIVE") return ["WAITING", "CALLED", "SERVING"];
  if (value === "CLOSED") return ["SERVED", "MISSED", "CANCELLED", "TRANSFERRED"];
  return [value as QueueTicketStatus];
}

export type ModalKind = "complete-route" | "complete-end-visit" | "cancel" | "transfer";
export type ConfirmKind = "complete" | "miss";

export const MODAL_META: Record<
  ModalKind,
  { title: string; cta: string; textLabel: string; textPlaceholder: string }
> = {
  "complete-route": {
    title: "Complete & Route",
    cta: "Complete & Route",
    textLabel: "Handover notes (optional)",
    textPlaceholder: "Anything the next service point should know…",
  },
  "complete-end-visit": {
    title: "Complete & End Visit",
    cta: "Complete & End Visit",
    textLabel: "Closing note (optional)",
    textPlaceholder: "Final note before the visit is closed…",
  },
  cancel: {
    title: "Cancel Ticket",
    cta: "Cancel Ticket",
    textLabel: "Cancellation reason (required)",
    textPlaceholder: "Why is this ticket being cancelled?",
  },
  transfer: {
    title: "Transfer Ticket",
    cta: "Transfer",
    textLabel: "Reason (optional)",
    textPlaceholder: "Why is this ticket being transferred?",
  },
};
