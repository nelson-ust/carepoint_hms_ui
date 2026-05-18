import { PageHeader } from "@/components/layout/PageHeader";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Ban,
  Building2,
  CheckCircle2,
  CheckSquare,
  Clock,
  Hash,
  History,
  LogOut,
  MoreHorizontal,
  PhoneCall,
  PlayCircle,
  RefreshCw,
  Save,
  Shuffle,
  Stethoscope,
  User,
  Users,
  UserX,
  Volume2,
  X,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { routes } from "@/config/routes";
import {
  asTicketArray,
  cancelTicket,
  callTicket,
  completeAndEndVisitTicket,
  completeAndRouteTicket,
  completeTicket,
  getMyWorklist,
  getServicePointWorklist,
  listServicePointTickets,
  missTicket,
  serveTicket,
  transferTicket,
} from "../api/queues.api";
import type {
  QueueTicket,
  TicketActionResponse,
  Worklist,
} from "../api/queues.api";
import { listActiveServiceDeliveryPoints } from "@/features/service-delivery-points/api/service-delivery-points.api";
import type { ServiceDeliveryPoint } from "@/features/service-delivery-points/api/service-delivery-points.api";

const statusStyles: Record<string, string> = {
  WAITING: "bg-amber-50 text-amber-600 border-amber-100",
  CALLED: "bg-primary-50 text-primary-600 border-primary-100",
  SERVING: "bg-emerald-50 text-emerald-600 border-emerald-100",
  COMPLETED: "bg-emerald-50 text-emerald-600 border-emerald-100",
  MISSED: "bg-rose-50 text-rose-600 border-rose-100",
  CANCELLED: "bg-rose-50 text-rose-600 border-rose-100",
  TRANSFERRED: "bg-secondary-100 text-secondary-500 border-secondary-200",
};

const REFRESH_INTERVAL_MS = 15000;

type ActionKind =
  | "call"
  | "serve"
  | "complete"
  | "complete-route"
  | "complete-end-visit"
  | "cancel"
  | "transfer"
  | null;

type FeedbackTone = "success" | "error";
type Feedback = { tone: FeedbackTone; message: string } | null;

function formatTime(value?: string) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function timeSince(value?: string): string {
  if (!value) return "—";
  const created = new Date(value).getTime();
  if (Number.isNaN(created)) return "—";
  const diffMs = Date.now() - created;
  if (diffMs < 0) return "0m";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
}

function patientName(ticket: QueueTicket): string {
  const p = ticket.patient;
  if (p?.first_name || p?.last_name) {
    return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
  }
  return `Patient #${ticket.patient_id}`;
}

function patientInitials(ticket: QueueTicket): string {
  const p = ticket.patient;
  const first = p?.first_name?.[0] ?? "?";
  const last = p?.last_name?.[0] ?? "?";
  return `${first}${last}`;
}

