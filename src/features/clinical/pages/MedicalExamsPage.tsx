import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Download, Plus, Stethoscope, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiClient } from "@/lib/api/api-client";
import { apiErrorMessage } from "@/lib/api/api-error";
import { listLabTests, type LabTest } from "@/features/laboratory/api/lab-tests.api";
import { getVisits } from "@/features/visits/api/visits.api";

type ExamPackage = {
  id: number; code: string; name: string; exam_type: string;
  description?: string | null; lab_test_ids: number[];
  price?: string | null; is_active: boolean;
};
type Exam = {
  id: number; exam_no: string; visit_id: number; patient_name?: string | null;
  hospital_number?: string | null; package?: ExamPackage | null;
  lab_order_no?: string | null; status: string; fitness_status?: string | null;
  clinical_findings?: string | null; recommendations?: string | null;
  restrictions?: string | null; reviewed_by?: string | null;
  created_at?: string | null;
  results: { total: number; released: number; complete: boolean };
};

const FITNESS = [
  ["FIT", "Medically Fit"],
  ["FIT_WITH_RESTRICTIONS", "Fit with Restrictions"],
  ["TEMPORARILY_UNFIT", "Temporarily Unfit"],
  ["PERMANENTLY_UNFIT", "Permanently Unfit"],
] as const;
const FITNESS_VARIANT: Record<string, any> = {
  FIT: "soft-success", FIT_WITH_RESTRICTIONS: "soft-warning",
  TEMPORARILY_UNFIT: "soft-warning", PERMANENTLY_UNFIT: "soft-danger",
};

