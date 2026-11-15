import { useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Flame,
  Footprints,
  GitBranch,
  RefreshCw,
  Stethoscope,
  User,
  X,
} from "lucide-react";
import {
  DxAvatar,
  DxBadge,
  DxButton,
  DxChoice,
  DxField,
  DxForm,
  DxGrid,
  DxGroupBox,
  DxMessage,
  DxPage,
  DxPageHeader,
  DxPanel,
  DxProps,
  DxSearchBox,
  DxSegmented,
  DxSelect,
  DxStatusBar,
  DxStatusItem,
  DxSteps,
  DxTextarea,
  ageFrom,
  apiErrorMessage,
  formatDate,
  formatTime,
  humanize,
  type DxGridColumn,
  type DxStepItem,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { routes } from "@/config/routes";
import { searchPatients, type Patient } from "@/features/patients/api/patients.api";
import { appointmentsApi, isAppointmentToday, type Appointment } from "@/features/appointments/api/appointments.api";
import { getServiceDeliveryPoints, getVisits, initiateVisit, type ServiceDeliveryPoint } from "../api/visits.api";
import { getVisitTemplates, type VisitTemplate } from "../api/visit-flows.api";
import { sdpTypeLabel } from "../lib/clinic-flow";

type Mode = "APPOINTMENT" | "WALK_IN";
type Priority = "ROUTINE" | "URGENT" | "EMERGENCY";

const PRIORITIES: { value: Priority; label: string; hint: string; tone: "success" | "warning" | "danger" }[] = [
  { value: "ROUTINE", label: "Routine", hint: "Normal queue order", tone: "success" },
  { value: "URGENT", label: "Urgent", hint: "Ahead of routine patients", tone: "warning" },
  { value: "EMERGENCY", label: "Emergency", hint: "Fast-tracked to the front", tone: "danger" },
];

/**
 * Visit Initiation — the front desk starts an encounter: pick up today's
 * appointment or start a walk-in, choose priority and the care pathway, and
 * raise the first queue ticket.
 */
export function VisitInitiationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const patientFromState = (location.state as { patient?: Patient } | null)?.patient;

  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(patientFromState ?? null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [selectedAppt, setSelectedAppt] = useState<number | null>(null);
  const [selectedSdp, setSelectedSdp] = useState<string>("");
  const [templateChoice, setTemplateChoice] = useState<number | null | "unset">("unset");
  const [priority, setPriority] = useState<Priority>("ROUTINE");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<ReactNode | null>(null);

  // ---------- Reference data ----------
  const sdpQuery = useQuery({
    queryKey: ["service-delivery-points", "active", "visit-initiation"],
    queryFn: () => getServiceDeliveryPoints({ limit: 200 }),
    staleTime: 5 * 60_000,
  });
  const templatesQuery = useQuery({
    queryKey: ["visit-flow-templates"],
    queryFn: () => getVisitTemplates(),
    staleTime: 5 * 60_000,
  });
  const sdps = useMemo(() => (sdpQuery.data ?? []).filter((s) => s.is_active !== false), [sdpQuery.data]);
  const templates: VisitTemplate[] = useMemo(() => templatesQuery.data?.items ?? [], [templatesQuery.data]);
  const defaultTemplate = useMemo(() => templates.find((t) => t.is_default) ?? templates[0] ?? null, [templates]);
  const selectedTemplateId: number | null = templateChoice === "unset" ? (defaultTemplate?.id ?? null) : templateChoice;
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  // Starting point: the pathway's first checkpoint if a template is chosen, else a registration desk.
  const defaultSdpId = useMemo(() => {
    const first = [...(selectedTemplate?.associated_visit_flow_templates_steps ?? [])].sort((a, b) => a.step_order - b.step_order)[0];
    if (first) return String(first.service_delivery_point_id);
    const reg = sdps.find((s) => String(s.service_point_type).toUpperCase().endsWith("REGISTRATION") && s.supports_walk_in !== false);
    return reg ? String(reg.id) : sdps[0] ? String(sdps[0].id) : "";
  }, [selectedTemplate, sdps]);
  const effectiveSdp = selectedSdp || defaultSdpId;

  // ---------- Patient search ----------
  const searchQuery = useQuery({
    queryKey: ["patients", "search", search],
    queryFn: () => searchPatients(search, 20),
    enabled: search.trim().length >= 2 && !selectedPatient,
  });
  const results: Patient[] = searchQuery.data?.items ?? [];

  // ---------- Per-patient context ----------
  const apptQuery = useQuery({
    queryKey: ["appointments", "today", selectedPatient?.id],
    queryFn: () => appointmentsApi.list({ patient_id: selectedPatient!.id, limit: 50 }),
    enabled: !!selectedPatient,
  });
  const activeVisitQuery = useQuery({
    queryKey: ["visits", "active", selectedPatient?.id],
    queryFn: () => getVisits({ patient_id: selectedPatient!.id, status: "ACTIVE" }),
    enabled: !!selectedPatient,
  });
  const todaysAppointments: Appointment[] = useMemo(
    () =>
      (apptQuery.data?.items ?? [])
        .filter((a) => isAppointmentToday(a) && (a.status === "SCHEDULED" || a.status === "ARRIVED"))
        .sort((a, b) => new Date(a.scheduled_start_at).getTime() - new Date(b.scheduled_start_at).getTime()),
    [apptQuery.data],
  );
  const activeVisit = activeVisitQuery.data?.items?.[0] ?? null;
  const loadingCtx = apptQuery.isLoading || activeVisitQuery.isLoading;

  const effectiveMode: Mode = mode ?? (todaysAppointments.length > 0 ? "APPOINTMENT" : "WALK_IN");
  const effectiveAppt = selectedAppt ?? todaysAppointments[0]?.id ?? null;
  const selectedAppointment = todaysAppointments.find((a) => a.id === effectiveAppt) ?? null;

  const pathwayPreview: DxStepItem[] = useMemo(
    () =>
      [...(selectedTemplate?.associated_visit_flow_templates_steps ?? [])]
        .sort((a, b) => a.step_order - b.step_order)
        .map((s, i) => ({
          key: s.id,
          label: s.service_delivery_point_name ?? s.service_delivery_point?.name ?? `Step ${s.step_order}`,
          sub: s.is_required === false ? "optional" : undefined,
          status: i === 0 ? "current" : "pending",
        })),
    [selectedTemplate],
  );

  const choosePatient = (p: Patient) => {
    setSelectedPatient(p);
    setMode(null);
    setSelectedAppt(null);
    setError(null);
  };
  const resetPatient = () => {
    setSelectedPatient(null);
    setSearch("");
    setMode(null);
    setSelectedAppt(null);
    setError(null);
  };

  // ---------- Submit ----------
  const initiate = useMutation({
    mutationFn: async () => {
      if (!selectedPatient) throw new Error("Select a patient first.");
      if (activeVisit) throw new Error("This patient already has an active visit.");
      if (effectiveMode === "APPOINTMENT" && effectiveAppt) {
        const res = await appointmentsApi.checkIn(effectiveAppt, {
          initiate_visit: true,
          use_appointment_service_point: true,
          visit_reason: reason.trim() || undefined,
          fast_track: priority === "EMERGENCY",
          visit_flow_template_id: selectedTemplateId ?? undefined,
        });
        return { visitId: res.visit_id ?? undefined, code: res.visit_code ?? undefined };
      }
      if (!effectiveSdp) throw new Error("Pick a starting service point.");
      const now = new Date().toISOString();
      const res = await initiateVisit({
        patient_id: selectedPatient.id,
        priority,
        first_service_delivery_point_id: Number(effectiveSdp),
        use_appointment_service_point: false,
        visit_date: now,
        check_in_time: now,
        create_first_flow_step: true,
        create_queue_ticket: true,
        first_step_status: "PENDING",
        first_queue_status: "WAITING",
        mark_visit_waiting: true,
        fast_track: priority === "EMERGENCY",
        queue_position: 1,
        visit_reason: reason.trim() || undefined,
        visit_flow_template_id: selectedTemplateId ?? undefined,
      });
      return { visitId: res.visit?.id, code: res.visit?.visit_code };
    },
    onSuccess: ({ visitId, code }) => {
      toast.success("Visit initiated", code ? `Visit ${code} started for ${selectedPatient?.first_name}. A queue ticket has been raised.` : "The visit has started.");
      navigate(visitId ? routes.visitDetail.replace(":visitId", String(visitId)) : routes.visits);
    },
    onError: async (err: unknown) => {
      const message = err instanceof Error && !("response" in err) ? err.message : apiErrorMessage(err, "Visit initiation failed. Please try again.");
      if (message.toLowerCase().includes("already has an active visit") && selectedPatient) {
        const visits = await getVisits({ patient_id: selectedPatient.id, status: "ACTIVE" }).catch(() => null);
        const active = visits?.items?.[0];
        if (active) {
          setError(
            <span>
              {message}{" "}
              <Link to={routes.visitDetail.replace(":visitId", String(active.id))} className="dx-link font-semibold">
                Open visit {active.visit_code}
              </Link>
            </span>,
          );
          return;
        }
      }
      setError(message);
    },
  });

  const canSubmit =
    !!selectedPatient && !activeVisit && !initiate.isPending && (effectiveMode === "APPOINTMENT" ? !!effectiveAppt : !!effectiveSdp);

  // ---------- Grids ----------
  const resultColumns: DxGridColumn<Patient>[] = [
    { key: "hospital_number", header: "Hospital no.", width: 120, render: (p) => <span className="dx-mono font-semibold">{p.hospital_number}</span> },
    {
      key: "name",
      header: "Patient",
      render: (p) => (
        <div className="min-w-0">
          <div className="dx-row-primary truncate">
            {p.first_name} {p.last_name}
          </div>
          <div className="dx-row-secondary">
            {humanize(p.gender)} · {ageFrom(p.date_of_birth)}
            {p.phone_number ? ` · ${p.phone_number}` : ""}
          </div>
        </div>
      ),
    },
    { key: "payer", header: "Payer", width: 100, render: (p) => <DxBadge tone="outline">{humanize(p.patient_class ?? p.payer_type)}</DxBadge> },
    { key: "pick", header: "", width: 90, align: "right", render: () => <DxButton size="sm" variant="accent-text" rightIcon={<ArrowRight />}>Select</DxButton> },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Patients", to: routes.patients }, { label: "Visit initiation" }]}
        title="Start a patient visit"
        subtitle="Find the patient, pick up today's appointment or start a walk-in, set priority and pathway, then raise the first queue ticket."
        actions={
          <DxButton leftIcon={<X />} onClick={() => navigate(-1)}>
            Cancel
          </DxButton>
        }
      />

      <div className="grid gap-4 xl:grid-cols-12">
        {/* ---------- Patient ---------- */}
        <div className="space-y-4 xl:col-span-4">
          <DxPanel
            title="Patient"
            icon={<User />}
            description={selectedPatient ? "Who is presenting" : "Search the registry"}
            flush={!selectedPatient}
            actions={
              selectedPatient ? (
                <DxButton size="sm" variant="text" leftIcon={<RefreshCw />} onClick={resetPatient}>
                  Change
                </DxButton>
              ) : null
            }
          >
            {!selectedPatient ? (
              <div>
                <div className="border-b border-[var(--dx-border)] p-2">
                  <DxSearchBox onSearch={setSearch} placeholder="Name, hospital number, phone or ID…" autoFocus />
                </div>
                <DxGrid
                  columns={resultColumns}
                  data={search.trim().length >= 2 ? results : []}
                  rowKey={(p) => p.id}
                  isLoading={searchQuery.isLoading && search.trim().length >= 2}
                  error={searchQuery.isError ? apiErrorMessage(searchQuery.error, "Search failed.") : null}
                  onRetry={() => searchQuery.refetch()}
                  onRowClick={choosePatient}
                  borderless
                  striped={false}
                  verticalLines={false}
                  maxHeight={440}
                  empty={{
                    icon: User,
                    title: search.trim().length >= 2 ? `No patients match “${search.trim()}”` : "Type at least 2 characters",
                    description:
                      search.trim().length >= 2 ? (
                        <Link to={routes.patientRegister} className="dx-link">
                          Register a new patient
                        </Link>
                      ) : (
                        "Search by name, hospital number or phone."
                      ),
                  }}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <DxAvatar name={`${selectedPatient.first_name} ${selectedPatient.last_name}`} size="lg" />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold">
                      {selectedPatient.first_name} {selectedPatient.last_name}
                    </p>
                    <p className="dx-mono dx-muted text-[12px]">{selectedPatient.hospital_number}</p>
                  </div>
                </div>
                <DxProps
                  tight
                  items={[
                    { label: "Gender", value: humanize(selectedPatient.gender) },
                    { label: "Date of birth", value: `${formatDate(selectedPatient.date_of_birth)} · ${ageFrom(selectedPatient.date_of_birth)}` },
                    { label: "Phone", value: <span className="dx-mono">{selectedPatient.phone_number || "—"}</span> },
                    { label: "Payer", value: <DxBadge tone="outline">{humanize(selectedPatient.patient_class ?? selectedPatient.payer_type)}</DxBadge> },
                    { label: "Address", value: [selectedPatient.city, selectedPatient.state].filter(Boolean).join(", ") || "—" },
                  ]}
                />

                {loadingCtx ? (
                  <div className="dx-skeleton h-9" />
                ) : activeVisit ? (
                  <DxMessage tone="warning" title="Already has an active visit">
                    <Link to={routes.visitDetail.replace(":visitId", String(activeVisit.id))} className="dx-link font-semibold">
                      Open {activeVisit.visit_code}
                    </Link>
                  </DxMessage>
                ) : todaysAppointments.length > 0 ? (
                  <DxMessage tone="success">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
                      {todaysAppointments.length} appointment{todaysAppointments.length > 1 ? "s" : ""} scheduled today
                    </span>
                  </DxMessage>
                ) : (
                  <DxMessage tone="info">
                    <span className="inline-flex items-center gap-1.5">
                      <Footprints className="h-3.5 w-3.5" aria-hidden />
                      No appointment today — walk-in encounter
                    </span>
                  </DxMessage>
                )}
                <Link to={routes.patientDetail.replace(":patientId", String(selectedPatient.id))} className="dx-link text-[12px]">
                  View full patient record →
                </Link>
              </div>
            )}
          </DxPanel>
        </div>

        {/* ---------- Encounter setup ---------- */}
        <div className="space-y-4 xl:col-span-8">
          {error ? (
            <DxMessage tone="danger" title="Couldn't start the visit">
              {error}
            </DxMessage>
          ) : null}

          {!selectedPatient ? (
            <DxPanel title="Encounter setup" icon={<ClipboardList />}>
              <div className="dx-grid-state py-16">
                <ClipboardList aria-hidden />
                <p className="dx-grid-state-title">Select a patient to begin</p>
                <p>If they have an appointment today you can check them in and start the visit in one step.</p>
              </div>
            </DxPanel>
          ) : (
            <DxPanel
              title="Encounter setup"
              icon={<ClipboardList />}
              description="How is this patient starting?"
              footer={
                <>
                  <span className="mr-auto inline-flex items-center gap-1.5 text-[12px] text-[var(--dx-text-muted)]">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[var(--dx-success)]" aria-hidden />
                    {effectiveMode === "APPOINTMENT" && selectedAppointment
                      ? `Appointment at ${formatTime(selectedAppointment.scheduled_start_at)} · ${selectedAppointment.service_delivery_point_name ?? "appointment's service point"}`
                      : `Walk-in · starts at ${sdps.find((s) => String(s.id) === effectiveSdp)?.name ?? "—"}`}
                  </span>
                  <DxButton variant="primary" size="lg" rightIcon={<ArrowRight />} disabled={!canSubmit} isLoading={initiate.isPending} onClick={() => initiate.mutate()}>
                    {effectiveMode === "APPOINTMENT" ? "Check in & start visit" : "Start visit"}
                  </DxButton>
                </>
              }
            >
              <div className="space-y-5">
                <DxGroupBox caption="Encounter type">
                  <DxSegmented<Mode>
                    value={effectiveMode}
                    onChange={setMode}
                    items={[
                      { key: "APPOINTMENT", label: `From appointment${todaysAppointments.length ? ` (${todaysAppointments.length} today)` : ""}`, icon: <CalendarClock />, disabled: todaysAppointments.length === 0 },
                      { key: "WALK_IN", label: "Walk-in", icon: <Footprints /> },
                    ]}
                  />

                  {effectiveMode === "APPOINTMENT" ? (
                    <div className="mt-3 space-y-2">
                      <p className="dx-caption">Today's appointment</p>
                      <div className="grid gap-2 md:grid-cols-2">
                        {todaysAppointments.map((a) => (
                          <DxChoice
                            key={a.id}
                            selected={effectiveAppt === a.id}
                            onClick={() => setSelectedAppt(a.id)}
                            icon={<Clock />}
                            title={
                              <span className="inline-flex items-center gap-2">
                                {formatTime(a.scheduled_start_at)}
                                <DxBadge tone="outline">{humanize(a.status)}</DxBadge>
                              </span>
                            }
                            subtitle={
                              <span className="inline-flex flex-wrap items-center gap-x-2">
                                <span className="inline-flex items-center gap-1">
                                  <Building2 className="h-3 w-3" aria-hidden />
                                  {a.service_delivery_point_name || "Service point from appointment"}
                                </span>
                                {a.staff_name ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Stethoscope className="h-3 w-3" aria-hidden />
                                    {a.staff_name}
                                  </span>
                                ) : null}
                              </span>
                            }
                          />
                        ))}
                      </div>
                      <p className="dx-field-hint">
                        Starting the visit checks the patient in as <b>Arrived</b> and routes them to the appointment's service point.
                      </p>
                    </div>
                  ) : (
                    <DxForm cols={2} className="mt-3">
                      <DxSelect
                        label="Starting service point"
                        required
                        value={effectiveSdp}
                        onChange={(e) => setSelectedSdp(e.target.value)}
                        placeholder={sdpQuery.isLoading ? "Loading…" : "Select where the patient starts…"}
                        options={sdps.map((s: ServiceDeliveryPoint) => ({ value: String(s.id), label: `${s.name} (${s.code}) — ${sdpTypeLabel(s.service_point_type)}` }))}
                        hint={selectedTemplate ? "Defaults to the pathway's first checkpoint." : undefined}
                      />
                    </DxForm>
                  )}
                </DxGroupBox>

                <DxGroupBox caption="Priority">
                  <div className="grid gap-2 sm:grid-cols-3">
                    {PRIORITIES.map((p) => (
                      <DxChoice
                        key={p.value}
                        selected={priority === p.value}
                        onClick={() => setPriority(p.value)}
                        icon={<Flame />}
                        title={
                          <span className="inline-flex items-center gap-2">
                            {p.label}
                            <DxBadge tone={p.tone} dot>
                              {p.value === "ROUTINE" ? "P0" : p.value === "URGENT" ? "P1" : "P2"}
                            </DxBadge>
                          </span>
                        }
                        subtitle={p.hint}
                      />
                    ))}
                  </div>
                </DxGroupBox>

                <DxGroupBox caption="Care pathway">
                  {templates.length === 0 && !templatesQuery.isLoading ? (
                    <DxMessage tone="warning" className="mb-3">
                      No care pathways are configured yet. An administrator can create one under{" "}
                      <Link to={routes.visitFlows} className="dx-link">
                        Visit Flow Management
                      </Link>
                      ; the patient will be routed manually.
                    </DxMessage>
                  ) : null}
                  <DxForm cols={2}>
                    <DxSelect
                      label="Pathway template"
                      value={selectedTemplateId == null ? "" : String(selectedTemplateId)}
                      onChange={(e) => {
                        setTemplateChoice(e.target.value ? Number(e.target.value) : null);
                        setSelectedSdp("");
                      }}
                      options={[
                        { value: "", label: "No template — route manually" },
                        ...templates.map((t) => ({
                          value: String(t.id),
                          label: `${t.name}${t.is_default ? " (default)" : ""} · ${t.associated_visit_flow_templates_steps?.length ?? 0} checkpoints`,
                        })),
                      ]}
                      hint="A pathway routes the patient through a preset sequence of service points; each stop raises a queue ticket."
                    />
                    <DxField label="Checkpoints">
                      {pathwayPreview.length ? (
                        <div className="rounded border border-[var(--dx-border)] bg-[var(--dx-surface-alt)] px-1 py-0.5">
                          <DxSteps items={pathwayPreview} />
                        </div>
                      ) : (
                        <div className="dx-editor dx-editor-trigger text-[var(--dx-text-faint)]">
                          <GitBranch className="mr-2 h-3.5 w-3.5" aria-hidden /> Manual routing at each desk
                        </div>
                      )}
                    </DxField>
                  </DxForm>
                </DxGroupBox>

                <DxTextarea
                  label="Reason / chief complaint"
                  placeholder="Why is the patient here today?"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </DxPanel>
          )}
        </div>
      </div>

      <DxStatusBar>
        <DxStatusItem icon={<AlertCircle />}>
          Emergency priority fast-tracks the ticket to the front of every queue.
        </DxStatusItem>
        <span className="ml-auto">{templates.length ? `${templates.length} pathway template${templates.length === 1 ? "" : "s"} available` : "No pathway templates configured"}</span>
      </DxStatusBar>
    </DxPage>
  );
}
