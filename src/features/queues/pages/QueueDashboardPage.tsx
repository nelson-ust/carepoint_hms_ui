import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Ban,
  CheckCircle2,
  Clock,
  ListChecks,
  Monitor,
  PhoneCall,
  PlayCircle,
  RefreshCw,
  Users,
  Volume2,
} from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxConfirm,
  DxGrid,
  DxKpi,
  DxLiveDot,
  DxMessage,
  DxPage,
  DxPageHeader,
  DxPager,
  DxPanel,
  DxPopup,
  DxSegmented,
  DxSelect,
  DxStatusBar,
  DxStatusItem,
  DxTabs,
  DxTextarea,
  DxToolbar,
  DxToolbarGroup,
  DxToolbarLabel,
  DxToolbarSeparator,
  DxToolbarSpacer,
  elapsed,
  formatTime,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { routes } from "@/config/routes";
import { sdpTypeLabel, workstationPathFor } from "@/features/visits/lib/clinic-flow";
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
import { journeyText, ticketPatientName } from "../lib/ticket-utils";
import { PriorityBadge, ServingTicketCard, StatusBadge, WaitingRowActions } from "../components/ticket-cards";
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

type Scope = "my" | "sdp";
type Tab = "worklist" | "all";

/**
 * Patient Queue — the live worklist every desk works from: call, serve, open
 * the right workstation for the desk, record services, then route the patient
 * onward (or end the visit). "By Service Point" shows any desk in the hospital.
 */
