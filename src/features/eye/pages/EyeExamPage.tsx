import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Save, Eye, Glasses, Activity, Plus, CheckCircle2 } from "lucide-react";
import {
  DxBadge, DxButton, DxPage, DxPageHeader, DxPageLoading, DxPanel, DxPopup,
  DxInput, DxSelect, DxTextarea, apiErrorMessage,
} from "@/components/dx";
import { routes } from "@/config/routes";
import { useToast } from "@/components/feedback/ToastProvider";
import { eyeApi, LENS_TYPES, type EyeExam, type SpectaclePrescription } from "../api/eye.api";

type Form = Record<string, string>;
const str = (v: unknown) => (v == null ? "" : String(v));

function EyeRow({ label, odKey, osKey, form, set, placeholder, unit }:
  { label: string; odKey: string; osKey: string; form: Form; set: (k: string, v: string) => void; placeholder?: string; unit?: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr_1fr] items-center gap-2">
      <span className="text-[12.5px] font-medium text-[var(--dx-text-muted)]">{label}</span>
      <DxInput editorSize="sm" value={form[odKey] ?? ""} onChange={(e) => set(odKey, e.target.value)} placeholder={placeholder} unit={unit} />
      <DxInput editorSize="sm" value={form[osKey] ?? ""} onChange={(e) => set(osKey, e.target.value)} placeholder={placeholder} unit={unit} />
    </div>
  );
}

