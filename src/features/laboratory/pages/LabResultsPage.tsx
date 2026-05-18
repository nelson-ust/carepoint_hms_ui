import { PageHeader } from "@/components/layout/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Ban,
  Beaker,
  Bell,
  CheckCircle2,
  CheckCircle as CheckCircle2Outline,
  ClipboardCheck,
  Clock,
  Edit3,
  ExternalLink,
  FileSignature,
  FileText,
  FlaskConical,
  Hash,
  Layers,
  RefreshCw,
  Save,
  Search,
  Send,
  Sigma,
  TestTube2,
  User,
  X,
} from "lucide-react";
import { asLabOrderItemArray, listLabWorklist } from "../api/lab-orders.api";
import type { LabOrder, LabOrderItem } from "../api/lab-orders.api";
import {
  cancelLabResult,
  enterLabResult,
  releaseLabResult,
  updateLabResult,
  verifyLabResult,
} from "../api/lab-results.api";
import type { LabResult } from "../api/lab-results.api";
import {
  getStaff,
  staffDisplayName,
  staffLastName,
} from "@/features/staff/api/staff.api";
import type { Staff } from "@/features/staff/api/staff.api";
import {
  listActiveServiceDeliveryPoints,
} from "@/features/service-delivery-points/api/service-delivery-points.api";
import type { ServiceDeliveryPoint } from "@/features/service-delivery-points/api/service-delivery-points.api";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";

// ==============================================================
// Types
// ==============================================================

type ResultBucket =
  | "PENDING_ENTRY"
  | "ENTERED"
  | "VERIFIED"
  | "RELEASED"
  | "CANCELLED";

type Row = {
  order: LabOrder;
  item: LabOrderItem;
  bucket: ResultBucket;
  result?: LabResult;
};

type ActionKind =
  | "enter"
  | "update"
  | "verify"
  | "release"
  | "cancel"
  | null;

const bucketStyles: Record<ResultBucket, string> = {
  PENDING_ENTRY: "bg-amber-50 text-amber-600 border-amber-100",
  ENTERED: "bg-primary-50 text-primary-600 border-primary-100",
  VERIFIED: "bg-emerald-50 text-emerald-600 border-emerald-100",
  RELEASED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-rose-50 text-rose-600 border-rose-100",
};

const bucketLabel: Record<ResultBucket, string> = {
  PENDING_ENTRY: "Pending Entry",
  ENTERED: "Entered",
  VERIFIED: "Verified",
  RELEASED: "Released",
  CANCELLED: "Cancelled",
};

const TABS: { value: ResultBucket | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING_ENTRY", label: "Pending Entry" },
  { value: "ENTERED", label: "Awaiting Verification" },
  { value: "VERIFIED", label: "Awaiting Release" },
  { value: "RELEASED", label: "Released" },
  { value: "CANCELLED", label: "Cancelled" },
];

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

function bucketOf(item: LabOrderItem): ResultBucket | null {
  const result = item.result;
  if (result) {
    const status = (result.result_status || "").toUpperCase();
    if (status === "RELEASED") return "RELEASED";
    if (status === "VERIFIED") return "VERIFIED";
    if (status === "ENTERED" || status === "DRAFT") return "ENTERED";
    if (status === "CANCELLED") return "CANCELLED";
  }
  const itemStatus = (item.status || "").toUpperCase();
  // Items that are PROCESSING or COMPLETED but have no result yet → pending entry
  if (itemStatus === "PROCESSING" || itemStatus === "COMPLETED") return "PENDING_ENTRY";
  return null;
}

// ==============================================================
// Form types
// ==============================================================

type EntryForm = {
  result_value: string;
  result_text: string;
  unit_of_measure: string;
  reference_range: string;
  interpretation: string;
  entered_by_staff_id: number | null;
};

const emptyEntryForm: EntryForm = {
  result_value: "",
  result_text: "",
  unit_of_measure: "",
  reference_range: "",
  interpretation: "",
  entered_by_staff_id: null,
};

type VerifyForm = {
  verified_by_staff_id: number | null;
  verification_note: string;
};

type ReleaseForm = {
  release_note: string;
  notify_clinician: boolean;
  route_to_service_delivery_point_id: number | null;
};

// ==============================================================
// Page
// ==============================================================

