import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Save, Plus, Stethoscope, ClipboardList, CheckCircle2, Trash2 } from "lucide-react";
import {
  DxBadge, DxButton, DxGrid, DxPage, DxPageHeader, DxPageLoading, DxPanel, DxPopup,
  DxInput, DxSelect, DxTextarea, apiErrorMessage, type DxGridColumn,
} from "@/components/dx";
import { routes } from "@/config/routes";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  dentalApi, DENTAL_CONDITIONS, TOOTH_CONDITION_META, FDI_PERMANENT, FDI_PRIMARY,
  type DentalChart, type ToothRecord, type DentalToothCondition, type DentalProcedure,
} from "../api/dental.api";

const naira = (n?: string | number | null) => `₦ ${Number(n ?? 0).toLocaleString()}`;

function Tooth({ n, rec, onClick }: { n: number; rec?: ToothRecord; onClick: () => void }) {
  const meta = rec ? TOOTH_CONDITION_META[rec.condition] : null;
  const charted = rec && rec.condition !== "HEALTHY";
  return (
    <button type="button" onClick={onClick} title={`Tooth ${n}${rec ? ` - ${TOOTH_CONDITION_META[rec.condition].label}` : ""}`}
      className="flex h-11 w-9 flex-col items-center justify-center rounded border text-[10px] font-semibold transition hover:ring-2 hover:ring-[var(--dx-accent)]/40"
      style={{
        borderColor: charted ? meta!.color : "var(--dx-border)",
        background: charted ? `${meta!.color}22` : "var(--dx-surface)",
        color: charted ? meta!.color : "var(--dx-text-muted)",
      }}>
      <span className="text-[11px] text-[var(--dx-text)]">{n}</span>
      {rec?.surfaces ? <span className="text-[8px] uppercase">{rec.surfaces}</span> : null}
    </button>
  );
}

