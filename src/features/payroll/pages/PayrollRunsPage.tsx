import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown, FileText, Gift, ListTree,
  Banknote,
  CalendarRange,
  CheckCircle2,
  Lock,
  Plus,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxKpi, DxGrid, DxBadge, DxButton, DxInput, DxSelect, DxPopup, DxMessage,
  type DxGridColumn, type DxBadgeTone,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { useDisclosure } from "@/hooks/useDisclosure";
import { useStaffNameMap } from "@/features/staff/hooks/use-staff";
import {
  useSubmitPayrollForApproval,
  useCalculatePayrollRun,
  useCreatePayrollRun,
  useLockPayrollRun,
  usePayPayrollRun,
  usePayrollLines,
  usePayrollRuns,
} from "../hooks/use-payroll";
import type { PayrollLine, PayrollRun, PayrollRunStatus } from "../api/payroll.api";
import { addOneOff, deleteOneOff, lineAdvanceRecovery, lineLoanRepayment, listLineComponents, listOneOffs, payrollExports } from "../api/payroll.api";
import type { PayrollLineComponent, PayrollComponentType } from "../api/payroll.api";
import { apiErrorMessage } from "@/lib/api/api-error";
import { accountsApi, type Account } from "@/features/billing/api/accounts.api";
import { PayrollTabs } from "../components/PayrollTabs";

// ---------- Formatting helpers ----------

const money = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fmtMoney(value: number): string {
  return money.format(value);
}

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

const statusTone: Record<PayrollRunStatus, DxBadgeTone> = {
  DRAFT: "neutral",
  CALCULATED: "info",
  APPROVED: "success",
  PAID: "success",
  LOCKED: "warning",
  CANCELLED: "danger",
};

const lineStatusTone: Record<string, DxBadgeTone> = {
  PENDING: "warning",
  APPROVED: "info",
  PAID: "success",
  ERROR: "danger",
};

type RunVerb = "calculate" | "submit" | "lock" | "pay";

/** The next processing step for a run, given its lifecycle status. */
function nextAction(run: PayrollRun): { label: string; verb: RunVerb } | null {
  switch (run.status) {
    case "DRAFT":
      return { label: "Process Payroll", verb: "calculate" };
    case "CALCULATED":
      return { label: "Submit for Approval", verb: "submit" };
    case "APPROVED":
      return { label: "Pay Run", verb: "pay" };
    case "PAID":
      return { label: "Lock Run", verb: "lock" };
    default:
      return null;
  }
}

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "CALCULATED", label: "Calculated" },
  { value: "APPROVED", label: "Approved" },
  { value: "PAID", label: "Paid" },
  { value: "LOCKED", label: "Locked" },
  { value: "CANCELLED", label: "Cancelled" },
];

// ---------- Page ----------

