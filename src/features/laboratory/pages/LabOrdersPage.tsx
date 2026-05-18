import { PageHeader } from "@/components/layout/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  Ban,
  Beaker,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Droplets,
  ExternalLink,
  FileText,
  Filter,
  FlaskConical,
  Hash,
  Layers,
  ListChecks,
  PlayCircle,
  RefreshCw,
  Save,
  Search,
  TestTube2,
  User,
  X,
} from "lucide-react";
import {
  asLabOrderItemArray,
  cancelLabOrder,
  cancelLabOrderItem,
  collectSpecimen,
  listLabWorklist,
  startProcessing,
} from "../api/lab-orders.api";
import type { LabOrder, LabOrderItem } from "../api/lab-orders.api";
import { getStaff, staffDisplayName } from "@/features/staff/api/staff.api";
import type { Staff } from "@/features/staff/api/staff.api";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";

const orderStatusStyles: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-600 border-amber-100",
  AWAITING_PAYMENT: "bg-amber-50 text-amber-600 border-amber-100",
  AWAITING_SAMPLE: "bg-amber-50 text-amber-600 border-amber-100",
  IN_PROGRESS: "bg-primary-50 text-primary-600 border-primary-100",
  PARTIAL: "bg-primary-50 text-primary-600 border-primary-100",
  COMPLETED: "bg-emerald-50 text-emerald-600 border-emerald-100",
  CANCELLED: "bg-rose-50 text-rose-600 border-rose-100",
};

const itemStatusStyles: Record<string, string> = {
  ORDERED: "bg-secondary-100 text-secondary-600 border-secondary-200",
  AWAITING_SAMPLE: "bg-amber-50 text-amber-600 border-amber-100",
  COLLECTED: "bg-primary-50 text-primary-600 border-primary-100",
  PROCESSING: "bg-primary-50 text-primary-600 border-primary-100",
  COMPLETED: "bg-emerald-50 text-emerald-600 border-emerald-100",
  CANCELLED: "bg-rose-50 text-rose-600 border-rose-100",
};

