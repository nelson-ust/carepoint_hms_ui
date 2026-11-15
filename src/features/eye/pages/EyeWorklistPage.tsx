import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, RotateCcw, Eye, Glasses, ClipboardList, AlertTriangle, Search, UserRound } from "lucide-react";
import {
  DxBadge, DxButton, DxGrid, DxKpi, DxPage, DxPageHeader, DxPageLoading, DxPanel,
  DxPopup, DxInput, DxTextarea, DxMessage, apiErrorMessage, type DxGridColumn,
} from "@/components/dx";
import { routes } from "@/config/routes";
import { useToast } from "@/components/feedback/ToastProvider";
import { searchPatients } from "@/features/patients/api/patients.api";
import { eyeApi, type EyeExam } from "../api/eye.api";

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

export function EyeWorklistPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [patient, setPatient] = useState<{ id: number; name: string } | null>(null);
  const [complaint, setComplaint] = useState("");

  const exams = useQuery({ queryKey: ["eye", "exams"], queryFn: () => eyeApi.listExams({ limit: 100 }) });
  const stats = useQuery({ queryKey: ["eye", "stats"], queryFn: eyeApi.stats });

  const create = useMutation({
    mutationFn: () => eyeApi.createExam({ patient_id: patient!.id, chief_complaint: complaint || null }),
    onSuccess: (e) => {
      toast.success("Eye exam started.");
      qc.invalidateQueries({ queryKey: ["eye"] });
      setOpen(false); setPatient(null); setComplaint("");
      navigate(routes.eyeExam.replace(":examId", String(e.id)));
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const s = stats.data;
  const columns: DxGridColumn<EyeExam>[] = [
    { key: "patient", header: "Patient", render: (r) => (
      <div className="min-w-0"><div className="truncate font-semibold">{r.patient?.name}</div>
        <div className="text-[11.5px] text-[var(--dx-text-muted)]">{r.patient?.hospital_number}</div></div>
    ) },
    { key: "chief_complaint", header: "Chief complaint", render: (r) => r.chief_complaint ?? <span className="text-[var(--dx-text-faint)]">--</span> },
    { key: "va", header: "VA (OD/OS)", render: (r) => `${r.va_dist_aided_od ?? r.va_dist_unaided_od ?? "--"} / ${r.va_dist_aided_os ?? r.va_dist_unaided_os ?? "--"}` },
    { key: "iop", header: "IOP", render: (r) => {
      const hi = Number(r.iop_od ?? 0) > 21 || Number(r.iop_os ?? 0) > 21;
      return <span className={hi ? "font-semibold text-[var(--dx-danger)]" : ""}>{r.iop_od ?? "--"} / {r.iop_os ?? "--"}</span>;
    } },
    { key: "clinician", header: "Clinician", render: (r) => r.clinician ?? <span className="text-[var(--dx-text-faint)]">--</span> },
    { key: "status", header: "Status", render: (r) => <DxBadge tone={r.status === "OPEN" ? "info" : "success"}>{r.status}</DxBadge> },
    { key: "examined_at", header: "Date", render: (r) => (r.examined_at ?? r.created_at ?? "").slice(0, 10) },
  ];

  if (exams.isLoading) return <DxPageLoading label="Loading eye worklist..." />;

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Eye Clinic" }, { label: "Worklist" }]}
        title="Eye Clinic"
        subtitle="Visual acuity, refraction, intraocular pressure, segment findings and spectacle prescriptions."
        actions={
          <>
            <DxButton variant="primary" onClick={() => setOpen(true)}><Plus /> New exam</DxButton>
            <DxButton icon title="Refresh" onClick={() => { exams.refetch(); stats.refetch(); }} isLoading={exams.isFetching}><RotateCcw /></DxButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DxKpi label="Eye exams" value={s?.exams_total ?? 0} icon={Eye} tone="accent" sub={`${s?.exams_open ?? 0} open`} />
        <DxKpi label="Open exams" value={s?.exams_open ?? 0} icon={ClipboardList} tone="info" sub="in progress" />
        <DxKpi label="Spectacle Rx" value={s?.prescriptions_total ?? 0} icon={Glasses} tone="success" sub="issued" />
        <DxKpi label="Raised IOP" value={s?.raised_iop_flagged ?? 0} icon={AlertTriangle} tone={(s?.raised_iop_flagged ?? 0) > 0 ? "danger" : "neutral"} sub="> 21 mmHg" />
      </div>

      <div className="mt-4">
        <DxPanel title="Eye encounters" icon={<Eye />} flush>
          <DxGrid<EyeExam>
            borderless
            columns={columns}
            data={exams.data?.items ?? []}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(routes.eyeExam.replace(":examId", String(r.id)))}
            empty={{ icon: Eye, title: "No eye exams yet", description: "Start a new exam to record acuity, refraction and findings." }}
          />
        </DxPanel>
      </div>

      <DxPopup isOpen={open} onClose={() => setOpen(false)} title="New eye exam" size="md"
        footer={
          <>
            <DxButton variant="text" onClick={() => setOpen(false)}>Cancel</DxButton>
            <DxButton variant="primary" disabled={!patient} isLoading={create.isPending} onClick={() => create.mutate()}>Start exam</DxButton>
          </>
        }>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--dx-text-muted)]">Patient</label>
            <PatientPicker value={patient} onPick={setPatient} />
          </div>
          <DxTextarea label="Chief complaint" rows={2} value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="e.g. Blurred distance vision for 2 months" />
          <DxMessage tone="info">The full examination form opens once the exam is created.</DxMessage>
        </div>
      </DxPopup>
    </DxPage>
  );
}
