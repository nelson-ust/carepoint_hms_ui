import { useEffect, useState } from "react";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock,
  Hash,
  Pill,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  asPrescriptionItemArray,
  cancelPrescription,
  createPrescription,
  listPrescriptionsForVisit,
} from "../api/prescriptions.api";
import type {
  CreatePrescriptionItemPayload,
  Prescription,
} from "../api/prescriptions.api";
import { listDrugs } from "@/features/drugs/api/drugs.api";
import type { Drug } from "@/features/drugs/api/drugs.api";

const statusStyles: Record<string, string> = {
  DRAFT: "bg-amber-50 text-amber-600 border-amber-100",
  ACTIVE: "bg-primary-50 text-primary-600 border-primary-100",
  PARTIALLY_DISPENSED: "bg-amber-50 text-amber-600 border-amber-100",
  DISPENSED: "bg-emerald-50 text-emerald-600 border-emerald-100",
  CANCELLED: "bg-rose-50 text-rose-600 border-rose-100",
};

type PrescriptionsPanelProps = {
  visitId: number;
  consultationId?: number | null;
  /** Read-only mode (e.g. when consultation is finalised) */
  disabled?: boolean;
};

type DraftItem = {
  drug_id: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  quantity: string;
  instructions: string;
};

const emptyDraftItem: DraftItem = {
  drug_id: "",
  dose: "",
  route: "PO",
  frequency: "",
  duration: "",
  quantity: "1",
  instructions: "",
};

const ROUTES = ["PO", "IV", "IM", "SC", "PR", "TOP", "INH", "SL", "OTHER"];

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

