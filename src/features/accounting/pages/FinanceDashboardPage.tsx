import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Banknote,
  BookOpenCheck,
  CalendarClock,
  Coins,
  Landmark,
  PiggyBank,
  Receipt,
  RotateCcw,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxKpi,
  DxMessage,
  DxPage,
  DxPageHeader,
  DxPageLoading,
  DxPanel,
  DxStatusBar,
  DxStatusItem,
  apiErrorMessage,
} from "@/components/dx";
import { useChartTheme } from "@/components/charts/chart-theme";
import { routes } from "@/config/routes";
import { financeExtApi, fmtNaira, type FinanceDashboard } from "../api/finance-ext.api";

const n = (v?: string | number | null) => Number(v ?? 0);

/**
 * Finance command center — a single consolidated overview of revenue,
 * collections, receivables & payables with aging, cash positions, operating
 * surplus, a six-month trend and actionable alerts. Aggregates the existing
 * ledgers read-only; the jump-off point for the whole Financial module.
 */
export function FinanceDashboardPage() {
  const navigate = useNavigate();
  const chart = useChartTheme();

  const q = useQuery({ queryKey: ["finance", "dashboard"], queryFn: financeExtApi.financeDashboard });
  const d: FinanceDashboard | undefined = q.data;

  if (q.isLoading) return <DxPageLoading label="Building finance overview…" />;

  const k = d?.kpis;
  const axisTick = { fill: chart.tick.fill, fontSize: chart.tick.fontSize, fontWeight: chart.tick.fontWeight };

  const trend = (d?.trend ?? []).map((t) => ({
    month: t.month,
    Billed: n(t.billed),
    Collected: n(t.collected),
    Expense: n(t.expense),
  }));

  const agingData = [
    { bucket: "Current", amount: n(d?.ar_aging.current) },
    { bucket: "1–30", amount: n(d?.ar_aging.d1_30) },
    { bucket: "31–60", amount: n(d?.ar_aging.d31_60) },
    { bucket: "61–90", amount: n(d?.ar_aging.d61_90) },
    { bucket: "90+", amount: n(d?.ar_aging.d90_plus) },
  ];
  const agingColors = [chart.series[1], chart.series[0], chart.series[2], chart.series[3], chart.series[4]];

  const segData = [
    { name: "Patient self-pay", value: n(d?.ar_segments.patient_self_pay) },
    { name: "HMO fee-for-service", value: n(d?.ar_segments.hmo_fee_for_service) },
    { name: "Capitation", value: n(d?.ar_segments.capitation) },
  ].filter((s) => s.value > 0);

  const surplusYtd = n(k?.surplus_ytd);
  const alertTone = (sev: string) => (sev === "danger" ? "danger" : sev === "warning" ? "warning" : "info");

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Finance" }, { label: "Dashboard" }]}
        title="Finance Dashboard"
        subtitle="Revenue, collections, receivables, payables, cash and profitability — one command center for the finance office."
        actions={
          <>
            <DxButton onClick={() => navigate(routes.financeReportsExt)}>
              <Scale /> Reports+
            </DxButton>
            <DxButton onClick={() => navigate(routes.financialReports)}>
              <BookOpenCheck /> Statements
            </DxButton>
            <DxButton icon title="Refresh" onClick={() => q.refetch()} isLoading={q.isFetching}>
              <RotateCcw />
            </DxButton>
          </>
        }
      />

      <DxStatusBar>
        <DxStatusItem icon={<CalendarClock className="h-3.5 w-3.5" />}>As of {d?.as_of ?? "—"}</DxStatusItem>
        {d?.period ? (
          <DxStatusItem icon={<BookOpenCheck className="h-3.5 w-3.5" />}>
            Period {d.period.code} ·{" "}
            <DxBadge tone={d.period.status === "OPEN" ? "success" : "neutral"}>{d.period.status}</DxBadge>
          </DxStatusItem>
        ) : (
          <DxStatusItem icon={<AlertTriangle className="h-3.5 w-3.5" />}>No open period configured</DxStatusItem>
        )}
        <DxStatusItem icon={<Coins className="h-3.5 w-3.5" />}>Collected today {fmtNaira(k?.collected_today)}</DxStatusItem>
      </DxStatusBar>

      {q.isError ? (
        <DxPanel title="Finance Dashboard" icon={<Scale />}>
          <p className="px-3 py-6 text-center text-[13px] text-[var(--dx-danger)]">{apiErrorMessage(q.error)}</p>
        </DxPanel>
      ) : null}

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DxKpi label="Collected (YTD)" value={fmtNaira(k?.collected_ytd)} icon={Coins} tone="success" sub={`${fmtNaira(k?.collected_mtd)} this month`} />
        <DxKpi label="Billed revenue (YTD)" value={fmtNaira(k?.revenue_billed_ytd)} icon={Receipt} tone="accent" sub={`${fmtNaira(k?.revenue_billed_mtd)} this month`} />
        <DxKpi label="Collection rate" value={`${k?.collection_rate ?? 0}%`} icon={TrendingUp} tone={n(k?.collection_rate) >= 85 ? "success" : n(k?.collection_rate) >= 60 ? "warning" : "danger"} sub="collected ÷ billed, YTD" />
        <DxKpi label="Operating surplus (YTD)" value={fmtNaira(surplusYtd)} icon={surplusYtd >= 0 ? TrendingUp : TrendingDown} tone={surplusYtd >= 0 ? "success" : "danger"} sub={`${fmtNaira(k?.expense_ytd)} expenses`} />
        <DxKpi label="Cash & bank" value={fmtNaira(k?.cash_on_hand)} icon={Landmark} tone="info" sub="posted ledger balance" />
        <DxKpi label="Receivables" value={fmtNaira(k?.ar_outstanding)} icon={Wallet} tone="warning" sub={`${fmtNaira(k?.ar_overdue)} overdue`} onClick={() => navigate(routes.arDocuments)} />
        <DxKpi label="Payables" value={fmtNaira(k?.ap_outstanding)} icon={Banknote} tone={n(k?.ap_overdue) > 0 ? "danger" : "neutral"} sub={`${fmtNaira(k?.ap_overdue)} overdue`} onClick={() => navigate(routes.payables)} />
        <DxKpi label="Net working position" value={fmtNaira(k?.net_working_position)} icon={PiggyBank} tone="accent" sub="cash + AR − AP" />
      </div>

      {/* Alerts */}
      {(d?.alerts ?? []).length > 0 ? (
        <div className="mt-4 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {(d?.alerts ?? []).map((a, i) => (
            <DxMessage key={i} tone={alertTone(a.severity)} title={a.title}>
              {a.detail}
            </DxMessage>
          ))}
        </div>
      ) : null}

      {/* Trend + aging */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DxPanel title="Revenue, collections & expenses" icon={<TrendingUp />} description="Billed vs collected cash vs posted expenses, last 6 months.">
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trend} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
                  <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={72} tickFormatter={(v) => fmtNaira(v).replace(/\.00$/, "")} />
                  <Tooltip contentStyle={chart.tooltip} cursor={chart.cursor} formatter={(value) => fmtNaira(value as number)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Billed" fill={chart.series[0]} radius={[5, 5, 0, 0]} barSize={18} />
                  <Line type="monotone" dataKey="Collected" stroke={chart.series[1]} strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="Expense" stroke={chart.series[4]} strokeWidth={2} strokeDasharray="4 3" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </DxPanel>
        </div>

        <DxPanel title="AR aging" icon={<Wallet />} description={`${fmtNaira(k?.ar_outstanding)} outstanding`}>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingData} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
                <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="bucket" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={72} tickFormatter={(v) => fmtNaira(v).replace(/\.00$/, "")} />
                <Tooltip contentStyle={chart.tooltip} cursor={chart.cursor} formatter={(value) => fmtNaira(value as number)} />
                <Bar dataKey="amount" name="Outstanding" radius={[5, 5, 0, 0]}>
                  {agingData.map((_e, i) => (
                    <Cell key={i} fill={agingColors[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DxPanel>
      </div>

      {/* Segments + cash + AP */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <DxPanel title="Receivables by segment" icon={<Scale />} description="Where the money is owed from.">
          {segData.length === 0 ? (
            <p className="py-10 text-center text-[12.5px] text-[var(--dx-text-muted)]">No outstanding receivables.</p>
          ) : (
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={segData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={2}>
                    {segData.map((_e, i) => (
                      <Cell key={i} fill={chart.series[i % chart.series.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chart.tooltip} formatter={(value) => fmtNaira(value as number)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </DxPanel>

        <DxPanel title="Cash & bank positions" icon={<Landmark />} description="Posted ledger balance per account." flush>
          <div className="space-y-2.5 p-3">
            {(d?.cash_accounts ?? []).length === 0 ? (
              <p className="py-8 text-center text-[12.5px] text-[var(--dx-text-muted)]">No bank or petty-cash accounts yet.</p>
            ) : (
              (d?.cash_accounts ?? []).map((c, i) => (
                <div key={i} className="flex items-center justify-between rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface)] px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-[var(--dx-text)]">{c.name}</div>
                    <div className="truncate text-[11.5px] text-[var(--dx-text-muted)]">{c.subtitle}</div>
                  </div>
                  <div className="flex items-center gap-2 pl-3">
                    <DxBadge tone={c.type === "BANK" ? "info" : "neutral"}>{c.type === "BANK" ? "Bank" : "Petty cash"}</DxBadge>
                    <span className={`dx-mono text-[13px] font-semibold ${n(c.balance) < 0 ? "text-[var(--dx-danger)]" : "text-[var(--dx-text)]"}`}>{fmtNaira(c.balance)}</span>
                  </div>
                </div>
              ))
            )}
            <div className="flex items-center justify-between border-t border-[var(--dx-border)] px-3 pt-2.5 text-[13px]">
              <span className="font-semibold text-[var(--dx-text-muted)]">Total cash & bank</span>
              <span className="dx-mono font-bold text-[var(--dx-text)]">{fmtNaira(k?.cash_on_hand)}</span>
            </div>
          </div>
        </DxPanel>

        <DxPanel title="Payables snapshot" icon={<Banknote />} description="Supplier bills outstanding." flush>
          <div className="space-y-2.5 p-3">
            <div className="flex items-center justify-between rounded-md bg-[var(--dx-surface-sunken)] px-3 py-2.5">
              <span className="text-[12.5px] text-[var(--dx-text-muted)]">Outstanding</span>
              <span className="dx-mono text-[15px] font-bold text-[var(--dx-text)]">{fmtNaira(d?.ap.outstanding)}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[var(--dx-border)] px-3 py-2">
              <span className="text-[12.5px] text-[var(--dx-text-muted)]">Overdue</span>
              <span className={`dx-mono text-[13px] font-semibold ${n(d?.ap.overdue) > 0 ? "text-[var(--dx-danger)]" : "text-[var(--dx-text)]"}`}>{fmtNaira(d?.ap.overdue)}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[var(--dx-border)] px-3 py-2">
              <span className="text-[12.5px] text-[var(--dx-text-muted)]">Overdue bills</span>
              <span className="text-[13px] font-semibold text-[var(--dx-text)]">{d?.ap.overdue_count ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[var(--dx-border)] px-3 py-2">
              <span className="text-[12.5px] text-[var(--dx-text-muted)]">Open bills</span>
              <span className="text-[13px] font-semibold text-[var(--dx-text)]">{d?.ap.open_bills ?? 0}</span>
            </div>
            <DxButton className="w-full justify-center" onClick={() => navigate(routes.payables)}>
              <Receipt /> Manage payables
            </DxButton>
          </div>
        </DxPanel>
      </div>

      <div className="mt-4">
        <DxMessage tone="info" title="How these figures are derived">
          Billed revenue is taken from issued invoices; collections are successful payments by date received; expenses, cash
          balances and aging come from the posted general ledger. Figures reflect postings at the moment of refresh.
        </DxMessage>
      </div>
    </DxPage>
  );
}
