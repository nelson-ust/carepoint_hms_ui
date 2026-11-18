import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Plus, RotateCcw, Send, Eye, Trash2, X, CalendarDays, Wand2 } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxGrid, DxBadge, DxButton, DxInput, DxTextarea, DxPopup,
  type DxGridColumn, type DxBadgeTone,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { getStoredUser } from "@/lib/auth/current-user";
import { apiErrorMessage } from "@/lib/api/api-error";
import { ApprovalDetailModal } from "@/features/approvals/components/ApprovalDetailModal";
import { SelectApproverModal } from "@/features/approvals/components/SelectApproverModal";
import { leaveApi, type LeaveDay } from "../../hr/api/leave.api";
import { timesheetsApi, type Timesheet, type TimesheetStatus, type TimesheetEntry } from "../../hr/api/timesheets.api";

const statusTone: Record<TimesheetStatus, DxBadgeTone> = {
  DRAFT: "neutral", SUBMITTED: "info", APPROVED: "success", REJECTED: "danger", LOCKED: "warning",
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

  const loadError = list.isError ? apiErrorMessage(list.error, "Failed to load your timesheets. The server rejected the request — try again.") : null;

  const columns: DxGridColumn<Timesheet>[] = [
    { key: "period", header: "Period", render: (t) => <button onClick={() => setDetail(t)} className="text-[13px] font-semibold text-[var(--dx-text)] hover:text-[var(--dx-accent)] hover:underline">{fmt(t.period_start)} → {fmt(t.period_end)}</button> },
    {
      key: "days", header: "Days", render: (t) => (
        <span className="text-[13px] text-[var(--dx-text-muted)]">
          {t.entries?.length ?? 0}
          {leaveCount(t) > 0 ? <span style={{ color: "var(--dx-info)" }}> ({leaveCount(t)} leave)</span> : null}
          {(t.absence_days ?? 0) > 0 ? <span style={{ color: "var(--dx-danger)" }}> ({t.absence_days} abs)</span> : null}
        </span>
      ),
    },
    { key: "hours", header: "Regular / OT", render: (t) => <span className="dx-mono text-[13px] text-[var(--dx-text)]">{num(t.total_regular_hours)}h <span style={{ color: "var(--dx-warning)" }}>/ {num(t.total_overtime_hours)}h OT</span></span> },
    { key: "status", header: "Status", render: (t) => <DxBadge tone={statusTone[t.status]}>{t.status}</DxBadge> },
    {
      key: "action", header: "", align: "right",
      render: (t) => (
        <div className="flex items-center justify-end gap-2">
          {t.status === "DRAFT" ? <DxButton size="sm" variant="primary" leftIcon={<Send className="h-3.5 w-3.5" />} isLoading={submit.isPending && submit.variables?.row.id === t.id} onClick={() => setPendingSubmit(t)}>Submit</DxButton> : null}
          {t.approval_request_id ? <DxButton size="sm" variant="text" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => setViewRequestId(t.approval_request_id!)}>Approval</DxButton> : null}
          {t.status === "DRAFT" ? <DxButton icon size="sm" variant="outline-danger" title="Delete" onClick={() => remove.mutate(t.id)}><Trash2 /></DxButton> : null}
        </div>
      ),
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "HR" }, { label: "My Timesheets" }]}
        title="My Timesheets"
        subtitle="Log your own hours day by day and route them through the approval flow."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={() => list.refetch()} isLoading={list.isFetching}><RotateCcw /></DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Log hours</DxButton>
          </>
        }
      />

      <DxPanel title="Timesheets" icon={<Clock className="h-4 w-4" />} flush>
        <DxGrid<Timesheet>
          columns={columns}
          data={rows}
          rowKey={(t) => t.id}
          isLoading={list.isLoading}
          error={loadError}
          onRetry={() => list.refetch()}
          empty={{ icon: Clock, title: "No timesheets yet", description: "Log your hours, then submit for approval." }}
        />
      </DxPanel>

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
    </DxPage>
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

  const cls = "dx-editor dx-editor-sm w-16 text-right";
  return (
    <DxPopup
      isOpen={isOpen} onClose={onClose} title="Log Timesheet" size="xl"
      locked={create.isPending}
      footer={<><DxButton onClick={onClose}>Cancel</DxButton><DxButton variant="primary" onClick={save} isLoading={create.isPending}>Create draft</DxButton></>}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <DxInput label="Period start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <DxInput label="Period end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="dx-field-label">Daily hours</span>
            <div className="flex items-center gap-2">
              <DxButton size="sm" variant="text" leftIcon={<Wand2 className="h-3.5 w-3.5" />} onClick={autofillPeriod} title="Fill every day in the period (8h on weekdays)">Autofill</DxButton>
              <DxButton size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={addRow}>Add day</DxButton>
            </div>
          </div>
          <div className="overflow-x-auto rounded-md border border-[var(--dx-border)]">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="bg-[var(--dx-surface-sunken)] text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">
                  <th className="px-3 py-2">Date</th><th className="px-3 py-2 text-right">Reg</th><th className="px-3 py-2 text-right">OT</th><th className="px-3 py-2 text-right">Night</th><th className="px-3 py-2 text-right">Wknd</th><th className="px-3 py-2 text-right">Hol</th><th className="px-3 py-2 text-center">Absent</th><th className="px-3 py-2">Note</th><th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--dx-border)]">
                {entries.map((e, i) => {
                  const locked = e.is_leave;
                  const rowStyle = e.is_leave ? { background: "var(--dx-info-soft)" } : e.is_absent ? { background: "var(--dx-danger-soft)" } : undefined;
                  const hourDisabled = locked || e.is_absent;
                  return (
                    <tr key={i} className="align-middle" style={rowStyle}>
                      <td className="px-2 py-1.5"><input type="date" value={e.work_date} disabled={locked} onChange={(ev) => patch(i, "work_date", ev.target.value)} className="dx-editor dx-editor-sm" /></td>
                      <td className="px-2 py-1.5"><input type="number" min="0" step="0.25" disabled={hourDisabled} value={e.regular_hours} onChange={(ev) => patch(i, "regular_hours", ev.target.value)} className={cls} /></td>
                      <td className="px-2 py-1.5"><input type="number" min="0" step="0.25" disabled={hourDisabled} value={e.overtime_hours} onChange={(ev) => patch(i, "overtime_hours", ev.target.value)} className={cls} /></td>
                      <td className="px-2 py-1.5"><input type="number" min="0" step="0.25" disabled={hourDisabled} value={e.night_hours} onChange={(ev) => patch(i, "night_hours", ev.target.value)} className={cls} /></td>
                      <td className="px-2 py-1.5"><input type="number" min="0" step="0.25" disabled={hourDisabled} value={e.weekend_hours} onChange={(ev) => patch(i, "weekend_hours", ev.target.value)} className={cls} /></td>
                      <td className="px-2 py-1.5"><input type="number" min="0" step="0.25" disabled={hourDisabled} value={e.holiday_hours} onChange={(ev) => patch(i, "holiday_hours", ev.target.value)} className={cls} /></td>
                      <td className="px-2 py-1.5 text-center"><input type="checkbox" disabled={locked} checked={e.is_absent} onChange={(ev) => patch(i, "is_absent", ev.target.checked)} className="h-4 w-4 rounded disabled:opacity-30" style={{ accentColor: "var(--dx-accent)" }} /></td>
                      <td className="px-2 py-1.5">
                        {e.is_leave ? (
                          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: "var(--dx-info-soft)", color: "var(--dx-info)" }}>{e.leave_label}</span>
                        ) : (
                          <input type="text" value={e.note} onChange={(ev) => patch(i, "note", ev.target.value)} placeholder="—" className="dx-editor dx-editor-sm w-28" />
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <DxButton icon size="sm" variant="text" onClick={() => removeRow(i)} disabled={locked} title={locked ? "Leave days are managed automatically" : "Remove day"}><X /></DxButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--dx-surface-sunken)] text-[11px] font-bold text-[var(--dx-text)]">
                  <td className="px-3 py-2">Totals</td>
                  <td className="px-3 py-2 text-right">{totals.reg}</td>
                  <td className="px-3 py-2 text-right">{totals.ot}</td>
                  <td className="px-3 py-2 text-right">{totals.night}</td>
                  <td className="px-3 py-2 text-right">{totals.weekend}</td>
                  <td className="px-3 py-2 text-right">{totals.holiday}</td>
                  <td className="px-3 py-2 text-center">{totals.abs} abs</td>
                  <td className="px-3 py-2" colSpan={2}>{totals.leave > 0 ? <span style={{ color: "var(--dx-info)" }}>{totals.leave} leave day{totals.leave === 1 ? "" : "s"}</span> : null}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-[var(--dx-text-muted)]">
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border" style={{ background: "var(--dx-info-soft)", borderColor: "var(--dx-info)" }} /> Leave (auto-filled from approved requests, not editable)</span>
            <span>Marking a day absent zeroes its hours. Totals roll up on save.</span>
            {leaveQuery.isFetching ? <span style={{ color: "var(--dx-info)" }}>Checking leave…</span> : null}
          </div>
        </div>

        <DxTextarea label="Notes (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </DxPopup>
  );
}

