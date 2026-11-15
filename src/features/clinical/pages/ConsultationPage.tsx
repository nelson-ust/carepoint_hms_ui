import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Ban,
  FileText,
  History,
  LayoutTemplate,
  LogOut,
  Plus,
  RotateCcw,
  Save,
  Stethoscope,
} from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxCheckbox,
  DxConfirm,
  DxGrid,
  DxGroupBox,
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
  DxTextarea,
  DxToolbar,
  DxToolbarGroup,
  DxToolbarSeparator,
  DxToolbarSpacer,
  apiErrorMessage,
  formatDateTime,
  humanize,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { routes } from "@/config/routes";
import { getVisitDetails, type PaginatedResponse, type ServiceDeliveryPoint } from "@/features/visits/api/visits.api";
import { listActiveServiceDeliveryPoints } from "@/features/service-delivery-points/api/service-delivery-points.api";
import { getStaff, staffDisplayName, type Staff } from "@/features/staff/api/staff.api";
import {
  cancelConsultation,
  createConsultation,
  finalizeConsultation,
  isFinalConsultationStatus,
  listConsultationsForVisit,
  updateConsultation,
  type Consultation,
  type FinalizeConsultationPayload,
} from "@/features/consultations/api/consultations.api";
import { VisitBanner } from "@/features/visits/components/VisitBanner";
import { nextPathwayStep, patientDisplayName } from "@/features/visits/lib/clinic-flow";
import { DiagnosesPanel } from "@/features/diagnoses/components/DiagnosesPanel";
import { PrescriptionsPanel } from "@/features/prescriptions/components/PrescriptionsPanel";
import { clinicalTemplatesApi, type ClinicalTemplate } from "../api/clinical-templates.api";
import { getLatestVitalSigns, mewsBand, type VitalSign } from "../api/vital-signs.api";
import { ConsultationLabPanel } from "../components/ConsultationLabPanel";
import { Patient360Panel } from "../components/Patient360Panel";
import {
  SOAP_LABELS,
  applyTemplateMapping,
  mapTemplateToSoap,
  overwriteTemplateConflicts,
  readStoredUserId,
  soapFromConsultation,
  soapIsEqual,
  sortConsultations,
  type SoapForm,
  type SoapTextKey,
  type TemplateMapping,
} from "../lib/consultation-soap";

// ============================================================
// Local types
// ============================================================

type StartForm = {
  clinician_staff_id: number | null;
  subjective_note: string;
  objective_note: string;
  assessment_note: string;
  plan_note: string;
};

const EMPTY_START: StartForm = {
  clinician_staff_id: null,
  subjective_note: "",
  objective_note: "",
  assessment_note: "",
  plan_note: "",
};

type FinalizeForm = {
  next_service_delivery_point_id: number | null;
  end_visit: boolean;
  closing_note: string;
};

type Draft = { forId: number; form: SoapForm };

type ConfirmState =
  | { kind: "switch"; id: number }
  | { kind: "cancel" }
  | { kind: "overwrite"; template: ClinicalTemplate; mapping: TemplateMapping; conflicts: SoapTextKey[] };

const SOAP_HINTS: Record<SoapTextKey, string> = {
  subjective_note: "Patient's description of the complaint, history, symptoms",
  objective_note: "Physical exam findings, vitals, observations",
  assessment_note: "Clinical impression, working diagnosis, differentials",
  plan_note: "Investigations, prescriptions, follow-up, patient education",
};

const fmtNum = (v: number | string | null | undefined, digits = 0): string | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : null;
};

// ============================================================
// Page
// ============================================================

/**
 * Consultation workstation. The clinician opens (or resumes) a consultation on
 * the visit, documents it as a SOAP note, records diagnoses / investigations /
 * prescriptions in context, then "Save & Route" finalises the encounter and
 * moves the patient to the next checkpoint on their care pathway.
 */
