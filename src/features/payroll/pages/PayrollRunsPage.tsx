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
import { PageHeader } from "@/components/layout/PageHeader";
import { SuiteEyebrow } from "@/components/layout/SuiteEyebrow";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { MetricCard } from "@/components/charts/MetricCard";
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

const statusVariant: Record<PayrollRunStatus, BadgeProps["variant"]> = {
  DRAFT: "secondary",
  CALCULATED: "soft-info",
  APPROVED: "soft-success",
  PAID: "soft-success",
  LOCKED: "soft-warning",
  CANCELLED: "soft-danger",
};

const lineStatusVariant: Record<string, BadgeProps["variant"]> = {
  PENDING: "soft-warning",
  APPROVED: "soft-info",
  PAID: "soft-success",
  ERROR: "soft-danger",
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
    }
  };

  const columns: DataTableColumn<PayrollRun>[] = [
    {
      key: "code",
      header: "Run",
      render: (run) => (
        <div>
          <span className="data-mono text-sm font-bold text-secondary-900">{run.code}</span>
          <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
            #{run.id}
          </p>
        </div>
      ),
    },
    {
      key: "period",
      header: "Period",
      render: (run) => (
        <div className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-secondary-400" aria-hidden />
          <span className="text-sm font-medium text-secondary-700">
            {fmtDate(run.period_start)} — {fmtDate(run.period_end)}
          </span>
        </div>
      ),
    },
    {
      key: "account",
      header: "Account",
      render: (run) =>
        run.account_code ? (
          <span
            className="data-mono text-xs font-bold text-secondary-700"
            title={run.account_name ?? undefined}
          >
            {run.account_code}
          </span>
        ) : (
          <span className="text-xs text-secondary-300">—</span>
        ),
    },
    {
      key: "total_gross",
      header: "Gross",
      align: "right",
      render: (run) => <span className="data-mono text-sm">{fmtMoney(run.total_gross)}</span>,
    },
    {
      key: "total_deductions",
      header: "Deductions",
      align: "right",
      render: (run) => (
        <span className="data-mono text-sm text-rose-500">-{fmtMoney(run.total_deductions)}</span>
      ),
    },
    {
      key: "total_net",
      header: "Net Pay",
      align: "right",
      render: (run) => (
        <span className="data-mono text-sm font-bold text-secondary-900">
          {fmtMoney(run.total_net)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (run) => (
        <Badge variant={statusVariant[run.status] ?? "secondary"}>{run.status}</Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (run) => {
        const action = nextAction(run);
        if (!action) return <span className="text-xs text-secondary-400">—</span>;
        return (
          <Button
            variant={action.verb === "lock" ? "secondary" : "primary"}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setPendingAction({ run, verb: action.verb });
            }}
            leftIcon={
              action.verb === "calculate" ? (
                <Wallet className="h-3.5 w-3.5" />
              ) : action.verb === "submit" ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : action.verb === "pay" ? (
                <Banknote className="h-3.5 w-3.5" />
              ) : (
                <Lock className="h-3.5 w-3.5" />
              )
            }
          >
            {action.label}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      <PageHeader
        title="Payroll Runs"
        eyebrow={<SuiteEyebrow label="HR & Payroll Suite" />}
        description="Create, calculate, approve, pay and lock payroll cycles across the organization."
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={newRunModal.open}>
            New Payroll Run
          </Button>
        }
      />
      <PayrollTabs />

      {/* KPI tiles */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Last Run Net Total"
          value={lastRun ? fmtMoney(lastRun.total_net) : "—"}
          icon={Banknote}
          tone="primary"
          isLoading={allRunsQuery.isLoading}
        />
        <MetricCard
          label="Staff Paid (Last Run)"
          value={staffPaid ?? "—"}
          icon={Users}
          tone="cyan"
          isLoading={allRunsQuery.isLoading || lastRunLinesQuery.isLoading}
        />
        <MetricCard
          label="Pending Approvals"
          value={pendingApprovals}
          icon={ShieldCheck}
          tone="amber"
          isLoading={allRunsQuery.isLoading}
        />
        <MetricCard
          label="Total Payroll Runs"
          value={allRuns.length}
          icon={CalendarRange}
          tone="violet"
          isLoading={allRunsQuery.isLoading}
        />
      </div>

      {/* Runs table */}
      <Card padding="none">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <h3 className="font-display text-lg font-bold text-secondary-900">Payroll History</h3>
          <Select
            aria-label="Filter by status"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-44 py-2.5"
          />
        </div>
        <DataTable
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
            action: (
              <Button
                size="sm"
                leftIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={newRunModal.open}
              >
                New Payroll Run
              </Button>
            ),
          }}
        />
      </Card>

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
      <ConfirmDialog
        isOpen={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        onConfirm={handleConfirmAction}
        title={pendingAction ? confirmCopy[pendingAction.verb].title : ""}
        description={pendingAction ? confirmCopy[pendingAction.verb].description : undefined}
        confirmLabel={
          pendingAction ? nextAction(pendingAction.run)?.label ?? "Confirm" : "Confirm"
        }
        tone={pendingAction?.verb === "lock" ? "danger" : "primary"}
      />
    </div>
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

  const lineColumns: DataTableColumn<PayrollLine>[] = [
    {
      key: "staff",
      header: "Staff Member",
      render: (line) => (
        <div>
          <p className="text-sm font-bold text-secondary-900">
            {nameMap.get(line.staff_profile_id) ?? `Staff #${line.staff_profile_id}`}
          </p>
          <p className="data-mono text-[10px] text-secondary-400">SP-{line.staff_profile_id}</p>
        </div>
      ),
    },
    {
      key: "base_salary",
      header: "Base",
      align: "right",
      render: (line) => <span className="data-mono text-sm">{fmtMoney(line.base_salary)}</span>,
    },
    {
      key: "total_allowances",
      header: "Allowances + OT",
      align: "right",
      render: (line) => (
        <span className="data-mono text-sm">
          {fmtMoney(line.total_allowances + line.overtime_amount + line.bonus_amount)}
        </span>
      ),
    },
    {
      key: "gross_pay",
      header: "Gross",
      align: "right",
      render: (line) => <span className="data-mono text-sm">{fmtMoney(line.gross_pay)}</span>,
    },
    {
      key: "total_deductions",
      header: "Deductions",
      align: "right",
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
            <span className="data-mono text-sm text-rose-500">
              -{fmtMoney(line.total_deductions)}
            </span>
            {advance > 0 && (
              <p className="data-mono text-[10px] font-semibold text-amber-600">
                incl. salary advance -{fmtMoney(advance)}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "net_pay",
      header: "Net Pay",
      align: "right",
      render: (line) => (
        <span className="data-mono text-sm font-bold text-secondary-900">
          {fmtMoney(line.net_pay)}
        </span>
      ),
    },
    {
      key: "payslip",
      header: "",
      align: "right",
      render: (line) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            title="View component breakdown"
            onClick={() => setBreakdownLine(line)}
            className="p-2 rounded-lg text-secondary-400 hover:text-primary-600 hover:bg-primary-500/10"
          >
            <ListTree className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Download payslip PDF"
            onClick={() => payrollExports.payslip(line.id)}
            className="p-2 rounded-lg text-secondary-400 hover:text-primary-600 hover:bg-primary-500/10"
          >
            <FileText className="h-4 w-4" />
          </button>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (line) => (
        <Badge variant={lineStatusVariant[line.status] ?? "secondary"}>{line.status}</Badge>
      ),
    },
  ];

  const action = run ? nextAction(run) : null;

  return (
    <Modal
      isOpen={run !== null}
      onClose={onClose}
      title={run ? `Payroll Run ${run.code}` : "Payroll Run"}
      size="2xl"
      footer={
        run && action ? (
          <div className="flex justify-end gap-2">
            {run.status === "CALCULATED" && (
              <Button size="sm" variant="secondary" onClick={() => onAction(run, "calculate")}>
                Recalculate
              </Button>
            )}
            <Button
              size="sm"
              variant={action.verb === "lock" ? "danger" : "primary"}
              onClick={() => onAction(run, action.verb)}
              leftIcon={
                action.verb === "lock" ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : action.verb === "pay" ? (
                  <Banknote className="h-3.5 w-3.5" />
                ) : (
                  <Wallet className="h-3.5 w-3.5" />
                )
              }
            >
              {action.label}
            </Button>
          </div>
        ) : undefined
      }
    >
      {run ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryStat
              label="Period"
              value={`${fmtDate(run.period_start)} — ${fmtDate(run.period_end)}`}
            />
            <SummaryStat label="Gross" value={fmtMoney(run.total_gross)} mono />
            <SummaryStat label="Deductions" value={`-${fmtMoney(run.total_deductions)}`} mono />
            <SummaryStat label="Net" value={fmtMoney(run.total_net)} mono />
            {advanceTotal > 0 && (
              <SummaryStat
                label="Salary advances recovered"
                value={`-${fmtMoney(advanceTotal)}`}
                mono
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={statusVariant[run.status] ?? "secondary"}>{run.status}</Badge>
            {run.account_code ? (
              <span className="text-xs font-medium text-secondary-400">
                Posting account{" "}
                <span className="data-mono font-bold text-secondary-600">{run.account_code}</span>
                {run.account_name ? ` — ${run.account_name}` : ""}
              </span>
            ) : null}
            {run.calculated_at ? (
              <span className="text-xs font-medium text-secondary-400">
                Calculated {fmtDate(run.calculated_at)}
              </span>
            ) : null}
            {run.approved_at ? (
              <span className="text-xs font-medium text-secondary-400">
                Approved {fmtDate(run.approved_at)}
              </span>
            ) : null}
          </div>
          {(run.status === "APPROVED" || run.status === "PAID" || run.status === "LOCKED") && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" leftIcon={<FileDown className="h-3.5 w-3.5" />}
                onClick={() => payrollExports.bankSchedule(run.id, run.code)}>Bank schedule</Button>
              <Button size="sm" variant="secondary" leftIcon={<FileDown className="h-3.5 w-3.5" />}
                onClick={() => payrollExports.paye(run.id, run.code)}>PAYE schedule</Button>
              <Button size="sm" variant="secondary" leftIcon={<FileDown className="h-3.5 w-3.5" />}
                onClick={() => payrollExports.pension(run.id, run.code)}>Pension schedule</Button>
              <Button size="sm" variant="secondary" leftIcon={<FileDown className="h-3.5 w-3.5" />}
                onClick={() => payrollExports.nhf(run.id, run.code)}>NHF schedule</Button>
              <Button size="sm" variant="secondary" leftIcon={<FileDown className="h-3.5 w-3.5" />}
                onClick={() => payrollExports.nsitf(run.id, run.code)}>NSITF schedule</Button>
            </div>
          )}

          {(run.status === "DRAFT" || run.status === "CALCULATED") && (
            <OneOffsPanel run={run} nameMap={nameMap} />
          )}

          <div className="overflow-hidden rounded-3xl border border-secondary-100 dark:border-white/5">
            <DataTable
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
        <Skeleton className="h-40 w-full" />
      )}
      <LineComponentsModal
        line={breakdownLine}
        staffName={
          breakdownLine
            ? nameMap.get(breakdownLine.staff_profile_id) ?? `Staff #${breakdownLine.staff_profile_id}`
            : ""
        }
        onClose={() => setBreakdownLine(null)}
      />
    </Modal>
  );
}

const COMPONENT_TYPE_META: Record<
  PayrollComponentType,
  { label: string; accent: string; sign: string }
> = {
  EARNING: { label: "Earnings", accent: "text-emerald-600", sign: "+" },
  DEDUCTION: { label: "Deductions", accent: "text-rose-500", sign: "-" },
  STATUTORY: { label: "Statutory deductions", accent: "text-rose-500", sign: "-" },
  EMPLOYER_CONTRIBUTION: {
    label: "Employer contributions (not deducted)",
    accent: "text-secondary-500",
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
    <Modal
      isOpen={line !== null}
      onClose={onClose}
      title={`Payslip breakdown — ${staffName}`}
      size="md"
    >
      {componentsQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-2/3" />
        </div>
      ) : comps.length === 0 ? (
        <p className="text-sm text-secondary-400">
          No component breakdown recorded for this line — recalculate the run to
          generate it (runs calculated before the component model was added
          don't have one).
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => {
            const meta = COMPONENT_TYPE_META[g.type];
            const subtotal = g.items.reduce((t, c) => t + Number(c.amount || 0), 0);
            return (
              <div key={g.type} className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">
                  {meta.label}
                </p>
                <div className="rounded-2xl border border-secondary-100 divide-y divide-secondary-100 dark:border-white/5 dark:divide-white/5">
                  {g.items.map((c) => (
                    <div key={c.id} className="flex items-center justify-between px-4 py-2">
                      <span className="text-sm text-secondary-700 dark:text-secondary-200">
                        {c.name}
                        {g.type === "EARNING" && !c.is_taxable && (
                          <span className="ml-2 text-[10px] font-semibold text-secondary-400">
                            TAX-FREE
                          </span>
                        )}
                      </span>
                      <span className={`data-mono text-sm font-semibold ${meta.accent}`}>
                        {meta.sign}
                        {fmtMoney(Number(c.amount || 0))}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-2 bg-secondary-50/60 dark:bg-white/5">
                    <span className="text-xs font-bold uppercase tracking-wider text-secondary-500">
                      Subtotal
                    </span>
                    <span className={`data-mono text-sm font-black ${meta.accent}`}>
                      {meta.sign}
                      {fmtMoney(subtotal)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          {line && (
            <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 dark:bg-emerald-500/10">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                Net pay
              </span>
              <span className="data-mono text-base font-black text-emerald-700 dark:text-emerald-400">
                {fmtMoney(line.net_pay)}
              </span>
            </div>
          )}
        </div>
      )}
    </Modal>
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
    <div className="rounded-2xl bg-secondary-500/5 px-4 py-3 dark:bg-white/5">
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-secondary-400">
        {label}
      </p>
      <p
        className={
          mono
            ? "data-mono mt-1 text-sm font-bold text-secondary-900"
            : "mt-1 text-sm font-bold text-secondary-900"
        }
      >
        {value}
      </p>
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Payroll Run"
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} isLoading={createMutation.isPending}>
            Create Draft Run
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Input
          label="Run Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="PAY-2026-07"
          error={formError && !code.trim() ? formError : undefined}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Period Start"
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
          />
          <Input
            label="Period End"
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
          />
        </div>
        <div>
          <Select
            label="Posting account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            disabled={accountsQuery.isLoading}
            options={[
              {
                value: "",
                label: accountsQuery.isLoading
                  ? "Loading accounts…"
                  : "— Select posting account —",
              },
              ...accounts.map((a) => ({ value: String(a.id), label: `${a.code} — ${a.name}` })),
            ]}
          />
          {!accountsQuery.isLoading && accounts.length === 0 ? (
            <p className="mt-1 text-[11px] font-semibold text-amber-600">
              No accounts found. Add them under Billing → Chart of Accounts first.
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-secondary-400">
              The chart-of-accounts code this payroll run will be posted to.
            </p>
          )}
        </div>
        {formError && code.trim() ? (
          <p className="text-xs font-bold text-rose-500">{formError}</p>
        ) : null}
        <p className="text-xs font-medium leading-relaxed text-secondary-400">
          The run is created in DRAFT. Use "Process Payroll" to calculate payslip lines, then
          approve and lock the run once payments are made.
        </p>
      </div>
    </Modal>
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
    <div className="rounded-3xl border border-secondary-100 p-4 space-y-3 dark:border-white/5">
      <p className="text-xs font-black uppercase tracking-widest text-secondary-400 flex items-center gap-2">
        <Gift className="h-3.5 w-3.5" /> One-off earnings & deductions
        <span className="font-medium normal-case tracking-normal">— bonus, arrears, 13th month; recalculate after changes</span>
      </p>
      <div className="grid gap-2 sm:grid-cols-5">
        <select className="input-field text-sm" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
          <option value="">Staff…</option>
          {staffOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select className="input-field text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="BONUS">Bonus</option>
          <option value="ARREARS">Arrears</option>
          <option value="THIRTEENTH_MONTH">13th month</option>
          <option value="OTHER_EARNING">Other earning</option>
          <option value="OTHER_DEDUCTION">Other deduction</option>
        </select>
        <input className="input-field text-sm" type="number" min={0.01} step="0.01" placeholder="Amount"
          value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input className="input-field text-sm" placeholder="Note (optional)"
          value={note} onChange={(e) => setNote(e.target.value)} />
        <Button size="sm" disabled={!staffId || !amount || add.isPending}
          onClick={() => add.mutate()}>Add</Button>
      </div>
      {(oneOffs.data ?? []).length > 0 && (
        <div className="divide-y divide-secondary-100 dark:divide-white/5">
          {(oneOffs.data ?? []).map((oo) => (
            <div key={oo.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                <span className="font-bold">{nameMap.get(oo.staff_profile_id) ?? oo.staff_no}</span>
                {" · "}{oo.kind.replace(/_/g, " ")}{oo.note ? ` — ${oo.note}` : ""}
              </span>
              <span className="flex items-center gap-3">
                <span className="data-mono font-bold">{fmtMoney(Number(oo.amount))}</span>
                <button type="button" className="text-rose-500 text-xs font-bold"
                  onClick={() => remove.mutate(oo.id)}>Remove</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
