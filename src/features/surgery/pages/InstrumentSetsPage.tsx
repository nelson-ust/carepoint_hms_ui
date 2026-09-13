import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Boxes, Plus, RefreshCw, Link2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { routes } from "@/config/routes";
import { useInstrumentSets, useSurgicalWorklist, surgeryKeys } from "../hooks/use-surgery";
import {
  createInstrumentSet, assignInstrumentSet, logSterilization,
  STERILIZATION_OPTIONS, fmtDateTime, type InstrumentSet,
} from "../api/surgery.api";

const STER_TINT: Record<string, string> = {
  DIRTY: "soft-danger", PRE_CLEAN: "soft-warning", AUTOCLAVE: "soft-warning",
  READY: "soft-success", IN_USE: "soft-info", QUARANTINED: "soft-danger",
};

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function InstrumentSetsPage() {
  const navigate = useNavigate();
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
    <div className="space-y-8 animate-fade-in pb-16">
      <button onClick={() => navigate(routes.surgery)} className="flex items-center gap-2 text-sm font-bold text-secondary-500 hover:text-primary-600">
        <ArrowLeft className="h-4 w-4" /> Back to worklist
      </button>
      <PageHeader
        title="Instrument Sets"
        description="Track surgical instrument sets, sterilization status and theatre assignment."
        actions={<Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>New set</Button>}
      />
      <Card>
        <div className="max-w-xs">
          <Select label="Sterilization status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STERILIZATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
      </Card>
      <Card padding="none">
        <CardHeader className="px-6 pt-6" title="Sets" />
        {sets.isLoading ? (
          <div className="space-y-3 px-6 pb-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : items.length === 0 ? (
          <div className="px-6 pb-8"><EmptyState icon={Boxes} title="No instrument sets" description="Create instrument sets to track sterilization and assignment." /></div>
        ) : (
          <div className="grid gap-4 px-6 pb-6 md:grid-cols-2 xl:grid-cols-3">
            {items.map((s) => (
              <div key={s.id} className="rounded-2xl border border-secondary-200 p-5 dark:border-white/10">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-base font-black text-secondary-900 dark:text-secondary-100">{s.name}</p>
                    <p className="font-mono text-[11px] font-bold uppercase text-secondary-400">{s.code}</p>
                  </div>
                  <Badge variant={(STER_TINT[String(s.sterilization_status)] as any) ?? "secondary"}>{String(s.sterilization_status)}</Badge>
                </div>
                <p className="mt-2 text-[11px] text-secondary-400">Last autoclaved: {fmtDateTime(s.last_autoclaved_at)}</p>
                {s.surgical_case_id && <Badge variant="soft-info" className="mt-2">Assigned to case #{s.surgical_case_id}</Badge>}
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="secondary" className="flex-1" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => openSter(s)}>Sterilize</Button>
                  <Button size="sm" variant="secondary" className="flex-1" leftIcon={<Link2 className="h-3.5 w-3.5" />} onClick={() => { setAssignFor(s); setAssignCase(""); }}>Assign</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Create */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New Instrument Set" size="md"
        footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={create} isLoading={busy}>Create</Button></div>}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="LAP-SET-1" />
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Laparotomy Set 1" />
          </div>
          <Textarea label="Notes / contents (optional)" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </Modal>

      {/* Assign */}
      <Modal isOpen={!!assignFor} onClose={() => setAssignFor(null)} title={`Assign ${assignFor?.name ?? ""}`} size="md"
        footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setAssignFor(null)}>Cancel</Button><Button onClick={doAssign} isLoading={busy}>Assign</Button></div>}>
        <Select label="Surgical case" value={assignCase} onChange={(e) => setAssignCase(e.target.value)} placeholder="Select an active case">
          {cases.map((c) => <option key={c.id} value={c.id}>{c.case_no} · {String(c.status).replace(/_/g, " ")}</option>)}
        </Select>
      </Modal>

      {/* Sterilization */}
      <Modal isOpen={!!sterFor} onClose={() => setSterFor(null)} title={`Log Sterilization — ${sterFor?.name ?? ""}`} size="md"
        footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setSterFor(null)}>Cancel</Button><Button onClick={doSter} isLoading={busy}>Log cycle</Button></div>}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Method" value={ster.method} onChange={(e) => setSter({ ...ster, method: e.target.value })} placeholder="AUTOCLAVE" />
            <Input label="Machine ID" value={ster.machine_identifier} onChange={(e) => setSter({ ...ster, machine_identifier: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Cycle started" type="datetime-local" value={ster.cycle_started_at} onChange={(e) => setSter({ ...ster, cycle_started_at: e.target.value })} />
            <Input label="Cycle ended" type="datetime-local" value={ster.cycle_ended_at} onChange={(e) => setSter({ ...ster, cycle_ended_at: e.target.value })} />
          </div>
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" className="h-5 w-5 rounded accent-emerald-600" checked={ster.indicator_passed} onChange={(e) => setSter({ ...ster, indicator_passed: e.target.checked })} />
            <span className="text-sm font-bold text-secondary-900 dark:text-secondary-100">Chemical / biological indicator passed</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
