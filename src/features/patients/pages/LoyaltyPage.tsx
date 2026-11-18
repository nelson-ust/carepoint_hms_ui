import { useParams, Link } from "react-router-dom";
import { format } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Award,
  Gift,
  Plus,
  RotateCcw,
  Sparkles,
  Star,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxGrid,
  DxKpi,
  DxLiveDot,
  DxPage,
  DxPageHeader,
  DxPanel,
  DxStatusBar,
  DxStatusItem,
  type DxGridColumn,
} from "@/components/dx";
import { useChartTheme } from "@/components/charts/chart-theme";
import { routes } from "@/config/routes";
import { usePatientPoints, useLoyaltyHistory } from "../hooks/use-loyalty";
import { useDisclosure } from "@/hooks/useDisclosure";
import { tierForBalance } from "../loyalty-tiers";
import { PointsActionModal } from "../components/PointsActionModal";
import { TierBenefitsModal } from "../components/TierBenefitsModal";
import type { LoyaltyTransaction } from "../api/loyalty.api";

type LoyaltyChartPoint = { month: string; points: number };

/** Cumulative points balance sampled at the end of each of the last 6 months. */
function buildAccumulationSeries(
  history: { points: number; transaction_type: "EARN" | "REDEEM"; created_at: string }[],
): LoyaltyChartPoint[] {
  const now = new Date();
  const months: { label: string; end: Date }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    months.push({
      label: new Date(now.getFullYear(), now.getMonth() - i, 1).toLocaleString("default", { month: "short" }),
      end: d,
    });
  }
  const sorted = [...history].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  return months.map(({ label, end }) => {
    const points = sorted
      .filter((tx) => new Date(tx.created_at) < end)
      .reduce((sum, tx) => sum + (tx.transaction_type === "EARN" ? tx.points : -tx.points), 0);
    return { month: label, points: Math.max(points, 0) };
  });
}

