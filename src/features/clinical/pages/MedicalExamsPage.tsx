import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Download, Plus, Stethoscope } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxGrid, DxTabs, DxBadge, DxButton,
  DxPopup, DxInput, DxSelect, DxTextarea, DxCheckbox, DxMessage,
  type DxGridColumn, type DxBadgeTone,
} from "@/components/dx";
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
const FITNESS_TONE: Record<string, DxBadgeTone> = {
  FIT: "success", FIT_WITH_RESTRICTIONS: "warning",
  TEMPORARILY_UNFIT: "warning", PERMANENTLY_UNFIT: "danger",
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

  const examColumns: DxGridColumn<Exam>[] = [
    { key: "exam_no", header: "Exam", render: (e) => <span className="dx-mono text-[12px] font-bold text-[var(--dx-text)]">{e.exam_no}</span> },
    {
      key: "patient", header: "Patient", render: (e) => (
        <div>
          <p className="text-[13px] font-semibold text-[var(--dx-text)]">{e.patient_name ?? "—"}</p>
          <p className="dx-mono text-[10px] text-[var(--dx-text-muted)]">{e.hospital_number}</p>
        </div>
      ),
    },
    { key: "package", header: "Package", render: (e) => <span className="text-[13px] text-[var(--dx-text-muted)]">{e.package?.name ?? "—"}</span> },
    { key: "results", header: "Results", render: (e) => <DxBadge tone={e.results.complete ? "success" : "warning"}>{e.results.released}/{e.results.total} released</DxBadge> },
    {
      key: "determination", header: "Determination", render: (e) =>
        e.fitness_status
          ? <DxBadge tone={FITNESS_TONE[e.fitness_status] ?? "neutral"}>{e.fitness_status.replace(/_/g, " ")}</DxBadge>
          : <DxBadge tone="neutral">{e.status.replace(/_/g, " ")}</DxBadge>,
    },
    {
      key: "action", header: "", align: "right", render: (e) =>
        e.status === "COMPLETED" ? (
          <DxButton size="sm" leftIcon={<Download className="h-3.5 w-3.5" />}
            onClick={() => downloadReport(e.id, e.exam_no).catch((err) => toast.error("Couldn't download", apiErrorMessage(err)))}>
            Report
          </DxButton>
        ) : (
          <DxButton size="sm" variant="primary" leftIcon={<Stethoscope className="h-3.5 w-3.5" />} onClick={() => setReview(e)}>Review</DxButton>
        ),
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Clinical" }, { label: "Medical Exams" }]}
        title="Medical Examinations"
        subtitle="Fitness assessments — package-driven investigations, physician review and verifiable reports."
        actions={
          <>
            <DxButton leftIcon={<Plus className="h-4 w-4" />} onClick={() => setNewPkgOpen(true)}>New package</DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setNewExamOpen(true)}>Start examination</DxButton>
          </>
        }
      />

      <DxTabs
        items={[
          { key: "EXAMS", label: `Examinations (${exams.data?.length ?? 0})` },
          { key: "PACKAGES", label: `Packages (${packages.data?.items.length ?? 0})` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "EXAMS" ? (
        <DxPanel title="Examinations" icon={<ClipboardCheck className="h-4 w-4" />} flush>
          <DxGrid<Exam>
            columns={examColumns}
            data={exams.data ?? []}
            rowKey={(e) => e.id}
            isLoading={exams.isLoading}
            empty={{ icon: ClipboardCheck, title: "No examinations yet", description: "Start one from an active visit." }}
          />
        </DxPanel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {packages.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="dx-skeleton h-32 w-full" />)
          ) : (packages.data?.items ?? []).length === 0 ? (
            <DxPanel className="col-span-full">
              <div className="py-12 text-center">
                <ClipboardCheck className="mx-auto mb-3 h-9 w-9 text-[var(--dx-text-faint)]" />
                <p className="text-[13px] font-medium text-[var(--dx-text-muted)]">No packages yet — create one to begin.</p>
              </div>
            </DxPanel>
          ) : (
            (packages.data?.items ?? []).map((p) => (
              <div key={p.id} className="space-y-2 rounded-lg border border-[var(--dx-border)] bg-[var(--dx-surface)] p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-[var(--dx-text)]">{p.name}</p>
                    <p className="dx-mono text-[10px] text-[var(--dx-text-muted)]">{p.code} · {p.exam_type.replace(/_/g, " ")}</p>
                  </div>
                  <DxBadge tone={p.is_active ? "success" : "neutral"}>{p.is_active ? "ACTIVE" : "OFF"}</DxBadge>
                </div>
                <p className="text-[12px] text-[var(--dx-text-muted)]">{p.lab_test_ids.length} investigations{p.price ? ` · ₦${Number(p.price).toLocaleString()}` : ""}</p>
                {p.description ? <p className="text-[12px] text-[var(--dx-text-faint)]">{p.description}</p> : null}
              </div>
            ))
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
    </DxPage>
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
    <DxPopup
      isOpen onClose={onClose}
      title="Start medical examination"
      size="lg"
      locked={start.isPending}
      footer={
        <>
          <DxButton onClick={onClose} disabled={start.isPending}>Cancel</DxButton>
          <DxButton variant="primary" isLoading={start.isPending} disabled={!visitId || !packageId} onClick={() => start.mutate()}>Start &amp; order investigations</DxButton>
        </>
      }
    >
      <p className="mb-4 text-[12px] text-[var(--dx-text-muted)]">Pick the visit and the examination package — investigations are ordered automatically.</p>
      <div className="space-y-4">
        <DxSelect label="Visit" value={visitId} onChange={(e) => setVisitId(e.target.value)} placeholder="— Select active visit —"
          options={options.map((v: any) => ({
            value: String(v.id),
            label: (v.visit_number ?? `Visit #${v.id}`) + (v.patient ? ` — ${v.patient.first_name ?? ""} ${v.patient.last_name ?? ""}` : ""),
          }))} />
        <DxSelect label="Examination package" value={packageId} onChange={(e) => setPackageId(e.target.value)} placeholder="— Select package —"
          options={packages.map((p) => ({ value: String(p.id), label: `${p.name} (${p.exam_type.replace(/_/g, " ")})` }))} />
      </div>
    </DxPopup>
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
    <DxPopup
      isOpen onClose={onClose}
      title="New examination package"
      size="lg"
      locked={create.isPending}
      footer={
        <>
          <DxButton onClick={onClose} disabled={create.isPending}>Cancel</DxButton>
          <DxButton variant="primary" isLoading={create.isPending} disabled={!form.code.trim() || !form.name.trim() || testIds.size === 0} onClick={() => create.mutate()}>Create package</DxButton>
        </>
      }
    >
      <p className="mb-4 text-[12px] text-[var(--dx-text-muted)]">Bundle the investigations this examination type requires.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <DxInput label="Code" mono value={form.code} onChange={set("code")} placeholder="PRE-EMP-STD" />
        <DxInput label="Name" value={form.name} onChange={set("name")} />
        <DxSelect label="Examination type" value={form.exam_type} onChange={set("exam_type")}
          options={examTypes.map((t) => ({ value: t, label: t.replace(/_/g, " ") }))} />
        <DxInput label="Package price (optional)" type="number" min="0" value={form.price} onChange={set("price")} />
      </div>
      <div className="mt-4">
        <DxInput label="Description" value={form.description} onChange={set("description")} />
      </div>
      <p className="dx-field-label mt-4">Included investigations ({testIds.size})</p>
      <div className="mt-1 max-h-52 overflow-y-auto rounded-md border border-[var(--dx-border)]">
        {tests.isLoading ? (
          <div className="p-3"><div className="dx-skeleton h-6 w-full" /></div>
        ) : (
          list.map((t) => (
            <label key={t.id} className="flex cursor-pointer items-center gap-3 border-b border-[var(--dx-border)] px-4 py-2 last:border-0 hover:bg-[var(--dx-surface-sunken)]">
              <input type="checkbox" checked={testIds.has(t.id)}
                onChange={() => setTestIds((prev) => { const n = new Set(prev); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })}
                className="h-4 w-4 rounded" style={{ accentColor: "var(--dx-accent)" }} />
              <span className="text-[13px] font-semibold text-[var(--dx-text)]">{t.name}</span>
              <span className="dx-mono ml-auto text-[10px] text-[var(--dx-text-muted)]">{t.code}</span>
            </label>
          ))
        )}
      </div>
    </DxPopup>
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
    <DxPopup
      isOpen onClose={onClose}
      title={`Review — ${exam.exam_no}`}
      size="lg"
      locked={finalize.isPending}
      footer={
        <>
          <DxButton onClick={onClose} disabled={finalize.isPending}>Cancel</DxButton>
          <DxButton variant="primary" isLoading={finalize.isPending} disabled={!fitness} onClick={() => finalize.mutate()}>Finalise examination</DxButton>
        </>
      }
    >
      <p className="mb-4 text-[12px] text-[var(--dx-text-muted)]">
        {exam.patient_name ?? ""} · {exam.package?.name ?? ""} · {exam.results.released}/{exam.results.total} results released
      </p>
      <div className="space-y-4">
        {!exam.results.complete ? (
          <DxMessage tone="warning">
            Not all investigations are released yet. Open the patient's record to review what's in, or tick the override below to finalise anyway.
          </DxMessage>
        ) : null}
        <DxSelect label="Fitness determination" value={fitness} onChange={(e) => setFitness(e.target.value)} placeholder="— Select —"
          options={FITNESS.map(([v, l]) => ({ value: v, label: l }))} />
        <DxTextarea label="Clinical assessment" rows={3} value={findings} onChange={(e) => setFindings(e.target.value)} />
        <DxTextarea label="Recommendations" rows={2} value={recs} onChange={(e) => setRecs(e.target.value)} />
        <DxTextarea label="Restrictions / limitations" rows={2} value={restrictions} onChange={(e) => setRestrictions(e.target.value)} />
        {!exam.results.complete ? (
          <DxCheckbox label="Finalise despite outstanding results (recorded in the audit trail)" checked={override_} onChange={(e) => setOverride(e.target.checked)} />
        ) : null}
      </div>
    </DxPopup>
  );
}
