import type { LabOrder, LabOrderItem } from "../api/lab-orders.api";
import { asLabOrderItemArray } from "../api/lab-orders.api";
import type { LabResult } from "../api/lab-results.api";
import type { LabTest } from "../api/lab-tests.api";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";

// ============================================================
// Wire shapes
// ------------------------------------------------------------
// The worklist endpoint flattens a few relations (`patient_name`,
// `hospital_number`, `test_name`, `test_code`, `sample_collected_at`,
// `lab_test_catalog_id`) that the typed client models as nested objects
// (`visit.patient`, `lab_test`, `collected_at`, `lab_test_id`). The helpers
// below read whichever shape is present so the pages work against both.
// ============================================================

export type WorklistItem = LabOrderItem & {
  test_name?: string | null;
  test_code?: string | null;
  sample_collected_at?: string | null;
  lab_test_catalog_id?: number | null;
};

export type WorklistOrder = Omit<LabOrder, "items"> & {
  items: WorklistItem[] | string;
  patient_name?: string | null;
  hospital_number?: string | null;
};

export function itemsOf(order: WorklistOrder | LabOrder): WorklistItem[] {
  return asLabOrderItemArray(order.items as LabOrderItem[] | string) as WorklistItem[];
}

export function patientNameOf(order: WorklistOrder): string {
  const p = order.visit?.patient;
  const nested = p ? [p.first_name, p.last_name].filter(Boolean).join(" ") : "";
  return nested || order.patient_name?.trim() || "";
}

export function hospitalNumberOf(order: WorklistOrder): string {
  return order.visit?.patient?.hospital_number || order.hospital_number || "";
}

export function testIdOf(item: WorklistItem): number | null {
  return item.lab_test?.id ?? item.lab_test_id ?? item.lab_test_catalog_id ?? null;
}

export function testNameOf(item: WorklistItem, tests?: Map<number, LabTest>): string {
  const id = testIdOf(item);
  return item.lab_test?.name || item.test_name || (id != null ? tests?.get(id)?.name : undefined) || (id != null ? `Test #${id}` : "Test");
}

export function testCodeOf(item: WorklistItem, tests?: Map<number, LabTest>): string {
  const id = testIdOf(item);
  return item.lab_test?.code || item.test_code || (id != null ? tests?.get(id)?.code : undefined) || "";
}

export function catalogTestOf(item: WorklistItem, tests?: Map<number, LabTest>): LabTest | undefined {
  if (item.lab_test) return item.lab_test;
  const id = testIdOf(item);
  return id != null ? tests?.get(id) : undefined;
}

export function collectedAtOf(item: WorklistItem): string | undefined {
  return item.collected_at || item.sample_collected_at || undefined;
}

export function orderedAtOf(order: WorklistOrder): string {
  return order.ordered_at || order.created_at;
}

export function toTestMap(tests: LabTest[] | undefined | null): Map<number, LabTest> {
  return new Map((tests ?? []).map((t) => [t.id, t]));
}

// ============================================================
// Status vocabulary
// ------------------------------------------------------------
// Backend `OrderStatus`: ORDERED → SAMPLE_COLLECTED → IN_PROGRESS →
// RESULT_READY → COMPLETED | CANCELLED (orders and items share it). The
// legacy client vocabulary (PENDING / AWAITING_SAMPLE / COLLECTED /
// PROCESSING / PARTIAL) is accepted as an alias.
// ============================================================

export function normStatus(status?: string | null): string {
  return String(status ?? "").split(".").pop()!.trim().toUpperCase();
}

