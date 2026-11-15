import {
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock,
  ExternalLink,
  LogOut,
  PhoneCall,
  PlayCircle,
  Receipt,
  Shuffle,
  UserX,
  Volume2,
} from "lucide-react";
import { DxBadge, DxButton, DxStatusBadge, elapsed } from "@/components/dx";
import type { QueueTicket, QueueTicketStatus } from "../api/queues.api";
import { journeyText, ticketPatientName } from "../lib/ticket-utils";

export function StatusBadge({ status }: { status: QueueTicketStatus }) {
  return <DxStatusBadge status={status} />;
}

export function PriorityBadge({ priority }: { priority?: number | null }) {
  const p = Number(priority ?? 0);
  if (p <= 0) return null;
  const label = p >= 30 ? "Emergency" : p >= 20 ? "Urgent" : "Priority";
  return <DxBadge tone={p >= 30 ? "danger" : "warning"}>{label}</DxBadge>;
}

// ============================================================
// Now-serving card — the one place where a ticket gets a "card" treatment,
// because it carries the full command set for the patient being attended.
// ============================================================

export type ServingTicketCardProps = {
  ticket: QueueTicket;
  /** Primary workstation for this desk, e.g. { label: "Open Triage", path: "/clinical/triage/12" }. */
  workstation: { label: string; path: string };
  onOpenWorkstation: () => void;
  onComplete: () => void;
  onRoute: () => void;
  onEndVisit: () => void;
  onCancel: () => void;
  onRecordService?: () => void;
  onTransfer: () => void;
  /** Name of the next pathway checkpoint if known — shown on the route button. */
  nextStepName?: string | null;
};

export function ServingTicketCard({
  ticket,
  workstation,
  onOpenWorkstation,
  onComplete,
  onRoute,
  onEndVisit,
  onCancel,
  onRecordService,
  onTransfer,
}: ServingTicketCardProps) {
  return (
    <div className="dx-panel">
      <div className="flex items-start justify-between gap-3 px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="dx-mono text-[18px] font-semibold text-[var(--dx-text)]">{ticket.queue_number}</span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
          <p className="mt-1 truncate text-[13px] font-semibold text-[var(--dx-text)]">{ticketPatientName(ticket)}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-[var(--dx-text-muted)]">
            <span className="dx-mono">{ticket.hospital_number ?? `#${ticket.patient_id}`}</span>
            {ticket.service_started_at ? (
              <>
                <span aria-hidden>·</span>
                <Clock className="h-3 w-3" aria-hidden />
                In service {elapsed(ticket.service_started_at)}
              </>
            ) : null}
          </p>
          {ticket.previous_steps.length ? (
            <p className="mt-1 truncate text-[11px] text-[var(--dx-text-faint)]" title={journeyText(ticket)}>
              {journeyText(ticket)}
            </p>
          ) : null}
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]">
          <Volume2 className="h-4 w-4" aria-hidden />
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 border-t border-[var(--dx-border)] bg-[var(--dx-surface-alt)] p-2">
        <DxButton variant="primary" size="sm" className="col-span-2" onClick={onOpenWorkstation} leftIcon={<ExternalLink />} title={workstation.path}>
          {workstation.label}
        </DxButton>
        {onRecordService ? (
          <DxButton size="sm" className="col-span-2" onClick={onRecordService} leftIcon={<Receipt />}>
            Record service
          </DxButton>
        ) : null}
        <DxButton size="sm" onClick={onComplete} leftIcon={<CheckCircle2 />}>
          Complete
        </DxButton>
        <DxButton size="sm" onClick={onRoute} leftIcon={<ArrowRight />}>
          Complete & Route
        </DxButton>
        <DxButton size="sm" onClick={onEndVisit} leftIcon={<LogOut />}>
          End visit
        </DxButton>
        <div className="flex items-center justify-end gap-1">
          <DxButton size="sm" variant="text" icon onClick={onTransfer} title="Transfer to another service point">
            <Shuffle aria-hidden />
          </DxButton>
          <DxButton size="sm" variant="text" icon onClick={onCancel} title="Cancel ticket" className="text-[var(--dx-danger)]">
            <Ban aria-hidden />
          </DxButton>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Row actions for the waiting/called grid
// ============================================================

export function WaitingRowActions({
  ticket,
  busy,
  onCall,
  onServe,
  onMiss,
  onCancel,
  onTransfer,
}: {
  ticket: QueueTicket;
  busy: boolean;
  onCall: () => void;
  onServe: () => void;
  onMiss: () => void;
  onCancel: () => void;
  onTransfer: () => void;
}) {
  const isCalled = ticket.status === "CALLED";
  return (
    <div className="dx-td-actions">
      {isCalled ? (
        <DxButton size="sm" variant="primary" onClick={onServe} disabled={busy} leftIcon={<PlayCircle />}>
          Start serving
        </DxButton>
      ) : (
        <DxButton size="sm" onClick={onCall} disabled={busy} leftIcon={<PhoneCall />}>
          Call
        </DxButton>
      )}
      {isCalled ? (
        <DxButton size="sm" variant="text" icon onClick={onMiss} title="Mark missed">
          <UserX aria-hidden />
        </DxButton>
      ) : null}
      <DxButton size="sm" variant="text" icon onClick={onTransfer} title="Transfer to another service point">
        <Shuffle aria-hidden />
      </DxButton>
      <DxButton size="sm" variant="text" icon onClick={onCancel} title="Cancel ticket" className="text-[var(--dx-danger)]">
        <Ban aria-hidden />
      </DxButton>
    </div>
  );
}
