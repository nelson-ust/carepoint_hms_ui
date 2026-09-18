import { useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, CalendarPlus, ClipboardList, HeartPulse, HomeIcon, Plus, Target } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import {
  getPortalHomeHealthSummary, getPortalHomeVisits, getPortalCarePlan, getPortalHomeReadings,
  submitPortalReading, requestPortalVisit,
} from "../api/portal.api";

function fmt(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function labelize(v?: string | null) { return v ? v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—"; }

const READING_OPTS = [
  { value: "BLOOD_PRESSURE", label: "Blood pressure", unit: "mmHg" },
  { value: "BLOOD_GLUCOSE", label: "Blood glucose", unit: "mg/dL" },
  { value: "PULSE", label: "Pulse", unit: "bpm" },
  { value: "TEMPERATURE", label: "Temperature", unit: "°C" },
  { value: "OXYGEN_SATURATION", label: "Oxygen saturation", unit: "%" },
  { value: "WEIGHT", label: "Weight", unit: "kg" },
];

export function PortalHomeCarePage() {
  const [showReading, setShowReading] = useState(false);
  const [showRequest, setShowRequest] = useState(false);

  const summary = useQuery({ queryKey: ["portal-hh", "summary"], queryFn: getPortalHomeHealthSummary });
  const visits = useQuery({ queryKey: ["portal-hh", "visits"], queryFn: getPortalHomeVisits });
  const plan = useQuery({ queryKey: ["portal-hh", "plan"], queryFn: getPortalCarePlan });
  const readings = useQuery({ queryKey: ["portal-hh", "readings"], queryFn: () => getPortalHomeReadings() });

  const s = summary.data;
  const upcoming = (visits.data ?? []).filter((v) => !["COMPLETED", "CANCELLED", "MISSED"].includes(v.status));

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Home Care"
        description="Your home visits, care plan and health readings — all in one place."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowRequest(true)}><CalendarPlus className="h-4 w-4" /> Request a visit</Button>
            <Button size="sm" onClick={() => setShowReading(true)}><Plus className="h-4 w-4" /> Submit a reading</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile icon={<HomeIcon className="h-5 w-5" />} label="Upcoming visits" value={s?.upcoming_visit_count ?? 0} sub={s?.next_visit_at ? `Next: ${fmt(s.next_visit_at)}` : "None scheduled"} />
        <Tile icon={<ClipboardList className="h-5 w-5" />} label="Care plan" value={s?.has_active_care_plan ? "Active" : "—"} sub={s?.care_plan_title ?? ""} />
        <Tile icon={<Target className="h-5 w-5" />} label="Open tasks" value={s?.open_task_count ?? 0} sub="On your plan" />
        <Tile icon={<Activity className="h-5 w-5" />} label="Readings (7d)" value={s?.readings_last_7d ?? 0} sub="Submitted" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-secondary-500"><HomeIcon className="h-4 w-4" /> Upcoming visits</h3>
          {visits.isLoading ? <Skeleton className="h-16 w-full" /> :
            upcoming.length === 0 ? <EmptyState icon={HomeIcon} title="No upcoming visits" description="Request one anytime." /> :
            upcoming.map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-xl border border-secondary-100 p-3 dark:border-white/5">
                <div>
                  <div className="text-sm font-semibold text-secondary-800 dark:text-secondary-100">{labelize(v.visit_type)}</div>
                  <div className="text-xs text-secondary-500">{fmt(v.scheduled_start_at)}{v.assigned_staff_name ? ` · ${v.assigned_staff_name}` : ""}</div>
                </div>
                <Badge variant={v.status === "COMPLETED" ? "soft-success" : "soft-info"}>{labelize(v.status)}</Badge>
              </div>
            ))}
        </Card>

        <Card className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-secondary-500"><ClipboardList className="h-4 w-4" /> My care plan</h3>
          {plan.isLoading ? <Skeleton className="h-16 w-full" /> :
            !plan.data ? <EmptyState icon={ClipboardList} title="No active care plan" description="Your care team will set one up." /> :
            <div className="space-y-3">
              <div className="text-sm font-semibold text-secondary-800 dark:text-secondary-100">{plan.data.title}</div>
              {plan.data.goals?.length > 0 && (
                <div>
                  <div className="mb-1 text-xs font-bold uppercase tracking-widest text-secondary-400">Goals</div>
                  {plan.data.goals.map((g) => (
                    <div key={g.id} className="flex items-center justify-between text-sm">
                      <span className="text-secondary-700 dark:text-secondary-200">{g.description}</span>
                      <span className="text-xs text-secondary-500">{g.progress_percent ?? 0}%</span>
                    </div>
                  ))}
                </div>
              )}
              {plan.data.tasks?.length > 0 && (
                <div>
                  <div className="mb-1 text-xs font-bold uppercase tracking-widest text-secondary-400">Tasks</div>
                  {plan.data.tasks.map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-sm">
                      <span className="text-secondary-700 dark:text-secondary-200">{t.title}</span>
                      <Badge variant={t.status === "COMPLETED" ? "soft-success" : "secondary"}>{labelize(t.status)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>}
        </Card>
      </div>

      <Card className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-secondary-500"><HeartPulse className="h-4 w-4" /> Recent readings</h3>
        {readings.isLoading ? <Skeleton className="h-16 w-full" /> :
          (readings.data ?? []).length === 0 ? <EmptyState icon={Activity} title="No readings yet" description="Submit your first reading." /> :
          <div className="divide-y divide-secondary-100 dark:divide-white/5">
            {(readings.data ?? []).slice(0, 12).map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-secondary-700 dark:text-secondary-200">{labelize(r.reading_type)}</span>
                <span className="flex items-center gap-3">
                  <span className={r.is_abnormal ? "font-semibold text-rose-600" : "font-medium text-secondary-800 dark:text-secondary-100"}>
                    {r.reading_type === "BLOOD_PRESSURE" ? `${r.systolic}/${r.diastolic}` : r.primary_value} {r.unit}
                  </span>
                  <span className="text-xs text-secondary-400">{fmt(r.recorded_at)}</span>
                </span>
              </div>
            ))}
          </div>}
      </Card>

      {showReading && <SubmitReadingModal onClose={() => setShowReading(false)} />}
      {showRequest && <RequestVisitModal onClose={() => setShowRequest(false)} />}
    </div>
  );
}

