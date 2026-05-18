import { PageHeader } from "@/components/layout/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  Boxes,
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  Hash,
  ListChecks,
  Pill,
  RefreshCw,
  Save,
  Search,
  Stethoscope,
  TrendingDown,
  User,
  X,
} from "lucide-react";
import {
  asPrescriptionFromWorklist,
  asStockAlertArray,
  getPharmacyStockAlerts,
  getPharmacyWorklist,
} from "../api/pharmacy.api";
import type { StockAlert } from "../api/pharmacy.api";
import {
  asPrescriptionItemArray,
  cancelPrescription,
} from "@/features/prescriptions/api/prescriptions.api";
import type {
  Prescription,
  PrescriptionItem,
} from "@/features/prescriptions/api/prescriptions.api";
import { createDispense } from "@/features/dispenses/api/dispenses.api";
import type { CreateDispenseItemPayload } from "@/features/dispenses/api/dispenses.api";
import { listStores, listStockItems } from "@/features/inventory/api/inventory.api";
import type { Store, StockItem } from "@/features/inventory/api/inventory.api";
import { getStaff, staffDisplayName } from "@/features/staff/api/staff.api";
import type { Staff } from "@/features/staff/api/staff.api";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";

const presStatusStyles: Record<string, string> = {
  ACTIVE: "bg-primary-50 text-primary-600 border-primary-100",
  DRAFT: "bg-amber-50 text-amber-600 border-amber-100",
  PARTIALLY_DISPENSED: "bg-amber-50 text-amber-600 border-amber-100",
  DISPENSED: "bg-emerald-50 text-emerald-600 border-emerald-100",
  CANCELLED: "bg-rose-50 text-rose-600 border-rose-100",
};

const alertStyles: Record<string, string> = {
  LOW_STOCK: "bg-amber-50 text-amber-700 border-amber-200",
  EXPIRING: "bg-amber-50 text-amber-700 border-amber-200",
  EXPIRED: "bg-rose-50 text-rose-700 border-rose-200",
  OUT_OF_STOCK: "bg-rose-50 text-rose-700 border-rose-200",
};

const alertIcon: Record<string, typeof TrendingDown> = {
  LOW_STOCK: TrendingDown,
  EXPIRING: CalendarClock,
  EXPIRED: AlertTriangle,
  OUT_OF_STOCK: AlertCircle,
};

function formatDateTime(value?: string) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function readStoredUserId(): number | null {
  try {
    const raw = localStorageService.get(storageKeys.user);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.id === "number" ? parsed.id : null;
  } catch {
    return null;
  }
}

type Tab = "WORKLIST" | "ALERTS";

