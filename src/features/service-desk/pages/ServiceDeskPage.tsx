import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  LogOut,
  PhoneCall,
  PlayCircle,
  RefreshCw,
  Shuffle,
  SkipForward,
  Stethoscope,
  Users,
  Volume2,
} from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxConfirm,
  DxKpi,
  DxLiveDot,
  DxMessage,
  DxPage,
  DxPageHeader,
  DxPanel,
  DxSelect,
  DxStatusBar,
  DxStatusItem,
  apiErrorMessage,
  elapsed,
  type DxSelectOption,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { routes } from "@/config/routes";
import {
  advanceVisit,
  getVisitDetails,
  returnToConsultation,
  type Visit,
} from "@/features/visits/api/visits.api";
import { VisitBanner } from "@/features/visits/components/VisitBanner";
import { RoutePatientPopup } from "@/features/visits/components/RoutePatientPopup";
import { nextPathwayStep, normalizeSdpType, patientDisplayName, sdpTypeLabel } from "@/features/visits/lib/clinic-flow";
import type { QueueTicket } from "@/features/queues/api/queues.api";
import { ticketPatientName } from "@/features/queues/lib/ticket-utils";
import {
  useActiveServicePoints,
  useCallTicket,
  useCompleteAndEndVisitTicket,
  useMyServicePoints,
  useMyWorklist,
  useServeTicket,
  useServicePointWorklist,
} from "@/features/queues/hooks/use-queue";
// Embedded capture surfaces, keyed by the desk's ServicePointType.
import { TriagePage } from "@/features/clinical/pages/TriagePage";
import { ConsultationPage } from "@/features/clinical/pages/ConsultationPage";
import { EligibilityConfirmPage } from "@/features/insurance/pages/EligibilityConfirmPage";
import { LabOrdersPage } from "@/features/laboratory/pages/LabOrdersPage";
import { LabResultsPage } from "@/features/laboratory/pages/LabResultsPage";
import { PharmacyQueuePage } from "@/features/pharmacy/pages/PharmacyQueuePage";
import { BillingListPage } from "@/features/billing/pages/BillingListPage";

type Desk = { id: number; name: string; code: string; service_point_type: string };

/**
 * The capture surface for a desk, scoped to the active patient's visit. The
 * console owns flow control (call / complete / route), so each panel renders
 * in `embedded` mode: data capture only, no page chrome and no routing.
 */
function CapturePanel({ deskType, visitId }: { deskType: string; visitId: number }) {
  switch (normalizeSdpType(deskType)) {
    case "TRIAGE":
      return <TriagePage embedded visitId={visitId} />;
    case "CLINIC":
    case "EMERGENCY":
    case "PROCEDURE_ROOM":
    case "WARD":
    case "THEATRE":
      return <ConsultationPage embedded visitId={visitId} />;
    case "INSURANCE_CONFIRMATION":
      return <EligibilityConfirmPage embedded visitId={visitId} />;
    case "LABORATORY":
      // The lab scientist logs samples/orders and enters & releases results —
      // both stacked so the whole lab step happens here.
      return (
        <div className="space-y-4">
          <LabOrdersPage embedded visitId={visitId} />
          <LabResultsPage embedded visitId={visitId} />
        </div>
      );
    case "PHARMACY":
      return <PharmacyQueuePage embedded visitId={visitId} />;
    case "CASHIER":
      return <BillingListPage embedded visitId={visitId} />;
    default:
      return (
        <DxMessage tone="info" title={`${sdpTypeLabel(deskType)} desk`}>
          Attend to the patient at this station, then send them to the next stop on their pathway.
        </DxMessage>
      );
  }
}

/**
 * Service Desk — the single console a provider (nurse, doctor, lab scientist,
 * pharmacist, cashier, …) works from. It lands on the provider's own service
 * delivery point, shows that desk's live queue, and opens the matching capture
 * panel beside it. "Complete & send to next stop" advances the pathway, raising
 * the next desk's ticket, until the final step ends the visit.
 */