export function QueueDashboardPage() {
  const navigate = useNavigate();
  const [sdps, setSdps] = useState<ServiceDeliveryPoint[]>([]);
  const [scope, setScope] = useState<"my" | "sdp">("my");
  const [selectedSdpId, setSelectedSdpId] = useState<number | null>(null);

  const [worklist, setWorklist] = useState<Worklist | null>(null);
  const [historyTickets, setHistoryTickets] = useState<QueueTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionTicketId, setActionTicketId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  // Action modals
  const [actionKind, setActionKind] = useState<ActionKind>(null);
  const [actionTicket, setActionTicket] = useState<QueueTicket | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [reasonValue, setReasonValue] = useState("");
  const [transferTargetSdp, setTransferTargetSdp] = useState<number | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refreshTimer = useRef<number | null>(null);

  // ---------- Data loading ----------

  const loadSdps = async () => {
    try {
      const response = await listActiveServiceDeliveryPoints({ skip: 0, limit: 200 });
      setSdps(response.items ?? []);
    } catch (err) {
      console.error("Failed to load service delivery points", err);
    }
  };

  const loadWorklist = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      let work: Worklist;
      if (scope === "my") {
        work = await getMyWorklist();
      } else if (selectedSdpId) {
        work = await getServicePointWorklist(selectedSdpId);
      } else {
        setWorklist(null);
        setHistoryTickets([]);
        if (!silent) setIsLoading(false);
        return;
      }
      setWorklist(work);
      const targetSdpId =
        scope === "sdp" ? selectedSdpId : work?.service_delivery_point_id ?? null;
      if (targetSdpId) {
        try {
          const tickets = await listServicePointTickets(targetSdpId, { skip: 0, limit: 50 });
          setHistoryTickets(tickets.items ?? []);
        } catch (err) {
          console.error("Failed to load ticket history", err);
        }
      } else {
        setHistoryTickets([]);
      }
    } catch (err: any) {
      console.error("Failed to load worklist", err);
      setError(
        err?.response?.data?.message ||
        "Unable to load the worklist. Make sure your account is assigned to a service point.",
      );
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // initial SDP fetch
  useEffect(() => {
    loadSdps();
  }, []);

  // worklist load + auto-refresh
  useEffect(() => {
    loadWorklist();
    if (refreshTimer.current) {
      window.clearInterval(refreshTimer.current);
    }
    refreshTimer.current = window.setInterval(() => {
      loadWorklist(true);
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (refreshTimer.current) {
        window.clearInterval(refreshTimer.current);
        refreshTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, selectedSdpId]);

  // ---------- Derived state ----------

  const waiting = useMemo(() => asTicketArray(worklist?.waiting), [worklist]);
  const serving = useMemo(() => asTicketArray(worklist?.serving), [worklist]);

  const recentlyCompleted = useMemo(() => {
    return historyTickets
      .filter((t) =>
        ["COMPLETED", "CANCELLED", "MISSED", "TRANSFERRED"].includes(
          (t.status || "").toUpperCase(),
        ),
      )
      .sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at).getTime() -
          new Date(a.updated_at || a.created_at).getTime(),
      )
      .slice(0, 8);
  }, [historyTickets]);

  // ---------- Action helpers ----------

  const openAction = (kind: ActionKind, ticket: QueueTicket) => {
    setActionKind(kind);
    setActionTicket(ticket);
    setNoteValue("");
    setReasonValue("");
    setTransferTargetSdp(null);
    setActionError(null);
  };

  const closeAction = () => {
    if (actionPending) return;
    setActionKind(null);
    setActionTicket(null);
    setActionError(null);
  };

  const showFeedback = (tone: FeedbackTone, message: string) => {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 4000);
  };

  const applyTicketUpdate = (response: TicketActionResponse) => {
    const updated = response.ticket;
    if (!updated) return;
    // Update in waiting/serving lists if present
    setWorklist((prev) => {
      if (!prev) return prev;
      const w = asTicketArray(prev.waiting).filter((t) => t.id !== updated.id);
      const s = asTicketArray(prev.serving).filter((t) => t.id !== updated.id);
      const nextStatus = (updated.status || "").toUpperCase();
      if (nextStatus === "WAITING") w.unshift(updated);
      else if (nextStatus === "CALLED" || nextStatus === "SERVING") s.unshift(updated);
      return { ...prev, waiting: w, serving: s };
    });
    setHistoryTickets((prev) => {
      const others = prev.filter((t) => t.id !== updated.id);
      return [updated, ...others].slice(0, 50);
    });
  };

  const runAction = async (
    perform: () => Promise<TicketActionResponse>,
    successMessage: string,
  ) => {
    setActionPending(true);
    setActionError(null);
    try {
      const result = await perform();
      applyTicketUpdate(result);
      showFeedback("success", result?.message || successMessage);
      closeActionForce();
      // Pull a fresh worklist to ensure server-side stats are accurate.
      loadWorklist(true);
    } catch (err: any) {
      const message =
        err?.response?.data?.message || `Action failed. Please retry.`;
      setActionError(message);
      showFeedback("error", message);
    } finally {
      setActionPending(false);
    }
  };

  const closeActionForce = () => {
    setActionKind(null);
    setActionTicket(null);
    setActionError(null);
  };

  // Quick action (no modal): Miss
  const handleMiss = async (ticket: QueueTicket) => {
    if (!confirm(`Mark ticket ${ticket.queue_number} as missed?`)) return;
    setActionTicketId(ticket.id);
    try {
      const result = await missTicket(ticket.id);
      applyTicketUpdate(result);
      showFeedback("success", result?.message || "Ticket marked as missed.");
      loadWorklist(true);
    } catch (err: any) {
      showFeedback(
        "error",
        err?.response?.data?.message || "Failed to mark ticket as missed.",
      );
    } finally {
      setActionTicketId(null);
    }
  };

  const handleSubmitAction = () => {
    if (!actionTicket) return;
    const t = actionTicket;
    const note = noteValue.trim();
    const reason = reasonValue.trim();
    switch (actionKind) {
      case "call":
        return runAction(() => callTicket(t.id, { note }), "Ticket called.");
      case "serve":
        return runAction(() => serveTicket(t.id, { note }), "Service started.");
      case "complete":
        return runAction(() => completeTicket(t.id, { note }), "Service completed.");
      case "complete-route":
        return runAction(
          () => completeAndRouteTicket(t.id, note),
          "Service completed and patient routed.",
        );
      case "complete-end-visit":
        return runAction(
          () => completeAndEndVisitTicket(t.id, note),
          "Service completed and visit ended.",
        );
      case "cancel":
        if (!reason) {
          setActionError("A cancellation reason is required.");
          return;
        }
        return runAction(() => cancelTicket(t.id, { reason }), "Ticket cancelled.");
      case "transfer":
        if (!transferTargetSdp) {
          setActionError("Pick a destination service point.");
          return;
        }
        return runAction(
          () =>
            transferTicket(t.id, {
              target_service_delivery_point_id: transferTargetSdp,
              reason: reason || undefined,
            }),
          "Ticket transferred.",
        );
      default:
        return;
    }
  };

  // ---------- Render ----------

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Patient Queue Manager"
          description="Live worklist orchestration: call, serve, route, and transfer tickets across service points."
        />
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex rounded-2xl bg-white/80 border border-secondary-400 overflow-hidden">
            <button
              onClick={() => setScope("my")}
              className={`px-5 py-3 text-xs font-bold uppercase tracking-widest transition-all ${scope === "my"
                  ? "bg-slate-900 text-white"
                  : "text-secondary-600 hover:bg-secondary-50"
                }`}
            >
              My Worklist
            </button>
            <button
              onClick={() => setScope("sdp")}
              className={`px-5 py-3 text-xs font-bold uppercase tracking-widest transition-all ${scope === "sdp"
                  ? "bg-slate-900 text-white"
                  : "text-secondary-600 hover:bg-secondary-50"
                }`}
            >
              By Service Point
            </button>
          </div>
          {scope === "sdp" && (
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400 pointer-events-none" />
              <select
                value={selectedSdpId ?? ""}
                onChange={(e) =>
                  setSelectedSdpId(e.target.value ? Number(e.target.value) : null)
                }
                className="appearance-none bg-white/80 border border-secondary-400 rounded-2xl pl-11 pr-8 py-3 text-xs font-bold uppercase tracking-widest text-secondary-700 focus:ring-2 focus:ring-primary-500/40"
              >
                <option value="">Pick a service point</option>
                {sdps.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={() => loadWorklist()}
            className="btn-secondary p-3 rounded-2xl bg-white/80 border-secondary-400 hover:rotate-180 transition-transform duration-500"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
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
        <StatCard
          icon={Users}
          label="Waiting"
          value={waiting.length}
          subtitle={worklist?.service_delivery_point_name}
          tone="amber"
        />
        <StatCard
          icon={Volume2}
          label="Now Serving"
          value={serving.length}
          subtitle="In active service"
          tone="primary"
        />
        <StatCard
          icon={CheckCircle2}
          label="Served Today"
          value={worklist?.served_today ?? 0}
          subtitle="Completed today"
          tone="emerald"
        />
        <StatCard
          icon={UserX}
          label="Cancelled Today"
          value={worklist?.cancelled_today ?? 0}
          subtitle="Cancelled today"
          tone="rose"
        />
      </div>

      {/* Error / Loading */}
      {error && (
        <div className="p-6 bg-rose-50 border border-rose-100 text-rose-600 rounded-[2rem] flex items-center gap-4">
          <AlertCircle className="h-6 w-6 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold">{error}</p>
          </div>
          <button onClick={() => loadWorklist()} className="btn-primary px-5 py-2 text-xs">
            Retry
          </button>
        </div>
      )}

      {isLoading && !worklist ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="glass-card rounded-[2rem] p-8 animate-pulse bg-white/40 h-32"
              />
            ))}
          </div>
          <div className="lg:col-span-5 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="glass-card rounded-[2rem] p-8 animate-pulse bg-white/40 h-32"
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Waiting Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black flex items-center gap-3">
                <Users className="h-6 w-6 text-amber-500" />
                <span>Waiting List</span>
              </h3>
              <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-bold uppercase tracking-widest">
                {waiting.length} Patients
              </span>
            </div>

            {waiting.length === 0 ? (
              <div className="glass-card rounded-[2.5rem] p-16 text-center bg-white/40">
                <div className="h-16 w-16 mx-auto bg-amber-50 rounded-3xl flex items-center justify-center mb-4">
                  <Clock className="h-8 w-8 text-amber-300" />
                </div>
                <p className="text-secondary-500 font-bold">No patients are waiting in this queue.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {waiting.map((ticket) => (
                  <WaitingCard
                    key={ticket.id}
                    ticket={ticket}
                    pendingId={actionTicketId}
                    onCall={() => openAction("call", ticket)}
                    onCancel={() => openAction("cancel", ticket)}
                    onTransfer={() => openAction("transfer", ticket)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Now Serving Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black flex items-center gap-3">
                <Volume2 className="h-6 w-6 text-primary-500" />
                <span>Now Serving</span>
              </h3>
              <span className="px-3 py-1.5 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 text-[10px] font-bold uppercase tracking-widest">
                {serving.length} Active
              </span>
            </div>

            {serving.length === 0 ? (
              <div className="glass-card rounded-[2.5rem] p-12 text-center bg-white/40">
                <div className="h-16 w-16 mx-auto bg-primary-50 rounded-3xl flex items-center justify-center mb-4">
                  <Volume2 className="h-8 w-8 text-primary-300" />
                </div>
                <p className="text-secondary-500 font-bold">
                  No tickets currently being served. Call the next patient when ready.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {serving.map((ticket) => (
                  <ServingCard
                    key={ticket.id}
                    ticket={ticket}
                    onServe={() => openAction("serve", ticket)}
                    onComplete={() => openAction("complete", ticket)}
                    onCompleteRoute={() => openAction("complete-route", ticket)}
                    onCompleteEndVisit={() => openAction("complete-end-visit", ticket)}
                    onMiss={() => handleMiss(ticket)}
                    onCancel={() => openAction("cancel", ticket)}
                    onTransfer={() => openAction("transfer", ticket)}
                    onOpenConsultation={() =>
                      navigate(`${routes.consultation}/${ticket.visit_id}`)
                    }
                  />
                ))}
              </div>
            )}

            {/* Recent History */}
            {recentlyCompleted.length > 0 && (
              <div className="space-y-4 pt-4">
                <h4 className="text-sm font-black flex items-center gap-2 text-secondary-500">
                  <History className="h-4 w-4" />
                  Recent Activity
                </h4>
                <div className="space-y-2">
                  {recentlyCompleted.map((ticket) => {
                    const status = (ticket.status || "").toUpperCase();
                    const cls = statusStyles[status] ?? statusStyles.WAITING;
                    return (
                      <div
                        key={ticket.id}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-white/60 border border-secondary-400"
                      >
                        <div className="h-10 w-10 rounded-xl bg-secondary-50 text-secondary-400 flex items-center justify-center text-xs font-mono font-bold">
                          {ticket.queue_number}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-secondary-900 truncate">
                            {patientName(ticket)}
                          </p>
                          <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mt-0.5">
                            {formatTime(ticket.updated_at || ticket.created_at)}
                          </p>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border ${cls}`}
                        >
                          {status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Modal */}
      {actionKind && actionTicket && (
        <ActionModal
          kind={actionKind}
          ticket={actionTicket}
          note={noteValue}
          onNoteChange={setNoteValue}
          reason={reasonValue}
          onReasonChange={setReasonValue}
          transferTargetSdp={transferTargetSdp}
          onTransferTargetChange={setTransferTargetSdp}
          sdps={sdps.filter(
            (s) => actionTicket && s.id !== actionTicket.service_delivery_point_id,
          )}
          pending={actionPending}
          error={actionError}
          onClose={closeAction}
          onSubmit={handleSubmitAction}
        />
      )}
    </div>
  );
}

// ---------------- Cards ----------------

type WaitingCardProps = {
  ticket: QueueTicket;
  pendingId: number | null;
  onCall: () => void;
  onCancel: () => void;
  onTransfer: () => void;
};

function WaitingCard({ ticket, pendingId, onCall, onCancel, onTransfer }: WaitingCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isPending = pendingId === ticket.id;
  return (
    <div className="glass-card rounded-[2rem] p-6 bg-white/70 border border-secondary-400 hover:border-primary-200 hover:shadow-xl hover:shadow-primary-500/5 transition-all relative">
      <div className="flex items-center gap-5">
        <div className="h-16 w-16 rounded-[1.5rem] bg-amber-50 border border-amber-100 flex flex-col items-center justify-center shrink-0">
          <span className="text-[8px] font-bold text-amber-600 uppercase tracking-widest">Pos</span>
          <span className="text-base font-black text-amber-700 tracking-tight">
            {ticket.queue_position}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Hash className="h-3.5 w-3.5 text-secondary-400" />
            <span className="text-[11px] font-mono font-bold text-secondary-500 uppercase tracking-tight">
              {ticket.queue_number}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center text-[11px] font-black shadow-md">
              {patientInitials(ticket)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-secondary-900 truncate">{patientName(ticket)}</p>
              <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Waiting {timeSince(ticket.created_at)}
                {ticket.visit?.visit_code && (
                  <>
                    <span className="text-secondary-200">·</span>
                    <Link
                      to={`/visits/${ticket.visit_id}`}
                      className="hover:text-primary-600 transition-colors"
                    >
                      {ticket.visit.visit_code}
                    </Link>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCall}
            disabled={isPending}
            className="btn-primary gap-2 px-5 py-2.5 text-[11px] uppercase tracking-widest shadow-md disabled:opacity-50"
          >
            <PhoneCall className="h-3.5 w-3.5" />
            <span>Call</span>
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              onBlur={() => setTimeout(() => setMenuOpen(false), 180)}
              className="p-2.5 rounded-xl hover:bg-secondary-100 transition-colors"
            >
              <MoreHorizontal className="h-4 w-4 text-secondary-500" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-12 z-20 w-44 bg-white rounded-2xl shadow-xl border border-secondary-400 py-2 animate-fade-in">
                <MenuItem icon={Shuffle} label="Transfer" onClick={onTransfer} />
                <MenuItem icon={Ban} label="Cancel" onClick={onCancel} tone="rose" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type ServingCardProps = {
  ticket: QueueTicket;
  onServe: () => void;
  onComplete: () => void;
  onCompleteRoute: () => void;
  onCompleteEndVisit: () => void;
  onMiss: () => void;
  onCancel: () => void;
  onTransfer: () => void;
  onOpenConsultation: () => void;
};

function ServingCard({
  ticket,
  onServe,
  onComplete,
  onCompleteRoute,
  onCompleteEndVisit,
  onMiss,
  onCancel,
  onTransfer,
  onOpenConsultation,
}: ServingCardProps) {
  const status = (ticket.status || "").toUpperCase();
  const isCalled = status === "CALLED";
  const isServing = status === "SERVING";

  return (
    <div className="glass-card rounded-[2rem] p-7 bg-slate-900 text-white shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="text-3xl font-display font-black tracking-tight">
            {ticket.queue_number}
          </span>
          <span
            className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border ${isCalled
                ? "bg-primary-500/20 text-primary-200 border-primary-500/30"
                : "bg-emerald-500/20 text-emerald-200 border-emerald-500/30"
              }`}
          >
            {status}
          </span>
        </div>
        {isCalled && (
          <div className="h-9 w-9 rounded-xl bg-primary-500 text-white flex items-center justify-center animate-pulse">
            <Volume2 className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mb-5">
        <div className="h-11 w-11 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-xs font-black">
          {patientInitials(ticket)}
        </div>
        <div className="min-w-0">
          <p className="text-base font-bold truncate">{patientName(ticket)}</p>
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
            {ticket.called_at && (
              <>
                <Clock className="h-3 w-3" />
                Called {formatTime(ticket.called_at)}
              </>
            )}
            {ticket.visit?.visit_code && (
              <>
                <span>·</span>
                <Link
                  to={`/visits/${ticket.visit_id}`}
                  className="hover:text-primary-200 transition-colors"
                >
                  {ticket.visit.visit_code}
                </Link>
              </>
            )}
          </p>
        </div>
      </div>

      <button
        onClick={onOpenConsultation}
        className="w-full mb-2 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-[11px] font-bold uppercase tracking-widest transition-all"
      >
        <Stethoscope className="h-4 w-4" />
        Open Consultation
      </button>

      <div className="grid grid-cols-2 gap-2">
        {isCalled && (
          <button
            onClick={onServe}
            className="col-span-2 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-widest transition-all"
          >
            <PlayCircle className="h-4 w-4" />
            Start Serving
          </button>
        )}
        {isServing && (
          <>
            <ActionPill
              icon={CheckSquare}
              label="Complete"
              onClick={onComplete}
              tone="emerald"
            />
            <ActionPill
              icon={ArrowRight}
              label="Complete & Route"
              onClick={onCompleteRoute}
              tone="primary"
            />
            <ActionPill
              icon={LogOut}
              label="End Visit"
              onClick={onCompleteEndVisit}
              tone="emerald"
            />
            <ActionPill
              icon={Shuffle}
              label="Transfer"
              onClick={onTransfer}
              tone="amber"
            />
          </>
        )}
        {isCalled && (
          <>
            <ActionPill icon={UserX} label="Miss" onClick={onMiss} tone="amber" />
            <ActionPill icon={Shuffle} label="Transfer" onClick={onTransfer} tone="amber" />
          </>
        )}
        <ActionPill icon={Ban} label="Cancel" onClick={onCancel} tone="rose" />
      </div>
    </div>
  );
}

type ActionPillTone = "emerald" | "primary" | "amber" | "rose";

const pillTones: Record<ActionPillTone, string> = {
  emerald: "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border-emerald-500/20",
  primary: "bg-primary-500/15 hover:bg-primary-500/25 text-primary-200 border-primary-500/20",
  amber: "bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border-amber-500/20",
  rose: "bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border-rose-500/20",
};

function ActionPill({
  icon: Icon,
  label,
  onClick,
  tone,
}: {
  icon: typeof CheckSquare;
  label: string;
  onClick: () => void;
  tone: ActionPillTone;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${pillTones[tone]}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  tone = "default",
}: {
  icon: typeof Shuffle;
  label: string;
  onClick: () => void;
  tone?: "default" | "rose";
}) {
  return (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-left transition-colors ${tone === "rose"
          ? "text-rose-600 hover:bg-rose-50"
          : "text-secondary-700 hover:bg-secondary-50"
        }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// ---------------- Stat Card ----------------

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
  subtitle,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  subtitle?: string;
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
      {subtitle && (
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-2 truncate">
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ---------------- Action Modal ----------------

type ActionModalProps = {
  kind: Exclude<ActionKind, null>;
  ticket: QueueTicket;
  note: string;
  onNoteChange: (value: string) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  transferTargetSdp: number | null;
  onTransferTargetChange: (value: number | null) => void;
  sdps: ServiceDeliveryPoint[];
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
};

const actionMeta: Record<
  Exclude<ActionKind, null>,
  { title: string; subtitle: string; cta: string; icon: typeof PhoneCall; tone: StatTone }
> = {
  call: {
    title: "Call Patient",
    subtitle: "Announce This Ticket To The Queue Display",
    cta: "Call Now",
    icon: PhoneCall,
    tone: "primary",
  },
  serve: {
    title: "Start Service",
    subtitle: "Begin The Clinical Encounter",
    cta: "Start Serving",
    icon: PlayCircle,
    tone: "emerald",
  },
  complete: {
    title: "Complete Service",
    subtitle: "Mark The Encounter Complete",
    cta: "Complete",
    icon: CheckSquare,
    tone: "emerald",
  },
  "complete-route": {
    title: "Complete & Route",
    subtitle: "Finish Here, Then Send To Next Step",
    cta: "Complete & Route",
    icon: ArrowRight,
    tone: "primary",
  },
  "complete-end-visit": {
    title: "Complete & End Visit",
    subtitle: "Finish Service And Close The Visit",
    cta: "Complete & End",
    icon: LogOut,
    tone: "emerald",
  },
  cancel: {
    title: "Cancel Ticket",
    subtitle: "Remove Patient From The Queue",
    cta: "Cancel Ticket",
    icon: Ban,
    tone: "rose",
  },
  transfer: {
    title: "Transfer Ticket",
    subtitle: "Send To A Different Service Point",
    cta: "Transfer",
    icon: Shuffle,
    tone: "amber",
  },
};

function ActionModal({
  kind,
  ticket,
  note,
  onNoteChange,
  reason,
  onReasonChange,
  transferTargetSdp,
  onTransferTargetChange,
  sdps,
  pending,
  error,
  onClose,
  onSubmit,
}: ActionModalProps) {
  const meta = actionMeta[kind];
  const Icon = meta.icon;
  const isCancel = kind === "cancel";
  const isTransfer = kind === "transfer";
  const showNote = !isCancel; // Cancel uses reason, others use note (incl. transfer optional reason)

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
            className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-xl ${statToneStyles[meta.tone]
              }`}
          >
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-black font-display tracking-tight">{meta.title}</h3>
            <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
              {meta.subtitle}
            </p>
          </div>
        </div>

        {/* Ticket summary */}
        <div className="mb-6 p-5 rounded-2xl bg-secondary-50 border border-secondary-400 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-mono font-bold">
            {ticket.queue_number}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-secondary-900 truncate">
              {patientName(ticket)}
            </p>
            <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mt-0.5 flex items-center gap-2">
              <User className="h-3 w-3" />
              Patient #{ticket.patient_id}
              <span>·</span>
              Position {ticket.queue_position}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm font-bold">{error}</span>
          </div>
        )}

        <div className="space-y-5">
          {isTransfer && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                Destination Service Point *
              </label>
              <select
                value={transferTargetSdp ?? ""}
                onChange={(e) =>
                  onTransferTargetChange(e.target.value ? Number(e.target.value) : null)
                }
                className="input-field h-12 bg-secondary-50 border-secondary-400 w-full"
              >
                <option value="">Select destination...</option>
                {sdps.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {isCancel ? (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                Cancellation Reason *
              </label>
              <textarea
                value={reason}
                onChange={(e) => onReasonChange(e.target.value)}
                placeholder="Why is this ticket being cancelled?"
                className="input-field h-32 bg-secondary-50 border-secondary-400 w-full resize-none py-3"
              />
            </div>
          ) : showNote ? (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                {isTransfer ? "Reason (Optional)" : "Note (Optional)"}
              </label>
              <textarea
                value={isTransfer ? reason : note}
                onChange={(e) =>
                  isTransfer ? onReasonChange(e.target.value) : onNoteChange(e.target.value)
                }
                placeholder={
                  isTransfer
                    ? "Why is this ticket being transferred?"
                    : "Add a note for this action..."
                }
                className="input-field h-28 bg-secondary-50 border-secondary-400 w-full resize-none py-3"
              />
            </div>
          ) : null}
        </div>

        <div className="pt-8 flex gap-4">
          <button
            onClick={onClose}
            disabled={pending}
            className="flex-1 btn-secondary py-4 rounded-2xl font-bold disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={pending}
            className={`flex-[2] py-4 rounded-2xl font-black tracking-tight shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 transition-all ${meta.tone === "rose"
                ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20"
                : meta.tone === "amber"
                  ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20"
                  : meta.tone === "emerald"
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20"
                    : "bg-primary-600 hover:bg-primary-700 text-white shadow-primary-500/20"
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
