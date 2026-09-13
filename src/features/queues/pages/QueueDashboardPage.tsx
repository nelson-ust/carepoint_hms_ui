import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Ban,
  CheckCircle2,
  Clock,
  ListChecks,
  PhoneCall,
  PlayCircle,
  RefreshCw,
  Users,
  Volume2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { MetricCard } from "@/components/charts/MetricCard";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { Pagination } from "@/components/data-table/Pagination";
import { cn } from "@/lib/utils/cn";
import { routes } from "@/config/routes";
import { RecordServiceModal } from "../components/RecordServiceModal";
import type { QueueTicket } from "../api/queues.api";
import {
  apiErrorMessage,
  filterToStatuses,
  MODAL_META,
  STATUS_FILTER_OPTIONS,
  type ConfirmKind,
  type ModalKind,
} from "../lib/queue-dashboard-helpers";
import {
  formatTime,
  LiveIndicator,
  SegmentButton,
  ServingTicketCard,
  StatusBadge,
  ticketPatientName,
  WaitingTicketCard,
} from "../components/ticket-cards";
import {
  useActiveServicePoints,
  useCallTicket,
  useCancelTicket,
  useCompleteAndEndVisitTicket,
  useCompleteAndRouteTicket,
  useCompleteTicket,
  useMissTicket,
  useMyWorklist,
  useServeTicket,
  useServicePointTickets,
  useServicePointWorklist,
  useTransferTicket,
} from "../hooks/use-queue";

// ============================================================
// Page
// ============================================================