const STATUS_FILTERS = [
  { value: "", label: "All Statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "AWAITING_SAMPLE", label: "Awaiting Sample" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "PARTIAL", label: "Partial" },
  { value: "COMPLETED", label: "Completed" },
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

type ActionKind = "collect" | "cancel-item" | "cancel-order" | null;

export function LabOrdersPage() {
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    { tone: "success" | "error"; message: string } | null
  >(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Action modal state
  const [actionKind, setActionKind] = useState<ActionKind>(null);
  const [actionOrder, setActionOrder] = useState<LabOrder | null>(null);
  const [actionItem, setActionItem] = useState<LabOrderItem | null>(null);
  const [collectForm, setCollectForm] = useState<{
    specimen_id: string;
    collected_by_staff_id: number | null;
    note: string;
  }>({ specimen_id: "", collected_by_staff_id: null, note: "" });
  const [reasonValue, setReasonValue] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Per-item processing spinner
  const [processingItemId, setProcessingItemId] = useState<number | null>(null);

  const showFeedback = (tone: "success" | "error", message: string) => {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 3500);
  };

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [worklist, staff] = await Promise.all([
        listLabWorklist({ skip: 0, limit: 100, status: statusFilter || undefined }),
        getStaff(0, 200).catch(() => [] as Staff[]),
      ]);
      const items = Array.isArray(worklist?.items) ? worklist.items : [];
      setOrders(
        [...items].sort(
          (a, b) =>
            new Date(b.ordered_at || b.created_at).getTime() -
            new Date(a.ordered_at || a.created_at).getTime(),
        ),
      );
      setStaffList(Array.isArray(staff) ? staff : []);
    } catch (err: any) {
      console.error("Failed to load lab worklist", err);
      setError(err?.response?.data?.message || "Unable to load lab worklist.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  // Default the collected_by selection to the staff record matching the user.
  useEffect(() => {
    if (collectForm.collected_by_staff_id != null) return;
    const userId = readStoredUserId();
    if (userId == null) return;
    const match = staffList.find((s) => s.user_id === userId);
    if (match) {
      setCollectForm((prev) => ({ ...prev, collected_by_staff_id: match.id }));
    }
  }, [staffList, collectForm.collected_by_staff_id]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.order_no?.toLowerCase().includes(q) ||
        o.visit?.visit_code?.toLowerCase().includes(q) ||
        o.visit?.patient?.first_name?.toLowerCase().includes(q) ||
        o.visit?.patient?.last_name?.toLowerCase().includes(q) ||
        o.visit?.patient?.hospital_number?.toLowerCase().includes(q) ||
        o.clinical_note?.toLowerCase().includes(q),
    );
  }, [orders, search]);

  const stats = useMemo(() => {
    const total = orders.length;
    const inProgress = orders.filter((o) =>
      ["IN_PROGRESS", "PARTIAL"].includes((o.status || "").toUpperCase()),
    ).length;
    const awaiting = orders.filter((o) =>
      ["AWAITING_SAMPLE", "AWAITING_PAYMENT", "PENDING"].includes(
        (o.status || "").toUpperCase(),
      ),
    ).length;
    const completed = orders.filter((o) => (o.status || "").toUpperCase() === "COMPLETED")
      .length;
    return { total, inProgress, awaiting, completed };
  }, [orders]);

  const toggleExpand = (orderId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const replaceOrder = (updated: LabOrder) => {
    setOrders((prev) => {
      const others = prev.filter((o) => o.id !== updated.id);
      return [updated, ...others].sort(
        (a, b) =>
          new Date(b.ordered_at || b.created_at).getTime() -
          new Date(a.ordered_at || a.created_at).getTime(),
      );
    });
  };

  // ----- Per-item one-click action: Start Processing -----
  const handleStartProcessing = async (item: LabOrderItem) => {
    setProcessingItemId(item.id);
    try {
      const result = await startProcessing(item.id);
      replaceOrder(result.lab_order);
      showFeedback("success", result.message || "Processing started.");
    } catch (err: any) {
      showFeedback(
        "error",
        err?.response?.data?.message || "Failed to start processing.",
      );
    } finally {
      setProcessingItemId(null);
    }
  };

  // ----- Open modals -----
  const openCollect = (order: LabOrder, item: LabOrderItem) => {
    setActionKind("collect");
    setActionOrder(order);
    setActionItem(item);
    setActionError(null);
    setCollectForm((prev) => ({
      specimen_id: "",
      collected_by_staff_id: prev.collected_by_staff_id,
      note: "",
    }));
  };

  const openCancelItem = (order: LabOrder, item: LabOrderItem) => {
    setActionKind("cancel-item");
    setActionOrder(order);
    setActionItem(item);
    setReasonValue("");
    setActionError(null);
  };

  const openCancelOrder = (order: LabOrder) => {
    setActionKind("cancel-order");
    setActionOrder(order);
    setActionItem(null);
    setReasonValue("");
    setActionError(null);
  };

  const closeAction = () => {
    if (actionPending) return;
    setActionKind(null);
    setActionOrder(null);
    setActionItem(null);
    setActionError(null);
  };

  const handleSubmitAction = async () => {
    if (!actionKind) return;
    setActionPending(true);
    setActionError(null);
    try {
      if (actionKind === "collect") {
        if (!actionItem) return;
        if (!collectForm.specimen_id.trim()) {
          setActionError("Specimen ID is required.");
          setActionPending(false);
          return;
        }
        if (!collectForm.collected_by_staff_id) {
          setActionError("Select the staff member collecting the specimen.");
          setActionPending(false);
          return;
        }
        const result = await collectSpecimen(actionItem.id, {
          specimen_id: collectForm.specimen_id.trim(),
          collected_by_staff_id: collectForm.collected_by_staff_id,
          note: collectForm.note.trim() || undefined,
        });
        replaceOrder(result.lab_order);
        showFeedback("success", result.message || "Specimen collected.");
      } else if (actionKind === "cancel-item") {
        if (!actionItem) return;
        if (!reasonValue.trim()) {
          setActionError("A reason is required to cancel an item.");
          setActionPending(false);
          return;
        }
        const result = await cancelLabOrderItem(actionItem.id, { reason: reasonValue.trim() });
        replaceOrder(result.lab_order);
        showFeedback("success", result.message || "Test item cancelled.");
      } else if (actionKind === "cancel-order") {
        if (!actionOrder) return;
        if (!reasonValue.trim()) {
          setActionError("A reason is required to cancel the order.");
          setActionPending(false);
          return;
        }
        const result = await cancelLabOrder(actionOrder.id, { reason: reasonValue.trim() });
        replaceOrder(result.lab_order);
        showFeedback("success", result.message || "Order cancelled.");
      }
      setActionKind(null);
      setActionOrder(null);
      setActionItem(null);
    } catch (err: any) {
      setActionError(err?.response?.data?.message || "Action failed.");
    } finally {
      setActionPending(false);
    }
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Laboratory Worklist"
          description="Process incoming orders: collect specimens, run tests, and route results back to the clinician."
        />
        <div className="flex items-center gap-3">
          <Link
            to="/laboratory/tests"
            className="btn-secondary gap-2 px-5 py-3 rounded-2xl bg-white/80 border-secondary-400"
          >
            <Layers className="h-4 w-4" />
            <span className="text-sm font-bold">Tests Catalogue</span>
          </Link>
          <Link
            to="/laboratory/results"
            className="btn-secondary gap-2 px-5 py-3 rounded-2xl bg-white/80 border-secondary-400"
          >
            <FileText className="h-4 w-4" />
            <span className="text-sm font-bold">Results Queue</span>
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
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={ListChecks} label="Total Orders" value={stats.total} tone="primary" />
        <StatCard icon={Clock} label="Awaiting" value={stats.awaiting} tone="amber" />
        <StatCard icon={Activity} label="In Progress" value={stats.inProgress} tone="primary" />
        <StatCard icon={CheckCircle2} label="Completed" value={stats.completed} tone="emerald" />
      </div>

      {/* Filter Bar */}
      <div className="glass-card rounded-[2rem] p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center bg-white/40 backdrop-blur-md">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order #, visit code, patient name or hospital number..."
            className="w-full bg-white/50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400 pointer-events-none" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none bg-white/80 border border-secondary-400 rounded-2xl pl-11 pr-8 py-4 text-xs font-bold uppercase tracking-widest text-secondary-700 focus:ring-2 focus:ring-primary-500/40"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-[2.5rem] overflow-hidden border border-secondary-400/50 shadow-premium bg-white/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-secondary-900/5">
                <th className="px-6 py-6" />
                <th className="px-4 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Order</th>
                <th className="px-4 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Patient</th>
                <th className="px-4 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Items</th>
                <th className="px-4 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Status</th>
                <th className="px-4 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Ordered</th>
                <th className="px-6 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100/50">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-6 py-6">
                      <div className="h-14 bg-secondary-100/30 rounded-2xl w-full" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center">
                    <div className="max-w-xs mx-auto space-y-4">
                      <AlertCircle className="h-12 w-12 mx-auto text-rose-500/50" />
                      <p className="text-secondary-600 font-bold">{error}</p>
                      <button onClick={load} className="btn-primary w-full py-3">
                        Try Again
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-8 py-32 text-center">
                    <div className="max-w-sm mx-auto space-y-6">
                      <div className="h-20 w-20 bg-secondary-50 rounded-3xl flex items-center justify-center mx-auto">
                        <FlaskConical className="h-10 w-10 text-secondary-200" />
                      </div>
                      <h4 className="text-xl font-bold text-secondary-900">No Orders</h4>
                      <p className="text-sm text-secondary-500">
                        {orders.length === 0
                          ? "The worklist is empty. Lab orders raised by clinicians will appear here."
                          : "No orders match your filters."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const items = asLabOrderItemArray(order.items);
                  const isExpanded = expanded.has(order.id);
                  const orderStatusKey = (order.status || "PENDING").toUpperCase();
                  const orderStatusClass =
                    orderStatusStyles[orderStatusKey] ?? orderStatusStyles.PENDING;
                  return (
                    <>
                      <tr
                        key={`order-${order.id}`}
                        className="hover:bg-primary-50/30 transition-all"
                      >
                        <td className="px-6 py-5 align-top">
                          <button
                            onClick={() => toggleExpand(order.id)}
                            className="p-2 rounded-xl hover:bg-secondary-100 transition-colors"
                            aria-label={isExpanded ? "Collapse" : "Expand"}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-secondary-500" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-secondary-500" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-5 align-top">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md shrink-0">
                              <FlaskConical className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-mono font-bold text-secondary-900 uppercase tracking-tight">
                                {order.order_no}
                              </p>
                              <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mt-0.5">
                                #{order.id}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-5 align-top">
                          {order.visit?.patient ? (
                            <div className="flex items-center gap-2">
                              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center text-[10px] font-black shadow-md">
                                {(order.visit.patient.first_name?.[0] ?? "?")}
                                {(order.visit.patient.last_name?.[0] ?? "?")}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-secondary-900 truncate">
                                  {order.visit.patient.first_name}{" "}
                                  {order.visit.patient.last_name}
                                </p>
                                <Link
                                  to={`/visits/${order.visit_id}`}
                                  className="text-[10px] font-mono font-bold text-secondary-400 hover:text-primary-500 truncate flex items-center gap-1"
                                >
                                  {order.visit.visit_code}
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </Link>
                              </div>
                            </div>
                          ) : (
                            <Link
                              to={`/visits/${order.visit_id}`}
                              className="text-xs font-bold text-secondary-700 hover:text-primary-600 inline-flex items-center gap-1"
                            >
                              <User className="h-3 w-3" />
                              Visit #{order.visit_id}
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          )}
                        </td>
                        <td className="px-4 py-5 align-top">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary-100 text-secondary-600 text-[10px] font-bold uppercase tracking-widest">
                            <ListChecks className="h-3 w-3" />
                            {items.length}
                          </span>
                        </td>
                        <td className="px-4 py-5 align-top">
                          <span
                            className={`inline-flex px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest ${orderStatusClass}`}
                          >
                            {orderStatusKey}
                          </span>
                        </td>
                        <td className="px-4 py-5 align-top">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-secondary-600">
                            <Clock className="h-3 w-3 text-secondary-400" />
                            {formatDateTime(order.ordered_at || order.created_at)}
                          </div>
                        </td>
                        <td className="px-6 py-5 align-top">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => toggleExpand(order.id)}
                              className="px-4 py-2 rounded-xl bg-white border border-secondary-400 text-[10px] font-bold uppercase tracking-widest hover:bg-secondary-50 transition-all"
                            >
                              {isExpanded ? "Hide Items" : "View Items"}
                            </button>
                            {orderStatusKey !== "CANCELLED" && orderStatusKey !== "COMPLETED" && (
                              <button
                                onClick={() => openCancelOrder(order)}
                                className="p-2.5 hover:bg-rose-50 text-rose-500 rounded-xl transition-all"
                                title="Cancel order"
                              >
                                <Ban className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`order-${order.id}-items`}>
                          <td colSpan={7} className="px-6 pb-6 pt-0 bg-secondary-50/40">
                            <div className="rounded-2xl bg-white border border-secondary-400 overflow-hidden">
                              {order.clinical_note && (
                                <div className="p-5 border-b border-secondary-400 bg-amber-50/40">
                                  <div className="flex items-start gap-3">
                                    <FileText className="h-4 w-4 text-amber-600 mt-0.5" />
                                    <div className="flex-1">
                                      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-1">
                                        Clinical Note
                                      </p>
                                      <p className="text-sm text-secondary-700 italic leading-relaxed">
                                        "{order.clinical_note}"
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                              <div className="divide-y divide-secondary-100/50">
                                {items.length === 0 ? (
                                  <div className="p-6 text-center text-secondary-400 text-xs font-bold uppercase tracking-widest">
                                    No items on this order
                                  </div>
                                ) : (
                                  items.map((item) => (
                                    <LabOrderItemRow
                                      key={item.id}
                                      order={order}
                                      item={item}
                                      processingId={processingItemId}
                                      onCollect={() => openCollect(order, item)}
                                      onStartProcessing={() => handleStartProcessing(item)}
                                      onCancel={() => openCancelItem(order, item)}
                                    />
                                  ))
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Modal */}
      {actionKind && (
        <ActionModal
          kind={actionKind}
          order={actionOrder}
          item={actionItem}
          collectForm={collectForm}
          onCollectFormChange={setCollectForm}
          reason={reasonValue}
          onReasonChange={setReasonValue}
          staffList={staffList}
          pending={actionPending}
          error={actionError}
          onClose={closeAction}
          onSubmit={handleSubmitAction}
        />
      )}
    </div>
  );
}

// =====================================================================
// Sub-components
// =====================================================================

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
  icon: typeof Beaker;
  label: string;
  value: number;
  tone: StatTone;
}) {
  return (
    <div
      className={`glass-card rounded-[2rem] p-6 border ${statToneStyles[tone]} bg-white/60 backdrop-blur-md`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</span>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-3xl font-black tracking-tight">{value}</div>
    </div>
  );
}

function LabOrderItemRow({
  item,
  processingId,
  onCollect,
  onStartProcessing,
  onCancel,
}: {
  order: LabOrder;
  item: LabOrderItem;
  processingId: number | null;
  onCollect: () => void;
  onStartProcessing: () => void;
  onCancel: () => void;
}) {
  const status = (item.status || "ORDERED").toUpperCase();
  const statusClass = itemStatusStyles[status] ?? itemStatusStyles.ORDERED;
  const isProcessingThis = processingId === item.id;
  const canCollect = status === "ORDERED" || status === "AWAITING_SAMPLE";
  const canStart = status === "COLLECTED";
  const canCancel = !["COMPLETED", "CANCELLED"].includes(status);

  return (
    <div className="p-5 hover:bg-secondary-50/40 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="h-11 w-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
            <TestTube2 className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-black text-secondary-900">
                {item.lab_test?.name || `Test #${item.lab_test_id}`}
              </p>
              {item.lab_test?.code && (
                <span className="inline-flex items-center gap-1 bg-secondary-100 text-secondary-500 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold">
                  <Hash className="h-2.5 w-2.5" />
                  {item.lab_test.code}
                </span>
              )}
              <span
                className={`inline-flex px-2.5 py-0.5 rounded-lg border text-[9px] font-bold uppercase tracking-widest ${statusClass}`}
              >
                {status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3 text-[11px] text-secondary-500 font-bold">
              {item.specimen_id && (
                <div className="flex items-center gap-2">
                  <Droplets className="h-3 w-3 text-rose-400" />
                  <span className="font-mono">Specimen: {item.specimen_id}</span>
                </div>
              )}
              {item.lab_test?.sample_type && (
                <div className="flex items-center gap-2">
                  <TestTube2 className="h-3 w-3 text-amber-500" />
                  <span>{item.lab_test.sample_type}</span>
                </div>
              )}
              {item.collected_at && (
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-secondary-400" />
                  <span>Collected {formatDateTime(item.collected_at)}</span>
                </div>
              )}
              {item.processing_started_at && (
                <div className="flex items-center gap-2">
                  <Activity className="h-3 w-3 text-primary-500" />
                  <span>Processing {formatDateTime(item.processing_started_at)}</span>
                </div>
              )}
            </div>
            {item.cancellation_reason && (
              <p className="mt-2 text-[11px] text-rose-500 italic">
                Cancelled: {item.cancellation_reason}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canCollect && (
            <button
              onClick={onCollect}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold uppercase tracking-widest shadow-md"
            >
              <Droplets className="h-3 w-3" />
              Collect
            </button>
          )}
          {canStart && (
            <button
              onClick={onStartProcessing}
              disabled={isProcessingThis}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-[10px] font-bold uppercase tracking-widest shadow-md disabled:opacity-50"
            >
              <PlayCircle className="h-3 w-3" />
              {isProcessingThis ? "Starting..." : "Start"}
            </button>
          )}
          {(status === "PROCESSING" || status === "COMPLETED") && (
            <Link
              to="/laboratory/results"
              state={{ focusItemId: item.id }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-widest shadow-md"
            >
              <FileText className="h-3 w-3" />
              Result
            </Link>
          )}
          {canCancel && (
            <button
              onClick={onCancel}
              className="p-2 hover:bg-rose-50 text-rose-500 rounded-lg transition-all"
              title="Cancel item"
            >
              <Ban className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ----- Action Modal -----

const actionMeta: Record<
  Exclude<ActionKind, null>,
  { title: string; subtitle: string; cta: string }
> = {
  collect: {
    title: "Collect Specimen",
    subtitle: "Log Specimen Receipt And Chain Of Custody",
    cta: "Mark Collected",
  },
  "cancel-item": {
    title: "Cancel Test Item",
    subtitle: "Remove One Test From The Order",
    cta: "Cancel Item",
  },
  "cancel-order": {
    title: "Cancel Lab Order",
    subtitle: "Cancel All Items On This Order",
    cta: "Cancel Order",
  },
};

function ActionModal({
  kind,
  order,
  item,
  collectForm,
  onCollectFormChange,
  reason,
  onReasonChange,
  staffList,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  kind: Exclude<ActionKind, null>;
  order: LabOrder | null;
  item: LabOrderItem | null;
  collectForm: {
    specimen_id: string;
    collected_by_staff_id: number | null;
    note: string;
  };
  onCollectFormChange: (next: {
    specimen_id: string;
    collected_by_staff_id: number | null;
    note: string;
  }) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  staffList: Staff[];
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const meta = actionMeta[kind];
  const isCollect = kind === "collect";
  const isCancelItem = kind === "cancel-item";
  const isCancelOrder = kind === "cancel-order";
  const tone = isCollect ? "amber" : "rose";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6 animate-fade-in">
      <div className="bg-white rounded-[2.5rem] p-10 max-w-xl w-full shadow-2xl relative animate-slide-up max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          disabled={pending}
          className="absolute top-6 right-6 p-3 hover:bg-secondary-50 rounded-2xl transition-all disabled:opacity-50"
        >
          <X className="h-5 w-5 text-secondary-400" />
        </button>
        <div className="flex items-center gap-5 mb-8">
          <div
            className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-xl text-white ${tone === "amber" ? "bg-amber-500 shadow-amber-500/20" : "bg-rose-500 shadow-rose-500/20"
              }`}
          >
            {isCollect ? <Droplets className="h-6 w-6" /> : <Ban className="h-6 w-6" />}
          </div>
          <div>
            <h3 className="text-xl font-black font-display tracking-tight">{meta.title}</h3>
            <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
              {meta.subtitle}
            </p>
          </div>
        </div>

        {/* Context strip */}
        {(order || item) && (
          <div className="mb-6 p-4 rounded-2xl bg-secondary-50 border border-secondary-400">
            {order && (
              <div className="flex items-center gap-3">
                <FlaskConical className="h-4 w-4 text-secondary-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-mono font-bold text-secondary-500 uppercase">
                    {order.order_no}
                  </p>
                  {order.visit?.patient && (
                    <p className="text-sm font-bold text-secondary-900 truncate">
                      {order.visit.patient.first_name} {order.visit.patient.last_name}
                    </p>
                  )}
                </div>
                {item && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-secondary-200 text-[10px] font-bold uppercase tracking-widest text-secondary-600">
                    <TestTube2 className="h-3 w-3" />
                    {item.lab_test?.name ?? `Test #${item.lab_test_id}`}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm font-bold">{error}</span>
          </div>
        )}

        <div className="space-y-5">
          {isCollect && (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                  Specimen ID *
                </label>
                <input
                  type="text"
                  value={collectForm.specimen_id}
                  onChange={(e) =>
                    onCollectFormChange({ ...collectForm, specimen_id: e.target.value.toUpperCase() })
                  }
                  placeholder="LAB-2026-04-001"
                  className="input-field h-12 bg-secondary-50 border-secondary-400 w-full font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                  Collected By *
                </label>
                <select
                  value={collectForm.collected_by_staff_id ?? ""}
                  onChange={(e) =>
                    onCollectFormChange({
                      ...collectForm,
                      collected_by_staff_id: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="input-field h-12 bg-secondary-50 border-secondary-400 w-full"
                >
                  <option value="">Select collector...</option>
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
                  Note (Optional)
                </label>
                <textarea
                  value={collectForm.note}
                  onChange={(e) =>
                    onCollectFormChange({ ...collectForm, note: e.target.value })
                  }
                  placeholder="Pre-analytical notes, sample condition, container type..."
                  className="input-field h-24 bg-secondary-50 border-secondary-400 w-full resize-none py-3"
                />
              </div>
            </>
          )}

          {(isCancelItem || isCancelOrder) && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                Cancellation Reason *
              </label>
              <textarea
                value={reason}
                onChange={(e) => onReasonChange(e.target.value)}
                placeholder={
                  isCancelOrder
                    ? "Why is this entire order being cancelled?"
                    : "Why is this test item being cancelled?"
                }
                className="input-field h-28 bg-secondary-50 border-secondary-400 w-full resize-none py-3"
              />
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
            className={`flex-[2] py-4 rounded-2xl text-white font-black tracking-tight shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 ${tone === "amber"
                ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
                : "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20"
              }`}
          >
            <Save className="h-4 w-4" />
            {pending ? "Working..." : meta.cta}
          </button>
        </div>
      </div>
    </div>
  );
}
