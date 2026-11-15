import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Save, Plus, Bone, Activity, Bandage, ClipboardList, CheckCircle2, Trash2 } from "lucide-react";
import {
  DxBadge, DxButton, DxGrid, DxPage, DxPageHeader, DxPageLoading, DxPanel, DxPopup,
  DxInput, DxSelect, DxTextarea, DxCheckbox, apiErrorMessage, type DxGridColumn,
} from "@/components/dx";
import { routes } from "@/config/routes";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  orthoApi, LATERALITY_OPTIONS, IMMOBILISATION_TYPES, lateralityLabel,
  type OrthoAssessment, type OrthoProcedure,
} from "../api/ortho.api";

const naira = (n?: string | number | null) => `₦ ${Number(n ?? 0).toLocaleString()}`;

export function OrthoAssessmentPage() {
  const { assessmentId } = useParams();
  const id = Number(assessmentId);
  const toast = useToast();
  const qc = useQueryClient();

  const aQ = useQuery({ queryKey: ["ortho", "assessment", id], queryFn: () => orthoApi.getAssessment(id), enabled: !!id });
  const a = aQ.data;

  const [form, setForm] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  useEffect(() => {
    if (!a) return;
    const keys = ["region", "laterality", "chief_complaint", "mechanism_of_injury", "injury_date",
      "pain_score", "rom_note", "neurovascular_note", "special_tests", "provisional_diagnosis",
      "imaging_modality", "imaging_findings", "plan_note"];
    const next: Record<string, string> = {};
    keys.forEach((k) => { const v = (a as Record<string, unknown>)[k]; next[k] = v == null ? "" : String(v); });
    setForm(next);
  }, [a?.id]);

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {};
      Object.entries(form).forEach(([k, v]) => { payload[k] = v === "" ? null : v; });
      if (payload.pain_score != null) payload.pain_score = Number(payload.pain_score);
      return orthoApi.updateAssessment(id, payload);
    },
    onSuccess: () => { toast.success("Assessment saved."); qc.invalidateQueries({ queryKey: ["ortho", "assessment", id] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const closeA = useMutation({
    mutationFn: () => orthoApi.updateAssessment(id, { status: "CLOSED" }),
    onSuccess: () => { toast.success("Assessment finalized."); qc.invalidateQueries({ queryKey: ["ortho"] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  // fracture dialog
  const [frOpen, setFrOpen] = useState(false);
  const [fr, setFr] = useState<Record<string, string | boolean>>({ side: "NOT_APPLICABLE" });
  const setFrF = (k: string, v: string | boolean) => setFr((f) => ({ ...f, [k]: v }));
  const addFr = useMutation({
    mutationFn: () => orthoApi.addFracture(id, {
      bone: fr.bone, side: fr.side || "NOT_APPLICABLE", pattern: fr.pattern || null,
      classification: fr.classification || null, is_open: !!fr.is_open, is_displaced: !!fr.is_displaced,
      management: fr.management || null, note: fr.note || null,
    } as Record<string, unknown>),
    onSuccess: () => { toast.success("Fracture recorded."); qc.invalidateQueries({ queryKey: ["ortho", "assessment", id] });
      setFrOpen(false); setFr({ side: "NOT_APPLICABLE" }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const delFr = useMutation({
    mutationFn: (fid: number) => orthoApi.deleteFracture(fid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ortho", "assessment", id] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  // immobilisation dialog
  const [imOpen, setImOpen] = useState(false);
  const [im, setIm] = useState<Record<string, string>>({ device_type: "Plaster cast", side: "NOT_APPLICABLE" });
  const setImF = (k: string, v: string) => setIm((f) => ({ ...f, [k]: v }));
  const addIm = useMutation({
    mutationFn: () => orthoApi.addImmobilisation(id, {
      device_type: im.device_type, body_part: im.body_part || null, side: im.side || "NOT_APPLICABLE",
      expected_removal_date: im.expected_removal_date || null, note: im.note || null,
    }),
    onSuccess: () => { toast.success("Immobilisation recorded."); qc.invalidateQueries({ queryKey: ["ortho", "assessment", id] });
      setImOpen(false); setIm({ device_type: "Plaster cast", side: "NOT_APPLICABLE" }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const removeIm = useMutation({
    mutationFn: (iid: number) => orthoApi.removeImmobilisation(iid, {}),
    onSuccess: () => { toast.success("Marked removed."); qc.invalidateQueries({ queryKey: ["ortho", "assessment", id] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  // procedure dialog
  const [prOpen, setPrOpen] = useState(false);
  const [pr, setPr] = useState<Record<string, string>>({ laterality: "NOT_APPLICABLE" });
  const setPrF = (k: string, v: string) => setPr((f) => ({ ...f, [k]: v }));
  const addPr = useMutation({
    mutationFn: () => orthoApi.createProcedure({
      patient_id: a!.patient_id, assessment_id: id, visit_id: a!.visit_id ?? null,
      procedure_name: pr.procedure_name, laterality: pr.laterality || "NOT_APPLICABLE",
      cost: pr.cost ? Number(pr.cost) : null, note: pr.note || null,
    }),
    onSuccess: () => { toast.success("Procedure added."); qc.invalidateQueries({ queryKey: ["ortho", "assessment", id] });
      setPrOpen(false); setPr({ laterality: "NOT_APPLICABLE" }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const setPrStatus = useMutation({
    mutationFn: ({ pid, status }: { pid: number; status: string }) => orthoApi.updateProcedure(pid, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ortho", "assessment", id] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (aQ.isLoading || !a) return <DxPageLoading label="Loading assessment..." />;

  const procColumns: DxGridColumn<OrthoProcedure>[] = [
    { key: "procedure_name", header: "Procedure", render: (r) => (
      <span className="font-semibold">{r.procedure_name}{r.laterality !== "NOT_APPLICABLE" ? ` (${lateralityLabel(r.laterality)})` : ""}</span>
    ) },
    { key: "cost", header: "Cost", align: "right", render: (r) => (r.cost ? naira(r.cost) : "--") },
    { key: "status", header: "Status", render: (r) => (
      <DxBadge tone={r.status === "COMPLETED" ? "success" : r.status === "CANCELLED" ? "neutral" : "warning"}>{r.status}</DxBadge>
    ) },
    { key: "actions", header: "", align: "right", render: (r) => (
      r.status !== "COMPLETED" && r.status !== "CANCELLED" ? (
        <DxButton size="sm" variant="text" onClick={() => setPrStatus.mutate({ pid: r.id, status: "COMPLETED" })}>Mark done</DxButton>
      ) : null
    ) },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Orthopaedics", to: routes.orthoWorklist }, { label: a.patient?.name ?? "Assessment" }]}
        title={`Orthopaedic Assessment - ${a.patient?.name ?? ""}`}
        subtitle={`${a.patient?.hospital_number ?? ""} ${a.patient?.age != null ? `- ${a.patient.age}y` : ""} ${a.patient?.gender ?? ""}${a.region ? ` - ${a.region}` : ""}`}
        actions={
          <>
            <DxBadge tone={a.status === "OPEN" ? "info" : "success"}>{a.status}</DxBadge>
            <DxButton variant="primary" onClick={() => save.mutate()} isLoading={save.isPending}><Save /> Save</DxButton>
            {a.status === "OPEN" ? (
              <DxButton onClick={() => closeA.mutate()} isLoading={closeA.isPending}><CheckCircle2 /> Finalize</DxButton>
            ) : null}
            <DxButton icon title="Refresh" onClick={() => aQ.refetch()} isLoading={aQ.isFetching}><RotateCcw /></DxButton>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <DxPanel title="History & examination" icon={<ClipboardList />}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <DxInput label="Region / joint" value={form.region ?? ""} onChange={(e) => set("region", e.target.value)} placeholder="e.g. Right knee" />
              <DxSelect label="Side" value={form.laterality ?? "NOT_APPLICABLE"} onChange={(e) => set("laterality", e.target.value)} options={LATERALITY_OPTIONS} />
            </div>
            <DxTextarea label="Chief complaint" rows={2} value={form.chief_complaint ?? ""} onChange={(e) => set("chief_complaint", e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <DxInput label="Injury date" type="date" value={form.injury_date ?? ""} onChange={(e) => set("injury_date", e.target.value)} />
              <DxInput label="Pain score (0-10)" type="number" min={0} max={10} value={form.pain_score ?? ""} onChange={(e) => set("pain_score", e.target.value)} />
            </div>
            <DxTextarea label="Mechanism of injury" rows={2} value={form.mechanism_of_injury ?? ""} onChange={(e) => set("mechanism_of_injury", e.target.value)} />
            <DxTextarea label="Range of motion" rows={2} value={form.rom_note ?? ""} onChange={(e) => set("rom_note", e.target.value)} />
            <DxTextarea label="Neurovascular status" rows={2} value={form.neurovascular_note ?? ""} onChange={(e) => set("neurovascular_note", e.target.value)} />
            <DxTextarea label="Special tests" rows={2} value={form.special_tests ?? ""} onChange={(e) => set("special_tests", e.target.value)} />
          </div>
        </DxPanel>

        <div className="space-y-4">
          <DxPanel title="Imaging & impression" icon={<Activity />}>
            <div className="space-y-3">
              <DxSelect label="Imaging modality" value={form.imaging_modality ?? ""} onChange={(e) => set("imaging_modality", e.target.value)}
                placeholder="Select" options={[{ value: "XRAY", label: "X-ray" }, { value: "CT", label: "CT" }, { value: "MRI", label: "MRI" }, { value: "ULTRASOUND", label: "Ultrasound" }, { value: "NONE", label: "None" }]} />
              <DxTextarea label="Imaging findings" rows={2} value={form.imaging_findings ?? ""} onChange={(e) => set("imaging_findings", e.target.value)} />
              <DxTextarea label="Provisional diagnosis" rows={2} value={form.provisional_diagnosis ?? ""} onChange={(e) => set("provisional_diagnosis", e.target.value)} />
              <DxTextarea label="Plan / management" rows={2} value={form.plan_note ?? ""} onChange={(e) => set("plan_note", e.target.value)} />
            </div>
          </DxPanel>

          <DxPanel title="Fractures" icon={<Bone />}
            actions={<DxButton size="sm" variant="primary" onClick={() => setFrOpen(true)}><Plus /> Add</DxButton>} flush>
            <div className="divide-y divide-[var(--dx-border)]">
              {(a.fractures ?? []).length === 0 ? (
                <p className="px-3 py-5 text-center text-[12.5px] text-[var(--dx-text-muted)]">No fractures recorded.</p>
              ) : (
                (a.fractures ?? []).map((f) => (
                  <div key={f.id} className="flex items-start justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0 text-[12.5px]">
                      <div className="font-semibold text-[var(--dx-text)]">{f.bone}{f.side !== "NOT_APPLICABLE" ? ` - ${lateralityLabel(f.side)}` : ""}</div>
                      <div className="text-[11.5px] text-[var(--dx-text-muted)]">
                        {[f.pattern, f.classification, f.management].filter(Boolean).join(" - ") || "--"}
                        {f.is_open ? " - Open" : ""}{f.is_displaced ? " - Displaced" : ""}
                      </div>
                    </div>
                    <DxButton size="sm" variant="text" onClick={() => delFr.mutate(f.id)}><Trash2 className="h-3.5 w-3.5" /></DxButton>
                  </div>
                ))
              )}
            </div>
          </DxPanel>

          <DxPanel title="Immobilisation" icon={<Bandage />}
            actions={<DxButton size="sm" variant="primary" onClick={() => setImOpen(true)}><Plus /> Add</DxButton>} flush>
            <div className="divide-y divide-[var(--dx-border)]">
              {(a.immobilisations ?? []).length === 0 ? (
                <p className="px-3 py-5 text-center text-[12.5px] text-[var(--dx-text-muted)]">No casts or splints.</p>
              ) : (
                (a.immobilisations ?? []).map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0 text-[12.5px]">
                      <div className="font-semibold text-[var(--dx-text)]">{m.device_type}{m.body_part ? ` - ${m.body_part}` : ""}{m.side !== "NOT_APPLICABLE" ? ` (${lateralityLabel(m.side)})` : ""}</div>
                      <div className="text-[11.5px] text-[var(--dx-text-muted)]">
                        {m.applied_date ? `Applied ${m.applied_date}` : ""}{m.expected_removal_date ? ` - due ${m.expected_removal_date}` : ""}{m.removed_date ? ` - removed ${m.removed_date}` : ""}
                      </div>
                    </div>
                    {m.active ? (
                      <DxButton size="sm" variant="text" onClick={() => removeIm.mutate(m.id)}>Remove</DxButton>
                    ) : <DxBadge tone="neutral">Removed</DxBadge>}
                  </div>
                ))
              )}
            </div>
          </DxPanel>
        </div>
      </div>

      <div className="mt-4">
        <DxPanel title="Treatment plan" icon={<ClipboardList />}
          actions={<DxButton size="sm" variant="primary" onClick={() => setPrOpen(true)}><Plus /> Add procedure</DxButton>} flush>
          <DxGrid<OrthoProcedure>
            borderless
            columns={procColumns}
            data={a.procedures ?? []}
            rowKey={(r) => r.id}
            empty={{ icon: ClipboardList, title: "No procedures yet", description: "Add planned or completed procedures (reduction, fixation, injection...)." }}
          />
        </DxPanel>
      </div>

      {/* Fracture dialog */}
      <DxPopup isOpen={frOpen} onClose={() => setFrOpen(false)} title="Record fracture" size="md"
        footer={<><DxButton variant="text" onClick={() => setFrOpen(false)}>Cancel</DxButton>
          <DxButton variant="primary" disabled={!fr.bone} isLoading={addFr.isPending} onClick={() => addFr.mutate()}>Add</DxButton></>}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <DxInput label="Bone" required value={(fr.bone as string) ?? ""} onChange={(e) => setFrF("bone", e.target.value)} placeholder="e.g. Distal radius" />
            <DxSelect label="Side" value={(fr.side as string) ?? "NOT_APPLICABLE"} onChange={(e) => setFrF("side", e.target.value)} options={LATERALITY_OPTIONS} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DxInput label="Pattern" value={(fr.pattern as string) ?? ""} onChange={(e) => setFrF("pattern", e.target.value)} placeholder="Transverse / spiral / comminuted" />
            <DxInput label="Classification" value={(fr.classification as string) ?? ""} onChange={(e) => setFrF("classification", e.target.value)} placeholder="e.g. AO 23-A2" />
          </div>
          <DxSelect label="Management" value={(fr.management as string) ?? ""} onChange={(e) => setFrF("management", e.target.value)}
            placeholder="Select" options={[{ value: "CONSERVATIVE", label: "Conservative" }, { value: "SURGICAL", label: "Surgical" }]} />
          <div className="flex gap-6">
            <DxCheckbox label="Open fracture" checked={!!fr.is_open} onChange={(e) => setFrF("is_open", e.target.checked)} />
            <DxCheckbox label="Displaced" checked={!!fr.is_displaced} onChange={(e) => setFrF("is_displaced", e.target.checked)} />
          </div>
          <DxTextarea label="Note" rows={2} value={(fr.note as string) ?? ""} onChange={(e) => setFrF("note", e.target.value)} />
        </div>
      </DxPopup>

      {/* Immobilisation dialog */}
      <DxPopup isOpen={imOpen} onClose={() => setImOpen(false)} title="Add immobilisation" size="md"
        footer={<><DxButton variant="text" onClick={() => setImOpen(false)}>Cancel</DxButton>
          <DxButton variant="primary" isLoading={addIm.isPending} onClick={() => addIm.mutate()}>Add</DxButton></>}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <DxSelect label="Device" value={im.device_type ?? ""} onChange={(e) => setImF("device_type", e.target.value)}
              options={IMMOBILISATION_TYPES.map((t) => ({ value: t, label: t }))} />
            <DxSelect label="Side" value={im.side ?? "NOT_APPLICABLE"} onChange={(e) => setImF("side", e.target.value)} options={LATERALITY_OPTIONS} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DxInput label="Body part" value={im.body_part ?? ""} onChange={(e) => setImF("body_part", e.target.value)} placeholder="e.g. Forearm" />
            <DxInput label="Expected removal" type="date" value={im.expected_removal_date ?? ""} onChange={(e) => setImF("expected_removal_date", e.target.value)} />
          </div>
          <DxTextarea label="Note" rows={2} value={im.note ?? ""} onChange={(e) => setImF("note", e.target.value)} />
        </div>
      </DxPopup>

      {/* Procedure dialog */}
      <DxPopup isOpen={prOpen} onClose={() => setPrOpen(false)} title="Add procedure" size="md"
        footer={<><DxButton variant="text" onClick={() => setPrOpen(false)}>Cancel</DxButton>
          <DxButton variant="primary" disabled={!pr.procedure_name} isLoading={addPr.isPending} onClick={() => addPr.mutate()}>Add</DxButton></>}>
        <div className="space-y-3">
          <DxInput label="Procedure" required value={pr.procedure_name ?? ""} onChange={(e) => setPrF("procedure_name", e.target.value)} placeholder="e.g. Closed reduction & cast" />
          <div className="grid grid-cols-2 gap-3">
            <DxSelect label="Side" value={pr.laterality ?? "NOT_APPLICABLE"} onChange={(e) => setPrF("laterality", e.target.value)} options={LATERALITY_OPTIONS} />
            <DxInput label="Cost" value={pr.cost ?? ""} onChange={(e) => setPrF("cost", e.target.value)} placeholder="0.00" inputMode="decimal" unit={"₦"} />
          </div>
          <DxTextarea label="Note" rows={2} value={pr.note ?? ""} onChange={(e) => setPrF("note", e.target.value)} />
        </div>
      </DxPopup>
    </DxPage>
  );
}
