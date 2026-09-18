import { useState } from "react";
import type { ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import { ArrowLeft, Plus, Target, Activity, CheckSquare, FileText, ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { routes } from "@/config/routes";
import { StaffPicker } from "../components/StaffPicker";
import { carePlansApi, labelize } from "../api/home-health.api";

function fmtDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return isValid(d) ? format(d, "MMM d, yyyy") : "—";
}

export function CarePlanDetailPage() {
  const { planId } = useParams();
  const id = Number(planId);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const planQuery = useQuery({ queryKey: ["care-plan", id], queryFn: () => carePlansApi.get(id), enabled: Number.isFinite(id) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["care-plan", id] });

  const [goalDesc, setGoalDesc] = useState("");
  const [goalType, setGoalType] = useState("SHORT_TERM");
  const [intvTitle, setIntvTitle] = useState("");
  const [intvFreq, setIntvFreq] = useState("DAILY");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskStaff, setTaskStaff] = useState<number | null>(null);
  const [progressNote, setProgressNote] = useState("");
  const [reviewSummary, setReviewSummary] = useState("");
  const [reviewOutcome, setReviewOutcome] = useState("CONTINUE");

  const addGoal = useMutation({
    mutationFn: () => carePlansApi.addGoal(id, { description: goalDesc.trim(), goal_type: goalType }),
    onSuccess: () => { setGoalDesc(""); invalidate(); },
    onError: (e) => toast.error("Couldn't add goal", apiErrorMessage(e, "Try again.")),
  });
  const addIntv = useMutation({
    mutationFn: () => carePlansApi.addIntervention(id, { title: intvTitle.trim(), frequency: intvFreq }),
    onSuccess: () => { setIntvTitle(""); invalidate(); },
    onError: (e) => toast.error("Couldn't add intervention", apiErrorMessage(e, "Try again.")),
  });
  const addTask = useMutation({
    mutationFn: () => carePlansApi.addTask(id, { title: taskTitle.trim(), assigned_staff_id: taskStaff ?? undefined }),
    onSuccess: () => { setTaskTitle(""); setTaskStaff(null); invalidate(); },
    onError: (e) => toast.error("Couldn't add task", apiErrorMessage(e, "Try again.")),
  });
  const completeTask = useMutation({
    mutationFn: (taskId: number) => carePlansApi.completeTask(taskId),
    onSuccess: () => { toast.success("Task completed"); invalidate(); },
    onError: (e) => toast.error("Couldn't complete task", apiErrorMessage(e, "Try again.")),
  });
  const addProgress = useMutation({
    mutationFn: () => carePlansApi.addProgressNote(id, { note: progressNote.trim() }),
    onSuccess: () => { setProgressNote(""); invalidate(); },
    onError: (e) => toast.error("Couldn't add note", apiErrorMessage(e, "Try again.")),
  });
  const addReview = useMutation({
    mutationFn: () => carePlansApi.addReview(id, { summary: reviewSummary.trim() || undefined, outcome: reviewOutcome }),
    onSuccess: () => { setReviewSummary(""); toast.success("Review recorded"); invalidate(); },
    onError: (e) => toast.error("Couldn't record review", apiErrorMessage(e, "Try again.")),
  });

  if (planQuery.isLoading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (planQuery.isError || !planQuery.data) return <Card className="text-center text-secondary-500">Couldn't load this care plan.</Card>;
  const p = planQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <button onClick={() => navigate(routes.carePlans)} className="mb-2 inline-flex items-center gap-1 text-sm text-secondary-500 hover:text-secondary-700">
            <ArrowLeft className="h-4 w-4" /> Care plans
          </button>
        }
        title={p.title}
        description={`${p.condition || "—"} • ${p.patient_name || `Patient #${p.patient_id}`}`}
        actions={<Badge variant={p.status === "ACTIVE" ? "soft-success" : "secondary"}>{labelize(p.status)}</Badge>}
      />

      <Card className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        <Info label="Priority" value={labelize(p.priority)} />
        <Info label="Start" value={fmtDate(p.start_date)} />
        <Info label="Lead" value={p.lead_staff_name || "—"} />
        <Info label="Next review" value={fmtDate(p.next_review_date)} />
      </Card>

      {/* Goals */}
      <Section icon={<Target className="h-4 w-4" />} title="Goals">
        <div className="space-y-2">
          {p.goals.length === 0 && <Empty>No goals yet.</Empty>}
          {p.goals.map((g) => (
            <div key={g.id} className="flex items-center justify-between rounded-xl border border-secondary-100 p-3 dark:border-white/5">
              <div>
                <div className="text-sm font-medium text-secondary-800 dark:text-secondary-100">{g.description}</div>
                <div className="text-xs text-secondary-500">{labelize(g.goal_type)} · {g.progress_percent ?? 0}% · target {g.target_value ?? "—"}{g.measure_unit ? ` ${g.measure_unit}` : ""}</div>
              </div>
              <Badge variant={g.status === "ACHIEVED" ? "soft-success" : "secondary"}>{labelize(g.status)}</Badge>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]"><Input label="New goal" value={goalDesc} onChange={(e) => setGoalDesc(e.target.value)} /></div>
          <div className="w-40"><Select label="Type" value={goalType} onChange={(e) => setGoalType(e.target.value)} options={[{ value: "SHORT_TERM", label: "Short-term" }, { value: "LONG_TERM", label: "Long-term" }]} /></div>
          <Button size="sm" disabled={!goalDesc.trim() || addGoal.isPending} onClick={() => addGoal.mutate()}><Plus className="h-4 w-4" /> Add</Button>
        </div>
      </Section>

      {/* Interventions */}
      <Section icon={<Activity className="h-4 w-4" />} title="Interventions">
        <div className="space-y-2">
          {p.interventions.length === 0 && <Empty>No interventions yet.</Empty>}
          {p.interventions.map((i) => (
            <div key={i.id} className="flex items-center justify-between rounded-xl border border-secondary-100 p-3 dark:border-white/5">
              <div>
                <div className="text-sm font-medium text-secondary-800 dark:text-secondary-100">{i.title}</div>
                <div className="text-xs text-secondary-500">{labelize(i.frequency)}{i.category ? ` · ${i.category}` : ""}</div>
              </div>
              <Badge variant={i.status === "ACTIVE" ? "soft-success" : "secondary"}>{labelize(i.status)}</Badge>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]"><Input label="New intervention" value={intvTitle} onChange={(e) => setIntvTitle(e.target.value)} /></div>
          <div className="w-40"><Select label="Frequency" value={intvFreq} onChange={(e) => setIntvFreq(e.target.value)} options={[
            { value: "ONCE", label: "Once" }, { value: "DAILY", label: "Daily" }, { value: "TWICE_DAILY", label: "Twice daily" },
            { value: "WEEKLY", label: "Weekly" }, { value: "MONTHLY", label: "Monthly" }, { value: "AS_NEEDED", label: "As needed" },
          ]} /></div>
          <Button size="sm" disabled={!intvTitle.trim() || addIntv.isPending} onClick={() => addIntv.mutate()}><Plus className="h-4 w-4" /> Add</Button>
        </div>
      </Section>

      {/* Tasks */}
      <Section icon={<CheckSquare className="h-4 w-4" />} title="Tasks">
        <div className="space-y-2">
          {p.tasks.length === 0 && <Empty>No tasks yet.</Empty>}
          {p.tasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-xl border border-secondary-100 p-3 dark:border-white/5">
              <div>
                <div className="text-sm font-medium text-secondary-800 dark:text-secondary-100">{t.title}</div>
                <div className="text-xs text-secondary-500">{t.due_at ? `Due ${fmtDate(t.due_at)}` : "No due date"}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={t.status === "COMPLETED" ? "soft-success" : t.status === "MISSED" ? "soft-danger" : "secondary"}>{labelize(t.status)}</Badge>
                {t.status !== "COMPLETED" && t.status !== "CANCELLED" && (
                  <Button size="sm" variant="secondary" disabled={completeTask.isPending} onClick={() => completeTask.mutate(t.id)}>Complete</Button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]"><Input label="New task" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} /></div>
          <div className="w-56"><StaffPicker label="Assign to" value={taskStaff} onChange={(sid) => setTaskStaff(sid)} /></div>
          <Button size="sm" disabled={!taskTitle.trim() || addTask.isPending} onClick={() => addTask.mutate()}><Plus className="h-4 w-4" /> Add</Button>
        </div>
      </Section>

      {/* Progress notes */}
      <Section icon={<FileText className="h-4 w-4" />} title="Progress notes">
        <div className="space-y-2">
          {p.progress_notes.length === 0 && <Empty>No progress notes yet.</Empty>}
          {p.progress_notes.map((n) => (
            <div key={n.id} className="rounded-xl border border-secondary-100 p-3 text-sm dark:border-white/5">
              <div className="text-secondary-800 dark:text-secondary-100">{n.note}</div>
              <div className="text-xs text-secondary-400">{fmtDate(n.recorded_at)}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[260px]"><Input label="Add progress note" value={progressNote} onChange={(e) => setProgressNote(e.target.value)} /></div>
          <Button size="sm" disabled={!progressNote.trim() || addProgress.isPending} onClick={() => addProgress.mutate()}><Plus className="h-4 w-4" /> Add</Button>
        </div>
      </Section>

      {/* Reviews */}
      <Section icon={<ClipboardCheck className="h-4 w-4" />} title="Reviews">
        <div className="space-y-2">
          {p.reviews.length === 0 && <Empty>No reviews yet.</Empty>}
          {p.reviews.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl border border-secondary-100 p-3 dark:border-white/5">
              <div>
                <div className="text-sm text-secondary-800 dark:text-secondary-100">{r.summary || "—"}</div>
                <div className="text-xs text-secondary-400">{fmtDate(r.review_date)}</div>
              </div>
              <Badge variant={r.outcome === "ESCALATE" ? "soft-danger" : "secondary"}>{labelize(r.outcome)}</Badge>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]"><Input label="Review summary" value={reviewSummary} onChange={(e) => setReviewSummary(e.target.value)} /></div>
          <div className="w-44"><Select label="Outcome" value={reviewOutcome} onChange={(e) => setReviewOutcome(e.target.value)} options={[
            { value: "CONTINUE", label: "Continue" }, { value: "MODIFY", label: "Modify" }, { value: "ESCALATE", label: "Escalate" }, { value: "DISCHARGE", label: "Discharge" },
          ]} /></div>
          <Button size="sm" disabled={addReview.isPending} onClick={() => addReview.mutate()}><Plus className="h-4 w-4" /> Record</Button>
        </div>
      </Section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-widest text-secondary-400">{label}</div>
      <div className="mt-0.5 text-secondary-800 dark:text-secondary-100">{value}</div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-secondary-500">{icon} {title}</h3>
      {children}
    </Card>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-secondary-400">{children}</p>;
}
