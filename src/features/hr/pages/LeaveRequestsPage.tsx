import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Plus, RefreshCw, AlertCircle, Send, Eye, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { useStaffNameMap } from "@/features/staff/hooks/use-staff";
import { staffDisplayName } from "@/features/staff/api/staff.api";
import { ApprovalDetailModal } from "@/features/approvals/components/ApprovalDetailModal";
import { SelectApproverModal } from "@/features/approvals/components/SelectApproverModal";
import { leaveApi, type LeaveRequest, type LeaveStatus } from "../api/leave.api";

const statusVariant: Record<LeaveStatus, BadgeProps["variant"]> = {
  DRAFT: "secondary", PENDING: "soft-warning", APPROVED: "soft-success", REJECTED: "soft-danger", CANCELLED: "secondary",
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

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader title="Leave Management" description="Raise leave requests and route them through the approval flow." />
        <div className="flex gap-3">
          <button onClick={() => list.refetch()} className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400"><RefreshCw className={`h-4 w-4 ${list.isFetching ? "animate-spin" : ""}`} /></button>
          <Button leftIcon={<Plus className="h-5 w-5" />} onClick={() => setCreateOpen(true)}>New Request</Button>
        </div>
      </div>

      {list.isError && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center gap-3"><AlertCircle className="h-5 w-5" /><p className="text-sm font-bold">Failed to load leave requests.</p></div>
      )}

      <Card variant="panel" className="p-0 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-secondary-900/5 text-[10px] font-bold uppercase tracking-widest text-secondary-500">
              <th className="px-6 py-4">Employee</th><th className="px-6 py-4">Period</th><th className="px-6 py-4">Leave days</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary-100/60">
            {list.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={5} className="px-6 py-4"><Skeleton className="h-8 w-full" /></td></tr>)
            ) : requests.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-24 text-center"><Calendar className="h-12 w-12 mx-auto text-secondary-200 mb-3" /><p className="font-bold text-secondary-900">No leave requests</p><p className="text-sm text-secondary-400 mt-1">Create one, then submit it for approval.</p></td></tr>
            ) : (
              requests.map((r) => (
                <tr key={r.id} className="hover:bg-primary-50/20">
                  <td className="px-6 py-4 font-bold text-secondary-900">{nameFor(r.staff_profile_id)}</td>
                  <td className="px-6 py-4 text-secondary-600">{fmt(r.start_date)} → {fmt(r.end_date)}</td>
                  <td className="px-6 py-4 text-secondary-600">{String(r.days_requested || daysBetween(r.start_date, r.end_date))}</td>
                  <td className="px-6 py-4"><Badge variant={statusVariant[r.status]}>{r.status}</Badge></td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {r.status === "DRAFT" && (
                        <Button size="sm" leftIcon={<Send className="h-3.5 w-3.5" />} isLoading={submit.isPending && submit.variables?.row.id === r.id} onClick={() => setPendingSubmit(r)}>Submit</Button>
                      )}
                      {r.approval_request_id && (
                        <Button size="sm" variant="ghost" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => setViewRequestId(r.approval_request_id!)}>Approval</Button>
                      )}
                      {r.status === "DRAFT" && (
                        <button onClick={() => remove.mutate(r.id)} className="p-2 rounded-xl hover:bg-rose-50" title="Delete"><Trash2 className="h-4 w-4 text-rose-400" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

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
    </div>
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
    <Modal isOpen={isOpen} onClose={() => { onClose(); resetForm(); }} title="New Leave Request" size="md"
      footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => { onClose(); resetForm(); }}>Cancel</Button><Button onClick={save} isLoading={create.isPending} disabled={leaveTypes.length === 0}>Create draft</Button></div>}>
      <div className="space-y-4">
        <Select label="Staff" value={staffId} onChange={(e) => setStaffId(e.target.value)}
          options={[{ value: "", label: "— Select staff —" }, ...staff.map((s: any) => ({ value: String(s.id), label: staffDisplayName(s) }))]} />
        <Select
          label="Leave type"
          value={leaveTypeId}
          onChange={(e) => setLeaveTypeId(e.target.value)}
          placeholder={types.isLoading ? "Loading leave types…" : "— Select leave type —"}
          options={leaveTypes.map((t) => ({ value: String(t.id), label: t.name }))}
          hint={
            !types.isLoading && leaveTypes.length === 0
              ? "No leave types are configured yet. Add them under HR → Leave types."
              : undefined
          }
        />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Start date" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input label="End date" type="date" value={end} onChange={(e) => setEnd(e.target.value)} error={dateError ? "Before start date" : undefined} />
        </div>
        {days > 0 && (
          <p className="text-xs font-semibold text-secondary-500">
            Duration: <span className="text-secondary-900">{days} day{days > 1 ? "s" : ""}</span>
          </p>
        )}
        <Textarea label="Reason (optional)" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Add any context for the approver…" />
      </div>
    </Modal>
  );
}