export function PrescriptionsPanel({
  visitId,
  consultationId,
  disabled,
}: PrescriptionsPanelProps) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [draftItems, setDraftItems] = useState<DraftItem[]>([{ ...emptyDraftItem }]);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [cancelTarget, setCancelTarget] = useState<Prescription | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [pres, drugsRes] = await Promise.all([
        listPrescriptionsForVisit(visitId),
        listDrugs({ skip: 0, limit: 500 }).catch(() => null),
      ]);
      setPrescriptions(
        (pres.items ?? []).sort(
          (a: Prescription, b: Prescription) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      );
      setDrugs(drugsRes?.items ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to load prescriptions.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (Number.isFinite(visitId)) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId]);

  const canCreate = !disabled && !!consultationId;

  const openCreate = () => {
    setDraftNote("");
    setDraftItems([{ ...emptyDraftItem }]);
    setCreateError(null);
    setCreateOpen(true);
  };

  const addDraftItem = () =>
    setDraftItems((prev) => [...prev, { ...emptyDraftItem }]);

  const removeDraftItem = (idx: number) =>
    setDraftItems((prev) => prev.filter((_, i) => i !== idx));

  const updateDraftItem = (idx: number, patch: Partial<DraftItem>) =>
    setDraftItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const handleCreate = async () => {
    if (!consultationId) {
      setCreateError("Active consultation required.");
      return;
    }
    const validItems = draftItems.filter((it) => it.drug_id && it.dose.trim());
    if (validItems.length === 0) {
      setCreateError("Add at least one item with a drug and dose.");
      return;
    }
    setSaving(true);
    setCreateError(null);
    try {
      const payloadItems: CreatePrescriptionItemPayload[] = validItems.map((it) => ({
        drug_id: Number(it.drug_id),
        dose: it.dose.trim(),
        route: it.route || undefined,
        frequency: it.frequency.trim() || undefined,
        duration: it.duration.trim() || undefined,
        quantity: Number(it.quantity) || 1,
        instructions: it.instructions.trim() || undefined,
      }));
      const result = await createPrescription({
        visit_id: visitId,
        consultation_id: consultationId,
        note: draftNote.trim() || undefined,
        items: payloadItems,
        auto_capture_charge: true,
      });
      setPrescriptions((prev) => [result.prescription, ...prev]);
      setCreateOpen(false);
    } catch (err: any) {
      setCreateError(err?.response?.data?.message || "Failed to create prescription.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) return;
    setCancelling(true);
    try {
      const result = await cancelPrescription(cancelTarget.id, { reason: cancelReason.trim() });
      setPrescriptions((prev) =>
        prev.map((p) => (p.id === result.prescription.id ? result.prescription : p)),
      );
      setCancelTarget(null);
      setCancelReason("");
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to cancel prescription.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="glass-card rounded-[2.5rem] p-10 md:p-12 space-y-6">
      <div className="flex items-center justify-between border-b border-secondary-400 pb-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
            <Pill className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-black font-display tracking-tight">Prescriptions</h3>
            <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.25em] mt-0.5">
              Medications Ordered During This Visit
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2.5 rounded-xl hover:bg-secondary-100"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 text-secondary-500 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          {canCreate && (
            <button
              onClick={openCreate}
              className="btn-primary gap-2 px-5 py-2.5 text-xs bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
            >
              <Plus className="h-4 w-4" />
              <span>New Prescription</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm font-bold flex-1">{error}</span>
          <button onClick={load} className="text-xs font-bold underline">
            Retry
          </button>
        </div>
      )}

      {isLoading && prescriptions.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-secondary-50 animate-pulse" />
          ))}
        </div>
      ) : prescriptions.length === 0 && !error ? (
        <div className="py-10 text-center">
          <div className="h-14 w-14 mx-auto bg-emerald-50 rounded-3xl flex items-center justify-center mb-3">
            <Pill className="h-7 w-7 text-emerald-300" />
          </div>
          <p className="text-sm text-secondary-500 font-bold">
            No prescriptions raised for this visit yet.
          </p>
          {canCreate && (
            <button onClick={openCreate} className="btn-primary mt-5 gap-2 px-5 py-2 text-xs bg-emerald-500 hover:bg-emerald-600">
              <Plus className="h-3.5 w-3.5" />
              <span>Write Prescription</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {prescriptions.map((p) => {
            const statusKey = (p.status || "DRAFT").toUpperCase();
            const statusClass = statusStyles[statusKey] ?? statusStyles.DRAFT;
            const items = asPrescriptionItemArray(p.items);
            const canCancel =
              !disabled &&
              !["DISPENSED", "CANCELLED"].includes(statusKey);
            return (
              <div
                key={p.id}
                className="rounded-2xl bg-white border border-secondary-400 p-5 hover:border-emerald-200 transition-all"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary-100 text-secondary-600 text-[10px] font-mono font-bold">
                      <Hash className="h-2.5 w-2.5" />
                      {p.prescription_no}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-widest ${statusClass}`}
                    >
                      {statusKey.replace("_", " ")}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-secondary-400 uppercase tracking-widest">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDateTime(p.prescribed_at || p.created_at)}
                    </span>
                  </div>
                  {canCancel && (
                    <button
                      onClick={() => {
                        setCancelTarget(p);
                        setCancelReason("");
                      }}
                      className="p-2 rounded-lg hover:bg-rose-50 text-rose-500"
                      title="Cancel"
                    >
                      <Ban className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {p.note && (
                  <p className="text-xs text-secondary-600 italic bg-secondary-50 border border-secondary-400 rounded-xl p-3 mb-3">
                    {p.note}
                  </p>
                )}

                {items.length === 0 ? (
                  <p className="text-[11px] text-secondary-400 font-bold uppercase tracking-widest">
                    No items
                  </p>
                ) : (
                  <div className="space-y-2">
                    {items.map((it) => {
                      const drug = it.drug || drugs.find((d) => d.id === it.drug_id);
                      return (
                        <div
                          key={it.id}
                          className="flex items-start gap-3 p-3 rounded-xl bg-secondary-50/50 border border-secondary-400"
                        >
                          <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                            <Pill className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-black text-secondary-900">
                                {drug?.name ?? `Drug #${it.drug_id}`}
                              </p>
                              {drug?.strength && (
                                <span className="text-[10px] font-bold text-secondary-500">
                                  {drug.strength}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-bold text-secondary-500 mt-0.5">
                              {it.dose} · {it.route ?? "PO"} · {it.frequency ?? "—"} ·{" "}
                              {it.duration ?? "—"} · Qty {it.quantity}
                            </p>
                            {it.instructions && (
                              <p className="text-[11px] text-secondary-500 italic mt-1">
                                {it.instructions}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {createOpen && (
        <Modal
          title="New Prescription"
          subtitle="Order Medications For This Encounter"
          onClose={() => !saving && setCreateOpen(false)}
          icon={Pill}
        >
          {createError && (
            <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-bold">{createError}</span>
            </div>
          )}
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                Clinical Note (Optional)
              </label>
              <textarea
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                placeholder="Notes for the pharmacist or context for the prescription..."
                className="input-field h-20 bg-secondary-50 border-secondary-400 w-full resize-none py-3"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                  Items
                </h4>
                <button
                  onClick={addDraftItem}
                  className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Item
                </button>
              </div>
              {draftItems.map((it, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-secondary-400 p-4 bg-secondary-50/50 space-y-3 relative"
                >
                  {draftItems.length > 1 && (
                    <button
                      onClick={() => removeDraftItem(idx)}
                      className="absolute top-3 right-3 p-1 rounded-lg hover:bg-rose-50 text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                      Drug *
                    </label>
                    <select
                      value={it.drug_id}
                      onChange={(e) => updateDraftItem(idx, { drug_id: e.target.value })}
                      className="input-field h-11 bg-white border-secondary-400 w-full"
                    >
                      <option value="">Pick a drug...</option>
                      {drugs.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} {d.strength ? `· ${d.strength}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={it.dose}
                      onChange={(e) => updateDraftItem(idx, { dose: e.target.value })}
                      placeholder="Dose (e.g. 500mg) *"
                      className="input-field h-11 bg-white border-secondary-400 w-full text-xs"
                    />
                    <select
                      value={it.route}
                      onChange={(e) => updateDraftItem(idx, { route: e.target.value })}
                      className="input-field h-11 bg-white border-secondary-400 w-full text-xs"
                    >
                      {ROUTES.map((r) => (
                        <option key={r} value={r}>
                          Route: {r}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={it.frequency}
                      onChange={(e) => updateDraftItem(idx, { frequency: e.target.value })}
                      placeholder="Frequency (TDS, BD)"
                      className="input-field h-11 bg-white border-secondary-400 w-full text-xs"
                    />
                    <input
                      type="text"
                      value={it.duration}
                      onChange={(e) => updateDraftItem(idx, { duration: e.target.value })}
                      placeholder="Duration (5 days)"
                      className="input-field h-11 bg-white border-secondary-400 w-full text-xs"
                    />
                    <input
                      type="number"
                      value={it.quantity}
                      onChange={(e) => updateDraftItem(idx, { quantity: e.target.value })}
                      placeholder="Quantity"
                      className="input-field h-11 bg-white border-secondary-400 w-full text-xs col-span-2 font-mono"
                    />
                  </div>
                  <input
                    type="text"
                    value={it.instructions}
                    onChange={(e) => updateDraftItem(idx, { instructions: e.target.value })}
                    placeholder="Instructions (after meals, with water...)"
                    className="input-field h-11 bg-white border-secondary-400 w-full text-xs"
                  />
                </div>
              ))}
            </div>

            <p className="text-[10px] text-secondary-400 font-bold uppercase tracking-widest flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Charges will be auto-captured from drug pricing
            </p>
          </div>

          <div className="pt-6 flex gap-4">
            <button
              onClick={() => setCreateOpen(false)}
              disabled={saving}
              className="flex-1 btn-secondary py-4 rounded-2xl font-bold"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex-[2] py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black tracking-tight shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Submit Prescription"}
            </button>
          </div>
        </Modal>
      )}

      {/* Cancel Modal */}
      {cancelTarget && (
        <Modal
          title="Cancel Prescription"
          subtitle="Provide A Reason"
          onClose={() => !cancelling && setCancelTarget(null)}
          icon={Ban}
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
          <div className="space-y-2 mb-6">
            <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
              Reason *
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Why is this prescription being cancelled?"
              className="input-field h-24 bg-secondary-50 border-secondary-400 w-full resize-none py-3"
            />
          </div>
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
              <Ban className="h-4 w-4" />
              {cancelling ? "Cancelling..." : "Cancel Prescription"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
  icon: Icon,
  tone = "primary",
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
  icon: typeof Pill;
  tone?: "primary" | "rose";
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6 animate-fade-in">
      <div className="bg-white rounded-[2.5rem] p-10 max-w-2xl w-full shadow-2xl relative animate-slide-up max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-3 hover:bg-secondary-50 rounded-2xl transition-all"
        >
          <X className="h-5 w-5 text-secondary-400" />
        </button>
        <div className="flex items-center gap-5 mb-8">
          <div
            className={`h-14 w-14 rounded-2xl text-white flex items-center justify-center shadow-xl ${tone === "rose"
                ? "bg-rose-500 shadow-rose-500/20"
                : "bg-emerald-500 shadow-emerald-500/20"
              }`}
          >
            <Icon className="h-6 w-6" />
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