export function PharmacyQueuePage() {
  const [tab, setTab] = useState<Tab>("WORKLIST");
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    { tone: "success" | "error"; message: string } | null
  >(null);

  const [search, setSearch] = useState("");

  // Dispense modal
  const [dispenseTarget, setDispenseTarget] = useState<Prescription | null>(null);
  const [dispenseStoreId, setDispenseStoreId] = useState<string>("");
  const [dispenseStaffId, setDispenseStaffId] = useState<number | null>(null);
  const [dispenseNote, setDispenseNote] = useState("");
  const [dispenseQuantities, setDispenseQuantities] = useState<Record<number, string>>({});
  const [dispenseError, setDispenseError] = useState<string | null>(null);
  const [dispensing, setDispensing] = useState(false);

  // Cancel
  const [cancelTarget, setCancelTarget] = useState<Prescription | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const showFeedback = (tone: "success" | "error", message: string) => {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 3500);
  };

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [worklist, alertsRes, storesRes, itemsRes, staffRes] = await Promise.all([
        getPharmacyWorklist().catch(() => null),
        getPharmacyStockAlerts().catch(() => null),
        listStores({ skip: 0, limit: 200 }).catch(() => null),
        listStockItems({ skip: 0, limit: 500 }).catch(() => null),
        getStaff(0, 200).catch(() => [] as Staff[]),
      ]);

      // Worklist may return { items: PrescriptionRow[] } or { items: Prescription[] }
      const rawItems = Array.isArray(worklist?.items) ? worklist.items : [];
      const presList = rawItems
        .map((row) => asPrescriptionFromWorklist(row))
        .filter((x): x is Prescription => !!x);
      setPrescriptions(presList);

      setAlerts(asStockAlertArray(alertsRes?.items));
      setStores(storesRes?.items ?? []);
      setStockItems(itemsRes?.items ?? []);
      setStaffList(Array.isArray(staffRes) ? staffRes : []);
    } catch (err: any) {
      console.error("Failed to load pharmacy worklist", err);
      setError(err?.response?.data?.message || "Unable to load pharmacy worklist.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Default the dispenser to the logged-in user's staff record once loaded
  useEffect(() => {
    if (dispenseStaffId != null) return;
    const userId = readStoredUserId();
    if (userId == null) return;
    const match = staffList.find((s) => s.user_id === userId);
    if (match) setDispenseStaffId(match.id);
  }, [staffList, dispenseStaffId]);

  const filteredPrescriptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return prescriptions;
    return prescriptions.filter(
      (p) =>
        p.prescription_no?.toLowerCase().includes(q) ||
        p.note?.toLowerCase().includes(q) ||
        p.visit?.patient?.first_name?.toLowerCase().includes(q) ||
        p.visit?.patient?.last_name?.toLowerCase().includes(q) ||
        p.visit?.visit_code?.toLowerCase().includes(q),
    );
  }, [prescriptions, search]);

  const stats = useMemo(() => {
    const total = prescriptions.length;
    const partial = prescriptions.filter(
      (p) => (p.status || "").toUpperCase() === "PARTIALLY_DISPENSED",
    ).length;
    const active = prescriptions.filter((p) => (p.status || "").toUpperCase() === "ACTIVE").length;
    const alertsCount = alerts.length;
    return { total, partial, active, alertsCount };
  }, [prescriptions, alerts]);

  // ----- Dispense -----
  const openDispense = (p: Prescription) => {
    setDispenseTarget(p);
    setDispenseStoreId(stores[0] ? String(stores[0].id) : "");
    setDispenseNote("");
    setDispenseError(null);
    const items = asPrescriptionItemArray(p.items);
    const qtyMap: Record<number, string> = {};
    items.forEach((it) => {
      qtyMap[it.id] = String(it.quantity ?? 0);
    });
    setDispenseQuantities(qtyMap);
  };

  const handleDispense = async () => {
    if (!dispenseTarget) return;
    if (!dispenseStaffId) {
      setDispenseError("Pick the dispensing staff member.");
      return;
    }
    const items = asPrescriptionItemArray(dispenseTarget.items);
    const dispenseItems: CreateDispenseItemPayload[] = [];
    for (const it of items) {
      const qty = Number(dispenseQuantities[it.id] ?? "0");
      if (!Number.isFinite(qty) || qty <= 0) continue;
      dispenseItems.push({
        prescription_item_id: it.id,
        drug_id: it.drug_id,
        quantity_dispensed: qty,
        unit_price: it.unit_price,
      });
    }

    if (dispenseItems.length === 0) {
      setDispenseError("Enter quantities for at least one item.");
      return;
    }
    setDispensing(true);
    setDispenseError(null);
    try {
      const res = await createDispense({
        prescription_id: dispenseTarget.id,
        dispensed_by_staff_id: dispenseStaffId,
        note: dispenseNote.trim() || undefined,
        items: dispenseItems,
        store_id: dispenseStoreId ? Number(dispenseStoreId) : undefined,
      });
      showFeedback("success", res.message || "Medications dispensed.");
      setDispenseTarget(null);
      load();
    } catch (err: any) {
      setDispenseError(err?.response?.data?.message || "Failed to dispense.");
    } finally {
      setDispensing(false);
    }
  };

  // ----- Cancel -----
  const handleCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      const res = await cancelPrescription(cancelTarget.id, { reason: cancelReason.trim() });
      setPrescriptions((prev) =>
        prev.map((p) => (p.id === res.prescription.id ? res.prescription : p)),
      );
      showFeedback("success", res.message || "Prescription cancelled.");
      setCancelTarget(null);
      setCancelReason("");
    } catch (err: any) {
      showFeedback("error", err?.response?.data?.message || "Failed to cancel prescription.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Pharmacy Workspace"
          description="Verify electronic prescriptions, dispense medications, and stay ahead of stock alerts."
        />
        <div className="flex items-center gap-3">
          <Link
            to="/inventory/items"
            className="btn-secondary gap-2 px-5 py-3 rounded-2xl bg-white/80 border-secondary-400"
          >
            <Boxes className="h-4 w-4" />
            <span className="text-sm font-bold">Stock</span>
          </Link>
          <Link
            to="/drugs"
            className="btn-secondary gap-2 px-5 py-3 rounded-2xl bg-white/80 border-secondary-400"
          >
            <Pill className="h-4 w-4" />
            <span className="text-sm font-bold">Drugs Catalogue</span>
          </Link>
          <button
            onClick={load}
            className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400 hover:rotate-180 transition-transform duration-500"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`px-6 py-4 rounded-2xl border flex items-center gap-3 shadow-lg animate-fade-in ${feedback.tone === "success"
              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
              : "bg-rose-50 text-rose-700 border-rose-100"
            }`}
        >
          {feedback.tone === "success" ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span className="text-sm font-bold">{feedback.message}</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={ListChecks} label="In Worklist" value={stats.total} tone="primary" />
        <StatCard icon={Stethoscope} label="Active" value={stats.active} tone="primary" />
        <StatCard icon={Clock} label="Partial" value={stats.partial} tone="amber" />
        <StatCard icon={AlertTriangle} label="Stock Alerts" value={stats.alertsCount} tone="rose" />
      </div>

      {/* Tabs */}
      <div className="glass-card rounded-[2rem] p-3 flex flex-col gap-3 bg-white/40 backdrop-blur-md">
        <div className="flex gap-2">
          {(["WORKLIST", "ALERTS"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${tab === t
                  ? "bg-slate-900 text-white shadow-md"
                  : "bg-white/60 text-secondary-600 hover:bg-white"
                }`}
            >
              {t === "WORKLIST" ? <ListChecks className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              {t === "WORKLIST" ? "Prescriptions" : "Stock Alerts"}
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${tab === t ? "bg-white/20" : "bg-secondary-100 text-secondary-500"
                  }`}
              >
                {t === "WORKLIST" ? prescriptions.length : alerts.length}
              </span>
            </button>
          ))}
        </div>
        {tab === "WORKLIST" && (
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by prescription #, patient, visit..."
              className="w-full bg-white/50 border-none rounded-2xl pl-14 pr-6 py-3.5 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
            />
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card rounded-[2rem] h-32 animate-pulse bg-white/40" />
          ))}
        </div>
      ) : error ? (
        <div className="glass-card rounded-[2.5rem] p-16 text-center max-w-md mx-auto">
          <AlertCircle className="h-12 w-12 mx-auto text-rose-500/50 mb-4" />
          <p className="text-secondary-600 font-bold mb-4">{error}</p>
          <button onClick={load} className="btn-primary py-3 px-8">
            Try Again
          </button>
        </div>
      ) : tab === "WORKLIST" ? (
        filteredPrescriptions.length === 0 ? (
          <div className="glass-card rounded-[2.5rem] p-16 text-center max-w-md mx-auto">
            <div className="h-20 w-20 bg-secondary-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Pill className="h-10 w-10 text-secondary-200" />
            </div>
            <h4 className="text-xl font-bold text-secondary-900">No Prescriptions in Worklist</h4>
            <p className="text-sm text-secondary-500 mt-2">
              {prescriptions.length === 0
                ? "All caught up — incoming prescriptions will appear here."
                : "No prescriptions match your search."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPrescriptions.map((p) => (
              <PrescriptionCard
                key={p.id}
                prescription={p}
                onDispense={() => openDispense(p)}
                onCancel={() => {
                  setCancelTarget(p);
                  setCancelReason("");
                }}
              />
            ))}
          </div>
        )
      ) : alerts.length === 0 ? (
        <div className="glass-card rounded-[2.5rem] p-16 text-center max-w-md mx-auto">
          <div className="h-20 w-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-10 w-10 text-emerald-300" />
          </div>
          <h4 className="text-xl font-bold text-secondary-900">No Stock Alerts</h4>
          <p className="text-sm text-secondary-500 mt-2">
            All stock levels are healthy and nothing is expiring soon.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {alerts.map((a, idx) => {
            const Icon = alertIcon[a.alert_type] ?? AlertTriangle;
            const cls = alertStyles[a.alert_type] ?? alertStyles.LOW_STOCK;
            return (
              <div
                key={`${a.stock_item_id}-${idx}`}
                className={`rounded-[2rem] p-6 border ${cls}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="h-11 w-11 rounded-xl bg-white/60 flex items-center justify-center shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-md bg-white/60 text-[10px] font-bold uppercase tracking-widest">
                    {a.alert_type.replace("_", " ")}
                  </span>
                </div>
                <p className="text-sm font-black mb-1">
                  {a.stock_item?.item_name ?? `Stock Item #${a.stock_item_id}`}
                </p>
                <p className="text-[11px] font-bold opacity-75 mb-3">
                  {a.store_name ?? a.stock_item?.store?.name ?? "Unknown store"}
                </p>
                <div className="space-y-1 text-[11px] font-bold">
                  {a.quantity_on_hand != null && (
                    <p>
                      Qty: <span className="font-mono">{a.quantity_on_hand}</span>
                    </p>
                  )}
                  {a.reorder_level != null && (
                    <p>
                      Reorder @ <span className="font-mono">{a.reorder_level}</span>
                    </p>
                  )}
                  {a.expiry_date && (
                    <p>
                      Exp:{" "}
                      <span className="font-mono">
                        {new Date(a.expiry_date).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dispense modal */}
      {dispenseTarget && (
        <DispenseModal
          prescription={dispenseTarget}
          quantities={dispenseQuantities}
          onQuantitiesChange={setDispenseQuantities}
          storeId={dispenseStoreId}
          onStoreIdChange={setDispenseStoreId}
          stores={stores}
          stockItems={stockItems}
          staffId={dispenseStaffId}
          onStaffIdChange={setDispenseStaffId}
          staffList={staffList}
          note={dispenseNote}
          onNoteChange={setDispenseNote}
          pending={dispensing}
          error={dispenseError}
          onClose={() => !dispensing && setDispenseTarget(null)}
          onSubmit={handleDispense}
        />
      )}

      {/* Cancel modal */}
      {cancelTarget && (
        <Modal
          title="Cancel Prescription"
          subtitle="Provide A Reason"
          onClose={() => !cancelling && setCancelTarget(null)}
          tone="rose"
        >
          <div className="mb-5 p-4 rounded-2xl bg-secondary-50 border border-secondary-400">
            <p className="text-[10px] font-mono font-bold text-secondary-400 uppercase mb-1">
              {cancelTarget.prescription_no}
            </p>
            <p className="text-sm font-bold text-secondary-900">
              {asPrescriptionItemArray(cancelTarget.items).length} items
            </p>
          </div>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Why is this prescription being cancelled?"
            className="input-field h-24 bg-secondary-50 border-secondary-400 w-full resize-none py-3 mb-6"
          />
          <div className="flex gap-4">
            <button
              onClick={() => setCancelTarget(null)}
              disabled={cancelling}
              className="flex-1 btn-secondary py-4 rounded-2xl font-bold"
            >
              Close
            </button>
            <button
              onClick={handleCancel}
              disabled={cancelling || !cancelReason.trim()}
              className="flex-[2] py-4 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-black tracking-tight shadow-xl shadow-rose-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {cancelling ? "Cancelling..." : "Cancel Prescription"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function PrescriptionCard({
  prescription,
  onDispense,
  onCancel,
}: {
  prescription: Prescription;
  onDispense: () => void;
  onCancel: () => void;
}) {
  const statusKey = (prescription.status || "ACTIVE").toUpperCase();
  const statusClass = presStatusStyles[statusKey] ?? presStatusStyles.ACTIVE;
  const items = asPrescriptionItemArray(prescription.items);
  const canDispense = !["DISPENSED", "CANCELLED"].includes(statusKey);

  return (
    <div className="glass-card rounded-[2rem] p-7 bg-white border border-secondary-400 hover:border-emerald-200 transition-all">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md">
            <Pill className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary-100 text-secondary-600 text-[10px] font-mono font-bold">
                <Hash className="h-2.5 w-2.5" />
                {prescription.prescription_no}
              </span>
              <span
                className={`px-3 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-widest ${statusClass}`}
              >
                {statusKey.replace("_", " ")}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-[11px] font-bold text-secondary-500 flex-wrap">
              {prescription.visit?.patient && (
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-3 w-3" />
                  {prescription.visit.patient.first_name} {prescription.visit.patient.last_name}
                </span>
              )}
              {prescription.visit?.visit_code && (
                <Link
                  to={`/visits/${prescription.visit_id}`}
                  className="inline-flex items-center gap-1 font-mono hover:text-primary-500"
                >
                  {prescription.visit.visit_code}
                  <ExternalLink className="h-2.5 w-2.5" />
                </Link>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {formatDateTime(prescription.prescribed_at || prescription.created_at)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canDispense && (
            <button
              onClick={onDispense}
              className="btn-primary gap-2 px-5 py-2.5 text-xs bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
            >
              <Pill className="h-3.5 w-3.5" />
              Dispense
            </button>
          )}
          {canDispense && (
            <button
              onClick={onCancel}
              className="p-2.5 hover:bg-rose-50 text-rose-500 rounded-xl transition-all"
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {prescription.note && (
        <p className="text-xs text-secondary-600 italic bg-amber-50/50 border border-amber-100 rounded-xl p-3 mb-3">
          {prescription.note}
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((it: PrescriptionItem) => (
          <div
            key={it.id}
            className="flex items-start gap-3 p-3 rounded-xl bg-secondary-50/50 border border-secondary-400"
          >
            <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Pill className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-secondary-900 truncate">
                {it.drug?.name ?? `Drug #${it.drug_id}`}
              </p>
              <p className="text-[11px] font-bold text-secondary-500 mt-0.5">
                {it.dose} · {it.route ?? "PO"} · {it.frequency ?? "—"} · Qty {it.quantity}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DispenseModal({
  prescription,
  quantities,
  onQuantitiesChange,
  storeId,
  onStoreIdChange,
  stores,
  stockItems,
  staffId,
  onStaffIdChange,
  staffList,
  note,
  onNoteChange,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  prescription: Prescription;
  quantities: Record<number, string>;
  onQuantitiesChange: (q: Record<number, string>) => void;
  storeId: string;
  onStoreIdChange: (s: string) => void;
  stores: Store[];
  stockItems: StockItem[];
  staffId: number | null;
  onStaffIdChange: (s: number | null) => void;
  staffList: Staff[];
  note: string;
  onNoteChange: (n: string) => void;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const items = asPrescriptionItemArray(prescription.items);

  const findStockFor = (drugId?: number) =>
    stockItems.find(
      (s) =>
        s.drug_id === drugId &&
        (!storeId || s.store_id === Number(storeId)) &&
        (s.quantity_on_hand ?? 0) > 0,
    );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6 animate-fade-in">
      <div className="bg-white rounded-[2.5rem] p-10 max-w-2xl w-full shadow-2xl relative animate-slide-up max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          disabled={pending}
          className="absolute top-6 right-6 p-3 hover:bg-secondary-50 rounded-2xl transition-all"
        >
          <X className="h-5 w-5 text-secondary-400" />
        </button>
        <div className="flex items-center gap-5 mb-8">
          <div className="h-14 w-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-500/20">
            <Pill className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-black font-display tracking-tight">Dispense Medication</h3>
            <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
              Verify And Fulfil The Prescription
            </p>
          </div>
        </div>

        <div className="mb-6 p-4 rounded-2xl bg-secondary-50 border border-secondary-400">
          <p className="text-[10px] font-mono font-bold text-secondary-400 uppercase mb-1">
            {prescription.prescription_no}
          </p>
          {prescription.visit?.patient && (
            <p className="text-sm font-bold text-secondary-900">
              {prescription.visit.patient.first_name} {prescription.visit.patient.last_name}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm font-bold">{error}</span>
          </div>
        )}

        <div className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                Pharmacy Store
              </label>
              <select
                value={storeId}
                onChange={(e) => onStoreIdChange(e.target.value)}
                className="input-field h-12 bg-secondary-50 border-secondary-400 w-full"
              >
                <option value="">— No store linkage —</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                Dispensed By *
              </label>
              <select
                value={staffId ?? ""}
                onChange={(e) => onStaffIdChange(e.target.value ? Number(e.target.value) : null)}
                className="input-field h-12 bg-secondary-50 border-secondary-400 w-full"
              >
                <option value="">Pick pharmacist...</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {staffDisplayName(s)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
              Items
            </h4>
            {items.map((it) => {
              const stock = findStockFor(it.drug_id);
              const qtyRequested = it.quantity ?? 0;
              const onHand = stock?.quantity_on_hand ?? 0;
              return (
                <div
                  key={it.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-secondary-50 border border-secondary-400"
                >
                  <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Pill className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-secondary-900 truncate">
                      {it.drug?.name ?? `Drug #${it.drug_id}`}
                    </p>
                    <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mt-0.5">
                      Requested {qtyRequested} · On hand {onHand}
                    </p>
                  </div>
                  <input
                    type="number"
                    step="any"
                    value={quantities[it.id] ?? "0"}
                    onChange={(e) =>
                      onQuantitiesChange({ ...quantities, [it.id]: e.target.value })
                    }
                    placeholder="Qty"
                    className="w-20 h-10 rounded-lg bg-white border border-secondary-200 text-center font-mono text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
              Note (Optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Counselling notes, substitution rationale..."
              className="input-field h-20 bg-secondary-50 border-secondary-400 w-full resize-none py-3"
            />
          </div>
        </div>

        <div className="pt-6 flex gap-4">
          <button
            onClick={onClose}
            disabled={pending}
            className="flex-1 btn-secondary py-4 rounded-2xl font-bold"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={pending}
            className="flex-[2] py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black tracking-tight shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {pending ? "Dispensing..." : "Dispense"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
  tone = "primary",
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
  tone?: "primary" | "rose";
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6 animate-fade-in">
      <div className="bg-white rounded-[2.5rem] p-10 max-w-xl w-full shadow-2xl relative animate-slide-up max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-3 hover:bg-secondary-50 rounded-2xl transition-all"
        >
          <X className="h-5 w-5 text-secondary-400" />
        </button>
        <div className="flex items-center gap-5 mb-8">
          <div
            className={`h-14 w-14 rounded-2xl text-white flex items-center justify-center shadow-xl ${tone === "rose" ? "bg-rose-500 shadow-rose-500/20" : "bg-emerald-500 shadow-emerald-500/20"
              }`}
          >
            {tone === "rose" ? <X className="h-6 w-6" /> : <Pill className="h-6 w-6" />}
          </div>
          <div>
            <h3 className="text-xl font-black font-display tracking-tight">{title}</h3>
            <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
              {subtitle}
            </p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

type StatTone = "primary" | "emerald" | "amber" | "rose";
const statToneStyles: Record<StatTone, string> = {
  primary: "bg-primary-50 text-primary-600 border-primary-100",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  amber: "bg-amber-50 text-amber-600 border-amber-100",
  rose: "bg-rose-50 text-rose-600 border-rose-100",
};
function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Pill;
  label: string;
  value: number;
  tone: StatTone;
}) {
  return (
    <div className={`glass-card rounded-[2rem] p-6 border ${statToneStyles[tone]} bg-white/60 backdrop-blur-md`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</span>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-3xl font-black tracking-tight">{value}</div>
    </div>
  );
}
