import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, YAxis } from "recharts";
import { Activity, ArrowDownRight, ArrowUpRight, ClipboardList, Minus, Plus, Stethoscope, Trash2, TrendingUp } from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxConfirm,
  DxForm,
  DxGrid,
  DxInput,
  DxKpi,
  DxMessage,
  DxPanel,
  DxPopup,
  DxProps,
  DxSelect,
  DxTextarea,
  apiErrorMessage,
  humanize,
  type DxBadgeTone,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  createPatientProblem,
  deletePatientProblem,
  getBaselineProfile,
  getClinicalTrends,
  getMedicalHistory,
  listPatientProblems,
  updatePatientProblem,
  type MetricTrend,
  type PatientProblem,
  type ProblemStatus,
} from "../api/clinical.api";

const PROBLEM_STATUSES: ProblemStatus[] = ["ACTIVE", "CONTROLLED", "IMPROVING", "WORSENING", "RESOLVED"];

const STATUS_TONE: Record<ProblemStatus, DxBadgeTone> = {
  ACTIVE: "warning",
  CONTROLLED: "info",
  IMPROVING: "success",
  WORSENING: "danger",
  RESOLVED: "neutral",
};

const ASSESSMENT_TONE: Record<string, DxBadgeTone> = {
  improving: "success",
  worsening: "danger",
  stable: "neutral",
  trend_only: "outline",
  insufficient_data: "outline",
};

const ASSESSMENT_LABEL: Record<string, string> = {
  improving: "Improving",
  worsening: "Worsening",
  stable: "Stable",
  trend_only: "Trend",
  insufficient_data: "—",
};

// Sparkline strokes mirror the dx status tokens (SVG attributes cannot read CSS variables).
const STROKE: Record<string, string> = { improving: "#15803d", worsening: "#b91c1c" };
const STROKE_DEFAULT = "#5f6b7a";

function num(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.round(n * 10) / 10) : "—";
}

type HistoryRecord = Record<string, unknown>;
type HistoryDiagnosis = { id?: number; diagnosis_name?: string; name?: string; diagnosis_type?: string };

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * Longitudinal view of the patient beside the encounter: progress analytics
 * across visits, the chronic problem list, baseline diagnostics and a history
 * summary. Used on the consultation workstation and the patient record.
 */
