import type { Prescription, PrescriptionItem } from "@/features/prescriptions/api/prescriptions.api";
import { asPrescriptionItemArray } from "@/features/prescriptions/api/prescriptions.api";
import type { StockItem } from "@/features/inventory/api/inventory.api";
import type { Staff } from "@/features/staff/api/staff.api";
import { staffDisplayName } from "@/features/staff/api/staff.api";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";
import { formatDate } from "@/components/dx";

/** Statuses that still need work at the pharmacy counter. */
export const PENDING_STATUSES = ["ACTIVE", "PARTIALLY_DISPENSED"] as const;

export function prescriptionStatus(p: Prescription): string {
  return (p.status || "ACTIVE").toUpperCase();
}

export function isPending(p: Prescription): boolean {
  return (PENDING_STATUSES as readonly string[]).includes(prescriptionStatus(p));
}

export function canDispensePrescription(p: Prescription): boolean {
  return !["DISPENSED", "CANCELLED"].includes(prescriptionStatus(p));
}

export function prescriptionItems(p: Prescription | null | undefined): PrescriptionItem[] {
  return p ? asPrescriptionItemArray(p.items) : [];
}

export function patientNameOf(p: Prescription): string {
  const pt = p.visit?.patient;
  const name = [pt?.first_name, pt?.last_name].filter(Boolean).join(" ").trim();
  return name || "Unknown patient";
}

export function drugLabel(it: PrescriptionItem): string {
  const d = it.drug;
  if (!d) return `Drug #${it.drug_id}`;
  return [d.name, d.strength].filter(Boolean).join(" ");
}

export function regimenOf(it: PrescriptionItem): string {
  return [it.dose, it.route ?? "PO", it.frequency, it.duration].filter(Boolean).join(" · ");
}

/** The logged-in user's id from local storage (used to default the dispenser). */
export function readStoredUserId(): number | null {
  try {
    const raw = localStorageService.get(storageKeys.user);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: unknown } | null;
    return typeof parsed?.id === "number" ? parsed.id : null;
  } catch {
    return null;
  }
}

export function defaultStaffIdFor(staffList: Staff[]): number | null {
  const userId = readStoredUserId();
  if (userId == null) return null;
  return staffList.find((s) => s.user_id === userId)?.id ?? null;
}

export function staffNameById(staffList: Staff[], id?: number | null): string {
  if (id == null) return "—";
  const s = staffList.find((x) => x.id === id);
  return s ? staffDisplayName(s) : `Staff #${id}`;
}

/** Stock items that can satisfy a prescription line in the chosen store (any store when none chosen). */
export function stockItemsForLine(stockItems: StockItem[], drugId: number | undefined, storeId: string): StockItem[] {
  if (drugId == null) return [];
  return stockItems
    .filter((s) => s.drug_id === drugId && (!storeId || s.store_id === Number(storeId)))
    .sort((a, b) => {
      // In-stock first, then soonest expiry (FEFO).
      const ah = (a.quantity_on_hand ?? 0) > 0 ? 0 : 1;
      const bh = (b.quantity_on_hand ?? 0) > 0 ? 0 : 1;
      if (ah !== bh) return ah - bh;
      return String(a.expiry_date ?? "9999").localeCompare(String(b.expiry_date ?? "9999"));
    });
}

/** Default stock item for a line: first with quantity on hand (matches the legacy picker). */
export function defaultStockItemFor(stockItems: StockItem[], drugId: number | undefined, storeId: string): StockItem | undefined {
  return stockItemsForLine(stockItems, drugId, storeId).find((s) => (s.quantity_on_hand ?? 0) > 0);
}

export function totalOnHand(items: StockItem[]): number {
  return items.reduce((sum, s) => sum + (s.quantity_on_hand ?? 0), 0);
}

export function stockItemOptionLabel(s: StockItem): string {
  const parts = [s.item_name];
  if (s.batch_no) parts.push(`batch ${s.batch_no}`);
  if (s.expiry_date) parts.push(`exp ${formatDate(s.expiry_date)}`);
  parts.push(`${s.quantity_on_hand ?? 0} on hand`);
  return parts.join(" · ");
}

export function isToday(value?: string | null): boolean {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export function isExpired(value?: string | null): boolean {
  if (!value) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

/** Search across prescription no., note, patient name/hospital no. and visit code. */
export function matchesSearch(p: Prescription, term: string): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  const pt = p.visit?.patient;
  return [
    p.prescription_no,
    p.note,
    pt?.first_name,
    pt?.last_name,
    pt?.hospital_number,
    p.visit?.visit_code,
  ].some((v) => v?.toLowerCase().includes(q));
}

/** Backend 400 raised when the visit has no care pathway to advance along. */
export function isNoFlowStepsError(message: string): boolean {
  return /no clinical flow steps|flow steps/i.test(message);
}
