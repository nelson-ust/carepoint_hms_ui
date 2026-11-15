import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  ChevronsRight,
  ClipboardList,
  Edit3,
  ExternalLink,
  Heart,
  History,
  ListOrdered,
  LogOut,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Scissors,
  SkipForward,
  Skull,
  Stethoscope,
  Ticket,
  Trash2,
  UserRound,
  Zap,
} from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxCheckbox,
  DxConfirm,
  DxForm,
  DxGrid,
  DxInput,
  DxMessage,
  DxPage,
  DxPageHeader,
  DxPageLoading,
  DxPanel,
  DxPopup,
  DxProps,
  DxSelect,
  DxStatusBadge,
  DxStatusBar,
  DxStatusItem,
  DxTabs,
  DxTextarea,
  apiErrorMessage,
  formatDateTime,
  humanize,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { routes } from "@/config/routes";
import { mortuaryApi } from "@/features/mortuary/api/mortuary.api";
import { VisitBillingPanel } from "@/features/billing/components/VisitBillingPanel";
import { DiagnosesPanel } from "@/features/diagnoses/components/DiagnosesPanel";
import { BookCaseModal } from "@/features/surgery/components/BookCaseModal";
import { getVitalSignsForVisit, recordVitalSign } from "@/features/vital-signs/api/vital-signs.api";
import type { VitalSign } from "@/features/vital-signs/api/vital-signs.api";
import { advanceVisit, deleteVisit, getServiceDeliveryPoints, getVisitDetails, updateVisit } from "../api/visits.api";
import type { QueueTicket, Visit } from "../api/visits.api";
import type { VisitStep } from "../api/visit-flows.api";
import { VisitActivityTimeline } from "../components/VisitActivityTimeline";
import { VisitBanner } from "../components/VisitBanner";
import { nextPathwayStep, patientDisplayName, sdpTypeLabel, visitPriorityTone, workstationPathFor } from "../lib/clinic-flow";
import {
  VISIT_PRIORITY_OPTIONS,
  VISIT_STATUS_OPTIONS,
  currentFlowStep,
  isVisitOpen,
  sortedFlowSteps,
  toNumberOrUndefined,
} from "../lib/visit-options";

// ============================================================
// Local form models
// ============================================================

type TabKey = "pathway" | "tickets" | "clinical" | "activity";
type PendingAction = "advance" | "skip" | "end" | "delete" | null;

// Format a Date as a value for <input type="datetime-local"> in local time.
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type EditForm = { visit_reason: string; priority: string; status: string; referred_from: string };

type VitalsForm = {
  temperature_celsius: string;
  pulse_rate: string;
  respiratory_rate: string;
  systolic_bp: string;
  diastolic_bp: string;
  oxygen_saturation: string;
  weight_kg: string;
  height_cm: string;
  pain_score: string;
};

const EMPTY_VITALS: VitalsForm = {
  temperature_celsius: "",
  pulse_rate: "",
  respiratory_rate: "",
  systolic_bp: "",
  diastolic_bp: "",
  oxygen_saturation: "",
  weight_kg: "",
  height_cm: "",
  pain_score: "",
};

const VITAL_FIELDS: { key: keyof VitalsForm; label: string; unit: string; placeholder: string; step: string }[] = [
  { key: "temperature_celsius", label: "Temperature", unit: "°C", placeholder: "36.6", step: "0.1" },
  { key: "pulse_rate", label: "Pulse", unit: "bpm", placeholder: "72", step: "1" },
  { key: "respiratory_rate", label: "Respiratory rate", unit: "cpm", placeholder: "16", step: "1" },
  { key: "oxygen_saturation", label: "SpO₂", unit: "%", placeholder: "98", step: "1" },
  { key: "systolic_bp", label: "Systolic BP", unit: "mmHg", placeholder: "120", step: "1" },
  { key: "diastolic_bp", label: "Diastolic BP", unit: "mmHg", placeholder: "80", step: "1" },
  { key: "weight_kg", label: "Weight", unit: "kg", placeholder: "70", step: "0.1" },
  { key: "height_cm", label: "Height", unit: "cm", placeholder: "170", step: "0.1" },
  { key: "pain_score", label: "Pain score", unit: "/10", placeholder: "0", step: "1" },
];

const bp = (v: VitalSign) => (v.systolic_bp != null && v.diastolic_bp != null ? `${v.systolic_bp}/${v.diastolic_bp}` : "—");
const show = (v: number | string | null | undefined, unit = "") => (v == null || v === "" ? "—" : `${v}${unit}`);

// ============================================================
// Page
// ============================================================

