import { routes } from "@/config/routes";
import type { Visit } from "../api/visits.api";
import type { VisitStep } from "../api/visit-flows.api";
import type { DxStepItem } from "@/components/dx";

/** Backend `ServicePointType` enum values. */
export type ServicePointType =
  | "REGISTRATION"
  | "INSURANCE_CONFIRMATION"
  | "TRIAGE"
  | "CLINIC"
  | "LABORATORY"
  | "PHARMACY"
  | "CASHIER"
  | "RADIOLOGY"
  | "WARD"
  | "THEATRE"
  | "EMERGENCY"
  | "PROCEDURE_ROOM"
  | "OTHER";

export function normalizeSdpType(value?: string | null): ServicePointType {
  const raw = String(value ?? "").split(".").pop() ?? "";
  return (raw.trim().toUpperCase() || "OTHER") as ServicePointType;
}

/**
 * Where a member of staff "opens" a patient from the queue, by desk type.
 * Mirrors the Standard Outpatient Pathway: Registration → (HMO Desk) → Triage →
 * Consultation → Laboratory → (Radiology) → Pharmacy → Billing.
 */
export function workstationPathFor(sdpType: string | null | undefined, visitId: number): { path: string; label: string } {
  const t = normalizeSdpType(sdpType);
  switch (t) {
    case "TRIAGE":
      return { path: `${routes.triage}/${visitId}`, label: "Open Triage" };
    case "CLINIC":
    case "EMERGENCY":
    case "PROCEDURE_ROOM":
    case "WARD":
    case "THEATRE":
      return { path: `${routes.consultation}/${visitId}`, label: "Open Consultation" };
    case "INSURANCE_CONFIRMATION":
      return { path: `${routes.eligibilityConfirm}/${visitId}`, label: "Confirm Eligibility" };
    case "LABORATORY":
      return { path: `${routes.labOrders}?visit=${visitId}`, label: "Open Lab Worklist" };
    case "RADIOLOGY":
      return { path: `${routes.radiology}?visit=${visitId}`, label: "Open Radiology" };
    case "PHARMACY":
      return { path: `${routes.pharmacy}?visit=${visitId}`, label: "Open Pharmacy" };
    case "CASHIER":
      return { path: `${routes.billing}?visit=${visitId}`, label: "Open Billing" };
    case "REGISTRATION":
    default:
      return { path: routes.visitDetail.replace(":visitId", String(visitId)), label: "Open Visit" };
  }
}

/** Human label for the desk type. */
export function sdpTypeLabel(sdpType?: string | null): string {
  const t = normalizeSdpType(sdpType);
  const map: Record<ServicePointType, string> = {
    REGISTRATION: "Front Desk",
    INSURANCE_CONFIRMATION: "HMO / Insurance Desk",
    TRIAGE: "Triage",
    CLINIC: "Consultation",
    LABORATORY: "Laboratory",
    PHARMACY: "Pharmacy",
    CASHIER: "Billing & Payment",
    RADIOLOGY: "Radiology",
    WARD: "Ward",
    THEATRE: "Theatre",
    EMERGENCY: "Emergency",
    PROCEDURE_ROOM: "Procedure Room",
    OTHER: "Service Point",
  };
  return map[t];
}

/** Flow steps of a visit as stepper items (ordered by step_order). */
export function pathwaySteps(visit: Visit | null | undefined): DxStepItem[] {
  const steps: VisitStep[] = [...(visit?.flow_steps ?? [])].sort((a, b) => a.step_order - b.step_order);
  const currentSdpId = visit?.current_service_delivery_point_id;
  const anyCurrent = steps.some((s) => s.is_current);
  return steps.map((s) => {
    const status = String(s.status ?? "").toUpperCase();
    const isCurrent = anyCurrent
      ? s.is_current
      : s.service_delivery_point_id === currentSdpId && !/(COMPLETED|SKIPPED|CANCELLED)/.test(status);
    let st: DxStepItem["status"] = "pending";
    if (isCurrent) st = "current";
    else if (/(COMPLETED)/.test(status)) st = "done";
    else if (s.is_skipped || /(SKIPPED|CANCELLED)/.test(status)) st = "skipped";
    return {
      key: s.id,
      label: s.service_delivery_point?.name ?? `Step ${s.step_order}`,
      sub: !s.is_required ? "optional" : undefined,
      status: st,
    };
  });
}

/** The next pending step after the current one, if the visit follows a pathway. */
export function nextPathwayStep(visit: Visit | null | undefined): VisitStep | null {
  const steps: VisitStep[] = [...(visit?.flow_steps ?? [])].sort((a, b) => a.step_order - b.step_order);
  if (!steps.length) return null;
  const terminal = /(COMPLETED|SKIPPED|CANCELLED)/;
  const current =
    steps.find((s) => s.is_current) ??
    steps.find((s) => s.service_delivery_point_id === visit?.current_service_delivery_point_id && !terminal.test(String(s.status).toUpperCase())) ??
    null;
  const order = current?.step_order ?? -1;
  return steps.find((s) => s.step_order > order && !terminal.test(String(s.status).toUpperCase())) ?? null;
}

export function visitPriorityTone(priority?: string | null): "danger" | "warning" | "neutral" {
  const p = String(priority ?? "").toUpperCase();
  if (p === "EMERGENCY") return "danger";
  if (p === "URGENT") return "warning";
  return "neutral";
}

export function patientDisplayName(p?: { first_name?: string; last_name?: string; middle_name?: string } | null): string {
  if (!p) return "Unknown patient";
  return [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ") || "Unknown patient";
}
