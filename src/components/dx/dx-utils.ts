import type { DxBadgeTone } from "./DxBadge";
import type { DxStepStatus } from "./DxSteps";

/** Map arbitrary backend status strings to a badge tone. */
export function statusTone(status?: string | null): DxBadgeTone {
  const s = String(status ?? "").toUpperCase();
  if (!s) return "neutral";
  if (/(COMPLETED|SERVED|FINALIZED|PAID|ACTIVE|ELIGIBLE|VERIFIED|RELEASED|DISPENSED|APPROVED|SUCCESS|DONE|NORMAL)/.test(s))
    return "success";
  if (/(WAITING|PENDING|DRAFT|PARTIAL|NEEDS_AUTH|QUEUED|COLLECTED|SCHEDULED|ORDERED|UNVERIFIED)/.test(s)) return "warning";
  if (/(CANCEL|MISSED|EXPIRED|REJECT|INELIGIBLE|FAIL|OVERDUE|CRITICAL|VOID|SUSPENDED|HIGH|ABNORMAL)/.test(s))
    return "danger";
  if (/(CALLED|SERVING|IN_PROGRESS|PROCESSING|ARRIVED|SUBMITTED|VERIFYING|IN_SERVICE)/.test(s)) return "info";
  return "neutral";
}

/** Humanise `SOME_STATUS_CODE` → `Some status code`. */
export function humanize(value?: string | null): string {
  if (!value) return "—";
  const s = String(value).split(".").pop() ?? "";
  return s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** Map a backend flow-step status string onto a stepper status. */
export function stepStatusFrom(status?: string | null, isCurrent?: boolean): DxStepStatus {
  const s = String(status ?? "").toUpperCase();
  if (isCurrent) return "current";
  if (/(COMPLETED|DONE|SERVED|FINISHED)/.test(s)) return "done";
  if (/(SKIPPED|CANCELLED|BYPASSED)/.test(s)) return "skipped";
  if (/(IN_PROGRESS|ACTIVE|CURRENT|SERVING|WAITING|CALLED)/.test(s)) return "current";
  return "pending";
}

/** `12 Mar 2026, 09:41` style formatting; returns "—" for empty/invalid. */
export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** Minutes elapsed since an ISO timestamp, as `12m` / `1h 05m`. */
export function elapsed(value?: string | null): string {
  if (!value) return "—";
  const start = new Date(value).getTime();
  if (Number.isNaN(start)) return "—";
  const minutes = Math.max(0, Math.floor((Date.now() - start) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Naira formatting with grouping; accepts numbers or numeric strings. */
export function formatNaira(value: number | string | null | undefined, opts: { compact?: boolean } = {}): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
    minimumFractionDigits: opts.compact ? 0 : 2,
    notation: opts.compact ? "compact" : "standard",
  }).format(n);
}

/** Age in whole years from a date-of-birth string. */
export function ageFrom(dob?: string | null): string {
  if (!dob) return "—";
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return `${age} yrs`;
}

/** Pull a human message out of an axios/FastAPI error. */
export function apiErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const e = err as { response?: { data?: { message?: unknown; detail?: unknown } }; message?: string } | undefined;
  const data = e?.response?.data;
  if (typeof data?.message === "string" && data.message) return data.message;
  if (typeof data?.detail === "string" && data.detail) return data.detail;
  if (Array.isArray(data?.detail)) {
    return (data.detail as Array<{ loc?: unknown[]; msg?: string }>)
      .map((d) => `${Array.isArray(d.loc) ? d.loc.slice(-1).join(".") : "field"}: ${d.msg ?? "invalid"}`)
      .join(" · ");
  }
  return e?.message || fallback;
}