export function PayrollRunsPage() {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<{ run: PayrollRun; verb: RunVerb } | null>(
    null,
  );

  const newRunModal = useDisclosure();

  const runsQuery = usePayrollRuns(
    statusFilter ? { run_status: statusFilter as PayrollRunStatus } : {},
  );
  const allRunsQuery = usePayrollRuns(); // unfiltered — KPI tiles
  const { nameMap } = useStaffNameMap();

  const runs = runsQuery.data ?? [];
  const allRuns = allRunsQuery.data ?? [];

  // Latest processed (calculated or beyond) run drives the "last run" KPIs.
  const lastRun = useMemo(
    () => allRuns.find((r) => r.status !== "DRAFT" && r.status !== "CANCELLED") ?? allRuns[0],
    [allRuns],
  );
  const pendingApprovals = useMemo(
    () => allRuns.filter((r) => r.status === "CALCULATED").length,
    [allRuns],
  );

  const lastRunLinesQuery = usePayrollLines(lastRun?.id);
  const staffPaid = lastRunLinesQuery.data?.length;

  const selectedRun = useMemo(
    () =>
      allRuns.find((r) => r.id === selectedRunId) ??
      runs.find((r) => r.id === selectedRunId) ??
      null,
    [allRuns, runs, selectedRunId],
  );

  const calculateMutation = useCalculatePayrollRun();
  const submitMutation = useSubmitPayrollForApproval();
  const lockMutation = useLockPayrollRun();
  const payMutation = usePayPayrollRun();
  const actionBusy = calculateMutation.isPending || submitMutation.isPending || payMutation.isPending || lockMutation.isPending;

  const confirmCopy: Record<RunVerb, { title: string; description: string; success: string }> = {
    calculate: {
      title: "Process payroll run?",
      description:
        "Payroll lines will be calculated for every staff member in this period from their salary configuration and timesheets.",
      success: "Payroll run calculated",
    },
    submit: {
      title: "Submit payroll run for approval?",
      description:
        "This raises an approval request that routes through the configured PAYROLL_RUN approval flow. Approvers action it under Approvals; once fully approved the run becomes payable.",
      success: "Payroll run submitted for approval",
    },
    pay: {
      title: "Pay payroll run?",
      description:
        "This releases the approved net pay, settles outstanding staff loans from the withheld repayments, and marks overtime paid.",
      success: "Payroll run marked paid",
    },
    lock: {
      title: "Lock payroll run?",
      description:
        "Locking finalizes this run and its timesheets. No further changes will be possible.",
      success: "Payroll run locked",
    },
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    const { run, verb } = pendingAction;
    const mutation =
      verb === "calculate"
        ? calculateMutation
        : verb === "submit"
          ? submitMutation
          : verb === "pay"
            ? payMutation
            : lockMutation;
    try {
      await mutation.mutateAsync(run.id);
      toast.success(
        confirmCopy[verb].success,
        `Run ${run.code} — ${fmtDate(run.period_start)} to ${fmtDate(run.period_end)}`,
      );
    } catch (err) {
      toast.error(
        "Payroll action failed",
        apiErrorMessage(err, "The server rejected the request. Please try again."),
      );
    } finally {
      setPendingAction(null);
    }
  };

  const columns: DxGridColumn<PayrollRun>[] = [
    {
      key: "code",
      header: "Run",
      render: (run) => (
        <div>
          <span className="dx-mono text-[13px] font-bold text-[var(--dx-text)]">{run.code}</span>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">#{run.id}</p>
        </div>
      ),
    },
    {
      key: "period",
      header: "Period",
      render: (run) => (
        <div className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-[var(--dx-text-muted)]" aria-hidden />
          <span className="text-[13px] font-medium text-[var(--dx-text)]">{fmtDate(run.period_start)} — {fmtDate(run.period_end)}</span>
        </div>
      ),
    },
    {
      key: "account",
      header: "Account",
      render: (run) =>
        run.account_code ? (
          <span className="dx-mono text-[12px] font-bold text-[var(--dx-text)]" title={run.account_name ?? undefined}>{run.account_code}</span>
        ) : (
          <span className="text-[12px] text-[var(--dx-text-faint)]">—</span>
        ),
    },
    { key: "total_gross", header: "Gross", align: "right", render: (run) => <span className="dx-mono text-[13px]">{fmtMoney(run.total_gross)}</span> },
    { key: "total_deductions", header: "Deductions", align: "right", render: (run) => <span className="dx-mono text-[13px]" style={{ color: "var(--dx-danger)" }}>-{fmtMoney(run.total_deductions)}</span> },
    { key: "total_net", header: "Net Pay", align: "right", render: (run) => <span className="dx-mono text-[13px] font-bold text-[var(--dx-text)]">{fmtMoney(run.total_net)}</span> },
    { key: "status", header: "Status", render: (run) => <DxBadge tone={statusTone[run.status] ?? "neutral"}>{run.status}</DxBadge> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (run) => {
        const action = nextAction(run);
        if (!action) return <span className="text-[12px] text-[var(--dx-text-muted)]">—</span>;
        return (
          <DxButton
            variant={action.verb === "lock" ? "default" : "primary"}
            size="sm"
            onClick={(e) => { e.stopPropagation(); setPendingAction({ run, verb: action.verb }); }}
            leftIcon={
              action.verb === "calculate" ? <Wallet className="h-3.5 w-3.5" />
                : action.verb === "submit" ? <CheckCircle2 className="h-3.5 w-3.5" />
                  : action.verb === "pay" ? <Banknote className="h-3.5 w-3.5" />
                    : <Lock className="h-3.5 w-3.5" />
            }
          >
            {action.label}
          </DxButton>
        );
      },
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "HR & Payroll" }, { label: "Payroll Runs" }]}
        title="Payroll Runs"
        subtitle="Create, calculate, approve, pay and lock payroll cycles across the organization."
        actions={<DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={newRunModal.open}>New payroll run</DxButton>}
      />
      <PayrollTabs />

      {/* KPI tiles */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DxKpi label="Last Run Net Total" value={lastRun ? fmtMoney(lastRun.total_net) : "—"} icon={Banknote} tone="accent" isLoading={allRunsQuery.isLoading} />
        <DxKpi label="Staff Paid (Last Run)" value={staffPaid ?? "—"} icon={Users} tone="info" isLoading={allRunsQuery.isLoading || lastRunLinesQuery.isLoading} />
        <DxKpi label="Pending Approvals" value={pendingApprovals} icon={ShieldCheck} tone="warning" isLoading={allRunsQuery.isLoading} />
        <DxKpi label="Total Payroll Runs" value={allRuns.length} icon={CalendarRange} tone="neutral" isLoading={allRunsQuery.isLoading} />
      </div>

      {/* Runs table */}
      <DxPanel
        title="Payroll History"
        icon={<Banknote className="h-4 w-4" />}
        flush
        actions={
          <div className="w-44">
            <DxSelect aria-label="Filter by status" options={STATUS_OPTIONS} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} editorSize="sm" />
          </div>
        }
      >
        <DxGrid
          columns={columns}
          data={runs}
          rowKey={(run) => run.id}
          isLoading={runsQuery.isLoading}
          error={runsQuery.isError ? "Could not load payroll runs." : null}
          onRetry={() => runsQuery.refetch()}
          onRowClick={(run) => setSelectedRunId(run.id)}
          empty={{
            icon: Wallet,
            title: "No payroll runs yet",
            description: "Create a payroll run to begin processing staff salaries for a period.",
            action: <DxButton size="sm" variant="primary" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={newRunModal.open}>New payroll run</DxButton>,
          }}
        />
      </DxPanel>

      {/* Run detail modal */}
      <RunDetailModal
        run={selectedRun}
        onClose={() => setSelectedRunId(null)}
        nameMap={nameMap}
        onAction={(run, verb) => setPendingAction({ run, verb })}
      />

      {/* New run modal */}
      <NewRunModal
        isOpen={newRunModal.isOpen}
        onClose={newRunModal.close}
        existingCodes={new Set(runs.map((r) => r.code.toUpperCase()))}
      />

      {/* Process / approve / lock confirmation */}
      <DxPopup
        isOpen={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        title={pendingAction ? confirmCopy[pendingAction.verb].title : ""}
        size="sm"
        locked={actionBusy}
        footer={
          <>
            <DxButton onClick={() => setPendingAction(null)} disabled={actionBusy}>Cancel</DxButton>
            <DxButton
              variant={pendingAction?.verb === "lock" ? "danger" : "primary"}
              isLoading={actionBusy}
              onClick={handleConfirmAction}
            >
              {pendingAction ? nextAction(pendingAction.run)?.label ?? "Confirm" : "Confirm"}
            </DxButton>
          </>
        }
      >
        {pendingAction ? <p className="text-[13px] text-[var(--dx-text-muted)]">{confirmCopy[pendingAction.verb].description}</p> : null}
      </DxPopup>
    </DxPage>
  );
}

