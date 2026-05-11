import { PageHeader } from "@/components/layout/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit3,
  FileText,
  Flame,
  Heart,
  History,
  LogOut,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Stethoscope,
  Thermometer,
  Trash2,
  User,
  Wind,
  X,
} from "lucide-react";
import { routes } from "@/config/routes";
import {
  deleteVisit,
  getVisitDetails,
  getServiceDeliveryPoints,
  updateVisit,
} from "../api/visits.api";
import type { ServiceDeliveryPoint, Visit } from "../api/visits.api";
import {
  getVitalSignsForVisit,
  recordVitalSign,
} from "@/features/vital-signs/api/vital-signs.api";
import type { VitalSign } from "@/features/vital-signs/api/vital-signs.api";
import { DiagnosesPanel } from "@/features/diagnoses/components/DiagnosesPanel";

const PRIORITY_OPTIONS = ["ROUTINE", "URGENT", "EMERGENCY"] as const;
const STATUS_OPTIONS = [
  "WAITING",
  "IN_PROGRESS",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
] as const;

const statusStyles: Record<string, string> = {
  WAITING: "bg-amber-50 text-amber-600 border-amber-100",
  IN_PROGRESS: "bg-primary-50 text-primary-600 border-primary-100",
  ACTIVE: "bg-primary-50 text-primary-600 border-primary-100",
  COMPLETED: "bg-emerald-50 text-emerald-600 border-emerald-100",
  CANCELLED: "bg-rose-50 text-rose-600 border-rose-100",
  PENDING: "bg-secondary-50 text-secondary-600 border-secondary-100",
  SKIPPED: "bg-secondary-100 text-secondary-500 border-secondary-200",
};

const priorityStyles: Record<string, string> = {
  ROUTINE: "bg-emerald-500 text-white",
  URGENT: "bg-amber-500 text-white",
  EMERGENCY: "bg-rose-500 text-white",
};

function formatDateTime(value?: string) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

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

