import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, RotateCcw, Stethoscope, ClipboardList, CheckCircle2, Banknote, Search, UserRound } from "lucide-react";
import {
  DxBadge, DxButton, DxGrid, DxKpi, DxPage, DxPageHeader, DxPageLoading, DxPanel,
  DxPopup, DxInput, DxTextarea, DxSelect, DxMessage, apiErrorMessage, type DxGridColumn,
} from "@/components/dx";
import { routes } from "@/config/routes";
import { useToast } from "@/components/feedback/ToastProvider";
import { searchPatients } from "@/features/patients/api/patients.api";
import { dentalApi, type DentalChart } from "../api/dental.api";

const naira = (n?: string | number | null) => `₦ ${Number(n ?? 0).toLocaleString()}`;

function PatientPicker({ value, onPick }: { value: { id: number; name: string } | null; onPick: (p: { id: number; name: string } | null) => void }) {
  const [term, setTerm] = useState("");
  const q = useQuery({
    queryKey: ["patient-search", term],
    queryFn: () => searchPatients(term, 8),
    enabled: term.trim().length >= 2,
  });
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

export function DentalWorklistPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [patient, setPatient] = useState<{ id: number; name: string } | null>(null);
  const [complaint, setComplaint] = useState("");
  const [dentition, setDentition] = useState("PERMANENT");

  const charts = useQuery({ queryKey: ["dental", "charts"], queryFn: () => dentalApi.listCharts({ limit: 100 }) });
  const stats = useQuery({ queryKey: ["dental", "stats"], queryFn: dentalApi.stats });

  const create = useMutation({
    mutationFn: () => dentalApi.createChart({ patient_id: patient!.id, chief_complaint: complaint || null, dentition }),
    onSuccess: (c) => {
      toast.success("Dental chart started.");
      qc.invalidateQueries({ queryKey: ["dental"] });
      setOpen(false); setPatient(null); setComplaint("");
      navigate(routes.dentalChart.replace(":chartId", String(c.id)));
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const s = stats.data;
  const columns: DxGridColumn<DentalChart>[] = [
    { key: "patient", header: "Patient", render: (r) => (
      <div className="min-w-0"><div className="truncate font-semibold">{r.patient?.name}</div>
        <div className="text-[11.5px] text-[var(--dx-text-muted)]">{r.patient?.hospital_number}</div></div>
    ) },
    { key: "chief_complaint", header: "Chief complaint", render: (r) => r.chief_complaint ?? <span className="text-[var(--dx-text-faint)]">--</span> },
    { key: "teeth_charted", header: "Teeth charted", align: "right", render: (r) => r.teeth_charted ?? 0 },
    { key: "clinician", header: "Clinician", render: (r) => r.clinician ?? <span className="text-[var(--dx-text-faint)]">--</span> },
    { key: "status", header: "Status", render: (r) => <DxBadge tone={r.status === "OPEN" ? "info" : r.status === "CLOSED" ? "success" : "neutral"}>{r.status}</DxBadge> },
    { key: "examined_at", header: "Date", render: (r) => (r.examined_at ?? r.created_at ?? "").slice(0, 10) },
  ];

  if (charts.isLoading) return <DxPageLoading label="Loading dental worklist..." />;

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Dental" }, { label: "Worklist" }]}
        title="Dental Clinic"
        subtitle="Odontogram charting, examinations and treatment plans for dental encounters."
        actions={
          <>
            <DxButton variant="primary" onClick={() => setOpen(true)}><Plus /> New chart</DxButton>
            <DxButton icon title="Refresh" onClick={() => { charts.refetch(); stats.refetch(); }} isLoading={charts.isFetching}><RotateCcw /></DxButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DxKpi label="Dental charts" value={s?.charts_total ?? 0} icon={Stethoscope} tone="accent" sub={`${s?.charts_open ?? 0} open`} />
        <DxKpi label="Planned procedures" value={s?.procedures_planned ?? 0} icon={ClipboardList} tone="warning" sub="awaiting treatment" />
        <DxKpi label="Completed procedures" value={s?.procedures_completed ?? 0} icon={CheckCircle2} tone="success" sub="done" />
        <DxKpi label="Completed revenue" value={naira(s?.completed_revenue)} icon={Banknote} tone="info" sub="treatment value" />
      </div>

      <div className="mt-4">
        <DxPanel title="Dental encounters" icon={<Stethoscope />} flush>
          <DxGrid<DentalChart>
            borderless
            columns={columns}
            data={charts.data?.items ?? []}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(routes.dentalChart.replace(":chartId", String(r.id)))}
            empty={{ icon: Stethoscope, title: "No dental charts yet", description: "Start a new chart to capture an odontogram and treatment plan." }}
          />
        </DxPanel>
      </div>

      <DxPopup isOpen={open} onClose={() => setOpen(false)} title="New dental chart" size="md"
        footer={
          <>
            <DxButton variant="text" onClick={() => setOpen(false)}>Cancel</DxButton>
            <DxButton variant="primary" disabled={!patient} isLoading={create.isPending} onClick={() => create.mutate()}>Start chart</DxButton>
          </>
        }>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--dx-text-muted)]">Patient</label>
            <PatientPicker value={patient} onPick={setPatient} />
          </div>
          <DxSelect label="Dentition" value={dentition} onChange={(e) => setDentition(e.target.value)}
            options={[{ value: "PERMANENT", label: "Permanent" }, { value: "PRIMARY", label: "Primary (deciduous)" }, { value: "MIXED", label: "Mixed" }]} />
          <DxTextarea label="Chief complaint" rows={2} value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="e.g. Toothache on lower left for 3 days" />
          <DxMessage tone="info">The odontogram and treatment plan open once the chart is created.</DxMessage>
        </div>
      </DxPopup>
    </DxPage>
  );
}