// ---------- Run detail modal ----------

function RunDetailModal({
  run,
  onClose,
  nameMap,
  onAction,
}: {
  run: PayrollRun | null;
  onClose: () => void;
  nameMap: Map<number, string>;
  onAction: (run: PayrollRun, verb: RunVerb) => void;
}) {
  const linesQuery = usePayrollLines(run?.id);
  const lines = linesQuery.data ?? [];
  const advanceTotal = lines.reduce((sum, l) => sum + lineAdvanceRecovery(l), 0);
  const [breakdownLine, setBreakdownLine] = useState<PayrollLine | null>(null);

  const lineColumns: DxGridColumn<PayrollLine>[] = [
    {
      key: "staff",
      header: "Staff Member",
      render: (line) => (
        <div>
          <p className="text-[13px] font-semibold text-[var(--dx-text)]">{nameMap.get(line.staff_profile_id) ?? `Staff #${line.staff_profile_id}`}</p>
          <p className="dx-mono text-[10px] text-[var(--dx-text-muted)]">SP-{line.staff_profile_id}</p>
        </div>
      ),
    },
    { key: "base_salary", header: "Base", align: "right", render: (line) => <span className="dx-mono text-[13px]">{fmtMoney(line.base_salary)}</span> },
    {
      key: "total_allowances", header: "Allowances + OT", align: "right",
      render: (line) => <span className="dx-mono text-[13px]">{fmtMoney(line.total_allowances + line.overtime_amount + line.bonus_amount)}</span>,
    },
    { key: "gross_pay", header: "Gross", align: "right", render: (line) => <span className="dx-mono text-[13px]">{fmtMoney(line.gross_pay)}</span> },
    {
      key: "total_deductions", header: "Deductions", align: "right",
      render: (line) => {
        const advance = lineAdvanceRecovery(line);
        const loan = lineLoanRepayment(line);
        const parts = [
          `PAYE ${fmtMoney(line.paye_amount)}`,
          `Pension ${fmtMoney(line.pension_amount)}`,
          `NHF ${fmtMoney(line.nhf_amount)}`,
          loan > 0 ? `Loan ${fmtMoney(loan)}` : null,
          advance > 0 ? `Salary advance ${fmtMoney(advance)}` : null,
          line.other_deductions > 0 ? `Other ${fmtMoney(line.other_deductions)}` : null,
        ].filter(Boolean);
        return (
          <div title={parts.join(" · ")}>
            <span className="dx-mono text-[13px]" style={{ color: "var(--dx-danger)" }}>-{fmtMoney(line.total_deductions)}</span>
            {advance > 0 ? <p className="dx-mono text-[10px] font-semibold" style={{ color: "var(--dx-warning)" }}>incl. salary advance -{fmtMoney(advance)}</p> : null}
          </div>
        );
      },
    },
    { key: "net_pay", header: "Net Pay", align: "right", render: (line) => <span className="dx-mono text-[13px] font-bold text-[var(--dx-text)]">{fmtMoney(line.net_pay)}</span> },
    {
      key: "payslip", header: "", align: "right",
      render: (line) => (
        <div className="flex items-center justify-end gap-1">
          <DxButton icon size="sm" variant="text" title="View component breakdown" onClick={() => setBreakdownLine(line)}><ListTree /></DxButton>
          <DxButton icon size="sm" variant="text" title="Download payslip PDF" onClick={() => payrollExports.payslip(line.id)}><FileText /></DxButton>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (line) => <DxBadge tone={lineStatusTone[line.status] ?? "neutral"}>{line.status}</DxBadge> },
  ];

  const action = run ? nextAction(run) : null;

  return (
    <DxPopup
      isOpen={run !== null}
      onClose={onClose}
      title={run ? `Payroll Run ${run.code}` : "Payroll Run"}
      size="xl"
      footer={
        run && action ? (
          <>
            {run.status === "CALCULATED" ? <DxButton size="sm" onClick={() => onAction(run, "calculate")}>Recalculate</DxButton> : null}
            <DxButton
              size="sm"
              variant={action.verb === "lock" ? "danger" : "primary"}
              onClick={() => onAction(run, action.verb)}
              leftIcon={action.verb === "lock" ? <Lock className="h-3.5 w-3.5" /> : action.verb === "pay" ? <Banknote className="h-3.5 w-3.5" /> : <Wallet className="h-3.5 w-3.5" />}
            >
              {action.label}
            </DxButton>
          </>
        ) : undefined
      }
    >
      {run ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryStat label="Period" value={`${fmtDate(run.period_start)} — ${fmtDate(run.period_end)}`} />
            <SummaryStat label="Gross" value={fmtMoney(run.total_gross)} mono />
            <SummaryStat label="Deductions" value={`-${fmtMoney(run.total_deductions)}`} mono />
            <SummaryStat label="Net" value={fmtMoney(run.total_net)} mono />
            {advanceTotal > 0 ? <SummaryStat label="Salary advances recovered" value={`-${fmtMoney(advanceTotal)}`} mono /> : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <DxBadge tone={statusTone[run.status] ?? "neutral"}>{run.status}</DxBadge>
            {run.account_code ? (
              <span className="text-[12px] font-medium text-[var(--dx-text-muted)]">
                Posting account <span className="dx-mono font-bold text-[var(--dx-text)]">{run.account_code}</span>{run.account_name ? ` — ${run.account_name}` : ""}
              </span>
            ) : null}
            {run.calculated_at ? <span className="text-[12px] font-medium text-[var(--dx-text-muted)]">Calculated {fmtDate(run.calculated_at)}</span> : null}
            {run.approved_at ? <span className="text-[12px] font-medium text-[var(--dx-text-muted)]">Approved {fmtDate(run.approved_at)}</span> : null}
          </div>
          {(run.status === "APPROVED" || run.status === "PAID" || run.status === "LOCKED") ? (
            <div className="flex flex-wrap gap-2">
              <DxButton size="sm" leftIcon={<FileDown className="h-3.5 w-3.5" />} onClick={() => payrollExports.bankSchedule(run.id, run.code)}>Bank schedule</DxButton>
              <DxButton size="sm" leftIcon={<FileDown className="h-3.5 w-3.5" />} onClick={() => payrollExports.paye(run.id, run.code)}>PAYE schedule</DxButton>
              <DxButton size="sm" leftIcon={<FileDown className="h-3.5 w-3.5" />} onClick={() => payrollExports.pension(run.id, run.code)}>Pension schedule</DxButton>
              <DxButton size="sm" leftIcon={<FileDown className="h-3.5 w-3.5" />} onClick={() => payrollExports.nhf(run.id, run.code)}>NHF schedule</DxButton>
              <DxButton size="sm" leftIcon={<FileDown className="h-3.5 w-3.5" />} onClick={() => payrollExports.nsitf(run.id, run.code)}>NSITF schedule</DxButton>
            </div>
          ) : null}

          {(run.status === "DRAFT" || run.status === "CALCULATED") ? <OneOffsPanel run={run} nameMap={nameMap} /> : null}

          <div className="overflow-hidden rounded-md border border-[var(--dx-border)]">
            <DxGrid
              columns={lineColumns}
              data={lines}
              rowKey={(line) => line.id}
              isLoading={linesQuery.isLoading}
              error={linesQuery.isError ? "Could not load payslip lines." : null}
              onRetry={() => linesQuery.refetch()}
              skeletonRows={4}
              empty={{
                icon: Users,
                title: "No payslip lines",
                description:
                  run.status === "DRAFT"
                    ? "Process this run to calculate payslip lines from staff salaries and timesheets."
                    : "No staff lines were generated for this run.",
              }}
            />
          </div>
        </div>
      ) : (
        <div className="dx-skeleton h-40 w-full" />
      )}
      <LineComponentsModal
        line={breakdownLine}
        staffName={breakdownLine ? nameMap.get(breakdownLine.staff_profile_id) ?? `Staff #${breakdownLine.staff_profile_id}` : ""}
        onClose={() => setBreakdownLine(null)}
      />
    </DxPopup>
  );
}

const COMPONENT_TYPE_META: Record<
  PayrollComponentType,
  { label: string; color: string; sign: string }
> = {
  EARNING: { label: "Earnings", color: "var(--dx-success)", sign: "+" },
  DEDUCTION: { label: "Deductions", color: "var(--dx-danger)", sign: "-" },
  STATUTORY: { label: "Statutory deductions", color: "var(--dx-danger)", sign: "-" },
  EMPLOYER_CONTRIBUTION: {
    label: "Employer contributions (not deducted)",
    color: "var(--dx-text-muted)",
    sign: "",
  },
};

function LineComponentsModal({
  line,
  staffName,
  onClose,
}: {
  line: PayrollLine | null;
  staffName: string;
  onClose: () => void;
}) {
  const componentsQuery = useQuery({
    queryKey: ["payroll", "line-components", line?.id],
    queryFn: () => listLineComponents(line!.id),
    enabled: line !== null,
  });
  const comps: PayrollLineComponent[] = componentsQuery.data ?? [];
  const groups = (
    ["EARNING", "DEDUCTION", "STATUTORY", "EMPLOYER_CONTRIBUTION"] as PayrollComponentType[]
  )
    .map((t) => ({ type: t, items: comps.filter((c) => c.component_type === t) }))
    .filter((g) => g.items.length > 0);

  return (
    <DxPopup isOpen={line !== null} onClose={onClose} title={`Payslip breakdown — ${staffName}`} size="md">
      {componentsQuery.isLoading ? (
        <div className="space-y-2">
          <div className="dx-skeleton h-6 w-full" />
          <div className="dx-skeleton h-6 w-3/4" />
          <div className="dx-skeleton h-6 w-2/3" />
        </div>
      ) : comps.length === 0 ? (
        <p className="text-[13px] text-[var(--dx-text-muted)]">
          No component breakdown recorded for this line — recalculate the run to generate it (runs calculated before the component model was added don't have one).
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => {
            const meta = COMPONENT_TYPE_META[g.type];
            const subtotal = g.items.reduce((t, c) => t + Number(c.amount || 0), 0);
            return (
              <div key={g.type} className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">{meta.label}</p>
                <div className="divide-y divide-[var(--dx-border)] rounded-md border border-[var(--dx-border)]">
                  {g.items.map((c) => (
                    <div key={c.id} className="flex items-center justify-between px-4 py-2">
                      <span className="text-[13px] text-[var(--dx-text)]">
                        {c.name}
                        {g.type === "EARNING" && !c.is_taxable ? <span className="ml-2 text-[10px] font-semibold text-[var(--dx-text-muted)]">TAX-FREE</span> : null}
                      </span>
                      <span className="dx-mono text-[13px] font-semibold" style={{ color: meta.color }}>{meta.sign}{fmtMoney(Number(c.amount || 0))}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between bg-[var(--dx-surface-sunken)] px-4 py-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--dx-text-muted)]">Subtotal</span>
                    <span className="dx-mono text-[13px] font-bold" style={{ color: meta.color }}>{meta.sign}{fmtMoney(subtotal)}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {line ? (
            <div className="flex items-center justify-between rounded-md px-4 py-3" style={{ background: "var(--dx-success-soft)" }}>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--dx-success)" }}>Net pay</span>
              <span className="dx-mono text-[16px] font-bold" style={{ color: "var(--dx-success)" }}>{fmtMoney(line.net_pay)}</span>
            </div>
          ) : null}
        </div>
      )}
    </DxPopup>
  );
}

function SummaryStat({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--dx-text-muted)]">{label}</p>
      <p className={(mono ? "dx-mono " : "") + "mt-1 text-[13px] font-bold text-[var(--dx-text)]"}>{value}</p>
    </div>
  );
}

// ---------- New run modal ----------

function defaultRunCode(existingCodes: Set<string> = new Set()): string {
  const now = new Date();
  const base = `PAY-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (!existingCodes.has(base.toUpperCase())) return base;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${base}-${n}`;
    if (!existingCodes.has(candidate.toUpperCase())) return candidate;
  }
  return `${base}-${Date.now() % 1000}`;
}

function monthBounds(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: iso(start), end: iso(end) };
}

