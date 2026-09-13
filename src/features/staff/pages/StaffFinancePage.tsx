import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, RefreshCw, AlertCircle, Send, Eye, Trash2, Wallet, ReceiptText, Banknote, Paperclip, FileText, X,
} from "lucide-react";
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
import { getStoredUser } from "@/lib/auth/current-user";
import { usePermissionGate } from "@/lib/permissions/usePermissionGate";
import { SelectApproverModal } from "@/features/approvals/components/SelectApproverModal";
import {
  staffFinanceApi,
  type SalaryAdvance, type SalaryAdvanceStatus,
  type Reimbursement, type ReimbursementStatus,
} from "../api/staff-finance.api";
import { accountsApi, type Account } from "@/features/billing/api/accounts.api";

const advanceVariant: Record<SalaryAdvanceStatus, BadgeProps["variant"]> = {
  DRAFT: "secondary", SUBMITTED: "soft-info", APPROVED: "soft-success",
  REJECTED: "soft-danger", PAID: "soft-success", CANCELLED: "secondary",
};
const claimVariant: Record<ReimbursementStatus, BadgeProps["variant"]> = {
  DRAFT: "secondary", PENDING: "soft-warning", APPROVED: "soft-success",
  REJECTED: "soft-danger", CANCELLED: "secondary", PAID: "soft-success",
};

const EXPENSE_CATEGORIES = [
  "Transport", "Accommodation", "Meals", "Medical Supplies", "Training",
  "Communication", "Equipment", "Fuel", "Stationery", "Other",
];

