import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Ban, Check, CheckCircle2, Clock, CornerUpRight, FileText, GitBranch, Hash,
  MessageSquare, Printer, Undo2, XCircle, X, ShieldCheck, User as UserIcon, ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/feedback/ToastProvider";
import { cn } from "@/lib/utils/cn";
import { getStoredUser } from "@/lib/auth/current-user";
import {
  useApprovalRequest, useDecideApproval, useCancelApproval, useMyPendingApprovals,
} from "../hooks/use-approvals";
import type { ApprovalStep, ApprovalLog, ApprovalRequestStatus } from "../api/approvals.api";

const statusVariant: Record<ApprovalRequestStatus, BadgeProps["variant"]> = {
  DRAFT: "secondary", PENDING: "soft-warning", IN_PROGRESS: "soft-info",
  APPROVED: "soft-success", REJECTED: "soft-danger", CANCELLED: "secondary",
  RETURNED: "soft-warning", EXPIRED: "soft-danger",
};

function fmt(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** "Wed, 15 Jul 2026" — the date style used on the timeline. */
function fmtDay(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

function fmtTime(v?: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function labelize(key: string): string {
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()).replace(/\B\w/g, (m) => m.toLowerCase());
}

/** Where each request type's source records live in the app. */
const SOURCE_MODULE_ROUTES: Record<string, { path: string; label: string }> = {
  TIMESHEET: { path: "/staff/timesheets", label: "My Timesheets" },
  LEAVE_REQUEST: { path: "/hr/my-leave", label: "My Leave" },
  SALARY_ADVANCE: { path: "/staff/finance", label: "Staff Financial Services" },
  REIMBURSEMENT: { path: "/staff/finance", label: "Staff Financial Services" },
  PAYROLL_RUN: { path: "/payroll", label: "Payroll" },
};

// ─────────────────────────────────────────────────────────────────────
// Timeline model — every request type renders through the SAME rows,
// so the section looks identical for timesheets, leave, finance, payroll
// and any custom request type.
// ─────────────────────────────────────────────────────────────────────

type NodeState = "done" | "current" | "rejected" | "returned" | "cancelled" | "pending";

const NODE_RING: Record<NodeState, string> = {
  done: "ring-emerald-200",
  current: "ring-primary-200",
  rejected: "ring-rose-200",
  returned: "ring-amber-200",
  cancelled: "ring-secondary-200",
  pending: "ring-secondary-200",
};

type TimelineItem = {
  key: string;
  title: string;
  state: NodeState;
  /** Circle content for steps that haven't happened yet. */
  order?: number;
  badge?: { label: string; variant: BadgeProps["variant"] } | null;
  /** Fallback lines when there is no decision log yet. */
  actorLine?: string | null;
  dateValue?: string | null;
  pendingLine?: string | null;
  /** Signature shown for the fallback actor (submit node). */
  signature?: { url?: string | null; name?: string | null } | null;
  photo?: string | null;
  photoAlt: string;
  photoFallback?: string;
  /** Full decision logs (approve/reject/return) rendered as blocks. */
  decisions?: ApprovalLog[];
  /** Comments + delegations rendered as small note lines. */
  notes?: ApprovalLog[];
  /** Muted config line (approver kind, rule…). */
  meta?: string | null;
};

function ActorAvatar({ src, alt, size = "h-9 w-9", shape = "rounded-xl", ring = "ring-1 ring-secondary-200", fallbackClass = "bg-primary-500/10 text-primary-600" }: {
  src?: string | null; alt: string; size?: string; shape?: string; ring?: string; fallbackClass?: string;
}) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return (
      <img src={src} alt={alt} onError={() => setBroken(true)}
        className={`${size} shrink-0 ${shape} object-cover ${ring}`} />
    );
  }
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center ${shape} ${ring} ${fallbackClass}`}>
      <UserIcon className="h-4 w-4" />
    </span>
  );
}

/** Signature image with the "SIGNED · NAME" caption. */
function SignatureBlock({ url, name }: { url?: string | null; name?: string | null }) {
  if (!url) return null;
  return (
    <div className="mt-3">
      <img src={url} alt={`${name || "Approver"} signature`} className="h-10 max-w-[12rem] object-contain" />
      <div className="mt-1 w-48 max-w-full border-t border-secondary-200 pt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-secondary-400">
        Signed · {name || "—"}
      </div>
    </div>
  );
}

/** One block of "who actioned + date + signature" inside a timeline entry. */
function DecisionBlock({ l }: { l: ApprovalLog }) {
  return (
    <div>
      <p className="text-sm text-secondary-600">{l.actor_name || "System"}</p>
      <p className="text-sm text-secondary-500">
        Date: {fmtDay(l.created_at)}
        {fmtTime(l.created_at) && <span className="text-secondary-300"> · {fmtTime(l.created_at)}</span>}
      </p>
      {l.comment && (
        <p className="mt-2 rounded-xl bg-secondary-50 px-3 py-2 text-xs text-secondary-500">"{l.comment}"</p>
      )}
      <SignatureBlock url={l.actor_signature_url} name={l.actor_name} />
    </div>
  );
}

/** The round timeline node icon. */
function NodeCircle({ state, order }: { state: NodeState; order?: number }) {
  const cls =
    state === "done" ? "border-emerald-500 text-emerald-500 bg-white"
      : state === "current" ? "border-primary-500 text-primary-600 bg-white ring-4 ring-primary-500/15"
      : state === "rejected" ? "border-rose-500 text-rose-500 bg-white"
      : state === "returned" ? "border-amber-500 text-amber-600 bg-white"
      : state === "cancelled" ? "border-secondary-300 text-secondary-400 bg-white"
      : "border-secondary-200 text-secondary-300 bg-white";
  return (
    <span className={cn("relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black", cls)}>
      {state === "done" ? <Check className="h-4 w-4" strokeWidth={3} />
        : state === "rejected" ? <X className="h-4 w-4" strokeWidth={3} />
        : state === "returned" ? <Undo2 className="h-4 w-4" strokeWidth={3} />
        : state === "cancelled" ? <Ban className="h-4 w-4" />
        : state === "current" ? <Clock className="h-4 w-4" />
        : order ?? "•"}
    </span>
  );
}

/** One row of the timeline — the single renderer every entry goes through. */
function TimelineRow({ item, isLast }: { item: TimelineItem; isLast: boolean }) {
  return (
    <li className="relative flex gap-5">
      <div className="flex flex-col items-center">
        <NodeCircle state={item.state} order={item.order} />
        {!isLast && <span className={cn("w-0.5 flex-1", item.state === "done" ? "bg-emerald-400" : "bg-secondary-200")} />}
      </div>
      <div className={cn("min-w-0 flex-1 pb-8", !isLast && "border-b border-secondary-100 mb-8")}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-black text-secondary-900 leading-tight">{item.title}</p>
              {item.badge && <Badge variant={item.badge.variant}>{item.badge.label}</Badge>}
            </div>

            {item.decisions && item.decisions.length > 0 ? (
              <div className="mt-1 space-y-4">
                {item.decisions.map((l) => <DecisionBlock key={l.id} l={l} />)}
              </div>
            ) : (
              <>
                {item.actorLine && <p className="mt-1 text-sm text-secondary-600">{item.actorLine}</p>}
                {item.dateValue !== undefined && item.dateValue !== null && (
                  <p className="text-sm text-secondary-500">
                    Date: {fmtDay(item.dateValue)}
                    {fmtTime(item.dateValue) && <span className="text-secondary-300"> · {fmtTime(item.dateValue)}</span>}
                  </p>
                )}
                {item.pendingLine && <p className="text-sm text-secondary-400">{item.pendingLine}</p>}
                {item.signature?.url && <SignatureBlock url={item.signature.url} name={item.signature.name} />}
              </>
            )}

            {item.meta && (
              <p className="mt-2 text-[11px] font-medium text-secondary-400">{item.meta}</p>
            )}

            {item.notes && item.notes.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {item.notes.map((l) => (
                  <li key={l.id} className="flex items-start gap-1.5 text-xs text-secondary-500">
                    {l.action === "DELEGATE"
                      ? <CornerUpRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-secondary-300" />
                      : <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-secondary-300" />}
                    <span>
                      {l.action === "DELEGATE"
                        ? <><span className="font-semibold">{l.actor_name || "System"}</span> delegated this step{l.comment ? <> — "{l.comment}"</> : null} · {fmtDay(l.created_at)}</>
                        : <>"{l.comment}" — <span className="font-semibold">{l.actor_name || "System"}</span>, {fmtDay(l.created_at)}</>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <ActorAvatar
            src={item.photo}
            alt={item.photoAlt}
            size="h-12 w-12" shape="rounded-full"
            ring={cn("ring-2", NODE_RING[item.state])}
            fallbackClass={item.photoFallback ?? "bg-secondary-100 text-secondary-300"}
          />
        </div>
      </div>
    </li>
  );
}

export function ApprovalRequestPage() {
  const { requestId } = useParams();
  const id = Number(requestId);
  const navigate = useNavigate();
  const toast = useToast();

  const { data: req, isLoading, isError } = useApprovalRequest(Number.isFinite(id) ? id : undefined);
  const pending = useMyPendingApprovals();
  const decide = useDecideApproval();
  const cancel = useCancelApproval();
  const [comment, setComment] = useState("");

  const me = getStoredUser() as any;
  const canAct = useMemo(
    () => req?.status === "IN_PROGRESS" && (pending.data ?? []).some((p) => p.id === req?.id),
    [req?.status, req?.id, pending.data],
  );
  const isRequester = !!req && !!me?.id && Number(me.id) === req.requester_user_id;

  async function act(action: "APPROVE" | "REJECT" | "RETURN" | "COMMENT") {
    if (!req) return;
    if ((action === "REJECT" || action === "RETURN") && !comment.trim()) {
      toast.error("Reason required", action === "RETURN" ? "Explain what needs correcting before returning." : "Add a comment explaining the rejection.");
      return;
    }
    try {
      await decide.mutateAsync({ id: req.id, action, comment: comment.trim() || undefined });
      toast.success(
        action === "APPROVE" ? "Approved" : action === "RETURN" ? "Returned for correction" : action === "REJECT" ? "Rejected" : "Comment added",
        action === "APPROVE" ? "Your approval has been recorded." :
        action === "RETURN" ? "The requester can correct and resubmit." :
        action === "REJECT" ? "The request has been rejected." : undefined,
      );
      setComment("");
    } catch (err: any) {
      const d = err?.response?.data?.detail ?? err?.response?.data?.message;
      toast.error("Action failed", typeof d === "string" ? d : "Please try again.");
    }
  }

  async function handleCancel() {
    if (!req) return;
    try {
      await cancel.mutateAsync(req.id);
      toast.success("Cancelled", "The request was cancelled.");
    } catch {
      toast.error("Couldn't cancel", "Please try again.");
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in pb-16">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 lg:col-span-2" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (isError || !req) {
    return (
      <div className="pt-16">
        <EmptyState icon={FileText} title="Request not found" description="This request doesn't exist or was removed."
          action={<Button variant="secondary" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate("/approvals")}>Back to Requests</Button>} />
      </div>
    );
  }

  const payloadEntries = Object.entries(req.payload ?? {}).filter(([, v]) => v !== null && v !== undefined && typeof v !== "object");

  // ── Build the timeline (identical structure for every request type) ──
  const steps = [...req.steps].sort((a, b) => a.step_order - b.step_order);
  const firstStepOrder = steps.length ? steps[0].step_order : null;
  const submitted = req.status !== "DRAFT";
  const submitLogs = req.logs.filter((l) => l.action === "SUBMIT").sort((a, b) => a.id - b.id);
  const submitLog = submitLogs[submitLogs.length - 1];

  const stepState = (s: ApprovalStep): NodeState => {
    const isPast = req.current_step_order != null && s.step_order < (req.current_step_order ?? 0);
    if (req.status === "APPROVED" || isPast) return "done";
    const failedHere = (req.status === "REJECTED" || req.status === "RETURNED") &&
      req.logs.some((l) => l.step_order === s.step_order && (l.action === "REJECT" || l.action === "RETURN"));
    if (failedHere) return req.status === "RETURNED" ? "returned" : "rejected";
    if (req.status === "IN_PROGRESS" && s.step_order === req.current_step_order) return "current";
    return "pending";
  };

  const clearedSteps = steps.filter((s) => stepState(s) === "done").length;

  const items: TimelineItem[] = [];

  // 1) Submitted By — always the first node, for every request type.
  items.push({
    key: "submit",
    title: "Submitted By",
    state: submitted ? "done" : "pending",
    badge: submitLogs.length > 1 ? { label: `Resubmitted ×${submitLogs.length - 1}`, variant: "soft-warning" } : null,
    actorLine: req.requester_name || `User #${req.requester_user_id}`,
    dateValue: submitted ? (submitLog?.created_at || req.submitted_at) : null,
    pendingLine: submitted ? null : "Not submitted yet — still a draft.",
    signature: { url: submitLog?.actor_signature_url || req.requester_signature_url, name: req.requester_name },
    photo: req.requester_photo_url,
    photoAlt: req.requester_name || "Requester",
    photoFallback: "bg-primary-500/10 text-primary-600",
  });

  // 2) One node per configured approval step.
  const stepOrders = new Set(steps.map((s) => s.step_order));
  for (const s of steps) {
    const state = stepState(s);
    const stepLogs = req.logs.filter((l) => l.step_order === s.step_order && l.action !== "SUBMIT").sort((a, b) => a.id - b.id);
    const decisions = stepLogs.filter((l) => l.action === "APPROVE" || l.action === "REJECT" || l.action === "RETURN");
    const notes = stepLogs.filter((l) => l.action === "COMMENT" || l.action === "DELEGATE");
    const primaryActor = decisions[decisions.length - 1];
    const approverLabel = s.dynamic_token ? labelize(s.dynamic_token) : labelize(s.approver_kind);
    const awaitingName = s.step_order === firstStepOrder && req.assigned_approver_name ? req.assigned_approver_name : approverLabel;
    const approveCount = decisions.filter((l) => l.action === "APPROVE").length;
    items.push({
      key: `step-${s.step_order}`,
      title: s.name,
      state,
      order: s.step_order,
      badge: state === "current" ? { label: "Current step", variant: "soft-info" }
        : state === "returned" ? { label: "Returned here", variant: "soft-warning" }
        : state === "rejected" ? { label: "Rejected here", variant: "soft-danger" }
        : null,
      actorLine: state === "current" ? `Awaiting ${awaitingName}` : "Awaiting earlier steps",
      dateValue: null,
      pendingLine: state === "current" ? "In progress — no decision recorded yet." : "Pending",
      decisions,
      notes,
      meta: `Approver: ${approverLabel} · Rule: ${labelize(s.decision_rule)}${s.decision_rule === "N_OF_M" ? ` — needs ${s.required_approvals}` : ""}${approveCount > 1 ? ` · ${approveCount} approvals recorded` : ""}`,
      photo: primaryActor?.actor_photo_url,
      photoAlt: primaryActor?.actor_name || s.name,
    });
  }

  // 3) Orphan step logs — activity recorded against a step that is no longer
  //    on the flow (flow edited after submission, legacy data…). Rendered the
  //    same way so no history is ever hidden, whatever the request type.
  const orphanOrders = [...new Set(
    req.logs.filter((l) => l.step_order != null && !stepOrders.has(l.step_order) && l.action !== "SUBMIT").map((l) => l.step_order as number),
  )].sort((a, b) => a - b);
  for (const order of orphanOrders) {
    const logs = req.logs.filter((l) => l.step_order === order && l.action !== "SUBMIT").sort((a, b) => a.id - b.id);
    const decisions = logs.filter((l) => l.action === "APPROVE" || l.action === "REJECT" || l.action === "RETURN");
    const notes = logs.filter((l) => l.action === "COMMENT" || l.action === "DELEGATE");
    const last = decisions[decisions.length - 1];
    const state: NodeState = last?.action === "REJECT" ? "rejected" : last?.action === "RETURN" ? "returned" : "done";
    items.push({
      key: `orphan-${order}`,
      title: logs.find((l) => l.step_name)?.step_name || `Step ${order}`,
      state,
      order,
      badge: { label: "Earlier flow version", variant: "secondary" },
      decisions,
      notes,
      photo: last?.actor_photo_url,
      photoAlt: last?.actor_name || `Step ${order}`,
    });
  }

  // 4) Request-level events (cancellation etc.) close the timeline.
  const requestLevelLogs = req.logs.filter((l) => l.step_order == null && l.action !== "SUBMIT").sort((a, b) => a.id - b.id);
  for (const l of requestLevelLogs) {
    items.push({
      key: `event-${l.id}`,
      title: l.action === "CANCEL" ? "Request Cancelled" : labelize(l.action),
      state: l.action === "CANCEL" ? "cancelled" : "done",
      decisions: [l],
      photo: l.actor_photo_url,
      photoAlt: l.actor_name || "Actor",
    });
  }

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      <Link to="/approvals" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-secondary-500 hover:text-secondary-900 print:hidden">
        <ArrowLeft className="h-4 w-4" /> Requests
      </Link>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <Badge variant={statusVariant[req.status]}>{req.status.replace("_", " ")}</Badge>
            <span className="text-xs font-bold uppercase tracking-widest text-secondary-400">{req.request_type_code}</span>
            {req.flow_name && <span className="text-xs text-secondary-400">· Flow: {req.flow_name}</span>}
            <span className="text-xs text-secondary-300 font-mono">#{req.id}</span>
          </div>
          <PageHeader title={req.title} description={req.description || "Request progress, approval history and decisions."} />
        </div>
        <div className="shrink-0 print:hidden">
          <Button
            variant="secondary"
            leftIcon={<Printer className="h-4 w-4" />}
            onClick={() => window.print()}
            title="Print this page or choose 'Save as PDF' in the print dialog"
          >
            Print / Save PDF
          </Button>
        </div>
      </div>

      {req.decision_summary && (
        <div className={cn("rounded-2xl border p-4 text-sm font-bold flex items-center gap-3",
          req.status === "APPROVED" ? "bg-emerald-50 border-emerald-100 text-emerald-700"
            : req.status === "RETURNED" ? "bg-amber-50 border-amber-100 text-amber-700"
            : "bg-rose-50 border-rose-100 text-rose-600")}>
          {req.status === "APPROVED" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : req.status === "RETURNED" ? <Undo2 className="h-5 w-5 shrink-0" /> : <XCircle className="h-5 w-5 shrink-0" />}
          {req.decision_summary}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3 items-start print:block">
        {/* ── Left: details + progress & history ── */}
        <div className="lg:col-span-2 space-y-6">
          <Card variant="panel" className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-secondary-500 mb-4">Request details</p>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-3">
                <ActorAvatar src={req.requester_photo_url} alt={req.requester_name || "Requester"} />
                <div><span className="text-secondary-400 text-xs block">Requested by</span><span className="font-semibold text-secondary-900">{req.requester_name || `User #${req.requester_user_id}`}</span></div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600"><Hash className="h-4 w-4" /></span>
                <div><span className="text-secondary-400 text-xs block">Reference</span><span className="font-semibold text-secondary-900 font-mono">REQ-{String(req.id).padStart(6, "0")}</span></div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600"><FileText className="h-4 w-4" /></span>
                <div><span className="text-secondary-400 text-xs block">Request type</span><span className="font-semibold text-secondary-900">{labelize(req.request_type_code)}</span></div>
              </div>
              {req.flow_name && (
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600"><GitBranch className="h-4 w-4" /></span>
                  <div><span className="text-secondary-400 text-xs block">Approval flow</span><span className="font-semibold text-secondary-900">{req.flow_name}</span></div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600"><Clock className="h-4 w-4" /></span>
                <div><span className="text-secondary-400 text-xs block">Submitted</span><span className="font-semibold text-secondary-900">{fmt(req.submitted_at)}</span></div>
              </div>
              {req.completed_at && (
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="h-4 w-4" /></span>
                  <div><span className="text-secondary-400 text-xs block">Completed</span><span className="font-semibold text-secondary-900">{fmt(req.completed_at)}</span></div>
                </div>
              )}
              {req.current_step_name && (
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600"><ShieldCheck className="h-4 w-4" /></span>
                  <div><span className="text-secondary-400 text-xs block">Current stage</span><span className="font-semibold text-secondary-900">{req.current_step_name}</span></div>
                </div>
              )}
            </div>

            {/* Progress bar across the flow */}
            {steps.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center justify-between text-[11px] font-bold text-secondary-400 mb-1.5">
                  <span className="uppercase tracking-widest">Progress</span>
                  <span>{clearedSteps} of {steps.length} step{steps.length === 1 ? "" : "s"} cleared</span>
                </div>
                <div className="h-2 rounded-full bg-secondary-100 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all",
                      req.status === "REJECTED" ? "bg-rose-400" : req.status === "RETURNED" ? "bg-amber-400" : "bg-emerald-500")}
                    style={{ width: `${steps.length ? Math.max(4, Math.round((clearedSteps / steps.length) * 100)) : 0}%` }}
                  />
                </div>
              </div>
            )}

            {req.subject_id && SOURCE_MODULE_ROUTES[req.request_type_code] && (
              <Link to={SOURCE_MODULE_ROUTES[req.request_type_code].path}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:underline">
                <ExternalLink className="h-3.5 w-3.5" />
                Open source record in {SOURCE_MODULE_ROUTES[req.request_type_code].label} (record #{req.subject_id})
              </Link>
            )}

            {payloadEntries.length > 0 && (
              <div className="mt-6 rounded-2xl bg-secondary-50/70 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400 mb-3">Attached data</p>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {payloadEntries.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 border-b border-secondary-100/70 py-1.5">
                      <span className="text-secondary-500">{labelize(k)}</span>
                      <span className="font-semibold text-secondary-900 text-right">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* ── Approval progress & history — one unified timeline ── */}
          <Card variant="panel" className="p-6 sm:p-8">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2.5 text-xs font-black uppercase tracking-[0.22em] text-secondary-800">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-600">
                  <Clock className="h-4 w-4" />
                </span>
                Approval progress &amp; history
              </p>
              {steps.length > 0 && (
                <span className="rounded-full bg-secondary-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-secondary-500">
                  {clearedSteps} of {steps.length} cleared
                </span>
              )}
            </div>

            <ol>
              {items.map((item, idx) => (
                <TimelineRow key={item.key} item={item} isLast={idx === items.length - 1} />
              ))}
            </ol>

            {steps.length === 0 && orphanOrders.length === 0 && (
              <p className="mt-2 text-xs italic text-secondary-400">
                No approval steps are configured for this request type yet — an administrator can add a flow under Approval Flows.
              </p>
            )}
          </Card>
        </div>

        {/* ── Right: decision panel (never printed) ── */}
        <div className="space-y-6 lg:sticky lg:top-6 print:hidden">
          <Card variant="panel" className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-secondary-500 mb-4">Your decision</p>
            {req.status !== "IN_PROGRESS" ? (
              <p className="text-sm text-secondary-500">
                This request is <span className="font-bold">{req.status.replace("_", " ").toLowerCase()}</span> — no further decisions are needed.
                {req.status === "RETURNED" && " The requester can correct the record and resubmit it."}
              </p>
            ) : !canAct ? (
              <p className="text-sm text-secondary-500">
                {pending.isLoading
                  ? "Checking your eligibility…"
                  : "You are not an approver for the current step. The assigned approver will action this request."}
              </p>
            ) : (
              <div className="space-y-4">
                <Textarea
                  label="Comment"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a note — required when returning or rejecting…"
                  hint="Required for Return for Correction and Reject."
                />
                <div className="space-y-2.5">
                  <Button className="w-full" onClick={() => act("APPROVE")} isLoading={decide.isPending} leftIcon={<Check className="h-4 w-4" />}>
                    Approve
                  </Button>
                  <Button variant="secondary" className="w-full !text-amber-600" onClick={() => act("RETURN")} isLoading={decide.isPending} leftIcon={<Undo2 className="h-4 w-4" />}>
                    Return for Correction
                  </Button>
                  <Button variant="danger" className="w-full" onClick={() => act("REJECT")} isLoading={decide.isPending} leftIcon={<XCircle className="h-4 w-4" />}>
                    Reject
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={() => act("COMMENT")} isLoading={decide.isPending} leftIcon={<MessageSquare className="h-4 w-4" />}>
                    Comment only
                  </Button>
                </div>
                <p className="text-[11px] text-secondary-400 leading-relaxed">
                  <span className="font-bold text-amber-600">Return for Correction</span> sends the request back to the requester as a draft so they can fix and resubmit.
                  <span className="font-bold text-rose-500"> Reject</span> is final.
                </p>
              </div>
            )}
          </Card>

          {isRequester && req.status === "IN_PROGRESS" && (
            <Card variant="panel" className="p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-secondary-500 mb-3">Requester actions</p>
              <Button variant="ghost" className="w-full text-rose-500" onClick={handleCancel} isLoading={cancel.isPending} leftIcon={<Ban className="h-4 w-4" />}>
                Cancel this request
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
