import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, RotateCcw, BellRing, CalendarClock, CheckCircle2, Search, UserRound } from "lucide-react";
import {
  DxBadge, DxButton, DxGrid, DxKpi, DxPage, DxPageHeader, DxPageLoading, DxPanel,
  DxPopup, DxInput, DxSelect, DxTextarea, apiErrorMessage, type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { searchPatients } from "@/features/patients/api/patients.api";
import { eyeApi, type EyeRecall } from "../api/eye.api";

const RECALL_TYPES = ["REVIEW", "IOP_CHECK", "POST_OP", "REFRACTION", "DIABETIC_SCREEN", "OTHER"];

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
          {q.isLoading ? <p className="px-3 py-3 text-[12.5px] text-[var(--dx-text-muted)]">Searching...</p>
            : items.length === 0 ? <p className="px-3 py-3 text-[12.5px] text-[var(--dx-text-muted)]">No patients found.</p>
            : items.map((p) => (
              <button key={p.id} type="button" onClick={() => onPick({ id: p.id, name: `${p.first_name} ${p.last_name}` })}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-[var(--dx-surface-hover)]">
                <span className="font-medium">{p.first_name} {p.last_name}</span>
                <span className="text-[11.5px] text-[var(--dx-text-muted)]">{p.hospital_number}</span>
              </button>
            ))}
        </div>
      ) : null}
    </div>
  );
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const addMonthsIso = (m: number) => { const d = new Date(); d.setMonth(d.getMonth() + m); return d.toISOString().slice(0, 10); };
const statusTone = (s: string): "info" | "accent" | "success" | "neutral" =>
  s === "DUE" ? "accent" : s === "SCHEDULED" ? "info" : s === "COMPLETED" ? "success" : "neutral";

