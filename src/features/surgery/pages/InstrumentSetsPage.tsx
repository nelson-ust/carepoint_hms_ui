import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Boxes, Plus, RotateCcw, Link2 } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxBadge, DxButton, DxPopup, DxInput, DxSelect, DxTextarea, DxCheckbox,
  type DxBadgeTone,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { routes } from "@/config/routes";
import { useInstrumentSets, useSurgicalWorklist, surgeryKeys } from "../hooks/use-surgery";
import {
  createInstrumentSet, assignInstrumentSet, logSterilization,
  STERILIZATION_OPTIONS, fmtDateTime, type InstrumentSet,
} from "../api/surgery.api";

function sterTone(status: string): DxBadgeTone {
  switch (status) {
    case "READY":
      return "success";
    case "PRE_CLEAN":
    case "AUTOCLAVE":
      return "warning";
    case "IN_USE":
      return "info";
    default:
      return "danger";
  }
}

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function InstrumentSetsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const sets = useInstrumentSets({ sterilization_status: statusFilter || undefined });
  const worklist = useSurgicalWorklist();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", notes: "" });
  const [busy, setBusy] = useState(false);

  const [assignFor, setAssignFor] = useState<InstrumentSet | null>(null);
  const [assignCase, setAssignCase] = useState("");

  const [sterFor, setSterFor] = useState<InstrumentSet | null>(null);
  const [ster, setSter] = useState({ method: "AUTOCLAVE", machine_identifier: "", cycle_started_at: "", cycle_ended_at: "", indicator_passed: true });

  const invalidate = () => qc.invalidateQueries({ queryKey: [...surgeryKeys.all, "instruments"] });

  const create = async () => {
    if (!form.code.trim() || !form.name.trim()) { toast.error("Code and name are required"); return; }
    setBusy(true);
    try {
      await createInstrumentSet({ code: form.code.trim(), name: form.name.trim(), notes: form.notes.trim() || undefined });
      toast.success("Instrument set created");
      setCreateOpen(false); setForm({ code: "", name: "", notes: "" }); invalidate();
    } catch (err) { toast.error("Couldn't create", apiErrorMessage(err, "Retry.")); }
    finally { setBusy(false); }
  };

  const doAssign = async () => {
    if (!assignFor || !assignCase) { toast.error("Pick a case"); return; }
    setBusy(true);
    try {
      await assignInstrumentSet(assignFor.id, Number(assignCase));
      toast.success("Set assigned");
      setAssignFor(null); setAssignCase(""); invalidate();
    } catch (err) { toast.error("Couldn't assign", apiErrorMessage(err, "Retry.")); }
    finally { setBusy(false); }
  };

  const openSter = (s: InstrumentSet) => {
    setSterFor(s);
    setSter({ method: "AUTOCLAVE", machine_identifier: "", cycle_started_at: toLocalInput(new Date()), cycle_ended_at: "", indicator_passed: true });
  };
  const doSter = async () => {
    if (!sterFor) return;
    setBusy(true);
    try {
      await logSterilization(sterFor.id, {
        instrument_set_id: sterFor.id,
        cycle_started_at: new Date(ster.cycle_started_at || Date.now()).toISOString(),
        cycle_ended_at: ster.cycle_ended_at ? new Date(ster.cycle_ended_at).toISOString() : undefined,
        method: ster.method || undefined,
        machine_identifier: ster.machine_identifier.trim() || undefined,
        indicator_passed: ster.indicator_passed,
      });
      toast.success("Sterilization logged");
      setSterFor(null); invalidate();
    } catch (err) { toast.error("Couldn't log", apiErrorMessage(err, "Retry.")); }
    finally { setBusy(false); }
  };

  const items = sets.data?.items ?? [];
  const cases = worklist.data?.items ?? [];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Surgery", to: routes.surgery }, { label: "Instruments" }]}
        title="Instrument Sets"
        subtitle="Track surgical instrument sets, sterilization status and theatre assignment."
        actions={<DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>New set</DxButton>}
      />

      <div className="max-w-xs">
        <DxSelect label="Sterilization status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          options={[{ value: "", label: "All statuses" }, ...STERILIZATION_OPTIONS.map((o) => ({ value: o.value, label: o.label }))]} />
      </div>

      <DxPanel title="Sets" icon={<Boxes className="h-4 w-4" />}>
        {sets.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="dx-skeleton h-40 w-full" />)}</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <Boxes className="mx-auto mb-3 h-9 w-9 text-[var(--dx-text-faint)]" />
            <p className="text-[13px] font-medium text-[var(--dx-text-muted)]">No instrument sets. Create instrument sets to track sterilization and assignment.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((s) => (
              <div key={s.id} className="rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-[var(--dx-text)]">{s.name}</p>
                    <p className="dx-mono text-[11px] font-semibold uppercase text-[var(--dx-text-muted)]">{s.code}</p>
                  </div>
                  <DxBadge tone={sterTone(String(s.sterilization_status))}>{String(s.sterilization_status)}</DxBadge>
                </div>
                <p className="mt-2 text-[11px] text-[var(--dx-text-muted)]">Last autoclaved: {fmtDateTime(s.last_autoclaved_at)}</p>
                {s.surgical_case_id ? <DxBadge tone="info" className="mt-2">Assigned to case #{s.surgical_case_id}</DxBadge> : null}
                <div className="mt-4 flex gap-2">
                  <DxButton size="sm" className="flex-1 justify-center" leftIcon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => openSter(s)}>Sterilize</DxButton>
                  <DxButton size="sm" className="flex-1 justify-center" leftIcon={<Link2 className="h-3.5 w-3.5" />} onClick={() => { setAssignFor(s); setAssignCase(""); }}>Assign</DxButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </DxPanel>

      {/* Create */}
      <DxPopup isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New instrument set" size="md" locked={busy}
        footer={<><DxButton onClick={() => setCreateOpen(false)} disabled={busy}>Cancel</DxButton><DxButton variant="primary" onClick={create} isLoading={busy}>Create</DxButton></>}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <DxInput label="Code" mono value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="LAP-SET-1" />
            <DxInput label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Laparotomy Set 1" />
          </div>
          <DxTextarea label="Notes / contents (optional)" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </DxPopup>

      {/* Assign */}
      <DxPopup isOpen={!!assignFor} onClose={() => setAssignFor(null)} title={`Assign ${assignFor?.name ?? ""}`} size="md" locked={busy}
        footer={<><DxButton onClick={() => setAssignFor(null)} disabled={busy}>Cancel</DxButton><DxButton variant="primary" onClick={doAssign} isLoading={busy}>Assign</DxButton></>}>
        <DxSelect label="Surgical case" value={assignCase} onChange={(e) => setAssignCase(e.target.value)} placeholder="Select an active case"
          options={cases.map((c) => ({ value: String(c.id), label: `${c.case_no} · ${String(c.status).replace(/_/g, " ")}` }))} />
      </DxPopup>

      {/* Sterilization */}
      <DxPopup isOpen={!!sterFor} onClose={() => setSterFor(null)} title={`Log sterilization — ${sterFor?.name ?? ""}`} size="md" locked={busy}
        footer={<><DxButton onClick={() => setSterFor(null)} disabled={busy}>Cancel</DxButton><DxButton variant="primary" onClick={doSter} isLoading={busy}>Log cycle</DxButton></>}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <DxInput label="Method" value={ster.method} onChange={(e) => setSter({ ...ster, method: e.target.value })} placeholder="AUTOCLAVE" />
            <DxInput label="Machine ID" value={ster.machine_identifier} onChange={(e) => setSter({ ...ster, machine_identifier: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <DxInput label="Cycle started" type="datetime-local" value={ster.cycle_started_at} onChange={(e) => setSter({ ...ster, cycle_started_at: e.target.value })} />
            <DxInput label="Cycle ended" type="datetime-local" value={ster.cycle_ended_at} onChange={(e) => setSter({ ...ster, cycle_ended_at: e.target.value })} />
          </div>
          <DxCheckbox label="Chemical / biological indicator passed" checked={ster.indicator_passed} onChange={(e) => setSter({ ...ster, indicator_passed: e.target.checked })} />
        </div>
      </DxPopup>
    </DxPage>
  );
}
