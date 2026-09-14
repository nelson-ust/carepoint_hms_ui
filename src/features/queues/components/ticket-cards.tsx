import {
  Receipt,
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock,
  History,
  LogOut,
  PhoneCall,
  PlayCircle,
  Shuffle,
  Stethoscope,
  UserX,
  Volume2,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";
import type { QueueTicket, QueueTicketStatus } from "../api/queues.api";

// ============================================================
// Shared helpers
// ============================================================

const STATUS_BADGE: Record<QueueTicketStatus, BadgeProps["variant"]> = {
  WAITING: "soft-warning",
  CALLED: "soft-info",
  SERVING: "success",
  SERVED: "soft-success",
  MISSED: "soft-danger",
  CANCELLED: "soft-danger",
  TRANSFERRED: "secondary",
};

export function StatusBadge({ status }: { status: QueueTicketStatus }) {
  return <Badge variant={STATUS_BADGE[status] ?? "secondary"}>{status}</Badge>;
}

export function PriorityBadge({ priority }: { priority?: number | null }) {
  const p = Number(priority ?? 0);
  if (p <= 0) return null;
  const label = p >= 30 ? "Emergency" : p >= 20 ? "Urgent" : "Priority";
  return <Badge variant="soft-warning">{label}</Badge>;
}

export function formatTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function timeSince(value?: string | null): string {
  if (!value) return "—";
  const start = new Date(value).getTime();
  if (Number.isNaN(start)) return "—";
  const minutes = Math.max(0, Math.floor((Date.now() - start) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
}

export function ticketPatientName(ticket: QueueTicket): string {
  return ticket.patient_name?.trim() || `Patient #${ticket.patient_id}`;
}

// ============================================================
// Small pieces
// ============================================================

export function LiveIndicator({ label = "Live · refreshes every 15s" }: { label?: string }) {
  return (
    <span className="flex items-center gap-2 text-xs font-bold text-secondary-500">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      {label}
    </span>
  );
}

export function SegmentButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors",
        active
          ? "bg-primary-500 text-white shadow-glow-sm"
          : "text-secondary-500 hover:bg-secondary-500/5 dark:hover:bg-white/5",
      )}
    >
      {label}
    </button>
  );
}

function PreviousSteps({ ticket }: { ticket: QueueTicket }) {
  if (!ticket.previous_steps.length) return null;
  return (
    <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-secondary-400">
      <History className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        {ticket.previous_steps
          .map(
            (s) =>
              `${s.service_delivery_point_name}${
                s.services_provided.length ? ` (${s.services_provided.join(", ")})` : ""
              }`,
          )
          .join(" → ")}
      </span>
    </p>
  );
}

// ============================================================
// Ticket cards
// ============================================================

export type WaitingTicketCardProps = {
  ticket: QueueTicket;
  busy: boolean;
  onCall: () => void;
  onServe: () => void;
  onMiss: () => void;
  onCancel: () => void;
  onTransfer: () => void;
};

export function WaitingTicketCard({
  ticket,
  busy,
  onCall,
  onServe,
  onMiss,
  onCancel,
  onTransfer,
}: WaitingTicketCardProps) {
  const isCalled = ticket.status === "CALLED";
  return (
    <Card padding="sm" className="transition-all hover:-translate-y-0.5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="data-mono rounded-2xl bg-amber-500/10 px-3 py-2 text-sm font-bold text-amber-600 dark:text-amber-300">
          {ticket.queue_number}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold text-secondary-900">
              {ticketPatientName(ticket)}
            </p>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
          <p className="mt-1 flex items-center gap-2 text-xs font-medium text-secondary-400">
            <span className="data-mono">{ticket.hospital_number ?? `#${ticket.patient_id}`}</span>
            <span>·</span>
            <Clock className="h-3 w-3" aria-hidden />
            Waiting {timeSince(ticket.created_at)}
            {isCalled && ticket.called_at ? <span>· called {formatTime(ticket.called_at)}</span> : null}
          </p>
          <PreviousSteps ticket={ticket} />
        </div>
        <div className="flex items-center gap-2">
          {isCalled ? (
            <Button size="sm" onClick={onServe} disabled={busy} leftIcon={<PlayCircle className="h-3.5 w-3.5" />}>
              Start Serving
            </Button>
          ) : (
            <Button size="sm" onClick={onCall} disabled={busy} leftIcon={<PhoneCall className="h-3.5 w-3.5" />}>
              Call
            </Button>
          )}
          {isCalled && (
            <Button variant="ghost" size="sm" onClick={onMiss} title="Mark missed">
              <UserX className="h-4 w-4" aria-hidden />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onTransfer} title="Transfer to another service point">
            <Shuffle className="h-4 w-4" aria-hidden />
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel} title="Cancel ticket" className="text-rose-500">
            <Ban className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </Card>
  );
}

export type ServingTicketCardProps = {
  ticket: QueueTicket;
  onComplete: () => void;
  onRoute: () => void;
  onEndVisit: () => void;
  onCancel: () => void;
  onRecordService?: () => void;
  onTransfer: () => void;
  onOpenConsultation: () => void;
};

export function ServingTicketCard({
  ticket,
  onComplete,
  onRoute,
  onEndVisit,
  onCancel,
  onRecordService,
  onTransfer,
  onOpenConsultation,
}: ServingTicketCardProps) {
  return (
    <Card variant="panel">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="font-display text-3xl font-bold tracking-tight text-secondary-900">
              {ticket.queue_number}
            </span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
          <p className="mt-2 truncate text-sm font-bold text-secondary-900">
            {ticketPatientName(ticket)}
          </p>
          <p className="mt-0.5 flex items-center gap-2 text-xs font-medium text-secondary-400">
            <span className="data-mono">{ticket.hospital_number ?? `#${ticket.patient_id}`}</span>
            {ticket.service_started_at ? (
              <>
                <span>·</span>
                <Clock className="h-3 w-3" aria-hidden />
                In service {timeSince(ticket.service_started_at)}
              </>
            ) : null}
          </p>
          <PreviousSteps ticket={ticket} />
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500 shadow-glow-sm">
          <Volume2 className="h-5 w-5" aria-hidden />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="col-span-2"
          onClick={onOpenConsultation}
          leftIcon={<Stethoscope className="h-3.5 w-3.5" />}
        >
          Open Consultation
        </Button>
        {onRecordService ? (
          <Button
            variant="primary"
            size="sm"
            className="col-span-2"
            onClick={onRecordService}
            leftIcon={<Receipt className="h-3.5 w-3.5" />}
          >
            Record service
          </Button>
        ) : null}
        <Button size="sm" onClick={onComplete} leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}>
          Complete
        </Button>
        <Button variant="outline" size="sm" onClick={onRoute} leftIcon={<ArrowRight className="h-3.5 w-3.5" />}>
          Complete & Route
        </Button>
        <Button variant="secondary" size="sm" onClick={onEndVisit} leftIcon={<LogOut className="h-3.5 w-3.5" />}>
          End Visit
        </Button>
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={onTransfer} title="Transfer to another service point">
            <Shuffle className="h-4 w-4" aria-hidden />
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel} title="Cancel ticket" className="text-rose-500">
            <Ban className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </Card>
  );
}