export function QueueDashboardPage() {
  const toast = useToast();
  const navigate = useNavigate();

  const [scope, setScope] = useState<Scope>("my");
  const [selectedSdpId, setSelectedSdpId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("worklist");

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
  const [pageSize, setPageSize] = useState(20);

  // ---------- Data ----------
  const sdpQuery = useActiveServicePoints();
  const sdps = useMemo(() => sdpQuery.data?.items ?? [], [sdpQuery.data]);

  const myWorklistQuery = useMyWorklist(undefined, { enabled: scope === "my" });
  const sdpWorklistQuery = useServicePointWorklist(selectedSdpId ?? 0, { enabled: scope === "sdp" && !!selectedSdpId });
  const worklistQuery = scope === "my" ? myWorklistQuery : sdpWorklistQuery;
  const worklist = worklistQuery.data;
  const activeSdpId = scope === "sdp" ? selectedSdpId : (worklist?.service_delivery_point_id ?? null);
  const activeSdp = useMemo(() => sdps.find((s) => s.id === activeSdpId) ?? null, [sdps, activeSdpId]);
  // Desk type drives which workstation "Open" leads to (triage, consultation, pharmacy…).
  const deskType = (worklist as { service_point_type?: string | null } | undefined)?.service_point_type ?? activeSdp?.service_point_type ?? null;

  const ticketsQuery = useServicePointTickets(
    activeSdpId ?? 0,
    { statuses: filterToStatuses(statusFilter), skip: (page - 1) * pageSize, limit: pageSize },
    { enabled: tab === "all" && !!activeSdpId },
  );

  const waitingAndCalled = useMemo(() => worklist?.waiting ?? [], [worklist]);
  const waitingOnly = useMemo(() => waitingAndCalled.filter((t) => t.status === "WAITING"), [waitingAndCalled]);
  const calledOnly = useMemo(() => waitingAndCalled.filter((t) => t.status === "CALLED"), [waitingAndCalled]);
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
  const anyModalPending = routeMutation.isPending || endVisitMutation.isPending || cancelMutation.isPending || transferMutation.isPending;
  const rowBusy = callMutation.isPending || serveMutation.isPending;

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
          onSuccess: (res) => toast.success(res.message || (kind === "complete" ? "Ticket completed." : "Ticket marked missed.")),
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
        { ...common, onSuccess: (res) => { toast.success(res.message || "Patient routed to the next service point."); setModal(null); } },
      );
    } else if (kind === "complete-end-visit") {
      endVisitMutation.mutate(
        { ticketId: ticket.id, note: text || undefined },
        { ...common, onSuccess: (res) => { toast.success(res.message || "Visit marked completed.", `Visit #${res.visit_id} · ${res.visit_status}`); setModal(null); } },
      );
    } else if (kind === "cancel") {
      if (!text) return setModalError("A cancellation reason is required.");
      cancelMutation.mutate(
        { ticketId: ticket.id, reason: text },
        { ...common, onSuccess: (res) => { toast.success(res.message || "Ticket cancelled."); setModal(null); } },
      );
    } else if (kind === "transfer") {
      if (!targetId) return setModalError("Pick a destination service point.");
      transferMutation.mutate(
        { ticketId: ticket.id, targetServiceDeliveryPointId: targetId, reason: text || undefined },
        { ...common, onSuccess: (res) => { toast.success(res.message || "Ticket transferred."); setModal(null); } },
      );
    }
  };

  // ---------- Grids ----------
  const waitingColumns: DxGridColumn<QueueTicket>[] = [
    { key: "queue_number", header: "Ticket", width: 110, sortable: true, render: (t) => <span className="dx-mono font-semibold">{t.queue_number}</span> },
    {
      key: "patient",
      header: "Patient",
      sortable: true,
      accessor: (t) => ticketPatientName(t),
      render: (t) => (
        <div className="min-w-0">
          <div className="dx-row-primary truncate">{ticketPatientName(t)}</div>
          <div className="dx-row-secondary dx-mono">{t.hospital_number ?? `#${t.patient_id}`}</div>
        </div>
      ),
    },
    { key: "priority", header: "Priority", width: 100, sortable: true, accessor: (t) => t.priority ?? 0, render: (t) => <PriorityBadge priority={t.priority} /> },
    { key: "status", header: "Status", width: 110, render: (t) => <StatusBadge status={t.status} /> },
    {
      key: "created_at",
      header: "Waiting",
      width: 110,
      sortable: true,
      render: (t) => (
        <span className="inline-flex items-center gap-1 dx-mono">
          <Clock className="h-3 w-3 text-[var(--dx-text-faint)]" aria-hidden />
          {elapsed(t.created_at)}
          {t.status === "CALLED" && t.called_at ? <span className="dx-faint"> · called {formatTime(t.called_at)}</span> : null}
        </span>
      ),
    },
    { key: "journey", header: "Journey", render: (t) => <span className="dx-muted truncate" title={journeyText(t)}>{journeyText(t)}</span> },
    {
      key: "actions",
      header: "",
      width: 230,
      align: "right",
      render: (t) => (
        <WaitingRowActions
          ticket={t}
          busy={rowBusy}
          onCall={() => handleCall(t)}
          onServe={() => handleServe(t)}
          onMiss={() => setConfirmAction({ kind: "miss", ticket: t })}
          onCancel={() => openModal("cancel", t)}
          onTransfer={() => openModal("transfer", t)}
        />
      ),
    },
  ];

  const allColumns: DxGridColumn<QueueTicket>[] = [
    {
      key: "queue_number",
      header: "Ticket",
      width: 120,
      render: (t) => (
        <span className="dx-mono font-semibold">
          {t.queue_number}
          {t.queue_position != null ? <span className="dx-faint ml-1 text-[11px]">pos {t.queue_position}</span> : null}
        </span>
      ),
    },
    {
      key: "patient",
      header: "Patient",
      render: (t) => (
        <div className="min-w-0">
          <div className="dx-row-primary truncate">{ticketPatientName(t)}</div>
          <div className="dx-row-secondary dx-mono">{t.hospital_number ?? "—"}</div>
        </div>
      ),
    },
    { key: "status", header: "Status", width: 110, render: (t) => <StatusBadge status={t.status} /> },
    { key: "journey", header: "Journey", render: (t) => <span className="dx-muted">{journeyText(t)}</span> },
    { key: "created_at", header: "Issued", width: 90, render: (t) => <span className="dx-mono">{formatTime(t.created_at)}</span> },
    { key: "called_at", header: "Called", width: 90, render: (t) => <span className="dx-mono">{formatTime(t.called_at)}</span> },
    { key: "service_ended_at", header: "Ended", width: 90, render: (t) => <span className="dx-mono">{formatTime(t.service_ended_at)}</span> },
  ];

  const ticketsMeta = ticketsQuery.data?.meta;
  const totalItems = ticketsMeta?.total ?? ticketsQuery.data?.count;
  const totalPages = ticketsMeta?.total_pages ?? (typeof totalItems === "number" ? Math.max(1, Math.ceil(totalItems / pageSize)) : undefined);

  const sdpOptions = sdps.map((s) => ({ value: String(s.id), label: `${s.name} (${s.code})` }));
  const needsSdp = scope === "sdp" && !selectedSdpId;

  // ---------- Render ----------
  return (
    <DxPage>
      <DxPageHeader
        title="Patient Queue"
        subtitle="Live worklist — call, serve, open the workstation, record services and route the patient to the next checkpoint."
        actions={
          <>
            <DxLiveDot label="Live · refreshes every 30s" />
            <DxButton leftIcon={<RefreshCw className={worklistQuery.isFetching ? "animate-spin" : undefined} />} onClick={() => worklistQuery.refetch()}>
              Refresh
            </DxButton>
          </>
        }
      />

      <DxToolbar>
        <DxToolbarGroup>
          <DxSegmented<Scope>
            ariaLabel="Worklist scope"
            value={scope}
            onChange={(v) => { setScope(v); setPage(1); }}
            items={[
              { key: "my", label: "My worklist" },
              { key: "sdp", label: "By service point" },
            ]}
          />
          {scope === "sdp" ? (
            <DxSelect
              aria-label="Service point"
              editorSize="sm"
              className="w-72"
              value={selectedSdpId ?? ""}
              onChange={(e) => { setSelectedSdpId(e.target.value ? Number(e.target.value) : null); setPage(1); }}
              options={sdpOptions}
              placeholder="Pick a service point…"
            />
          ) : null}
        </DxToolbarGroup>
        {worklist?.service_delivery_point_name ? (
          <>
            <DxToolbarSeparator />
            <DxToolbarLabel>Desk</DxToolbarLabel>
            <DxBadge tone="accent">{worklist.service_delivery_point_name}</DxBadge>
            {deskType ? <DxBadge tone="outline">{sdpTypeLabel(deskType)}</DxBadge> : null}
          </>
        ) : null}
        <DxToolbarSpacer />
        <DxToolbarGroup>
          <Link to={routes.queueDisplayBoard} className="dx-btn dx-btn-text dx-btn-sm">
            <Monitor aria-hidden /> Display board
          </Link>
          <Link to={routes.queueAnalytics} className="dx-btn dx-btn-text dx-btn-sm">
            <BarChart3 aria-hidden /> Analytics
          </Link>
        </DxToolbarGroup>
      </DxToolbar>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <DxKpi label="Waiting" value={waitingOnly.length} icon={Users} tone="warning" isLoading={worklistQuery.isLoading} />
        <DxKpi label="Called" value={calledOnly.length} icon={PhoneCall} tone="info" isLoading={worklistQuery.isLoading} />
        <DxKpi label="Serving" value={serving.length} icon={PlayCircle} tone="accent" isLoading={worklistQuery.isLoading} />
        <DxKpi label="Served today" value={worklist?.served_today ?? 0} icon={CheckCircle2} tone="success" isLoading={worklistQuery.isLoading} />
        <DxKpi label="Cancelled today" value={worklist?.cancelled_today ?? 0} icon={Ban} tone="danger" isLoading={worklistQuery.isLoading} />
      </div>

      <DxTabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { key: "worklist", label: "Worklist", icon: <ListChecks />, count: waitingAndCalled.length + serving.length },
          { key: "all", label: "All tickets", icon: <Clock /> },
        ]}
      />

      {tab === "worklist" ? (
        needsSdp ? (
          <DxMessage tone="info" title="Pick a service point">Choose a service delivery point in the toolbar to browse its live queue.</DxMessage>
        ) : worklistQuery.isError ? (
          <DxMessage tone="danger" title="Unable to load the worklist" action={<DxButton size="sm" onClick={() => worklistQuery.refetch()}>Retry</DxButton>}>
            {apiErrorMessage(worklistQuery.error)}
          </DxMessage>
        ) : (
          <div className="grid gap-4 xl:grid-cols-12">
            <DxPanel
              className="xl:col-span-8"
              title="Waiting & called"
              icon={<Users />}
              description={`${waitingOnly.length} waiting · ${calledOnly.length} called`}
              flush
            >
              <DxGrid
                columns={waitingColumns}
                data={waitingAndCalled}
                rowKey={(t) => t.id}
                isLoading={worklistQuery.isLoading}
                borderless
                rowClassName={(t) => (t.status === "CALLED" ? "font-medium" : undefined)}
                empty={{ icon: Clock, title: "Queue is clear", description: "No patients are waiting at this service point." }}
              />
            </DxPanel>

            <DxPanel className="xl:col-span-4" title="Now serving" icon={<Volume2 />} description={`${serving.length} in active service`} bodyClassName="space-y-3">
              {worklistQuery.isLoading ? (
                <div className="space-y-2">
                  <div className="dx-skeleton h-24" />
                  <div className="dx-skeleton h-24" />
                </div>
              ) : serving.length === 0 ? (
                <div className="dx-grid-state">
                  <Volume2 aria-hidden />
                  <p className="dx-grid-state-title">No one in service</p>
                  <p>Call the next patient when you are ready.</p>
                </div>
              ) : (
                serving.map((ticket) => {
                  const ws = workstationPathFor(deskType, ticket.visit_id, worklist?.service_delivery_point_name);
                  return (
                    <ServingTicketCard
                      key={ticket.id}
                      ticket={ticket}
                      workstation={ws}
                      onOpenWorkstation={() => navigate(ws.path)}
                      onComplete={() => setConfirmAction({ kind: "complete", ticket })}
                      onRoute={() => openModal("complete-route", ticket)}
                      onEndVisit={() => openModal("complete-end-visit", ticket)}
                      onCancel={() => openModal("cancel", ticket)}
                      onRecordService={() => setRecordServiceTicket(ticket)}
                      onTransfer={() => openModal("transfer", ticket)}
                    />
                  );
                })
              )}
            </DxPanel>
          </div>
        )
      ) : (
        <div>
          <DxToolbar attached>
            <DxToolbarLabel>Status</DxToolbarLabel>
            <DxSelect
              aria-label="Status filter"
              editorSize="sm"
              className="w-80"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              options={STATUS_FILTER_OPTIONS}
            />
            {!activeSdpId ? <DxToolbarLabel>Select a service point (or load your worklist) to browse tickets.</DxToolbarLabel> : null}
            <DxToolbarSpacer />
            <DxButton size="sm" variant="text" leftIcon={<RefreshCw className={ticketsQuery.isFetching ? "animate-spin" : undefined} />} onClick={() => ticketsQuery.refetch()} disabled={!activeSdpId}>
              Refresh
            </DxButton>
          </DxToolbar>
          <DxGrid
            attached
            columns={allColumns}
            data={ticketsQuery.data?.items}
            rowKey={(t) => t.id}
            isLoading={ticketsQuery.isLoading && !!activeSdpId}
            error={ticketsQuery.isError ? apiErrorMessage(ticketsQuery.error) : null}
            onRetry={() => ticketsQuery.refetch()}
            filterRow
            empty={{ icon: ListChecks, title: "No tickets found", description: "Adjust the status filter or check back later." }}
            footer={
              <DxPager
                page={page}
                totalPages={totalPages}
                totalItems={typeof totalItems === "number" ? totalItems : undefined}
                pageSize={pageSize}
                pageSizeOptions={[10, 20, 50]}
                onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
                hasNext={ticketsMeta?.has_next}
                onPageChange={setPage}
              />
            }
          />
        </div>
      )}

      <DxStatusBar>
        <DxStatusItem>
          Desk: <b>{worklist?.service_delivery_point_name ?? "—"}</b>
        </DxStatusItem>
        <DxStatusItem>
          Workstation: <b>{sdpTypeLabel(deskType)}</b>
        </DxStatusItem>
        <DxStatusItem>
          Active tickets: <b>{waitingAndCalled.length + serving.length}</b>
        </DxStatusItem>
        <span className="ml-auto">Urgent and emergency patients are pushed ahead of routine ones automatically.</span>
      </DxStatusBar>

      {/* Confirms */}
      <DxConfirm
        isOpen={confirmAction?.kind === "complete"}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        title="Complete service"
        description={`Mark ticket ${confirmAction?.ticket.queue_number ?? ""} (${confirmAction ? ticketPatientName(confirmAction.ticket) : ""}) as served? The patient stays at this step unless you route them.`}
        confirmLabel="Complete"
        tone="primary"
      />
      <DxConfirm
        isOpen={confirmAction?.kind === "miss"}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        title="Mark ticket missed"
        description={`Mark ticket ${confirmAction?.ticket.queue_number ?? ""} as missed? Use this when the patient did not respond to the call.`}
        confirmLabel="Mark missed"
        tone="danger"
      />

      <RecordServiceModal
        ticket={recordServiceTicket}
        sdpId={activeSdpId}
        sdpName={worklist?.service_delivery_point_name ?? undefined}
        onClose={() => setRecordServiceTicket(null)}
      />

      {modal ? (
        <DxPopup
          isOpen
          onClose={closeModal}
          title={MODAL_META[modal.kind].title}
          size="sm"
          locked={anyModalPending}
          footer={
            <>
              <DxButton onClick={closeModal} disabled={anyModalPending}>
                Back
              </DxButton>
              <DxButton variant={modal.kind === "cancel" ? "danger" : "primary"} onClick={submitModal} isLoading={anyModalPending}>
                {MODAL_META[modal.kind].cta}
              </DxButton>
            </>
          }
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded border border-[var(--dx-border)] bg-[var(--dx-surface-alt)] px-3 py-2">
              <span className="dx-mono rounded bg-[var(--dx-accent-soft)] px-2 py-1 text-[12px] font-semibold text-[var(--dx-accent)]">{modal.ticket.queue_number}</span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold">{ticketPatientName(modal.ticket)}</p>
                <p className="dx-mono dx-muted text-[11.5px]">{modal.ticket.hospital_number ?? `Patient #${modal.ticket.patient_id}`}</p>
              </div>
            </div>

            {modal.kind === "complete-route" || modal.kind === "transfer" ? (
              <DxSelect
                label={modal.kind === "complete-route" ? "Next service point" : "Destination service point"}
                required
                value={modalTargetSdp}
                onChange={(e) => setModalTargetSdp(e.target.value)}
                options={sdps
                  .filter((s) => s.id !== modal.ticket.service_delivery_point_id)
                  .map((s) => ({ value: String(s.id), label: `${s.name} (${s.code}) — ${sdpTypeLabel(s.service_point_type)}` }))}
                placeholder="Select a service point…"
              />
            ) : null}

            <DxTextarea
              label={MODAL_META[modal.kind].textLabel}
              value={modalText}
              onChange={(e) => setModalText(e.target.value)}
              placeholder={MODAL_META[modal.kind].textPlaceholder}
              rows={3}
              error={modalError ?? undefined}
            />
          </div>
        </DxPopup>
      ) : null}
    </DxPage>
  );
}