export function LabResultsPage() {
  const location = useLocation();
  const focusItemId = (location.state as { focusItemId?: number } | null)?.focusItemId;

  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [sdps, setSdps] = useState<ServiceDeliveryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    { tone: "success" | "error"; message: string } | null
  >(null);

  const [tab, setTab] = useState<ResultBucket | "ALL">(
    focusItemId ? "PENDING_ENTRY" : "PENDING_ENTRY",
  );
  const [search, setSearch] = useState("");

  // Action modal state
  const [actionKind, setActionKind] = useState<ActionKind>(null);
  const [actionRow, setActionRow] = useState<Row | null>(null);
  const [entryForm, setEntryForm] = useState<EntryForm>(emptyEntryForm);
  const [verifyForm, setVerifyForm] = useState<VerifyForm>({
    verified_by_staff_id: null,
    verification_note: "",
  });
  const [releaseForm, setReleaseForm] = useState<ReleaseForm>({
    release_note: "",
    notify_clinician: true,
    route_to_service_delivery_point_id: null,
  });
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const showFeedback = (tone: "success" | "error", message: string) => {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 3500);
  };

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [worklist, staff, sdpData] = await Promise.all([
        listLabWorklist({ skip: 0, limit: 200 }),
        getStaff(0, 200).catch(() => [] as Staff[]),
        listActiveServiceDeliveryPoints({ skip: 0, limit: 200 }).catch(() => null),
      ]);
      const items = Array.isArray(worklist?.items) ? worklist.items : [];
      setOrders(items);
      setStaffList(Array.isArray(staff) ? staff : []);
      setSdps(sdpData?.items ?? []);
    } catch (err: any) {
      console.error("Failed to load lab results queue", err);
      setError(err?.response?.data?.message || "Unable to load results queue.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Auto-default the staff IDs in modals to the logged-in user where possible.
  useEffect(() => {
    const userId = readStoredUserId();
    if (userId == null) return;
    const match = staffList.find((s) => s.user_id === userId);
    if (!match) return;
    setEntryForm((prev) =>
      prev.entered_by_staff_id == null ? { ...prev, entered_by_staff_id: match.id } : prev,
    );
    setVerifyForm((prev) =>
      prev.verified_by_staff_id == null ? { ...prev, verified_by_staff_id: match.id } : prev,
    );
  }, [staffList]);

  // Flatten orders → rows of (order, item, bucket).
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const order of orders) {
      const items = asLabOrderItemArray(order.items);
      for (const item of items) {
        const bucket = bucketOf(item);
        if (!bucket) continue;
        out.push({ order, item, bucket, result: item.result });
      }
    }
    return out.sort((a, b) => {
      const aTime = new Date(
        a.result?.entered_at || a.item.processing_started_at || a.item.created_at,
      ).getTime();
      const bTime = new Date(
        b.result?.entered_at || b.item.processing_started_at || b.item.created_at,
      ).getTime();
      return bTime - aTime;
    });
  }, [orders]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab !== "ALL" && r.bucket !== tab) return false;
      if (!q) return true;
      const o = r.order;
      return (
        o.order_no?.toLowerCase().includes(q) ||
        o.visit?.visit_code?.toLowerCase().includes(q) ||
        o.visit?.patient?.first_name?.toLowerCase().includes(q) ||
        o.visit?.patient?.last_name?.toLowerCase().includes(q) ||
        o.visit?.patient?.hospital_number?.toLowerCase().includes(q) ||
        r.item.lab_test?.name?.toLowerCase().includes(q) ||
        r.item.lab_test?.code?.toLowerCase().includes(q) ||
        r.item.specimen_id?.toLowerCase().includes(q)
      );
    });
  }, [rows, tab, search]);

  const counts = useMemo(() => {
    const map: Record<ResultBucket, number> = {
      PENDING_ENTRY: 0,
      ENTERED: 0,
      VERIFIED: 0,
      RELEASED: 0,
      CANCELLED: 0,
    };
    rows.forEach((r) => {
      map[r.bucket]++;
    });
    return map;
  }, [rows]);

  // ----- Apply an updated item back into orders state -----
  const replaceResult = (itemId: number, nextResult: LabResult) => {
    setOrders((prev) =>
      prev.map((order) => {
        const items = asLabOrderItemArray(order.items);
        if (!items.some((i) => i.id === itemId)) return order;
        const newItems = items.map((i) =>
          i.id === itemId ? { ...i, result: nextResult } : i,
        );
        return { ...order, items: newItems };
      }),
    );
  };

  // ----- Open modals -----
  const openEnter = (row: Row) => {
    const test = row.item.lab_test;
    setActionKind("enter");
    setActionRow(row);
    setEntryForm((prev) => ({
      ...emptyEntryForm,
      entered_by_staff_id: prev.entered_by_staff_id,
      unit_of_measure: test?.unit_of_measure ?? "",
      reference_range: test?.reference_range ?? "",
    }));
    setActionError(null);
  };

  const openUpdate = (row: Row) => {
    if (!row.result) return;
    setActionKind("update");
    setActionRow(row);
    setEntryForm({
      result_value: row.result.result_value ?? "",
      result_text: row.result.result_text ?? "",
      unit_of_measure: row.result.unit_of_measure ?? "",
      reference_range: row.result.reference_range ?? "",
      interpretation: row.result.interpretation ?? "",
      entered_by_staff_id: row.result.entered_by_staff_id ?? null,
    });
    setActionError(null);
  };

  const openVerify = (row: Row) => {
    setActionKind("verify");
    setActionRow(row);
    setVerifyForm((prev) => ({
      verified_by_staff_id: prev.verified_by_staff_id,
      verification_note: "",
    }));
    setActionError(null);
  };

  const openRelease = (row: Row) => {
    setActionKind("release");
    setActionRow(row);
    setReleaseForm({
      release_note: "",
      notify_clinician: true,
      route_to_service_delivery_point_id: null,
    });
    setActionError(null);
  };

  const openCancel = (row: Row) => {
    setActionKind("cancel");
    setActionRow(row);
    setActionError(null);
  };

  const closeAction = () => {
    if (actionPending) return;
    setActionKind(null);
    setActionRow(null);
    setActionError(null);
  };

  const handleSubmitAction = async () => {
    if (!actionKind || !actionRow) return;
    setActionPending(true);
    setActionError(null);
    try {
      if (actionKind === "enter") {
        if (!entryForm.entered_by_staff_id) {
          setActionError("Pick the staff member entering the result.");
          setActionPending(false);
          return;
        }
        if (!entryForm.result_value.trim() && !entryForm.result_text.trim()) {
          setActionError("Provide a result value or descriptive text.");
          setActionPending(false);
          return;
        }
        const res = await enterLabResult({
          lab_order_item_id: actionRow.item.id,
          entered_by_staff_id: entryForm.entered_by_staff_id,
          result_value: entryForm.result_value.trim() || undefined,
          result_text: entryForm.result_text.trim() || undefined,
          unit_of_measure: entryForm.unit_of_measure.trim() || undefined,
          reference_range: entryForm.reference_range.trim() || undefined,
          interpretation: entryForm.interpretation.trim() || undefined,
        });
        replaceResult(actionRow.item.id, res.result);
        showFeedback("success", res.message || "Result entered.");
      } else if (actionKind === "update") {
        if (!actionRow.result) return;
        const res = await updateLabResult(actionRow.result.id, {
          result_value: entryForm.result_value.trim() || undefined,
          result_text: entryForm.result_text.trim() || undefined,
          unit_of_measure: entryForm.unit_of_measure.trim() || undefined,
          reference_range: entryForm.reference_range.trim() || undefined,
          interpretation: entryForm.interpretation.trim() || undefined,
        });
        replaceResult(actionRow.item.id, res.result);
        showFeedback("success", res.message || "Result updated.");
      } else if (actionKind === "verify") {
        if (!actionRow.result) return;
        if (!verifyForm.verified_by_staff_id) {
          setActionError("Pick the verifier.");
          setActionPending(false);
          return;
        }
        const res = await verifyLabResult(actionRow.result.id, {
          verified_by_staff_id: verifyForm.verified_by_staff_id,
          verification_note: verifyForm.verification_note.trim() || undefined,
        });
        replaceResult(actionRow.item.id, res.result);
        showFeedback("success", res.message || "Result verified.");
      } else if (actionKind === "release") {
        if (!actionRow.result) return;
        const res = await releaseLabResult(actionRow.result.id, {
          release_note: releaseForm.release_note.trim() || undefined,
          notify_clinician: releaseForm.notify_clinician,
          route_to_service_delivery_point_id:
            releaseForm.route_to_service_delivery_point_id ?? undefined,
        });
        replaceResult(actionRow.item.id, res.result);
        showFeedback("success", res.message || "Result released.");
      } else if (actionKind === "cancel") {
        if (!actionRow.result) return;
        const res = await cancelLabResult(actionRow.result.id);
        replaceResult(actionRow.item.id, res.result);
        showFeedback("success", res.message || "Result cancelled.");
      }
      setActionKind(null);
      setActionRow(null);
    } catch (err: any) {
      setActionError(err?.response?.data?.message || "Action failed. Please retry.");
    } finally {
      setActionPending(false);
    }
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Laboratory Results Queue"
          description="Enter, verify, release, and audit lab results — every state transition logged."
        />
        <div className="flex items-center gap-3">
          <Link
            to="/laboratory/orders"
            className="btn-secondary gap-2 px-5 py-3 rounded-2xl bg-white/80 border-secondary-400"
          >
            <FlaskConical className="h-4 w-4" />
            <span className="text-sm font-bold">Worklist</span>
          </Link>
          <Link
            to="/laboratory/tests"
            className="btn-secondary gap-2 px-5 py-3 rounded-2xl bg-white/80 border-secondary-400"
          >
            <Layers className="h-4 w-4" />
            <span className="text-sm font-bold">Tests Catalogue</span>
          </Link>
          <button
            onClick={load}
            className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400 hover:rotate-180 transition-transform duration-500"
            title="Refresh"
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
          {feedback.tone === "success" ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <span className="text-sm font-bold">{feedback.message}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <StatCard icon={Edit3} label="Pending Entry" value={counts.PENDING_ENTRY} tone="amber" />
        <StatCard icon={ClipboardCheck} label="Awaiting Verify" value={counts.ENTERED} tone="primary" />
        <StatCard icon={FileSignature} label="Awaiting Release" value={counts.VERIFIED} tone="emerald" />
        <StatCard icon={Send} label="Released" value={counts.RELEASED} tone="emerald" />
        <StatCard icon={Ban} label="Cancelled" value={counts.CANCELLED} tone="rose" />
      </div>

      {/* Tabs + search */}
      <div className="glass-card rounded-[2rem] p-3 flex flex-col gap-3 bg-white/40 backdrop-blur-md">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => {
            const isActive = tab === t.value;
            const c = t.value === "ALL" ? rows.length : counts[t.value];
            return (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${isActive
                    ? "bg-slate-900 text-white shadow-md"
                    : "bg-white/60 text-secondary-600 hover:bg-white"
                  }`}
              >
                {t.label}
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${isActive ? "bg-white/20" : "bg-secondary-100 text-secondary-500"
                    }`}
                >
                  {c}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient, order #, test, or specimen ID..."
            className="w-full bg-white/50 border-none rounded-2xl pl-14 pr-6 py-3.5 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
          />
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="glass-card rounded-[2rem] p-6 h-32 animate-pulse bg-white/40"
            />
          ))
        ) : error ? (
          <div className="glass-card rounded-[2.5rem] p-16 text-center max-w-md mx-auto">
            <AlertCircle className="h-12 w-12 mx-auto text-rose-500/50 mb-4" />
            <p className="text-secondary-600 font-bold mb-4">{error}</p>
            <button onClick={load} className="btn-primary py-3 px-8">
              Try Again
            </button>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="glass-card rounded-[2.5rem] p-16 text-center max-w-lg mx-auto">
            <div className="h-20 w-20 bg-secondary-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Beaker className="h-10 w-10 text-secondary-200" />
            </div>
            <h4 className="text-xl font-bold text-secondary-900">No Results in This Bucket</h4>
            <p className="text-sm text-secondary-500 mt-2">
              {tab === "ALL"
                ? "Once specimens are processed, results will appear here for entry, verification and release."
                : `Nothing in the ${bucketLabel[tab as ResultBucket].toLowerCase()} queue right now.`}
            </p>
          </div>
        ) : (
          filteredRows.map((row) => (
            <ResultRow
              key={row.item.id}
              row={row}
              focused={focusItemId === row.item.id}
              staffList={staffList}
              onEnter={() => openEnter(row)}
              onUpdate={() => openUpdate(row)}
              onVerify={() => openVerify(row)}
              onRelease={() => openRelease(row)}
              onCancel={() => openCancel(row)}
            />
          ))
        )}
      </div>

      {/* Action Modal */}
      {actionKind && actionRow && (
        <ActionModal
          kind={actionKind}
          row={actionRow}
          entryForm={entryForm}
          onEntryFormChange={setEntryForm}
          verifyForm={verifyForm}
          onVerifyFormChange={setVerifyForm}
          releaseForm={releaseForm}
          onReleaseFormChange={setReleaseForm}
          staffList={staffList}
          sdps={sdps}
          pending={actionPending}
          error={actionError}
          onClose={closeAction}
          onSubmit={handleSubmitAction}
        />
      )}
    </div>
  );
}

