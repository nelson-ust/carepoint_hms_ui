import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, Lock, LockOpen, Scale, TrendingUp, Clock3 } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxBadge, DxButton, DxInput, DxTabs,
  DxGrid, type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { accountingApi, financeApi, type StatementLine, type AccountingPeriod } from "../api/accounting.api";
import { AgingView } from "./PayablesPage";

const NGN = (v: string | number) => `₦${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

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
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Accounting" }, { label: "Reports" }]}
        title="Financial Reports"
        subtitle="Trial balance, profit & loss, balance sheet and accounting periods — built from posted journal entries."
      />

      <DxTabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { key: "trial", label: "Trial Balance", icon: <Scale className="h-4 w-4" /> },
          { key: "pnl", label: "Profit & Loss", icon: <TrendingUp className="h-4 w-4" /> },
          { key: "balance", label: "Balance Sheet", icon: <Landmark className="h-4 w-4" /> },
          { key: "araging", label: "AR Ageing", icon: <Clock3 className="h-4 w-4" /> },
          { key: "periods", label: "Periods", icon: <Lock className="h-4 w-4" /> },
        ]}
      />

      {tab !== "periods" && tab !== "araging" && (
        <DxPanel>
          <div className="grid max-w-2xl gap-4 sm:grid-cols-3">
            {tab === "balance" ? (
              <DxInput label="As of" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            ) : (
              <>
                <DxInput label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <DxInput label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </>
            )}
          </div>
        </DxPanel>
      )}

      {tab === "trial" && <TrialBalanceView dateFrom={dateFrom} dateTo={dateTo} />}
      {tab === "pnl" && <PnLView dateFrom={dateFrom} dateTo={dateTo} />}
      {tab === "balance" && <BalanceSheetView asOf={asOf} />}
      {tab === "araging" && <ARAgingView />}
      {tab === "periods" && <PeriodsView />}
    </DxPage>
  );
}

type TBRow = { account_id: number; code: string; name: string; type: string; debit: string | number; credit: string | number };

function TrialBalanceView({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const q = useQuery({
    queryKey: ["tb", dateFrom, dateTo],
    queryFn: () => accountingApi.trialBalance({ date_from: dateFrom || undefined, date_to: dateTo || undefined }),
  });
  const d = q.data;
  const columns: DxGridColumn<TBRow>[] = [
    { key: "code", header: "Code", render: (r) => <span className="dx-mono font-semibold">{r.code}</span> },
    { key: "name", header: "Account" },
    { key: "type", header: "Type", render: (r) => <DxBadge tone="neutral">{r.type}</DxBadge> },
    { key: "debit", header: "Debit", align: "right", render: (r) => <span className="dx-mono">{Number(r.debit) ? NGN(r.debit) : ""}</span> },
    { key: "credit", header: "Credit", align: "right", render: (r) => <span className="dx-mono">{Number(r.credit) ? NGN(r.credit) : ""}</span> },
  ];
  return (
    <DxPanel flush>
      <DxGrid<TBRow>
        borderless columns={columns} data={d?.items as TBRow[] | undefined} rowKey={(r) => r.account_id} isLoading={q.isLoading}
        empty={{ title: "No posted activity", description: "No posted activity in this range." }}
        summary={d ? {
          code: <span className="flex items-center gap-2">Totals {d.balanced ? <DxBadge tone="success">BALANCED</DxBadge> : <DxBadge tone="danger">OUT OF BALANCE</DxBadge>}</span>,
          debit: <span className="dx-mono">{NGN(d.total_debit)}</span>,
          credit: <span className="dx-mono">{NGN(d.total_credit)}</span>,
        } : undefined}
      />
    </DxPanel>
  );
}

function StatementTable({ title, rows, total, totalLabel }: {
  title: string; rows: StatementLine[]; total: string; totalLabel: string;
}) {
  return (
    <DxPanel title={title} flush>
      <div className="divide-y divide-[var(--dx-border)]">
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-[var(--dx-text-muted)]">No activity.</p>
        ) : rows.map((r, i) => (
          <div key={i} className="flex justify-between px-4 py-2.5 text-[13px]">
            <span><span className="dx-mono font-semibold">{r.code}</span> {r.name}</span>
            <span className="dx-mono">{NGN(r.amount)}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between border-t border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] px-4 py-3 text-[13px] font-semibold">
        <span>{totalLabel}</span><span className="dx-mono">{NGN(total)}</span>
      </div>
    </DxPanel>
  );
}

function PnLView({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const q = useQuery({
    queryKey: ["pnl", dateFrom, dateTo],
    queryFn: () => accountingApi.profitAndLoss({ date_from: dateFrom, date_to: dateTo }),
    enabled: !!dateFrom && !!dateTo,
  });
  if (q.isLoading) return <div className="dx-skeleton h-48 w-full rounded-lg" />;
  const d = q.data;
  if (!d) return null;
  const net = Number(d.net_income);
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <StatementTable title="Revenue" rows={d.revenue} total={d.total_revenue} totalLabel="Total revenue" />
        <StatementTable title="Expenses" rows={d.expenses} total={d.total_expenses} totalLabel="Total expenses" />
      </div>
      <DxPanel>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[var(--dx-text)]">{net >= 0 ? "Net income" : "Net loss"}</span>
          <span className={`dx-mono text-[19px] font-bold ${net >= 0 ? "text-[var(--dx-success,#10b981)]" : "text-[var(--dx-danger,#e11d48)]"}`}>{NGN(d.net_income)}</span>
        </div>
      </DxPanel>
    </div>
  );
}

function BalanceSheetView({ asOf }: { asOf: string }) {
  const q = useQuery({ queryKey: ["bs", asOf], queryFn: () => accountingApi.balanceSheet({ as_of: asOf }), enabled: !!asOf });
  if (q.isLoading) return <div className="dx-skeleton h-48 w-full rounded-lg" />;
  const d = q.data;
  if (!d) return null;
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <StatementTable title="Assets" rows={d.assets} total={d.total_assets} totalLabel="Total assets" />
        <StatementTable title="Liabilities" rows={d.liabilities} total={d.total_liabilities} totalLabel="Total liabilities" />
        <StatementTable title="Equity" rows={d.equity} total={d.total_equity} totalLabel="Total equity" />
      </div>
      <DxPanel>
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[var(--dx-text)]">Assets = Liabilities + Equity</span>
          {d.balanced ? <DxBadge tone="success">BALANCED</DxBadge> : <DxBadge tone="danger">OUT OF BALANCE</DxBadge>}
        </div>
      </DxPanel>
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
    mutationFn: ({ id, close }: { id: number; close: boolean }) => close ? accountingApi.closePeriod(id) : accountingApi.reopenPeriod(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["periods"] }); toast.success("Period updated"); },
    onError: (e: any) => toast.error("Couldn't update period", accountingApi.errMsg(e, "")),
  });
  if (q.isLoading) return <div className="dx-skeleton h-40 w-full rounded-lg" />;
  const items = q.data ?? [];
  return (
    <div className="space-y-5">
      <DxPanel>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-36"><DxInput label="Fiscal year" type="number" mono value={closeYear} onChange={(e) => setCloseYear(e.target.value)} /></div>
          <DxButton variant="default" isLoading={yearClose.isPending} onClick={() => yearClose.mutate()}>Post year-end closing entry</DxButton>
          <p className="basis-full text-[11.5px] text-[var(--dx-text-muted)]">Moves the year's revenue and expense balances into Retained Earnings. One-time per year (idempotent).</p>
        </div>
      </DxPanel>
      <DxPanel flush>
        {items.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-[var(--dx-text-muted)]">Periods are created automatically when the first entry of a month is booked.</p>
        ) : (
          <div className="divide-y divide-[var(--dx-border)]">
            {items.map((p: AccountingPeriod) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-[13px] font-semibold text-[var(--dx-text)]">{p.name} <span className="dx-mono text-[11px] text-[var(--dx-text-faint)]">({p.code})</span></p>
                  <p className="text-[11.5px] text-[var(--dx-text-muted)]">{p.start_date} → {p.end_date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <DxBadge tone={p.status === "OPEN" ? "success" : "danger"}>{p.status}</DxBadge>
                  <DxButton size="sm" variant="default" isLoading={toggle.isPending}
                    leftIcon={p.status === "OPEN" ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                    onClick={() => toggle.mutate({ id: p.id, close: p.status === "OPEN" })}>
                    {p.status === "OPEN" ? "Close" : "Reopen"}
                  </DxButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </DxPanel>
    </div>
  );
}

function ARAgingView() {
  const q = useQuery({ queryKey: ["ar-aging"], queryFn: () => financeApi.arAging() });
  if (q.isLoading) return <div className="dx-skeleton h-40 w-full rounded-lg" />;
  if (!q.data) return null;
  return <AgingView data={q.data} kind="AR" />;
}
