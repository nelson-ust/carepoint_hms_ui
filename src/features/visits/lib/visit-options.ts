import type { DxSelectOption } from "@/components/dx";
import type { Visit } from "../api/visits.api";
import type { VisitStep } from "../api/visit-flows.api";

/** Backend `VisitStatus` values exposed to the registry filters and edit form. */
export const VISIT_STATUS_OPTIONS: DxSelectOption[] = [
  { value: "WAITING", label: "Waiting" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export const VISIT_PRIORITY_OPTIONS: DxSelectOption[] = [
  { value: "ROUTINE", label: "Routine" },
  { value: "URGENT", label: "Urgent" },
  { value: "EMERGENCY", label: "Emergency" },
];

export const VISIT_PAGE_SIZE = 20;

/** A visit is "open" when it has not been completed or cancelled. */
export function isVisitOpen(status?: string | null): boolean {
  const s = String(status ?? "").toUpperCase();
  return s !== "COMPLETED" && s !== "CANCELLED";
}

/** `YYYY-MM-DD` for today's local date — used for "completed today" stats. */
export function todayIsoDate(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function toNumberOrUndefined(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** Flow steps ordered by `step_order`. */
export function sortedFlowSteps(visit: Visit | null | undefined): VisitStep[] {
  return [...(visit?.flow_steps ?? [])].sort((a, b) => a.step_order - b.step_order);
}

/** The step the patient is currently at (mirrors the stepper's fallback logic). */
export function currentFlowStep(visit: Visit | null | undefined): VisitStep | null {
  const steps = sortedFlowSteps(visit);
  const terminal = /(COMPLETED|SKIPPED|CANCELLED)/;
  return (
    steps.find((s) => s.is_current) ??
    steps.find(
      (s) =>
        s.service_delivery_point_id === visit?.current_service_delivery_point_id &&
        !terminal.test(String(s.status).toUpperCase()),
    ) ??
    null
  );
}
