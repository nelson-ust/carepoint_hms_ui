import { PageHeader } from "@/components/layout/PageHeader";
import { useState, useEffect, useMemo, type ReactNode } from "react";
import {
  Search,
  User,
  ArrowRight,
  Clock,
  AlertCircle,
  ChevronRight,
  ClipboardList,
  Flame,
  CheckCircle2,
  Building2,
  RefreshCw,
  FileText,
  GitBranch,
  CalendarClock,
  CalendarCheck,
  Stethoscope,
  Loader2,
  Footprints,
} from "lucide-react";
import { searchPatients } from "@/features/patients/api/patients.api";
import type { Patient } from "@/features/patients/api/patients.api";
import { initiateVisit, getServiceDeliveryPoints, getVisits } from "../api/visits.api";
import type { ServiceDeliveryPoint } from "../api/visits.api";
import { getVisitTemplates } from "../api/visit-flows.api";
import type { VisitTemplate } from "../api/visit-flows.api";
import {
  appointmentsApi,
  isAppointmentToday,
  type Appointment,
} from "@/features/appointments/api/appointments.api";
import { useToast } from "@/components/feedback/ToastProvider";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { routes } from "@/config/routes";

type Mode = "APPOINTMENT" | "WALK_IN";

const PRIORITY_OPTIONS = [
  { value: "ROUTINE", label: "Routine", color: "bg-emerald-500", icon: CheckCircle2 },
  { value: "URGENT", label: "Urgent", color: "bg-amber-500", icon: Clock },
  { value: "EMERGENCY", label: "Emergency", color: "bg-rose-500", icon: Flame },
];

function apptTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function VisitInitiationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const patientFromState = location.state?.patient as Patient | undefined;

  // ----- Patient search -----
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(patientFromState ?? null);

  // ----- Context -----
  const [sdps, setSdps] = useState<ServiceDeliveryPoint[]>([]);
  const [templates, setTemplates] = useState<VisitTemplate[]>([]);
  const [selectedSdp, setSelectedSdp] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);

  // ----- Per-patient context -----
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingCtx, setLoadingCtx] = useState(false);
  const [activeVisit, setActiveVisit] = useState<{ id: number; visit_code?: string } | null>(null);
  const [mode, setMode] = useState<Mode>("WALK_IN");
  const [selectedAppt, setSelectedAppt] = useState<number | null>(null);

  const [priority, setPriority] = useState("ROUTINE");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ReactNode | null>(null);

  // Load service points + templates once.
  useEffect(() => {
    (async () => {
      const [sdpData, templateData] = await Promise.all([
        getServiceDeliveryPoints().catch(() => [] as ServiceDeliveryPoint[]),
        getVisitTemplates().catch(() => null),
      ]);
      const activeSdps = (Array.isArray(sdpData) ? sdpData : []).filter((s) => s.is_active !== false);
      setSdps(activeSdps);
      const templateItems = Array.isArray(templateData?.items) ? templateData!.items : [];
      setTemplates(templateItems);
      if (activeSdps.length > 0) setSelectedSdp(activeSdps[0].id);
      if (templateItems.length > 0) setSelectedTemplate(templateItems[0].id);
    })();
  }, []);

  // Debounced patient search (name, hospital number, phone, or id).
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchPatients(searchQuery.trim());
        setSearchResults((res as any).items ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // When a patient is chosen, load today's appointments + any active visit.
  useEffect(() => {
    if (!selectedPatient) {
      setAppointments([]);
      setActiveVisit(null);
      setSelectedAppt(null);
      setMode("WALK_IN");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingCtx(true);
      setError(null);
      try {
        const [apptRes, visitRes] = await Promise.all([
          appointmentsApi.list({ patient_id: selectedPatient.id, limit: 50 }).catch(() => ({
            items: [] as Appointment[],
          })),
          getVisits({ patient_id: selectedPatient.id, status: "ACTIVE" }).catch(() => ({
            items: [] as any[],
          })),
        ]);
        if (cancelled) return;
        const todays = (apptRes.items ?? [])
          .filter((a) => isAppointmentToday(a) && (a.status === "SCHEDULED" || a.status === "ARRIVED"))
          .sort(
            (a, b) =>
              new Date(a.scheduled_start_at).getTime() - new Date(b.scheduled_start_at).getTime(),
          );
        setAppointments(todays);
        const av = (visitRes.items ?? [])[0];
        setActiveVisit(av ? { id: av.id, visit_code: av.visit_code } : null);
        if (todays.length > 0) {
          setMode("APPOINTMENT");
          setSelectedAppt(todays[0].id);
        } else {
          setMode("WALK_IN");
          setSelectedAppt(null);
        }
      } finally {
        if (!cancelled) setLoadingCtx(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPatient]);

  const selectedAppointment = useMemo(
    () => appointments.find((a) => a.id === selectedAppt) ?? null,
    [appointments, selectedAppt],
  );

  const canSubmit =
    !!selectedPatient &&
    !activeVisit &&
    !isSubmitting &&
    (mode === "APPOINTMENT" ? !!selectedAppt : !!selectedSdp);

  const resetPatient = () => {
    setSelectedPatient(null);
    setSearchQuery("");
    setSearchResults([]);
    setError(null);
  };

  const handleInitiate = async () => {
    if (!selectedPatient) {
      setError("Select a patient first.");
      return;
    }
    if (activeVisit) {
      setError("This patient already has an active visit.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      let visitId: number | undefined;
      let code: string | undefined;

      if (mode === "APPOINTMENT" && selectedAppt) {
        // Patient with a same-day appointment has presented → check them in and
        // start the visit at the appointment's service point in one step.
        const res = await appointmentsApi.checkIn(selectedAppt, {
          initiate_visit: true,
          use_appointment_service_point: true,
          visit_reason: reason.trim() || undefined,
          fast_track: priority === "EMERGENCY",
          visit_flow_template_id: selectedTemplate ?? undefined,
        });
        visitId = res.visit_id ?? undefined;
        code = res.visit_code ?? undefined;
      } else {
        if (!selectedSdp) {
          setError("Pick a starting service point.");
          setIsSubmitting(false);
          return;
        }
        const now = new Date().toISOString();
        const res = await initiateVisit({
          patient_id: selectedPatient.id,
          priority,
          first_service_delivery_point_id: selectedSdp,
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
          visit_flow_template_id: selectedTemplate ?? undefined,
        });
        visitId = res.visit?.id;
        code = res.visit?.visit_code;
      }

      toast.success(
        "Visit initiated",
        code ? `Visit ${code} started for ${selectedPatient.first_name}.` : "The visit has started.",
      );
      if (visitId) navigate(routes.visitDetail.replace(":visitId", String(visitId)));
      else navigate(routes.visits);
    } catch (err: any) {
      const data = err?.response?.data;
      let message: string =
        (typeof data?.message === "string" && data.message) ||
        (typeof data?.detail === "string" && data.detail) ||
        (Array.isArray(data?.detail) &&
          data.detail
            .map((d: any) => `${d.loc?.join(".") ?? "field"}: ${d.msg ?? "invalid"}`)
            .join(" · ")) ||
        "Visit initiation failed. Please try again.";

      if (message.toLowerCase().includes("already has an active visit") && selectedPatient) {
        try {
          const visits = await getVisits({ patient_id: selectedPatient.id, status: "ACTIVE" });
          const active = visits.items?.[0];
          if (active) {
            setActiveVisit({ id: active.id, visit_code: active.visit_code });
            setError(
              <span>
                {message}{" "}
                <Link
                  to={routes.visitDetail.replace(":visitId", String(active.id))}
                  className="ml-1 font-black underline hover:text-rose-700"
                >
                  View active visit {active.visit_code}
                </Link>
              </span>,
            );
            return;
          }
        } catch {
          /* fall through to plain message */
        }
      }
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <PageHeader
          title="Start a Patient Visit"
          description="Find the patient, pick up their appointment for today or start a walk-in, and route them into care."
        />
        <button onClick={() => navigate(-1)} className="btn-secondary rounded-2xl px-6 py-3">
          Cancel
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* ---------- Left: patient ---------- */}
        <div className="lg:col-span-4">
          <div className="glass-card flex min-h-[560px] flex-col rounded-[2.5rem] border border-secondary-400 bg-white/50 p-8 shadow-premium backdrop-blur-xl">
            <div className="mb-8 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
                <User className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display text-xl font-black tracking-tight">Patient</h3>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-secondary-400">
                  Who is presenting?
                </p>
              </div>
            </div>

            {!selectedPatient ? (
              <div className="flex-1 space-y-5">
                <div className="group relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400 transition-colors group-focus-within:text-primary-500" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search name, hospital number, phone, or ID…"
                    className="input-field h-14 border-secondary-400 bg-white/80 pl-12 text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="custom-scrollbar max-h-[430px] space-y-3 overflow-y-auto pr-1">
                  {isSearching ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-16">
                      <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-400">
                        Searching…
                      </p>
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPatient(p)}
                        className="group flex w-full items-center justify-between rounded-[1.5rem] border border-secondary-100 bg-white p-4 transition-all hover:border-primary-200 hover:shadow-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary-50 text-sm font-black text-secondary-600 transition-all group-hover:bg-primary-500 group-hover:text-white">
                            {p.first_name?.[0]}
                            {p.last_name?.[0]}
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-black text-secondary-900 group-hover:text-primary-600">
                              {p.first_name} {p.last_name}
                            </p>
                            <p className="mt-0.5 font-mono text-[10px] font-bold uppercase text-secondary-400">
                              {p.hospital_number}
                              {p.phone_number ? ` · ${p.phone_number}` : ""}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-secondary-300 transition-all group-hover:translate-x-1 group-hover:text-primary-500" />
                      </button>
                    ))
                  ) : searchQuery.trim().length >= 2 ? (
                    <div className="py-16 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-secondary-300">
                        No patients match “{searchQuery.trim()}”
                      </p>
                    </div>
                  ) : (
                    <div className="py-16 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-secondary-300">
                        Type at least 2 characters to search
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 animate-slide-up space-y-6">
                <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-7 text-white shadow-2xl">
                  <div className="absolute right-0 top-0 h-32 w-32 -translate-y-1/2 translate-x-1/2 rounded-full bg-primary-500/20 blur-3xl" />
                  <button
                    onClick={resetPatient}
                    className="absolute right-5 top-5 rounded-2xl bg-white/10 p-2.5 transition-all hover:bg-white/20"
                    title="Choose a different patient"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <div className="flex flex-col items-center gap-5 text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-gradient-to-br from-primary-400 to-primary-600 text-2xl font-black shadow-2xl">
                      {selectedPatient.first_name?.[0]}
                      {selectedPatient.last_name?.[0]}
                    </div>
                    <div>
                      <h4 className="text-xl font-black tracking-tight">
                        {selectedPatient.first_name} {selectedPatient.last_name}
                      </h4>
                      <div className="mt-2 inline-flex rounded-full bg-white/10 px-4 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest">
                        {selectedPatient.hospital_number}
                      </div>
                    </div>
                  </div>
                  <div className="mt-7 space-y-3">
                    <div className="flex items-center justify-between rounded-2xl bg-white/5 p-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                        Gender
                      </span>
                      <span className="text-xs font-black uppercase">{selectedPatient.gender || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-white/5 p-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                        Date of birth
                      </span>
                      <span className="text-xs font-black">{selectedPatient.date_of_birth || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Today's appointment / active-visit signals */}
                {loadingCtx ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-secondary-200 px-4 py-3 text-xs font-bold text-secondary-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Checking appointments…
                  </div>
                ) : activeVisit ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <p className="text-xs font-bold text-amber-700">
                      Already has an active visit.{" "}
                      <Link
                        to={routes.visitDetail.replace(":visitId", String(activeVisit.id))}
                        className="underline"
                      >
                        Open {activeVisit.visit_code}
                      </Link>
                    </p>
                  </div>
                ) : appointments.length > 0 ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
                    <CalendarCheck className="h-4 w-4" />
                    {appointments.length} appointment{appointments.length > 1 ? "s" : ""} scheduled today
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-2xl border border-secondary-200 px-4 py-3 text-xs font-bold text-secondary-400">
                    <Footprints className="h-4 w-4" /> No appointment today — walk-in
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ---------- Right: encounter setup ---------- */}
        <div className="lg:col-span-8 space-y-6">
          {error && (
            <div className="flex items-center gap-4 rounded-[2rem] border border-rose-100 bg-rose-50 p-6 text-rose-600 shadow-sm">
              <AlertCircle className="h-7 w-7 shrink-0" />
              <div>
                <p className="text-base font-black tracking-tight">Couldn’t start the visit</p>
                <p className="text-sm font-medium text-rose-500/90">{error}</p>
              </div>
            </div>
          )}

          {!selectedPatient ? (
            <div className="glass-card flex min-h-[560px] flex-col items-center justify-center gap-4 rounded-[3rem] border border-dashed border-secondary-300 bg-white/40 p-14 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.75rem] bg-secondary-100 text-secondary-400">
                <ClipboardList className="h-8 w-8" />
              </div>
              <div>
                <h3 className="font-display text-2xl font-black tracking-tight text-secondary-900">
                  Select a patient to begin
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-secondary-400">
                  Search on the left. If they have an appointment today, you’ll be able to check them
                  in and start the visit in one step.
                </p>
              </div>
            </div>
          ) : (
            <div className="glass-card space-y-10 overflow-hidden rounded-[3rem] bg-white/80 p-8 shadow-premium md:p-12">
              <div className="flex items-center gap-5 border-b border-secondary-400 pb-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-[1.5rem] bg-primary-600 text-white shadow-xl">
                  <ClipboardList className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-black tracking-tight text-secondary-900">
                    Encounter Setup
                  </h3>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.3em] text-secondary-400">
                    How is this patient starting?
                  </p>
                </div>
              </div>

              {/* Mode toggle */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => appointments.length > 0 && setMode("APPOINTMENT")}
                  disabled={appointments.length === 0}
                  className={`flex items-center gap-3 rounded-[1.5rem] border-2 p-5 text-left transition-all ${
                    mode === "APPOINTMENT"
                      ? "border-primary-600 bg-primary-50 text-primary-700"
                      : "border-secondary-300 text-secondary-500 hover:border-primary-200"
                  } ${appointments.length === 0 ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  <CalendarClock className="h-6 w-6 shrink-0" />
                  <div>
                    <p className="text-sm font-black">From appointment</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">
                      {appointments.length > 0
                        ? `${appointments.length} today`
                        : "None today"}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("WALK_IN")}
                  className={`flex items-center gap-3 rounded-[1.5rem] border-2 p-5 text-left transition-all ${
                    mode === "WALK_IN"
                      ? "border-primary-600 bg-primary-50 text-primary-700"
                      : "border-secondary-300 text-secondary-500 hover:border-primary-200"
                  }`}
                >
                  <Footprints className="h-6 w-6 shrink-0" />
                  <div>
                    <p className="text-sm font-black">Walk-in</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">
                      No appointment
                    </p>
                  </div>
                </button>
              </div>

              {/* Appointment picker */}
              {mode === "APPOINTMENT" && (
                <div className="space-y-4">
                  <label className="ml-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-secondary-500">
                    <CalendarClock className="h-4 w-4 text-primary-500" />
                    Today’s Appointment
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    {appointments.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelectedAppt(a.id)}
                        aria-pressed={selectedAppt === a.id}
                        className={`rounded-[1.5rem] border-2 p-5 text-left transition-all ${
                          selectedAppt === a.id
                            ? "border-primary-500 bg-primary-600 text-white shadow-xl shadow-primary-500/30 ring-2 ring-primary-400/40"
                            : "border-secondary-300 bg-white text-secondary-700 hover:border-primary-300 hover:bg-primary-50/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-sm font-black">
                            <Clock className="h-3.5 w-3.5" />
                            {apptTime(a.scheduled_start_at)}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                              selectedAppt === a.id ? "bg-white/15" : "bg-secondary-100 text-secondary-500"
                            }`}
                          >
                            {a.status}
                          </span>
                        </div>
                        <p
                          className={`mt-2 flex items-center gap-1.5 text-xs font-bold ${
                            selectedAppt === a.id ? "text-white/80" : "text-secondary-500"
                          }`}
                        >
                          <Building2 className="h-3.5 w-3.5" />
                          {a.service_delivery_point_name || "Service point from appointment"}
                        </p>
                        {a.staff_name ? (
                          <p
                            className={`mt-1 flex items-center gap-1.5 text-[11px] ${
                              selectedAppt === a.id ? "text-white/60" : "text-secondary-400"
                            }`}
                          >
                            <Stethoscope className="h-3 w-3" />
                            {a.staff_name}
                          </p>
                        ) : null}
                      </button>
                    ))}
                  </div>
                  <p className="ml-1 text-[11px] font-medium text-secondary-400">
                    Starting the visit checks the patient in as{" "}
                    <span className="font-bold">Arrived</span> and routes them to the appointment’s
                    service point.
                  </p>
                </div>
              )}

              {/* Walk-in routing */}
              {mode === "WALK_IN" && (
                <div className="space-y-4">
                  <label className="ml-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-secondary-500">
                    <Building2 className="h-4 w-4 text-primary-500" />
                    Starting Service Point
                  </label>
                  <select
                    value={selectedSdp || ""}
                    onChange={(e) => setSelectedSdp(Number(e.target.value))}
                    className="input-field h-14 border-secondary-400 bg-white/60 pl-5 text-sm font-bold"
                  >
                    <option value="" disabled>
                      Select where the patient starts…
                    </option>
                    {sdps.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Priority */}
              <div className="space-y-4">
                <label className="ml-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-secondary-500">
                  <Flame className="h-4 w-4 text-amber-500" />
                  Priority
                </label>
                <div className="flex gap-3">
                  {PRIORITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPriority(opt.value)}
                      className={`flex flex-1 flex-col items-center gap-2 rounded-[1.5rem] border-2 px-4 py-5 transition-all ${
                        priority === opt.value
                          ? `${opt.color} border-transparent text-white shadow-xl`
                          : "border-secondary-400 bg-white text-secondary-400 hover:border-primary-200"
                      }`}
                    >
                      <opt.icon
                        className={`h-5 w-5 ${priority === opt.value ? "text-white" : "text-secondary-300"}`}
                      />
                      <span className="text-[10px] font-black uppercase tracking-widest">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Template (both modes) */}
              <div className="space-y-4">
                <label className="ml-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-secondary-500">
                  <GitBranch className="h-4 w-4 text-primary-500" />
                  Care Pathway (optional)
                </label>
                <p className="ml-1 -mt-2 text-xs text-secondary-400">
                  A pathway routes the patient through a preset sequence of service points and sets
                  the starting point. Choose <span className="font-semibold">No template</span> to route
                  manually{mode === "APPOINTMENT" ? " from the appointment's service point" : ""}.
                </p>
                {templates.length === 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
                    No care pathways are configured yet. An administrator can create one under
                    Visit Flow Management, or the standard outpatient pathway will be set up
                    automatically once service points exist.
                  </div>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTemplate(null)}
                    aria-pressed={selectedTemplate === null}
                    className={`relative rounded-[1.5rem] border-2 p-5 text-left transition-all ${
                      selectedTemplate === null
                        ? "border-primary-500 bg-primary-600 text-white shadow-xl shadow-primary-500/30 ring-2 ring-primary-400/40"
                        : "border-secondary-400 bg-white text-secondary-600 hover:border-primary-300 hover:bg-primary-50/40"
                    }`}
                  >
                    {selectedTemplate === null && (
                      <CheckCircle2 className="absolute right-4 top-4 h-5 w-5 text-white" />
                    )}
                    <h5 className="text-sm font-black">No template</h5>
                    <p
                      className={`text-[10px] font-bold uppercase tracking-widest ${
                        selectedTemplate === null ? "text-white/60" : "text-secondary-400"
                      }`}
                    >
                      Route manually
                    </p>
                  </button>
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTemplate(t.id)}
                      aria-pressed={selectedTemplate === t.id}
                      className={`relative rounded-[1.5rem] border-2 p-5 text-left transition-all ${
                        selectedTemplate === t.id
                          ? "border-primary-500 bg-primary-600 text-white shadow-xl shadow-primary-500/30 ring-2 ring-primary-400/40"
                          : "border-secondary-400 bg-white text-secondary-600 hover:border-primary-300 hover:bg-primary-50/40"
                      }`}
                    >
                      {selectedTemplate === t.id && (
                        <CheckCircle2 className="absolute right-4 top-4 h-5 w-5 text-white" />
                      )}
                      <h5 className="text-sm font-black pr-7">{t.name}</h5>
                      <p
                        className={`text-[10px] font-bold uppercase tracking-widest ${
                          selectedTemplate === t.id ? "text-white/60" : "text-secondary-400"
                        }`}
                      >
                        {Array.isArray(t.associated_visit_flow_templates_steps)
                          ? t.associated_visit_flow_templates_steps.length
                          : 0}{" "}
                        checkpoints
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-4">
                <label className="ml-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-secondary-500">
                  <FileText className="h-4 w-4 text-emerald-500" />
                  Reason / Chief Complaint (optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="input-field resize-none border-secondary-400 bg-white px-6 py-4 text-sm"
                  placeholder="Why is the patient here today?"
                />
              </div>

              {/* Submit */}
              <div className="flex flex-col items-center justify-between gap-6 border-t border-secondary-400 pt-8 md:flex-row">
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-secondary-400">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  {mode === "APPOINTMENT" && selectedAppointment
                    ? `Appointment at ${apptTime(selectedAppointment.scheduled_start_at)}`
                    : "Walk-in encounter"}
                </p>
                <button
                  onClick={handleInitiate}
                  disabled={!canSubmit}
                  className="group flex w-full items-center justify-center gap-4 rounded-[1.75rem] bg-slate-900 px-12 py-5 text-base font-black tracking-tight text-white shadow-2xl transition-all hover:bg-black active:scale-95 disabled:opacity-30 md:w-auto"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <span>
                        {mode === "APPOINTMENT" ? "Check In & Start Visit" : "Start Visit"}
                      </span>
                      <ArrowRight className="h-6 w-6 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