export function DentalChartPage() {
  const { chartId } = useParams();
  const id = Number(chartId);
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const chartQ = useQuery({ queryKey: ["dental", "chart", id], queryFn: () => dentalApi.getChart(id), enabled: !!id });
  const chart = chartQ.data;

  // tooth editor
  const [tooth, setTooth] = useState<number | null>(null);
  const [tCond, setTCond] = useState<DentalToothCondition>("CARIES");
  const [tSurf, setTSurf] = useState("");
  const [tMob, setTMob] = useState("");
  const [tNote, setTNote] = useState("");

  // exam fields
  const [exam, setExam] = useState<Partial<DentalChart>>({});
  useEffect(() => {
    if (chart) setExam({
      chief_complaint: chart.chief_complaint ?? "", oral_hygiene: chart.oral_hygiene ?? "",
      occlusion_note: chart.occlusion_note ?? "", soft_tissue_note: chart.soft_tissue_note ?? "",
      periodontal_summary: chart.periodontal_summary ?? "", xray_findings: chart.xray_findings ?? "",
      note: chart.note ?? "",
    });
  }, [chart?.id]);

  const teethMap = useMemo(() => {
    const m = new Map<number, ToothRecord>();
    (chart?.teeth ?? []).forEach((t) => m.set(t.tooth_number, t));
    return m;
  }, [chart?.teeth]);

  const layout = chart?.dentition === "PRIMARY" ? FDI_PRIMARY : FDI_PERMANENT;
  const topRow = [...layout.upperRight, ...layout.upperLeft];
  const bottomRow = [...layout.lowerRight, ...layout.lowerLeft];

  const openTooth = (n: number) => {
    const rec = teethMap.get(n);
    setTooth(n);
    setTCond(rec?.condition && rec.condition !== "HEALTHY" ? rec.condition : "CARIES");
    setTSurf(rec?.surfaces ?? "");
    setTMob(rec?.mobility != null ? String(rec.mobility) : "");
    setTNote(rec?.note ?? "");
  };

  const saveTooth = useMutation({
    mutationFn: (clear?: boolean) => dentalApi.setTeeth(id, [{
      tooth_number: tooth!,
      condition: clear ? "HEALTHY" : tCond,
      surfaces: clear ? null : (tSurf || null),
      mobility: clear ? null : (tMob ? Number(tMob) : null),
      note: clear ? null : (tNote || null),
    }]),
    onSuccess: () => { toast.success("Tooth updated."); qc.invalidateQueries({ queryKey: ["dental", "chart", id] }); setTooth(null); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const saveExam = useMutation({
    mutationFn: () => dentalApi.updateChart(id, exam as Record<string, unknown>),
    onSuccess: () => { toast.success("Examination saved."); qc.invalidateQueries({ queryKey: ["dental", "chart", id] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const closeChart = useMutation({
    mutationFn: () => dentalApi.updateChart(id, { status: "CLOSED" }),
    onSuccess: () => { toast.success("Chart finalized."); qc.invalidateQueries({ queryKey: ["dental"] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  // procedure add
  const [procOpen, setProcOpen] = useState(false);
  const [pName, setPName] = useState("");
  const [pTooth, setPTooth] = useState("");
  const [pCost, setPCost] = useState("");
  const [pNote, setPNote] = useState("");
  const addProc = useMutation({
    mutationFn: () => dentalApi.createProcedure({
      patient_id: chart!.patient_id, chart_id: id, visit_id: chart!.visit_id ?? null,
      procedure_name: pName, tooth_number: pTooth ? Number(pTooth) : null,
      cost: pCost ? Number(pCost) : null, note: pNote || null,
    }),
    onSuccess: () => { toast.success("Procedure added."); qc.invalidateQueries({ queryKey: ["dental", "chart", id] });
      setProcOpen(false); setPName(""); setPTooth(""); setPCost(""); setPNote(""); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const setProcStatus = useMutation({
    mutationFn: ({ pid, status }: { pid: number; status: string }) => dentalApi.updateProcedure(pid, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dental", "chart", id] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (chartQ.isLoading || !chart) return <DxPageLoading label="Loading dental chart..." />;

  const procColumns: DxGridColumn<DentalProcedure>[] = [
    { key: "tooth_number", header: "Tooth", align: "right", render: (r) => r.tooth_number ?? "--" },
    { key: "procedure_name", header: "Procedure", render: (r) => <span className="font-semibold">{r.procedure_name}</span> },
    { key: "cost", header: "Cost", align: "right", render: (r) => (r.cost ? naira(r.cost) : "--") },
    { key: "status", header: "Status", render: (r) => (
      <DxBadge tone={r.status === "COMPLETED" ? "success" : r.status === "CANCELLED" ? "neutral" : "warning"}>{r.status}</DxBadge>
    ) },
    { key: "actions", header: "", align: "right", render: (r) => (
      r.status !== "COMPLETED" && r.status !== "CANCELLED" ? (
        <DxButton size="sm" variant="text" onClick={() => setProcStatus.mutate({ pid: r.id, status: "COMPLETED" })}>Mark done</DxButton>
      ) : null
    ) },
  ];

  const chartedCount = (chart.teeth ?? []).filter((t) => t.condition !== "HEALTHY").length;

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Dental", to: routes.dentalWorklist }, { label: chart.patient?.name ?? "Chart" }]}
        title={`Dental Chart - ${chart.patient?.name ?? ""}`}
        subtitle={`${chart.patient?.hospital_number ?? ""} ${chart.patient?.age != null ? `- ${chart.patient.age}y` : ""} ${chart.patient?.gender ?? ""} - ${chart.numbering_system} - ${chart.dentition.toLowerCase()} dentition`}
        actions={
          <>
            <DxBadge tone={chart.status === "OPEN" ? "info" : "success"}>{chart.status}</DxBadge>
            {chart.status === "OPEN" ? (
              <DxButton onClick={() => closeChart.mutate()} isLoading={closeChart.isPending}><CheckCircle2 /> Finalize</DxButton>
            ) : null}
            <DxButton icon title="Refresh" onClick={() => chartQ.refetch()} isLoading={chartQ.isFetching}><RotateCcw /></DxButton>
          </>
        }
      />

      <DxPanel title="Odontogram (FDI)" icon={<Stethoscope />} description={`${chartedCount} teeth charted - click any tooth to record a finding.`}>
        <div className="space-y-2 overflow-x-auto py-2">
          <div className="flex justify-center gap-1">
            {topRow.map((n, i) => (
              <Fragment key={n}>
                <Tooth n={n} rec={teethMap.get(n)} onClick={() => openTooth(n)} />
                {i === topRow.length / 2 - 1 ? <div className="w-2" /> : null}
              </Fragment>
            ))}
          </div>
          <div className="flex justify-center gap-1">
            {bottomRow.map((n, i) => (
              <Fragment key={n}>
                <Tooth n={n} rec={teethMap.get(n)} onClick={() => openTooth(n)} />
                {i === bottomRow.length / 2 - 1 ? <div className="w-2" /> : null}
              </Fragment>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--dx-border)] pt-2.5">
          {DENTAL_CONDITIONS.filter((c) => c !== "HEALTHY").map((c) => (
            <span key={c} className="inline-flex items-center gap-1 text-[11px] text-[var(--dx-text-muted)]">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TOOTH_CONDITION_META[c].color }} />
              {TOOTH_CONDITION_META[c].label}
            </span>
          ))}
        </div>
      </DxPanel>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <DxPanel title="Examination" icon={<ClipboardList />}
          actions={<DxButton size="sm" variant="primary" onClick={() => saveExam.mutate()} isLoading={saveExam.isPending}><Save /> Save</DxButton>}>
          <div className="space-y-3">
            <DxTextarea label="Chief complaint" rows={2} value={exam.chief_complaint ?? ""} onChange={(e) => setExam((x) => ({ ...x, chief_complaint: e.target.value }))} />
            <div className="grid gap-3 sm:grid-cols-2">
              <DxSelect label="Oral hygiene" value={exam.oral_hygiene ?? ""} onChange={(e) => setExam((x) => ({ ...x, oral_hygiene: e.target.value }))}
                placeholder="Select" options={[{ value: "GOOD", label: "Good" }, { value: "FAIR", label: "Fair" }, { value: "POOR", label: "Poor" }]} />
              <DxInput label="Occlusion" value={exam.occlusion_note ?? ""} onChange={(e) => setExam((x) => ({ ...x, occlusion_note: e.target.value }))} placeholder="e.g. Class I" />
            </div>
            <DxTextarea label="Soft tissue findings" rows={2} value={exam.soft_tissue_note ?? ""} onChange={(e) => setExam((x) => ({ ...x, soft_tissue_note: e.target.value }))} />
            <DxTextarea label="Periodontal summary" rows={2} value={exam.periodontal_summary ?? ""} onChange={(e) => setExam((x) => ({ ...x, periodontal_summary: e.target.value }))} />
            <DxTextarea label="Radiographic findings" rows={2} value={exam.xray_findings ?? ""} onChange={(e) => setExam((x) => ({ ...x, xray_findings: e.target.value }))} />
          </div>
        </DxPanel>

        <DxPanel title="Treatment plan" icon={<ClipboardList />}
          actions={<DxButton size="sm" variant="primary" onClick={() => setProcOpen(true)}><Plus /> Add procedure</DxButton>} flush>
          <DxGrid<DentalProcedure>
            borderless
            columns={procColumns}
            data={chart.procedures ?? []}
            rowKey={(r) => r.id}
            empty={{ icon: ClipboardList, title: "No procedures yet", description: "Add planned or completed treatments." }}
          />
        </DxPanel>
      </div>

      {/* Tooth editor */}
      <DxPopup isOpen={tooth != null} onClose={() => setTooth(null)} title={`Tooth ${tooth ?? ""}`} size="sm"
        footer={
          <>
            {teethMap.get(tooth ?? -1) ? (
              <DxButton variant="outline-danger" onClick={() => saveTooth.mutate(true)} isLoading={saveTooth.isPending}><Trash2 /> Clear</DxButton>
            ) : null}
            <div className="flex-1" />
            <DxButton variant="text" onClick={() => setTooth(null)}>Cancel</DxButton>
            <DxButton variant="primary" onClick={() => saveTooth.mutate(false)} isLoading={saveTooth.isPending}>Save</DxButton>
          </>
        }>
        <div className="space-y-3">
          <DxSelect label="Condition" value={tCond} onChange={(e) => setTCond(e.target.value as DentalToothCondition)}
            options={DENTAL_CONDITIONS.filter((c) => c !== "HEALTHY").map((c) => ({ value: c, label: TOOTH_CONDITION_META[c].label }))} />
          <div className="grid grid-cols-2 gap-3">
            <DxInput label="Surfaces" value={tSurf} onChange={(e) => setTSurf(e.target.value.toUpperCase())} placeholder="MOD" hint="M O D B/F L I" />
            <DxSelect label="Mobility" value={tMob} onChange={(e) => setTMob(e.target.value)} placeholder="None"
              options={[{ value: "0", label: "0" }, { value: "1", label: "I" }, { value: "2", label: "II" }, { value: "3", label: "III" }]} />
          </div>
          <DxTextarea label="Note" rows={2} value={tNote} onChange={(e) => setTNote(e.target.value)} />
        </div>
      </DxPopup>

      {/* Add procedure */}
      <DxPopup isOpen={procOpen} onClose={() => setProcOpen(false)} title="Add procedure" size="md"
        footer={
          <>
            <DxButton variant="text" onClick={() => setProcOpen(false)}>Cancel</DxButton>
            <DxButton variant="primary" disabled={!pName} isLoading={addProc.isPending} onClick={() => addProc.mutate()}>Add</DxButton>
          </>
        }>
        <div className="space-y-3">
          <DxInput label="Procedure" required value={pName} onChange={(e) => setPName(e.target.value)} placeholder="e.g. Composite restoration" />
          <div className="grid grid-cols-2 gap-3">
            <DxInput label="Tooth number" value={pTooth} onChange={(e) => setPTooth(e.target.value)} placeholder="e.g. 36" inputMode="numeric" />
            <DxInput label="Cost" value={pCost} onChange={(e) => setPCost(e.target.value)} placeholder="0.00" inputMode="decimal" unit={"₦"} />
          </div>
          <DxTextarea label="Note" rows={2} value={pNote} onChange={(e) => setPNote(e.target.value)} />
        </div>
      </DxPopup>
    </DxPage>
  );
}