export function EyeRecallsPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("");
  const [dueOnly, setDueOnly] = useState(false);

  const [open, setOpen] = useState(false);
  const [patient, setPatient] = useState<{ id: number; name: string } | null>(null);
  const [rType, setRType] = useState("REVIEW");
  const [interval, setInterval] = useState("6");
  const [dueDate, setDueDate] = useState(addMonthsIso(6));
  const [note, setNote] = useState("");

  const recallsQ = useQuery({
    queryKey: ["eye", "recalls", statusFilter, dueOnly],
    queryFn: () => eyeApi.listRecalls({ status: statusFilter || undefined, due_before: dueOnly ? todayIso() : undefined, limit: 300 }),
  });
  const rows = recallsQ.data?.items ?? [];

  const counts = {
    due: rows.filter((r) => (r.status === "DUE" || r.status === "SCHEDULED") && r.is_overdue).length,
    scheduled: rows.filter((r) => r.status === "SCHEDULED").length,
    completed: rows.filter((r) => r.status === "COMPLETED").length,
  };

  const create = useMutation({
    mutationFn: () => eyeApi.createRecall({
      patient_id: patient!.id, recall_type: rType, due_date: dueDate,
      interval_months: interval ? Number(interval) : null, note: note || null,
    }),
    onSuccess: () => {
      toast.success("Recall scheduled.");
      qc.invalidateQueries({ queryKey: ["eye", "recalls"] });
      setOpen(false); setPatient(null); setNote(""); setRType("REVIEW"); setInterval("6"); setDueDate(addMonthsIso(6));
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const setStatus = useMutation({
    mutationFn: ({ rid, status }: { rid: number; status: string }) => eyeApi.updateRecall(rid, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["eye", "recalls"] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const columns: DxGridColumn<EyeRecall>[] = [
    { key: "patient", header: "Patient", render: (r) => (
      <div className="min-w-0"><div className="truncate font-semibold text-[var(--dx-text)]">{r.patient?.name}</div>
        <div className="text-[11.5px] text-[var(--dx-text-muted)]">{r.patient?.hospital_number}</div></div>
    ) },
    { key: "recall_type", header: "Type", render: (r) => r.recall_type ? <DxBadge tone="neutral">{r.recall_type.replace(/_/g, " ")}</DxBadge> : <span className="text-[var(--dx-text-faint)]">--</span> },
    { key: "due_date", header: "Due", accessor: (r) => r.due_date ?? "", render: (r) => (
      <span className="inline-flex items-center gap-1.5">
        <span className="dx-mono">{r.due_date ? new Date(r.due_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "--"}</span>
        {r.is_overdue ? <DxBadge tone="danger" dot>Overdue</DxBadge> : null}
      </span>
    ) },
    { key: "interval_months", header: "Interval", align: "right", render: (r) => r.interval_months != null ? `${r.interval_months} mo` : "--" },
    { key: "status", header: "Status", render: (r) => <DxBadge tone={statusTone(r.status)} dot>{r.status}</DxBadge> },
    { key: "actions", header: "", align: "right", render: (r) => (
      <div className="flex items-center justify-end gap-1">
        {r.status === "DUE" ? <DxButton size="sm" variant="text" onClick={() => setStatus.mutate({ rid: r.id, status: "SCHEDULED" })}>Schedule</DxButton> : null}
        {r.status !== "COMPLETED" && r.status !== "CANCELLED" ? (
          <>
            <DxButton size="sm" variant="text" onClick={() => setStatus.mutate({ rid: r.id, status: "COMPLETED" })}>Complete</DxButton>
            <DxButton size="sm" variant="text" onClick={() => setStatus.mutate({ rid: r.id, status: "CANCELLED" })}>Cancel</DxButton>
          </>
        ) : null}
      </div>
    ) },
  ];

  if (recallsQ.isLoading) return <DxPageLoading label="Loading recalls..." />;

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Eye Clinic" }, { label: "Recalls" }]}
        title="Eye-Clinic Recalls"
        subtitle="Preventive and follow-up reviews — IOP checks, diabetic screening and post-op visits coming due."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={() => recallsQ.refetch()} isLoading={recallsQ.isFetching}><RotateCcw /></DxButton>
            <DxButton variant="primary" onClick={() => setOpen(true)}><Plus /> New recall</DxButton>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <DxKpi label="Due now" value={counts.due} icon={BellRing} tone="warning" sub="overdue or today" />
        <DxKpi label="Scheduled" value={counts.scheduled} icon={CalendarClock} tone="info" />
        <DxKpi label="Completed" value={counts.completed} icon={CheckCircle2} tone="success" />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="w-full md:w-52">
          <DxSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status"
            options={[
              { value: "", label: "All statuses" },
              { value: "DUE", label: "Due" },
              { value: "SCHEDULED", label: "Scheduled" },
              { value: "COMPLETED", label: "Completed" },
              { value: "CANCELLED", label: "Cancelled" },
            ]} />
        </div>
        <DxButton variant={dueOnly ? "primary" : "default"} leftIcon={<BellRing className="h-4 w-4" />} onClick={() => setDueOnly((v) => !v)}>
          Due by today
        </DxButton>
      </div>

      <DxPanel title="Recall worklist" icon={<BellRing />} flush>
        <DxGrid<EyeRecall>
          borderless columns={columns} data={rows} rowKey={(r) => r.id}
          empty={{ icon: BellRing, title: "No recalls", description: "Schedule a recall to start the follow-up loop." }}
        />
      </DxPanel>

      <DxPopup
        isOpen={open}
        onClose={() => setOpen(false)}
        title="New recall"
        size="md"
        footer={
          <>
            <DxButton variant="text" onClick={() => setOpen(false)}>Cancel</DxButton>
            <DxButton variant="primary" disabled={!patient || !dueDate} isLoading={create.isPending} onClick={() => create.mutate()}>Schedule recall</DxButton>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--dx-text-muted)]">Patient</label>
            <PatientPicker value={patient} onPick={setPatient} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <DxSelect label="Type" value={rType} onChange={(e) => setRType(e.target.value)}
              options={RECALL_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, " ") }))} />
            <DxSelect label="Interval" value={interval}
              onChange={(e) => { setInterval(e.target.value); if (e.target.value) setDueDate(addMonthsIso(Number(e.target.value))); }}
              options={[
                { value: "3", label: "3 months" },
                { value: "6", label: "6 months" },
                { value: "12", label: "12 months" },
                { value: "24", label: "24 months" },
                { value: "", label: "Custom" },
              ]} />
          </div>
          <DxInput label="Due date" type="date" mono value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <DxTextarea label="Note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Annual IOP review" />
        </div>
      </DxPopup>
    </DxPage>
  );
}
