import { useEffect, useState } from "react";
import { Patient360Panel } from "@/features/clinical/components/Patient360Panel";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
  FileText,
  ClipboardList,
  Plus,
  History,
  TrendingUp,
  HeartPulse,
  Stethoscope,
  FlaskConical,
} from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxKpi, DxBadge, DxButton, DxMessage, DxPageLoading,
} from "@/components/dx";
import { getPatientById } from "../api/patients.api";
import type { Patient } from "../api/patients.api";
import { getVisits } from "@/features/visits/api/visits.api";
import type { Visit } from "@/features/visits/api/visits.api";
import { adherenceApi } from "@/features/medication-adherence/api/adherence.api";
import { routes } from "@/config/routes";
import { BaselineProfileCard } from "../components/BaselineProfileCard";
import { DiagnosticResultsPanel } from "../components/DiagnosticResultsPanel";

export function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [recentVisits, setRecentVisits] = useState<Visit[]>([]);
  const [totalEncounters, setTotalEncounters] = useState<number | null>(null);
  const [adherencePct, setAdherencePct] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) return;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const id = Number(patientId);
        const [patientData, visitsResponse] = await Promise.all([
          getPatientById(id),
          getVisits({ patient_id: id, limit: 10 }),
        ]);

        setPatient(patientData);

        const allVisits = visitsResponse.items || [];
        const active = allVisits.find((v) => v.status === "ACTIVE" || v.status === "IN_PROGRESS" || v.status === "WAITING");
        setActiveVisit(active || null);
        setRecentVisits(allVisits.filter((v) => v.id !== active?.id));
        setTotalEncounters(visitsResponse.meta?.total ?? visitsResponse.count ?? allVisits.length);

        // Adherence is non-critical — fetch it separately so a failure
        // doesn't break the clinical view.
        try {
          const snapshots = await adherenceApi.listSnapshots({ patient_id: id });
          const latest = snapshots.items[0];
          setAdherencePct(latest ? Math.round(Number(latest.adherence_pct || 0)) : null);
        } catch {
          setAdherencePct(null);
        }
      } catch (err: any) {
        console.error("Failed to load patient dashboard", err);
        setError("Unable to retrieve patient clinical records.");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [patientId]);

  if (isLoading) return <DxPageLoading label="Loading clinical data…" />;

  if (error || !patient) {
    return (
      <DxPage>
        <DxPanel title="Patient record">
          <div className="py-12 text-center">
            <DxMessage tone="danger" className="mx-auto max-w-md text-left">{error || "Patient not found."}</DxMessage>
            <DxButton className="mx-auto mt-4" variant="primary" onClick={() => navigate(routes.patients)}>Return to registry</DxButton>
          </div>
        </DxPanel>
      </DxPage>
    );
  }

  const age = patient.date_of_birth ? `${new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()} years` : "Age N/A";
  const patientClass =
    patient.patient_class === "HMO" ? "HMO / Insurance" : patient.patient_class === "RETAINERSHIP" ? "Retainership" : "Normal (self-pay)";

  const modules: { label: string; icon: typeof HeartPulse; color: string }[] = [
    { label: "Triage", icon: HeartPulse, color: "var(--dx-danger)" },
    { label: "Notes", icon: FileText, color: "var(--dx-accent)" },
    { label: "Laboratory", icon: FlaskConical, color: "var(--dx-warning)" },
    { label: "Prescriptions", icon: Stethoscope, color: "var(--dx-success)" },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Patients", to: routes.patients }, { label: `${patient.first_name} ${patient.last_name}` }]}
        title={
          <span className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--dx-accent)] text-[15px] font-bold text-white">
              {patient.first_name?.[0]}{patient.last_name?.[0]}
            </span>
            <span>{patient.first_name} {patient.last_name}</span>
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="dx-mono rounded bg-[var(--dx-surface-sunken)] px-2 py-0.5 text-[11px] font-semibold text-[var(--dx-text)]">{patient.hospital_number}</span>
            <span>{patient.gender} · {age}</span>
          </span>
        }
        actions={
          <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} disabled={!!activeVisit}
            onClick={() => navigate(routes.visitInitiate, { state: { patient } })}>
            Initiate visit
          </DxButton>
        }
      />

      {/* Clinical overview: chronic problems, progress analytics, baseline & history */}
      <Patient360Panel patientId={patient.id} />

      {/* Active visit banner */}
      {activeVisit ? (
        <div className="flex flex-col items-start justify-between gap-4 rounded-lg border border-[var(--dx-success)] bg-[var(--dx-success-soft)] p-5 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--dx-success)] text-white"><Activity className="h-6 w-6" /></div>
            <div>
              <div className="flex items-center gap-2">
                <span className="dx-live-dot" aria-hidden />
                <h3 className="text-[16px] font-bold text-[var(--dx-text)]">Active encounter</h3>
              </div>
              <p className="mt-0.5 text-[13px] text-[var(--dx-text-muted)]">Currently at <span className="font-semibold text-[var(--dx-text)]">{activeVisit.current_service_delivery_point?.name || "Reception"}</span>.</p>
            </div>
          </div>
          <div className="flex w-full items-center gap-3 lg:w-auto">
            <div className="rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface)] px-4 py-2 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">Visit code</p>
              <p className="dx-mono text-[13px] font-bold text-[var(--dx-text)]">{activeVisit.visit_code}</p>
            </div>
            <Link to={routes.visitDetail.replace(":visitId", String(activeVisit.id))} className="dx-btn dx-btn-primary">
              Access lifecycle <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left: identity & baseline */}
        <div className="space-y-4 lg:col-span-4">
          <BaselineProfileCard patientId={patient.id} />
          <DiagnosticResultsPanel patientId={patient.id} />

          <DxPanel title="Identity context" icon={<ShieldCheck className="h-4 w-4" />}>
            <div className="space-y-4">
              <div className="space-y-3">
                {[
                  { icon: Phone, label: "Mobile", value: patient.phone_number },
                  { icon: Mail, label: "Email", value: patient.email || "None provided" },
                  { icon: MapPin, label: "Residence", value: `${patient.address ?? ""}${patient.city ? `, ${patient.city}` : ""}` || "—" },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--dx-surface-sunken)] text-[var(--dx-text-muted)]"><Icon className="h-4 w-4" /></div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">{label}</p>
                      <p className="truncate text-[13px] font-medium text-[var(--dx-text)]">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-[var(--dx-border)] pt-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">Financial classification</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Patient class", value: patientClass },
                    { label: "Payer group", value: patient.payer_type },
                    { label: "Account type", value: patient.patient_type },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] p-2.5">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">{label}</p>
                      <p className="mt-0.5 text-[11px] font-semibold uppercase text-[var(--dx-text)]">{value || "—"}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DxPanel>

          <div className="grid grid-cols-2 gap-3">
            <DxKpi label="Total encounters" value={totalEncounters ?? "—"} icon={TrendingUp} tone="accent" />
            <DxKpi label="Adherence score" value={adherencePct === null ? "—" : `${adherencePct}%`} icon={HeartPulse} tone="success" />
          </div>
        </div>

        {/* Right: actions & history */}
        <div className="space-y-4 lg:col-span-8">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {modules.map((mod) => (
              <button key={mod.label} className="flex flex-col items-center gap-2 rounded-lg border border-[var(--dx-border)] bg-[var(--dx-surface)] p-5 transition-colors hover:border-[var(--dx-border-strong)]">
                <mod.icon className="h-6 w-6" style={{ color: mod.color }} />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text)]">{mod.label}</span>
              </button>
            ))}
          </div>

          <DxPanel
            title="Encounter history"
            icon={<History className="h-4 w-4" />}
            description="Clinical timeline"
            actions={
              <Link to={`${routes.visits}?patient_id=${patient.id}`} className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--dx-accent)] hover:underline">
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            }
          >
            <div className="space-y-2.5">
              {recentVisits.length > 0 ? (
                recentVisits.map((visit) => (
                  <div key={visit.id} className="flex items-center justify-between rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface)] p-3 transition-colors hover:border-[var(--dx-border-strong)]">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 flex-col items-center justify-center rounded-md bg-[var(--dx-surface-sunken)] text-[var(--dx-text-muted)]">
                        <span className="text-[13px] font-bold leading-none text-[var(--dx-text)]">{new Date(visit.visit_date).getDate()}</span>
                        <span className="mt-0.5 text-[8px] font-semibold uppercase">{new Date(visit.visit_date).toLocaleString("default", { month: "short" })}</span>
                      </div>
                      <div>
                        <p className="dx-mono text-[13px] font-semibold text-[var(--dx-text)]">#{visit.visit_code}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <DxBadge tone="neutral">{visit.status}</DxBadge>
                          <DxBadge tone="info">{visit.priority}</DxBadge>
                        </div>
                      </div>
                    </div>
                    <Link to={routes.visitDetail.replace(":visitId", String(visit.id))} className="dx-btn dx-btn-icon dx-btn-sm" title="Open visit">
                      <ArrowRight />
                    </Link>
                  </div>
                ))
              ) : (
                <div className="py-16 text-center">
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--dx-surface-sunken)]"><ClipboardList className="h-8 w-8 text-[var(--dx-text-faint)]" /></div>
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">No historical records</p>
                </div>
              )}
            </div>
          </DxPanel>
        </div>
      </div>
    </DxPage>
  );
}