export function LoyaltyPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const id = Number(patientId) || 0;
  const chart = useChartTheme();
  const axisTick = { fill: chart.tick.fill, fontSize: chart.tick.fontSize, fontWeight: chart.tick.fontWeight };

  const { data: pointsData, isLoading: pointsLoading } = usePatientPoints(id);
  const { data: historyData, isLoading: historyLoading, isFetching: historyFetching, refetch } = useLoyaltyHistory(id);

  const history = historyData?.items ?? [];
  const loyaltyData = buildAccumulationSeries(history);
  const balance = pointsData?.total_points ?? 0;
  const { tier, next } = tierForBalance(balance);

  const lifetimeEarned = history.filter((t) => t.transaction_type === "EARN").reduce((s, t) => s + t.points, 0);
  const lifetimeRedeemed = history.filter((t) => t.transaction_type === "REDEEM").reduce((s, t) => s + t.points, 0);
  const progressPct = next
    ? Math.min(100, Math.round(((balance - tier.min) / (next.min - tier.min)) * 100))
    : 100;

  const award = useDisclosure();
  const redeem = useDisclosure();
  const tiers = useDisclosure();

  const columns: DxGridColumn<LoyaltyTransaction>[] = [
    {
      key: "reason",
      header: "Transaction",
      render: (tx) => (
        <div className="flex items-center gap-3">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tx.transaction_type === "EARN" ? "bg-[var(--dx-success-soft)] text-[var(--dx-success)]" : "bg-[var(--dx-warning-soft)] text-[var(--dx-warning)]"}`}>
            {tx.transaction_type === "EARN" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-[var(--dx-text)]">{tx.reason}</div>
            <div className="dx-mono text-[11px] text-[var(--dx-text-muted)]">#{tx.id}</div>
          </div>
        </div>
      ),
    },
    { key: "created_at", header: "Date", accessor: (tx) => tx.created_at, render: (tx) => <span className="text-[13px] text-[var(--dx-text-muted)]">{format(new Date(tx.created_at), "MMM d, yyyy")}</span> },
    {
      key: "points",
      header: "Points",
      align: "right",
      accessor: (tx) => (tx.transaction_type === "EARN" ? tx.points : -tx.points),
      render: (tx) => (
        <span className={`dx-mono text-[13px] font-bold ${tx.transaction_type === "EARN" ? "text-[var(--dx-success)]" : "text-[var(--dx-warning)]"}`}>
          {tx.transaction_type === "EARN" ? "+" : "−"}{tx.points.toLocaleString()}
        </span>
      ),
    },
    {
      key: "transaction_type",
      header: "Type",
      align: "center",
      filter: { options: [{ value: "EARN", label: "Earned" }, { value: "REDEEM", label: "Redeemed" }] },
      render: (tx) => <DxBadge tone={tx.transaction_type === "EARN" ? "success" : "warning"}>{tx.transaction_type === "EARN" ? "Earned" : "Redeemed"}</DxBadge>,
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Patients", to: routes.patients }, { label: `Patient #${id}` }, { label: "Loyalty" }]}
        title="Patient Loyalty"
        subtitle="Reward points, membership tier and redemption history for this patient."
        actions={
          <>
            <DxButton onClick={tiers.open}>
              <Star /> Tier benefits
            </DxButton>
            <DxButton onClick={award.open}>
              <Plus /> Award points
            </DxButton>
            <DxButton variant="primary" disabled={balance <= 0} onClick={redeem.open}>
              <Gift /> Redeem points
            </DxButton>
            <DxButton icon title="Refresh" onClick={() => refetch()} isLoading={historyFetching}>
              <RotateCcw />
            </DxButton>
          </>
        }
      />

      <DxStatusBar>
        <DxStatusItem icon={<Award className="h-3.5 w-3.5" />}>
          Tier <DxBadge tone="accent">{pointsLoading ? "…" : tier.name}</DxBadge>
        </DxStatusItem>
        <DxStatusItem icon={<Wallet className="h-3.5 w-3.5" />}>Balance {balance.toLocaleString()} pts</DxStatusItem>
        <DxStatusItem><DxLiveDot label="Live" /></DxStatusItem>
      </DxStatusBar>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DxKpi label="Available balance" value={pointsLoading ? "…" : balance.toLocaleString()} icon={Sparkles} tone="accent" sub="loyalty points" />
        <DxKpi label="Current tier" value={pointsLoading ? "…" : tier.name} icon={Star} tone="info" sub={next ? `${Math.max(next.min - balance, 0).toLocaleString()} pts to ${next.name}` : "Top tier reached"} onClick={tiers.open} />
        <DxKpi label="Lifetime earned" value={lifetimeEarned.toLocaleString()} icon={TrendingUp} tone="success" sub={`${history.filter((t) => t.transaction_type === "EARN").length} transactions`} />
        <DxKpi label="Lifetime redeemed" value={lifetimeRedeemed.toLocaleString()} icon={Gift} tone="warning" sub={`${history.filter((t) => t.transaction_type === "REDEEM").length} transactions`} />
      </div>

      {/* Tier progress + accumulation chart */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <DxPanel title="Tier progress" icon={<Award />} description={next ? `On the way to ${next.name}.` : "Highest tier reached."}>
          <div className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[var(--dx-text-muted)]">Current tier</div>
                <div className="text-[22px] font-bold text-[var(--dx-text)]">{tier.name}</div>
              </div>
              {next ? <DxBadge tone="neutral">Next: {next.name}</DxBadge> : <DxBadge tone="success">Top tier</DxBadge>}
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-[11.5px] text-[var(--dx-text-muted)]">
                <span>{tier.min.toLocaleString()} pts</span>
                {next ? <span>{next.min.toLocaleString()} pts</span> : <span>Max</span>}
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--dx-border)]">
                <div className="h-full rounded-full bg-[var(--dx-accent)]" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="mt-1.5 text-[11.5px] text-[var(--dx-text-muted)]">
                {next ? `${progressPct}% · ${Math.max(next.min - balance, 0).toLocaleString()} points to go` : "All tiers unlocked"}
              </div>
            </div>
            <ul className="space-y-1.5 border-t border-[var(--dx-border)] pt-3">
              {tier.perks.map((p) => (
                <li key={p} className="flex items-start gap-2 text-[12.5px] text-[var(--dx-text)]">
                  <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--dx-accent)]" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </DxPanel>

        <div className="xl:col-span-2">
          <DxPanel title="Points accumulation" icon={<TrendingUp />} description="Cumulative balance over the last 6 months.">
            {historyLoading ? (
              <div className="dx-skeleton h-[240px] w-full" />
            ) : history.length === 0 ? (
              <p className="py-20 text-center text-[12.5px] text-[var(--dx-text-muted)]">No loyalty activity recorded yet.</p>
            ) : (
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={loyaltyData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="loyaltyArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chart.areaGradient.from} />
                        <stop offset="95%" stopColor={chart.areaGradient.to} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} dy={6} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} width={44} />
                    <Tooltip contentStyle={chart.tooltip} cursor={chart.cursor} />
                    <Area type="monotone" dataKey="points" name="Balance" stroke={chart.series[0]} strokeWidth={2.5} fillOpacity={1} fill="url(#loyaltyArea)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </DxPanel>
        </div>
      </div>

      {/* Transaction history */}
      <div className="mt-4">
        <DxPanel title="Transaction history" icon={<Wallet />} description="Every points earn and redemption for this patient." flush>
          <DxGrid
            columns={columns}
            data={history}
            rowKey={(tx) => tx.id}
            isLoading={historyLoading}
            filterRow
            empty={{ icon: Gift, title: "No transactions yet", description: "Award or redeem points to start building this patient's history." }}
          />
        </DxPanel>
      </div>

      <PointsActionModal isOpen={award.isOpen} onClose={award.close} mode="earn" patientId={id} balance={balance} />
      <PointsActionModal isOpen={redeem.isOpen} onClose={redeem.close} mode="redeem" patientId={id} balance={balance} />
      <TierBenefitsModal isOpen={tiers.isOpen} onClose={tiers.close} balance={balance} />
    </DxPage>
  );
}
