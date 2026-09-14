import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  ClipboardList,
  Minus,
  Plus,
  Stethoscope,
  Trash2,
  TrendingUp,
} from "lucide-react";
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

const PROBLEM_STATUSES: ProblemStatus[] = [
  "ACTIVE",
  "CONTROLLED",
  "IMPROVING",
  "WORSENING",
  "RESOLVED",
];

const STATUS_STYLE: Record<ProblemStatus, string> = {
  ACTIVE: "bg-amber-50 text-amber-700 border-amber-200",
  CONTROLLED: "bg-primary-50 text-primary-700 border-primary-200",
  IMPROVING: "bg-emerald-50 text-emerald-700 border-emerald-200",
  WORSENING: "bg-rose-50 text-rose-700 border-rose-200",
  RESOLVED: "bg-secondary-100 text-secondary-500 border-secondary-200",
};

const ASSESSMENT_STYLE: Record<string, string> = {
  improving: "bg-emerald-50 text-emerald-700",
  worsening: "bg-rose-50 text-rose-700",
  stable: "bg-secondary-100 text-secondary-600",
  trend_only: "bg-secondary-50 text-secondary-500",
  insufficient_data: "bg-secondary-50 text-secondary-400",
};

const ASSESSMENT_LABEL: Record<string, string> = {
  improving: "Improving",
  worsening: "Worsening",
  stable: "Stable",
  trend_only: "Trend",
  insufficient_data: "—",
};

function num(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.round(n * 10) / 10) : "—";
}