function TimesheetDetailModal({ timesheet, onClose }: { timesheet: Timesheet | null; onClose: () => void }) {
  if (!timesheet) return null;
  const entries = timesheet.entries ?? [];
  const leaveDays = entries.filter((e) => e.is_leave).length;
  const chip = "rounded-md bg-[var(--dx-surface-sunken)] px-2 py-1 text-[var(--dx-text-muted)]";
  return (
    <DxPopup
      isOpen={!!timesheet} onClose={onClose} size="lg"
      title={`Timesheet — ${fmt(timesheet.period_start)} → ${fmt(timesheet.period_end)}`}
      footer={<DxButton onClick={onClose}>Close</DxButton>}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <DxBadge tone={statusTone[timesheet.status]}>{timesheet.status}</DxBadge>
          <span className={chip}>Regular {num(timesheet.total_regular_hours)}h</span>
          <span className={chip}>OT {num(timesheet.total_overtime_hours)}h</span>
          <span className={chip}>Night {num(timesheet.total_night_hours)}h</span>
          <span className={chip}>Weekend {num(timesheet.total_weekend_hours)}h</span>
          <span className={chip}>Holiday {num(timesheet.total_holiday_hours)}h</span>
          {leaveDays > 0 ? <span className="rounded-md px-2 py-1" style={{ background: "var(--dx-info-soft)", color: "var(--dx-info)" }}>Leave {leaveDays}d</span> : null}
          <span className={chip}>Absences {timesheet.absence_days ?? 0}</span>
        </div>
        {entries.length === 0 ? (
          <div className="py-12 text-center text-[var(--dx-text-muted)]"><CalendarDays className="mx-auto mb-2 h-10 w-10 text-[var(--dx-text-faint)]" />No daily entries recorded.</div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-[var(--dx-border)]">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="bg-[var(--dx-surface-sunken)] text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">
                  <th className="px-3 py-2">Date</th><th className="px-3 py-2 text-right">Reg</th><th className="px-3 py-2 text-right">OT</th><th className="px-3 py-2 text-right">Night</th><th className="px-3 py-2 text-right">Wknd</th><th className="px-3 py-2 text-right">Hol</th><th className="px-3 py-2 text-center">Type</th><th className="px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--dx-border)]">
                {entries.map((e, i) => (
                  <tr key={i} style={e.is_leave ? { background: "var(--dx-info-soft)" } : e.is_absent ? { background: "var(--dx-danger-soft)" } : undefined}>
                    <td className="px-3 py-2 font-semibold text-[var(--dx-text)]">{fmt(e.work_date)}</td>
                    <td className="px-3 py-2 text-right">{num(e.regular_hours)}</td>
                    <td className="px-3 py-2 text-right">{num(e.overtime_hours)}</td>
                    <td className="px-3 py-2 text-right">{num(e.night_hours)}</td>
                    <td className="px-3 py-2 text-right">{num(e.weekend_hours)}</td>
                    <td className="px-3 py-2 text-right">{num(e.holiday_hours)}</td>
                    <td className="px-3 py-2 text-center">
                      {e.is_leave ? <span className="font-bold" style={{ color: "var(--dx-info)" }}>Leave</span> : e.is_absent ? <span className="font-bold" style={{ color: "var(--dx-danger)" }}>Absent</span> : "—"}
                    </td>
                    <td className="px-3 py-2 text-[var(--dx-text-muted)]">{e.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DxPopup>
  );
}