const num = (v: number | string | null | undefined) => (v == null ? 0 : typeof v === "number" ? v : Number(v) || 0);
const naira = (v: number) => `₦${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
function fmtMonth(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
function myName(): string {
  const u = getStoredUser() as any;
  const n = `${u?.first_name ?? ""} ${u?.last_name ?? ""}`.trim();
  return n || u?.username || u?.email || "Staff";
}

export function StaffFinancePage() {
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"ADVANCES" | "CLAIMS" | "DISBURSE">("ADVANCES");
  const gate = usePermissionGate();
  const canDisburse = gate.hasAny(["USER_MANAGE_STATUS", "PAYMENT_RECEIVE", "ACCOUNTING_POST"]);
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [pendingAdvance, setPendingAdvance] = useState<SalaryAdvance | null>(null);
  const [pendingClaim, setPendingClaim] = useState<Reimbursement | null>(null);

  const advances = useQuery({ queryKey: ["my-salary-advances"], queryFn: () => staffFinanceApi.listMyAdvances({ limit: 200 }) });
  const claims = useQuery({ queryKey: ["my-reimbursements"], queryFn: () => staffFinanceApi.listMyReimbursements({ limit: 200 }) });
  const advanceRows = advances.data?.items ?? [];
  const claimRows = claims.data?.items ?? [];
  const loading = advances.isLoading || claims.isLoading;

  const outstandingAdvances = useMemo(
    () => advanceRows.filter((a) => a.status === "APPROVED" || a.status === "PAID").reduce((s, a) => s + num(a.amount), 0),
    [advanceRows],
  );
  const pendingClaims = useMemo(
    () => claimRows.filter((r) => r.status === "PENDING").reduce((s, r) => s + num(r.amount), 0),
    [claimRows],
  );
  const awaitingCount = advanceRows.filter((a) => a.status === "SUBMITTED").length + claimRows.filter((r) => r.status === "PENDING").length;

  const refetchAll = () => { advances.refetch(); claims.refetch(); };
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["my-salary-advances"] });
    qc.invalidateQueries({ queryKey: ["my-reimbursements"] });
  };

  const submitAdvance = useMutation({
    mutationFn: ({ row, approverId }: { row: SalaryAdvance; approverId: number }) =>
      staffFinanceApi.submitMyAdvance(row.id, { title: `Salary Advance — ${myName()} (${naira(num(row.amount))}, ${fmtMonth(row.repayment_month)})`, assigned_approver_user_id: approverId }),
    onSuccess: () => { invalidate(); setPendingAdvance(null); toast.success("Submitted for approval", "Your selected approver has been notified by email."); },
    onError: (err: any) => { const d = err?.response?.data?.detail; toast.error("Couldn't submit", typeof d === "string" ? d : "Configure a SALARY_ADVANCE flow under Approvals → Flows."); },
  });
  const submitClaim = useMutation({
    mutationFn: ({ row, approverId }: { row: Reimbursement; approverId: number }) =>
      staffFinanceApi.submitMyReimbursement(row.id, { title: `Expense Claim — ${myName()} (${row.category}, ${naira(num(row.amount))})`, assigned_approver_user_id: approverId }),
    onSuccess: () => { invalidate(); setPendingClaim(null); toast.success("Submitted for approval", "Your selected approver has been notified by email."); },
    onError: (err: any) => { const d = err?.response?.data?.detail; toast.error("Couldn't submit", typeof d === "string" ? d : "Configure a REIMBURSEMENT flow under Approvals → Flows."); },
  });
  const removeAdvance = useMutation({
    mutationFn: (id: number) => staffFinanceApi.removeMyAdvance(id),
    onSuccess: () => { invalidate(); toast.success("Deleted", "Salary advance draft removed."); },
    onError: () => toast.error("Couldn't delete", "Only drafts can be removed."),
  });
  const removeClaim = useMutation({
    mutationFn: (id: number) => staffFinanceApi.removeMyReimbursement(id),
    onSuccess: () => { invalidate(); toast.success("Deleted", "Expense claim draft removed."); },
    onError: () => toast.error("Couldn't delete", "Only drafts can be removed."),
  });

  const openApproval = (id?: number | null) => { if (id) navigate(`/approvals/requests/${id}`); };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Staff Financial Services"
          description="Request salary advances and expense reimbursements, and track them through the approval flow."
        />
        <div className="flex flex-wrap gap-3">
          <button onClick={refetchAll} className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${advances.isFetching || claims.isFetching ? "animate-spin" : ""}`} />
          </button>
          <Button variant="secondary" leftIcon={<ReceiptText className="h-4 w-4" />} onClick={() => setClaimModalOpen(true)}>
            New Expense Claim
          </Button>
          <Button leftIcon={<Plus className="h-5 w-5" />} onClick={() => setAdvanceModalOpen(true)}>
            New Salary Advance
          </Button>
        </div>
      </div>

      {(advances.isError || claims.isError) && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center gap-3">
          <AlertCircle className="h-5 w-5" /><p className="text-sm font-bold">Failed to load your financial requests.</p>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "My Outstanding Advances", value: naira(outstandingAdvances), icon: Wallet, tone: "text-secondary-900" },
          { label: "My Pending Claims", value: naira(pendingClaims), icon: ReceiptText, tone: "text-amber-500" },
          { label: "Awaiting Approval", value: String(awaitingCount), icon: Banknote, tone: "text-primary-600" },
        ].map((s) => (
          <Card key={s.label} variant="panel" className="p-6 flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-600"><s.icon className="h-5 w-5" /></span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">{s.label}</p>
              {loading ? <Skeleton className="h-7 w-24 mt-1" /> : <p className={`text-2xl font-black tracking-tight ${s.tone}`}>{s.value}</p>}
            </div>
          </Card>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 bg-secondary-100/50 p-1 rounded-2xl w-fit">
        {([["ADVANCES", `Salary Advances (${advanceRows.length})`], ["CLAIMS", `Expense Claims (${claimRows.length})`], ...(canDisburse ? ([["DISBURSE", "Disbursements"]] as const) : [])] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${tab === key ? "bg-white text-primary-600 shadow-sm" : "text-secondary-400 hover:text-secondary-600"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Tables ── */}
      {tab === "DISBURSE" ? (
        <DisbursementsPanel />
      ) : tab === "ADVANCES" ? (
        <Card variant="panel" className="p-0 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-secondary-900/5 text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                <th className="px-6 py-4">Amount</th><th className="px-6 py-4">Repayment Month</th><th className="px-6 py-4">Reason</th><th className="px-6 py-4">Account</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100/60">
              {advances.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={6} className="px-6 py-4"><Skeleton className="h-8 w-full" /></td></tr>)
              ) : advanceRows.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-24 text-center">
                  <Wallet className="h-12 w-12 mx-auto text-secondary-200 mb-3" />
                  <p className="font-bold text-secondary-900">No salary advances yet</p>
                  <p className="text-sm text-secondary-400 mt-1">Create a request, then submit it for approval.</p>
                </td></tr>
              ) : (
                advanceRows.map((a) => (
                  <tr key={a.id} className="hover:bg-primary-50/20">
                    <td className="px-6 py-4 font-bold text-secondary-900">{naira(num(a.amount))}</td>
                    <td className="px-6 py-4 text-secondary-600">{fmtMonth(a.repayment_month)}</td>
                    <td className="px-6 py-4 text-secondary-500 max-w-[14rem] truncate">{a.reason || "—"}</td>
                    <td className="px-6 py-4 text-secondary-600">{a.account_code ? <span title={a.account_name ?? undefined} className="font-semibold">{a.account_code}</span> : "—"}</td>
                    <td className="px-6 py-4"><Badge variant={advanceVariant[a.status]}>{a.status}</Badge></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {a.status === "DRAFT" && (
                          <Button size="sm" leftIcon={<Send className="h-3.5 w-3.5" />} isLoading={submitAdvance.isPending && submitAdvance.variables?.row.id === a.id} onClick={() => setPendingAdvance(a)}>Submit</Button>
                        )}
                        {a.approval_request_id && (
                          <Button size="sm" variant="ghost" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => openApproval(a.approval_request_id)}>Approval</Button>
                        )}
                        {a.status === "DRAFT" && (
                          <button onClick={() => removeAdvance.mutate(a.id)} className="p-2 rounded-xl hover:bg-rose-50" title="Delete draft"><Trash2 className="h-4 w-4 text-rose-400" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      ) : (
        <Card variant="panel" className="p-0 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-secondary-900/5 text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                <th className="px-6 py-4">Expense Date</th><th className="px-6 py-4">Category</th><th className="px-6 py-4">Account</th><th className="px-6 py-4">Amount</th><th className="px-6 py-4">Description</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100/60">
              {claims.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={7} className="px-6 py-4"><Skeleton className="h-8 w-full" /></td></tr>)
              ) : claimRows.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-24 text-center">
                  <ReceiptText className="h-12 w-12 mx-auto text-secondary-200 mb-3" />
                  <p className="font-bold text-secondary-900">No expense claims yet</p>
                  <p className="text-sm text-secondary-400 mt-1">Log an expense, then submit it for reimbursement approval.</p>
                </td></tr>
              ) : (
                claimRows.map((r) => (
                  <tr key={r.id} className="hover:bg-primary-50/20">
                    <td className="px-6 py-4 text-secondary-600">{fmtDate(r.expense_date)}</td>
                    <td className="px-6 py-4 font-bold text-secondary-900">{r.category}</td>
                    <td className="px-6 py-4 text-secondary-600">{r.account_code ? <span title={r.account_name ?? undefined} className="font-semibold">{r.account_code}</span> : "—"}</td>
                    <td className="px-6 py-4 font-bold text-secondary-900">{naira(num(r.amount))}</td>
                    <td className="px-6 py-4 text-secondary-500 max-w-[14rem] truncate">{r.description}</td>
                    <td className="px-6 py-4"><Badge variant={claimVariant[r.status]}>{r.status}</Badge></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {r.status === "DRAFT" && (
                          <Button size="sm" leftIcon={<Send className="h-3.5 w-3.5" />} isLoading={submitClaim.isPending && submitClaim.variables?.row.id === r.id} onClick={() => setPendingClaim(r)}>Submit</Button>
                        )}
                        {r.receipt_display_url && (
                          <a href={r.receipt_display_url} target="_blank" rel="noreferrer" title="View receipt"
                            className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold text-primary-600 hover:bg-primary-50">
                            <Paperclip className="h-3.5 w-3.5" /> Receipt
                          </a>
                        )}
                        {r.approval_request_id && (
                          <Button size="sm" variant="ghost" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => openApproval(r.approval_request_id)}>Approval</Button>
                        )}
                        {r.status === "DRAFT" && (
                          <button onClick={() => removeClaim.mutate(r.id)} className="p-2 rounded-xl hover:bg-rose-50" title="Delete draft"><Trash2 className="h-4 w-4 text-rose-400" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}

      <CreateAdvanceModal isOpen={advanceModalOpen} onClose={() => setAdvanceModalOpen(false)} onCreated={invalidate} />
      <CreateClaimModal isOpen={claimModalOpen} onClose={() => setClaimModalOpen(false)} onCreated={invalidate} />
      <SelectApproverModal
        isOpen={pendingAdvance !== null}
        onClose={() => setPendingAdvance(null)}
        requestType="SALARY_ADVANCE"
        summary={pendingAdvance ? `Salary Advance — ${naira(num(pendingAdvance.amount))} (${fmtMonth(pendingAdvance.repayment_month)})` : undefined}
        isSubmitting={submitAdvance.isPending}
        onConfirm={(approverId) => pendingAdvance && submitAdvance.mutate({ row: pendingAdvance, approverId })}
      />
      <SelectApproverModal
        isOpen={pendingClaim !== null}
        onClose={() => setPendingClaim(null)}
        requestType="REIMBURSEMENT"
        summary={pendingClaim ? `Expense Claim — ${pendingClaim.category}, ${naira(num(pendingClaim.amount))}` : undefined}
        isSubmitting={submitClaim.isPending}
        onConfirm={(approverId) => pendingClaim && submitClaim.mutate({ row: pendingClaim, approverId })}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Modals
// ════════════════════════════════════════════════════════════════════

function AccountSelect({
  value, onChange, accounts, loading,
}: {
  value: string;
  onChange: (v: string) => void;
  accounts: Account[];
  loading: boolean;
}) {
  return (
    <div>
      <Select
        label="Posting account"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        options={[
          { value: "", label: loading ? "Loading accounts…" : "— Select posting account —" },
          ...accounts.map((a) => ({ value: String(a.id), label: `${a.code} — ${a.name}` })),
        ]}
      />
      {!loading && accounts.length === 0 && (
        <p className="mt-1 text-[11px] font-semibold text-amber-600">
          No accounts found. Add them under Billing → Chart of Accounts first.
        </p>
      )}
      <p className="mt-1 text-[11px] text-secondary-400">
        The chart-of-accounts code this request will be posted to.
      </p>
    </div>
  );
}

function CreateAdvanceModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState("");
  const [reason, setReason] = useState("");
  const [accountId, setAccountId] = useState("");
  const accountsQuery = useQuery({ queryKey: ["accounts", "active"], queryFn: () => accountsApi.list(), enabled: isOpen });
  const accounts = accountsQuery.data ?? [];

  const create = useMutation({
    mutationFn: () => staffFinanceApi.createMyAdvance({
      amount: Number(amount),
      repayment_month: `${month}-01`,
      reason: reason || undefined,
      account_id: Number(accountId),
    }),
    onSuccess: () => { toast.success("Salary advance created", "It's a draft — submit it for approval."); onCreated(); onClose(); reset(); },
    onError: (err: any) => { const d = err?.response?.data?.detail; toast.error("Couldn't create", typeof d === "string" ? d : "Check the fields and try again."); },
  });
  function reset() { setAmount(""); setMonth(""); setReason(""); setAccountId(""); }
  function save() {
    if (!amount || Number(amount) <= 0) { toast.error("Invalid amount", "Enter an amount greater than zero."); return; }
    if (!month) { toast.error("Missing month", "Pick the salary month the advance will be recovered from."); return; }
    if (!accountId) { toast.error("Missing account", "Select the posting account for this advance."); return; }
    create.mutate();
  }
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Salary Advance" size="md"
      footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} isLoading={create.isPending}>Create draft</Button></div>}>
      <div className="space-y-4">
        <Input label="Amount (₦)" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 50000" />
        <Input label="Repayment month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} hint="The salary month the advance will be deducted from." />
        <Textarea label="Reason (optional)" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why do you need the advance?" />
        <AccountSelect value={accountId} onChange={setAccountId} accounts={accounts} loading={accountsQuery.isLoading} />
        <p className="text-[11px] text-secondary-400">Created as a draft. Submit it to route through the SALARY_ADVANCE approval flow.</p>
      </div>
    </Modal>
  );
}

function CreateClaimModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [expenseDate, setExpenseDate] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [accountId, setAccountId] = useState("");
  const [description, setDescription] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const receiptRef = useRef<HTMLInputElement>(null);
  const accountsQuery = useQuery({ queryKey: ["accounts", "active"], queryFn: () => accountsApi.list(), enabled: isOpen });
  const accounts = accountsQuery.data ?? [];

  function onPickReceipt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/\.(png|jpe?g|webp|gif|pdf)$/i.test(file.name)) {
      toast.error("Unsupported file", "Attach a PNG, JPG, WEBP, GIF or PDF receipt.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large", "Please attach a receipt under 10 MB.");
      return;
    }
    setReceiptFile(file);
  }

  function reset() { setExpenseDate(""); setAmount(""); setCategory(""); setAccountId(""); setDescription(""); setReceiptFile(null); }

  async function save() {
    if (!expenseDate) { toast.error("Missing date", "When was the expense incurred?"); return; }
    if (!amount || Number(amount) <= 0) { toast.error("Invalid amount", "Enter an amount greater than zero."); return; }
    if (!category) { toast.error("Missing category", "Pick an expense category."); return; }
    if (!accountId) { toast.error("Missing account", "Select the posting account for this claim."); return; }
    if (!description.trim()) { toast.error("Missing description", "Describe what the expense was for."); return; }
    setSaving(true);
    try {
      let receiptUrl: string | undefined;
      if (receiptFile) {
        toast.info("Uploading receipt…", "Storing your receipt in secure storage.");
        receiptUrl = await staffFinanceApi.uploadMyReceipt(receiptFile);
      }
      await staffFinanceApi.createMyReimbursement({
        expense_date: expenseDate,
        amount: Number(amount),
        category,
        account_id: Number(accountId),
        description,
        receipt_url: receiptUrl,
      });
      toast.success("Expense claim created", "It's a draft — submit it for approval.");
      onCreated(); onClose(); reset();
    } catch (err: any) {
      const d = err?.response?.data?.message || err?.response?.data?.detail;
      toast.error("Couldn't create", typeof d === "string" ? d : "Check the fields and try again.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Expense Claim" size="md"
      footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button onClick={save} isLoading={saving}>Create draft</Button></div>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Expense date" type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
          <Input label="Amount (₦)" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 12500" />
        </div>
        <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}
          options={[{ value: "", label: "— Select category —" }, ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))]} />
        <AccountSelect value={accountId} onChange={setAccountId} accounts={accounts} loading={accountsQuery.isLoading} />
        <Textarea label="Description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was the expense for?" />

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-secondary-500">Receipt (optional)</label>
          {receiptFile ? (
            <div className="flex items-center gap-3 rounded-2xl border border-secondary-200 bg-secondary-50/70 px-4 py-3">
              <FileText className="h-5 w-5 shrink-0 text-primary-500" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-secondary-800">{receiptFile.name}</span>
              <span className="text-[10px] font-bold text-secondary-400">{(receiptFile.size / 1024).toFixed(0)} KB</span>
              <button type="button" onClick={() => setReceiptFile(null)} className="rounded-lg p-1.5 hover:bg-rose-50" title="Remove attachment">
                <X className="h-4 w-4 text-rose-400" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => receiptRef.current?.click()}
              className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-secondary-300 bg-secondary-50/60 px-4 py-4 text-left transition-colors hover:border-primary-400"
            >
              <Paperclip className="h-5 w-5 text-primary-500" />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-secondary-800">Attach receipt</span>
                <span className="block text-xs text-secondary-400">PNG, JPG, WEBP, GIF or PDF · up to 10 MB · stored securely on S3</span>
              </span>
            </button>
          )}
          <input ref={receiptRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" className="hidden" onChange={onPickReceipt} />
        </div>

        <p className="text-[11px] text-secondary-400">Created as a draft. Submit it to route through the REIMBURSEMENT approval flow.</p>
      </div>
    </Modal>
  );
}


function DisbursementsPanel() {
  const toast = useToast();
  const qc = useQueryClient();
  const all = useQuery({
    queryKey: ["advances-admin"],
    queryFn: () => staffFinanceApi.listAllAdvances(),
  });
  const disburse = useMutation({
    mutationFn: (id: number) => staffFinanceApi.disburseAdvance(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advances-admin"] });
      toast.success("Advance disbursed", "It will be recovered automatically in the next payroll run.");
    },
    onError: (e: any) =>
      toast.error("Couldn't disburse", e?.response?.data?.detail || e?.response?.data?.message || "Please try again."),
  });

  const rows = (all.data?.items ?? []) as SalaryAdvance[];
  const approved = rows.filter((r) => r.status === "APPROVED");
  const disbursed = rows.filter((r) => r.status === "PAID");

  return (
    <Card variant="panel" className="p-0 overflow-hidden">
      <div className="px-6 py-4 border-b border-secondary-100/60">
        <p className="text-sm font-bold">Approved advances awaiting disbursement</p>
        <p className="text-xs text-secondary-400">Confirm the cash/transfer left the till. Only disbursed advances are recovered by payroll and posted to the ledger.</p>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-secondary-900/5 text-[10px] font-bold uppercase tracking-widest text-secondary-500">
            <th className="px-6 py-3">Staff</th><th className="px-6 py-3">Amount</th>
            <th className="px-6 py-3">Repayment month</th><th className="px-6 py-3">Status</th>
            <th className="px-6 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-secondary-100/60">
          {all.isLoading ? (
            <tr><td colSpan={5} className="px-6 py-6"><Skeleton className="h-8 w-full" /></td></tr>
          ) : approved.length === 0 && disbursed.length === 0 ? (
            <tr><td colSpan={5} className="px-6 py-16 text-center text-secondary-400 text-sm">No approved advances awaiting disbursement.</td></tr>
          ) : (
            [...approved, ...disbursed].map((r) => (
              <tr key={r.id}>
                <td className="px-6 py-3 text-xs data-mono">SP-{r.staff_profile_id}</td>
                <td className="px-6 py-3 data-mono font-bold">₦{Number(r.amount).toLocaleString()}</td>
                <td className="px-6 py-3 text-xs">{String(r.repayment_month).slice(0, 7)}</td>
                <td className="px-6 py-3"><Badge variant={r.status === "PAID" ? "soft-success" : "soft-warning"}>{r.status === "PAID" ? "DISBURSED" : r.status}</Badge></td>
                <td className="px-6 py-3 text-right">
                  {r.status === "APPROVED" && (
                    <Button size="sm" isLoading={disburse.isPending} onClick={() => disburse.mutate(r.id)}>
                      Mark disbursed
                    </Button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Card>
  );
}