/**
 * Visit record — the full encounter: pathway steps, queue tickets, vitals,
 * diagnoses, charges and the audited activity stream, plus the lifecycle
 * commands (advance, skip, re-route, end, edit, delete).
 */
export function VisitDetailPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const id = Number(visitId);
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const [tab, setTab] = useState<TabKey>("pathway");
  const [pending, setPending] = useState<PendingAction>(null);
  const [isEditOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({ visit_reason: "", priority: "", status: "", referred_from: "" });
  const [isVitalsOpen, setVitalsOpen] = useState(false);
  const [vitalsForm, setVitalsForm] = useState<VitalsForm>(EMPTY_VITALS);
  const [isBookSurgeryOpen, setBookSurgeryOpen] = useState(false);
  const [isDeathOpen, setDeathOpen] = useState(false);
  const [deathForm, setDeathForm] = useState({ date_of_death: "", cause_of_death: "", place_of_death: "Hospital", notes: "", deposit: false, mortuary_unit_id: "" });

  // ---------- Queries ----------
  const visitQuery = useQuery({
    queryKey: ["visits", "detail", id],
    queryFn: () => getVisitDetails(id),
    enabled: Number.isFinite(id),
  });
  const vitalsQuery = useQuery({
    queryKey: ["vital-signs", "visit", id, "registry"],
    queryFn: () => getVitalSignsForVisit(id),
    enabled: Number.isFinite(id),
  });
  const sdpQuery = useQuery({
    queryKey: ["service-delivery-points", "active"],
    queryFn: () => getServiceDeliveryPoints({ limit: 200 }),
    enabled: Number.isFinite(id),
    staleTime: 5 * 60_000,
  });

  const visit = visitQuery.data ?? null;
  const steps = useMemo(() => sortedFlowSteps(visit), [visit]);
  const currentStep = currentFlowStep(visit);
  const nextStep = nextPathwayStep(visit);
  const tickets: QueueTicket[] = visit?.queue_tickets ?? [];
  const sdpName = (sdpId: number) => sdpQuery.data?.find((s) => s.id === sdpId)?.name ?? `SDP #${sdpId}`;

  const vitals = useMemo(
    () =>
      [...(vitalsQuery.data?.items ?? [])].sort(
        (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
      ),
    [vitalsQuery.data],
  );
  const latestVital = vitals[0];

  // ---------- Mutations ----------
  const refreshVisit = () => {
    qc.invalidateQueries({ queryKey: ["visits"] });
    qc.invalidateQueries({ queryKey: ["queue"] });
  };

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateVisit>[1]) => updateVisit(id, payload),
    onSuccess: (updated) => {
      qc.setQueryData<Visit>(["visits", "detail", id], (prev) => (prev ? { ...prev, ...updated } : updated));
      refreshVisit();
    },
  });

  const saveEdit = () =>
    updateMutation.mutate(
      {
        visit_reason: editForm.visit_reason || undefined,
        priority: editForm.priority || undefined,
        status: editForm.status || undefined,
        referred_from: editForm.referred_from || undefined,
      },
      {
        onSuccess: () => {
          setEditOpen(false);
          toast.success("Visit updated", "Encounter details saved.");
        },
        onError: (err) => toast.error("Could not update visit", apiErrorMessage(err)),
      },
    );

  const endVisit = () =>
    updateMutation.mutateAsync(
      { status: "COMPLETED", check_out_time: new Date().toISOString() },
      {
        onSuccess: () => toast.success("Visit ended", `${patientDisplayName(visit?.patient)} has been checked out.`),
        onError: (err) => toast.error("Could not end the visit", apiErrorMessage(err)),
      },
    );

  const advanceMutation = useMutation({
    mutationFn: (action: "complete" | "skip") => advanceVisit(id, { action }),
    onSuccess: (res, action) => {
      refreshVisit();
      const dest = res.visit?.current_service_delivery_point?.name;
      toast.success(
        action === "skip" ? "Stage skipped" : "Stage completed",
        res.message || (dest ? `Patient moved to ${dest}.` : "The visit has moved to its next step."),
      );
    },
    onError: (err) => toast.error("Could not advance the visit", apiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteVisit(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["visits"] });
      toast.success("Visit deleted", "The record was removed from the registry.");
      navigate(routes.visits);
    },
    onError: (err) => toast.error("Could not delete this visit", apiErrorMessage(err)),
  });

  const vitalsMutation = useMutation({
    mutationFn: () =>
      recordVitalSign({
        visit_id: id,
        temperature_celsius: toNumberOrUndefined(vitalsForm.temperature_celsius),
        pulse_rate: toNumberOrUndefined(vitalsForm.pulse_rate),
        respiratory_rate: toNumberOrUndefined(vitalsForm.respiratory_rate),
        systolic_bp: toNumberOrUndefined(vitalsForm.systolic_bp),
        diastolic_bp: toNumberOrUndefined(vitalsForm.diastolic_bp),
        oxygen_saturation: toNumberOrUndefined(vitalsForm.oxygen_saturation),
        weight_kg: toNumberOrUndefined(vitalsForm.weight_kg),
        height_cm: toNumberOrUndefined(vitalsForm.height_cm),
        pain_score: toNumberOrUndefined(vitalsForm.pain_score),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vital-signs", "visit", id] });
      setVitalsForm(EMPTY_VITALS);
      setVitalsOpen(false);
      toast.success("Vital signs recorded");
    },
    onError: (err) => toast.error("Could not record vital signs", apiErrorMessage(err)),
  });

  // ---------- Handlers ----------
  const openEdit = () => {
    if (!visit) return;
    setEditForm({
      visit_reason: visit.visit_reason ?? "",
      priority: visit.priority ?? "ROUTINE",
      status: visit.status ?? "ACTIVE",
      referred_from: visit.referred_from ?? "",
    });
    setEditOpen(true);
  };
  const setEdit = (key: keyof EditForm) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setEditForm((f) => ({ ...f, [key]: e.target.value }));
  const setVital = (key: keyof VitalsForm) => (e: ChangeEvent<HTMLInputElement>) =>
    setVitalsForm((f) => ({ ...f, [key]: e.target.value }));
  const hasVitalValue = Object.values(vitalsForm).some((v) => v.trim() !== "");

  const refetchAll = () => {
    visitQuery.refetch();
    vitalsQuery.refetch();
    qc.invalidateQueries({ queryKey: ["visits", id, "timeline"] });
  };

  // ---------- Grid columns ----------
  const stepColumns: DxGridColumn<VisitStep>[] = [
    { key: "step_order", header: "#", width: 48, align: "center", sortable: true, render: (s) => <span className="dx-mono">{s.step_order}</span> },
    {
      key: "service_point",
      header: "Service point",
      minWidth: 180,
      sortable: true,
      accessor: (s) => s.service_delivery_point?.name ?? "",
      render: (s) => (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-medium">{s.service_delivery_point?.name ?? `SDP #${s.service_delivery_point_id}`}</span>
          <span className="dx-faint text-[11px]">{sdpTypeLabel(s.service_delivery_point?.service_point_type)}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 190,
      render: (s) => (
        <span className="inline-flex flex-wrap items-center gap-1">
          <DxStatusBadge status={s.is_skipped ? "SKIPPED" : s.status || "PENDING"} />
          {s.id === currentStep?.id ? <DxBadge tone="accent">Current</DxBadge> : null}
          {!s.is_required ? <DxBadge tone="outline">Optional</DxBadge> : null}
        </span>
      ),
    },
    { key: "started_at", header: "Started", width: 150, sortable: true, render: (s) => <span className="dx-mono">{formatDateTime(s.started_at)}</span> },
    { key: "completed_at", header: "Completed", width: 150, sortable: true, render: (s) => <span className="dx-mono">{formatDateTime(s.completed_at)}</span> },
    { key: "notes", header: "Notes", minWidth: 160, wrap: true, render: (s) => s.notes || <span className="dx-faint">—</span> },
  ];

  const ticketColumns: DxGridColumn<QueueTicket>[] = [
    { key: "queue_number", header: "Ticket", width: 110, sortable: true, render: (t) => <span className="dx-mono dx-strong">{t.queue_number}</span> },
    { key: "service_point", header: "Service point", minWidth: 170, sortable: true, accessor: (t) => sdpName(t.service_delivery_point_id), render: (t) => sdpName(t.service_delivery_point_id) },
    { key: "queue_position", header: "Position", width: 90, align: "center", sortable: true, render: (t) => t.queue_position ?? "—" },
    { key: "status", header: "Status", width: 120, sortable: true, render: (t) => <DxStatusBadge status={t.status || "WAITING"} /> },
    { key: "created_at", header: "Issued", width: 150, sortable: true, render: (t) => <span className="dx-mono">{formatDateTime(t.created_at)}</span> },
    { key: "called_at", header: "Called", width: 150, sortable: true, render: (t) => <span className="dx-mono">{formatDateTime(t.called_at)}</span> },
    { key: "service_started_at", header: "Service started", width: 150, sortable: true, render: (t) => <span className="dx-mono">{formatDateTime(t.service_started_at)}</span> },
    { key: "service_ended_at", header: "Service ended", width: 150, sortable: true, render: (t) => <span className="dx-mono">{formatDateTime(t.service_ended_at)}</span> },
  ];

  const vitalsColumns: DxGridColumn<VitalSign>[] = [
    { key: "recorded_at", header: "Recorded", width: 150, sortable: true, render: (r) => <span className="dx-mono">{formatDateTime(r.recorded_at)}</span> },
    { key: "temperature_celsius", header: "Temp", align: "center", render: (r) => show(r.temperature_celsius, "°") },
    { key: "pulse_rate", header: "Pulse", align: "center", render: (r) => show(r.pulse_rate) },
    { key: "respiratory_rate", header: "RR", align: "center", render: (r) => show(r.respiratory_rate) },
    { key: "bp", header: "BP", align: "center", render: (r) => <span className="dx-mono">{bp(r)}</span> },
    { key: "oxygen_saturation", header: "SpO₂", align: "center", render: (r) => show(r.oxygen_saturation, "%") },
    { key: "weight_kg", header: "Weight", align: "center", render: (r) => show(r.weight_kg, " kg") },
    { key: "bmi", header: "BMI", align: "center", render: (r) => (r.bmi != null ? Number(r.bmi).toFixed(1) : "—") },
    { key: "pain_score", header: "Pain", align: "center", render: (r) => show(r.pain_score) },
  ];

  // ---------- Render guards ----------
  if (!Number.isFinite(id)) {
    return (
      <DxPage>
        <DxMessage tone="danger" title="Invalid visit">
          The visit record needs a valid identifier. Open a visit from the registry.
        </DxMessage>
      </DxPage>
    );
  }
  if (visitQuery.isLoading) return <DxPageLoading label="Loading visit record…" />;
  if (visitQuery.isError || !visit) {
    return (
      <DxPage>
        <DxPageHeader crumbs={[{ label: "Visits", to: routes.visits }, { label: `#${id}` }]} title="Visit not found" />
        <DxMessage
          tone="danger"
          title="Could not load this visit"
          action={
            <span className="flex gap-2">
              <DxButton size="sm" onClick={() => visitQuery.refetch()} leftIcon={<RotateCcw />}>
                Retry
              </DxButton>
              <DxButton size="sm" onClick={() => navigate(routes.visits)}>
                Back to registry
              </DxButton>
            </span>
          }
        >
          {apiErrorMessage(visitQuery.error, "The record may have been removed or the registry is offline.")}
        </DxMessage>
      </DxPage>
    );
  }

  const open = isVisitOpen(visit.status);
  const completed = String(visit.status).toUpperCase() === "COMPLETED";
  const deceased = String(visit.status).toUpperCase() === "DECEASED";
  const currentSdp = visit.current_service_delivery_point ?? visit.first_service_delivery_point;
  const workstation = workstationPathFor(currentSdp?.service_point_type, visit.id);
  const code = visit.visit_code || `#${visit.id}`;
  const busy = advanceMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const confirmCopy: Record<Exclude<PendingAction, null>, { title: string; description: ReactNode; label: string; tone: "danger" | "primary" }> = {
    advance: {
      title: "Advance to next step",
      description: nextStep ? (
        <>
          Complete <b className="dx-strong">{currentStep?.service_delivery_point?.name ?? currentSdp?.name ?? "the current stage"}</b> and move{" "}
          {patientDisplayName(visit.patient)} to <b className="dx-strong">{nextStep.service_delivery_point?.name ?? `step ${nextStep.step_order}`}</b>. A queue
          ticket will be raised there.
        </>
      ) : steps.length ? (
        <>This is the last step on the pathway. Completing it will end the visit.</>
      ) : (
        <>This visit has no pathway steps; the server will decide the next stop or refuse the move.</>
      ),
      label: nextStep ? `Move to ${nextStep.service_delivery_point?.name ?? "next step"}` : "Complete stage",
      tone: "primary",
    },
    skip: {
      title: "Skip current stage",
      description: (
        <>
          Bypass <b className="dx-strong">{currentStep?.service_delivery_point?.name ?? currentSdp?.name ?? "the current stage"}</b> without completing it
          {nextStep ? <> and move the patient to <b className="dx-strong">{nextStep.service_delivery_point?.name}</b></> : null}. The step is kept on the record as skipped.
        </>
      ),
      label: "Skip stage",
      tone: "primary",
    },
    end: {
      title: "End visit",
      description: (
        <>
          Mark visit <b className="dx-mono dx-strong">{code}</b> as completed and check {patientDisplayName(visit.patient)} out now. Open queue tickets stay on
          the record; the encounter can no longer be advanced.
        </>
      ),
      label: "End visit",
      tone: "danger",
    },
    delete: {
      title: "Delete visit",
      description: (
        <>
          Permanently delete visit <b className="dx-mono dx-strong">{code}</b>. This cannot be undone and will be refused if clinical records depend on it.
        </>
      ),
      label: "Delete visit",
      tone: "danger",
    },
  };

  const mortuaryUnitsQuery = useQuery({
    queryKey: ["mortuary", "units", "for-death"],
    queryFn: () => mortuaryApi.listUnits({ limit: 200 }),
    enabled: isDeathOpen,
  });
  const deathUnitOptions = useMemo(
    () =>
      (mortuaryUnitsQuery.data?.items ?? [])
        .filter((u) => u.status !== "OUT_OF_SERVICE" && u.available_slots > 0)
        .map((u) => ({ value: String(u.id), label: `${u.name} (${u.available_slots} free)` })),
    [mortuaryUnitsQuery.data],
  );
  const recordDeathMutation = useMutation({
    mutationFn: () =>
      mortuaryApi.recordDeath({
        patient_id: visit!.patient_id,
        visit_id: visit!.id,
        date_of_death: deathForm.date_of_death || new Date().toISOString(),
        cause_of_death: deathForm.cause_of_death || undefined,
        place_of_death: deathForm.place_of_death || undefined,
        notes: deathForm.notes || undefined,
        deposit_to_mortuary: deathForm.deposit,
        mortuary_unit_id: deathForm.deposit && deathForm.mortuary_unit_id ? Number(deathForm.mortuary_unit_id) : undefined,
      }),
    onSuccess: (res) => {
      toast.success("Death recorded", res.record ? "Body deposited to the mortuary." : "The visit has been closed as deceased.");
      setDeathOpen(false);
      setDeathForm({ date_of_death: "", cause_of_death: "", place_of_death: "Hospital", notes: "", deposit: false, mortuary_unit_id: "" });
      qc.invalidateQueries({ queryKey: ["mortuary"] });
      refreshVisit();
      refetchAll();
    },
    onError: (err) => toast.error("Could not record death", apiErrorMessage(err)),
  });

  const runPending = async () => {
    if (pending === "advance") await advanceMutation.mutateAsync("complete").catch(() => undefined);
    else if (pending === "skip") await advanceMutation.mutateAsync("skip").catch(() => undefined);
    else if (pending === "end") await endVisit().catch(() => undefined);
    else if (pending === "delete") await deleteMutation.mutateAsync().catch(() => undefined);
  };

  const encounterItems = [
    { label: "Status", value: <DxStatusBadge status={visit.status} /> },
    { label: "Priority", value: <DxBadge tone={visitPriorityTone(visit.priority)}>{humanize(visit.priority || "ROUTINE")}</DxBadge> },
    { label: "Visit date", value: formatDateTime(visit.visit_date) },
    { label: "Check-in", value: formatDateTime(visit.check_in_time) },
    { label: "Check-out", value: formatDateTime(visit.check_out_time) },
    { label: "Current point", value: currentSdp ? `${currentSdp.name} (${currentSdp.code})` : "—" },
    { label: "First point", value: visit.first_service_delivery_point?.name ?? "—" },
    { label: "Reason", value: visit.visit_reason || "—" },
    { label: "Referred from", value: visit.referred_from || "—" },
    {
      label: "Appointment",
      value: visit.appointment ? (
        <span className="flex flex-col leading-tight">
          <span className="dx-mono">{visit.appointment.appointment_code}</span>
          <span className="dx-faint text-[11px]">{formatDateTime(visit.appointment.scheduled_start_at)}</span>
        </span>
      ) : visit.appointment_id ? (
        `#${visit.appointment_id}`
      ) : (
        "Walk-in"
      ),
    },
    { label: "Last updated", value: formatDateTime(visit.updated_at) },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Visits", to: routes.visits }, { label: code }]}
        title={`Visit ${code}`}
        subtitle="Full clinical lifecycle: pathway, queue tickets, vitals, diagnoses, charges and activity."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={refetchAll} isLoading={visitQuery.isFetching}>
              <RotateCcw />
            </DxButton>
            <DxButton leftIcon={<Printer />} onClick={() => window.print()}>
              Print
            </DxButton>
            <DxButton leftIcon={<Edit3 />} onClick={openEdit} disabled={busy}>
              Edit
            </DxButton>
            <DxButton leftIcon={<ArrowRight />} onClick={() => navigate(routes.visitReroute.replace(":visitId", String(visit.id)))} disabled={busy}>
              Re-route
            </DxButton>
            {open ? (
              <>
                <DxButton leftIcon={<SkipForward />} onClick={() => setPending("skip")} disabled={busy} title="Skip the current stage and move to the next">
                  Skip stage
                </DxButton>
                <DxButton
                  variant="primary"
                  leftIcon={<ChevronsRight />}
                  onClick={() => setPending("advance")}
                  isLoading={advanceMutation.isPending}
                  disabled={busy}
                  title="Complete the current stage and move the patient to the next step"
                >
                  Advance to next step
                </DxButton>
              </>
            ) : null}
            {open && !deceased ? (
              <DxButton variant="outline-danger" leftIcon={<Skull />} onClick={() => { setDeathForm((f) => ({ ...f, date_of_death: toLocalInput(new Date()) })); setDeathOpen(true); }} disabled={busy} title="Record this patient's death">
                Record death
              </DxButton>
            ) : null}
            {!completed && !deceased ? (
              <DxButton variant="outline-danger" leftIcon={<LogOut />} onClick={() => setPending("end")} disabled={busy}>
                End visit
              </DxButton>
            ) : null}
            <DxButton variant="text" icon title="Delete visit" className="text-[var(--dx-danger)]" onClick={() => setPending("delete")} disabled={busy}>
              <Trash2 />
            </DxButton>
          </>
        }
      />

      <VisitBanner visit={visit} />

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <DxTabs<TabKey>
            value={tab}
            onChange={setTab}
            items={[
              { key: "pathway", label: "Pathway", icon: <ListOrdered />, count: steps.length },
              { key: "tickets", label: "Queue tickets", icon: <Ticket />, count: tickets.length },
              { key: "clinical", label: "Clinical", icon: <Stethoscope />, count: vitals.length || null },
              { key: "activity", label: "Activity", icon: <History /> },
            ]}
            className="mb-3"
          />

          {tab === "pathway" ? (
            <DxGrid<VisitStep>
              columns={stepColumns}
              data={steps}
              rowKey={(s) => s.id}
              selectedKey={currentStep?.id ?? null}
              striped={false}
              empty={{
                icon: ListOrdered,
                title: "No pathway on this visit",
                description: "Flow steps are created when a visit is initiated from a template or re-routed. Use Re-route to send the patient to a service point.",
                action: (
                  <DxButton size="sm" leftIcon={<ArrowRight />} onClick={() => navigate(routes.visitReroute.replace(":visitId", String(visit.id)))}>
                    Re-route
                  </DxButton>
                ),
              }}
            />
          ) : null}

          {tab === "tickets" ? (
            <DxGrid<QueueTicket>
              columns={ticketColumns}
              data={tickets}
              rowKey={(t) => t.id}
              isLoading={sdpQuery.isLoading && tickets.length > 0}
              empty={{ icon: Ticket, title: "No queue tickets", description: "Tickets are raised as the visit reaches each service point." }}
            />
          ) : null}

          {tab === "clinical" ? (
            <div className="space-y-4">
              <DxPanel
                title="Vital signs"
                icon={<Heart />}
                description={latestVital ? `Latest reading ${formatDateTime(latestVital.recorded_at)} · ${vitals.length} on this visit` : "No readings recorded on this visit yet."}
                actions={
                  <DxButton
                    size="sm"
                    leftIcon={<Plus />}
                    onClick={() => {
                      setVitalsForm(EMPTY_VITALS);
                      setVitalsOpen(true);
                    }}
                  >
                    Record vitals
                  </DxButton>
                }
                flush
              >
                {latestVital ? (
                  <DxProps
                    tight
                    className="px-3 py-1"
                    items={[
                      { label: "Temperature", value: show(latestVital.temperature_celsius, " °C") },
                      { label: "Pulse", value: show(latestVital.pulse_rate, " bpm") },
                      { label: "Respiratory rate", value: show(latestVital.respiratory_rate, " cpm") },
                      { label: "Blood pressure", value: <span className="dx-mono">{bp(latestVital)}{bp(latestVital) !== "—" ? " mmHg" : ""}</span> },
                      { label: "SpO₂", value: show(latestVital.oxygen_saturation, " %") },
                      { label: "Weight / height", value: `${show(latestVital.weight_kg, " kg")} / ${show(latestVital.height_cm, " cm")}` },
                      { label: "BMI", value: latestVital.bmi != null ? Number(latestVital.bmi).toFixed(1) : "—" },
                      { label: "Pain score", value: show(latestVital.pain_score, " / 10") },
                    ]}
                  />
                ) : vitalsQuery.isError ? (
                  <DxMessage tone="warning" className="m-3">
                    {apiErrorMessage(vitalsQuery.error, "Vital signs could not be loaded.")}
                  </DxMessage>
                ) : null}
                {vitals.length > 1 ? (
                  <DxGrid<VitalSign> borderless columns={vitalsColumns} data={vitals} rowKey={(r) => r.id} isLoading={vitalsQuery.isLoading} maxHeight={320} />
                ) : vitals.length === 0 && !vitalsQuery.isError ? (
                  <p className="px-3 py-6 text-center text-[12.5px] text-[var(--dx-text-muted)]">
                    {vitalsQuery.isLoading ? "Loading readings…" : "Record the first set of vitals from triage or with the button above."}
                  </p>
                ) : null}
              </DxPanel>

              {/* Diagnoses are read-only here; editing happens in the consultation workstation. */}
              <DiagnosesPanel visitId={visit.id} disabled />

              {/* Charges accrued, payments and outstanding balance. */}
              <VisitBillingPanel visitId={visit.id} />
            </div>
          ) : null}

          {tab === "activity" ? <VisitActivityTimeline visitId={visit.id} /> : null}
        </div>

        <div className="space-y-4 xl:col-span-4">
          <DxPanel title="Encounter" icon={<ClipboardList />} flush actions={<DxButton size="sm" variant="text" leftIcon={<Edit3 />} onClick={openEdit}>Edit</DxButton>}>
            <DxProps items={encounterItems} />
          </DxPanel>

          <DxPanel title="Quick actions" icon={<Zap />} description={currentSdp ? `Patient is at ${currentSdp.name}.` : "No current service point."}>
            <div className="flex flex-col gap-2">
              <DxButton variant="primary" leftIcon={<ExternalLink />} onClick={() => navigate(workstation.path)} className="justify-start">
                {workstation.label}
              </DxButton>
              <DxButton leftIcon={<Stethoscope />} onClick={() => navigate(`${routes.consultation}/${visit.id}`)} className="justify-start">
                Open consultation
              </DxButton>
              <DxButton leftIcon={<Activity />} onClick={() => navigate(`${routes.triage}/${visit.id}`)} className="justify-start">
                Open triage
              </DxButton>
              <DxButton leftIcon={<Scissors />} onClick={() => setBookSurgeryOpen(true)} className="justify-start" title="Book a surgical case for this patient">
                Book surgery
              </DxButton>
              <DxButton leftIcon={<UserRound />} onClick={() => navigate(routes.patientDetail.replace(":patientId", String(visit.patient_id)))} className="justify-start">
                Patient record
              </DxButton>
              <DxButton leftIcon={<ArrowRight />} onClick={() => navigate(routes.visitReroute.replace(":visitId", String(visit.id)))} className="justify-start">
                Re-route to another service point
              </DxButton>
            </div>
          </DxPanel>
        </div>
      </div>

      <DxStatusBar>
        <DxStatusItem>
          Visit <b className="dx-mono">{visit.visit_code}</b>
        </DxStatusItem>
        <DxStatusItem>
          Steps: <b>{steps.length}</b>
        </DxStatusItem>
        <DxStatusItem>
          Tickets: <b>{tickets.length}</b>
        </DxStatusItem>
        <DxStatusItem>
          Vitals: <b>{vitals.length}</b>
        </DxStatusItem>
        {nextStep && open ? (
          <DxStatusItem>
            Next: <b>{nextStep.service_delivery_point?.name}</b>
          </DxStatusItem>
        ) : null}
        <span className="ml-auto">Updated {formatDateTime(visit.updated_at)}</span>
      </DxStatusBar>

      {/* ---------- Overlays ---------- */}
      <DxConfirm
        isOpen={pending != null}
        onClose={() => setPending(null)}
        onConfirm={runPending}
        title={pending ? confirmCopy[pending].title : ""}
        description={pending ? confirmCopy[pending].description : null}
        confirmLabel={pending ? confirmCopy[pending].label : "Confirm"}
        tone={pending ? confirmCopy[pending].tone : "primary"}
      />

      <DxPopup
        isOpen={isDeathOpen}
        onClose={() => setDeathOpen(false)}
        title="Record patient death"
        locked={recordDeathMutation.isPending}
        footer={
          <>
            <DxButton onClick={() => setDeathOpen(false)} disabled={recordDeathMutation.isPending}>Cancel</DxButton>
            <DxButton variant="primary" leftIcon={<Skull />} isLoading={recordDeathMutation.isPending} onClick={() => recordDeathMutation.mutate()}>
              {deathForm.deposit ? "Record & deposit" : "Record death"}
            </DxButton>
          </>
        }
      >
        <DxMessage tone="warning" className="mb-3">
          Recording a death closes visit <b className="dx-mono dx-strong">{code}</b> for {patientDisplayName(visit.patient)} and marks it as deceased. This drives mortuary intake.
        </DxMessage>
        <DxForm cols={2}>
          <DxInput label="Date / time of death" type="datetime-local" value={deathForm.date_of_death} onChange={(e) => setDeathForm((f) => ({ ...f, date_of_death: e.target.value }))} />
          <DxInput label="Place of death" value={deathForm.place_of_death} onChange={(e) => setDeathForm((f) => ({ ...f, place_of_death: e.target.value }))} />
          <DxTextarea label="Cause of death" fieldClassName="dx-col-span-full" rows={2} value={deathForm.cause_of_death} onChange={(e) => setDeathForm((f) => ({ ...f, cause_of_death: e.target.value }))} />
          <DxTextarea label="Notes" fieldClassName="dx-col-span-full" rows={2} value={deathForm.notes} onChange={(e) => setDeathForm((f) => ({ ...f, notes: e.target.value }))} />
          <DxCheckbox label="Deposit the body at the mortuary now" className="dx-col-span-full" checked={deathForm.deposit} onChange={(e) => setDeathForm((f) => ({ ...f, deposit: (e.target as HTMLInputElement).checked }))} />
          {deathForm.deposit ? (
            <DxSelect label="Storage unit (optional)" fieldClassName="dx-col-span-full" value={deathForm.mortuary_unit_id} onChange={(e) => setDeathForm((f) => ({ ...f, mortuary_unit_id: e.target.value }))}
              placeholder="Register only — assign storage later"
              options={deathUnitOptions}
              hint={deathUnitOptions.length ? undefined : "No storage units with free space — the body will be registered without a unit."} />
          ) : null}
        </DxForm>
      </DxPopup>

      <DxPopup
        isOpen={isEditOpen}
        onClose={() => setEditOpen(false)}
        title="Edit visit"
        locked={updateMutation.isPending}
        footer={
          <>
            <DxButton onClick={() => setEditOpen(false)} disabled={updateMutation.isPending}>
              Cancel
            </DxButton>
            <DxButton variant="primary" leftIcon={<Save />} onClick={saveEdit} isLoading={updateMutation.isPending}>
              Save changes
            </DxButton>
          </>
        }
      >
        <DxForm cols={2}>
          <DxSelect label="Status" value={editForm.status} onChange={setEdit("status")} options={VISIT_STATUS_OPTIONS} />
          <DxSelect label="Priority" value={editForm.priority} onChange={setEdit("priority")} options={VISIT_PRIORITY_OPTIONS} />
          <DxInput
            label="Referred from"
            fieldClassName="dx-col-span-full"
            value={editForm.referred_from}
            onChange={setEdit("referred_from")}
            placeholder="Referring facility or department"
          />
          <DxTextarea
            label="Reason for visit"
            fieldClassName="dx-col-span-full"
            rows={4}
            value={editForm.visit_reason}
            onChange={setEdit("visit_reason")}
            placeholder="Clinical indication for this encounter"
          />
        </DxForm>
      </DxPopup>

      <DxPopup
        isOpen={isVitalsOpen}
        onClose={() => setVitalsOpen(false)}
        title="Record vital signs"
        size="lg"
        locked={vitalsMutation.isPending}
        footer={
          <>
            <DxButton onClick={() => setVitalsOpen(false)} disabled={vitalsMutation.isPending}>
              Cancel
            </DxButton>
            <DxButton variant="primary" leftIcon={<Save />} onClick={() => vitalsMutation.mutate()} isLoading={vitalsMutation.isPending} disabled={!hasVitalValue}>
              Record vitals
            </DxButton>
          </>
        }
      >
        <DxMessage tone="info" className="mb-3">
          For a full triage with BMI and MEWS scoring, use the triage workstation. This quick entry attaches a plain reading to the encounter.
        </DxMessage>
        <DxForm cols={3}>
          {VITAL_FIELDS.map((f) => (
            <DxInput
              key={f.key}
              label={f.label}
              type="number"
              inputMode="decimal"
              step={f.step}
              unit={f.unit}
              mono
              placeholder={f.placeholder}
              value={vitalsForm[f.key]}
              onChange={setVital(f.key)}
              disabled={vitalsMutation.isPending}
            />
          ))}
        </DxForm>
      </DxPopup>

      <BookCaseModal
        isOpen={isBookSurgeryOpen}
        onClose={() => setBookSurgeryOpen(false)}
        presetPatient={{
          id: visit.patient_id,
          label: visit.patient ? `${patientDisplayName(visit.patient)} · ${visit.patient.hospital_number}` : `Patient #${visit.patient_id}`,
        }}
        presetVisitId={visit.id}
        onBooked={(c) => navigate(routes.surgeryCase.replace(":caseId", String(c.id)))}
      />
    </DxPage>
  );
}