export const ORDER_STATUS_FILTERS = [
  { value: "", label: "All open orders" },
  { value: "ORDERED", label: "Ordered" },
  { value: "SAMPLE_COLLECTED", label: "Sample collected" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESULT_READY", label: "Result ready" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export const ORDER_STATUS_GRID_OPTIONS = ORDER_STATUS_FILTERS.filter((o) => o.value).map((o) => ({ value: o.value, label: o.label }));

const PENDING_ORDER = new Set(["ORDERED", "PENDING", "AWAITING_PAYMENT", "AWAITING_SAMPLE", "DRAFT"]);
const COLLECTED_ORDER = new Set(["SAMPLE_COLLECTED", "COLLECTED", "IN_PROGRESS", "PROCESSING", "PARTIAL"]);

export function isPendingOrder(status?: string | null): boolean {
  return PENDING_ORDER.has(normStatus(status));
}
export function isCollectedOrder(status?: string | null): boolean {
  return COLLECTED_ORDER.has(normStatus(status));
}
export function isClosedStatus(status?: string | null): boolean {
  const s = normStatus(status);
  return s === "COMPLETED" || s === "CANCELLED";
}
export function isResultReady(status?: string | null): boolean {
  return normStatus(status) === "RESULT_READY";
}

/** Item can have its specimen logged. */
export function canCollectItem(status?: string | null): boolean {
  const s = normStatus(status);
  return s === "ORDERED" || s === "AWAITING_SAMPLE" || s === "PENDING";
}
/** Item has a specimen and the analytical phase can start. */
export function canStartItem(status?: string | null): boolean {
  const s = normStatus(status);
  return s === "SAMPLE_COLLECTED" || s === "COLLECTED";
}
/** Item is in (or past) the analytical phase — results may exist. */
export function isResultStage(status?: string | null): boolean {
  const s = normStatus(status);
  return s === "IN_PROGRESS" || s === "PROCESSING" || s === "RESULT_READY" || s === "COMPLETED";
}

/** Order status filter applied client-side (the worklist endpoint ignores a single `status`). */
export function orderMatchesStatus(order: WorklistOrder, filter: string): boolean {
  if (!filter) return true;
  const s = normStatus(order.status);
  const f = normStatus(filter);
  if (s === f) return true;
  // Legacy aliases
  if (f === "ORDERED") return PENDING_ORDER.has(s);
  if (f === "SAMPLE_COLLECTED") return s === "COLLECTED";
  if (f === "IN_PROGRESS") return s === "PROCESSING" || s === "PARTIAL";
  return false;
}

export function sortOrdersDesc<T extends WorklistOrder>(orders: T[]): T[] {
  return [...orders].sort((a, b) => new Date(orderedAtOf(b)).getTime() - new Date(orderedAtOf(a)).getTime());
}

export function orderMatchesSearch(order: WorklistOrder, q: string, tests?: Map<number, LabTest>): boolean {
  if (!q) return true;
  const hay = [
    order.order_no,
    order.visit?.visit_code,
    patientNameOf(order),
    hospitalNumberOf(order),
    order.clinical_note,
    ...itemsOf(order).flatMap((i) => [testNameOf(i, tests), testCodeOf(i, tests), i.specimen_id]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

// ============================================================
// Date helpers
// ============================================================

/** `yyyy-mm-dd` of a timestamp in local time; "" when invalid. */
export function localDateKey(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function isToday(iso?: string | null): boolean {
  return !!iso && localDateKey(iso) === localDateKey(new Date().toISOString());
}

/** Inclusive `from`/`to` filter on the local calendar day (either bound may be ""). */
export function inDateRange(iso: string | null | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;
  const key = localDateKey(iso);
  if (!key) return false;
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}

// ============================================================
// Reference-range flagging
// ============================================================

export type RangeBounds = { low: number | null; high: number | null };
export type ResultFlag = "High" | "Low" | null;

const NUM = "(-?\\d+(?:\\.\\d+)?)";

/**
 * Parse a free-text reference range into numeric bounds. Understands
 * `12-16`, `12 – 16 g/dL`, `12 to 16`, `<5`, `≤ 5`, `>10`, `≥10`, `up to 5`.
 * Returns null when no numeric bound can be read.
 */
export function parseReferenceRange(range?: string | null): RangeBounds | null {
  if (!range) return null;
  const s = String(range).replace(/,/g, "").trim();
  let m = s.match(new RegExp(`^${NUM}\\s*(?:-|–|—|to|~)\\s*${NUM}`, "i"));
  if (m) return { low: Number(m[1]), high: Number(m[2]) };
  m = s.match(new RegExp(`^(?:<|≤|<=|up to|below|under|max(?:imum)?)\\s*${NUM}`, "i"));
  if (m) return { low: null, high: Number(m[1]) };
  m = s.match(new RegExp(`^(?:>|≥|>=|above|over|min(?:imum)?|at least)\\s*${NUM}`, "i"));
  if (m) return { low: Number(m[1]), high: null };
  return null;
}

/** Numeric part of a result value (`"13.5 g/dL"` → 13.5); null when not numeric. */
export function numericValue(value?: string | number | null): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const m = String(value).replace(/,/g, "").trim().match(new RegExp(`^${NUM}`));
  return m ? Number(m[1]) : null;
}

/** "High"/"Low" when the value falls outside the parsed reference range. */
export function resultFlag(value?: string | number | null, range?: string | null): ResultFlag {
  const n = numericValue(value);
  if (n == null) return null;
  const b = parseReferenceRange(range);
  if (!b) return null;
  if (b.high != null && n > b.high) return "High";
  if (b.low != null && n < b.low) return "Low";
  return null;
}

/** Backend `interpretation` / status hints that mark an abnormal result. */
export function flagFromResult(result?: LabResult | null): ResultFlag {
  if (!result) return null;
  return resultFlag(result.result_value, result.reference_range);
}

// ============================================================
// Result buckets (results queue)
// ============================================================

export type ResultBucket = "PENDING_ENTRY" | "ENTERED" | "VERIFIED" | "RELEASED" | "CANCELLED";

export const BUCKET_LABEL: Record<ResultBucket, string> = {
  PENDING_ENTRY: "Pending entry",
  ENTERED: "Awaiting verification",
  VERIFIED: "Awaiting release",
  RELEASED: "Released",
  CANCELLED: "Cancelled",
};

export const BUCKET_STATUS: Record<ResultBucket, string> = {
  PENDING_ENTRY: "PENDING",
  ENTERED: "ENTERED",
  VERIFIED: "VERIFIED",
  RELEASED: "RELEASED",
  CANCELLED: "CANCELLED",
};

export type ResultTab = ResultBucket | "ALL";

export const RESULT_TABS: { key: ResultTab; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING_ENTRY", label: "Pending entry" },
  { key: "ENTERED", label: "Awaiting verification" },
  { key: "VERIFIED", label: "Awaiting release" },
  { key: "RELEASED", label: "Released" },
  { key: "CANCELLED", label: "Cancelled" },
];

/** The by-item endpoint returns an `id: 0` / PENDING stub when nothing has been entered. */
export function isRealResult(result?: LabResult | null): result is LabResult {
  return !!result && result.id > 0 && !!(result.entered_at || result.result_value || result.result_text || normStatus(result.result_status) !== "PENDING");
}

/**
 * Which queue an order item sits in. Prefers the result record; falls back to
 * the item's lifecycle status (IN_PROGRESS → pending entry, RESULT_READY →
 * verified/awaiting release, COMPLETED → released).
 */
export function bucketFor(item: WorklistItem, result?: LabResult | null): ResultBucket | null {
  if (isRealResult(result)) {
    const s = normStatus(result.result_status);
    if (s === "RELEASED") return "RELEASED";
    if (s === "VERIFIED") return "VERIFIED";
    if (s === "ENTERED" || s === "DRAFT" || s === "PENDING") return "ENTERED";
    if (s === "CANCELLED") return "CANCELLED";
  }
  const s = normStatus(item.status);
  if (s === "IN_PROGRESS" || s === "PROCESSING") return "PENDING_ENTRY";
  if (s === "RESULT_READY") return "VERIFIED";
  if (s === "COMPLETED") return "RELEASED";
  return null;
}

export type ResultRow = {
  key: number;
  order: WorklistOrder;
  item: WorklistItem;
  bucket: ResultBucket;
  result?: LabResult;
  /** Most recent activity timestamp used for default ordering + date filters. */
  activityAt: string;
};

export function buildResultRows(orders: WorklistOrder[], resultsByItem: Map<number, LabResult | null>): ResultRow[] {
  const out: ResultRow[] = [];
  for (const order of orders) {
    for (const item of itemsOf(order)) {
      const embedded = item.result;
      const fetched = resultsByItem.get(item.id);
      const result = isRealResult(embedded) ? embedded : isRealResult(fetched) ? fetched : undefined;
      const bucket = bucketFor(item, result);
      if (!bucket) continue;
      out.push({
        key: item.id,
        order,
        item,
        bucket,
        result,
        activityAt: result?.released_at || result?.verified_at || result?.entered_at || item.processing_started_at || collectedAtOf(item) || item.created_at,
      });
    }
  }
  return out.sort((a, b) => new Date(b.activityAt).getTime() - new Date(a.activityAt).getTime());
}

export function rowMatchesSearch(row: ResultRow, q: string, tests?: Map<number, LabTest>): boolean {
  if (!q) return true;
  const o = row.order;
  const hay = [
    o.order_no,
    o.visit?.visit_code,
    patientNameOf(o),
    hospitalNumberOf(o),
    testNameOf(row.item, tests),
    testCodeOf(row.item, tests),
    row.item.specimen_id,
    row.result?.result_value,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

/** Apply DxGrid filter-row values (controlled mode) using per-column accessors. */
export function applyGridFilters<T>(
  rows: T[],
  filters: Record<string, string>,
  accessors: Record<string, (row: T) => string | number | boolean | null | undefined>,
  exactKeys: Set<string> = new Set(),
): T[] {
  const active = Object.entries(filters).filter(([, v]) => v !== "");
  if (!active.length) return rows;
  return rows.filter((row) =>
    active.every(([key, needle]) => {
      const acc = accessors[key];
      if (!acc) return true;
      const value = String(acc(row) ?? "").toLowerCase();
      return exactKeys.has(key) ? value === needle.toLowerCase() : value.includes(needle.toLowerCase());
    }),
  );
}

export function paginate<T>(rows: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

// ============================================================
// Session helpers
// ============================================================

export function readStoredUserId(): number | null {
  try {
    const raw = localStorageService.get(storageKeys.user);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: unknown };
    return typeof parsed?.id === "number" ? parsed.id : null;
  } catch {
    return null;
  }
}

/** The staff record matching the logged-in user, if any. */
export function currentStaffId(staff: { id: number; user_id: number }[] | undefined): number | null {
  const userId = readStoredUserId();
  if (userId == null) return null;
  return staff?.find((s) => s.user_id === userId)?.id ?? null;
}

export function staffLabel(s: { designation?: string }, name: string): string {
  return s.designation ? `${name} · ${s.designation}` : name;
}

/** Tracker status options (hospital-wide `/lab/orders/track`). */
export const TRACK_STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "ORDERED", label: "Ordered" },
  { value: "SAMPLE_COLLECTED", label: "Sample collected" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESULT_READY", label: "Result ready" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];
