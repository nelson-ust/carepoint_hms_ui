import { useMemo, useState, type ChangeEvent, type ElementType } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Droplet,
  Eraser,
  Heart,
  History,
  RotateCcw,
  Save,
  Scale,
  Thermometer,
  Wind,
} from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxField,
  DxGrid,
  DxGroupBox,
  DxInput,
  DxMessage,
  DxPage,
  DxPageHeader,
  DxPageLoading,
  DxPanel,
  DxPopup,
  DxProps,
  DxSelect,
  DxSkeleton,
  DxStatusBar,
  DxStatusItem,
  DxTextarea,
  DxToolbar,
  DxToolbarGroup,
  DxToolbarSpacer,
  apiErrorMessage,
  formatDateTime,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { routes } from "@/config/routes";
import { getCurrentStaff } from "@/features/staff/api/staff.api";
import {
  advanceVisit,
  getServiceDeliveryPoints,
  getVisitDetails,
  rerouteVisit,
  type ServiceDeliveryPoint,
} from "@/features/visits/api/visits.api";
import { VisitBanner } from "@/features/visits/components/VisitBanner";
import { nextPathwayStep, patientDisplayName } from "@/features/visits/lib/clinic-flow";
import {
  bmiCategory,
  computeBmi,
  computeMews,
  getVisitVitalSigns,
  mewsBand,
  recordVitalSigns,
  vitalFlag,
  type RecordVitalSignPayload,
  type VitalSign,
} from "../api/vital-signs.api";

// ============================================================
// Form model
// ============================================================

type VitalKey =
  | "temperature_celsius"
  | "pulse_rate"
  | "respiratory_rate"
  | "oxygen_saturation"
  | "systolic_bp"
  | "diastolic_bp"
  | "weight_kg"
  | "height_cm";

type VitalsForm = Record<VitalKey, string> & { pain_score: string; notes: string };

const EMPTY_FORM: VitalsForm = {
  temperature_celsius: "",
  pulse_rate: "",
  respiratory_rate: "",
  oxygen_saturation: "",
  systolic_bp: "",
  diastolic_bp: "",
  weight_kg: "",
  height_cm: "",
  pain_score: "0",
  notes: "",
};

type FieldSpec = {
  key: VitalKey;
  label: string;
  unit: string;
  icon: ElementType;
  placeholder: string;
  step: string;
  min: number;
  max: number;
};

const INDEX_FIELDS: FieldSpec[] = [
  { key: "temperature_celsius", label: "Temperature", unit: "°C", icon: Thermometer, placeholder: "36.8", step: "0.1", min: 30, max: 45 },
  { key: "pulse_rate", label: "Pulse rate", unit: "bpm", icon: Heart, placeholder: "72", step: "1", min: 20, max: 250 },
  { key: "respiratory_rate", label: "Respiratory rate", unit: "cpm", icon: Wind, placeholder: "16", step: "1", min: 4, max: 70 },
  { key: "oxygen_saturation", label: "SpO₂", unit: "%", icon: Droplet, placeholder: "98", step: "1", min: 50, max: 100 },
];

const PAIN_OPTIONS = Array.from({ length: 11 }, (_, i) => ({
  value: String(i),
  label: i === 0 ? "0 — No pain" : i <= 3 ? `${i} — Mild` : i <= 6 ? `${i} — Moderate` : `${i} — Severe`,
}));

const num = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ============================================================
// Page
// ============================================================

/**
 * Triage workstation. The nurse records the physiological index, the page
 * derives BMI + MEWS live, and "Save & Route" closes the triage step and moves
 * the patient to the next checkpoint on their care pathway (consulting room).
 */
