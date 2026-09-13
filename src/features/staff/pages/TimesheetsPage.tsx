import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Plus, RefreshCw, AlertCircle, Send, Eye, Trash2, X, CalendarDays, Wand2 } from "lucide-react";
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
import { apiErrorMessage } from "@/lib/api/api-error";
import { ApprovalDetailModal } from "@/features/approvals/components/ApprovalDetailModal";
import { SelectApproverModal } from "@/features/approvals/components/SelectApproverModal";
import { leaveApi, type LeaveDay } from "../../hr/api/leave.api";
import { timesheetsApi, type Timesheet, type TimesheetStatus, type TimesheetEntry } from "../../hr/api/timesheets.api";

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

// ---- date helpers (UTC to avoid tz drift on YYYY-MM-DD) ----
function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return out;
  for (const d = s; d <= e; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}
function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6;
}

export function TimesheetsPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const list = useQuery({ queryKey: ["my-timesheets"], queryFn: () => timesheetsApi.listMine({ limit: 200 }) });
  const rows = list.data?.items ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [viewRequestId, setViewRequestId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Timesheet | null>(null);
  const [pendingSubmit, setPendingSubmit] = useState<Timesheet | null>(null);

  const submit = useMutation({
    mutationFn: ({ row, approverId }: { row: Timesheet; approverId: number }) =>
      timesheetsApi.submitMine(row.id, { title: `Timesheet — ${myName()} (${fmt(row.period_start)}–${fmt(row.period_end)})`, assigned_approver_user_id: approverId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-timesheets"] }); setPendingSubmit(null); toast.success("Submitted for approval", "Your selected approver has been notified by email."); },
    onError: (err: any) => { const d = err?.response?.data?.detail; toast.error("Couldn't submit", typeof d === "string" ? d : "Configure a TIMESHEET flow under Approvals → Flows."); },
  });
  const remove = useMutation({
    mutationFn: (id: number) => timesheetsApi.removeMine(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-timesheets"] }); toast.success("Deleted", "Timesheet removed."); },
    onError: () => toast.error("Couldn't delete", "Only drafts can be removed."),
  });

  const leaveCount = (t: Timesheet) => (t.entries ?? []).filter((e) => e.is_leave).length;

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader title="My Timesheets" description="Log your own hours day by day and route them through the approval flow." />
        <div className="flex gap-3">
          <button onClick={() => list.refetch()} className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400"><RefreshCw className={`h-4 w-4 ${list.isFetching ? "animate-spin" : ""}`} /></button>
          <Button leftIcon={<Plus className="h-5 w-5" />} onClick={() => setCreateOpen(true)}>Log Hours</Button>
        </div>
      </div>

      {list.isError && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-bold">Failed to load your timesheets.</p>
            <p className="text-xs mt-0.5">{apiErrorMessage(list.error, "The server rejected the request — try again.")}</p>
          </div>
          <Button size="sm" variant="secondary" className="ml-auto shrink-0" onClick={() => list.refetch()}>Retry</Button>
        </div>
      )}

      <Card variant="panel" className="p-0 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-secondary-900/5 text-[10px] font-bold uppercase tracking-widest text-secondary-500">
              <th className="px-6 py-4">Period</th><th className="px-6 py-4">Days</th><th className="px-6 py-4">Regular / OT</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary-100/60">
            {list.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={5} className="px-6 py-4"><Skeleton className="h-8 w-full" /></td></tr>)
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-24 text-center"><Clock className="h-12 w-12 mx-auto text-secondary-200 mb-3" /><p className="font-bold text-secondary-900">No timesheets yet</p><p className="text-sm text-secondary-400 mt-1">Log your hours, then submit for approval.</p></td></tr>
            ) : (
              rows.map((t) => (
                <tr key={t.id} className="hover:bg-primary-50/20">
                  <td className="px-6 py-4">
                    <button onClick={() => setDetail(t)} className="font-bold text-secondary-900 hover:text-primary-600 hover:underline">{fmt(t.period_start)} → {fmt(t.period_end)}</button>
                  </td>
                  <td className="px-6 py-4 text-secondary-600">
                    {t.entries?.length ?? 0}
                    {leaveCount(t) > 0 ? <span className="text-violet-500"> ({leaveCount(t)} leave)</span> : null}
                    {(t.absence_days ?? 0) > 0 ? <span className="text-rose-400"> ({t.absence_days} abs)</span> : null}
                  </td>
                  <td className="px-6 py-4 text-secondary-600">{num(t.total_regular_hours)}h <span className="text-amber-500">/ {num(t.total_overtime_hours)}h OT</span></td>
                  <td className="px-6 py-4"><Badge variant={statusVariant[t.status]}>{t.status}</Badge></td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {t.status === "DRAFT" && (
                        <Button size="sm" leftIcon={<Send className="h-3.5 w-3.5" />} isLoading={submit.isPending && submit.variables?.row.id === t.id} onClick={() => setPendingSubmit(t)}>Submit</Button>
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

      <CreateTimesheetModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => qc.invalidateQueries({ queryKey: ["my-timesheets"] })} />
      <TimesheetDetailModal timesheet={detail} onClose={() => setDetail(null)} />
      <SelectApproverModal
        isOpen={pendingSubmit !== null}
        onClose={() => setPendingSubmit(null)}
        requestType="TIMESHEET"
        summary={pendingSubmit ? `Timesheet ${fmt(pendingSubmit.period_start)} → ${fmt(pendingSubmit.period_end)}` : undefined}
        isSubmitting={submit.isPending}
        onConfirm={(approverId) => pendingSubmit && submit.mutate({ row: pendingSubmit, approverId })}
      />
      <ApprovalDetailModal requestId={viewRequestId} isOpen={viewRequestId !== null} onClose={() => setViewRequestId(null)} />
    </div>
  );
}

// ---- Daily-entry editor row ----
type EntryDraft = {
  work_date: string;
  regular_hours: string;
  overtime_hours: string;
  night_hours: string;
  weekend_hours: string;
  holiday_hours: string;
  is_absent: boolean;
  is_leave: boolean;
  leave_label: string;
  note: string;
};

const emptyEntry = (date = ""): EntryDraft => ({
  work_date: date, regular_hours: "", overtime_hours: "", night_hours: "", weekend_hours: "", holiday_hours: "", is_absent: false, is_leave: false, leave_label: "", note: "",
});

const leaveRow = (d: LeaveDay): EntryDraft => ({
  work_date: d.date, regular_hours: "", overtime_hours: "", night_hours: "", weekend_hours: "", holiday_hours: "",
  is_absent: false, is_leave: true, leave_label: d.leave_type_name || "Leave", note: d.leave_type_name || "Leave",
});

function sortRows(list: EntryDraft[]): EntryDraft[] {
  return [...list].sort((a, b) => {
    if (!a.work_date && !b.work_date) return 0;
    if (!a.work_date) return 1;
    if (!b.work_date) return -1;
    return a.work_date < b.work_date ? -1 : a.work_date > b.work_date ? 1 : 0;
  });
}

function CreateTimesheetModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [entries, setEntries] = useState<EntryDraft[]>([emptyEntry()]);

  const canQuery = !!start && !!end && start <= end;
  const leaveQuery = useQuery({
    queryKey: ["my-leave-days", start, end],
    queryFn: () => leaveApi.myLeaveDays(start, end),
    enabled: isOpen && canQuery,
  });

  // Auto-reflect approved leave for the chosen period as locked leave rows.
  useEffect(() => {
    const days = leaveQuery.data ?? [];
    const byDate = new Map(days.map((d) => [d.date, d]));
    setEntries((prev) => {
      const manual = prev.filter((e) => !e.is_leave && !byDate.has(e.work_date));
      const merged = [...manual, ...days.map(leaveRow)];
      return sortRows(merged.length ? merged : [emptyEntry()]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(leaveQuery.data)]);

  const totals = useMemo(() => {
    const acc = { reg: 0, ot: 0, night: 0, weekend: 0, holiday: 0, abs: 0, leave: 0 };
    for (const e of entries) {
      if (!e.work_date) continue;
      if (e.is_leave) { acc.leave += 1; continue; }
      acc.reg += Number(e.regular_hours) || 0;
      acc.ot += Number(e.overtime_hours) || 0;
      acc.night += Number(e.night_hours) || 0;
      acc.weekend += Number(e.weekend_hours) || 0;
      acc.holiday += Number(e.holiday_hours) || 0;
      if (e.is_absent) acc.abs += 1;
    }
    return acc;
  }, [entries]);

  function reset() { setStart(""); setEnd(""); setNotes(""); setEntries([emptyEntry()]); }
  function patch(i: number, key: keyof EntryDraft, value: string | boolean) {
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, [key]: value } : e)));
  }
  function addRow() { setEntries((prev) => sortRows([...prev, emptyEntry(start || "")])); }
  function removeRow(i: number) { setEntries((prev) => (prev.filter((e) => !e.is_leave).length <= 1 ? prev : prev.filter((_, idx) => idx !== i))); }

  function autofillPeriod() {
    if (!canQuery) { toast.error("Set the period first", "Choose a valid start and end date."); return; }
    const byDate = new Map((leaveQuery.data ?? []).map((d) => [d.date, d]));
    const rows = eachDate(start, end).map((dt) => {
      const lv = byDate.get(dt);
      if (lv) return leaveRow(lv);
      return { ...emptyEntry(dt), regular_hours: isWeekend(dt) ? "" : "8" };
    });
    setEntries(sortRows(rows));
  }

  const create = useMutation({
    mutationFn: () => {
      const clean = entries
        .filter((e) => e.work_date)
        .map<Omit<TimesheetEntry, "id">>((e) => ({
          work_date: e.work_date,
          regular_hours: e.is_leave ? 0 : Number(e.regular_hours) || 0,
          overtime_hours: e.is_leave ? 0 : Number(e.overtime_hours) || 0,
          night_hours: e.is_leave ? 0 : Number(e.night_hours) || 0,
          weekend_hours: e.is_leave ? 0 : Number(e.weekend_hours) || 0,
          holiday_hours: e.is_leave ? 0 : Number(e.holiday_hours) || 0,
          is_absent: e.is_leave ? false : e.is_absent,
          is_leave: e.is_leave,
          note: (e.is_leave ? e.leave_label : e.note) || undefined,
        }));
      return timesheetsApi.createMine({ period_start: start, period_end: end, notes: notes || undefined, entries: clean });
    },
    onSuccess: () => { toast.success("Timesheet created", "It's a draft — submit it for approval."); onCreated(); onClose(); reset(); },
    onError: (err: any) => { const d = err?.response?.data?.detail; toast.error("Couldn't create", typeof d === "string" ? d : "Check the fields and try again."); },
  });

  function save() {
    if (!start || !end) { toast.error("Missing fields", "Period start and end dates are required."); return; }
    if (start > end) { toast.error("Invalid period", "Start date must be on or before end date."); return; }
    const dated = entries.filter((e) => e.work_date);
    const outOfRange = dated.find((e) => e.work_date < start || e.work_date > end);
    if (outOfRange) { toast.error("Date out of range", "Every entry date must fall within the period."); return; }
    create.mutate();
  }

  const numCell = "w-16 text-right";
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log Timesheet" size="xl"
      footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} isLoading={create.isPending}>Create draft</Button></div>}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Period start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input label="Period end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">Daily hours</label>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" leftIcon={<Wand2 className="h-3.5 w-3.5" />} onClick={autofillPeriod} title="Fill every day in the period (8h on weekdays)">Autofill</Button>
              <Button size="sm" variant="secondary" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={addRow}>Add day</Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-secondary-100">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-secondary-900/5 text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                  <th className="px-3 py-2">Date</th><th className="px-3 py-2 text-right">Reg</th><th className="px-3 py-2 text-right">OT</th><th className="px-3 py-2 text-right">Night</th><th className="px-3 py-2 text-right">Wknd</th><th className="px-3 py-2 text-right">Hol</th><th className="px-3 py-2 text-center">Absent</th><th className="px-3 py-2">Note</th><th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100/60">
                {entries.map((e, i) => {
                  const locked = e.is_leave;
                  const rowBg = e.is_leave ? "bg-violet-50/70" : e.is_absent ? "bg-rose-50/40" : "";
                  const hourDisabled = locked || e.is_absent;
                  const cls = `${numCell} rounded-lg border border-secondary-200 px-2 py-1 text-xs disabled:bg-secondary-50 disabled:text-secondary-300`;
                  return (
                    <tr key={i} className={`align-middle ${rowBg}`}>
                      <td className="px-2 py-1.5">
                        <input type="date" value={e.work_date} disabled={locked} onChange={(ev) => patch(i, "work_date", ev.target.value)} className="rounded-lg border border-secondary-200 px-2 py-1 text-xs disabled:bg-violet-50 disabled:text-violet-700 disabled:font-semibold" />
                      </td>
                      <td className="px-2 py-1.5"><input type="number" min="0" step="0.25" disabled={hourDisabled} value={e.regular_hours} onChange={(ev) => patch(i, "regular_hours", ev.target.value)} className={cls} /></td>
                      <td className="px-2 py-1.5"><input type="number" min="0" step="0.25" disabled={hourDisabled} value={e.overtime_hours} onChange={(ev) => patch(i, "overtime_hours", ev.target.value)} className={cls} /></td>
                      <td className="px-2 py-1.5"><input type="number" min="0" step="0.25" disabled={hourDisabled} value={e.night_hours} onChange={(ev) => patch(i, "night_hours", ev.target.value)} className={cls} /></td>
                      <td className="px-2 py-1.5"><input type="number" min="0" step="0.25" disabled={hourDisabled} value={e.weekend_hours} onChange={(ev) => patch(i, "weekend_hours", ev.target.value)} className={cls} /></td>
                      <td className="px-2 py-1.5"><input type="number" min="0" step="0.25" disabled={hourDisabled} value={e.holiday_hours} onChange={(ev) => patch(i, "holiday_hours", ev.target.value)} className={cls} /></td>
                      <td className="px-2 py-1.5 text-center"><input type="checkbox" disabled={locked} checked={e.is_absent} onChange={(ev) => patch(i, "is_absent", ev.target.checked)} className="h-4 w-4 rounded border-secondary-300 disabled:opacity-30" /></td>
                      <td className="px-2 py-1.5">
                        {e.is_leave ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-violet-100 text-violet-700 font-semibold text-[10px] uppercase tracking-wide">{e.leave_label}</span>
                        ) : (
                          <input type="text" value={e.note} onChange={(ev) => patch(i, "note", ev.target.value)} placeholder="—" className="w-28 rounded-lg border border-secondary-200 px-2 py-1 text-xs" />
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <button onClick={() => removeRow(i)} disabled={locked} className="p-1.5 rounded-lg hover:bg-rose-50 disabled:opacity-20" title={locked ? "Leave days are managed automatically" : "Remove day"}><X className="h-3.5 w-3.5 text-rose-400" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-secondary-50 font-bold text-secondary-700 text-[11px]">
                  <td className="px-3 py-2">Totals</td>
                  <td className="px-3 py-2 text-right">{totals.reg}</td>
                  <td className="px-3 py-2 text-right">{totals.ot}</td>
                  <td className="px-3 py-2 text-right">{totals.night}</td>
                  <td className="px-3 py-2 text-right">{totals.weekend}</td>
                  <td className="px-3 py-2 text-right">{totals.holiday}</td>
                  <td className="px-3 py-2 text-center">{totals.abs} abs</td>
                  <td className="px-3 py-2" colSpan={2}>{totals.leave > 0 ? <span className="text-violet-600">{totals.leave} leave day{totals.leave === 1 ? "" : "s"}</span> : null}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-secondary-400">
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-violet-200 border border-violet-300" /> Leave (auto-filled from approved requests, not editable)</span>
            <span>Marking a day absent zeroes its hours. Totals roll up on save.</span>
            {leaveQuery.isFetching && <span className="text-violet-400">Checking leave…</span>}
          </div>
        </div>

        <Textarea label="Notes (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Modal>
  );
}

function TimesheetDetailModal({ timesheet, onClose }: { timesheet: Timesheet | null; onClose: () => void }) {
  if (!timesheet) return null;
  const entries = timesheet.entries ?? [];
  const leaveDays = entries.filter((e) => e.is_leave).length;
  return (
    <Modal isOpen={!!timesheet} onClose={onClose} size="lg"
      title={`Timesheet — ${fmt(timesheet.period_start)} → ${fmt(timesheet.period_end)}`}
      footer={<div className="flex justify-end"><Button variant="secondary" onClick={onClose}>Close</Button></div>}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant={statusVariant[timesheet.status]}>{timesheet.status}</Badge>
          <span className="px-2 py-1 rounded-lg bg-secondary-50 text-secondary-600">Regular {num(timesheet.total_regular_hours)}h</span>
          <span className="px-2 py-1 rounded-lg bg-secondary-50 text-secondary-600">OT {num(timesheet.total_overtime_hours)}h</span>
          <span className="px-2 py-1 rounded-lg bg-secondary-50 text-secondary-600">Night {num(timesheet.total_night_hours)}h</span>
          <span className="px-2 py-1 rounded-lg bg-secondary-50 text-secondary-600">Weekend {num(timesheet.total_weekend_hours)}h</span>
          <span className="px-2 py-1 rounded-lg bg-secondary-50 text-secondary-600">Holiday {num(timesheet.total_holiday_hours)}h</span>
          {leaveDays > 0 && <span className="px-2 py-1 rounded-lg bg-violet-100 text-violet-700">Leave {leaveDays}d</span>}
          <span className="px-2 py-1 rounded-lg bg-secondary-50 text-secondary-600">Absences {timesheet.absence_days ?? 0}</span>
        </div>
        {entries.length === 0 ? (
          <div className="py-12 text-center text-secondary-400"><CalendarDays className="h-10 w-10 mx-auto mb-2 text-secondary-200" />No daily entries recorded.</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-secondary-100">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-secondary-900/5 text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                  <th className="px-3 py-2">Date</th><th className="px-3 py-2 text-right">Reg</th><th className="px-3 py-2 text-right">OT</th><th className="px-3 py-2 text-right">Night</th><th className="px-3 py-2 text-right">Wknd</th><th className="px-3 py-2 text-right">Hol</th><th className="px-3 py-2 text-center">Type</th><th className="px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100/60">
                {entries.map((e, i) => (
                  <tr key={i} className={e.is_leave ? "bg-violet-50/70" : e.is_absent ? "bg-rose-50/40" : ""}>
                    <td className="px-3 py-2 font-semibold text-secondary-800">{fmt(e.work_date)}</td>
                    <td className="px-3 py-2 text-right">{num(e.regular_hours)}</td>
                    <td className="px-3 py-2 text-right">{num(e.overtime_hours)}</td>
                    <td className="px-3 py-2 text-right">{num(e.night_hours)}</td>
                    <td className="px-3 py-2 text-right">{num(e.weekend_hours)}</td>
                    <td className="px-3 py-2 text-right">{num(e.holiday_hours)}</td>
                    <td className="px-3 py-2 text-center">
                      {e.is_leave ? <span className="text-violet-600 font-bold">Leave</span> : e.is_absent ? <span className="text-rose-500 font-bold">Absent</span> : "—"}
                    </td>
                    <td className="px-3 py-2 text-secondary-500">{e.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