export function ConsultationPage(props: { visitId?: number; embedded?: boolean } = {}) {
  const embedded = props.embedded ?? false;
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { visitId: visitIdParam } = useParams<{ visitId: string }>();
  const id = props.visitId ?? Number(visitIdParam);
  const validId = Number.isFinite(id);

  // ---------- UI state ----------
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [startPopup, setStartPopup] = useState<"auto" | "open" | "closed">("auto");
  const [startForm, setStartForm] = useState<StartForm>(EMPTY_START);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalizeForm, setFinalizeForm] = useState<FinalizeForm>({ next_service_delivery_point_id: null, end_visit: false, closing_note: "" });
  const [templateOpen, setTemplateOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  // ---------- Data ----------
  const consultationsKey = ["consultations", "visit", id] as const;
  const visitQuery = useQuery({
    queryKey: ["visits", "detail", id],
    queryFn: () => getVisitDetails(id),
    enabled: validId,
  });
  const consultationsQuery = useQuery({
    queryKey: consultationsKey,
    queryFn: () => listConsultationsForVisit(id),
    enabled: validId,
  });
  const vitalsQuery = useQuery({
    queryKey: ["vital-signs", "visit", id, "latest"],
    queryFn: () => getLatestVitalSigns(id).catch(() => null),
    enabled: validId,
  });
  const staffQuery = useQuery({
    queryKey: ["staff", "all", 200],
    queryFn: () => getStaff(0, 200).catch(() => [] as Staff[]),
  });
  const sdpQuery = useQuery({
    queryKey: ["service-delivery-points", "active", 200],
    queryFn: () => listActiveServiceDeliveryPoints({ skip: 0, limit: 200 }).catch(() => null),
  });
  const templatesQuery = useQuery({
    queryKey: ["clinical-templates", "for-consultation"],
    queryFn: async () => {
      const soap = await clinicalTemplatesApi.list({ template_type: "SOAP" });
      return soap.length ? soap : clinicalTemplatesApi.list();
    },
    enabled: templateOpen,
  });

  const visit = visitQuery.data ?? null;
  const latestVital: VitalSign | null = vitalsQuery.data ?? null;
  const staffList: Staff[] = useMemo(() => (Array.isArray(staffQuery.data) ? staffQuery.data : []), [staffQuery.data]);
  const sdps: ServiceDeliveryPoint[] = useMemo(() => sdpQuery.data?.items ?? [], [sdpQuery.data]);
  const consultations = useMemo(() => sortConsultations(consultationsQuery.data?.items ?? []), [consultationsQuery.data]);

  // ---------- Derived selection / form ----------
  const defaultActive = consultations.find((c) => !isFinalConsultationStatus(c.status)) ?? consultations[0] ?? null;
  const activeConsultation: Consultation | null =
    (selectedId != null ? consultations.find((c) => c.id === selectedId) : null) ?? defaultActive;
  const activeId = activeConsultation?.id ?? null;
  const baseSoap = useMemo(() => soapFromConsultation(activeConsultation), [activeConsultation]);
  const soap: SoapForm = draft && draft.forId === activeId ? draft.form : baseSoap;
  const isDirty = !!draft && draft.forId === activeId && !soapIsEqual(draft.form, baseSoap);
  const isReadOnly = !activeConsultation || isFinalConsultationStatus(activeConsultation.status);

  const storedUserId = readStoredUserId();
  const defaultClinicianId = staffList.find((s) => s.user_id === storedUserId)?.id ?? null;
  const effectiveClinicianId = startForm.clinician_staff_id ?? defaultClinicianId;

  const isStartOpen =
    startPopup === "open" ||
    (startPopup === "auto" && !consultationsQuery.isLoading && !!visit && consultations.length === 0 && effectiveClinicianId != null);

  const currentSdp = visit?.current_service_delivery_point ?? visit?.first_service_delivery_point;
  const nextStep = nextPathwayStep(visit);
  const clinicianOf = (c: Consultation | null) => {
    if (!c) return null;
    const s = staffList.find((x) => x.id === c.clinician_staff_id);
    return s ? staffDisplayName(s) : `Clinician #${c.clinician_staff_id}`;
  };

  const updateSoap = (patch: Partial<SoapForm>) => {
    if (activeId == null || isReadOnly) return;
    setDraft({ forId: activeId, form: { ...soap, ...patch } });
  };

  const replaceInCache = (updated: Consultation) => {
    qc.setQueryData<PaginatedResponse<Consultation>>(consultationsKey, (old) => {
      const items = (old?.items ?? []).filter((c) => c.id !== updated.id);
      return {
        success: old?.success ?? true,
        message: old?.message ?? "",
        count: (old?.count ?? items.length) + (old?.items?.some((c) => c.id === updated.id) ? 0 : 1),
        meta: old?.meta ?? ({} as PaginatedResponse<Consultation>["meta"]),
        items: [updated, ...items],
      };
    });
  };

  // ---------- Mutations ----------
  const saveMutation = useMutation({
    mutationFn: () => updateConsultation(activeId as number, soap),
    onSuccess: (res) => {
      replaceInCache(res.consultation);
      setDraft(null);
      toast.success("Notes saved", res.message || "Consultation notes saved.");
    },
    onError: (err) => toast.error("Could not save notes", apiErrorMessage(err)),
  });

  const startMutation = useMutation({
    mutationFn: () =>
      createConsultation({
        visit_id: id,
        clinician_staff_id: effectiveClinicianId as number,
        subjective_note: startForm.subjective_note || undefined,
        objective_note: startForm.objective_note || undefined,
        assessment_note: startForm.assessment_note || undefined,
        plan_note: startForm.plan_note || undefined,
      }),
    onSuccess: (res) => {
      replaceInCache(res.consultation);
      setSelectedId(res.consultation.id);
      setDraft(null);
      setStartPopup("closed");
      setStartForm({ ...EMPTY_START, clinician_staff_id: effectiveClinicianId });
      toast.success("Consultation started", res.message || undefined);
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const cid = activeId as number;
      if (isDirty) {
        const saved = await updateConsultation(cid, soap);
        replaceInCache(saved.consultation);
      }
      const payload: FinalizeConsultationPayload = {
        next_service_delivery_point_id: finalizeForm.end_visit ? undefined : finalizeForm.next_service_delivery_point_id ?? undefined,
        end_visit: finalizeForm.end_visit,
        closing_note: finalizeForm.closing_note.trim() || undefined,
      };
      return finalizeConsultation(cid, payload);
    },
    onSuccess: (res) => {
      replaceInCache(res.consultation);
      setDraft(null);
      setFinalizeOpen(false);
      qc.invalidateQueries({ queryKey: ["visits"] });
      qc.invalidateQueries({ queryKey: ["queue"] });
      const target = finalizeForm.end_visit
        ? "visit ended"
        : sdps.find((s) => s.id === finalizeForm.next_service_delivery_point_id)?.name ?? null;
      toast.success(
        "Consultation finalized",
        res.message || (target ? `${patientDisplayName(visit?.patient)} — ${target}.` : undefined),
      );
      if (!embedded && finalizeForm.end_visit) window.setTimeout(() => navigate(routes.visits), 800);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelConsultation(activeId as number),
    onSuccess: (res) => {
      replaceInCache(res.consultation);
      setDraft(null);
      toast.success("Consultation cancelled", res.message || undefined);
    },
    onError: (err) => toast.error("Could not cancel consultation", apiErrorMessage(err)),
  });

  const busy = saveMutation.isPending || finalizeMutation.isPending || cancelMutation.isPending;

  // ---------- Handlers ----------
  const openStart = () => {
    startMutation.reset();
    setStartPopup("open");
  };

  const selectConsultation = (cid: number) => {
    if (cid === activeId) return;
    if (isDirty) {
      setConfirm({ kind: "switch", id: cid });
      return;
    }
    setSelectedId(cid);
    setDraft(null);
  };

  const openFinalize = (endVisit: boolean) => {
    if (isReadOnly) return;
    finalizeMutation.reset();
    setFinalizeForm({
      next_service_delivery_point_id: endVisit ? null : nextStep?.service_delivery_point_id ?? null,
      end_visit: endVisit,
      closing_note: "",
    });
    setFinalizeOpen(true);
  };

  const applyTemplate = (t: ClinicalTemplate) => {
    if (activeId == null || isReadOnly) return;
    const mapping = mapTemplateToSoap(t);
    const { next, conflicts } = applyTemplateMapping(soap, mapping);
    setDraft({ forId: activeId, form: next });
    setTemplateOpen(false);
    clinicalTemplatesApi.recordUse(t.id).catch(() => undefined);
    if (conflicts.length) {
      setConfirm({ kind: "overwrite", template: t, mapping, conflicts });
    } else {
      toast.success("Template applied", `${t.name} — review the note before saving.`);
    }
  };

  const refreshAll = () => {
    visitQuery.refetch();
    consultationsQuery.refetch();
    vitalsQuery.refetch();
  };

  // ---------- Grid columns ----------
  const consultationColumns: DxGridColumn<Consultation>[] = [
    {
      key: "started",
      header: "Started",
      width: 130,
      sortable: true,
      accessor: (c) => c.consultation_started_at || c.created_at,
      render: (c) => <span className="dx-mono">{formatDateTime(c.consultation_started_at || c.created_at)}</span>,
    },
    {
      key: "clinician",
      header: "Clinician",
      accessor: (c) => clinicianOf(c),
      render: (c) => <span className="truncate">{clinicianOf(c)}</span>,
    },
    { key: "status", header: "Status", width: 110, render: (c) => <DxStatusBadge status={c.status} /> },
  ];

  const templateColumns: DxGridColumn<ClinicalTemplate>[] = [
    {
      key: "name",
      header: "Template",
      sortable: true,
      filter: true,
      wrap: true,
      render: (t) => (
        <div className="min-w-0">
          <div className="font-medium">{t.name}</div>
          {t.description ? <div className="dx-muted truncate text-[11.5px]">{t.description}</div> : null}
        </div>
      ),
    },
    { key: "specialty", header: "Specialty", width: 140, sortable: true, filter: true, render: (t) => t.specialty || <span className="dx-faint">General</span> },
    { key: "template_type", header: "Type", width: 100, render: (t) => <DxBadge tone="outline">{humanize(t.template_type)}</DxBadge> },
    { key: "sections_count", header: "Sections", width: 80, align: "center", sortable: true, accessor: (t) => t.sections_count ?? t.sections?.length ?? 0, render: (t) => t.sections_count ?? t.sections?.length ?? 0 },
    { key: "usage_count", header: "Usage", width: 70, align: "center", sortable: true },
    {
      key: "apply",
      header: "",
      width: 80,
      align: "right",
      render: (t) => (
        <DxButton size="sm" variant="accent-text" onClick={(e) => { e.stopPropagation(); applyTemplate(t); }}>
          Apply
        </DxButton>
      ),
    },
  ];

  // ---------- Render guards ----------
  if (!validId) {
    const invalid = (
      <DxMessage tone="danger" title="Invalid visit">
        The consultation workstation needs a visit identifier. Open a patient from the queue.
      </DxMessage>
    );
    return embedded ? <div className="space-y-4">{invalid}</div> : <DxPage>{invalid}</DxPage>;
  }
  if (visitQuery.isLoading)
    return embedded ? (
      <div className="space-y-4">
        <div className="dx-skeleton h-24 w-full" />
        <div className="dx-skeleton h-64 w-full" />
      </div>
    ) : (
      <DxPageLoading label="Preparing consultation workspace…" />
    );
  if (visitQuery.isError || !visit) {
    const errored = (
      <DxMessage
        tone="danger"
        title="Could not load the visit"
        action={
          <DxButton size="sm" onClick={() => visitQuery.refetch()} leftIcon={<RotateCcw />}>
            Retry
          </DxButton>
        }
      >
        {apiErrorMessage(visitQuery.error, "The record may have been removed or the registry is offline.")}
      </DxMessage>
    );
    return embedded ? <div className="space-y-4">{errored}</div> : <DxPage>{errored}</DxPage>;
  }

  const mews = latestVital?.mews_score ?? null;
  const band = mewsBand(mews);
  const vitalsItems = latestVital
    ? [
        { label: "Blood pressure", value: latestVital.systolic_bp != null ? <span className="dx-mono">{latestVital.systolic_bp}/{latestVital.diastolic_bp ?? "—"} mmHg</span> : "—" },
        { label: "Temperature", value: fmtNum(latestVital.temperature_celsius, 1) ? `${fmtNum(latestVital.temperature_celsius, 1)} °C` : "—" },
        { label: "Pulse", value: latestVital.pulse_rate != null ? `${latestVital.pulse_rate} bpm` : "—" },
        { label: "Respiratory rate", value: latestVital.respiratory_rate != null ? `${latestVital.respiratory_rate} cpm` : "—" },
        { label: "SpO₂", value: fmtNum(latestVital.oxygen_saturation) ? `${fmtNum(latestVital.oxygen_saturation)} %` : "—" },
        { label: "Weight / Height", value: latestVital.weight_kg != null || latestVital.height_cm != null ? `${fmtNum(latestVital.weight_kg, 1) ?? "—"} kg · ${fmtNum(latestVital.height_cm) ?? "—"} cm` : "—" },
        { label: "BMI", value: fmtNum(latestVital.bmi, 1) ?? "—" },
        { label: "Pain score", value: latestVital.pain_score != null ? `${latestVital.pain_score}/10` : "—" },
        { label: "MEWS", value: mews != null ? <span className="inline-flex items-center gap-2"><DxBadge tone={band.tone}>{mews}</DxBadge><span className="dx-muted">{band.label}</span></span> : "—" },
        { label: "Recorded", value: <span className="dx-mono">{formatDateTime(latestVital.recorded_at)}</span> },
      ]
    : [];

  const sdpOptions = (() => {
    const list = sdps.filter((s) => s.id !== currentSdp?.id);
    const nextSdp = nextStep?.service_delivery_point;
    if (nextSdp && !list.some((s) => s.id === nextSdp.id) && nextSdp.id !== currentSdp?.id) list.unshift(nextSdp);
    return list.map((s) => ({ value: String(s.id), label: `${s.name} (${s.code})` }));
  })();

  const consultationStatus = activeConsultation?.status ?? null;

  const content = (
    <>
      {!embedded && (
        <DxPageHeader
          crumbs={[{ label: "Queues", to: routes.queues }, { label: "Consultation" }]}
          title="Consultation"
          subtitle="Document the encounter as a SOAP note, record diagnoses, investigations and prescriptions, then save and route the patient onward."
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
          <DxButton leftIcon={<Plus />} onClick={openStart} disabled={busy}>
            Start consultation
          </DxButton>
          <DxButton
            leftIcon={<LayoutTemplate />}
            disabled={isReadOnly || busy}
            onClick={() => setTemplateOpen(true)}
            title={isReadOnly ? "Start or select an open consultation first" : "Fill the SOAP note from a clinical template"}
          >
            Apply template
          </DxButton>
        </DxToolbarGroup>
        <DxToolbarSeparator />
        <DxToolbarGroup>
          <DxButton
            leftIcon={<Save />}
            isLoading={saveMutation.isPending}
            disabled={isReadOnly || !isDirty || busy}
            onClick={() => saveMutation.mutate()}
          >
            Save draft
          </DxButton>
          {!embedded && (
            <>
              <DxButton
                variant="primary"
                rightIcon={<ArrowRight />}
                disabled={isReadOnly || busy}
                onClick={() => openFinalize(false)}
                title={nextStep ? `Finalises the consultation and queues the patient at ${nextStep.service_delivery_point?.name}` : "Finalises the consultation and routes the patient onward"}
              >
                {nextStep?.service_delivery_point?.name ? `Save & Route to ${nextStep.service_delivery_point.name}` : "Save & Route"}
              </DxButton>
              <DxButton leftIcon={<LogOut />} disabled={isReadOnly || busy} onClick={() => openFinalize(true)}>
                End visit
              </DxButton>
            </>
          )}
        </DxToolbarGroup>
        <DxToolbarSpacer />
        <DxToolbarGroup>
          <DxButton
            variant="outline-danger"
            leftIcon={<Ban />}
            disabled={isReadOnly || busy}
            isLoading={cancelMutation.isPending}
            onClick={() => setConfirm({ kind: "cancel" })}
          >
            Cancel consultation
          </DxButton>
          <DxButton variant="text" icon title="Refresh" onClick={refreshAll}>
            <RotateCcw className={visitQuery.isFetching || consultationsQuery.isFetching ? "animate-spin" : undefined} />
          </DxButton>
        </DxToolbarGroup>
      </DxToolbar>

      <div className="grid gap-4 xl:grid-cols-12">
        {/* ---------- SOAP + clinical panels ---------- */}
        <div className="space-y-4 xl:col-span-8">
          <DxPanel
            title="SOAP note"
            icon={<FileText />}
            description={
              activeConsultation
                ? `Consultation #${activeConsultation.id} · started ${formatDateTime(activeConsultation.consultation_started_at || activeConsultation.created_at)}`
                : "No consultation is open on this visit yet."
            }
            actions={
              activeConsultation ? (
                <>
                  {isDirty ? <DxBadge tone="warning" dot>Unsaved changes</DxBadge> : null}
                  <DxStatusBadge status={activeConsultation.status} />
                </>
              ) : undefined
            }
          >
            {!activeConsultation ? (
              <DxMessage
                tone="info"
                title="No active consultation"
                action={
                  <DxButton size="sm" variant="primary" leftIcon={<Plus />} onClick={openStart}>
                    Start consultation
                  </DxButton>
                }
              >
                Start a consultation to begin documenting the encounter using the SOAP framework.
              </DxMessage>
            ) : (
              <div className="space-y-4">
                {isReadOnly ? (
                  <DxMessage tone={String(consultationStatus).toUpperCase() === "CANCELLED" ? "warning" : "success"}>
                    This consultation is {String(consultationStatus).toUpperCase() === "CANCELLED" ? "cancelled" : "finalized"} and is read-only.
                  </DxMessage>
                ) : null}

                {(Object.keys(SOAP_LABELS) as SoapTextKey[]).map((key) => (
                  <DxGroupBox key={key} caption={SOAP_LABELS[key]}>
                    <DxTextarea
                      aria-label={`${SOAP_LABELS[key]} note`}
                      hint={SOAP_HINTS[key]}
                      rows={key === "plan_note" ? 5 : 4}
                      placeholder={`${SOAP_LABELS[key]} note…`}
                      value={soap[key]}
                      disabled={isReadOnly || busy}
                      onChange={(e) => updateSoap({ [key]: e.target.value } as Partial<SoapForm>)}
                    />
                  </DxGroupBox>
                ))}

                {/* A patient can only be admitted on a doctor's recommendation
                    (recorded here) or on emergency. */}
                <DxGroupBox caption="Admission">
                  <DxCheckbox
                    label="Recommend inpatient admission"
                    description="Required before this patient can be admitted to a ward (emergencies excepted)."
                    checked={soap.recommends_admission}
                    disabled={isReadOnly || busy}
                    onChange={(e) => updateSoap({ recommends_admission: e.target.checked })}
                  />
                  {soap.recommends_admission ? (
                    <DxTextarea
                      className="mt-3"
                      aria-label="Reason for admission"
                      rows={2}
                      placeholder="Reason for admission (optional)"
                      value={soap.admission_recommendation_note}
                      disabled={isReadOnly || busy}
                      onChange={(e) => updateSoap({ admission_recommendation_note: e.target.value })}
                    />
                  ) : null}
                </DxGroupBox>
              </div>
            )}
          </DxPanel>

          {/* Always visible so history shows before a consultation is started;
              add/edit is gated by an active, non-finalized consultation. */}
          <DiagnosesPanel visitId={visit.id} consultationId={activeConsultation?.id ?? null} disabled={isReadOnly} />
          <ConsultationLabPanel visitId={visit.id} consultationId={activeConsultation?.id ?? null} disabled={isReadOnly} />
          <PrescriptionsPanel visitId={visit.id} consultationId={activeConsultation?.id ?? null} disabled={isReadOnly} />
        </div>

        {/* ---------- Context column ---------- */}
        <div className="space-y-4 xl:col-span-4">
          <DxPanel
            title="Latest vitals"
            icon={<Activity />}
            actions={
              <DxButton size="sm" variant="text" icon title="Refresh vitals" onClick={() => vitalsQuery.refetch()}>
                <RotateCcw className={vitalsQuery.isFetching ? "animate-spin" : undefined} />
              </DxButton>
            }
          >
            {vitalsQuery.isLoading ? (
              <div className="space-y-2">
                <div className="dx-skeleton h-3.5 w-3/4" />
                <div className="dx-skeleton h-3.5 w-1/2" />
                <div className="dx-skeleton h-3.5 w-2/3" />
              </div>
            ) : latestVital ? (
              <DxProps tight items={vitalsItems} />
            ) : (
              <DxMessage tone="info">No vital signs recorded for this visit yet.</DxMessage>
            )}
          </DxPanel>

          <DxPanel
            title="Consultations"
            icon={<History />}
            description={consultations.length ? `${consultations.length} on this visit` : undefined}
            flush
          >
            <DxGrid
              columns={consultationColumns}
              data={consultations}
              rowKey={(c) => c.id}
              isLoading={consultationsQuery.isLoading}
              error={consultationsQuery.isError ? apiErrorMessage(consultationsQuery.error, "Could not load consultations.") : null}
              onRetry={() => consultationsQuery.refetch()}
              onRowClick={(c) => selectConsultation(c.id)}
              selectedKey={activeId}
              borderless
              maxHeight={260}
              empty={{
                icon: Stethoscope,
                title: "No consultations yet",
                description: "Start the first consultation for this visit.",
                action: (
                  <DxButton size="sm" variant="primary" leftIcon={<Plus />} onClick={openStart}>
                    Start consultation
                  </DxButton>
                ),
              }}
            />
          </DxPanel>

          {visit.patient_id ? <Patient360Panel patientId={visit.patient_id} /> : null}
        </div>
      </div>

      <DxStatusBar>
        <DxStatusItem>
          Visit <b className="dx-mono">{visit.visit_code}</b>
        </DxStatusItem>
        {activeConsultation ? (
          <>
            <DxStatusItem>
              Consultation <b>#{activeConsultation.id}</b>
            </DxStatusItem>
            <DxStatusItem>
              Status <b>{humanize(activeConsultation.status)}</b>
            </DxStatusItem>
            <DxStatusItem>
              Clinician <b>{clinicianOf(activeConsultation)}</b>
            </DxStatusItem>
          </>
        ) : (
          <DxStatusItem>No active consultation</DxStatusItem>
        )}
        <span className="ml-auto">
          {isDirty ? <DxBadge tone="warning" dot>Unsaved changes</DxBadge> : activeConsultation && !isReadOnly ? <span className="dx-faint">All changes saved</span> : null}
        </span>
      </DxStatusBar>

      {/* ---------- Start consultation ---------- */}
      <DxPopup
        isOpen={isStartOpen}
        onClose={() => !startMutation.isPending && setStartPopup("closed")}
        title="Start consultation"
        size="md"
        locked={startMutation.isPending}
        footer={
          <>
            <DxButton onClick={() => setStartPopup("closed")} disabled={startMutation.isPending}>
              Cancel
            </DxButton>
            <DxButton
              variant="primary"
              leftIcon={<Stethoscope />}
              isLoading={startMutation.isPending}
              disabled={effectiveClinicianId == null}
              onClick={() => startMutation.mutate()}
            >
              Start consultation
            </DxButton>
          </>
        }
      >
        <div className="space-y-4">
          {startMutation.isError ? <DxMessage tone="danger">{apiErrorMessage(startMutation.error, "Failed to start consultation.")}</DxMessage> : null}
          <DxSelect
            label="Clinician"
            required
            placeholder="Select clinician…"
            value={effectiveClinicianId != null ? String(effectiveClinicianId) : ""}
            onChange={(e) => setStartForm((f) => ({ ...f, clinician_staff_id: e.target.value ? Number(e.target.value) : null }))}
            options={staffList.map((s) => ({
              value: String(s.id),
              label: `${staffDisplayName(s)}${s.designation ? ` · ${s.designation}` : ""}`,
            }))}
            error={effectiveClinicianId == null && startMutation.isError ? "Pick the clinician for this consultation." : undefined}
          />
          <DxGroupBox caption="Optional: pre-fill SOAP notes">
            <div className="space-y-3">
              {(Object.keys(SOAP_LABELS) as SoapTextKey[]).map((key) => (
                <DxTextarea
                  key={key}
                  label={SOAP_LABELS[key]}
                  rows={2}
                  value={startForm[key]}
                  onChange={(e) => setStartForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              ))}
            </div>
          </DxGroupBox>
        </div>
      </DxPopup>

      {/* ---------- Save & Route / End visit ---------- */}
      <DxPopup
        isOpen={!embedded && finalizeOpen && !!activeConsultation}
        onClose={() => !finalizeMutation.isPending && setFinalizeOpen(false)}
        title={finalizeForm.end_visit ? "End visit" : "Save & Route"}
        size="md"
        locked={finalizeMutation.isPending}
        footer={
          <>
            <DxButton onClick={() => setFinalizeOpen(false)} disabled={finalizeMutation.isPending}>
              Cancel
            </DxButton>
            <DxButton
              variant="primary"
              rightIcon={<ArrowRight />}
              isLoading={finalizeMutation.isPending}
              onClick={() => finalizeMutation.mutate()}
            >
              {finalizeForm.end_visit ? "Finalize & end visit" : "Finalize & route"}
            </DxButton>
          </>
        }
      >
        <div className="space-y-4">
          {finalizeMutation.isError ? <DxMessage tone="danger">{apiErrorMessage(finalizeMutation.error, "Failed to finalize consultation.")}</DxMessage> : null}
          {isDirty ? <DxMessage tone="info">Your unsaved notes will be saved before the consultation is finalized.</DxMessage> : null}
          <DxSelect
            label="Next service point"
            placeholder="No routing — keep at current service point"
            value={finalizeForm.next_service_delivery_point_id != null ? String(finalizeForm.next_service_delivery_point_id) : ""}
            onChange={(e) => setFinalizeForm((f) => ({ ...f, next_service_delivery_point_id: e.target.value ? Number(e.target.value) : null }))}
            disabled={finalizeForm.end_visit}
            options={sdpOptions}
            hint={
              nextStep?.service_delivery_point?.name
                ? `Care pathway: next step is ${nextStep.service_delivery_point.name}.`
                : "This visit has no remaining pathway steps — choose the destination manually."
            }
          />
          <DxCheckbox
            label="End visit instead"
            description="Mark the entire visit complete after finalizing; the patient is not routed anywhere."
            checked={finalizeForm.end_visit}
            onChange={(e) =>
              setFinalizeForm((f) => ({
                ...f,
                end_visit: e.target.checked,
                next_service_delivery_point_id: e.target.checked ? null : nextStep?.service_delivery_point_id ?? f.next_service_delivery_point_id,
              }))
            }
          />
          <DxTextarea
            label="Closing note"
            rows={3}
            placeholder="Summary, hand-off note, or instructions for the next care team…"
            value={finalizeForm.closing_note}
            onChange={(e) => setFinalizeForm((f) => ({ ...f, closing_note: e.target.value }))}
          />
        </div>
      </DxPopup>

      {/* ---------- Apply clinical template ---------- */}
      <DxPopup isOpen={templateOpen} onClose={() => setTemplateOpen(false)} title="Apply clinical template" size="lg"
        footer={<DxButton onClick={() => setTemplateOpen(false)}>Close</DxButton>}>
        <div className="space-y-3">
          <p className="dx-muted text-[12.5px]">
            Sections are matched to Subjective / Objective / Assessment / Plan by title; anything else is appended to Plan.
            Empty fields are filled straight away — you will be asked before any existing text is replaced.
          </p>
          <DxGrid
            columns={templateColumns}
            data={templatesQuery.data}
            rowKey={(t) => t.id}
            isLoading={templatesQuery.isLoading}
            error={templatesQuery.isError ? apiErrorMessage(templatesQuery.error, "Could not load templates.") : null}
            onRetry={() => templatesQuery.refetch()}
            onRowClick={applyTemplate}
            filterRow
            maxHeight={380}
            empty={{ icon: LayoutTemplate, title: "No templates", description: "Create SOAP templates under Clinical › Templates." }}
          />
        </div>
      </DxPopup>

      {/* ---------- Confirmations ---------- */}
      <DxConfirm
        isOpen={confirm?.kind === "switch"}
        onClose={() => setConfirm(null)}
        title="Discard unsaved changes?"
        description="The notes you typed on this consultation have not been saved. Switching will discard them."
        confirmLabel="Discard & switch"
        onConfirm={() => {
          if (confirm?.kind !== "switch") return;
          setSelectedId(confirm.id);
          setDraft(null);
        }}
      />
      <DxConfirm
        isOpen={confirm?.kind === "cancel"}
        onClose={() => setConfirm(null)}
        title={`Cancel consultation #${activeConsultation?.id ?? ""}?`}
        description="The consultation will be marked cancelled. This cannot be undone."
        confirmLabel="Cancel consultation"
        cancelLabel="Keep"
        onConfirm={() => cancelMutation.mutateAsync().then(() => undefined, () => undefined)}
      />
      <DxConfirm
        isOpen={confirm?.kind === "overwrite"}
        onClose={() => setConfirm(null)}
        tone="primary"
        title="Replace existing notes?"
        description={
          confirm?.kind === "overwrite" ? (
            <>
              Empty fields have been filled from <b className="dx-strong">{confirm.template.name}</b>. The following already contain text:{" "}
              <b className="dx-strong">{confirm.conflicts.map((k) => SOAP_LABELS[k]).join(", ")}</b>. Replace them with the template content?
            </>
          ) : null
        }
        confirmLabel="Replace"
        cancelLabel="Keep mine"
        onConfirm={() => {
          if (confirm?.kind !== "overwrite" || activeId == null) return;
          setDraft({ forId: activeId, form: overwriteTemplateConflicts(soap, confirm.mapping, confirm.conflicts) });
        }}
      />
    </>
  );

  return embedded ? <div className="space-y-4">{content}</div> : <DxPage>{content}</DxPage>;
}