export function EyeExamPage() {
  const { examId } = useParams();
  const id = Number(examId);
  const toast = useToast();
  const qc = useQueryClient();

  const examQ = useQuery({ queryKey: ["eye", "exam", id], queryFn: () => eyeApi.getExam(id), enabled: !!id });
  const exam = examQ.data;

  const [form, setForm] = useState<Form>({});
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  useEffect(() => {
    if (!exam) return;
    const keys = [
      "chief_complaint", "history_note", "external_note",
      "va_dist_unaided_od", "va_dist_unaided_os", "va_dist_aided_od", "va_dist_aided_os",
      "va_near_od", "va_near_os", "pinhole_od", "pinhole_os",
      "ref_sphere_od", "ref_sphere_os", "ref_cyl_od", "ref_cyl_os",
      "ref_axis_od", "ref_axis_os", "ref_add_od", "ref_add_os",
      "iop_od", "iop_os", "iop_method", "anterior_od", "anterior_os",
      "posterior_od", "posterior_os", "impression", "plan_note",
    ];
    const next: Form = {};
    keys.forEach((k) => { next[k] = str((exam as Record<string, unknown>)[k]); });
    setForm(next);
  }, [exam?.id]);

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {};
      Object.entries(form).forEach(([k, v]) => { payload[k] = v === "" ? null : v; });
      return eyeApi.updateExam(id, payload);
    },
    onSuccess: () => { toast.success("Examination saved."); qc.invalidateQueries({ queryKey: ["eye", "exam", id] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const closeExam = useMutation({
    mutationFn: () => eyeApi.updateExam(id, { status: "CLOSED" }),
    onSuccess: () => { toast.success("Exam finalized."); qc.invalidateQueries({ queryKey: ["eye"] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  // spectacle Rx
  const [rxOpen, setRxOpen] = useState(false);
  const [rx, setRx] = useState<Form>({ lens_type: "SINGLE_VISION" });
  const setRxF = (k: string, v: string) => setRx((f) => ({ ...f, [k]: v }));
  const issueRx = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = { patient_id: exam!.patient_id, exam_id: id };
      ["od_sphere", "od_cyl", "od_axis", "od_add", "os_sphere", "os_cyl", "os_axis", "os_add", "pd", "lens_type", "usage", "notes"]
        .forEach((k) => { if (rx[k]) payload[k] = rx[k]; });
      return eyeApi.createPrescription(payload);
    },
    onSuccess: () => { toast.success("Prescription issued."); qc.invalidateQueries({ queryKey: ["eye", "exam", id] });
      setRxOpen(false); setRx({ lens_type: "SINGLE_VISION" }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (examQ.isLoading || !exam) return <DxPageLoading label="Loading eye exam..." />;

  const fmtRx = (r: SpectaclePrescription, eye: "od" | "os") => {
    const sph = r[`${eye}_sphere` as keyof SpectaclePrescription];
    const cyl = r[`${eye}_cyl` as keyof SpectaclePrescription];
    const axis = r[`${eye}_axis` as keyof SpectaclePrescription];
    const add = r[`${eye}_add` as keyof SpectaclePrescription];
    if (sph == null && cyl == null) return "--";
    return `${sph ?? "0.00"} / ${cyl ?? "0.00"} x ${axis ?? "--"}${add ? ` add ${add}` : ""}`;
  };

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Eye Clinic", to: routes.eyeClinic }, { label: exam.patient?.name ?? "Exam" }]}
        title={`Eye Exam - ${exam.patient?.name ?? ""}`}
        subtitle={`${exam.patient?.hospital_number ?? ""} ${exam.patient?.age != null ? `- ${exam.patient.age}y` : ""} ${exam.patient?.gender ?? ""}`}
        actions={
          <>
            <DxBadge tone={exam.status === "OPEN" ? "info" : "success"}>{exam.status}</DxBadge>
            <DxButton variant="primary" onClick={() => save.mutate()} isLoading={save.isPending}><Save /> Save</DxButton>
            {exam.status === "OPEN" ? (
              <DxButton onClick={() => closeExam.mutate()} isLoading={closeExam.isPending}><CheckCircle2 /> Finalize</DxButton>
            ) : null}
            <DxButton icon title="Refresh" onClick={() => examQ.refetch()} isLoading={examQ.isFetching}><RotateCcw /></DxButton>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <DxTextarea label="Chief complaint" rows={2} value={form.chief_complaint ?? ""} onChange={(e) => set("chief_complaint", e.target.value)} />
        <DxTextarea label="Ocular / medical history" rows={2} value={form.history_note ?? ""} onChange={(e) => set("history_note", e.target.value)} />
        <DxTextarea label="External examination" rows={2} value={form.external_note ?? ""} onChange={(e) => set("external_note", e.target.value)} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <DxPanel title="Visual acuity" icon={<Eye />} description="Right eye (OD) / Left eye (OS)">
          <div className="space-y-2">
            <div className="grid grid-cols-[120px_1fr_1fr] gap-2 text-[11px] font-semibold uppercase text-[var(--dx-text-faint)]">
              <span></span><span>OD (right)</span><span>OS (left)</span>
            </div>
            <EyeRow label="Distance unaided" odKey="va_dist_unaided_od" osKey="va_dist_unaided_os" form={form} set={set} placeholder="6/6" />
            <EyeRow label="Distance aided" odKey="va_dist_aided_od" osKey="va_dist_aided_os" form={form} set={set} placeholder="6/6" />
            <EyeRow label="Pinhole" odKey="pinhole_od" osKey="pinhole_os" form={form} set={set} placeholder="6/6" />
            <EyeRow label="Near" odKey="va_near_od" osKey="va_near_os" form={form} set={set} placeholder="N6" />
          </div>
        </DxPanel>

        <DxPanel title="Refraction" icon={<Glasses />} description="Objective / subjective refraction">
          <div className="space-y-2">
            <div className="grid grid-cols-[120px_1fr_1fr] gap-2 text-[11px] font-semibold uppercase text-[var(--dx-text-faint)]">
              <span></span><span>OD (right)</span><span>OS (left)</span>
            </div>
            <EyeRow label="Sphere (DS)" odKey="ref_sphere_od" osKey="ref_sphere_os" form={form} set={set} placeholder="-1.25" />
            <EyeRow label="Cylinder (DC)" odKey="ref_cyl_od" osKey="ref_cyl_os" form={form} set={set} placeholder="-0.50" />
            <EyeRow label="Axis" odKey="ref_axis_od" osKey="ref_axis_os" form={form} set={set} placeholder="180" />
            <EyeRow label="Add" odKey="ref_add_od" osKey="ref_add_os" form={form} set={set} placeholder="+2.00" />
          </div>
        </DxPanel>

        <DxPanel title="Intraocular pressure" icon={<Activity />}>
          <div className="space-y-2">
            <div className="grid grid-cols-[120px_1fr_1fr] gap-2 text-[11px] font-semibold uppercase text-[var(--dx-text-faint)]">
              <span></span><span>OD (right)</span><span>OS (left)</span>
            </div>
            <EyeRow label="IOP (mmHg)" odKey="iop_od" osKey="iop_os" form={form} set={set} placeholder="16" unit="mmHg" />
            <DxSelect label="Method" value={form.iop_method ?? ""} onChange={(e) => set("iop_method", e.target.value)} placeholder="Select"
              options={[{ value: "GOLDMANN", label: "Goldmann applanation" }, { value: "NCT", label: "Non-contact (air puff)" }, { value: "TONOPEN", label: "Tono-Pen" }, { value: "ICARE", label: "iCare rebound" }, { value: "DIGITAL", label: "Digital palpation" }]} />
          </div>
        </DxPanel>

        <DxPanel title="Segment findings" icon={<Eye />}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <DxTextarea label="Anterior OD" rows={2} value={form.anterior_od ?? ""} onChange={(e) => set("anterior_od", e.target.value)} />
              <DxTextarea label="Anterior OS" rows={2} value={form.anterior_os ?? ""} onChange={(e) => set("anterior_os", e.target.value)} />
              <DxTextarea label="Posterior OD" rows={2} value={form.posterior_od ?? ""} onChange={(e) => set("posterior_od", e.target.value)} />
              <DxTextarea label="Posterior OS" rows={2} value={form.posterior_os ?? ""} onChange={(e) => set("posterior_os", e.target.value)} />
            </div>
          </div>
        </DxPanel>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <DxTextarea label="Impression / diagnosis" rows={2} value={form.impression ?? ""} onChange={(e) => set("impression", e.target.value)} />
        <DxTextarea label="Plan / management" rows={2} value={form.plan_note ?? ""} onChange={(e) => set("plan_note", e.target.value)} />
      </div>

      <div className="mt-4">
        <DxPanel title="Spectacle prescriptions" icon={<Glasses />}
          actions={<DxButton size="sm" variant="primary" onClick={() => setRxOpen(true)}><Plus /> Issue Rx</DxButton>} flush>
          <div className="divide-y divide-[var(--dx-border)]">
            {(exam.prescriptions ?? []).length === 0 ? (
              <p className="px-3 py-6 text-center text-[12.5px] text-[var(--dx-text-muted)]">No spectacle prescriptions issued.</p>
            ) : (
              (exam.prescriptions ?? []).map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                  <div className="text-[12.5px]">
                    <div className="font-semibold text-[var(--dx-text)]">
                      OD {fmtRx(r, "od")} &nbsp;|&nbsp; OS {fmtRx(r, "os")}
                    </div>
                    <div className="text-[11.5px] text-[var(--dx-text-muted)]">
                      {LENS_TYPES.find((l) => l.value === r.lens_type)?.label ?? r.lens_type}
                      {r.pd ? ` - PD ${r.pd}` : ""}{r.usage ? ` - ${r.usage}` : ""}{r.prescribed_date ? ` - ${r.prescribed_date}` : ""}
                    </div>
                  </div>
                  <DxBadge tone="info">{r.prescriber ?? "Rx"}</DxBadge>
                </div>
              ))
            )}
          </div>
        </DxPanel>
      </div>

      <DxPopup isOpen={rxOpen} onClose={() => setRxOpen(false)} title="Issue spectacle prescription" size="lg"
        footer={
          <>
            <DxButton variant="text" onClick={() => setRxOpen(false)}>Cancel</DxButton>
            <DxButton variant="primary" isLoading={issueRx.isPending} onClick={() => issueRx.mutate()}>Issue</DxButton>
          </>
        }>
        <div className="space-y-3">
          <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr] items-end gap-2">
            <span className="pb-2 text-[11px] font-semibold uppercase text-[var(--dx-text-faint)]">Eye</span>
            <span className="text-[11px] font-semibold uppercase text-[var(--dx-text-faint)]">Sphere</span>
            <span className="text-[11px] font-semibold uppercase text-[var(--dx-text-faint)]">Cyl</span>
            <span className="text-[11px] font-semibold uppercase text-[var(--dx-text-faint)]">Axis</span>
            <span className="text-[11px] font-semibold uppercase text-[var(--dx-text-faint)]">Add</span>
            <span className="pb-2 text-[12.5px] font-semibold">OD</span>
            <DxInput editorSize="sm" value={rx.od_sphere ?? ""} onChange={(e) => setRxF("od_sphere", e.target.value)} placeholder="-1.25" />
            <DxInput editorSize="sm" value={rx.od_cyl ?? ""} onChange={(e) => setRxF("od_cyl", e.target.value)} placeholder="-0.50" />
            <DxInput editorSize="sm" value={rx.od_axis ?? ""} onChange={(e) => setRxF("od_axis", e.target.value)} placeholder="180" />
            <DxInput editorSize="sm" value={rx.od_add ?? ""} onChange={(e) => setRxF("od_add", e.target.value)} placeholder="+2.00" />
            <span className="pb-2 text-[12.5px] font-semibold">OS</span>
            <DxInput editorSize="sm" value={rx.os_sphere ?? ""} onChange={(e) => setRxF("os_sphere", e.target.value)} placeholder="-1.25" />
            <DxInput editorSize="sm" value={rx.os_cyl ?? ""} onChange={(e) => setRxF("os_cyl", e.target.value)} placeholder="-0.50" />
            <DxInput editorSize="sm" value={rx.os_axis ?? ""} onChange={(e) => setRxF("os_axis", e.target.value)} placeholder="180" />
            <DxInput editorSize="sm" value={rx.os_add ?? ""} onChange={(e) => setRxF("os_add", e.target.value)} placeholder="+2.00" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <DxInput label="PD (mm)" value={rx.pd ?? ""} onChange={(e) => setRxF("pd", e.target.value)} placeholder="63" />
            <DxSelect label="Lens type" value={rx.lens_type ?? "SINGLE_VISION"} onChange={(e) => setRxF("lens_type", e.target.value)} options={LENS_TYPES} />
            <DxInput label="Usage" value={rx.usage ?? ""} onChange={(e) => setRxF("usage", e.target.value)} placeholder="Constant / Reading" />
          </div>
          <DxTextarea label="Notes" rows={2} value={rx.notes ?? ""} onChange={(e) => setRxF("notes", e.target.value)} />
        </div>
      </DxPopup>
    </DxPage>
  );
}