export function Patient360Panel({ patientId }: { patientId: number }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStatus, setNewStatus] = useState<ProblemStatus>("ACTIVE");
  const [newSeverity, setNewSeverity] = useState("");
  const [newNotes, setNewNotes] = useState("");

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

  const invalidateProblems = () =>
    qc.invalidateQueries({ queryKey: ["patient-problems", patientId] });

  const addMut = useMutation({
    mutationFn: () =>
      createPatientProblem(patientId, {
        condition_name: newName.trim(),
        status: newStatus,
        severity: newSeverity || undefined,
        notes: newNotes || undefined,
      }),
    onSuccess: () => {
      setShowAdd(false);
      setNewName("");
      setNewSeverity("");
      setNewNotes("");
      setNewStatus("ACTIVE");
      invalidateProblems();
    },
  });

  const statusMut = useMutation({
    mutationFn: (vars: { id: number; status: ProblemStatus }) =>
      updatePatientProblem(patientId, vars.id, { status: vars.status }),
    onSuccess: invalidateProblems,
  });

  const removeMut = useMutation({
    mutationFn: (id: number) => deletePatientProblem(patientId, id),
    onSuccess: invalidateProblems,
  });

  const trends = trendsQ.data;
  const problems = problemsQ.data ?? [];
  const baseline = baselineQ.data ?? {};

  const chartMetrics = useMemo(
    () => (trends?.metrics ?? []).filter((m) => m.points && m.points.length >= 1),
    [trends],
  );

  const baselineRows = useMemo(() => {
    const fields: [string, string][] = [
      ["Blood sugar (baseline)", baseline?.blood_sugar_baseline],
      ["Lipid profile (baseline)", baseline?.lipid_profile_baseline],
      ["HIV status", baseline?.hiv_status],
      ["Genotype", baseline?.genotype],
      ["Blood group", baseline?.blood_group],
      ["Baseline weight (kg)", baseline?.baseline_weight_kg],
      ["Baseline height (cm)", baseline?.baseline_height_cm],
    ];
    return fields.filter(([, v]) => v != null && v !== "");
  }, [baseline]);

  const historyCounts = useMemo(() => {
    const h = historyQ.data ?? {};
    return {
      visits: (h.visits ?? []).length,
      diagnoses: (h.diagnoses ?? []).length,
      labs: (h.lab_orders ?? h.laboratory ?? []).length,
      prescriptions: (h.prescriptions ?? []).length,
    };
  }, [historyQ.data]);

  const recentDiagnoses: any[] = useMemo(
    () => ((historyQ.data?.diagnoses ?? []) as any[]).slice(0, 6),
    [historyQ.data],
  );

  return (
    <div className="space-y-5">
      {/* ---- Trend analytics ---- */}
      <div className="glass-card rounded-[2rem] p-6 bg-white/70 border border-secondary-200 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-secondary-700">
            <TrendingUp className="h-5 w-5 text-primary-500" />
            <h4 className="font-black text-sm">Progress Analytics</h4>
          </div>
          {trends && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold">
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">
                {trends.improving} improving
              </span>
              <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700">
                {trends.worsening} worsening
              </span>
              <span className="px-2 py-0.5 rounded-md bg-secondary-100 text-secondary-600">
                {trends.stable} stable
              </span>
            </div>
          )}
        </div>

        {trendsQ.isLoading ? (
          <p className="text-xs text-secondary-400 font-bold">Loading trends…</p>
        ) : chartMetrics.length === 0 ? (
          <p className="text-xs text-secondary-400 font-medium">
            No vitals recorded across visits yet. Trends appear once at least two sets of
            vitals exist.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {chartMetrics.map((m) => (
              <MetricCardMini key={m.key} metric={m} />
            ))}
          </div>
        )}
      </div>

      {/* ---- Chronic problem list ---- */}
      <div className="glass-card rounded-[2rem] p-6 bg-white/70 border border-secondary-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-secondary-700">
            <ClipboardList className="h-5 w-5 text-primary-500" />
            <h4 className="font-black text-sm">Chronic Problem List</h4>
          </div>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-600 hover:text-primary-700"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>

        {showAdd && (
          <div className="rounded-2xl border border-secondary-200 bg-secondary-50/60 p-3 space-y-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Condition (e.g. Hypertension)"
              className="input-field w-full text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as ProblemStatus)}
                className="input-field text-xs"
              >
                {PROBLEM_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input
                value={newSeverity}
                onChange={(e) => setNewSeverity(e.target.value)}
                placeholder="Severity (MILD/MODERATE/SEVERE)"
                className="input-field text-xs flex-1 min-w-[140px]"
              />
            </div>
            <textarea
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Notes"
              className="input-field w-full text-xs h-16 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="btn-secondary text-xs px-3 py-1.5">
                Cancel
              </button>
              <button
                onClick={() => addMut.mutate()}
                disabled={!newName.trim() || addMut.isPending}
                className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
              >
                {addMut.isPending ? "Saving…" : "Add condition"}
              </button>
            </div>
          </div>
        )}

        {problemsQ.isLoading ? (
          <p className="text-xs text-secondary-400 font-bold">Loading problem list…</p>
        ) : problems.length === 0 ? (
          <p className="text-xs text-secondary-400 font-medium">
            No chronic conditions recorded. Add one above as you assess the patient.
          </p>
        ) : (
          <ul className="space-y-2">
            {problems.map((p: PatientProblem) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-secondary-200 bg-white px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-secondary-900 truncate">
                    {p.condition_name}
                    {p.severity ? (
                      <span className="ml-2 text-[10px] font-bold text-secondary-400 uppercase">
                        {p.severity}
                      </span>
                    ) : null}
                  </p>
                  {p.notes ? (
                    <p className="text-[11px] text-secondary-500 truncate">{p.notes}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={p.status}
                    onChange={(e) =>
                      statusMut.mutate({ id: p.id, status: e.target.value as ProblemStatus })
                    }
                    className={`text-[10px] font-bold uppercase tracking-wide rounded-lg border px-2 py-1 ${STATUS_STYLE[p.status]}`}
                  >
                    {PROBLEM_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeMut.mutate(p.id)}
                    className="p-1.5 rounded-lg text-secondary-400 hover:text-rose-600 hover:bg-rose-50"
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---- Baseline diagnostics ---- */}
      <div className="glass-card rounded-[2rem] p-6 bg-white/70 border border-secondary-200 space-y-3">
        <div className="flex items-center gap-2 text-secondary-700">
          <Activity className="h-5 w-5 text-primary-500" />
          <h4 className="font-black text-sm">Baseline Diagnostics</h4>
        </div>
        {baselineQ.isLoading ? (
          <p className="text-xs text-secondary-400 font-bold">Loading baseline…</p>
        ) : baselineRows.length === 0 ? (
          <p className="text-xs text-secondary-400 font-medium">
            No baseline diagnostics recorded for this patient yet.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {baselineRows.map(([label, value]) => (
              <div key={label} className="rounded-xl bg-secondary-50 border border-secondary-100 px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-secondary-400">{label}</p>
                <p className="text-xs font-bold text-secondary-800">{String(value)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Medical history summary ---- */}
      <div className="glass-card rounded-[2rem] p-6 bg-white/70 border border-secondary-200 space-y-3">
        <div className="flex items-center gap-2 text-secondary-700">
          <Stethoscope className="h-5 w-5 text-primary-500" />
          <h4 className="font-black text-sm">Medical History</h4>
        </div>
        {historyQ.isLoading ? (
          <p className="text-xs text-secondary-400 font-bold">Loading history…</p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2">
              <HistCount label="Visits" value={historyCounts.visits} />
              <HistCount label="Diagnoses" value={historyCounts.diagnoses} />
              <HistCount label="Labs" value={historyCounts.labs} />
              <HistCount label="Rx" value={historyCounts.prescriptions} />
            </div>
            {recentDiagnoses.length > 0 && (
              <div className="pt-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-secondary-400 mb-1">
                  Recent diagnoses
                </p>
                <ul className="space-y-1">
                  {recentDiagnoses.map((d, i) => (
                    <li key={d.id ?? i} className="text-xs text-secondary-700 truncate">
                      • {d.diagnosis_name ?? d.name ?? "—"}
                      {d.diagnosis_type ? (
                        <span className="ml-2 text-[10px] text-secondary-400 uppercase">
                          {d.diagnosis_type}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MetricCardMini({ metric }: { metric: MetricTrend }) {
  const a = metric.assessment;
  const delta = metric.delta ?? 0;
  const DeltaIcon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;
  const stroke =
    a === "improving" ? "#059669" : a === "worsening" ? "#e11d48" : "#64748b";
  return (
    <div className="rounded-2xl border border-secondary-200 bg-white p-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">
            {metric.label}
          </p>
          <p className="text-lg font-black text-secondary-900 leading-tight">
            {num(metric.latest_value)}
            {metric.unit ? <span className="text-[10px] font-bold text-secondary-400"> {metric.unit}</span> : null}
          </p>
        </div>
        <span className={`text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded ${ASSESSMENT_STYLE[a] ?? ""}`}>
          {ASSESSMENT_LABEL[a] ?? a}
        </span>
      </div>
      {metric.points.length >= 2 ? (
        <div className="h-10 mt-1 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={metric.points}>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <RTooltip
                formatter={(v: any) => [`${num(v)}${metric.unit ? " " + metric.unit : ""}`, metric.label]}
                labelFormatter={(_, p: any) =>
                  p?.[0]?.payload?.date ? new Date(p[0].payload.date).toLocaleDateString() : ""
                }
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
              />
              <Line type="monotone" dataKey="value" stroke={stroke} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-[10px] text-secondary-400 mt-1">One reading — need ≥2 for a trend.</p>
      )}
      {metric.points.length >= 2 && metric.first_value != null && (
        <p className="text-[10px] font-bold text-secondary-500 mt-0.5 flex items-center gap-1">
          <DeltaIcon className="h-3 w-3" />
          {num(metric.first_value)} → {num(metric.latest_value)} ({delta > 0 ? "+" : ""}
          {num(delta)})
        </p>
      )}
    </div>
  );
}

function HistCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-secondary-50 border border-secondary-100 px-2 py-2 text-center">
      <p className="text-lg font-black text-secondary-900 leading-none">{value}</p>
      <p className="text-[9px] font-black uppercase tracking-widest text-secondary-400 mt-1">{label}</p>
    </div>
  );
}