const emptyVitalsForm: VitalsForm = {
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

function toNumberOrUndefined(value: string): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function VisitDetailPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const navigate = useNavigate();
  const visitIdNum = Number(visitId);

  const [visit, setVisit] = useState<Visit | null>(null);
  const [vitals, setVitals] = useState<VitalSign[]>([]);
  const [sdps, setSdps] = useState<ServiceDeliveryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<{
    visit_reason: string;
    priority: string;
    status: string;
    referred_from: string;
  }>({ visit_reason: "", priority: "", status: "", referred_from: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [isVitalsOpen, setVitalsOpen] = useState(false);
  const [vitalsForm, setVitalsForm] = useState<VitalsForm>(emptyVitalsForm);
  const [isSavingVitals, setSavingVitals] = useState(false);
  const [vitalsError, setVitalsError] = useState<string | null>(null);

  const [isCheckingOut, setCheckingOut] = useState(false);
  const [isDeleting, setDeleting] = useState(false);

  const loadAll = async () => {
    if (!visitId || Number.isNaN(visitIdNum)) {
      setError("Invalid visit identifier.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [visitData, vitalsData, sdpData] = await Promise.all([
        getVisitDetails(visitIdNum),
        getVitalSignsForVisit(visitIdNum).catch(() => null),
        getServiceDeliveryPoints().catch(() => []),
      ]);
      setVisit(visitData);
      setVitals(vitalsData?.items ?? []);
      setSdps(Array.isArray(sdpData) ? sdpData : []);
    } catch (err) {
      console.error("Failed to load visit", err);
      setError(
        "Unable to load this visit. The record may have been removed or the registry is offline.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId]);

  const sortedFlowSteps = useMemo(
    () =>
      visit?.flow_steps
        ? [...visit.flow_steps].sort((a, b) => a.step_order - b.step_order)
        : [],
    [visit?.flow_steps],
  );

  const sortedVitals = useMemo(
    () =>
      [...vitals].sort(
        (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
      ),
    [vitals],
  );

  const latestVital = sortedVitals[0];

  const openEdit = () => {
    if (!visit) return;
    setEditForm({
      visit_reason: visit.visit_reason ?? "",
      priority: visit.priority ?? "ROUTINE",
      status: visit.status ?? "ACTIVE",
      referred_from: visit.referred_from ?? "",
    });
    setSaveError(null);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!visit) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await updateVisit(visit.id, {
        visit_reason: editForm.visit_reason || undefined,
        priority: editForm.priority || undefined,
        status: editForm.status || undefined,
        referred_from: editForm.referred_from || undefined,
      });
      setVisit((prev) => (prev ? { ...prev, ...updated } : updated));
      setEditOpen(false);
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || "Failed to update visit metadata.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveVitals = async () => {
    if (!visit) return;
    setSavingVitals(true);
    setVitalsError(null);
    try {
      const payload = {
        visit_id: visit.id,
        temperature_celsius: toNumberOrUndefined(vitalsForm.temperature_celsius),
        pulse_rate: toNumberOrUndefined(vitalsForm.pulse_rate),
        respiratory_rate: toNumberOrUndefined(vitalsForm.respiratory_rate),
        systolic_bp: toNumberOrUndefined(vitalsForm.systolic_bp),
        diastolic_bp: toNumberOrUndefined(vitalsForm.diastolic_bp),
        oxygen_saturation: toNumberOrUndefined(vitalsForm.oxygen_saturation),
        weight_kg: toNumberOrUndefined(vitalsForm.weight_kg),
        height_cm: toNumberOrUndefined(vitalsForm.height_cm),
        pain_score: toNumberOrUndefined(vitalsForm.pain_score),
      };
      const result = await recordVitalSign(payload);
      if (result?.vital_sign) {
        setVitals((prev) => [result.vital_sign, ...prev]);
      } else {
        const refreshed = await getVitalSignsForVisit(visit.id);
        setVitals(refreshed.items ?? []);
      }
      setVitalsForm(emptyVitalsForm);
      setVitalsOpen(false);
    } catch (err: any) {
      setVitalsError(err?.response?.data?.message || "Failed to record vital signs.");
    } finally {
      setSavingVitals(false);
    }
  };

  const handleCheckOut = async () => {
    if (!visit) return;
    if (!confirm("Mark this visit as completed and check the patient out?")) return;
    setCheckingOut(true);
    try {
      const updated = await updateVisit(visit.id, {
        status: "COMPLETED",
        check_out_time: new Date().toISOString(),
      });
      setVisit((prev) => (prev ? { ...prev, ...updated } : updated));
    } catch (err: any) {
      alert(err?.response?.data?.message || "Unable to check the patient out.");
    } finally {
      setCheckingOut(false);
    }
  };

  const handleDelete = async () => {
    if (!visit) return;
    if (!confirm("Delete this visit record? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteVisit(visit.id);
      navigate(routes.visits);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Unable to delete this visit.");
      setDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="h-16 w-16 border-4 border-primary-500 border-t-transparent rounded-[2rem] animate-spin shadow-2xl shadow-primary-500/20" />
        <p className="text-sm font-black text-secondary-400 uppercase tracking-[0.3em] animate-pulse">
          Loading Visit Lifecycle...
        </p>
      </div>
    );
  }

  if (error || !visit) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-8 animate-fade-in">
        <div className="h-24 w-24 bg-rose-50 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner">
          <AlertCircle className="h-12 w-12 text-rose-500" />
        </div>
        <div>
          <h3 className="text-3xl font-black text-secondary-900 tracking-tight">Visit Not Resolved</h3>
          <p className="text-secondary-500 mt-4 leading-relaxed max-w-md mx-auto">
            {error ?? "We couldn't locate this visit in the registry."}
          </p>
        </div>
        <button onClick={() => navigate(routes.visits)} className="btn-secondary px-8 py-4">
          Return to Registry
        </button>
      </div>
    );
  }

  const priorityKey = (visit.priority || "ROUTINE").toUpperCase();
  const statusKey = (visit.status || "ACTIVE").toUpperCase();
  const currentSdp = visit.current_service_delivery_point ?? visit.first_service_delivery_point;

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <button
            onClick={() => navigate(routes.visits)}
            className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-secondary-400 hover:text-secondary-700 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Registry
          </button>
          <PageHeader
            title={`Visit ${visit.visit_code || `#${visit.id}`}`}
            description="Full clinical lifecycle: patient, pathway, queue tickets, and vital signs."
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={loadAll}
            className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-100"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={openEdit}
            className="btn-secondary gap-2 px-5 py-3 rounded-2xl bg-white/80 border-secondary-100"
          >
            <Edit3 className="h-4 w-4" />
            <span className="text-sm font-bold">Edit</span>
          </button>
          <Link
            to={`${routes.consultation}/${visit.id}`}
            className="btn-primary gap-2 px-6 py-3 rounded-2xl bg-slate-900 hover:bg-black shadow-lg"
          >
            <Stethoscope className="h-4 w-4" />
            <span className="text-sm font-bold">Open Consultation</span>
          </Link>
          <Link
            to={routes.visitReroute.replace(":visitId", String(visit.id))}
            className="btn-primary gap-2 px-6 py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-500/20"
          >
            <ArrowRight className="h-4 w-4" />
            <span className="text-sm font-bold">Reroute</span>
          </Link>
          {statusKey !== "COMPLETED" && (
            <button
              onClick={handleCheckOut}
              disabled={isCheckingOut}
              className="btn-primary gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm font-bold">
                {isCheckingOut ? "Checking out..." : "Check Out"}
              </span>
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-4 rounded-2xl bg-white/80 border border-rose-100 text-rose-500 hover:bg-rose-50 transition-all disabled:opacity-50"
            title="Delete visit"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-12">
        {/* LEFT: Patient + Visit Summary */}
        <div className="lg:col-span-4 space-y-8">
          <div className="glass-card rounded-[2.5rem] p-10 border border-secondary-100 shadow-premium bg-white/60 backdrop-blur-xl">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
                <User className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-black font-display tracking-tight">Patient</h3>
                <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mt-0.5">
                  Identity & Encounter Context
                </p>
              </div>
            </div>

            {visit.patient ? (
              <div className="space-y-6">
                <div className="relative p-7 rounded-[2rem] bg-slate-900 text-white shadow-2xl overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                  <div className="flex flex-col items-center text-center space-y-5">
                    <div className="h-20 w-20 rounded-[2rem] bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-2xl font-black shadow-2xl">
                      {visit.patient.first_name?.[0]}
                      {visit.patient.last_name?.[0]}
                    </div>
                    <div>
                      <h4 className="text-xl font-black tracking-tight">
                        {visit.patient.first_name} {visit.patient.last_name}
                      </h4>
                      <div className="inline-flex mt-2 px-3 py-1 bg-white/10 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase">
                        {visit.patient.hospital_number}
                      </div>
                    </div>
                  </div>
                  <div className="mt-7 space-y-3">
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                        Gender
                      </span>
                      <span className="text-xs font-black uppercase">{visit.patient.gender}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                        Phone
                      </span>
                      <span className="text-xs font-black">{visit.patient.phone_number}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-secondary-400 text-sm font-bold">Patient #{visit.patient_id}</div>
            )}
          </div>

          {/* Visit Summary */}
          <div className="glass-card rounded-[2.5rem] p-10 border border-secondary-100 shadow-premium bg-white/60 backdrop-blur-xl space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-primary-600 text-white flex items-center justify-center shadow-lg">
                <Activity className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-black font-display tracking-tight">Encounter</h3>
                <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mt-0.5">
                  Live Lifecycle Snapshot
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-secondary-50 border border-secondary-100">
                <span className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
                  Status
                </span>
                <span
                  className={`px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest ${
                    statusStyles[statusKey] ?? statusStyles.PENDING
                  }`}
                >
                  {statusKey}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-secondary-50 border border-secondary-100">
                <span className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
                  Priority
                </span>
                <span
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest ${
                    priorityStyles[priorityKey] ?? priorityStyles.ROUTINE
                  }`}
                >
                  {priorityKey}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-secondary-50 border border-secondary-100 space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-secondary-400">
                  <Building2 className="h-3.5 w-3.5" />
                  Current Service Point
                </div>
                {currentSdp ? (
                  <div>
                    <p className="text-sm font-black text-secondary-900">{currentSdp.name}</p>
                    <p className="text-[10px] font-mono font-bold text-secondary-400 uppercase mt-0.5">
                      {currentSdp.code} · {currentSdp.service_point_type}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-secondary-400 font-bold">Unassigned</p>
                )}
              </div>
              <div className="p-4 rounded-2xl bg-secondary-50 border border-secondary-100 space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-secondary-400">
                  <Calendar className="h-3.5 w-3.5" />
                  Visit Date
                </div>
                <p className="text-sm font-black text-secondary-900">
                  {formatDateTime(visit.visit_date)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-secondary-50 border border-secondary-100 space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-secondary-400">
                    <Clock className="h-3.5 w-3.5" /> Check-In
                  </div>
                  <p className="text-xs font-black text-secondary-900">
                    {formatDateTime(visit.check_in_time)}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-secondary-50 border border-secondary-100 space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-secondary-400">
                    <Clock className="h-3.5 w-3.5" /> Check-Out
                  </div>
                  <p className="text-xs font-black text-secondary-900">
                    {formatDateTime(visit.check_out_time)}
                  </p>
                </div>
              </div>
              {visit.visit_reason && (
                <div className="p-5 rounded-2xl bg-amber-50 border border-amber-100 space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-600">
                    <FileText className="h-3.5 w-3.5" /> Clinical Indication
                  </div>
                  <p className="text-sm text-secondary-700 italic leading-relaxed">
                    "{visit.visit_reason}"
                  </p>
                </div>
              )}
              {visit.referred_from && (
                <div className="p-4 rounded-2xl bg-secondary-50 border border-secondary-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
                    Referred From
                  </span>
                  <span className="text-xs font-black text-secondary-900">
                    {visit.referred_from}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Flow Timeline + Vitals + Tickets */}
        <div className="lg:col-span-8 space-y-8">
          {/* Flow Steps */}
          <div className="glass-card rounded-[3rem] p-10 md:p-12 border border-secondary-100 bg-white/80 shadow-premium">
            <div className="flex items-center justify-between border-b border-secondary-100 pb-8 mb-10">
              <div className="flex items-center gap-5">
                <div className="h-14 w-14 rounded-[1.75rem] bg-slate-900 text-white flex items-center justify-center shadow-2xl">
                  <History className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-2xl font-black font-display tracking-tight">Care Pathway</h3>
                  <p className="text-secondary-400 font-bold text-[11px] uppercase tracking-[0.3em] mt-1">
                    Sequential Service Checkpoints
                  </p>
                </div>
              </div>
              <span className="px-4 py-2 rounded-2xl bg-secondary-100 text-secondary-600 text-[10px] font-bold uppercase tracking-widest">
                {sortedFlowSteps.length} {sortedFlowSteps.length === 1 ? "Step" : "Steps"}
              </span>
            </div>

            {sortedFlowSteps.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="h-16 w-16 mx-auto bg-secondary-50 rounded-3xl flex items-center justify-center">
                  <ChevronRight className="h-8 w-8 text-secondary-300" />
                </div>
                <p className="text-secondary-500 font-bold">
                  No flow steps recorded for this visit yet.
                </p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-[39px] top-10 bottom-10 w-0.5 bg-gradient-to-b from-primary-500/20 via-primary-500 to-primary-500/20" />
                <div className="space-y-8">
                  {sortedFlowSteps.map((step) => {
                    const stepStatus = (step.status || "PENDING").toUpperCase();
                    const stepClass = statusStyles[stepStatus] ?? statusStyles.PENDING;
                    const isCompleted = stepStatus === "COMPLETED" || step.completed_at;
                    const ringColor = step.is_current
                      ? "bg-primary-600 text-white ring-4 ring-primary-100"
                      : isCompleted
                      ? "bg-emerald-500 text-white"
                      : "bg-secondary-100 text-secondary-500";
                    return (
                      <div key={step.id} className="flex items-start gap-8 relative">
                        <div
                          className={`h-20 w-20 rounded-[2rem] flex items-center justify-center shadow-lg z-10 shrink-0 ${ringColor}`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-7 w-7" />
                          ) : step.is_current ? (
                            <Activity className="h-7 w-7" />
                          ) : (
                            <Clock className="h-7 w-7" />
                          )}
                        </div>
                        <div className="flex-1 p-6 rounded-[2rem] bg-secondary-50 border border-secondary-100">
                          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-400 mb-1">
                                Step {step.step_order}
                              </p>
                              <h5 className="text-base font-black text-secondary-900">
                                {step.service_delivery_point?.name ??
                                  `SDP #${step.service_delivery_point_id}`}
                              </h5>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest ${stepClass}`}
                              >
                                {stepStatus}
                              </span>
                              {step.is_required && (
                                <span className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-bold uppercase tracking-widest">
                                  Required
                                </span>
                              )}
                              {step.is_skipped && (
                                <span className="px-3 py-1.5 rounded-xl bg-secondary-100 text-secondary-500 text-[10px] font-bold uppercase tracking-widest">
                                  Skipped
                                </span>
                              )}
                              {step.is_current && (
                                <span className="px-3 py-1.5 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 text-[10px] font-bold uppercase tracking-widest">
                                  Current
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-[11px] font-bold text-secondary-500 mt-4">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3.5 w-3.5" />
                              <span>Started: {formatDateTime(step.started_at)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Completed: {formatDateTime(step.completed_at)}</span>
                            </div>
                          </div>
                          {step.notes && (
                            <p className="mt-4 text-xs text-secondary-600 italic bg-white rounded-2xl p-4 border border-secondary-100">
                              {step.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Vital Signs */}
          <div className="glass-card rounded-[3rem] p-10 md:p-12 border border-secondary-100 bg-white/80 shadow-premium">
            <div className="flex items-center justify-between border-b border-secondary-100 pb-8 mb-10">
              <div className="flex items-center gap-5">
                <div className="h-14 w-14 rounded-[1.75rem] bg-rose-500 text-white flex items-center justify-center shadow-2xl">
                  <Heart className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-2xl font-black font-display tracking-tight">Vital Signs</h3>
                  <p className="text-secondary-400 font-bold text-[11px] uppercase tracking-[0.3em] mt-1">
                    Physiological Trend & Latest Read
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setVitalsForm(emptyVitalsForm);
                  setVitalsError(null);
                  setVitalsOpen(true);
                }}
                className="btn-primary gap-2 px-5 py-3 rounded-2xl bg-slate-900 hover:bg-black shadow-lg"
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm font-bold">Record Vitals</span>
              </button>
            </div>

            {latestVital ? (
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 mb-10">
                <VitalCard
                  icon={Thermometer}
                  label="Temperature"
                  value={latestVital.temperature_celsius}
                  unit="°C"
                  tone="rose"
                />
                <VitalCard
                  icon={Activity}
                  label="Pulse"
                  value={latestVital.pulse_rate}
                  unit="bpm"
                  tone="primary"
                />
                <VitalCard
                  icon={Wind}
                  label="Resp. Rate"
                  value={latestVital.respiratory_rate}
                  unit="rpm"
                  tone="emerald"
                />
                <VitalCard
                  icon={Stethoscope}
                  label="BP"
                  value={
                    latestVital.systolic_bp != null && latestVital.diastolic_bp != null
                      ? `${latestVital.systolic_bp}/${latestVital.diastolic_bp}`
                      : null
                  }
                  unit="mmHg"
                  tone="amber"
                />
                <VitalCard
                  icon={Wind}
                  label="SpO₂"
                  value={latestVital.oxygen_saturation}
                  unit="%"
                  tone="primary"
                />
                <VitalCard
                  icon={Activity}
                  label="Weight"
                  value={latestVital.weight_kg}
                  unit="kg"
                  tone="emerald"
                />
                <VitalCard
                  icon={Activity}
                  label="Height"
                  value={latestVital.height_cm}
                  unit="cm"
                  tone="emerald"
                />
                <VitalCard
                  icon={Flame}
                  label="Pain"
                  value={latestVital.pain_score}
                  unit="/10"
                  tone="rose"
                />
              </div>
            ) : (
              <div className="py-12 text-center space-y-3 mb-6">
                <div className="h-16 w-16 mx-auto bg-rose-50 rounded-3xl flex items-center justify-center">
                  <Heart className="h-8 w-8 text-rose-300" />
                </div>
                <p className="text-secondary-500 font-bold">
                  No vital signs recorded yet for this visit.
                </p>
              </div>
            )}

            {sortedVitals.length > 1 && (
              <div className="space-y-4">
                <h4 className="text-[11px] font-bold uppercase tracking-[0.25em] text-secondary-500">
                  Historical Records ({sortedVitals.length})
                </h4>
                <div className="overflow-x-auto rounded-2xl border border-secondary-100">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-secondary-50">
                        <th className="px-4 py-3 font-bold uppercase tracking-widest text-secondary-500 text-[10px]">
                          Recorded
                        </th>
                        <th className="px-4 py-3 font-bold uppercase tracking-widest text-secondary-500 text-[10px]">
                          Temp
                        </th>
                        <th className="px-4 py-3 font-bold uppercase tracking-widest text-secondary-500 text-[10px]">
                          Pulse
                        </th>
                        <th className="px-4 py-3 font-bold uppercase tracking-widest text-secondary-500 text-[10px]">
                          BP
                        </th>
                        <th className="px-4 py-3 font-bold uppercase tracking-widest text-secondary-500 text-[10px]">
                          SpO₂
                        </th>
                        <th className="px-4 py-3 font-bold uppercase tracking-widest text-secondary-500 text-[10px]">
                          Pain
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary-100/50">
                      {sortedVitals.map((v) => (
                        <tr key={v.id} className="hover:bg-secondary-50/50">
                          <td className="px-4 py-3 font-mono text-[11px]">
                            {formatDateTime(v.recorded_at)}
                          </td>
                          <td className="px-4 py-3">{v.temperature_celsius ?? "—"}</td>
                          <td className="px-4 py-3">{v.pulse_rate ?? "—"}</td>
                          <td className="px-4 py-3">
                            {v.systolic_bp != null && v.diastolic_bp != null
                              ? `${v.systolic_bp}/${v.diastolic_bp}`
                              : "—"}
                          </td>
                          <td className="px-4 py-3">{v.oxygen_saturation ?? "—"}</td>
                          <td className="px-4 py-3">{v.pain_score ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Diagnoses (read-only here — full editing happens in ConsultationPage) */}
          <DiagnosesPanel visitId={visit.id} disabled />

          {/* Queue Tickets */}
          <div className="glass-card rounded-[3rem] p-10 md:p-12 border border-secondary-100 bg-white/80 shadow-premium">
            <div className="flex items-center justify-between border-b border-secondary-100 pb-8 mb-10">
              <div className="flex items-center gap-5">
                <div className="h-14 w-14 rounded-[1.75rem] bg-amber-500 text-white flex items-center justify-center shadow-2xl">
                  <MapPin className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-2xl font-black font-display tracking-tight">Queue Tickets</h3>
                  <p className="text-secondary-400 font-bold text-[11px] uppercase tracking-[0.3em] mt-1">
                    Service Point Tickets Issued
                  </p>
                </div>
              </div>
              <span className="px-4 py-2 rounded-2xl bg-secondary-100 text-secondary-600 text-[10px] font-bold uppercase tracking-widest">
                {visit.queue_tickets?.length ?? 0} Tickets
              </span>
            </div>

            {!visit.queue_tickets || visit.queue_tickets.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="h-16 w-16 mx-auto bg-amber-50 rounded-3xl flex items-center justify-center">
                  <MapPin className="h-8 w-8 text-amber-300" />
                </div>
                <p className="text-secondary-500 font-bold">
                  No queue tickets have been issued for this visit.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {visit.queue_tickets.map((ticket) => {
                  const sdp = sdps.find((s) => s.id === ticket.service_delivery_point_id);
                  const tStatus = (ticket.status || "WAITING").toUpperCase();
                  const tStatusClass = statusStyles[tStatus] ?? statusStyles.PENDING;
                  return (
                    <div
                      key={ticket.id}
                      className="p-6 rounded-2xl bg-secondary-50 border border-secondary-100 hover:border-primary-200 transition-all"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-mono font-bold text-secondary-400 uppercase tracking-tight">
                          Ticket #{ticket.queue_number}
                        </span>
                        <span
                          className={`px-3 py-1 rounded-xl border text-[10px] font-bold uppercase tracking-widest ${tStatusClass}`}
                        >
                          {tStatus}
                        </span>
                      </div>
                      <p className="text-sm font-black text-secondary-900">
                        {sdp?.name ?? `SDP #${ticket.service_delivery_point_id}`}
                      </p>
                      <div className="flex items-center justify-between mt-3 text-[11px] font-bold text-secondary-500">
                        <span>Position #{ticket.queue_position}</span>
                        <span>{formatDateTime(ticket.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-xl w-full shadow-2xl relative animate-slide-up">
            <button
              onClick={() => setEditOpen(false)}
              className="absolute top-6 right-6 p-3 hover:bg-secondary-50 rounded-2xl transition-all"
            >
              <X className="h-5 w-5 text-secondary-400" />
            </button>
            <div className="flex items-center gap-5 mb-8">
              <div className="h-14 w-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center shadow-xl shadow-primary-500/20">
                <Edit3 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-black font-display tracking-tight">Edit Visit</h3>
                <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
                  Update Encounter Metadata
                </p>
              </div>
            </div>

            {saveError && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm font-bold">{saveError}</span>
              </div>
            )}

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                  Status
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="input-field h-12 bg-secondary-50 border-secondary-100 w-full"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                  Priority
                </label>
                <select
                  value={editForm.priority}
                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                  className="input-field h-12 bg-secondary-50 border-secondary-100 w-full"
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                  Referred From
                </label>
                <input
                  type="text"
                  value={editForm.referred_from}
                  onChange={(e) => setEditForm({ ...editForm, referred_from: e.target.value })}
                  placeholder="Referring facility or department"
                  className="input-field h-12 bg-secondary-50 border-secondary-100 w-full"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                  Clinical Indication
                </label>
                <textarea
                  value={editForm.visit_reason}
                  onChange={(e) => setEditForm({ ...editForm, visit_reason: e.target.value })}
                  className="input-field h-28 bg-secondary-50 border-secondary-100 w-full resize-none py-3"
                  placeholder="Reason for this clinical encounter"
                />
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  onClick={() => setEditOpen(false)}
                  className="flex-1 btn-secondary py-4 rounded-2xl font-bold"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="flex-[2] btn-primary py-4 rounded-2xl font-black tracking-tight shadow-xl shadow-primary-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vitals Modal */}
      {isVitalsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-2xl w-full shadow-2xl relative animate-slide-up max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setVitalsOpen(false)}
              className="absolute top-6 right-6 p-3 hover:bg-secondary-50 rounded-2xl transition-all"
            >
              <X className="h-5 w-5 text-secondary-400" />
            </button>
            <div className="flex items-center gap-5 mb-8">
              <div className="h-14 w-14 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-xl shadow-rose-500/20">
                <Heart className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-black font-display tracking-tight">Record Vital Signs</h3>
                <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
                  Capture Physiological Snapshot
                </p>
              </div>
            </div>

            {vitalsError && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm font-bold">{vitalsError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <VitalsField
                label="Temperature (°C)"
                value={vitalsForm.temperature_celsius}
                onChange={(v) => setVitalsForm({ ...vitalsForm, temperature_celsius: v })}
                placeholder="36.6"
              />
              <VitalsField
                label="Pulse (bpm)"
                value={vitalsForm.pulse_rate}
                onChange={(v) => setVitalsForm({ ...vitalsForm, pulse_rate: v })}
                placeholder="72"
              />
              <VitalsField
                label="Respiratory Rate (rpm)"
                value={vitalsForm.respiratory_rate}
                onChange={(v) => setVitalsForm({ ...vitalsForm, respiratory_rate: v })}
                placeholder="16"
              />
              <VitalsField
                label="O₂ Saturation (%)"
                value={vitalsForm.oxygen_saturation}
                onChange={(v) => setVitalsForm({ ...vitalsForm, oxygen_saturation: v })}
                placeholder="98"
              />
              <VitalsField
                label="Systolic BP (mmHg)"
                value={vitalsForm.systolic_bp}
                onChange={(v) => setVitalsForm({ ...vitalsForm, systolic_bp: v })}
                placeholder="120"
              />
              <VitalsField
                label="Diastolic BP (mmHg)"
                value={vitalsForm.diastolic_bp}
                onChange={(v) => setVitalsForm({ ...vitalsForm, diastolic_bp: v })}
                placeholder="80"
              />
              <VitalsField
                label="Weight (kg)"
                value={vitalsForm.weight_kg}
                onChange={(v) => setVitalsForm({ ...vitalsForm, weight_kg: v })}
                placeholder="70"
              />
              <VitalsField
                label="Height (cm)"
                value={vitalsForm.height_cm}
                onChange={(v) => setVitalsForm({ ...vitalsForm, height_cm: v })}
                placeholder="170"
              />
              <VitalsField
                label="Pain Score (0–10)"
                value={vitalsForm.pain_score}
                onChange={(v) => setVitalsForm({ ...vitalsForm, pain_score: v })}
                placeholder="0"
              />
            </div>

            <div className="pt-8 flex gap-4">
              <button
                onClick={() => setVitalsOpen(false)}
                className="flex-1 btn-secondary py-4 rounded-2xl font-bold"
                disabled={isSavingVitals}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveVitals}
                disabled={isSavingVitals}
                className="flex-[2] btn-primary py-4 rounded-2xl font-black tracking-tight bg-rose-500 hover:bg-rose-600 shadow-xl shadow-rose-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {isSavingVitals ? "Saving..." : "Record Vitals"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----- Helper Components -----

type Tone = "primary" | "rose" | "emerald" | "amber";

const toneStyles: Record<Tone, string> = {
  primary: "bg-primary-50 text-primary-600 border-primary-100",
  rose: "bg-rose-50 text-rose-600 border-rose-100",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  amber: "bg-amber-50 text-amber-600 border-amber-100",
};

type VitalCardProps = {
  icon: typeof Heart;
  label: string;
  value: number | string | null | undefined;
  unit: string;
  tone: Tone;
};

function VitalCard({ icon: Icon, label, value, unit, tone }: VitalCardProps) {
  const display = value === null || value === undefined || value === "" ? "—" : value;
  return (
    <div className={`p-5 rounded-2xl border ${toneStyles[tone]}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4" />
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-black tracking-tight">{display}</span>
        {display !== "—" && (
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{unit}</span>
        )}
      </div>
    </div>
  );
}

type VitalsFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
};

function VitalsField({ label, value, onChange, placeholder }: VitalsFieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
        {label}
      </label>
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field h-12 bg-secondary-50 border-secondary-100 w-full"
      />
    </div>
  );
}
