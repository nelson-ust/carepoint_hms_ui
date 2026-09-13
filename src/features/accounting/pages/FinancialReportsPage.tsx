import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, Lock, LockOpen, Scale, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { accountingApi, financeApi, type StatementLine, type AccountingPeriod } from "../api/accounting.api";
import { AgingView } from "./PayablesPage";
import { Clock3 } from "lucide-react";

const NGN = (v: string | number) =>
  `₦${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

type Tab = "trial" | "pnl" | "balance" | "araging" | "periods";

function firstOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
const today = () => new Date().toISOString().slice(0, 10);

export function FinancialReportsPage() {
  const [tab, setTab] = useState<Tab>("trial");
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(today());
  const [asOf, setAsOf] = useState(today());

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <PageHeader title="Financial Reports" description="Trial balance, profit & loss, balance sheet and accounting periods — built from posted journal entries." />

      <div className="flex flex-wrap gap-2">
        {([
          ["trial", "Trial Balance", Scale],
          ["pnl", "Profit & Loss", TrendingUp],
          ["balance", "Balance Sheet", Landmark],
          ["araging", "AR Ageing", Clock3],
          ["periods", "Periods", Lock],
        ] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${tab === key ? "bg-primary-600 text-white" : "bg-secondary-100 text-secondary-600 hover:bg-secondary-200 dark:bg-white/10 dark:text-secondary-300"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab !== "periods" && tab !== "araging" && (
        <Card className="p-5">
          <div className="grid sm:grid-cols-3 gap-4 max-w-2xl">
            {tab === "balance" ? (
              <Input label="As of" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            ) : (
              <>
                <Input label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <Input label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </>
            )}
          </div>
        </Card>
      )}

      {tab === "trial" && <TrialBalanceView dateFrom={dateFrom} dateTo={dateTo} />}
      {tab === "pnl" && <PnLView dateFrom={dateFrom} dateTo={dateTo} />}
      {tab === "balance" && <BalanceSheetView asOf={asOf} />}
      {tab === "araging" && <ARAgingView />}
      {tab === "periods" && <PeriodsView />}
    </div>
  );
}

function TrialBalanceView({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const q = useQuery({
    queryKey: ["tb", dateFrom, dateTo],
    queryFn: () => accountingApi.trialBalance({ date_from: dateFrom || undefined, date_to: dateTo || undefined }),
  });
  if (q.isLoading) return <Skeleton className="h-48 w-full" />;
  const d = q.data;
  if (!d) return null;
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="bg-secondary-50 text-secondary-500 text-[10px] uppercase tracking-widest dark:bg-white/5">
          <tr>
            <th className="text-left px-5 py-3">Code</th>
            <th className="text-left px-5 py-3">Account</th>
            <th className="text-left px-5 py-3">Type</th>
            <th className="text-right px-5 py-3">Debit</th>
            <th className="text-right px-5 py-3">Credit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-secondary-100 dark:divide-white/5">
          {d.items.length === 0 ? (
            <tr><td colSpan={5} className="px-5 py-10 text-center text-secondary-400">No posted activity in this range.</td></tr>
          ) : d.items.map((r) => (
            <tr key={r.account_id}>
              <td className="px-5 py-2.5 data-mono font-bold">{r.code}</td>
              <td className="px-5 py-2.5">{r.name}</td>
              <td className="px-5 py-2.5"><Badge variant="secondary">{r.type}</Badge></td>
              <td className="px-5 py-2.5 text-right data-mono">{Number(r.debit) ? NGN(r.debit) : ""}</td>
              <td className="px-5 py-2.5 text-right data-mono">{Number(r.credit) ? NGN(r.credit) : ""}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-secondary-50 font-black dark:bg-white/5">
          <tr>
            <td className="px-5 py-3" colSpan={3}>
              Totals {d.balanced ? <Badge variant="soft-success" className="ml-2">BALANCED</Badge> : <Badge variant="soft-danger" className="ml-2">OUT OF BALANCE</Badge>}
            </td>
            <td className="px-5 py-3 text-right data-mono">{NGN(d.total_debit)}</td>
            <td className="px-5 py-3 text-right data-mono">{NGN(d.total_credit)}</td>
          </tr>
        </tfoot>
      </table>
    </Card>
  );
}

function StatementTable({ title, rows, total, totalLabel }: {
  title: string; rows: StatementLine[]; total: string; totalLabel: string;
}) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3 bg-secondary-50 font-black text-sm dark:bg-white/5">{title}</div>
      <div className="divide-y divide-secondary-100 dark:divide-white/5">
        {rows.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-secondary-400">No activity.</p>
        ) : rows.map((r, i) => (
          <div key={i} className="flex justify-between px-5 py-2.5 text-sm">
            <span><span className="data-mono font-bold">{r.code}</span> {r.name}</span>
            <span className="data-mono">{NGN(r.amount)}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between px-5 py-3 bg-secondary-50 font-black text-sm dark:bg-white/5">
        <span>{totalLabel}</span><span className="data-mono">{NGN(total)}</span>
      </div>
    </Card>
  );
}

function PnLView({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const q = useQuery({
    queryKey: ["pnl", dateFrom, dateTo],
    queryFn: () => accountingApi.profitAndLoss({ date_from: dateFrom, date_to: dateTo }),
    enabled: !!dateFrom && !!dateTo,
  });
  if (q.isLoading) return <Skeleton className="h-48 w-full" />;
  const d = q.data;
  if (!d) return null;
  const net = Number(d.net_income);
  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <StatementTable title="Revenue" rows={d.revenue} total={d.total_revenue} totalLabel="Total revenue" />
        <StatementTable title="Expenses" rows={d.expenses} total={d.total_expenses} totalLabel="Total expenses" />
      </div>
      <Card className={`p-6 flex items-center justify-between ${net >= 0 ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-rose-50 dark:bg-rose-500/10"}`}>
        <span className="font-black">{net >= 0 ? "Net income" : "Net loss"}</span>
        <span className={`data-mono text-xl font-black ${net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{NGN(d.net_income)}</span>
      </Card>
    </div>
  );
}

function BalanceSheetView({ asOf }: { asOf: string }) {
  const q = useQuery({
    queryKey: ["bs", asOf],
    queryFn: () => accountingApi.balanceSheet({ as_of: asOf }),
    enabled: !!asOf,
  });
  if (q.isLoading) return <Skeleton className="h-48 w-full" />;
  const d = q.data;
  if (!d) return null;
  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-3 gap-6">
        <StatementTable title="Assets" rows={d.assets} total={d.total_assets} totalLabel="Total assets" />
        <StatementTable title="Liabilities" rows={d.liabilities} total={d.total_liabilities} totalLabel="Total liabilities" />
        <StatementTable title="Equity" rows={d.equity} total={d.total_equity} totalLabel="Total equity" />
      </div>
      <Card className="p-5 flex items-center justify-between">
        <span className="text-sm font-bold">Assets = Liabilities + Equity</span>
        {d.balanced
          ? <Badge variant="soft-success">BALANCED</Badge>
          : <Badge variant="soft-danger">OUT OF BALANCE</Badge>}
      </Card>
    </div>
  );
}

function PeriodsView() {
  const toast = useToast();
  const qc = useQueryClient();
  const [closeYear, setCloseYear] = useState(String(new Date().getFullYear() - 1));
  const q = useQuery({ queryKey: ["periods"], queryFn: () => accountingApi.listPeriods() });
  const yearClose = useMutation({
    mutationFn: () => financeApi.closeYear(Number(closeYear)),
    onSuccess: (r) => toast.success(`Fiscal year ${r.year} closed`, `Net income ${r.net_income} moved to retained earnings.`),
    onError: (e: any) => toast.error("Couldn't close year", accountingApi.errMsg(e, "")),
  });
  const toggle = useMutation({
    mutationFn: ({ id, close }: { id: number; close: boolean }) =>
      close ? accountingApi.closePeriod(id) : accountingApi.reopenPeriod(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["periods"] }); toast.success("Period updated"); },
    onError: (e: any) => toast.error("Couldn't update period", accountingApi.errMsg(e, "")),
  });
  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  const items = q.data ?? [];
  return (
    <div className="space-y-6">
    <Card className="p-5 flex flex-wrap items-end gap-3">
      <div className="w-36">
        <Input label="Fiscal year" type="number" value={closeYear} onChange={(e) => setCloseYear(e.target.value)} />
      </div>
      <Button variant="secondary" isLoading={yearClose.isPending} onClick={() => yearClose.mutate()}>
        Post year-end closing entry
      </Button>
      <p className="text-xs text-secondary-400 basis-full">Moves the year's revenue and expense balances into Retained Earnings. One-time per year (idempotent).</p>
    </Card>
    <Card className="p-0 overflow-hidden">
      {items.length === 0 ? (
        <p className="p-10 text-center text-sm text-secondary-400">Periods are created automatically when the first entry of a month is booked.</p>
      ) : (
        <div className="divide-y divide-secondary-100 dark:divide-white/5">
          {items.map((p: AccountingPeriod) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="font-bold text-sm">{p.name} <span className="data-mono text-xs text-secondary-400">({p.code})</span></p>
                <p className="text-xs text-secondary-400">{p.start_date} → {p.end_date}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={p.status === "OPEN" ? "soft-success" : "soft-danger"}>{p.status}</Badge>
                <Button size="sm" variant="secondary" isLoading={toggle.isPending}
                  leftIcon={p.status === "OPEN" ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                  onClick={() => toggle.mutate({ id: p.id, close: p.status === "OPEN" })}>
                  {p.status === "OPEN" ? "Close" : "Reopen"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
    </div>
  );
}


function ARAgingView() {
  const q = useQuery({ queryKey: ["ar-aging"], queryFn: () => financeApi.arAging() });
  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  if (!q.data) return null;
  return <AgingView data={q.data} kind="AR" />;
}