export function TriagePage(props: { visitId?: number; embedded?: boolean } = {}) {
  const embedded = props.embedded ?? false;
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { visitId } = useParams<{ visitId: string }>();
  const id = props.visitId ?? Number(visitId);

  const [form, setForm] = useState<VitalsForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof VitalsForm, string>>>({});
  const [routePopup, setRoutePopup] = useState<{ open: boolean; reason?: string }>({ open: false });
  const [manualTarget, setManualTarget] = useState("");

  const visitQuery = useQuery({
    queryKey: ["visits", "detail", id],
    queryFn: () => getVisitDetails(id),
    enabled: Number.isFinite(id),
  });
  const historyQuery = useQuery({
    queryKey: ["vital-signs", "visit", id],
    queryFn: () => getVisitVitalSigns(id),
    enabled: Number.isFinite(id),
  });
  const sdpQuery = useQuery({
    queryKey: ["service-delivery-points", "active", "triage"],
    queryFn: () => getServiceDeliveryPoints({ limit: 200 }),
    enabled: routePopup.open,
  });

  const visit = visitQuery.data ?? null;
  const history: VitalSign[] = useMemo(
    () =>
      [...(historyQuery.data?.items ?? [])].sort(
        (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
      ),
    [historyQuery.data],
  );

  // Most recent reading in this visit — offered as "carry forward" for the
  // anthropometrics so the nurse only re-enters what changed.
  const latest = history[0];
  const canCarryForward = !!latest && (latest.weight_kg != null || latest.height_cm != null);
  const carryForward = () =>
    setForm((f) => ({
      ...f,
      weight_kg: latest?.weight_kg != null ? String(latest.weight_kg) : f.weight_kg,
      height_cm: latest?.height_cm != null ? String(latest.height_cm) : f.height_cm,
    }));

  // ---------- Derived clinical indices ----------
  const weight = num(form.weight_kg);
  const height = num(form.height_cm);
  const bmi = computeBmi(weight, height);
  const bmiCat = bmiCategory(bmi);
  const mews = computeMews({
    pulse_rate: num(form.pulse_rate),
    respiratory_rate: num(form.respiratory_rate),
    systolic_bp: num(form.systolic_bp),
    temperature_celsius: num(form.temperature_celsius),
  });
  const band = mewsBand(mews);
  const hasAnyValue = (Object.keys(EMPTY_FORM) as (keyof VitalsForm)[])
    .filter((k) => k !== "pain_score" && k !== "notes")
    .some((k) => form[k].trim() !== "");

  const set = (key: keyof VitalsForm) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof VitalsForm, string>> = {};
    const check = (spec: Pick<FieldSpec, "key" | "min" | "max">) => {
      const v = num(form[spec.key]);
      if (form[spec.key].trim() !== "" && v == null) next[spec.key] = "Enter a number.";
      else if (v != null && (v < spec.min || v > spec.max)) next[spec.key] = `Expected ${spec.min}–${spec.max}.`;
    };
    INDEX_FIELDS.forEach(check);
    check({ key: "systolic_bp", min: 40, max: 300 });
    check({ key: "diastolic_bp", min: 20, max: 200 });
    check({ key: "weight_kg", min: 0.5, max: 400 });
    check({ key: "height_cm", min: 30, max: 250 });
    const s = num(form.systolic_bp);
    const d = num(form.diastolic_bp);
    if (s != null && d != null && d >= s) next.diastolic_bp = "Diastolic must be below systolic.";
    if (!hasAnyValue) next.temperature_celsius = "Record at least one reading.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildPayload = async (): Promise<RecordVitalSignPayload> => {
    const staff = await getCurrentStaff().catch(() => null);
    return {
      visit_id: id,
      recorded_by_staff_id: staff?.id ?? null,
      temperature_celsius: num(form.temperature_celsius),
      pulse_rate: num(form.pulse_rate),
      respiratory_rate: num(form.respiratory_rate),
      oxygen_saturation: num(form.oxygen_saturation),
      systolic_bp: num(form.systolic_bp),
      diastolic_bp: num(form.diastolic_bp),
      weight_kg: weight,
      height_cm: height,
      pain_score: num(form.pain_score),
    };
  };

  // ---------- Mutations ----------
  const saveMutation = useMutation({
    mutationFn: async () => recordVitalSigns(await buildPayload()),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["vital-signs", "visit", id] });
      setForm((f) => ({ ...EMPTY_FORM, weight_kg: f.weight_kg, height_cm: f.height_cm }));
      const saved = res.vital_sign?.mews_score;
      toast.success("Vital signs saved", saved != null ? `MEWS ${saved} recorded on the encounter.` : undefined);
    },
    onError: (err) => toast.error("Could not save vital signs", apiErrorMessage(err)),
  });

  const saveAndRouteMutation = useMutation({
    mutationFn: async () => {
      await recordVitalSigns(await buildPayload());
      qc.invalidateQueries({ queryKey: ["vital-signs", "visit", id] });
      return advanceVisit(id, { action: "complete", notes: form.notes.trim() || "Triage completed." });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["visits"] });
      qc.invalidateQueries({ queryKey: ["queue"] });
      const nextSdp = (res.visit?.current_service_delivery_point?.name ?? "the next service point") as string;
      toast.success("Triage complete", `${patientDisplayName(visit?.patient)} routed to ${nextSdp}.`);
      navigate(routes.queues);
    },
    onError: (err: unknown) => {
      const msg = apiErrorMessage(err);
      // No pathway on this visit → let the nurse pick the destination manually.
      if (/no clinical flow steps|flow steps/i.test(msg)) {
        qc.invalidateQueries({ queryKey: ["vital-signs", "visit", id] });
        setRoutePopup({ open: true, reason: msg });
        return;
      }
      toast.error("Could not complete triage", msg);
    },
  });

  const manualRouteMutation = useMutation({
    mutationFn: () =>
      rerouteVisit(id, {
        service_delivery_point_id: Number(manualTarget),
        reason: form.notes.trim() || "Routed from triage",
        create_queue_ticket: true,
        mark_as_current: true,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["visits"] });
      qc.invalidateQueries({ queryKey: ["queue"] });
      toast.success("Patient routed", res.message);
      setRoutePopup({ open: false });
      navigate(routes.queues);
    },
    onError: (err) => toast.error("Could not route patient", apiErrorMessage(err)),
  });

  const busy = saveMutation.isPending || saveAndRouteMutation.isPending;
  const nextStep = nextPathwayStep(visit);

  // ---------- History grid ----------
  const historyColumns: DxGridColumn<VitalSign>[] = [
    { key: "recorded_at", header: "Recorded", width: 150, render: (r) => <span className="dx-mono">{formatDateTime(r.recorded_at)}</span>, sortable: true },
    { key: "bp", header: "BP", align: "center", render: (r) => (r.systolic_bp != null ? <span className="dx-mono">{r.systolic_bp}/{r.diastolic_bp ?? "—"}</span> : "—") },
    { key: "temperature_celsius", header: "Temp", align: "center", render: (r) => (r.temperature_celsius != null ? <span className="dx-mono">{Number(r.temperature_celsius).toFixed(1)}°</span> : "—") },
    { key: "pulse_rate", header: "Pulse", align: "center", render: (r) => r.pulse_rate ?? "—" },
    { key: "respiratory_rate", header: "RR", align: "center", render: (r) => r.respiratory_rate ?? "—" },
    { key: "oxygen_saturation", header: "SpO₂", align: "center", render: (r) => (r.oxygen_saturation != null ? `${Number(r.oxygen_saturation)}%` : "—") },
    { key: "bmi", header: "BMI", align: "center", render: (r) => (r.bmi != null ? Number(r.bmi).toFixed(1) : "—") },
    {
      key: "mews_score",
      header: "MEWS",
      align: "center",
      render: (r) =>
        r.mews_score != null ? <DxBadge tone={mewsBand(r.mews_score).tone}>{r.mews_score}</DxBadge> : <span className="dx-faint">—</span>,
    },
  ];

  // ---------- Render ----------
  if (!Number.isFinite(id)) {
    const invalid = (
      <DxMessage tone="danger" title="Invalid visit">
        The triage workstation needs a visit identifier. Open a patient from the queue.
      </DxMessage>
    );
    return embedded ? <div className="space-y-4">{invalid}</div> : <DxPage>{invalid}</DxPage>;
  }
  if (visitQuery.isLoading)
    return embedded ? (
      <div className="space-y-4">
        <DxSkeleton className="h-8 w-48" />
        <DxSkeleton className="h-64 w-full" />
      </div>
    ) : (
      <DxPageLoading label="Loading encounter…" />
    );
  if (visitQuery.isError || !visit) {
    const loadError = (
      <DxMessage
        tone="danger"
        title="Could not load the visit"
        action={
          <DxButton size="sm" onClick={() => visitQuery.refetch()} leftIcon={<RotateCcw />}>
            Retry
          </DxButton>
        }
      >
        {apiErrorMessage(visitQuery.error, "Please verify the visit and try again.")}
      </DxMessage>
    );
    return embedded ? <div className="space-y-4">{loadError}</div> : <DxPage>{loadError}</DxPage>;
  }

  const renderIndexField = (spec: FieldSpec) => {
    const value = num(form[spec.key]);
    const flag = vitalFlag(spec.key, value);
    return (
      <DxInput
        key={spec.key}
        label={
          <span className="inline-flex items-center gap-1.5">
            <spec.icon className="h-3.5 w-3.5 text-[var(--dx-text-faint)]" aria-hidden />
            {spec.label}
            {flag ? (
              <DxBadge tone={flag === "high" ? "danger" : "warning"} className="ml-1">
                {flag}
              </DxBadge>
            ) : null}
          </span>
        }
        type="number"
        inputMode="decimal"
        step={spec.step}
        min={spec.min}
        max={spec.max}
        placeholder={spec.placeholder}
        unit={spec.unit}
        editorSize="lg"
        mono
        value={form[spec.key]}
        onChange={set(spec.key)}
        error={errors[spec.key]}
        disabled={busy}
      />
    );
  };

  const Wrapper = embedded ? "div" : DxPage;

  return (
    <Wrapper className={embedded ? "space-y-4" : undefined}>
      {!embedded && (
        <DxPageHeader
          crumbs={[{ label: "Queues", to: routes.queues }, { label: "Triage" }]}
          title="Triage — vital signs"
          subtitle="Record the physiological index; BMI and MEWS are derived automatically and attached to the encounter."
          actions={
            <DxButton leftIcon={<ArrowLeft />} onClick={() => navigate(routes.queues)}>
              Back to queue
            </DxButton>
          }
        />
      )}

      {!embedded && <VisitBanner visit={visit} />}

      {/* Command bar */}
      <DxToolbar>
        <DxToolbarGroup>
          <DxButton
            variant="text"
            leftIcon={<Eraser />}
            disabled={busy || !hasAnyValue}
            onClick={() => {
              setForm(EMPTY_FORM);
              setErrors({});
            }}
          >
            Clear
          </DxButton>
        </DxToolbarGroup>
        <DxToolbarSpacer />
        <DxToolbarGroup>
          <DxButton
            leftIcon={<Save />}
            isLoading={saveMutation.isPending}
            disabled={busy}
            onClick={() => validate() && saveMutation.mutate()}
          >
            Save vitals
          </DxButton>
          {!embedded && (
            <DxButton
              variant="primary"
              rightIcon={<ArrowRight />}
              isLoading={saveAndRouteMutation.isPending}
              disabled={busy}
              onClick={() => validate() && saveAndRouteMutation.mutate()}
              title={nextStep ? `Completes triage and queues the patient at ${nextStep.service_delivery_point?.name}` : "Completes triage and routes the patient onward"}
            >
              {nextStep ? `Complete & Route to ${nextStep.service_delivery_point?.name ?? "next step"}` : "Complete & Route"}
            </DxButton>
          )}
        </DxToolbarGroup>
      </DxToolbar>

      <div className="grid gap-4 xl:grid-cols-12">
        {/* ---------- Capture form ---------- */}
        <div className="space-y-4 xl:col-span-8">
          <DxPanel title="Vital signs" icon={<Activity />} description="Adult reference ranges are flagged inline.">
            <div className="space-y-5">
              <DxGroupBox caption="Blood pressure">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
                  <DxInput
                    label={
                      <span className="inline-flex items-center gap-1.5">
                        Systolic
                        {vitalFlag("systolic_bp", num(form.systolic_bp)) ? (
                          <DxBadge tone={vitalFlag("systolic_bp", num(form.systolic_bp)) === "high" ? "danger" : "warning"}>
                            {vitalFlag("systolic_bp", num(form.systolic_bp))}
                          </DxBadge>
                        ) : null}
                      </span>
                    }
                    type="number"
                    inputMode="numeric"
                    placeholder="120"
                    unit="mmHg"
                    editorSize="lg"
                    mono
                    value={form.systolic_bp}
                    onChange={set("systolic_bp")}
                    error={errors.systolic_bp}
                    disabled={busy}
                  />
                  <span className="hidden pb-2 text-2xl font-light text-[var(--dx-text-faint)] sm:block">/</span>
                  <DxInput
                    label={
                      <span className="inline-flex items-center gap-1.5">
                        Diastolic
                        {vitalFlag("diastolic_bp", num(form.diastolic_bp)) ? (
                          <DxBadge tone={vitalFlag("diastolic_bp", num(form.diastolic_bp)) === "high" ? "danger" : "warning"}>
                            {vitalFlag("diastolic_bp", num(form.diastolic_bp))}
                          </DxBadge>
                        ) : null}
                      </span>
                    }
                    type="number"
                    inputMode="numeric"
                    placeholder="80"
                    unit="mmHg"
                    editorSize="lg"
                    mono
                    value={form.diastolic_bp}
                    onChange={set("diastolic_bp")}
                    error={errors.diastolic_bp}
                    disabled={busy}
                  />
                </div>
              </DxGroupBox>

              <DxGroupBox caption="Physiological index">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{INDEX_FIELDS.map(renderIndexField)}</div>
              </DxGroupBox>

              <DxGroupBox caption="Anthropometry & pain">
                {canCarryForward ? (
                  <div className="mb-2 flex justify-end">
                    <DxButton size="sm" variant="accent-text" onClick={carryForward} disabled={busy}>
                      Carry forward last weight/height
                    </DxButton>
                  </div>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <DxInput
                    label="Weight"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    placeholder="70.0"
                    unit="kg"
                    editorSize="lg"
                    mono
                    value={form.weight_kg}
                    onChange={set("weight_kg")}
                    error={errors.weight_kg}
                    disabled={busy}
                  />
                  <DxInput
                    label="Height"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    placeholder="170"
                    unit="cm"
                    editorSize="lg"
                    mono
                    value={form.height_cm}
                    onChange={set("height_cm")}
                    error={errors.height_cm}
                    disabled={busy}
                  />
                  <DxField label="BMI" hint={bmiCat.label}>
                    <input className="dx-editor dx-editor-lg dx-mono" readOnly value={bmi != null ? bmi.toFixed(1) : ""} placeholder="—" aria-label="Body mass index" />
                  </DxField>
                  <DxSelect label="Pain score (0–10)" options={PAIN_OPTIONS} value={form.pain_score} onChange={set("pain_score")} disabled={busy} />
                </div>
              </DxGroupBox>

              <DxTextarea
                label="Triage note (optional)"
                hint="Added to the pathway step when the patient is routed onward."
                placeholder="e.g. Known hypertensive, on amlodipine. Reports headache since morning."
                rows={2}
                value={form.notes}
                onChange={set("notes")}
                disabled={busy}
              />
            </div>
          </DxPanel>
        </div>

        {/* ---------- Derived indices + history ---------- */}
        <div className="space-y-4 xl:col-span-4">
          <DxPanel title="Early warning score" icon={<Scale />}>
            <div className="flex items-start gap-4">
              <div
                className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded border text-center"
                style={{
                  borderColor: `var(--dx-${band.tone === "neutral" ? "border-strong" : band.tone})`,
                  background: `var(--dx-${band.tone === "neutral" ? "surface-alt" : `${band.tone}-soft`})`,
                  color: `var(--dx-${band.tone === "neutral" ? "text-muted" : band.tone})`,
                }}
              >
                <span className="text-2xl font-semibold leading-none dx-num">{mews ?? "–"}</span>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide">MEWS</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <DxBadge tone={band.tone}>{band.label}</DxBadge>
                  <span className="dx-faint text-[11px]">live preview</span>
                </div>
                <p className="mt-1.5 text-[12px] text-[var(--dx-text-muted)]">{band.advice}</p>
              </div>
            </div>
            <div className="mt-4">
              <DxProps
                tight
                items={[
                  { label: "BMI", value: bmi != null ? <span>{bmi.toFixed(1)} <DxBadge tone={bmiCat.tone} className="ml-1">{bmiCat.label}</DxBadge></span> : "—" },
                  { label: "Weight / Height", value: weight != null || height != null ? `${weight ?? "—"} kg · ${height ?? "—"} cm` : "—" },
                  { label: "Pain", value: PAIN_OPTIONS.find((o) => o.value === form.pain_score)?.label ?? "—" },
                  { label: "Next checkpoint", value: nextStep?.service_delivery_point?.name ?? <span className="dx-faint">No pathway — choose on route</span> },
                ]}
              />
            </div>
          </DxPanel>

          <DxPanel
            title="Previous readings"
            icon={<History />}
            description={history.length ? `${history.length} in this visit` : undefined}
            flush
            actions={
              <DxButton size="sm" variant="text" icon title="Refresh" onClick={() => historyQuery.refetch()}>
                <RotateCcw className={historyQuery.isFetching ? "animate-spin" : undefined} />
              </DxButton>
            }
          >
            <DxGrid
              columns={historyColumns}
              data={history}
              rowKey={(r) => r.id}
              isLoading={historyQuery.isLoading}
              error={historyQuery.isError ? apiErrorMessage(historyQuery.error, "Could not load readings.") : null}
              onRetry={() => historyQuery.refetch()}
              borderless
              striped
              maxHeight={320}
              empty={{ title: "No readings yet", description: "The first set of vitals for this visit will appear here." }}
            />
          </DxPanel>
        </div>
      </div>

      <DxStatusBar>
        <DxStatusItem>
          Visit <b className="dx-mono">{visit.visit_code}</b>
        </DxStatusItem>
        <DxStatusItem>
          Readings this visit: <b>{history.length}</b>
        </DxStatusItem>
        {history[0]?.mews_score != null ? (
          <DxStatusItem>
            Last MEWS: <b>{history[0].mews_score}</b>
          </DxStatusItem>
        ) : null}
        <span className="ml-auto">MEWS ≥ 5 raises an emergency alert on save.</span>
      </DxStatusBar>

      {/* Manual routing fallback when the visit has no pathway */}
      {!embedded && (
      <DxPopup
        isOpen={routePopup.open}
        onClose={() => !manualRouteMutation.isPending && setRoutePopup({ open: false })}
        title="Route the patient"
        size="sm"
        locked={manualRouteMutation.isPending}
        footer={
          <>
            <DxButton onClick={() => setRoutePopup({ open: false })} disabled={manualRouteMutation.isPending}>
              Later
            </DxButton>
            <DxButton
              variant="primary"
              disabled={!manualTarget}
              isLoading={manualRouteMutation.isPending}
              onClick={() => manualRouteMutation.mutate()}
              rightIcon={<ArrowRight />}
            >
              Route patient
            </DxButton>
          </>
        }
      >
        <div className="space-y-3">
          <DxMessage tone="info">
            Vitals were saved. {routePopup.reason ? "This visit has no care pathway, so" : "Now"} choose where the patient goes next.
          </DxMessage>
          <DxSelect
            label="Next service point"
            required
            placeholder="Select a service point…"
            value={manualTarget}
            onChange={(e) => setManualTarget(e.target.value)}
            options={(sdpQuery.data ?? [])
              .filter((s: ServiceDeliveryPoint) => s.id !== visit.current_service_delivery_point_id)
              .map((s: ServiceDeliveryPoint) => ({ value: String(s.id), label: `${s.name} (${s.code})` }))}
          />
        </div>
      </DxPopup>
      )}
    </Wrapper>
  );
}
