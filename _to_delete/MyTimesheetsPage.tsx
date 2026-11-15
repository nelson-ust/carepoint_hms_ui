import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Plus, RefreshCw, AlertCircle, Send, Eye, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { getStoredUser } from "@/lib/auth/current-user";
import { ApprovalDetailModal } from "@/features/approvals/components/ApprovalDetailModal";
import { timesheetsApi, type Timesheet, type TimesheetStatus } from "../api/timesheets.api";

const statusVariant: Record<TimesheetStatus, BadgeProps["variant"]> = {
  DRAFT: "secondary", SUBMITTED: "soft-info", APPROVED: "soft-success", REJECTED: "soft-danger", LOCKED: "soft-warning",
};

function fmt(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
const num = (v: number | string | undefined) => (v == null ? 0 : typeof v === "number" ? v : Number(v) || 0);

function myName(): string {
  const u = getStoredUser() as any;
  const n = `${u?.first_name ?? ""} ${u?.last_name ?? ""}`.trim();
  return n || u?.username || u?.email || "My";
}

export function MyTimesheetsPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const list = useQuery({ queryKey: ["my-timesheets"], queryFn: () => timesheetsApi.listMine({ limit: 200 }) });
  const rows = list.data?.items ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [viewRequestId, setViewRequestId] = useState<number | null>(null);

  const submit = useMutation({
    mutationFn: (t: Timesheet) => timesheetsApi.submitMine(t.id, { title: `Timesheet — ${myName()} (${fmt(t.period_start)}–${fmt(t.period_end)})` }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-timesheets"] }); toast.success("Submitted for approval", "Routed through the approval flow."); },
    onError: (err: any) => { const d = err?.response?.data?.detail; toast.error("Couldn't submit", typeof d === "string" ? d : "Configure a TIMESHEET flow under Approvals → Flows."); },
  });
  const remove = useMutation({
    mutationFn: (id: number) => timesheetsApi.removeMine(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-timesheets"] }); toast.success("Deleted", "Timesheet removed."); },
    onError: () => toast.error("Couldn't delete", "Only drafts can be removed."),
  });

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader title="My Timesheets" description="Log your hours and track approvals." />
        <div className="flex gap-3">
          <button onClick={() => list.refetch()} className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400"><RefreshCw className={`h-4 w-4 ${list.isFetching ? "animate-spin" : ""}`} /></button>
          <Button leftIcon={<Plus className="h-5 w-5" />} onClick={() => setCreateOpen(true)}>Log Hours</Button>
        </div>
      </div>

      {list.isError && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center gap-3"><AlertCircle className="h-5 w-5" /><p className="text-sm font-bold">Failed to load your timesheets.</p></div>
      )}

      <Card variant="panel" className="p-0 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-secondary-900/5 text-[10px] font-bold uppercase tracking-widest text-secondary-500">
              <th className="px-6 py-4">Period</th><th className="px-6 py-4">Regular / OT</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary-100/60">
            {list.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={4} className="px-6 py-4"><Skeleton className="h-8 w-full" /></td></tr>)
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-24 text-center"><Clock className="h-12 w-12 mx-auto text-secondary-200 mb-3" /><p className="font-bold text-secondary-900">No timesheets yet</p><p className="text-sm text-secondary-400 mt-1">Log hours, then submit for approval.</p></td></tr>
            ) : (
              rows.map((t) => (
                <tr key={t.id} className="hover:bg-primary-50/20">
                  <td className="px-6 py-4 font-bold text-secondary-900">{fmt(t.period_start)} → {fmt(t.period_end)}</td>
                  <td className="px-6 py-4 text-secondary-600">{num(t.total_regular_hours)}h <span className="text-amber-500">/ {num(t.total_overtime_hours)}h OT</span></td>
                  <td className="px-6 py-4"><Badge variant={statusVariant[t.status]}>{t.status}</Badge></td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {t.status === "DRAFT" && (
                        <Button size="sm" leftIcon={<Send className="h-3.5 w-3.5" />} isLoading={submit.isPending && submit.variables?.id === t.id} onClick={() => submit.mutate(t)}>Submit</Button>
                      )}
                      {t.approval_request_id && (
                        <Button size="sm" variant="ghost" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => setViewRequestId(t.approval_request_id!)}>Approval</Button>
                      )}
                      {t.status === "DRAFT" && (
                        <button onClick={() => remove.mutate(t.id)} className="p-2 rounded-xl hover:bg-rose-50" title="Delete"><Trash2 className="h-4 w-4 text-rose-400" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <CreateMyTimesheetModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => qc.invalidateQueries({ queryKey: ["my-timesheets"] })} />
      <ApprovalDetailModal requestId={viewRequestId} isOpen={viewRequestId !== null} onClose={() => setViewRequestId(null)} />
    </div>
  );
}

function CreateMyTimesheetModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [notes, setNotes] = useState("");
  const create = useMutation({
    mutationFn: () => timesheetsApi.createMine({ period_start: start, period_end: end, notes: notes || undefined }),
    onSuccess: () => { toast.success("Timesheet created", "It's a draft — submit it for approval."); onCreated(); onClose(); resetForm(); },
    onError: (err: any) => { const d = err?.response?.data?.detail; toast.error("Couldn't create", typeof d === "string" ? d : "Check the fields and try again."); },
  });
  function resetForm() { setStart(""); setEnd(""); setNotes(""); }
  function save() {
    if (!start || !end) { toast.error("Missing fields", "Period dates are required."); return; }
    create.mutate();
  }
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log Timesheet" size="md"
      footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} isLoading={create.isPending}>Create draft</Button></div>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Period start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input label="Period end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <Textarea label="Notes (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <p className="text-[11px] text-secondary-400">Daily hour entries can be added after creation; totals roll up from entries.</p>
      </div>
    </Modal>
  );
}
