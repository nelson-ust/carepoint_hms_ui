import { useState } from "react";
import { Check, X, MessageSquare, Ban, Clock, CheckCircle2, XCircle, CircleDot, Undo2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Modal } from "@/components/ui/Modal";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { cn } from "@/lib/utils/cn";
import { useApprovalRequest, useDecideApproval, useCancelApproval } from "../hooks/use-approvals";
import type { ApprovalRequestStatus } from "../api/approvals.api";

const statusVariant: Record<ApprovalRequestStatus, BadgeProps["variant"]> = {
  DRAFT: "secondary", PENDING: "soft-warning", IN_PROGRESS: "soft-info",
  APPROVED: "soft-success", REJECTED: "soft-danger", CANCELLED: "secondary", RETURNED: "soft-warning", EXPIRED: "soft-danger",
};

function fmt(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const actionIcon: Record<string, any> = { APPROVE: Check, REJECT: X, COMMENT: MessageSquare, CANCEL: Ban, SUBMIT: CircleDot, DELEGATE: CircleDot, RETURN: Undo2 };

type Props = { requestId: number | null; isOpen: boolean; onClose: () => void };

export function ApprovalDetailModal({ requestId, isOpen, onClose }: Props) {
  const toast = useToast();
  const { data: req, isLoading } = useApprovalRequest(isOpen ? requestId ?? undefined : undefined);
  const decide = useDecideApproval();
  const cancel = useCancelApproval();
  const [comment, setComment] = useState("");

  const actionable = req?.status === "IN_PROGRESS";

  async function act(action: "APPROVE" | "REJECT" | "COMMENT" | "RETURN") {
    if (!req) return;
    if ((action === "REJECT" || action === "RETURN") && !comment.trim()) {
      toast.error("Reason required", action === "RETURN" ? "Explain what needs correcting." : "Add a comment explaining the rejection.");
      return;
    }
    try {
      await decide.mutateAsync({ id: req.id, action, comment: comment.trim() || undefined });
      toast.success(
        action === "APPROVE" ? "Approved" : action === "REJECT" ? "Rejected" : action === "RETURN" ? "Returned for correction" : "Comment added",
        action === "COMMENT" ? undefined : "The request has been updated.",
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={req ? req.title : "Approval Request"} size="lg">
      {isLoading || !req ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={statusVariant[req.status]}>{req.status.replace("_", " ")}</Badge>
            <span className="text-xs font-bold uppercase tracking-widest text-secondary-400">{req.request_type_code}</span>
            {req.flow_name && <span className="text-xs text-secondary-400">· {req.flow_name}</span>}
            <Link to={`/approvals/requests/${req.id}`} onClick={onClose} className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:underline">
              <ExternalLink className="h-3.5 w-3.5" /> Open full page
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-secondary-400 text-xs block">Requested by</span>{req.requester_name || `User #${req.requester_user_id}`}</div>
            <div><span className="text-secondary-400 text-xs block">Submitted</span>{fmt(req.submitted_at)}</div>
            {req.description && <div className="col-span-2"><span className="text-secondary-400 text-xs block">Details</span>{req.description}</div>}
          </div>

          {/* Steps */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-secondary-500 mb-3">Approval steps</p>
            <ol className="space-y-2">
              {req.steps.map((s) => {
                const isCurrent = s.step_order === req.current_step_order;
                const isPast = req.current_step_order != null && s.step_order < req.current_step_order;
                const done = req.status === "APPROVED" || isPast;
                return (
                  <li key={s.step_order} className={cn("flex items-center gap-3 rounded-2xl border p-3", isCurrent ? "border-primary-400/50 bg-primary-500/5" : "border-secondary-100")}>
                    <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black",
                      done ? "bg-emerald-500/15 text-emerald-600" : isCurrent ? "bg-primary-500/15 text-primary-600" : "bg-secondary-500/10 text-secondary-400")}>
                      {done ? <CheckCircle2 className="h-4 w-4" /> : isCurrent ? <Clock className="h-4 w-4" /> : s.step_order}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-secondary-900">{s.name}</div>
                      <div className="text-[11px] text-secondary-400">
                        {s.approver_kind}{s.dynamic_token ? ` · ${s.dynamic_token}` : ""} · {s.decision_rule}{s.decision_rule === "N_OF_M" ? ` (${s.required_approvals})` : ""}
                      </div>
                    </div>
                    {isCurrent && <Badge variant="soft-info">Current</Badge>}
                  </li>
                );
              })}
              {req.steps.length === 0 && <li className="text-xs text-secondary-400">No steps configured.</li>}
            </ol>
          </div>

          {/* Log timeline */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-secondary-500 mb-3">Approval log</p>
            <ul className="space-y-3">
              {req.logs.map((l) => {
                const Icon = actionIcon[l.action] ?? CircleDot;
                return (
                  <li key={l.id} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary-500/10 text-secondary-500"><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-secondary-800">
                        <span className="font-bold">{l.actor_name || "System"}</span>{" "}
                        <span className="text-secondary-500">{l.action.toLowerCase()}</span>
                        {l.step_name ? <span className="text-secondary-400"> · {l.step_name}</span> : null}
                      </p>
                      {l.comment && <p className="text-xs text-secondary-500 mt-0.5">"{l.comment}"</p>}
                      <p className="text-[11px] text-secondary-400 mt-0.5">{fmt(l.created_at)}</p>
                    </div>
                  </li>
                );
              })}
              {req.logs.length === 0 && <li className="text-xs text-secondary-400">No actions yet.</li>}
            </ul>
          </div>

          {/* Actions */}
          {actionable && (
            <div className="space-y-3 border-t border-secondary-100 pt-4">
              <Textarea label="Comment (required to reject)" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a note…" />
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => act("APPROVE")} isLoading={decide.isPending} leftIcon={<Check className="h-4 w-4" />}>Approve</Button>
                <Button variant="secondary" onClick={() => act("RETURN")} isLoading={decide.isPending} leftIcon={<Undo2 className="h-4 w-4" />} className="!text-amber-600">Return for Correction</Button>
                <Button variant="danger" onClick={() => act("REJECT")} isLoading={decide.isPending} leftIcon={<XCircle className="h-4 w-4" />}>Reject</Button>
                <Button variant="ghost" onClick={() => act("COMMENT")} isLoading={decide.isPending} leftIcon={<MessageSquare className="h-4 w-4" />}>Comment</Button>
                <Button variant="ghost" onClick={handleCancel} isLoading={cancel.isPending} leftIcon={<Ban className="h-4 w-4" />} className="ml-auto text-rose-500">Cancel request</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
