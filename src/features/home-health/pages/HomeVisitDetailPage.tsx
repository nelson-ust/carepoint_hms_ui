import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import { ArrowLeft, MapPin, Navigation, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { routes } from "@/config/routes";
import { StaffPicker } from "../components/StaffPicker";
import { HomeOrdersSection } from "../components/HomeOrdersSection";
import {
  homeVisitsApi,
  homeVisitStatusVariant,
  labelize,
  nextStatuses,
  type HomeVisitNotePayload,
  type HomeVisitStatus,
} from "../api/home-health.api";

function fmt(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return isValid(d) ? format(d, "MMM d, yyyy • h:mm a") : "—";
}

function getPosition(): Promise<{ lat?: number; lng?: number }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({}),
      { timeout: 4000 },
    );
  });
}

export function HomeVisitDetailPage() {
  const { visitId } = useParams();
  const id = Number(visitId);
  const toast = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const visitQuery = useQuery({ queryKey: ["home-visit", id], queryFn: () => homeVisitsApi.get(id), enabled: Number.isFinite(id) });
  const eventsQuery = useQuery({ queryKey: ["home-visit", id, "events"], queryFn: () => homeVisitsApi.events(id), enabled: Number.isFinite(id) });

  const [assignStaffId, setAssignStaffId] = useState<number | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["home-visit", id] });
    qc.invalidateQueries({ queryKey: ["home-visits", "list"] });
  };

  const assignMut = useMutation({
    mutationFn: () => homeVisitsApi.assign(id, { assigned_staff_id: assignStaffId! }),
    onSuccess: () => { toast.success("Caregiver assigned"); invalidate(); },
    onError: (e) => toast.error("Couldn't assign", apiErrorMessage(e, "Try again.")),
  });

  const statusMut = useMutation({
    mutationFn: async (status: HomeVisitStatus) => {
      const geo = status === "EN_ROUTE" || status === "ARRIVED" ? await getPosition() : {};
      return homeVisitsApi.changeStatus(id, { status, latitude: geo.lat, longitude: geo.lng });
    },
    onSuccess: (_d, status) => { toast.success(`Visit set to ${labelize(status)}`); invalidate(); },
    onError: (e) => toast.error("Couldn't update status", apiErrorMessage(e, "Transition not allowed.")),
  });

  const cancelMut = useMutation({
    mutationFn: (reason: string) => homeVisitsApi.cancel(id, reason),
    onSuccess: () => { toast.success("Visit cancelled"); invalidate(); },
    onError: (e) => toast.error("Couldn't cancel", apiErrorMessage(e, "Try again.")),
  });

  if (visitQuery.isLoading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (visitQuery.isError || !visitQuery.data)
    return <Card className="text-center text-secondary-500">Couldn't load this home visit.</Card>;

  const v = visitQuery.data;
  const transitions = nextStatuses(String(v.status));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <button onClick={() => navigate(routes.homeVisits)} className="mb-2 inline-flex items-center gap-1 text-sm text-secondary-500 hover:text-secondary-700">
            <ArrowLeft className="h-4 w-4" /> Home visits
          </button>
        }
        title={v.visit_code}
        description={`${labelize(v.visit_type)} • ${v.patient_name || `Patient #${v.patient_id}`}`}
        actions={<Badge variant={homeVisitStatusVariant(v.status)}>{labelize(v.status)}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-secondary-500">Visit details</h3>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Detail label="Patient" value={v.patient_name || `#${v.patient_id}`} />
            <Detail label="Priority" value={labelize(v.priority)} />
            <Detail label="Scheduled" value={fmt(v.scheduled_start_at)} />
            <Detail label="ETA" value={v.eta_minutes != null ? `${v.eta_minutes} min` : "—"} />
            <Detail label="Caregiver" value={v.assigned_staff_name || "Unassigned"} />
            <Detail label="Reason" value={v.reason || "—"} />
            <Detail label="Address" value={[v.address, v.city, v.state].filter(Boolean).join(", ") || "—"} />
            <Detail label="Location" value={v.latitude && v.longitude ? `${v.latitude}, ${v.longitude}` : "—"} />
          </dl>
          <div className="grid grid-cols-2 gap-4 border-t border-secondary-100 pt-4 text-sm dark:border-white/5">
            <Detail label="En route" value={fmt(v.en_route_at)} />
            <Detail label="Arrived" value={fmt(v.arrived_at)} />
            <Detail label="Started" value={fmt(v.started_at)} />
            <Detail label="Completed" value={fmt(v.completed_at)} />
          </div>
        </Card>

        <Card className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-secondary-500">Actions</h3>

          <div className="space-y-2">
            <StaffPicker label="Assign caregiver" value={assignStaffId} onChange={(sid) => setAssignStaffId(sid)} includeBlank={false} />
            <Button size="sm" variant="secondary" disabled={!assignStaffId || assignMut.isPending} onClick={() => assignMut.mutate()}>
              Assign
            </Button>
          </div>

          {transitions.length > 0 && (
            <div className="space-y-2 border-t border-secondary-100 pt-4 dark:border-white/5">
              <div className="text-xs font-bold uppercase tracking-widest text-secondary-500">Advance status</div>
              <div className="flex flex-wrap gap-2">
                {transitions.filter((t) => t !== "CANCELLED").map((t) => (
                  <Button key={t} size="sm" variant={t === "MISSED" ? "danger" : "primary"} disabled={statusMut.isPending}
                    onClick={() => statusMut.mutate(t)}>
                    {(t === "EN_ROUTE" || t === "ARRIVED") && <Navigation className="h-3.5 w-3.5" />}
                    {labelize(t)}
                  </Button>
                ))}
              </div>
              {transitions.includes("CANCELLED") && (
                <Button size="sm" variant="ghost" disabled={cancelMut.isPending}
                  onClick={() => { const r = window.prompt("Reason for cancellation?") ?? undefined; if (r !== undefined) cancelMut.mutate(r); }}>
                  Cancel visit
                </Button>
              )}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-secondary-500">
            <MapPin className="h-4 w-4" /> Timeline
          </h3>
          {eventsQuery.data && eventsQuery.data.length > 0 ? (
            <ol className="space-y-3">
              {eventsQuery.data.map((ev) => (
                <li key={ev.id} className="border-l-2 border-primary-400 pl-3">
                  <div className="text-sm font-semibold text-secondary-800 dark:text-secondary-100">{labelize(ev.to_status)}</div>
                  <div className="text-xs text-secondary-500">{fmt(ev.occurred_at)}</div>
                  {ev.note && <div className="text-xs text-secondary-500">{ev.note}</div>}
                  {ev.latitude != null && ev.longitude != null && (
                    <div className="text-xs text-secondary-400">GPS {Number(ev.latitude).toFixed(4)}, {Number(ev.longitude).toFixed(4)}</div>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-secondary-400">No status changes yet.</p>
          )}
        </Card>

        <div className="lg:col-span-2">
          <DocumentationCard visitId={id} onSaved={invalidate} />
        </div>
      </div>

      <HomeOrdersSection
        patientId={v.patient_id}
        homeVisitId={id}
        carePlanId={v.care_plan_id}
        address={[v.address, v.city].filter(Boolean).join(", ")}
      />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-widest text-secondary-400">{label}</dt>
      <dd className="mt-0.5 text-secondary-800 dark:text-secondary-100">{value}</dd>
    </div>
  );
}

const NUM = (v: string) => (v === "" ? undefined : Number(v));

function DocumentationCard({ visitId, onSaved }: { visitId: number; onSaved: () => void }) {
  const toast = useToast();
  const noteQuery = useQuery({ queryKey: ["home-visit", visitId, "note"], queryFn: () => homeVisitsApi.getNote(visitId) });

  const [form, setForm] = useState<Record<string, string>>({});
  const set = (k: string, val: string) => setForm((f) => ({ ...f, [k]: val }));

  useEffect(() => {
    if (noteQuery.data) {
      const n = noteQuery.data;
      setForm({
        reason_for_visit: n.reason_for_visit ?? "",
        symptoms: n.symptoms ?? "",
        physical_assessment: n.physical_assessment ?? "",
        nursing_assessment: n.nursing_assessment ?? "",
        assessment_diagnosis: n.assessment_diagnosis ?? "",
        procedures_performed: n.procedures_performed ?? "",
        medication_administered: n.medication_administered ?? "",
        patient_education: n.patient_education ?? "",
        follow_up_notes: n.follow_up_notes ?? "",
        temperature_celsius: n.temperature_celsius?.toString() ?? "",
        pulse_rate: n.pulse_rate?.toString() ?? "",
        respiratory_rate: n.respiratory_rate?.toString() ?? "",
        systolic_bp: n.systolic_bp?.toString() ?? "",
        diastolic_bp: n.diastolic_bp?.toString() ?? "",
        oxygen_saturation: n.oxygen_saturation?.toString() ?? "",
        blood_glucose: n.blood_glucose?.toString() ?? "",
        weight_kg: n.weight_kg?.toString() ?? "",
        pain_score: n.pain_score?.toString() ?? "",
      });
    }
  }, [noteQuery.data]);

  const saveMut = useMutation({
    mutationFn: (payload: HomeVisitNotePayload) => homeVisitsApi.saveNote(visitId, payload),
    onSuccess: () => { toast.success("Documentation saved"); onSaved(); },
    onError: (e) => toast.error("Couldn't save documentation", apiErrorMessage(e, "Try again.")),
  });

  const save = () => {
    saveMut.mutate({
      reason_for_visit: form.reason_for_visit || undefined,
      symptoms: form.symptoms || undefined,
      physical_assessment: form.physical_assessment || undefined,
      nursing_assessment: form.nursing_assessment || undefined,
      assessment_diagnosis: form.assessment_diagnosis || undefined,
      procedures_performed: form.procedures_performed || undefined,
      medication_administered: form.medication_administered || undefined,
      patient_education: form.patient_education || undefined,
      follow_up_notes: form.follow_up_notes || undefined,
      temperature_celsius: NUM(form.temperature_celsius),
      pulse_rate: NUM(form.pulse_rate),
      respiratory_rate: NUM(form.respiratory_rate),
      systolic_bp: NUM(form.systolic_bp),
      diastolic_bp: NUM(form.diastolic_bp),
      oxygen_saturation: NUM(form.oxygen_saturation),
      blood_glucose: NUM(form.blood_glucose),
      weight_kg: NUM(form.weight_kg),
      pain_score: NUM(form.pain_score),
      record_vitals_as_readings: true,
    });
  };

  return (
    <Card className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-secondary-500">
        <ClipboardList className="h-4 w-4" /> Visit documentation
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <Textarea label="Reason for visit" rows={2} value={form.reason_for_visit ?? ""} onChange={(e) => set("reason_for_visit", e.target.value)} />
        <Textarea label="Symptoms" rows={2} value={form.symptoms ?? ""} onChange={(e) => set("symptoms", e.target.value)} />
        <Textarea label="Physical assessment" rows={2} value={form.physical_assessment ?? ""} onChange={(e) => set("physical_assessment", e.target.value)} />
        <Textarea label="Nursing assessment" rows={2} value={form.nursing_assessment ?? ""} onChange={(e) => set("nursing_assessment", e.target.value)} />
        <Textarea label="Assessment / diagnosis" rows={2} value={form.assessment_diagnosis ?? ""} onChange={(e) => set("assessment_diagnosis", e.target.value)} />
        <Textarea label="Procedures performed" rows={2} value={form.procedures_performed ?? ""} onChange={(e) => set("procedures_performed", e.target.value)} />
        <Textarea label="Medication administered" rows={2} value={form.medication_administered ?? ""} onChange={(e) => set("medication_administered", e.target.value)} />
        <Textarea label="Patient education" rows={2} value={form.patient_education ?? ""} onChange={(e) => set("patient_education", e.target.value)} />
      </div>

      <div className="border-t border-secondary-100 pt-4 dark:border-white/5">
        <div className="mb-3 text-xs font-bold uppercase tracking-widest text-secondary-500">Bedside vitals</div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Input label="Temp °C" type="number" value={form.temperature_celsius ?? ""} onChange={(e) => set("temperature_celsius", e.target.value)} />
          <Input label="Pulse" type="number" value={form.pulse_rate ?? ""} onChange={(e) => set("pulse_rate", e.target.value)} />
          <Input label="Resp" type="number" value={form.respiratory_rate ?? ""} onChange={(e) => set("respiratory_rate", e.target.value)} />
          <Input label="SpO₂ %" type="number" value={form.oxygen_saturation ?? ""} onChange={(e) => set("oxygen_saturation", e.target.value)} />
          <Input label="Systolic" type="number" value={form.systolic_bp ?? ""} onChange={(e) => set("systolic_bp", e.target.value)} />
          <Input label="Diastolic" type="number" value={form.diastolic_bp ?? ""} onChange={(e) => set("diastolic_bp", e.target.value)} />
          <Input label="Glucose" type="number" value={form.blood_glucose ?? ""} onChange={(e) => set("blood_glucose", e.target.value)} />
          <Input label="Weight kg" type="number" value={form.weight_kg ?? ""} onChange={(e) => set("weight_kg", e.target.value)} />
          <Input label="Pain /10" type="number" value={form.pain_score ?? ""} onChange={(e) => set("pain_score", e.target.value)} />
        </div>
        <p className="mt-2 text-xs text-secondary-400">Saved vitals are also stored as monitoring readings and screened by the early-warning engine.</p>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saveMut.isPending}>{saveMut.isPending ? "Saving…" : "Save documentation"}</Button>
      </div>
    </Card>
  );
}