async function downloadReport(examId: number, examNo: string) {
  const res = await apiClient.get(`/medical-exams/${examId}/report.pdf`, { responseType: "blob" });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement("a");
  a.href = url; a.download = `medical-exam-${examNo}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function MedicalExamsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"EXAMS" | "PACKAGES">("EXAMS");
  const [newExamOpen, setNewExamOpen] = useState(false);
  const [newPkgOpen, setNewPkgOpen] = useState(false);
  const [review, setReview] = useState<Exam | null>(null);

  const exams = useQuery({
    queryKey: ["medical-exams"],
    queryFn: async () => (await apiClient.get<Exam[]>("/medical-exams")).data,
    refetchInterval: 60_000,
  });
  const packages = useQuery({
    queryKey: ["medical-exam-packages"],
    queryFn: async () =>
      (await apiClient.get<{ exam_types: string[]; items: ExamPackage[] }>("/medical-exams/packages")).data,
  });

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <PageHeader title="Medical Examinations"
          description="Fitness assessments — package-driven investigations, physician review and verifiable reports." />
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => setNewPkgOpen(true)}>New Package</Button>
          <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => setNewExamOpen(true)}>Start Examination</Button>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-secondary-100/50 p-1 rounded-2xl w-fit">
        {(["EXAMS", "PACKAGES"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${tab === t ? "bg-white text-primary-600 shadow-sm" : "text-secondary-400 hover:text-secondary-600"}`}>
            {t === "EXAMS" ? `Examinations (${exams.data?.length ?? 0})` : `Packages (${packages.data?.items.length ?? 0})`}
          </button>
        ))}
      </div>

      {tab === "EXAMS" ? (
        <Card variant="panel" className="p-0 overflow-hidden">
          {exams.isLoading ? (
            <div className="p-6 space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-2/3" /></div>
          ) : (exams.data ?? []).length === 0 ? (
            <div className="py-20 text-center">
              <ClipboardCheck className="mx-auto mb-3 h-10 w-10 text-secondary-200" />
              <p className="font-bold text-secondary-900">No examinations yet</p>
              <p className="text-sm text-secondary-400">Start one from an active visit.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-black uppercase tracking-widest text-secondary-400 bg-secondary-900/5">
                  <th className="px-6 py-3">Exam</th><th className="px-6 py-3">Patient</th>
                  <th className="px-6 py-3">Package</th><th className="px-6 py-3">Results</th>
                  <th className="px-6 py-3">Determination</th><th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100/60">
                {(exams.data ?? []).map((e) => (
                  <tr key={e.id} className="hover:bg-primary-50/20">
                    <td className="px-6 py-3 data-mono font-bold text-secondary-900">{e.exam_no}</td>
                    <td className="px-6 py-3">
                      <p className="font-bold text-secondary-800">{e.patient_name ?? "—"}</p>
                      <p className="text-[10px] text-secondary-400 data-mono">{e.hospital_number}</p>
                    </td>
                    <td className="px-6 py-3 text-secondary-600">{e.package?.name ?? "—"}</td>
                    <td className="px-6 py-3">
                      <Badge variant={e.results.complete ? "soft-success" : "soft-warning"}>
                        {e.results.released}/{e.results.total} released
                      </Badge>
                    </td>
                    <td className="px-6 py-3">
                      {e.fitness_status
                        ? <Badge variant={FITNESS_VARIANT[e.fitness_status] ?? "secondary"}>{e.fitness_status.replace(/_/g, " ")}</Badge>
                        : <Badge variant="secondary">{e.status.replace(/_/g, " ")}</Badge>}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {e.status === "COMPLETED" ? (
                        <Button size="sm" variant="secondary" leftIcon={<Download className="h-3.5 w-3.5" />}
                          onClick={() => downloadReport(e.id, e.exam_no).catch((err) =>
                            toast.error("Couldn't download", apiErrorMessage(err)))}>
                          Report
                        </Button>
                      ) : (
                        <Button size="sm" leftIcon={<Stethoscope className="h-3.5 w-3.5" />}
                          onClick={() => setReview(e)}>Review</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(packages.data?.items ?? []).map((p) => (
            <Card key={p.id} className="p-5 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-black text-secondary-900">{p.name}</p>
                  <p className="data-mono text-[10px] text-secondary-400">{p.code} · {p.exam_type.replace(/_/g, " ")}</p>
                </div>
                <Badge variant={p.is_active ? "soft-success" : "secondary"}>{p.is_active ? "ACTIVE" : "OFF"}</Badge>
              </div>
              <p className="text-xs text-secondary-500">{p.lab_test_ids.length} investigations{p.price ? ` · ₦${Number(p.price).toLocaleString()}` : ""}</p>
              {p.description && <p className="text-xs text-secondary-400">{p.description}</p>}
            </Card>
          ))}
          {(packages.data?.items ?? []).length === 0 && !packages.isLoading && (
            <p className="text-sm text-secondary-400">No packages yet — create one to begin.</p>
          )}
        </div>
      )}

      {newExamOpen && <StartExamModal onClose={() => setNewExamOpen(false)}
        packages={(packages.data?.items ?? []).filter((p) => p.is_active)}
        onDone={() => { qc.invalidateQueries({ queryKey: ["medical-exams"] }); setNewExamOpen(false); }} />}
      {newPkgOpen && <NewPackageModal onClose={() => setNewPkgOpen(false)}
        examTypes={packages.data?.exam_types ?? []}
        onDone={() => { qc.invalidateQueries({ queryKey: ["medical-exam-packages"] }); setNewPkgOpen(false); }} />}
      {review && <ReviewExamModal exam={review} onClose={() => setReview(null)}
        onDone={() => { qc.invalidateQueries({ queryKey: ["medical-exams"] }); setReview(null); }} />}
    </div>
  );
}

function ModalShell({ title, subtitle, onClose, children }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-secondary-900">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h4 className="text-lg font-black text-secondary-900 dark:text-white">{title}</h4>
            {subtitle && <p className="text-xs text-secondary-400">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-secondary-100"><X className="h-4 w-4 text-secondary-400" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StartExamModal({ onClose, onDone, packages }: { onClose: () => void; onDone: () => void; packages: ExamPackage[] }) {
  const toast = useToast();
  const [visitId, setVisitId] = useState("");
  const [packageId, setPackageId] = useState("");
  const visits = useQuery({
    queryKey: ["visits", "active-for-exam"],
    queryFn: () => getVisits({ limit: 50 }),
  });
  const start = useMutation({
    mutationFn: async () =>
      (await apiClient.post("/medical-exams", { visit_id: Number(visitId), package_id: Number(packageId) })).data,
    onSuccess: () => { toast.success("Examination started", "Package investigations were ordered and the lab queued."); onDone(); },
    onError: (err) => toast.error("Couldn't start", apiErrorMessage(err)),
  });
  const options = (visits.data?.items ?? []).filter((v: any) => !["COMPLETED", "CANCELLED"].includes(v.status));
  return (
    <ModalShell title="Start Medical Examination" subtitle="Pick the visit and the examination package — investigations are ordered automatically." onClose={onClose}>
      <div className="space-y-3">
        <label className="block text-xs font-bold text-secondary-500">
          Visit
          <select value={visitId} onChange={(e) => setVisitId(e.target.value)} className="input-field mt-1 w-full">
            <option value="">— Select active visit —</option>
            {options.map((v: any) => (
              <option key={v.id} value={String(v.id)}>
                {(v.visit_number ?? `Visit #${v.id}`) + (v.patient ? ` — ${v.patient.first_name ?? ""} ${v.patient.last_name ?? ""}` : "")}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-bold text-secondary-500">
          Examination package
          <select value={packageId} onChange={(e) => setPackageId(e.target.value)} className="input-field mt-1 w-full">
            <option value="">— Select package —</option>
            {packages.map((p) => <option key={p.id} value={String(p.id)}>{p.name} ({p.exam_type.replace(/_/g, " ")})</option>)}
          </select>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={start.isPending}>Cancel</Button>
          <Button size="sm" isLoading={start.isPending} disabled={!visitId || !packageId}
            onClick={() => start.mutate()}>Start & Order Investigations</Button>
        </div>
      </div>
    </ModalShell>
  );
}

function NewPackageModal({ onClose, onDone, examTypes }: { onClose: () => void; onDone: () => void; examTypes: string[] }) {
  const toast = useToast();
  const [form, setForm] = useState({ code: "", name: "", exam_type: examTypes[0] ?? "PRE_EMPLOYMENT", description: "", price: "" });
  const [testIds, setTestIds] = useState<Set<number>>(new Set());
  const tests = useQuery({ queryKey: ["lab-tests", "active"], queryFn: () => listLabTests({ limit: 500 }) });
  const list: LabTest[] = (tests.data as any)?.items ?? [];
  const create = useMutation({
    mutationFn: async () => (await apiClient.post("/medical-exams/packages", {
      ...form, price: form.price || null, lab_test_ids: [...testIds],
    })).data,
    onSuccess: () => { toast.success("Package created"); onDone(); },
    onError: (err) => toast.error("Couldn't create package", apiErrorMessage(err)),
  });
  const set = (k: string) => (e: React.ChangeEvent<any>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <ModalShell title="New Examination Package" subtitle="Bundle the investigations this examination type requires." onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-secondary-500">Code
          <input value={form.code} onChange={set("code")} placeholder="PRE-EMP-STD" className="input-field mt-1 w-full" /></label>
        <label className="text-xs font-bold text-secondary-500">Name
          <input value={form.name} onChange={set("name")} className="input-field mt-1 w-full" /></label>
        <label className="text-xs font-bold text-secondary-500">Examination type
          <select value={form.exam_type} onChange={set("exam_type")} className="input-field mt-1 w-full">
            {examTypes.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </select></label>
        <label className="text-xs font-bold text-secondary-500">Package price (optional)
          <input type="number" min="0" value={form.price} onChange={set("price")} className="input-field mt-1 w-full" /></label>
      </div>
      <label className="mt-3 block text-xs font-bold text-secondary-500">Description
        <input value={form.description} onChange={set("description")} className="input-field mt-1 w-full" /></label>
      <p className="mt-3 text-xs font-bold text-secondary-500">Included investigations ({testIds.size})</p>
      <div className="mt-1 max-h-52 overflow-y-auto rounded-2xl border border-secondary-100">
        {tests.isLoading ? <div className="p-3"><Skeleton className="h-6 w-full" /></div> :
          list.map((t) => (
            <label key={t.id} className="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-primary-50/40">
              <input type="checkbox" checked={testIds.has(t.id)}
                onChange={() => setTestIds((prev) => { const n = new Set(prev); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })}
                className="h-4 w-4 rounded accent-primary-600" />
              <span className="text-sm font-semibold text-secondary-800">{t.name}</span>
              <span className="ml-auto text-[10px] text-secondary-400">{t.code}</span>
            </label>
          ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={create.isPending}>Cancel</Button>
        <Button size="sm" isLoading={create.isPending}
          disabled={!form.code.trim() || !form.name.trim() || testIds.size === 0}
          onClick={() => create.mutate()}>Create Package</Button>
      </div>
    </ModalShell>
  );
}

function ReviewExamModal({ exam, onClose, onDone }: { exam: Exam; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [fitness, setFitness] = useState("");
  const [findings, setFindings] = useState("");
  const [recs, setRecs] = useState("");
  const [restrictions, setRestrictions] = useState("");
  const [override_, setOverride] = useState(false);
  const finalize = useMutation({
    mutationFn: async () => (await apiClient.post(`/medical-exams/${exam.id}/finalize`, {
      fitness_status: fitness, clinical_findings: findings || null,
      recommendations: recs || null, restrictions: restrictions || null,
      override_incomplete_results: override_,
    })).data,
    onSuccess: () => { toast.success("Examination finalised", "The report is now available for download."); onDone(); },
    onError: (err) => toast.error("Couldn't finalise", apiErrorMessage(err)),
  });
  return (
    <ModalShell title={`Review — ${exam.exam_no}`}
      subtitle={`${exam.patient_name ?? ""} · ${exam.package?.name ?? ""} · ${exam.results.released}/${exam.results.total} results released`}
      onClose={onClose}>
      <div className="space-y-3">
        {!exam.results.complete && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-700">
            Not all investigations are released yet. Open the patient's record to review what's in,
            or tick the override below to finalise anyway.
          </div>
        )}
        <label className="block text-xs font-bold text-secondary-500">Fitness determination
          <select value={fitness} onChange={(e) => setFitness(e.target.value)} className="input-field mt-1 w-full">
            <option value="">— Select —</option>
            {FITNESS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></label>
        <label className="block text-xs font-bold text-secondary-500">Clinical assessment
          <textarea rows={3} value={findings} onChange={(e) => setFindings(e.target.value)} className="input-field mt-1 w-full" /></label>
        <label className="block text-xs font-bold text-secondary-500">Recommendations
          <textarea rows={2} value={recs} onChange={(e) => setRecs(e.target.value)} className="input-field mt-1 w-full" /></label>
        <label className="block text-xs font-bold text-secondary-500">Restrictions / limitations
          <textarea rows={2} value={restrictions} onChange={(e) => setRestrictions(e.target.value)} className="input-field mt-1 w-full" /></label>
        {!exam.results.complete && (
          <label className="flex items-center gap-2 text-xs font-semibold text-secondary-600">
            <input type="checkbox" checked={override_} onChange={(e) => setOverride(e.target.checked)}
              className="h-4 w-4 rounded accent-amber-500" />
            Finalise despite outstanding results (recorded in the audit trail)
          </label>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={finalize.isPending}>Cancel</Button>
          <Button size="sm" isLoading={finalize.isPending} disabled={!fitness}
            onClick={() => finalize.mutate()}>Finalise Examination</Button>
        </div>
      </div>
    </ModalShell>
  );
}
