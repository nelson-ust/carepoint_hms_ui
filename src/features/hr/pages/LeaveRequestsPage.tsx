import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Plus, RotateCcw, Send, Eye, Trash2 } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxGrid, DxBadge, DxButton, DxInput, DxSelect, DxTextarea, DxPopup,
  type DxGridColumn, type DxBadgeTone,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { useStaffNameMap } from "@/features/staff/hooks/use-staff";
import { staffDisplayName } from "@/features/staff/api/staff.api";
import { ApprovalDetailModal } from "@/features/approvals/components/ApprovalDetailModal";
import { SelectApproverModal } from "@/features/approvals/components/SelectApproverModal";
import { leaveApi, type LeaveRequest, type LeaveStatus } from "../api/leave.api";

const statusTone: Record<LeaveStatus, DxBadgeTone> = {
  DRAFT: "neutral", PENDING: "warning", APPROVED: "success", REJECTED: "danger", CANCELLED: "neutral",
};

function fmt(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a), d2 = new Date(b);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return 0;
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1);
}

export function LeaveRequestsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { staff } = useStaffNameMap();
  const nameFor = useMemo(() => {
    const m = new Map<number, string>();
    staff.forEach((s) => m.set(s.id, staffDisplayName(s)));
    return (id: number) => m.get(id) || `Staff #${id}`;
  }, [staff]);

  const list = useQuery({ queryKey: ["leave-requests"], queryFn: () => leaveApi.list({ limit: 200 }) });
  const requests = list.data?.items ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [viewRequestId, setViewRequestId] = useState<number | null>(null);
  const [pendingSubmit, setPendingSubmit] = useState<LeaveRequest | null>(null);

  const submit = useMutation({
    mutationFn: ({ row, approverId }: { row: LeaveRequest; approverId: number }) =>
      leaveApi.submit(row.id, { title: `Leave — ${nameFor(row.staff_profile_id)} (${fmt(row.start_date)}–${fmt(row.end_date)})`, assigned_approver_user_id: approverId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leave-requests"] }); setPendingSubmit(null); toast.success("Submitted for approval", "The selected approver has been notified by email."); },
    onError: (err: any) => { const d = err?.response?.data?.detail; toast.error("Couldn't submit", typeof d === "string" ? d : "Configure a LEAVE_REQUEST flow under Approvals → Flows."); },
  });
  const remove = useMutation({
    mutationFn: (id: number) => leaveApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leave-requests"] }); toast.success("Deleted", "Leave request removed."); },
    onError: () => toast.error("Couldn't delete", "Only drafts can be removed."),
  });

  const loadError = list.isError ? apiErrorMessage(list.error, "Failed to load leave requests. Please retry.") : null;

  const columns: DxGridColumn<LeaveRequest>[] = [
    { key: "employee", header: "Employee", render: (r) => <span className="text-[13px] font-semibold text-[var(--dx-text)]">{nameFor(r.staff_profile_id)}</span> },
    { key: "period", header: "Period", render: (r) => <span className="text-[13px] text-[var(--dx-text-muted)]">{fmt(r.start_date)} → {fmt(r.end_date)}</span> },
    { key: "days", header: "Leave days", align: "right", render: (r) => <span className="dx-mono text-[13px] text-[var(--dx-text)]">{String(r.days_requested || daysBetween(r.start_date, r.end_date))}</span> },
    { key: "status", header: "Status", render: (r) => <DxBadge tone={statusTone[r.status]}>{r.status}</DxBadge> },
    {
      key: "action", header: "", align: "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          {r.status === "DRAFT" ? <DxButton size="sm" variant="primary" leftIcon={<Send className="h-3.5 w-3.5" />} isLoading={submit.isPending && submit.variables?.row.id === r.id} onClick={() => setPendingSubmit(r)}>Submit</DxButton> : null}
          {r.approval_request_id ? <DxButton size="sm" variant="text" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => setViewRequestId(r.approval_request_id!)}>Approval</DxButton> : null}
          {r.status === "DRAFT" ? <DxButton icon size="sm" variant="outline-danger" title="Delete" onClick={() => remove.mutate(r.id)}><Trash2 /></DxButton> : null}
        </div>
      ),
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "HR" }, { label: "Leave Management" }]}
        title="Leave Management"
        subtitle="Raise leave requests and route them through the approval flow."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={() => list.refetch()} isLoading={list.isFetching}><RotateCcw /></DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>New request</DxButton>
          </>
        }
      />

      <DxPanel title="Requests" icon={<Calendar className="h-4 w-4" />} flush>
        <DxGrid<LeaveRequest>
          columns={columns}
          data={requests}
          rowKey={(r) => r.id}
          isLoading={list.isLoading}
          error={loadError}
          onRetry={() => list.refetch()}
          empty={{ icon: Calendar, title: "No leave requests", description: "Create one, then submit it for approval." }}
        />
      </DxPanel>

      <CreateLeaveModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => qc.invalidateQueries({ queryKey: ["leave-requests"] })} staff={staff} />
      <ApprovalDetailModal requestId={viewRequestId} isOpen={viewRequestId !== null} onClose={() => setViewRequestId(null)} />
      <SelectApproverModal
        isOpen={pendingSubmit !== null}
        onClose={() => setPendingSubmit(null)}
        requestType="LEAVE_REQUEST"
        summary={pendingSubmit ? `Leave — ${nameFor(pendingSubmit.staff_profile_id)} (${fmt(pendingSubmit.start_date)} → ${fmt(pendingSubmit.end_date)})` : undefined}
        isSubmitting={submit.isPending}
        onConfirm={(approverId) => pendingSubmit && submit.mutate({ row: pendingSubmit, approverId })}
      />
    </DxPage>
  );
}