function NewRunModal({
  isOpen,
  onClose,
  existingCodes,
}: {
  isOpen: boolean;
  onClose: () => void;
  existingCodes: Set<string>;
}) {
  const toast = useToast();
  const bounds = monthBounds();
  const [code, setCode] = useState(() => defaultRunCode(existingCodes));
  const [periodStart, setPeriodStart] = useState(bounds.start);
  const [periodEnd, setPeriodEnd] = useState(bounds.end);
  const [accountId, setAccountId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const createMutation = useCreatePayrollRun();
  useEffect(() => {
    if (isOpen) {
      setCode(defaultRunCode(existingCodes));
      setFormError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the modal opens
  }, [isOpen]);
  const accountsQuery = useQuery({
    queryKey: ["accounts", "active"],
    queryFn: () => accountsApi.list(),
    enabled: isOpen,
  });
  const accounts: Account[] = accountsQuery.data ?? [];

  const handleSubmit = async () => {
    if (!code.trim()) {
      setFormError("A run code is required.");
      return;
    }
    if (existingCodes.has(code.trim().toUpperCase())) {
      setFormError(
        `A payroll run with code '${code.trim()}' already exists. ` +
          `Use a different code — e.g. '${code.trim()}-2' for a supplementary run.`,
      );
      return;
    }
    if (!periodStart || !periodEnd || periodEnd < periodStart) {
      setFormError("Provide a valid period — the end date must not precede the start date.");
      return;
    }
    if (!accountId) {
      setFormError("Select the posting account for this run.");
      return;
    }
    setFormError(null);
    try {
      await createMutation.mutateAsync({
        code: code.trim(),
        period_start: periodStart,
        period_end: periodEnd,
        account_id: Number(accountId),
      });
      toast.success("Payroll run created", `${code.trim()} is now in DRAFT and ready to process.`);
      onClose();
    } catch (err) {
      const message = apiErrorMessage(err, "Check that the run code is unique and try again.");
      setFormError(message);
      toast.error("Could not create payroll run", message);
    }
  };

  return (
    <DxPopup
      isOpen={isOpen}
      onClose={onClose}
      title="New Payroll Run"
      size="md"
      locked={createMutation.isPending}
      footer={
        <>
          <DxButton onClick={onClose} disabled={createMutation.isPending}>Cancel</DxButton>
          <DxButton variant="primary" onClick={handleSubmit} isLoading={createMutation.isPending}>Create draft run</DxButton>
        </>
      }
    >
      <div className="space-y-5">
        <DxInput
          label="Run Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="PAY-2026-07"
          error={formError && !code.trim() ? formError : undefined}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <DxInput label="Period Start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          <DxInput label="Period End" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </div>
        <div>
          <DxSelect
            label="Posting account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            disabled={accountsQuery.isLoading}
            options={[
              { value: "", label: accountsQuery.isLoading ? "Loading accounts…" : "— Select posting account —" },
              ...accounts.map((a) => ({ value: String(a.id), label: `${a.code} — ${a.name}` })),
            ]}
          />
          {!accountsQuery.isLoading && accounts.length === 0 ? (
            <p className="mt-1 text-[11px] font-semibold" style={{ color: "var(--dx-warning)" }}>No accounts found. Add them under Billing → Chart of Accounts first.</p>
          ) : (
            <p className="mt-1 text-[11px] text-[var(--dx-text-muted)]">The chart-of-accounts code this payroll run will be posted to.</p>
          )}
        </div>
        {formError && code.trim() ? <p className="text-[12px] font-semibold" style={{ color: "var(--dx-danger)" }}>{formError}</p> : null}
        <p className="text-[12px] font-medium leading-relaxed text-[var(--dx-text-muted)]">
          The run is created in DRAFT. Use "Process Payroll" to calculate payslip lines, then approve and lock the run once payments are made.
        </p>
      </div>
    </DxPopup>
  );
}


function OneOffsPanel({ run, nameMap }: { run: PayrollRun; nameMap: Map<number, string> }) {
  const qc = useQueryClient();
  const oneOffs = useQuery({
    queryKey: ["payroll-one-offs", run.id],
    queryFn: () => listOneOffs(run.id),
  });
  const [staffId, setStaffId] = useState("");
  const [kind, setKind] = useState("BONUS");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const staffOptions = useMemo(() => Array.from(nameMap.entries()), [nameMap]);

  const add = useMutation({
    mutationFn: () => addOneOff(run.id, {
      staff_profile_id: Number(staffId), kind, amount: Number(amount), note: note || undefined,
    }),
    onSuccess: () => {
      setAmount(""); setNote("");
      qc.invalidateQueries({ queryKey: ["payroll-one-offs", run.id] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteOneOff(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-one-offs", run.id] }),
  });

  return (
    <div className="space-y-3 rounded-md border border-[var(--dx-border)] p-4">
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">
        <Gift className="h-3.5 w-3.5" /> One-off earnings &amp; deductions
        <span className="font-medium normal-case tracking-normal">— bonus, arrears, 13th month; recalculate after changes</span>
      </p>
      <div className="grid gap-2 sm:grid-cols-5">
        <select className="dx-editor dx-editor-sm" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
          <option value="">Staff…</option>
          {staffOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select className="dx-editor dx-editor-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="BONUS">Bonus</option>
          <option value="ARREARS">Arrears</option>
          <option value="THIRTEENTH_MONTH">13th month</option>
          <option value="OTHER_EARNING">Other earning</option>
          <option value="OTHER_DEDUCTION">Other deduction</option>
        </select>
        <input className="dx-editor dx-editor-sm" type="number" min={0.01} step="0.01" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input className="dx-editor dx-editor-sm" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <DxButton size="sm" variant="primary" disabled={!staffId || !amount || add.isPending} onClick={() => add.mutate()}>Add</DxButton>
      </div>
      {(oneOffs.data ?? []).length > 0 ? (
        <div className="divide-y divide-[var(--dx-border)]">
          {(oneOffs.data ?? []).map((oo) => (
            <div key={oo.id} className="flex items-center justify-between py-2 text-[13px]">
              <span className="text-[var(--dx-text)]">
                <span className="font-bold">{nameMap.get(oo.staff_profile_id) ?? oo.staff_no}</span>
                {" · "}{oo.kind.replace(/_/g, " ")}{oo.note ? ` — ${oo.note}` : ""}
              </span>
              <span className="flex items-center gap-3">
                <span className="dx-mono font-bold text-[var(--dx-text)]">{fmtMoney(Number(oo.amount))}</span>
                <button type="button" className="text-[12px] font-bold" style={{ color: "var(--dx-danger)" }} onClick={() => remove.mutate(oo.id)}>Remove</button>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
