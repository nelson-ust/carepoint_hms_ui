import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, RotateCcw, Send, Eye, Trash2, Wallet, ReceiptText, Banknote, Paperclip, FileText, X,
} from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxKpi, DxGrid, DxTabs, DxBadge, DxButton, DxInput, DxTextarea, DxSelect, DxPopup, DxMessage,
  type DxGridColumn, type DxBadgeTone,
} from "@/components/dx";
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

const advanceTone: Record<SalaryAdvanceStatus, DxBadgeTone> = {
  DRAFT: "neutral", SUBMITTED: "info", APPROVED: "success", REJECTED: "danger", PAID: "success", CANCELLED: "neutral",
};
const claimTone: Record<ReimbursementStatus, DxBadgeTone> = {
  DRAFT: "neutral", PENDING: "warning", APPROVED: "success", REJECTED: "danger", CANCELLED: "neutral", PAID: "success",
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

type FinanceTab = "ADVANCES" | "CLAIMS" | "DISBURSE";

export function StaffFinancePage() {
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<FinanceTab>("ADVANCES");
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
  const pendingClaimsTotal = useMemo(
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

  const advanceColumns: DxGridColumn<SalaryAdvance>[] = [
    { key: "amount", header: "Amount", render: (a) => <span className="dx-mono text-[13px] font-bold text-[var(--dx-text)]">{naira(num(a.amount))}</span> },
    { key: "month", header: "Repayment Month", render: (a) => <span className="text-[13px] text-[var(--dx-text-muted)]">{fmtMonth(a.repayment_month)}</span> },
    { key: "reason", header: "Reason", render: (a) => <span className="block max-w-[14rem] truncate text-[13px] text-[var(--dx-text-muted)]">{a.reason || "—"}</span> },
    { key: "account", header: "Account", render: (a) => a.account_code ? <span className="dx-mono text-[12px] font-semibold text-[var(--dx-text)]" title={a.account_name ?? undefined}>{a.account_code}</span> : <span className="text-[var(--dx-text-muted)]">—</span> },
    { key: "status", header: "Status", render: (a) => <DxBadge tone={advanceTone[a.status]}>{a.status}</DxBadge> },
    {
      key: "action", header: "", align: "right",
      render: (a) => (
        <div className="flex items-center justify-end gap-2">
          {a.status === "DRAFT" ? <DxButton size="sm" variant="primary" leftIcon={<Send className="h-3.5 w-3.5" />} isLoading={submitAdvance.isPending && submitAdvance.variables?.row.id === a.id} onClick={() => setPendingAdvance(a)}>Submit</DxButton> : null}
          {a.approval_request_id ? <DxButton size="sm" variant="text" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => openApproval(a.approval_request_id)}>Approval</DxButton> : null}
          {a.status === "DRAFT" ? <DxButton icon size="sm" variant="outline-danger" title="Delete draft" onClick={() => removeAdvance.mutate(a.id)}><Trash2 /></DxButton> : null}
        </div>
      ),
    },
  ];

  const claimColumns: DxGridColumn<Reimbursement>[] = [
    { key: "date", header: "Expense Date", render: (r) => <span className="text-[13px] text-[var(--dx-text-muted)]">{fmtDate(r.expense_date)}</span> },
    { key: "category", header: "Category", render: (r) => <span className="text-[13px] font-semibold text-[var(--dx-text)]">{r.category}</span> },
    { key: "account", header: "Account", render: (r) => r.account_code ? <span className="dx-mono text-[12px] font-semibold text-[var(--dx-text)]" title={r.account_name ?? undefined}>{r.account_code}</span> : <span className="text-[var(--dx-text-muted)]">—</span> },
    { key: "amount", header: "Amount", render: (r) => <span className="dx-mono text-[13px] font-bold text-[var(--dx-text)]">{naira(num(r.amount))}</span> },
    { key: "description", header: "Description", render: (r) => <span className="block max-w-[14rem] truncate text-[13px] text-[var(--dx-text-muted)]">{r.description}</span> },
    { key: "status", header: "Status", render: (r) => <DxBadge tone={claimTone[r.status]}>{r.status}</DxBadge> },
    {
      key: "action", header: "", align: "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          {r.status === "DRAFT" ? <DxButton size="sm" variant="primary" leftIcon={<Send className="h-3.5 w-3.5" />} isLoading={submitClaim.isPending && submitClaim.variables?.row.id === r.id} onClick={() => setPendingClaim(r)}>Submit</DxButton> : null}
          {r.receipt_display_url ? (
            <a href={r.receipt_display_url} target="_blank" rel="noreferrer" title="View receipt" className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-[var(--dx-accent)] hover:bg-[var(--dx-accent-soft)]">
              <Paperclip className="h-3.5 w-3.5" /> Receipt
            </a>
          ) : null}
          {r.approval_request_id ? <DxButton size="sm" variant="text" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => openApproval(r.approval_request_id)}>Approval</DxButton> : null}
          {r.status === "DRAFT" ? <DxButton icon size="sm" variant="outline-danger" title="Delete draft" onClick={() => removeClaim.mutate(r.id)}><Trash2 /></DxButton> : null}
        </div>
      ),
    },
  ];

  const tabItems = [
    { key: "ADVANCES" as const, label: `Salary Advances (${advanceRows.length})` },
    { key: "CLAIMS" as const, label: `Expense Claims (${claimRows.length})` },
    ...(canDisburse ? [{ key: "DISBURSE" as const, label: "Disbursements" }] : []),
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "HR" }, { label: "Financial Services" }]}
        title="Staff Financial Services"
        subtitle="Request salary advances and expense reimbursements, and track them through the approval flow."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={refetchAll} isLoading={advances.isFetching || claims.isFetching}><RotateCcw /></DxButton>
            <DxButton leftIcon={<ReceiptText className="h-4 w-4" />} onClick={() => setClaimModalOpen(true)}>New expense claim</DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setAdvanceModalOpen(true)}>New salary advance</DxButton>
          </>
        }
      />

      {(advances.isError || claims.isError) ? <DxMessage tone="danger">Failed to load your financial requests.</DxMessage> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <DxKpi label="My Outstanding Advances" value={naira(outstandingAdvances)} icon={Wallet} tone="accent" isLoading={loading} />
        <DxKpi label="My Pending Claims" value={naira(pendingClaimsTotal)} icon={ReceiptText} tone="warning" isLoading={loading} />
        <DxKpi label="Awaiting Approval" value={String(awaitingCount)} icon={Banknote} tone="info" isLoading={loading} />
      </div>

      <DxTabs items={tabItems} value={tab} onChange={setTab} />

      {tab === "DISBURSE" ? (
        <DisbursementsPanel />
      ) : tab === "ADVANCES" ? (
        <DxPanel title="Salary Advances" icon={<Wallet className="h-4 w-4" />} flush>
          <DxGrid<SalaryAdvance>
            columns={advanceColumns}
            data={advanceRows}
            rowKey={(a) => a.id}
            isLoading={advances.isLoading}
            empty={{ icon: Wallet, title: "No salary advances yet", description: "Create a request, then submit it for approval." }}
          />
        </DxPanel>
      ) : (
        <DxPanel title="Expense Claims" icon={<ReceiptText className="h-4 w-4" />} flush>
          <DxGrid<Reimbursement>
            columns={claimColumns}
            data={claimRows}
            rowKey={(r) => r.id}
            isLoading={claims.isLoading}
            empty={{ icon: ReceiptText, title: "No expense claims yet", description: "Log an expense, then submit it for reimbursement approval." }}
          />
        </DxPanel>
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
    </DxPage>
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
      <DxSelect
        label="Posting account"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        options={[
          { value: "", label: loading ? "Loading accounts…" : "— Select posting account —" },
          ...accounts.map((a) => ({ value: String(a.id), label: `${a.code} — ${a.name}` })),
        ]}
      />
      {!loading && accounts.length === 0 ? (
        <p className="mt-1 text-[11px] font-semibold" style={{ color: "var(--dx-warning)" }}>No accounts found. Add them under Billing → Chart of Accounts first.</p>
      ) : null}
      <p className="mt-1 text-[11px] text-[var(--dx-text-muted)]">The chart-of-accounts code this request will be posted to.</p>
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
    <DxPopup
      isOpen={isOpen} onClose={onClose} title="New Salary Advance" size="md"
      locked={create.isPending}
      footer={<><DxButton onClick={onClose}>Cancel</DxButton><DxButton variant="primary" onClick={save} isLoading={create.isPending}>Create draft</DxButton></>}
    >
      <div className="space-y-4">
        <DxInput label="Amount (₦)" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 50000" />
        <DxInput label="Repayment month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} hint="The salary month the advance will be deducted from." />
        <DxTextarea label="Reason (optional)" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why do you need the advance?" />
        <AccountSelect value={accountId} onChange={setAccountId} accounts={accounts} loading={accountsQuery.isLoading} />
        <p className="text-[11px] text-[var(--dx-text-muted)]">Created as a draft. Submit it to route through the SALARY_ADVANCE approval flow.</p>
      </div>
    </DxPopup>
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
    <DxPopup
      isOpen={isOpen} onClose={onClose} title="New Expense Claim" size="md"
      locked={saving}
      footer={<><DxButton onClick={onClose} disabled={saving}>Cancel</DxButton><DxButton variant="primary" onClick={save} isLoading={saving}>Create draft</DxButton></>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <DxInput label="Expense date" type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
          <DxInput label="Amount (₦)" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 12500" />
        </div>
        <DxSelect label="Category" value={category} onChange={(e) => setCategory(e.target.value)}
          options={[{ value: "", label: "— Select category —" }, ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))]} />
        <AccountSelect value={accountId} onChange={setAccountId} accounts={accounts} loading={accountsQuery.isLoading} />
        <DxTextarea label="Description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was the expense for?" />

        <div>
          <span className="dx-field-label">Receipt (optional)</span>
          {receiptFile ? (
            <div className="mt-1 flex items-center gap-3 rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] px-4 py-3">
              <FileText className="h-5 w-5 shrink-0 text-[var(--dx-accent)]" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--dx-text)]">{receiptFile.name}</span>
              <span className="text-[10px] font-semibold text-[var(--dx-text-muted)]">{(receiptFile.size / 1024).toFixed(0)} KB</span>
              <DxButton icon size="sm" variant="text" onClick={() => setReceiptFile(null)} title="Remove attachment"><X /></DxButton>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => receiptRef.current?.click()}
              className="mt-1 flex w-full items-center gap-3 rounded-md border border-dashed border-[var(--dx-border-strong)] bg-[var(--dx-surface-sunken)] px-4 py-4 text-left transition-colors hover:border-[var(--dx-accent)]"
            >
              <Paperclip className="h-5 w-5 text-[var(--dx-accent)]" />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-[var(--dx-text)]">Attach receipt</span>
                <span className="block text-[12px] text-[var(--dx-text-muted)]">PNG, JPG, WEBP, GIF or PDF · up to 10 MB · stored securely on S3</span>
              </span>
            </button>
          )}
          <input ref={receiptRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" className="hidden" onChange={onPickReceipt} />
        </div>

        <p className="text-[11px] text-[var(--dx-text-muted)]">Created as a draft. Submit it to route through the REIMBURSEMENT approval flow.</p>
      </div>
    </DxPopup>
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
  const data = [...approved, ...disbursed];

  const columns: DxGridColumn<SalaryAdvance>[] = [
    { key: "staff", header: "Staff", render: (r) => <span className="dx-mono text-[12px] text-[var(--dx-text-muted)]">SP-{r.staff_profile_id}</span> },
    { key: "amount", header: "Amount", render: (r) => <span className="dx-mono text-[13px] font-bold text-[var(--dx-text)]">₦{Number(r.amount).toLocaleString()}</span> },
    { key: "month", header: "Repayment month", render: (r) => <span className="text-[12px] text-[var(--dx-text-muted)]">{String(r.repayment_month).slice(0, 7)}</span> },
    { key: "status", header: "Status", render: (r) => <DxBadge tone={r.status === "PAID" ? "success" : "warning"}>{r.status === "PAID" ? "DISBURSED" : r.status}</DxBadge> },
    { key: "action", header: "", align: "right", render: (r) => r.status === "APPROVED" ? <DxButton size="sm" variant="primary" isLoading={disburse.isPending} onClick={() => disburse.mutate(r.id)}>Mark disbursed</DxButton> : null },
  ];

  return (
    <DxPanel title="Approved advances awaiting disbursement" icon={<Banknote className="h-4 w-4" />} description="Confirm the cash/transfer left the till. Only disbursed advances are recovered by payroll and posted to the ledger." flush>
      <DxGrid<SalaryAdvance>
        columns={columns}
        data={data}
        rowKey={(r) => r.id}
        isLoading={all.isLoading}
        empty={{ icon: Banknote, title: "Nothing to disburse", description: "No approved advances awaiting disbursement." }}
      />
    </DxPanel>
  );
}