export function Patient360Panel({ patientId }: { patientId: number }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStatus, setNewStatus] = useState<ProblemStatus>("ACTIVE");
  const [newSeverity, setNewSeverity] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [removeTarget, setRemoveTarget] = useState<PatientProblem | null>(null);

  const trendsQ = useQuery({
    queryKey: ["clinical-trends", patientId],
    queryFn: () => getClinicalTrends(patientId),
    enabled: !!patientId,
  });
  const problemsQ = useQuery({
    queryKey: ["patient-problems", patientId],
    queryFn: () => listPatientProblems(patientId),
    enabled: !!patientId,
  });
  const baselineQ = useQuery({
    queryKey: ["baseline-profile", patientId],
    queryFn: () => getBaselineProfile(patientId),
    enabled: !!patientId,
  });
  const historyQ = useQuery({
    queryKey: ["medical-history", patientId],
    queryFn: () => getMedicalHistory(patientId),
    enabled: !!patientId,
  });

  const invalidateProblems = () => qc.invalidateQueries({ queryKey: ["patient-problems", patientId] });

  const addMut = useMutation({
    mutationFn: () =>
      createPatientProblem(patientId, {
        condition_name: newName.trim(),
        status: newStatus,
        severity: newSeverity || undefined,
        notes: newNotes || undefined,
      }),
    onSuccess: () => {
      setAddOpen(false);
      setNewName("");
      setNewSeverity("");
      setNewNotes("");
      setNewStatus("ACTIVE");
      invalidateProblems();
      toast.success("Condition added to the problem list");
    },
    onError: (err) => toast.error("Could not add condition", apiErrorMessage(err)),
  });

  const statusMut = useMutation({
    mutationFn: (vars: { id: number; status: ProblemStatus }) => updatePatientProblem(patientId, vars.id, { status: vars.status }),
    onSuccess: () => invalidateProblems(),
    onError: (err) => toast.error("Could not update status", apiErrorMessage(err)),
  });

  const removeMut = useMutation({
    mutationFn: (id: number) => deletePatientProblem(patientId, id),
    onSuccess: () => {
      invalidateProblems();
      toast.success("Condition removed");
    },
    onError: (err) => toast.error("Could not remove condition", apiErrorMessage(err)),
  });

  const trends = trendsQ.data;
  const problems: PatientProblem[] = problemsQ.data ?? [];

  const chartMetrics = useMemo(() => (trends?.metrics ?? []).filter((m) => m.points && m.points.length >= 1), [trends]);

  const baselineItems = useMemo(() => {
    const baseline = (baselineQ.data ?? {}) as HistoryRecord;
    const fields: [string, unknown][] = [
      ["Blood sugar (baseline)", baseline.blood_sugar_baseline],
      ["Lipid profile (baseline)", baseline.lipid_profile_baseline],
      ["HIV status", baseline.hiv_status],
      ["Genotype", baseline.genotype],
      ["Blood group", baseline.blood_group],
      ["Baseline weight (kg)", baseline.baseline_weight_kg],
      ["Baseline height (cm)", baseline.baseline_height_cm],
    ];
    return fields.filter(([, v]) => v != null && v !== "").map(([label, v]) => ({ label, value: String(v) }));
  }, [baselineQ.data]);

  const historyCounts = useMemo(() => {
    const h = (historyQ.data ?? {}) as HistoryRecord;
    return {
      visits: asArray(h.visits).length,
      diagnoses: asArray(h.diagnoses).length,
      labs: asArray(h.lab_orders ?? h.laboratory).length,
      prescriptions: asArray(h.prescriptions).length,
    };
  }, [historyQ.data]);

  const recentDiagnoses = useMemo(
    () => (asArray((historyQ.data as HistoryRecord | undefined)?.diagnoses) as HistoryDiagnosis[]).slice(0, 6),
    [historyQ.data],
  );

  const problemColumns: DxGridColumn<PatientProblem>[] = [
    {
      key: "condition_name",
      header: "Condition",
      wrap: true,
      sortable: true,
      render: (p) => (
        <div className="min-w-0">
          <div className="font-medium">
            {p.condition_name}
            {p.severity ? <span className="dx-faint ml-2 text-[11px]">{humanize(p.severity)}</span> : null}
          </div>
          {p.notes ? <div className="dx-muted truncate text-[11.5px]">{p.notes}</div> : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 128,
      sortable: true,
      render: (p) => (
        <DxSelect
          editorSize="sm"
          aria-label={`Status of ${p.condition_name}`}
          value={p.status}
          disabled={statusMut.isPending}
          onChange={(e) => statusMut.mutate({ id: p.id, status: e.target.value as ProblemStatus })}
          options={PROBLEM_STATUSES.map((s) => ({ value: s, label: humanize(s) }))}
          style={{ color: `var(--dx-${STATUS_TONE[p.status] === "neutral" ? "text-muted" : STATUS_TONE[p.status]})` }}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      width: 40,
      align: "right",
      render: (p) => (
        <DxButton size="sm" variant="text" icon title="Remove" onClick={() => setRemoveTarget(p)}>
          <Trash2 />
        </DxButton>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* ---- Trend analytics ---- */}
      <DxPanel
        title="Progress analytics"
        icon={<TrendingUp />}
        actions={
          trends ? (
            <>
              <DxBadge tone="success">{trends.improving} improving</DxBadge>
              <DxBadge tone="danger">{trends.worsening} worsening</DxBadge>
              <DxBadge tone="neutral">{trends.stable} stable</DxBadge>
            </>
          ) : undefined
        }
      >
        {trendsQ.isLoading ? (
          <div className="space-y-2">
            <div className="dx-skeleton h-3.5 w-2/3" />
            <div className="dx-skeleton h-3.5 w-1/2" />
          </div>
        ) : trendsQ.isError ? (
          <DxMessage tone="danger">{apiErrorMessage(trendsQ.error, "Could not load trends.")}</DxMessage>
        ) : chartMetrics.length === 0 ? (
          <p className="dx-muted text-[12.5px]">No vitals recorded across visits yet. Trends appear once at least two sets of vitals exist.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {chartMetrics.map((m) => (
              <MetricCardMini key={m.key} metric={m} />
            ))}
          </div>
        )}
      </DxPanel>

      {/* ---- Chronic problem list ---- */}
      <DxPanel
        title="Chronic problem list"
        icon={<ClipboardList />}
        flush
        actions={
          <DxButton size="sm" leftIcon={<Plus />} onClick={() => setAddOpen(true)}>
            Add
          </DxButton>
        }
      >
        <DxGrid
          columns={problemColumns}
          data={problems}
          rowKey={(p) => p.id}
          isLoading={problemsQ.isLoading}
          error={problemsQ.isError ? apiErrorMessage(problemsQ.error, "Could not load the problem list.") : null}
          onRetry={() => problemsQ.refetch()}
          borderless
          verticalLines={false}
          empty={{ icon: ClipboardList, title: "No chronic conditions recorded", description: "Add one as you assess the patient." }}
        />
      </DxPanel>

      {/* ---- Baseline diagnostics ---- */}
      <DxPanel title="Baseline diagnostics" icon={<Activity />}>
        {baselineQ.isLoading ? (
          <div className="dx-skeleton h-3.5 w-1/2" />
        ) : baselineItems.length === 0 ? (
          <p className="dx-muted text-[12.5px]">No baseline diagnostics recorded for this patient yet.</p>
        ) : (
          <DxProps tight items={baselineItems} />
        )}
      </DxPanel>

      {/* ---- Medical history summary ---- */}
      <DxPanel title="Medical history" icon={<Stethoscope />}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <DxKpi label="Visits" value={historyCounts.visits} tone="accent" isLoading={historyQ.isLoading} />
          <DxKpi label="Diagnoses" value={historyCounts.diagnoses} tone="danger" isLoading={historyQ.isLoading} />
          <DxKpi label="Labs" value={historyCounts.labs} tone="info" isLoading={historyQ.isLoading} />
          <DxKpi label="Rx" value={historyCounts.prescriptions} tone="success" isLoading={historyQ.isLoading} />
        </div>
        {recentDiagnoses.length > 0 ? (
          <div className="mt-3">
            <p className="dx-caption mb-1">Recent diagnoses</p>
            <ul className="divide-y divide-[var(--dx-border)] text-[12.5px]">
              {recentDiagnoses.map((d, i) => (
                <li key={d.id ?? i} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="truncate">{d.diagnosis_name ?? d.name ?? "—"}</span>
                  {d.diagnosis_type ? <DxBadge tone="outline">{humanize(d.diagnosis_type)}</DxBadge> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </DxPanel>

      {/* ---- Add condition ---- */}
      <DxPopup
        isOpen={addOpen}
        onClose={() => !addMut.isPending && setAddOpen(false)}
        title="Add chronic condition"
        size="sm"
        locked={addMut.isPending}
        footer={
          <>
            <DxButton onClick={() => setAddOpen(false)} disabled={addMut.isPending}>
              Cancel
            </DxButton>
            <DxButton variant="primary" isLoading={addMut.isPending} disabled={!newName.trim()} onClick={() => addMut.mutate()}>
              Add condition
            </DxButton>
          </>
        }
      >
        <DxForm cols={2}>
          <DxInput
            label="Condition"
            required
            fieldClassName="dx-col-span-full"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Hypertension"
            autoFocus
          />
          <DxSelect
            label="Status"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as ProblemStatus)}
            options={PROBLEM_STATUSES.map((s) => ({ value: s, label: humanize(s) }))}
          />
          <DxSelect
            label="Severity"
            placeholder="Not specified"
            value={newSeverity}
            onChange={(e) => setNewSeverity(e.target.value)}
            options={["MILD", "MODERATE", "SEVERE"].map((s) => ({ value: s, label: humanize(s) }))}
          />
          <DxTextarea label="Notes" fieldClassName="dx-col-span-full" rows={3} value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
        </DxForm>
      </DxPopup>

      <DxConfirm
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title="Remove condition?"
        description={
          <>
            <b className="dx-strong">{removeTarget?.condition_name}</b> will be removed from the patient's chronic problem list.
          </>
        }
        confirmLabel="Remove"
        onConfirm={() => (removeTarget ? removeMut.mutateAsync(removeTarget.id).then(() => undefined, () => undefined) : undefined)}
      />
    </div>
  );
}

function MetricCardMini({ metric }: { metric: MetricTrend }) {
  const a = metric.assessment;
  const delta = metric.delta ?? 0;
  const DeltaIcon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;
  const stroke = STROKE[a] ?? STROKE_DEFAULT;
  return (
    <div className="rounded border border-[var(--dx-border)] bg-[var(--dx-surface)] p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="dx-caption truncate">{metric.label}</p>
          <p className="dx-num text-[18px] font-semibold leading-tight">
            {num(metric.latest_value)}
            {metric.unit ? <span className="dx-faint ml-1 text-[11px] font-normal">{metric.unit}</span> : null}
          </p>
        </div>
        <DxBadge tone={ASSESSMENT_TONE[a] ?? "neutral"}>{ASSESSMENT_LABEL[a] ?? a}</DxBadge>
      </div>
      {metric.points.length >= 2 ? (
        <div className="-mx-1 mt-1 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={metric.points}>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <RTooltip
                formatter={(v) => [`${num(v)}${metric.unit ? " " + metric.unit : ""}`, metric.label]}
                labelFormatter={(_, payload) => {
                  const date = (payload?.[0]?.payload as { date?: string } | undefined)?.date;
                  return date ? new Date(date).toLocaleDateString() : "";
                }}
                contentStyle={{ fontSize: 11, borderRadius: 4 }}
              />
              <Line type="monotone" dataKey="value" stroke={stroke} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="dx-faint mt-1 text-[11px]">One reading — need ≥2 for a trend.</p>
      )}
      {metric.points.length >= 2 && metric.first_value != null ? (
        <p className="dx-muted mt-0.5 flex items-center gap-1 text-[11px]">
          <DeltaIcon className="h-3 w-3" aria-hidden />
          {num(metric.first_value)} → {num(metric.latest_value)} ({delta > 0 ? "+" : ""}
          {num(delta)})
        </p>
      ) : null}
    </div>
  );
}