function Tile({ icon, label, value, sub }: { icon: ReactNode; label: string; value: ReactNode; sub?: string }) {
  return (
    <Card className="space-y-1">
      <div className="flex items-center gap-2 text-secondary-400">{icon}<span className="text-xs font-bold uppercase tracking-widest">{label}</span></div>
      <div className="text-2xl font-bold text-secondary-900 dark:text-white">{value}</div>
      {sub ? <div className="text-xs text-secondary-500">{sub}</div> : null}
    </Card>
  );
}

function SubmitReadingModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [type, setType] = useState("BLOOD_PRESSURE");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const unit = READING_OPTS.find((o) => o.value === type)?.unit ?? "";
  const isBp = type === "BLOOD_PRESSURE";
  const mut = useMutation({
    mutationFn: () => submitPortalReading({ reading_type: type, unit, systolic: isBp ? Number(systolic) : undefined, diastolic: isBp ? Number(diastolic) : undefined, primary_value: !isBp && value ? Number(value) : undefined, notes: notes.trim() || undefined }),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ["portal-hh"] }); onClose(); res.flagged ? toast.success("Reading submitted", "Your care team has been notified.") : toast.success("Reading submitted"); },
    onError: (e) => toast.error("Couldn't submit", apiErrorMessage(e, "Check the values.")),
  });
  const submit = () => {
    if (isBp && (!systolic || !diastolic)) return toast.error("Enter both values", "Systolic and diastolic are required.");
    if (!isBp && !value) return toast.error("Enter a value", "");
    mut.mutate();
  };
  return (
    <Modal isOpen onClose={onClose} title="Submit a reading" footer={
      <div className="flex justify-end gap-3"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={mut.isPending} onClick={submit}>{mut.isPending ? "Submitting…" : "Submit"}</Button></div>}>
      <div className="space-y-4">
        <Select label="Measurement" value={type} onChange={(e) => setType(e.target.value)} options={READING_OPTS.map((o) => ({ value: o.value, label: `${o.label} (${o.unit})` }))} />
        {isBp ? (
          <div className="grid grid-cols-2 gap-4">
            <Input label="Systolic (mmHg)" type="number" value={systolic} onChange={(e) => setSystolic(e.target.value)} />
            <Input label="Diastolic (mmHg)" type="number" value={diastolic} onChange={(e) => setDiastolic(e.target.value)} />
          </div>
        ) : <Input label={`Value (${unit})`} type="number" value={value} onChange={(e) => setValue(e.target.value)} />}
        <Textarea label="Notes (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Modal>
  );
}

function RequestVisitModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [address, setAddress] = useState("");
  const mut = useMutation({
    mutationFn: () => requestPortalVisit({ reason: reason.trim(), preferred_date: date ? new Date(date).toISOString() : undefined, address: address.trim() || undefined }),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ["portal-hh"] }); onClose(); toast.success("Request received", res.message); },
    onError: (e) => toast.error("Couldn't submit request", apiErrorMessage(e, "Try again.")),
  });
  return (
    <Modal isOpen onClose={onClose} title="Request a home visit" footer={
      <div className="flex justify-end gap-3"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={reason.trim().length < 3 || mut.isPending} onClick={() => mut.mutate()}>{mut.isPending ? "Sending…" : "Send request"}</Button></div>}>
      <div className="space-y-4">
        <Textarea label="What do you need help with?" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        <Input label="Preferred date/time (optional)" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label="Address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
    </Modal>
  );
}
