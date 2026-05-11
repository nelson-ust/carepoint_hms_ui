import { PageHeader } from "@/components/layout/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Ban,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  History,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  Stethoscope,
  User,
  X,
} from "lucide-react";
import { routes } from "@/config/routes";
import { getVisitDetails } from "@/features/visits/api/visits.api";
import type { Visit } from "@/features/visits/api/visits.api";
import { listActiveServiceDeliveryPoints } from "@/features/service-delivery-points/api/service-delivery-points.api";
import type { ServiceDeliveryPoint } from "@/features/service-delivery-points/api/service-delivery-points.api";
import { getStaff, staffDisplayName } from "@/features/staff/api/staff.api";
import type { Staff } from "@/features/staff/api/staff.api";
import { getLatestVitalSignForVisit } from "@/features/vital-signs/api/vital-signs.api";
import type { VitalSign } from "@/features/vital-signs/api/vital-signs.api";
import {
  cancelConsultation,
  createConsultation,
  finalizeConsultation,
  isFinalConsultationStatus,
  listConsultationsForVisit,
  updateConsultation,
} from "../../consultations/api/consultations.api";
import type {
  Consultation,
  FinalizeConsultationPayload,
} from "../../consultations/api/consultations.api";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";
import { DiagnosesPanel } from "@/features/diagnoses/components/DiagnosesPanel";
import { PrescriptionsPanel } from "@/features/prescriptions/components/PrescriptionsPanel";