export function ServiceDeskPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const myDesksQuery = useMyServicePoints();
  const allDesksQuery = useActiveServicePoints();

  // Desks the provider can work: their assignment, else (admin/float) any active desk.
  const desks: Desk[] = useMemo(() => {
    const mine = myDesksQuery.data ?? [];
    if (mine.length) return mine.map((d) => ({ id: d.id, name: d.name, code: d.code, service_point_type: d.service_point_type }));
    const all = allDesksQuery.data?.items ?? [];
    return all.map((d) => ({ id: d.id, name: d.name, code: d.code, service_point_type: d.service_point_type }));
  }, [myDesksQuery.data, allDesksQuery.data]);
  const isMine = (myDesksQuery.data ?? []).length > 0;

  const [deskId, setDeskId] = useState<number | null>(null);
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);
  const [activeVisitId, setActiveVisitId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<null | "skip" | "end">(null);
  const [routeOpen, setRouteOpen] = useState(false);

  const selectedDesk = useMemo(() => desks.find((d) => d.id === deskId) ?? desks[0] ?? null, [desks, deskId]);
  const selectedId = selectedDesk?.id ?? null;

  // One of the two worklist hooks is live depending on whether this is the
  // caller's own desk (assignment-checked) or an ad-hoc view.
  const mineWl = useMyWorklist(selectedId ?? undefined, { enabled: isMine && !!selectedId });
  const anyWl = useServicePointWorklist(selectedId ?? 0, { enabled: !isMine && !!selectedId });
  const worklistQuery = isMine ? mineWl : anyWl;
  const worklist = worklistQuery.data;

  const waiting = useMemo(() => worklist?.waiting ?? [], [worklist]);
  const waitingOnly = useMemo(() => waiting.filter((t) => t.status === "WAITING"), [waiting]);
  const calledOnly = useMemo(() => waiting.filter((t) => t.status === "CALLED"), [waiting]);
  const serving = useMemo(() => worklist?.serving ?? [], [worklist]);

  const visitQuery = useQuery({
    queryKey: ["visits", "detail", activeVisitId],
    queryFn: () => getVisitDetails(activeVisitId as number),
    enabled: !!activeVisitId,
  });
  const activeVisit: Visit | null = visitQuery.data ?? null;

  const callMutation = useCallTicket();
  const serveMutation = useServeTicket();
  const endVisitMutation = useCompleteAndEndVisitTicket();

  const refreshQueue = () => {
    qc.invalidateQueries({ queryKey: ["queue"] });
    worklistQuery.refetch();
  };

  const activate = (ticket: QueueTicket) => {
    setActiveTicketId(ticket.id);
    setActiveVisitId(ticket.visit_id);
  };

  const clearActive = () => {
    setActiveTicketId(null);
    setActiveVisitId(null);
  };

  const changeDesk = (id: number) => {
    setDeskId(id);
    clearActive();
  };

  // Call the next waiting patient (or serve one already called), then attend.
  const handleCallNext = () => {
    const next = waitingOnly[0] ?? calledOnly[0] ?? null;
    if (!next) {
      toast.info("Queue is clear", "No patients are waiting at this desk.");
      return;
    }
    const serveit = (ticket: QueueTicket) =>
      serveMutation.mutate(
        { ticketId: ticket.id },
        {
          onSuccess: () => {
            activate(ticket);
            toast.success(`Now serving ${ticket.queue_number}`, ticketPatientName(ticket));
          },
          onError: (err) => toast.error("Could not start serving", apiErrorMessage(err)),
        },
      );
    if (next.status === "CALLED") {
      serveit(next);
    } else {
      callMutation.mutate(
        { ticketId: next.id },
        {
          onSuccess: () => serveit(next),
          onError: (err) => toast.error("Could not call the patient", apiErrorMessage(err)),
        },
      );
    }
  };

  const nextStep = nextPathwayStep(activeVisit);

  const advanceMutation = useMutation({
    mutationFn: (action: "complete" | "skip") =>
      advanceVisit(activeVisitId as number, { action, notes: action === "skip" ? "Stage skipped at the service desk." : undefined }),
    onSuccess: (res, action) => {
      refreshQueue();
      qc.invalidateQueries({ queryKey: ["visits"] });
      const status = String(res.visit?.status ?? "").toUpperCase();
      if (status === "COMPLETED") {
        toast.success("Visit completed", `${patientDisplayName(activeVisit?.patient)} has finished their visit.`);
      } else {
        const dest = res.visit?.current_service_delivery_point?.name ?? "the next service point";
        toast.success(action === "skip" ? "Stage skipped" : "Patient sent onward", `Now queued at ${dest}.`);
      }
      clearActive();
    },
    onError: (err) => toast.error("Could not advance the visit", apiErrorMessage(err)),
  });

  // After lab/radiology, send the patient back to the consulting room for the
  // doctor to review results and prescribe (then on to Pharmacy, Cashier/HMO).
  const returnMutation = useMutation({
    mutationFn: () => returnToConsultation(activeVisitId as number),
    onSuccess: () => {
      refreshQueue();
      qc.invalidateQueries({ queryKey: ["visits"] });
      toast.success("Sent to the consulting room", `${patientDisplayName(activeVisit?.patient)} is back with the doctor for review.`);
      clearActive();
    },
    onError: (err) => toast.error("Could not return to consultation", apiErrorMessage(err)),
  });

  const handleEndVisit = () => {
    if (!activeTicketId) return;
    endVisitMutation.mutate(
      { ticketId: activeTicketId },
      {
        onSuccess: (res) => {
          refreshQueue();
          qc.invalidateQueries({ queryKey: ["visits"] });
          toast.success("Visit ended", res.message || `${patientDisplayName(activeVisit?.patient)} has been checked out.`);
          clearActive();
        },
        onError: (err) => toast.error("Could not end the visit", apiErrorMessage(err)),
      },
    );
  };

  const deskOptions: DxSelectOption[] = desks.map((d) => ({ value: String(d.id), label: `${d.name} (${d.code})` }));
  const busyServe = callMutation.isPending || serveMutation.isPending;
  const busyFlow = advanceMutation.isPending || endVisitMutation.isPending;

  // ---------- Render ----------
  if (myDesksQuery.isLoading || allDesksQuery.isLoading) {
    return (
      <DxPage>
        <DxPageHeader title="Service Desk" subtitle="Loading your service point…" />
      </DxPage>
    );
  }

  if (!selectedDesk) {
    return (
      <DxPage>
        <DxPageHeader title="Service Desk" subtitle="Attend to patients routed to your service delivery point." />
        <DxMessage tone="warning" title="No service delivery point available">
          You are not assigned to a service delivery point and none are active. Ask an administrator to assign you to a
          desk, or open the <a className="dx-link" href={routes.queues}>Queues</a> page.
        </DxMessage>
      </DxPage>
    );
  }

  const deskType = selectedDesk.service_point_type;

  return (
    <DxPage>
      <DxPageHeader
        title="Service Desk"
        subtitle={`Attend to patients routed to ${selectedDesk.name}. Call the next patient, capture their visit, then send them on.`}
        actions={
          <>
            <DxLiveDot label="Live · refreshes every 30s" />
            {deskOptions.length > 1 ? (
              <DxSelect
                aria-label="Service delivery point"
                editorSize="sm"
                className="w-64"
                value={String(selectedId ?? "")}
                onChange={(e) => changeDesk(Number(e.target.value))}
                options={deskOptions}
              />
            ) : null}
            <DxButton
              leftIcon={<RefreshCw className={worklistQuery.isFetching ? "animate-spin" : undefined} />}
              onClick={refreshQueue}
            >
              Refresh
            </DxButton>
          </>
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <DxBadge tone="accent">{selectedDesk.name}</DxBadge>
          <DxBadge tone="outline">{sdpTypeLabel(deskType)}</DxBadge>
        </div>
      </DxPageHeader>

      <div className="grid gap-4 xl:grid-cols-12">
        {/* ---------- Queue rail ---------- */}
        <div className="space-y-3 xl:col-span-4">
          <div className="grid grid-cols-3 gap-2">
            <DxKpi label="Waiting" value={waitingOnly.length} icon={Users} tone="warning" isLoading={worklistQuery.isLoading} />
            <DxKpi label="Called" value={calledOnly.length} icon={PhoneCall} tone="info" isLoading={worklistQuery.isLoading} />
            <DxKpi label="Serving" value={serving.length} icon={PlayCircle} tone="accent" isLoading={worklistQuery.isLoading} />
          </div>

          <DxPanel
            title="Waiting & called"
            icon={<Users />}
            description={`${waitingOnly.length} waiting · ${calledOnly.length} called`}
            actions={
              <DxButton
                size="sm"
                variant="primary"
                leftIcon={<PhoneCall />}
                disabled={busyServe || (waitingOnly.length === 0 && calledOnly.length === 0)}
                onClick={handleCallNext}
              >
                Call next
              </DxButton>
            }
            flush
          >
            {worklistQuery.isError ? (
              <div className="p-3">
                <DxMessage tone="danger" title="Could not load the queue" action={<DxButton size="sm" onClick={() => worklistQuery.refetch()}>Retry</DxButton>}>
                  {apiErrorMessage(worklistQuery.error)}
                </DxMessage>
              </div>
            ) : waiting.length === 0 ? (
              <div className="dx-grid-state">
                <CheckCircle2 aria-hidden />
                <p className="dx-grid-state-title">Queue is clear</p>
                <p>No patients are waiting at this desk.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--dx-border)]">
                {waiting.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => activate(t)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--dx-grid-hover)]"
                    >
                      <span className="dx-mono rounded bg-[var(--dx-surface-alt)] px-2 py-1 text-[12px] font-semibold">{t.queue_number}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{ticketPatientName(t)}</span>
                        <span className="dx-mono dx-faint text-[11px]">{t.hospital_number ?? `#${t.patient_id}`} · waiting {elapsed(t.created_at)}</span>
                      </span>
                      <DxBadge tone={t.status === "CALLED" ? "info" : "warning"} dot>{t.status === "CALLED" ? "Called" : "Waiting"}</DxBadge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </DxPanel>

          {serving.length ? (
            <DxPanel title="In service" icon={<Volume2 />} description={`${serving.length} being attended`} flush>
              <ul className="divide-y divide-[var(--dx-border)]">
                {serving.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => activate(t)}
                      aria-current={t.id === activeTicketId ? "true" : undefined}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--dx-grid-hover)] ${t.id === activeTicketId ? "bg-[var(--dx-grid-selected)]" : ""}`}
                    >
                      <span className="dx-mono rounded bg-[var(--dx-accent-soft)] px-2 py-1 text-[12px] font-semibold text-[var(--dx-accent)]">{t.queue_number}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{ticketPatientName(t)}</span>
                        <span className="dx-mono dx-faint text-[11px]">in service {elapsed(t.service_started_at)}</span>
                      </span>
                      {t.id === activeTicketId ? <DxBadge tone="accent">Active</DxBadge> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </DxPanel>
          ) : null}
        </div>

        {/* ---------- Attend ---------- */}
        <div className="space-y-4 xl:col-span-8">
          {!activeVisitId ? (
            <DxPanel title="Attend" icon={<ClipboardList />}>
              <div className="dx-grid-state py-16">
                <PhoneCall aria-hidden />
                <p className="dx-grid-state-title">No patient in service</p>
                <p>Press <b>Call next</b> to bring the next patient from the queue, or pick one from the list.</p>
              </div>
            </DxPanel>
          ) : visitQuery.isLoading ? (
            <DxPanel title="Attend" icon={<ClipboardList />}>
              <div className="dx-skeleton h-24" />
            </DxPanel>
          ) : activeVisit ? (
            <>
              <VisitBanner
                visit={activeVisit}
                actions={
                  <>
                    <DxButton size="sm" leftIcon={<Shuffle />} onClick={() => setRouteOpen(true)} disabled={busyFlow}>
                      Re-route
                    </DxButton>
                    <DxButton size="sm" leftIcon={<SkipForward />} onClick={() => setConfirm("skip")} disabled={busyFlow}>
                      Skip
                    </DxButton>
                    <DxButton size="sm" variant="outline-danger" leftIcon={<LogOut />} onClick={() => setConfirm("end")} disabled={busyFlow}>
                      End visit
                    </DxButton>
                    {["LABORATORY", "RADIOLOGY"].includes(normalizeSdpType(deskType)) ? (
                      <DxButton
                        size="sm"
                        variant="primary"
                        leftIcon={<Stethoscope />}
                        isLoading={returnMutation.isPending}
                        disabled={busyFlow}
                        onClick={() => returnMutation.mutate()}
                      >
                        Return to Consultation
                      </DxButton>
                    ) : null}
                    <DxButton
                      size="sm"
                      variant={["LABORATORY", "RADIOLOGY"].includes(normalizeSdpType(deskType)) ? undefined : "primary"}
                      rightIcon={<ArrowRight />}
                      isLoading={advanceMutation.isPending}
                      disabled={busyFlow}
                      onClick={() => advanceMutation.mutate("complete")}
                    >
                      {nextStep ? `Complete & send to ${nextStep.service_delivery_point?.name ?? "next stop"}` : "Complete & end visit"}
                    </DxButton>
                  </>
                }
              />
              <CapturePanel deskType={deskType} visitId={activeVisitId} />
            </>
          ) : (
            <DxPanel title="Attend" icon={<ClipboardList />}>
              <DxMessage tone="danger" title="Could not load the patient's visit" action={<DxButton size="sm" onClick={() => visitQuery.refetch()}>Retry</DxButton>}>
                {apiErrorMessage(visitQuery.error)}
              </DxMessage>
            </DxPanel>
          )}
        </div>
      </div>

      <DxStatusBar>
        <DxStatusItem>Desk: <b>{selectedDesk.name}</b></DxStatusItem>
        <DxStatusItem>Station: <b>{sdpTypeLabel(deskType)}</b></DxStatusItem>
        <DxStatusItem>In queue: <b>{waiting.length + serving.length}</b></DxStatusItem>
        <span className="ml-auto">Completing a station sends the patient to the next stop on their pathway automatically.</span>
      </DxStatusBar>

      {activeVisit ? (
        <RoutePatientPopup
          visit={activeVisit}
          isOpen={routeOpen}
          onClose={() => setRouteOpen(false)}
          onRouted={() => {
            refreshQueue();
            clearActive();
          }}
        />
      ) : null}

      <DxConfirm
        isOpen={confirm === "skip"}
        onClose={() => setConfirm(null)}
        onConfirm={() => advanceMutation.mutate("skip")}
        title="Skip this stage"
        description={`Skip ${sdpTypeLabel(deskType)} for ${patientDisplayName(activeVisit?.patient)} and send them to the next stop?`}
        confirmLabel="Skip stage"
        tone="primary"
      />
      <DxConfirm
        isOpen={confirm === "end"}
        onClose={() => setConfirm(null)}
        onConfirm={handleEndVisit}
        title="End the visit"
        description={`End ${patientDisplayName(activeVisit?.patient)}'s visit now? Any remaining pathway stops will be closed.`}
        confirmLabel="End visit"
        tone="danger"
      />
    </DxPage>
  );
}