// ==============================================================
// Result Row
// ==============================================================

function ResultRow({
  row,
  focused,
  staffList,
  onEnter,
  onUpdate,
  onVerify,
  onRelease,
  onCancel,
}: {
  row: Row;
  focused: boolean;
  staffList: Staff[];
  onEnter: () => void;
  onUpdate: () => void;
  onVerify: () => void;
  onRelease: () => void;
  onCancel: () => void;
}) {
  const { order, item, bucket, result } = row;
  const enteredBy =
    result?.entered_by_staff_id != null
      ? staffList.find((s) => s.id === result.entered_by_staff_id)
      : null;
  const verifiedBy =
    result?.verified_by_staff_id != null
      ? staffList.find((s) => s.id === result.verified_by_staff_id)
      : null;

  return (
    <div
      className={`glass-card rounded-[2rem] p-7 bg-white border transition-all ${focused
          ? "border-primary-500 shadow-2xl shadow-primary-500/10 ring-4 ring-primary-500/10"
          : "border-secondary-400 hover:border-primary-300/50"
        }`}
    >
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Left: meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-3">
            <span
              className={`inline-flex px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest ${bucketStyles[bucket]}`}
            >
              {bucketLabel[bucket]}
            </span>
            <span className="inline-flex items-center gap-1 bg-secondary-100 text-secondary-500 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold">
              <Hash className="h-2.5 w-2.5" />
              {order.order_no}
            </span>
            {item.specimen_id && (
              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 border border-amber-100 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold">
                <TestTube2 className="h-2.5 w-2.5" />
                {item.specimen_id}
              </span>
            )}
          </div>

          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-md">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-black text-secondary-900">
                {item.lab_test?.name || `Test #${item.lab_test_id}`}
              </h4>
              <div className="flex items-center gap-3 mt-1 flex-wrap text-[11px] font-bold text-secondary-500">
                {order.visit?.patient && (
                  <span className="inline-flex items-center gap-1.5">
                    <User className="h-3 w-3" />
                    {order.visit.patient.first_name} {order.visit.patient.last_name}
                  </span>
                )}
                {order.visit?.visit_code && (
                  <Link
                    to={`/visits/${order.visit_id}`}
                    className="inline-flex items-center gap-1 font-mono hover:text-primary-500"
                  >
                    {order.visit.visit_code}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                )}
                {item.processing_started_at && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    Processing {formatDateTime(item.processing_started_at)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Result preview */}
          {result && (
            <div className="mt-5 grid sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-secondary-50 border border-secondary-400 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
                  Value
                </p>
                <p className="text-base font-black text-secondary-900">
                  {result.result_value || "—"}
                  {result.unit_of_measure && (
                    <span className="text-xs font-bold text-secondary-500 ml-1.5 uppercase">
                      {result.unit_of_measure}
                    </span>
                  )}
                </p>
                {result.reference_range && (
                  <p className="text-[10px] font-mono font-bold text-secondary-500">
                    Ref: {result.reference_range}
                  </p>
                )}
              </div>
              <div className="p-4 rounded-2xl bg-secondary-50 border border-secondary-400 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
                  Interpretation
                </p>
                <p className="text-xs text-secondary-700 italic leading-relaxed">
                  {result.interpretation || result.result_text || "—"}
                </p>
              </div>
            </div>
          )}

          {/* Audit strip */}
          {(enteredBy || verifiedBy || result?.released_at) && (
            <div className="mt-4 flex flex-wrap gap-4 text-[10px] font-bold text-secondary-400 uppercase tracking-widest">
              {enteredBy && result?.entered_at && (
                <span className="inline-flex items-center gap-1.5">
                  <Edit3 className="h-3 w-3 text-primary-500" />
                  Entered by Dr. {staffLastName(enteredBy) || staffDisplayName(enteredBy)} · {formatDateTime(result.entered_at)}
                </span>
              )}
              {verifiedBy && result?.verified_at && (
                <span className="inline-flex items-center gap-1.5">
                  <ClipboardCheck className="h-3 w-3 text-emerald-500" />
                  Verified by Dr. {staffLastName(verifiedBy) || staffDisplayName(verifiedBy)} · {formatDateTime(result.verified_at)}
                </span>
              )}
              {result?.released_at && (
                <span className="inline-flex items-center gap-1.5">
                  <Send className="h-3 w-3 text-emerald-500" />
                  Released · {formatDateTime(result.released_at)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div className="xl:w-72 shrink-0 flex flex-row xl:flex-col gap-2 flex-wrap">
          {bucket === "PENDING_ENTRY" && (
            <button
              onClick={onEnter}
              className="btn-primary gap-2 px-5 py-3 text-xs justify-center w-full"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Enter Result
            </button>
          )}
          {bucket === "ENTERED" && (
            <>
              <button
                onClick={onUpdate}
                className="btn-secondary gap-2 px-5 py-3 text-xs justify-center w-full"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Update
              </button>
              <button
                onClick={onVerify}
                className="btn-primary gap-2 px-5 py-3 text-xs justify-center w-full bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                Verify
              </button>
            </>
          )}
          {bucket === "VERIFIED" && (
            <>
              <button
                onClick={onUpdate}
                className="btn-secondary gap-2 px-5 py-3 text-xs justify-center w-full"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                onClick={onRelease}
                className="btn-primary gap-2 px-5 py-3 text-xs justify-center w-full bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
              >
                <Send className="h-3.5 w-3.5" />
                Release
              </button>
            </>
          )}
          {bucket === "RELEASED" && (
            <div className="text-center w-full px-4 py-3 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold uppercase tracking-widest">
              <CheckCircle2Outline className="h-4 w-4 inline mr-1" />
              Released
            </div>
          )}
          {bucket === "CANCELLED" && (
            <div className="text-center w-full px-4 py-3 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-bold uppercase tracking-widest">
              <Ban className="h-4 w-4 inline mr-1" />
              Cancelled
            </div>
          )}
          {result && bucket !== "RELEASED" && bucket !== "CANCELLED" && (
            <button
              onClick={onCancel}
              className="text-[10px] font-bold uppercase tracking-widest text-rose-500 hover:text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-lg transition-all"
            >
              Cancel result
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ==============================================================
// Stat Card
// ==============================================================

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
  icon: typeof Edit3;
  label: string;
  value: number;
  tone: StatTone;
}) {
  return (
    <div
      className={`glass-card rounded-[2rem] p-5 border ${statToneStyles[tone]} bg-white/60 backdrop-blur-md`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-bold uppercase tracking-widest opacity-80">{label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-2xl font-black tracking-tight">{value}</div>
    </div>
  );
}

// ==============================================================
// Action Modal
// ==============================================================

function ActionModal({
  kind,
  row,
  entryForm,
  onEntryFormChange,
  verifyForm,
  onVerifyFormChange,
  releaseForm,
  onReleaseFormChange,
  staffList,
  sdps,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  kind: Exclude<ActionKind, null>;
  row: Row;
  entryForm: EntryForm;
  onEntryFormChange: (v: EntryForm) => void;
  verifyForm: VerifyForm;
  onVerifyFormChange: (v: VerifyForm) => void;
  releaseForm: ReleaseForm;
  onReleaseFormChange: (v: ReleaseForm) => void;
  staffList: Staff[];
  sdps: ServiceDeliveryPoint[];
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const meta: Record<
    Exclude<ActionKind, null>,
    { title: string; subtitle: string; cta: string; tone: "primary" | "emerald" | "rose" | "amber" }
  > = {
    enter: {
      title: "Enter Lab Result",
      subtitle: "Capture The Diagnostic Reading",
      cta: "Save Result",
      tone: "primary",
    },
    update: {
      title: "Update Lab Result",
      subtitle: "Amend An Entered Result",
      cta: "Save Changes",
      tone: "primary",
    },
    verify: {
      title: "Verify Result",
      subtitle: "Approve The Reading For Release",
      cta: "Verify",
      tone: "emerald",
    },
    release: {
      title: "Release Result",
      subtitle: "Publish To The Clinician's Dashboard",
      cta: "Release",
      tone: "emerald",
    },
    cancel: {
      title: "Cancel Result",
      subtitle: "Withdraw This Result",
      cta: "Cancel Result",
      tone: "rose",
    },
  };
  const m = meta[kind];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6 animate-fade-in">
      <div className="bg-white rounded-[2.5rem] p-10 max-w-2xl w-full shadow-2xl relative animate-slide-up max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          disabled={pending}
          className="absolute top-6 right-6 p-3 hover:bg-secondary-50 rounded-2xl transition-all disabled:opacity-50"
        >
          <X className="h-5 w-5 text-secondary-400" />
        </button>
        <div className="flex items-center gap-5 mb-8">
          <div
            className={`h-14 w-14 rounded-2xl text-white flex items-center justify-center shadow-xl ${m.tone === "rose"
                ? "bg-rose-500 shadow-rose-500/20"
                : m.tone === "amber"
                  ? "bg-amber-500 shadow-amber-500/20"
                  : m.tone === "emerald"
                    ? "bg-emerald-500 shadow-emerald-500/20"
                    : "bg-primary-500 shadow-primary-500/20"
              }`}
          >
            {kind === "enter" || kind === "update" ? (
              <Edit3 className="h-6 w-6" />
            ) : kind === "verify" ? (
              <ClipboardCheck className="h-6 w-6" />
            ) : kind === "release" ? (
              <Send className="h-6 w-6" />
            ) : (
              <Ban className="h-6 w-6" />
            )}
          </div>
          <div>
            <h3 className="text-xl font-black font-display tracking-tight">{m.title}</h3>
            <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
              {m.subtitle}
            </p>
          </div>
        </div>

        {/* Context strip */}
        <div className="mb-6 p-4 rounded-2xl bg-secondary-50 border border-secondary-400">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <FlaskConical className="h-4 w-4 text-secondary-500" />
              <div>
                <p className="text-sm font-black text-secondary-900">
                  {row.item.lab_test?.name ?? `Test #${row.item.lab_test_id}`}
                </p>
                <p className="text-[10px] font-mono font-bold text-secondary-400 uppercase mt-0.5">
                  {row.order.order_no}
                  {row.item.specimen_id && ` · Specimen ${row.item.specimen_id}`}
                </p>
              </div>
            </div>
            {row.order.visit?.patient && (
              <div className="text-right">
                <p className="text-xs font-bold text-secondary-900">
                  {row.order.visit.patient.first_name} {row.order.visit.patient.last_name}
                </p>
                <p className="text-[10px] font-mono font-bold text-secondary-400 uppercase mt-0.5">
                  {row.order.visit.patient.hospital_number}
                </p>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm font-bold">{error}</span>
          </div>
        )}

        <div className="space-y-5">
          {(kind === "enter" || kind === "update") && (
            <>
              {kind === "enter" && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                    Entered By *
                  </label>
                  <select
                    value={entryForm.entered_by_staff_id ?? ""}
                    onChange={(e) =>
                      onEntryFormChange({
                        ...entryForm,
                        entered_by_staff_id: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="input-field h-12 bg-secondary-50 border-secondary-400 w-full"
                  >
                    <option value="">Select staff...</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {staffDisplayName(s)}
                        {s.designation ? ` · ${s.designation}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                    Result Value
                  </label>
                  <input
                    type="text"
                    value={entryForm.result_value}
                    onChange={(e) =>
                      onEntryFormChange({ ...entryForm, result_value: e.target.value })
                    }
                    placeholder="e.g. 13.5"
                    className="input-field h-12 bg-secondary-50 border-secondary-400 w-full font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500 flex items-center gap-1">
                    <Sigma className="h-3 w-3" /> Unit
                  </label>
                  <input
                    type="text"
                    value={entryForm.unit_of_measure}
                    onChange={(e) =>
                      onEntryFormChange({ ...entryForm, unit_of_measure: e.target.value })
                    }
                    placeholder="g/dL"
                    className="input-field h-12 bg-secondary-50 border-secondary-400 w-full"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                  Reference Range
                </label>
                <input
                  type="text"
                  value={entryForm.reference_range}
                  onChange={(e) =>
                    onEntryFormChange({ ...entryForm, reference_range: e.target.value })
                  }
                  placeholder="12-16 g/dL"
                  className="input-field h-12 bg-secondary-50 border-secondary-400 w-full font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                  Result Description / Narrative
                </label>
                <textarea
                  value={entryForm.result_text}
                  onChange={(e) =>
                    onEntryFormChange({ ...entryForm, result_text: e.target.value })
                  }
                  placeholder="Free-text findings, especially for non-numeric results..."
                  className="input-field h-20 bg-secondary-50 border-secondary-400 w-full resize-none py-3"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                  Interpretation / Clinical Note
                </label>
                <textarea
                  value={entryForm.interpretation}
                  onChange={(e) =>
                    onEntryFormChange({ ...entryForm, interpretation: e.target.value })
                  }
                  placeholder="Clinical impression, flagging anomalies..."
                  className="input-field h-20 bg-secondary-50 border-secondary-400 w-full resize-none py-3"
                />
              </div>
            </>
          )}

          {kind === "verify" && (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                  Verified By *
                </label>
                <select
                  value={verifyForm.verified_by_staff_id ?? ""}
                  onChange={(e) =>
                    onVerifyFormChange({
                      ...verifyForm,
                      verified_by_staff_id: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="input-field h-12 bg-secondary-50 border-secondary-400 w-full"
                >
                  <option value="">Select verifier...</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {staffDisplayName(s)}
                      {s.designation ? ` · ${s.designation}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                  Verification Note (Optional)
                </label>
                <textarea
                  value={verifyForm.verification_note}
                  onChange={(e) =>
                    onVerifyFormChange({ ...verifyForm, verification_note: e.target.value })
                  }
                  placeholder="Quality check notes, repeat indication, etc."
                  className="input-field h-24 bg-secondary-50 border-secondary-400 w-full resize-none py-3"
                />
              </div>
            </>
          )}

          {kind === "release" && (
            <>
              <button
                type="button"
                onClick={() =>
                  onReleaseFormChange({
                    ...releaseForm,
                    notify_clinician: !releaseForm.notify_clinician,
                  })
                }
                className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${releaseForm.notify_clinician
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-secondary-50 border-secondary-400 text-secondary-500"
                  }`}
              >
                <div className="text-left flex items-center gap-3">
                  <Bell
                    className={`h-4 w-4 ${releaseForm.notify_clinician ? "text-emerald-600" : "text-secondary-400"
                      }`}
                  />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest">
                      Notify Clinician
                    </p>
                    <p className="text-[10px] font-bold opacity-70 mt-0.5">
                      Send a push and an in-app alert when released
                    </p>
                  </div>
                </div>
                <div
                  className={`h-6 w-12 rounded-full p-0.5 transition-all ${releaseForm.notify_clinician ? "bg-emerald-500" : "bg-secondary-200"
                    }`}
                >
                  <div
                    className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${releaseForm.notify_clinician ? "translate-x-6" : ""
                      }`}
                  />
                </div>
              </button>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500 flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" /> Route To Service Point (Optional)
                </label>
                <select
                  value={releaseForm.route_to_service_delivery_point_id ?? ""}
                  onChange={(e) =>
                    onReleaseFormChange({
                      ...releaseForm,
                      route_to_service_delivery_point_id: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  className="input-field h-12 bg-secondary-50 border-secondary-400 w-full"
                >
                  <option value="">No routing — keep visit at current SDP</option>
                  {sdps.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                  Release Note (Optional)
                </label>
                <textarea
                  value={releaseForm.release_note}
                  onChange={(e) =>
                    onReleaseFormChange({ ...releaseForm, release_note: e.target.value })
                  }
                  placeholder="Hand-off note for the clinician..."
                  className="input-field h-24 bg-secondary-50 border-secondary-400 w-full resize-none py-3"
                />
              </div>
            </>
          )}

          {kind === "cancel" && (
            <div className="p-5 rounded-2xl bg-rose-50 border border-rose-100 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-rose-500 mt-0.5 shrink-0" />
              <p className="text-sm text-rose-700 leading-relaxed">
                Cancel this result? The result will be marked as withdrawn and won't be
                released to the clinician. The corresponding lab order item will need to be
                re-processed if needed.
              </p>
            </div>
          )}
        </div>

        <div className="pt-6 flex gap-4">
          <button
            onClick={onClose}
            disabled={pending}
            className="flex-1 btn-secondary py-4 rounded-2xl font-bold disabled:opacity-50"
          >
            Close
          </button>
          <button
            onClick={onSubmit}
            disabled={pending}
            className={`flex-[2] py-4 rounded-2xl text-white font-black tracking-tight shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 ${m.tone === "rose"
                ? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20"
                : m.tone === "amber"
                  ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
                  : m.tone === "emerald"
                    ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
                    : "bg-primary-500 hover:bg-primary-600 shadow-primary-500/20"
              }`}
          >
            <Save className="h-4 w-4" />
            {pending ? "Working..." : m.cta}
          </button>
        </div>

        {/* Audit footer for the action being taken */}
        {(kind === "verify" || kind === "release") && row.result?.entered_at && (
          <p className="mt-5 text-[10px] text-secondary-400 font-bold uppercase tracking-[0.25em] flex items-center gap-2">
            <FileText className="h-3 w-3" />
            Result entered {formatDateTime(row.result.entered_at)}
          </p>
        )}
      </div>
    </div>
  );
}
