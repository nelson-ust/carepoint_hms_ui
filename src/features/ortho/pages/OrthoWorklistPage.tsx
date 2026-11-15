import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, RotateCcw, Bone, Activity, Bandage, CheckCircle2, Banknote, Search, UserRound } from "lucide-react";
import {
  DxBadge, DxButton, DxGrid, DxKpi, DxPage, DxPageHeader, DxPageLoading, DxPanel,
  DxPopup, DxInput, DxTextarea, DxSelect, DxMessage, apiErrorMessage, type DxGridColumn,
} from "@/components/dx";
import { routes } from "@/config/routes";
import { useToast } from "@/components/feedback/ToastProvider";
import { searchPatients } from "@/features/patients/api/patients.api";
import { orthoApi, LATERALITY_OPTIONS, lateralityLabel, type OrthoAssessment } from "../api/ortho.api";

const naira = (n?: string | number | null) => `₦ ${Number(n ?? 0).toLocaleString()}`;

function PatientPicker({ value, onPick }: { value: { id: number; name: string } | null; onPick: (p: { id: number; name: string } | null) => void }) {
  const [term, setTerm] = useState("");
  const q = useQuery({ queryKey: ["patient-search", term], queryFn: () => searchPatients(term, 8), enabled: term.trim().length >= 2 });
  const items = (q.data?.items ?? []) as Array<{ id: number; first_name: string; last_name: string; hospital_number?: string }>;
  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] px-3 py-2">
        <span className="flex items-center gap-2 text-[13px] font-semibold"><UserRound className="h-4 w-4 text-[var(--dx-accent)]" />{value.name}</span>
        <DxButton size="sm" variant="text" onClick={() => onPick(null)}>Change</DxButton>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <DxInput leftIcon={<Search className="h-4 w-4 text-[var(--dx-text-faint)]" />} placeholder="Search patient by name, hospital no. or phone" value={term} onChange={(e) => setTerm(e.target.value)} />
      {term.trim().length >= 2 ? (
        <div className="max-h-52 overflow-auto rounded-md border border-[var(--dx-border)]">
          {q.isLoading ? (
            <p className="px-3 py-3 text-[12.5px] text-[var(--dx-text-muted)]">Searching...</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-3 text-[12.5px] text-[var(--dx-text-muted)]">No patients found.</p>
          ) : (
            items.map((p) => (
              <button key={p.id} type="button" onClick={() => onPick({ id: p.id, name: `${p.first_name} ${p.last_name}` })}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-[var(--dx-surface-hover)]">
                <span className="font-medium">{p.first_name} {p.last_name}</span>
                <span className="text-[11.5px] text-[var(--dx-text-muted)]">{p.hospital_number}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export function OrthoWorklistPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [patient, setPatient] = useState<{ id: number; name: string } | null>(null);
  const [region, setRegion] = useState("");
  const [laterality, setLaterality] = useState("NOT_APPLICABLE");
  const [complaint, setComplaint] = useState("");

  const list = useQuery({ queryKey: ["ortho", "assessments"], queryFn: () => orthoApi.listAssessments({ limit: 100 }) });
  const stats = useQuery({ queryKey: ["ortho", "stats"], queryFn: orthoApi.stats });

  const create = useMutation({
    mutationFn: () => orthoApi.createAssessment({ patient_id: patient!.id, region: region || null, laterality, chief_complaint: complaint || null }),
    onSuccess: (a) => {
      toast.success("Assessment started.");
      qc.invalidateQueries({ queryKey: ["ortho"] });
      setOpen(false); setPatient(null); setRegion(""); setComplaint(""); setLaterality("NOT_APPLICABLE");
      navigate(routes.orthoAssessment.replace(":assessmentId", String(a.id)));
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const s = stats.data;
  const columns: DxGridColumn<OrthoAssessment>[] = [
    { key: "patient", header: "Patient", render: (r) => (
      <div className="min-w-0"><div className="truncate font-semibold">{r.patient?.name}</div>
        <div className="text-[11.5px] text-[var(--dx-text-muted)]">{r.patient?.hospital_number}</div></div>
    ) },
    { key: "region", header: "Region", render: (r) => (
      <span>{r.region ?? <span className="text-[var(--dx-text-faint)]">--</span>}{r.laterality !== "NOT_APPLICABLE" ? ` (${lateralityLabel(r.laterality)})` : ""}</span>
    ) },
    { key: "chief_complaint", header: "Complaint", render: (r) => r.chief_complaint ?? <span className="text-[var(--dx-text-faint)]">--</span> },
    { key: "fracture_count", header: "Fractures", align: "right", render: (r) => r.fracture_count ?? 0 },
    { key: "clinician", header: "Clinician", render: (r) => r.clinician ?? <span className="text-[var(--dx-text-faint)]">--</span> },
    { key: "status", header: "Status", render: (r) => <DxBadge tone={r.status === "OPEN" ? "info" : "success"}>{r.status}</DxBadge> },
    { key: "examined_at", header: "Date", render: (r) => (r.examined_at ?? r.created_at ?? "").slice(0, 10) },
  ];

  if (list.isLoading) return <DxPageLoading label="Loading orthopaedics worklist..." />;

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Orthopaedics" }, { label: "Worklist" }]}
        title="Orthopaedics Clinic"
        subtitle="Musculoskeletal assessments, fracture management, casting and treatment plans."
        actions={
          <>
            <DxButton variant="primary" onClick={() => setOpen(true)}><Plus /> New assessment</DxButton>
            <DxButton icon title="Refresh" onClick={() => { list.refetch(); stats.refetch(); }} isLoading={list.isFetching}><RotateCcw /></DxButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <DxKpi label="Assessments" value={s?.assessments_total ?? 0} icon={Activity} tone="accent" sub={`${s?.assessments_open ?? 0} open`} />
        <DxKpi label="Fractures" value={s?.fractures_total ?? 0} icon={Bone} tone="warning" sub="recorded" />
        <DxKpi label="Active casts" value={s?.active_immobilisations ?? 0} icon={Bandage} tone="info" sub="in place" />
        <DxKpi label="Planned procedures" value={s?.procedures_planned ?? 0} icon={Activity} tone="warning" sub="pending" />
        <DxKpi label="Completed" value={s?.procedures_completed ?? 0} icon={CheckCircle2} tone="success" sub="procedures" />
        <DxKpi label="Revenue" value={naira(s?.completed_revenue)} icon={Banknote} tone="success" sub="completed" />
      </div>

      <div className="mt-4">
        <DxPanel title="Orthopaedic encounters" icon={<Bone />} flush>
          <DxGrid<OrthoAssessment>
            borderless
            columns={columns}
            data={list.data?.items ?? []}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(routes.orthoAssessment.replace(":assessmentId", String(r.id)))}
            empty={{ icon: Bone, title: "No assessments yet", description: "Start a new assessment to record findings, fractures and a treatment plan." }}
          />
        </DxPanel>
      </div>

      <DxPopup isOpen={open} onClose={() => setOpen(false)} title="New orthopaedic assessment" size="md"
        footer={
          <>
            <DxButton variant="text" onClick={() => setOpen(false)}>Cancel</DxButton>
            <DxButton variant="primary" disabled={!patient} isLoading={create.isPending} onClick={() => create.mutate()}>Start assessment</DxButton>
          </>
        }>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--dx-text-muted)]">Patient</label>
            <PatientPicker value={patient} onPick={setPatient} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DxInput label="Region / joint" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. Right knee" />
            <DxSelect label="Side" value={laterality} onChange={(e) => setLaterality(e.target.value)} options={LATERALITY_OPTIONS} />
          </div>
          <DxTextarea label="Chief complaint" rows={2} value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="e.g. Pain and swelling after a fall" />
          <DxMessage tone="info">The full assessment, fractures and treatment plan open once created.</DxMessage>
        </div>
      </DxPopup>
    </DxPage>
  );
}