export function QueueDashboardPage() {
  const toast = useToast();
  const navigate = useNavigate();

  const [scope, setScope] = useState<"my" | "sdp">("my");
  const [selectedSdpId, setSelectedSdpId] = useState<number | null>(null);
  const [tab, setTab] = useState<"worklist" | "all">("worklist");

  // Modal / confirm state
  const [modal, setModal] = useState<{ kind: ModalKind; ticket: QueueTicket } | null>(null);
  const [recordServiceTicket, setRecordServiceTicket] = useState<QueueTicket | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ kind: ConfirmKind; ticket: QueueTicket } | null>(null);
  const [modalText, setModalText] = useState("");
  const [modalTargetSdp, setModalTargetSdp] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);

  // "All tickets" tab state
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // ---------- Data ----------
  const sdpQuery = useActiveServicePoints();
  const sdps = sdpQuery.data?.items ?? [];

  const myWorklistQuery = useMyWorklist(undefined, { enabled: scope === "my" });
  const sdpWorklistQuery = useServicePointWorklist(selectedSdpId ?? 0, {
    enabled: scope === "sdp" && !!selectedSdpId,
  });
  const worklistQuery = scope === "my" ? myWorklistQuery : sdpWorklistQuery;
  const worklist = worklistQuery.data;
  const activeSdpId =
    scope === "sdp" ? selectedSdpId : worklist?.service_delivery_point_id ?? null;

  const ticketsQuery = useServicePointTickets(
    activeSdpId ?? 0,
    { statuses: filterToStatuses(statusFilter), skip: (page - 1) * pageSize, limit: pageSize },
    { enabled: tab === "all" && !!activeSdpId },
  );

  const waitingOnly = useMemo(
    () => (worklist?.waiting ?? []).filter((t) => t.status === "WAITING"),
    [worklist],
  );
  const calledOnly = useMemo(
    () => (worklist?.waiting ?? []).filter((t) => t.status === "CALLED"),
    [worklist],
  );
  const serving = worklist?.serving ?? [];

  // ---------- Mutations ----------
  const callMutation = useCallTicket();
  const serveMutation = useServeTicket();
  const completeMutation = useCompleteTicket();
  const routeMutation = useCompleteAndRouteTicket();
  const endVisitMutation = useCompleteAndEndVisitTicket();
  const missMutation = useMissTicket();
  const cancelMutation = useCancelTicket();
  const transferMutation = useTransferTicket();
  const anyModalPending =
    routeMutation.isPending ||
    endVisitMutation.isPending ||
    cancelMutation.isPending ||
    transferMutation.isPending;

  const handleCall = (ticket: QueueTicket) =>
    callMutation.mutate(
      { ticketId: ticket.id },
      {
        onSuccess: (res) => toast.success(res.message || `Ticket ${ticket.queue_number} called.`),
        onError: (err) => toast.error("Call failed", apiErrorMessage(err)),
      },
    );

  const handleServe = (ticket: QueueTicket) =>
    serveMutation.mutate(
      { ticketId: ticket.id },
      {
        onSuccess: (res) => toast.success(res.message || "Service started."),
        onError: (err) => toast.error("Could not start serving", apiErrorMessage(err)),
      },
    );

  const openModal = (kind: ModalKind, ticket: QueueTicket) => {
    setModal({ kind, ticket });
    setModalText("");
    setModalTargetSdp("");
    setModalError(null);
  };

  const closeModal = () => {
    if (anyModalPending) return;
    setModal(null);
    setModalError(null);
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    const { kind, ticket } = confirmAction;
    const mutation = kind === "complete" ? completeMutation : missMutation;
    await new Promise<void>((resolve) => {
      mutation.mutate(
        { ticketId: ticket.id },
        {
          onSuccess: (res) =>
            toast.success(
              res.message || (kind === "complete" ? "Ticket completed." : "Ticket marked missed."),
            ),
          onError: (err) => toast.error("Action failed", apiErrorMessage(err)),
          onSettled: () => resolve(),
        },
      );
    });
  };

  const submitModal = () => {
    if (!modal) return;
    const { kind, ticket } = modal;
    const text = modalText.trim();
    const targetId = Number(modalTargetSdp);
    setModalError(null);

    const common = {
      onError: (err: unknown) => {
        setModalError(apiErrorMessage(err));
        toast.error("Action failed", apiErrorMessage(err));
      },
    };

    if (kind === "complete-route") {
      if (!targetId) return setModalError("Pick the next service point.");
      routeMutation.mutate(
        { ticketId: ticket.id, targetServiceDeliveryPointId: targetId, notes: text || undefined },
        {
          ...common,
          onSuccess: (res) => {
            toast.success(res.message || "Patient routed to the next service point.");
            setModal(null);
          },
        },
      );
    } else if (kind === "complete-end-visit") {
      endVisitMutation.mutate(
        { ticketId: ticket.id, note: text || undefined },
        {
          ...common,
          onSuccess: (res) => {
            toast.success(
              res.message || "Visit marked completed.",
              `Visit #${res.visit_id} · ${res.visit_status}`,
            );
            setModal(null);
          },
        },
      );
    } else if (kind === "cancel") {
      if (!text) return setModalError("A cancellation reason is required.");
      cancelMutation.mutate(
        { ticketId: ticket.id, reason: text },
        {
          ...common,
          onSuccess: (res) => {
            toast.success(res.message || "Ticket cancelled.");
            setModal(null);
          },
        },
      );
    } else if (kind === "transfer") {
      if (!targetId) return setModalError("Pick a destination service point.");
      transferMutation.mutate(
        { ticketId: ticket.id, targetServiceDeliveryPointId: targetId, reason: text || undefined },
        {
          ...common,
          onSuccess: (res) => {
            toast.success(res.message || "Ticket transferred.");
            setModal(null);
          },
        },
      );
    }
  };

  // ---------- All-tickets table ----------
  const columns: DataTableColumn<QueueTicket>[] = [
    {
      key: "queue_number",
      header: "Ticket",
      render: (t) => (
        <div>
          <span className="data-mono font-bold text-secondary-900">{t.queue_number}</span>
          {t.queue_position != null && (
            <span className="ml-2 text-xs text-secondary-400">pos {t.queue_position}</span>
          )}
        </div>
      ),
    },
    {
      key: "patient",
      header: "Patient",
      render: (t) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-secondary-900">{ticketPatientName(t)}</p>
          <p className="data-mono text-xs text-secondary-400">{t.hospital_number ?? "—"}</p>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (t) => <StatusBadge status={t.status} /> },
    {
      key: "previous_steps",
      header: "Journey",
      render: (t) =>
        t.previous_steps.length ? (
          <span className="text-xs font-medium text-secondary-500">
            {t.previous_steps.map((s) => s.service_delivery_point_name).join(" → ")}
          </span>
        ) : (
          <span className="text-xs text-secondary-400">First stop</span>
        ),
    },
    {
      key: "created_at",
      header: "Issued",
      render: (t) => <span className="data-mono text-xs">{formatTime(t.created_at)}</span>,
    },
    {
      key: "called_at",
      header: "Called",
      render: (t) => <span className="data-mono text-xs">{formatTime(t.called_at)}</span>,
    },
    {
      key: "service_ended_at",
      header: "Ended",
      render: (t) => <span className="data-mono text-xs">{formatTime(t.service_ended_at)}</span>,
    },
  ];

  const ticketsMeta = ticketsQuery.data?.meta;
  const totalItems = ticketsMeta?.total ?? ticketsQuery.data?.count;
  const totalPages =
    ticketsMeta?.total_pages ??
    (typeof totalItems === "number" ? Math.max(1, Math.ceil(totalItems / pageSize)) : undefined);

  // ---------- Render ----------
  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Patient Queue"
        description="Live worklist orchestration — call, serve, route and transfer tickets across service points."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <LiveIndicator />
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw className={cn("h-3.5 w-3.5", worklistQuery.isFetching && "animate-spin")} />}
              onClick={() => worklistQuery.refetch()}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* Scope switch + SDP picker */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-2xl border border-secondary-200 dark:border-white/10">
          <SegmentButton active={scope === "my"} onClick={() => setScope("my")} label="My Worklist" />
          <SegmentButton active={scope === "sdp"} onClick={() => setScope("sdp")} label="By Service Point" />
        </div>
        {scope === "sdp" && (
          <Select
            aria-label="Service point"
            className="w-72 py-2.5"
            value={selectedSdpId ?? ""}
            onChange={(e) => {
              setSelectedSdpId(e.target.value ? Number(e.target.value) : null);
              setPage(1);
            }}
            options={sdps.map((s) => ({ value: String(s.id), label: `${s.name} (${s.code})` }))}
            placeholder="Pick a service point"
          />
        )}
        {worklist?.service_delivery_point_name ? (
          <Badge variant="outline" className="normal-case tracking-normal">
            {worklist.service_delivery_point_name}
          </Badge>
        ) : null}
        {worklist ? (
          <Badge variant="soft-danger">Cancelled today: {worklist.cancelled_today}</Badge>
        ) : null}
      </div>

      {/* KPIs */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Waiting" value={waitingOnly.length} icon={Users} tone="amber" isLoading={worklistQuery.isLoading} />
        <MetricCard label="Called" value={calledOnly.length} icon={PhoneCall} tone="cyan" isLoading={worklistQuery.isLoading} />
        <MetricCard label="Serving" value={serving.length} icon={PlayCircle} tone="primary" isLoading={worklistQuery.isLoading} />
        <MetricCard
          label="Served Today"
          value={worklist?.served_today ?? 0}
          icon={CheckCircle2}
          tone="violet"
          isLoading={worklistQuery.isLoading}
        />
      </div>

      {/* Tabs */}
      <div className="inline-flex overflow-hidden rounded-2xl border border-secondary-200 dark:border-white/10">
        <SegmentButton active={tab === "worklist"} onClick={() => setTab("worklist")} label="Worklist" />
        <SegmentButton active={tab === "all"} onClick={() => setTab("all")} label="All Tickets" />
      </div>

      {tab === "worklist" ? (
        scope === "sdp" && !selectedSdpId ? (
          <Card>
            <EmptyState
              icon={ListChecks}
              title="Pick a service point"
              description="Choose a service delivery point above to browse its live queue."
            />
          </Card>
        ) : worklistQuery.isError ? (
          <Card>
            <EmptyState
              icon={Ban}
              title="Unable to load the worklist"
              description={apiErrorMessage(worklistQuery.error)}
              action={
                <Button variant="secondary" size="sm" onClick={() => worklistQuery.refetch()}>
                  Retry
                </Button>
              }
            />
          </Card>
        ) : worklistQuery.isLoading ? (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7 space-y-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-[2rem]" />
              ))}
            </div>
            <div className="lg:col-span-5 space-y-4">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-40 w-full rounded-[2rem]" />
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Waiting + Called column */}
            <div className="lg:col-span-7 space-y-4">
              <CardHeader
                title="Waiting & Called"
                description={`${waitingOnly.length} waiting · ${calledOnly.length} called`}
                className="mb-0"
              />
              {worklist && worklist.waiting.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={Clock}
                    title="Queue is clear"
                    description="No patients are waiting at this service point."
                  />
                </Card>
              ) : (
                (worklist?.waiting ?? []).map((ticket) => (
                  <WaitingTicketCard
                    key={ticket.id}
                    ticket={ticket}
                    busy={callMutation.isPending || serveMutation.isPending}
                    onCall={() => handleCall(ticket)}
                    onServe={() => handleServe(ticket)}
                    onMiss={() => setConfirmAction({ kind: "miss", ticket })}
                    onCancel={() => openModal("cancel", ticket)}
                    onTransfer={() => openModal("transfer", ticket)}
                  />
                ))
              )}
            </div>

            {/* Now serving column */}
            <div className="lg:col-span-5 space-y-4">
              <CardHeader
                title="Now Serving"
                description={`${serving.length} in active service`}
                className="mb-0"
              />
              {serving.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={Volume2}
                    title="No one in service"
                    description="Call the next patient when you are ready."
                  />
                </Card>
              ) : (
                serving.map((ticket) => (
                  <ServingTicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onComplete={() => setConfirmAction({ kind: "complete", ticket })}
                    onRoute={() => openModal("complete-route", ticket)}
                    onEndVisit={() => openModal("complete-end-visit", ticket)}
                    onCancel={() => openModal("cancel", ticket)}
                    onRecordService={() => setRecordServiceTicket(ticket)}
                    onTransfer={() => openModal("transfer", ticket)}
                    onOpenConsultation={() => navigate(`${routes.consultation}/${ticket.visit_id}`)}
                  />
                ))
              )}
            </div>
          </div>
        )
      ) : (
        <Card padding="none">
          <div className="flex flex-wrap items-center gap-3 px-6 py-4">
            <Select
              aria-label="Status filter"
              className="w-80 py-2.5"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={STATUS_FILTER_OPTIONS}
            />
            {!activeSdpId && (
              <span className="text-sm font-medium text-secondary-400">
                Select a service point (or load your worklist) to browse tickets.
              </span>
            )}
          </div>
          <DataTable
            columns={columns}
            data={ticketsQuery.data?.items}
            rowKey={(t) => t.id}
            isLoading={ticketsQuery.isLoading && !!activeSdpId}
            error={ticketsQuery.isError ? apiErrorMessage(ticketsQuery.error) : null}
            onRetry={() => ticketsQuery.refetch()}
            empty={{
              icon: ListChecks,
              title: "No tickets found",
              description: "Adjust the status filter or check back later.",
            }}
            footer={
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={typeof totalItems === "number" ? totalItems : undefined}
                pageSize={pageSize}
                hasNext={ticketsMeta?.has_next}
                onPageChange={setPage}
              />
            }
          />
        </Card>
      )}

      {/* Confirm dialogs */}
      <ConfirmDialog
        isOpen={confirmAction?.kind === "complete"}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        title="Complete service"
        description={`Mark ticket ${confirmAction?.ticket.queue_number ?? ""} (${confirmAction ? ticketPatientName(confirmAction.ticket) : ""}) as served? The patient stays at this step unless you route them.`}
        confirmLabel="Complete"
        tone="primary"
      />
      <ConfirmDialog
        isOpen={confirmAction?.kind === "miss"}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        title="Mark ticket missed"
        description={`Mark ticket ${confirmAction?.ticket.queue_number ?? ""} as missed? Use this when the patient did not respond to the call.`}
        confirmLabel="Mark Missed"
        tone="danger"
      />

      {/* Action modal */}
      <RecordServiceModal
        ticket={recordServiceTicket}
        sdpId={activeSdpId}
        sdpName={worklist?.service_delivery_point_name ?? undefined}
        onClose={() => setRecordServiceTicket(null)}
      />
      {modal ? (
        <Modal
          isOpen
          onClose={closeModal}
          title={MODAL_META[modal.kind].title}
          size="md"
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={closeModal} disabled={anyModalPending}>
                Back
              </Button>
              <Button
                variant={modal.kind === "cancel" ? "danger" : "primary"}
                size="sm"
                onClick={submitModal}
                isLoading={anyModalPending}
              >
                {MODAL_META[modal.kind].cta}
              </Button>
            </div>
          }
        >
          <div className="space-y-5">
            <div className="flex items-center gap-4 rounded-2xl bg-secondary-500/5 p-4 dark:bg-white/5">
              <span className="data-mono rounded-xl bg-primary-500/10 px-3 py-2 text-sm font-bold text-primary-600 dark:text-primary-300">
                {modal.ticket.queue_number}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-secondary-900">
                  {ticketPatientName(modal.ticket)}
                </p>
                <p className="data-mono text-xs text-secondary-400">
                  {modal.ticket.hospital_number ?? `Patient #${modal.ticket.patient_id}`}
                </p>
              </div>
            </div>

            {(modal.kind === "complete-route" || modal.kind === "transfer") && (
              <Select
                label={modal.kind === "complete-route" ? "Next service point" : "Destination service point"}
                value={modalTargetSdp}
                onChange={(e) => setModalTargetSdp(e.target.value)}
                options={sdps
                  .filter((s) => s.id !== modal.ticket.service_delivery_point_id)
                  .map((s) => ({ value: String(s.id), label: `${s.name} (${s.code})` }))}
                placeholder="Select a service point…"
              />
            )}

            <Textarea
              label={MODAL_META[modal.kind].textLabel}
              value={modalText}
              onChange={(e) => setModalText(e.target.value)}
              placeholder={MODAL_META[modal.kind].textPlaceholder}
              rows={3}
              error={modalError ?? undefined}
            />
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