const statusStyles: Record<string, string> = {
  DRAFT: "bg-amber-50 text-amber-600 border-amber-100",
  IN_PROGRESS: "bg-primary-50 text-primary-600 border-primary-100",
  ACTIVE: "bg-primary-50 text-primary-600 border-primary-100",
  FINALIZED: "bg-emerald-50 text-emerald-600 border-emerald-100",
  COMPLETED: "bg-emerald-50 text-emerald-600 border-emerald-100",
  CANCELLED: "bg-rose-50 text-rose-600 border-rose-100",
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

function readStoredUserId(): number | null {
  try {
    const raw = localStorageService.get(storageKeys.user);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.id === "number" ? parsed.id : null;
  } catch {
    return null;
  }
}

type SoapForm = {
  subjective_note: string;
  objective_note: string;
  assessment_note: string;
  plan_note: string;
};

const emptySoap: SoapForm = {
  subjective_note: "",
  objective_note: "",
  assessment_note: "",
  plan_note: "",
};

function soapFromConsultation(c?: Consultation | null): SoapForm {
  if (!c) return emptySoap;
  return {
    subjective_note: c.subjective_note ?? "",
    objective_note: c.objective_note ?? "",
    assessment_note: c.assessment_note ?? "",
    plan_note: c.plan_note ?? "",
  };
}

export function ConsultationPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const visitIdNum = Number(visitId);
  const navigate = useNavigate();

  const [visit, setVisit] = useState<Visit | null>(null);
  const [latestVital, setLatestVital] = useState<VitalSign | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [sdps, setSdps] = useState<ServiceDeliveryPoint[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    { tone: "success" | "error"; message: string } | null
  >(null);

  const [soap, setSoap] = useState<SoapForm>(emptySoap);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Start consultation modal
  const [isStartOpen, setStartOpen] = useState(false);
  const [startForm, setStartForm] = useState<{
    clinician_staff_id: number | null;
    subjective_note: string;
    objective_note: string;
    assessment_note: string;
    plan_note: string;
  }>({
    clinician_staff_id: null,
    subjective_note: "",
    objective_note: "",
    assessment_note: "",
    plan_note: "",
  });
  const [startError, setStartError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Finalize modal
  const [isFinalizeOpen, setFinalizeOpen] = useState(false);
  const [finalizeForm, setFinalizeForm] = useState<{
    next_service_delivery_point_id: number | null;
    end_visit: boolean;
    closing_note: string;
  }>({
    next_service_delivery_point_id: null,
    end_visit: false,
    closing_note: "",
  });
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // ---------- Data loading ----------

  const loadAll = async () => {
    if (!visitId || Number.isNaN(visitIdNum)) {
      setError("Invalid visit identifier.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [visitData, consults, vital, staff, sdpData] = await Promise.all([
        getVisitDetails(visitIdNum),
        listConsultationsForVisit(visitIdNum).catch(() => null),
        getLatestVitalSignForVisit(visitIdNum).catch(() => null),
        getStaff(0, 200).catch(() => [] as Staff[]),
        listActiveServiceDeliveryPoints({ skip: 0, limit: 200 }).catch(() => null),
      ]);

      setVisit(visitData);
      setLatestVital(vital ?? null);
      setStaffList(Array.isArray(staff) ? staff : []);
      setSdps(sdpData?.items ?? []);

      const items = Array.isArray(consults?.items) ? consults!.items : [];
      const sorted = [...items].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setConsultations(sorted);

      const editable =
        sorted.find((c) => !isFinalConsultationStatus(c.status)) ?? sorted[0] ?? null;
      setActiveId(editable?.id ?? null);
      setSoap(soapFromConsultation(editable));
      setIsDirty(false);
    } catch (err: any) {
      console.error("Failed to load consultation context", err);
      setError(
        err?.response?.data?.message ||
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

  // Default the clinician staff selection in the Start modal to the staff
  // record matching the logged-in user (if any).
  useEffect(() => {
    if (startForm.clinician_staff_id != null) return;
    const userId = readStoredUserId();
    if (userId == null) return;
    const match = staffList.find((s) => s.user_id === userId);
    if (match) {
      setStartForm((prev) => ({ ...prev, clinician_staff_id: match.id }));
    }
  }, [staffList, startForm.clinician_staff_id]);

  // Auto-open the Start modal once a clinician arrives at a visit that has no
  // consultations yet — saves them a click coming from the queue or visit page.
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  useEffect(() => {
    if (hasAutoOpened) return;
    if (isLoading) return;
    if (consultations.length > 0) return;
    if (startForm.clinician_staff_id == null) return;
    setStartOpen(true);
    setHasAutoOpened(true);
  }, [
    hasAutoOpened,
    isLoading,
    consultations.length,
    startForm.clinician_staff_id,
  ]);

  const activeConsultation = useMemo(
    () => consultations.find((c) => c.id === activeId) ?? null,
    [consultations, activeId],
  );

  const isReadOnly = useMemo(
    () => !activeConsultation || isFinalConsultationStatus(activeConsultation.status),
    [activeConsultation],
  );

  const currentSdp = visit?.current_service_delivery_point ?? visit?.first_service_delivery_point;

  const showFeedback = (tone: "success" | "error", message: string) => {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 3500);
  };

  const replaceConsultationInList = (updated: Consultation) => {
    setConsultations((prev) => {
      const others = prev.filter((c) => c.id !== updated.id);
      return [updated, ...others].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    });
  };

  const handleSelectConsultation = (id: number) => {
    if (isDirty) {
      if (!confirm("Discard unsaved changes?")) return;
    }
    setActiveId(id);
    const c = consultations.find((x) => x.id === id) ?? null;
    setSoap(soapFromConsultation(c));
    setIsDirty(false);
  };

  // ---------- Actions ----------

  const handleSaveDraft = async () => {
    if (!activeConsultation) return;
    setIsSaving(true);
    try {
      const result = await updateConsultation(activeConsultation.id, soap);
      replaceConsultationInList(result.consultation);
      setSoap(soapFromConsultation(result.consultation));
      setIsDirty(false);
      showFeedback("success", result.message || "Consultation notes saved.");
    } catch (err: any) {
      showFeedback("error", err?.response?.data?.message || "Failed to save notes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartConsultation = async () => {
    if (!visit) return;
    if (!startForm.clinician_staff_id) {
      setStartError("Pick the clinician for this consultation.");
      return;
    }
    setIsStarting(true);
    setStartError(null);
    try {
      const result = await createConsultation({
        visit_id: visit.id,
        clinician_staff_id: startForm.clinician_staff_id,
        subjective_note: startForm.subjective_note || undefined,
        objective_note: startForm.objective_note || undefined,
        assessment_note: startForm.assessment_note || undefined,
        plan_note: startForm.plan_note || undefined,
      });
      replaceConsultationInList(result.consultation);
      setActiveId(result.consultation.id);
      setSoap(soapFromConsultation(result.consultation));
      setIsDirty(false);
      setStartOpen(false);
      setStartForm({
        clinician_staff_id: startForm.clinician_staff_id, // remember clinician
        subjective_note: "",
        objective_note: "",
        assessment_note: "",
        plan_note: "",
      });
      showFeedback("success", result.message || "Consultation started.");
    } catch (err: any) {
      setStartError(err?.response?.data?.message || "Failed to start consultation.");
    } finally {
      setIsStarting(false);
    }
  };

  const handleFinalize = async () => {
    if (!activeConsultation) return;
    if (isDirty) {
      if (
        !confirm(
          "You have unsaved notes. Save them before finalizing? (Press OK to save, Cancel to abort.)",
        )
      )
        return;
      await handleSaveDraft();
    }
    setIsFinalizing(true);
    setFinalizeError(null);
    try {
      const payload: FinalizeConsultationPayload = {
        next_service_delivery_point_id:
          finalizeForm.next_service_delivery_point_id ?? undefined,
        end_visit: finalizeForm.end_visit,
        closing_note: finalizeForm.closing_note || undefined,
      };
      const result = await finalizeConsultation(activeConsultation.id, payload);
      replaceConsultationInList(result.consultation);
      setSoap(soapFromConsultation(result.consultation));
      setIsDirty(false);
      setFinalizeOpen(false);
      showFeedback("success", result.message || "Consultation finalized.");
      // If end_visit was selected, return to visits list
      if (finalizeForm.end_visit) {
        window.setTimeout(() => navigate(routes.visits), 800);
      }
    } catch (err: any) {
      setFinalizeError(err?.response?.data?.message || "Failed to finalize consultation.");
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleCancel = async () => {
    if (!activeConsultation) return;
    if (
      !confirm(
        `Cancel consultation #${activeConsultation.id}? This cannot be undone.`,
      )
    )
      return;
    setIsCancelling(true);
    try {
      const result = await cancelConsultation(activeConsultation.id);
      replaceConsultationInList(result.consultation);
      setSoap(soapFromConsultation(result.consultation));
      setIsDirty(false);
      showFeedback("success", result.message || "Consultation cancelled.");
    } catch (err: any) {
      showFeedback("error", err?.response?.data?.message || "Failed to cancel consultation.");
    } finally {
      setIsCancelling(false);
    }
  };

  // ---------- Render guards ----------

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="h-16 w-16 border-4 border-primary-500 border-t-transparent rounded-[2rem] animate-spin shadow-2xl shadow-primary-500/20" />
        <p className="text-sm font-black text-secondary-400 uppercase tracking-[0.3em] animate-pulse">
          Preparing Consultation Workspace...
        </p>
      </div>
    );
  }

  if (error || !visit) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-8 animate-fade-in">
        <div className="h-24 w-24 bg-rose-50 rounded-[2.5rem] flex items-center justify-center mx-auto">
          <AlertCircle className="h-12 w-12 text-rose-500" />
        </div>
        <div>
          <h3 className="text-3xl font-black text-secondary-900 tracking-tight">
            Visit Not Resolved
          </h3>
          <p className="text-secondary-500 mt-4 leading-relaxed max-w-md mx-auto">
            {error ?? "We couldn't locate this visit in the registry."}
          </p>
        </div>
        <button onClick={() => navigate(routes.visits)} className="btn-secondary px-8 py-4">
          Return to Visits
        </button>
      </div>
    );
  }

  const visitStatusKey = (visit.status || "ACTIVE").toUpperCase();
  const consultationStatusKey = (activeConsultation?.status || "").toUpperCase();

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <button
            onClick={() => navigate(`/visits/${visit.id}`)}
            className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-secondary-400 hover:text-secondary-700 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Visit
          </button>
          <PageHeader
            title="Clinical Consultation"
            description="Document the clinical encounter using the SOAP framework, then finalize and route."
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadAll}
            className="btn-secondary p-3 rounded-2xl bg-white/80 border-secondary-100 hover:rotate-180 transition-transform duration-500"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setStartError(null);
              setStartOpen(true);
            }}
            className="btn-primary gap-2 px-6 py-3 rounded-2xl shadow-lg shadow-primary-500/20"
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm font-bold">New Consultation</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`px-6 py-4 rounded-2xl border flex items-center gap-3 shadow-lg animate-fade-in ${
            feedback.tone === "success"
              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
              : "bg-rose-50 text-rose-700 border-rose-100"
          }`}
        >
          {feedback.tone === "success" ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <span className="text-sm font-bold">{feedback.message}</span>
        </div>
      )}

      {/* Patient mini-header */}
      <div className="glass-card rounded-[2rem] p-6 flex flex-wrap items-center justify-between gap-6 bg-secondary-900 text-white border-none shadow-premium">
        <div className="flex items-center gap-6">
          <div className="h-16 w-16 rounded-[1.5rem] bg-white/10 flex items-center justify-center border border-white/10">
            <User className="h-8 w-8 text-primary-400" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-bold font-display">
                {visit.patient
                  ? `${visit.patient.first_name} ${visit.patient.last_name}`
                  : `Patient #${visit.patient_id}`}
              </h2>
              <span className="px-3 py-1 rounded-full bg-primary-500 text-[10px] font-bold uppercase tracking-widest">
                {visitStatusKey}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-secondary-400 font-medium">
              {visit.patient?.hospital_number && (
                <>
                  <span className="font-mono">{visit.patient.hospital_number}</span>
                  <span>•</span>
                </>
              )}
              {visit.patient?.gender && (
                <>
                  <span className="uppercase">{visit.patient.gender}</span>
                  <span>•</span>
                </>
              )}
              <span className="font-mono">{visit.visit_code || `VISIT-${visit.id}`}</span>
              {currentSdp && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {currentSdp.name}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {latestVital && (
          <div className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
              Latest Vitals
            </p>
            <p className="text-sm font-bold mt-1 text-primary-400">
              {latestVital.systolic_bp != null && latestVital.diastolic_bp != null
                ? `${latestVital.systolic_bp}/${latestVital.diastolic_bp} mmHg`
                : null}
              {latestVital.temperature_celsius != null
                ? ` • ${latestVital.temperature_celsius}°C`
                : null}
              {latestVital.oxygen_saturation != null
                ? ` • ${latestVital.oxygen_saturation}% SpO₂`
                : null}
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* LEFT: History */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-card rounded-[2rem] p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-black flex items-center gap-2">
                <History className="h-4 w-4 text-secondary-500" />
                <span>Consultation History</span>
              </h3>
              <span className="px-2.5 py-1 rounded-lg bg-secondary-100 text-secondary-600 text-[9px] font-bold uppercase tracking-widest">
                {consultations.length}
              </span>
            </div>

            {consultations.length === 0 ? (
              <div className="py-10 text-center">
                <FileText className="h-10 w-10 mx-auto text-secondary-300 mb-3" />
                <p className="text-xs text-secondary-500 font-bold">
                  No consultations recorded for this visit yet.
                </p>
                <button
                  onClick={() => setStartOpen(true)}
                  className="btn-primary mt-5 gap-2 px-5 py-2 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Start First Consultation</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {consultations.map((c) => {
                  const statusKey = (c.status || "DRAFT").toUpperCase();
                  const statusClass = statusStyles[statusKey] ?? statusStyles.DRAFT;
                  const isActive = c.id === activeId;
                  const clinician = staffList.find((s) => s.id === c.clinician_staff_id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleSelectConsultation(c.id)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all ${
                        isActive
                          ? "bg-primary-50 border-primary-200 shadow-md"
                          : "bg-white border-secondary-100 hover:border-primary-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono font-bold text-secondary-400 uppercase">
                          #{c.id}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border ${statusClass}`}
                        >
                          {statusKey}
                        </span>
                      </div>
                      <p className="text-xs font-black text-secondary-900 truncate">
                        {clinician
                          ? `Dr. ${staffDisplayName(clinician)}`
                          : `Clinician #${c.clinician_staff_id}`}
                      </p>
                      <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mt-1 flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(c.created_at)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Allergy / alert panel — informational only */}
          <div className="glass-card rounded-[2rem] p-6 bg-rose-50 border-rose-100 space-y-3">
            <div className="flex items-center gap-3 text-rose-600">
              <ShieldAlert className="h-5 w-5" />
              <h4 className="font-bold text-sm">Clinical Alerts</h4>
            </div>
            <p className="text-xs text-rose-700/80 font-medium">
              Patient allergies, alerts, and chronic flags will appear here once captured by the
              triage workflow.
            </p>
          </div>
        </div>

        {/* RIGHT: SOAP Editor + Diagnoses */}
        <div className="lg:col-span-8 space-y-8">
          {!activeConsultation ? (
            <div className="glass-card rounded-[2.5rem] p-16 text-center">
              <div className="h-16 w-16 mx-auto bg-secondary-50 rounded-3xl flex items-center justify-center mb-4">
                <Stethoscope className="h-8 w-8 text-secondary-300" />
              </div>
              <h4 className="text-lg font-bold text-secondary-900">No Active Consultation</h4>
              <p className="text-sm text-secondary-500 mt-2 max-w-md mx-auto">
                Start a new consultation to begin documenting the clinical encounter using the
                SOAP framework.
              </p>
              <button
                onClick={() => setStartOpen(true)}
                className="btn-primary mt-6 gap-2 px-6 py-3"
              >
                <Plus className="h-4 w-4" />
                <span>Start Consultation</span>
              </button>
            </div>
          ) : (
            <div className="glass-card rounded-[2.5rem] p-10 md:p-12 space-y-8">
              <div className="flex items-center justify-between border-b border-secondary-100 pb-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                    <Stethoscope className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black font-display tracking-tight">
                      Consultation #{activeConsultation.id}
                    </h3>
                    <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.25em] mt-0.5 flex items-center gap-2">
                      <Activity className="h-3 w-3" />
                      Started {formatDateTime(activeConsultation.consultation_started_at || activeConsultation.created_at)}
                      {isDirty && !isReadOnly && (
                        <span className="text-amber-600">• Unsaved Changes</span>
                      )}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest ${
                    statusStyles[consultationStatusKey] ?? statusStyles.DRAFT
                  }`}
                >
                  {consultationStatusKey || "DRAFT"}
                </span>
              </div>

              {isReadOnly && (
                <div className="p-4 rounded-2xl bg-secondary-50 border border-secondary-100 text-secondary-600 text-xs font-bold flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4" />
                  This consultation is{" "}
                  {consultationStatusKey === "CANCELLED" ? "cancelled" : "finalized"} and is now
                  read-only.
                </div>
              )}

              <SoapField
                label="Subjective"
                hint="Patient's description of the complaint, history, symptoms"
                value={soap.subjective_note}
                onChange={(v) => {
                  setSoap({ ...soap, subjective_note: v });
                  setIsDirty(true);
                }}
                disabled={isReadOnly}
              />
              <SoapField
                label="Objective"
                hint="Physical exam findings, vitals, observations"
                value={soap.objective_note}
                onChange={(v) => {
                  setSoap({ ...soap, objective_note: v });
                  setIsDirty(true);
                }}
                disabled={isReadOnly}
              />
              <SoapField
                label="Assessment"
                hint="Clinical impression, working diagnosis, differentials"
                value={soap.assessment_note}
                onChange={(v) => {
                  setSoap({ ...soap, assessment_note: v });
                  setIsDirty(true);
                }}
                disabled={isReadOnly}
              />
              <SoapField
                label="Plan"
                hint="Investigations, prescriptions, follow-up, patient education"
                value={soap.plan_note}
                onChange={(v) => {
                  setSoap({ ...soap, plan_note: v });
                  setIsDirty(true);
                }}
                disabled={isReadOnly}
              />

              {!isReadOnly && (
                <div className="flex flex-wrap items-center justify-between pt-6 border-t border-secondary-100 gap-3">
                  <button
                    onClick={handleCancel}
                    disabled={isCancelling}
                    className="btn-secondary gap-2 px-6 text-rose-600 border-rose-100 hover:bg-rose-50 disabled:opacity-50"
                  >
                    <Ban className="h-4 w-4" />
                    {isCancelling ? "Cancelling..." : "Cancel Consultation"}
                  </button>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleSaveDraft}
                      disabled={isSaving || !isDirty}
                      className="btn-secondary gap-2 px-6 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {isSaving ? "Saving..." : "Save Draft"}
                    </button>
                    <button
                      onClick={() => {
                        setFinalizeError(null);
                        setFinalizeForm({
                          next_service_delivery_point_id: null,
                          end_visit: false,
                          closing_note: "",
                        });
                        setFinalizeOpen(true);
                      }}
                      className="btn-primary gap-2 px-8 shadow-lg shadow-primary-500/20"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Finalize
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Diagnoses panel — always visible so historical impressions show
              even before a consultation is started. Add/Edit is gated by
              having an active, non-finalized consultation. */}
          <DiagnosesPanel
            visitId={visit.id}
            consultationId={activeConsultation?.id ?? null}
            disabled={isReadOnly}
          />

          {/* Prescriptions panel — same pattern: always visible, gated by an
              active non-finalized consultation. */}
          <PrescriptionsPanel
            visitId={visit.id}
            consultationId={activeConsultation?.id ?? null}
            disabled={isReadOnly}
          />
        </div>
      </div>

      {/* Start Consultation Modal */}
      {isStartOpen && (
        <Modal title="Start Consultation" subtitle="Open A New Clinical Encounter" onClose={() => setStartOpen(false)}>
          {startError && (
            <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-bold">{startError}</span>
            </div>
          )}
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                Clinician *
              </label>
              <select
                value={startForm.clinician_staff_id ?? ""}
                onChange={(e) =>
                  setStartForm({
                    ...startForm,
                    clinician_staff_id: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="input-field h-12 bg-secondary-50 border-secondary-100 w-full"
              >
                <option value="">Select clinician...</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    Dr. {staffDisplayName(s)}
                    {s.designation ? ` · ${s.designation}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <details className="rounded-2xl border border-secondary-100 bg-secondary-50/50">
              <summary className="cursor-pointer p-4 text-[10px] font-bold uppercase tracking-widest text-secondary-500 hover:text-secondary-700">
                Optional: Pre-fill SOAP notes
              </summary>
              <div className="p-4 pt-0 space-y-4">
                <SoapField
                  label="Subjective"
                  hint="Symptoms, history"
                  value={startForm.subjective_note}
                  onChange={(v) => setStartForm({ ...startForm, subjective_note: v })}
                  compact
                />
                <SoapField
                  label="Objective"
                  hint="Findings"
                  value={startForm.objective_note}
                  onChange={(v) => setStartForm({ ...startForm, objective_note: v })}
                  compact
                />
                <SoapField
                  label="Assessment"
                  hint="Working diagnosis"
                  value={startForm.assessment_note}
                  onChange={(v) => setStartForm({ ...startForm, assessment_note: v })}
                  compact
                />
                <SoapField
                  label="Plan"
                  hint="Initial plan"
                  value={startForm.plan_note}
                  onChange={(v) => setStartForm({ ...startForm, plan_note: v })}
                  compact
                />
              </div>
            </details>
          </div>
          <div className="pt-6 flex gap-4">
            <button
              onClick={() => setStartOpen(false)}
              disabled={isStarting}
              className="flex-1 btn-secondary py-4 rounded-2xl font-bold"
            >
              Cancel
            </button>
            <button
              onClick={handleStartConsultation}
              disabled={isStarting}
              className="flex-[2] btn-primary py-4 rounded-2xl font-black tracking-tight shadow-xl shadow-primary-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <Stethoscope className="h-4 w-4" />
              {isStarting ? "Starting..." : "Start Consultation"}
            </button>
          </div>
        </Modal>
      )}

      {/* Finalize Modal */}
      {isFinalizeOpen && activeConsultation && (
        <Modal
          title="Finalize Consultation"
          subtitle="Close The Encounter And Route Or End The Visit"
          onClose={() => setFinalizeOpen(false)}
        >
          {finalizeError && (
            <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-bold">{finalizeError}</span>
            </div>
          )}
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500 flex items-center gap-2">
                <Building2 className="h-3 w-3" />
                Next Service Point (Optional)
              </label>
              <select
                value={finalizeForm.next_service_delivery_point_id ?? ""}
                onChange={(e) =>
                  setFinalizeForm({
                    ...finalizeForm,
                    next_service_delivery_point_id: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                disabled={finalizeForm.end_visit}
                className="input-field h-12 bg-secondary-50 border-secondary-100 w-full disabled:opacity-50"
              >
                <option value="">No routing — keep at current SDP</option>
                {sdps
                  .filter((s) => s.id !== currentSdp?.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() =>
                setFinalizeForm({ ...finalizeForm, end_visit: !finalizeForm.end_visit })
              }
              className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                finalizeForm.end_visit
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-secondary-50 border-secondary-100 text-secondary-500"
              }`}
            >
              <div className="text-left">
                <p className="text-xs font-bold uppercase tracking-widest">End Visit</p>
                <p className="text-[10px] font-bold opacity-70 mt-0.5">
                  Mark the entire visit complete after finalizing
                </p>
              </div>
              <div
                className={`h-6 w-12 rounded-full p-0.5 transition-all ${
                  finalizeForm.end_visit ? "bg-emerald-500" : "bg-secondary-200"
                }`}
              >
                <div
                  className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    finalizeForm.end_visit ? "translate-x-6" : ""
                  }`}
                />
              </div>
            </button>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500 flex items-center gap-2">
                <ClipboardList className="h-3 w-3" />
                Closing Note (Optional)
              </label>
              <textarea
                value={finalizeForm.closing_note}
                onChange={(e) =>
                  setFinalizeForm({ ...finalizeForm, closing_note: e.target.value })
                }
                placeholder="Summary, hand-off note, or instructions for the next care team..."
                className="input-field h-28 bg-secondary-50 border-secondary-100 w-full resize-none py-3"
              />
            </div>
          </div>
          <div className="pt-6 flex gap-4">
            <button
              onClick={() => setFinalizeOpen(false)}
              disabled={isFinalizing}
              className="flex-1 btn-secondary py-4 rounded-2xl font-bold"
            >
              Cancel
            </button>
            <button
              onClick={handleFinalize}
              disabled={isFinalizing}
              className="flex-[2] btn-primary py-4 rounded-2xl font-black tracking-tight bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isFinalizing ? "Finalizing..." : "Finalize Consultation"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------- Reusable subcomponents ----------

type SoapFieldProps = {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
};

function SoapField({ label, hint, value, onChange, disabled, compact }: SoapFieldProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-black uppercase tracking-[0.2em] text-secondary-700">
          {label}
        </label>
        <span className="text-[10px] font-bold text-secondary-400">{hint}</span>
      </div>
      <textarea
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`${label} note...`}
        className={`input-field ${
          compact ? "h-20" : "h-32"
        } pt-3 px-4 resize-none disabled:opacity-70 disabled:cursor-not-allowed`}
      />
    </div>
  );
}

type ModalProps = {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
};

function Modal({ title, subtitle, onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6 animate-fade-in">
      <div className="bg-white rounded-[2.5rem] p-10 max-w-2xl w-full shadow-2xl relative animate-slide-up max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-3 hover:bg-secondary-50 rounded-2xl transition-all"
        >
          <X className="h-5 w-5 text-secondary-400" />
        </button>
        <div className="flex items-center gap-5 mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center shadow-xl shadow-primary-500/20">
            <Stethoscope className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-black font-display tracking-tight">{title}</h3>
            <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
              {subtitle}
            </p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