function CreateLeaveModal({ isOpen, onClose, onCreated, staff }: { isOpen: boolean; onClose: () => void; onCreated: () => void; staff: { id: number }[] }) {
  const toast = useToast();
  const [staffId, setStaffId] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");

  const types = useQuery({ queryKey: ["leave-types"], queryFn: leaveApi.listTypes, enabled: isOpen, staleTime: 5 * 60 * 1000 });
  const leaveTypes = useMemo(() => types.data ?? [], [types.data]);

  useEffect(() => {
    if (isOpen && !leaveTypeId && leaveTypes.length > 0) setLeaveTypeId(String(leaveTypes[0].id));
  }, [isOpen, leaveTypes, leaveTypeId]);

  const dateError = start && end && new Date(end) < new Date(start);
  const days = start && end && !dateError ? daysBetween(start, end) : 0;

  const create = useMutation({
    mutationFn: () => leaveApi.create({
      staff_profile_id: Number(staffId), leave_type_id: Number(leaveTypeId),
      start_date: start, end_date: end, days_requested: daysBetween(start, end), reason: reason || undefined,
    }),
    onSuccess: () => { toast.success("Leave request created", "It's a draft — submit it for approval."); onCreated(); onClose(); resetForm(); },
    onError: (err: any) => { const d = err?.response?.data?.detail; toast.error("Couldn't create", typeof d === "string" ? d : "Check the fields and try again."); },
  });
  function resetForm() { setStaffId(""); setLeaveTypeId(""); setStart(""); setEnd(""); setReason(""); }
  function save() {
    if (!staffId) { toast.error("Missing fields", "Select a staff member."); return; }
    if (!leaveTypeId) { toast.error("Missing fields", "Select a leave type."); return; }
    if (!start || !end) { toast.error("Missing fields", "Start and end dates are required."); return; }
    if (dateError) { toast.error("Invalid dates", "End date can't be before the start date."); return; }
    create.mutate();
  }
  return (
    <DxPopup
      isOpen={isOpen} onClose={() => { onClose(); resetForm(); }} title="New Leave Request" size="md"
      locked={create.isPending}
      footer={
        <>
          <DxButton onClick={() => { onClose(); resetForm(); }}>Cancel</DxButton>
          <DxButton variant="primary" onClick={save} isLoading={create.isPending} disabled={leaveTypes.length === 0}>Create draft</DxButton>
        </>
      }
    >
      <div className="space-y-4">
        <DxSelect label="Staff" value={staffId} onChange={(e) => setStaffId(e.target.value)}
          options={[{ value: "", label: "— Select staff —" }, ...staff.map((s: any) => ({ value: String(s.id), label: staffDisplayName(s) }))]} />
        <DxSelect
          label="Leave type"
          value={leaveTypeId}
          onChange={(e) => setLeaveTypeId(e.target.value)}
          placeholder={types.isLoading ? "Loading leave types…" : "— Select leave type —"}
          options={leaveTypes.map((t) => ({ value: String(t.id), label: t.name }))}
          hint={!types.isLoading && leaveTypes.length === 0 ? "No leave types are configured yet. Add them under HR → Leave types." : undefined}
        />
        <div className="grid grid-cols-2 gap-4">
          <DxInput label="Start date" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <DxInput label="End date" type="date" value={end} onChange={(e) => setEnd(e.target.value)} error={dateError ? "Before start date" : undefined} />
        </div>
        {days > 0 ? (
          <p className="text-[12px] font-semibold text-[var(--dx-text-muted)]">
            Duration: <span className="text-[var(--dx-text)]">{days} day{days > 1 ? "s" : ""}</span>
          </p>
        ) : null}
        <DxTextarea label="Reason (optional)" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Add any context for the approver…" />
      </div>
    </DxPopup>
  );
}
