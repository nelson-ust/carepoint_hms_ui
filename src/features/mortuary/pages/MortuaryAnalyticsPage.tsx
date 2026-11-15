import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  Archive,
  Banknote,
  Clock,
  Gauge,
  RotateCcw,
  Scissors,
  Snowflake,
  TrendingUp,
} from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxGrid,
  DxKpi,
  DxPage,
  DxPageHeader,
  DxPageLoading,
  DxPanel,
  DxProps,
  apiErrorMessage,
  type DxGridColumn,
} from "@/components/dx";
import { useChartTheme } from "@/components/charts/chart-theme";
import { routes } from "@/config/routes";
import { useState } from "react";
import { mortuaryApi, type MortuaryAnalytics } from "../api/mortuary.api";

const naira = (n: number | string) => `₦ ${Number(n).toLocaleString()}`;

/**
 * Mortuary analytics — intake trends, occupancy, length of stay, billing,
 * autopsy throughput and long-stay bodies, to guide capacity and revenue
 * decisions.
 */
export function MortuaryAnalyticsPage() {
  const navigate = useNavigate();
  const chart = useChartTheme();
  const [months, setMonths] = useState(6);

  const q = useQuery({ queryKey: ["mortuary", "analytics", months], queryFn: () => mortuaryApi.getAnalytics(months) });
  const a: MortuaryAnalytics | undefined = q.data;

  if (q.isLoading) return <DxPageLoading label="Computing analytics…" />;

  const s = a?.summary;
  const axisTick = { fill: chart.tick.fill, fontSize: chart.tick.fontSize, fontWeight: chart.tick.fontWeight };

  const longStayColumns: DxGridColumn<MortuaryAnalytics["long_stay"][number]>[] = [
    { key: "tag_number", header: "Tag", render: (r) => <span className="dx-mono font-semibold">{r.tag_number}</span> },
    { key: "deceased_name", header: "Deceased", render: (r) => <span className="font-semibold">{r.deceased_name}</span> },
    { key: "unit", header: "Storage", render: (r) => r.unit ?? <span className="text-[var(--dx-text-faint)]">—</span> },
    { key: "days", header: "Days in storage", align: "right", render: (r) => <DxBadge tone={r.days > 30 ? "danger" : "warning"}>{r.days} days</DxBadge> },
  ];
  const causeColumns: DxGridColumn<MortuaryAnalytics["top_causes"][number]>[] = [
    { key: "cause", header: "Cause of death", render: (r) => r.cause },
    { key: "count", header: "Cases", align: "right", render: (r) => <span className="font-semibold">{r.count}</span> },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Mortuary", to: routes.mortuary }, { label: "Analytics" }]}
        title="Mortuary Analytics"
        subtitle="Intake, occupancy, length of stay, billing and throughput — to guide capacity and revenue decisions."
        actions={
          <>
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="dx-editor dx-editor-sm w-36"
              aria-label="Trend window"
            >
              <option value={3}>Last 3 months</option>
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
            </select>
            <DxButton icon title="Refresh" onClick={() => q.refetch()} isLoading={q.isFetching}><RotateCcw /></DxButton>
          </>
        }
      />

      {q.isError ? (
        <DxPanel title="Analytics" icon={<Activity />}>
          <p className="px-3 py-6 text-center text-[13px] text-[var(--dx-danger)]">{apiErrorMessage(q.error)}</p>
        </DxPanel>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DxKpi label="Bodies in storage" value={s?.in_storage ?? 0} icon={Snowflake} tone="info" sub={`${s?.registered_pending ?? 0} awaiting storage`} />
        <DxKpi label="Occupancy" value={`${s?.utilization_pct ?? 0}%`} icon={Gauge} tone={(s?.utilization_pct ?? 0) >= 85 ? "danger" : "accent"} sub={`${s?.occupied_total ?? 0}/${s?.capacity_total ?? 0} slots`} />
        <DxKpi label="Avg length of stay" value={`${s?.avg_released_los_days ?? 0}d`} icon={Clock} tone="neutral" sub="released bodies" />
        <DxKpi label="Avg current stay" value={`${s?.avg_current_los_days ?? 0}d`} icon={Clock} tone="warning" sub="bodies still held" />
        <DxKpi label="Released / transferred" value={(s?.released ?? 0) + (s?.transferred ?? 0)} icon={Archive} tone="success" sub={`${s?.released ?? 0} released`} />
        <DxKpi label="Pending deposits" value={s?.pending_deposits ?? 0} icon={AlertTriangle} tone="warning" sub="deaths not yet deposited" />
        <DxKpi label="Police cases" value={s?.police_cases ?? 0} icon={Scissors} tone="danger" sub="medico-legal" />
        <DxKpi label="Outstanding billing" value={naira(a?.billing.outstanding ?? 0)} icon={Banknote} tone="danger" sub={`${a?.billing.collection_rate ?? 0}% collected`} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <DxPanel title="Intake & releases trend" icon={<TrendingUp />} description="Deaths recorded, bodies registered and releases per month.">
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={a?.intake_trend ?? []} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={chart.tooltip} cursor={chart.cursor} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="deaths" name="Deaths" stroke={chart.series[4]} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="registrations" name="Registered" stroke={chart.series[0]} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="releases" name="Released" stroke={chart.series[1]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </DxPanel>

        <DxPanel title="Intake source" icon={<Archive />} description="In-hospital deaths vs bodies brought from outside.">
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={a?.source_split ?? []} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {(a?.source_split ?? []).map((_e, i) => <Cell key={i} fill={chart.series[i % chart.series.length]} />)}
                </Pie>
                <Tooltip contentStyle={chart.tooltip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </DxPanel>

        <DxPanel title="Length of stay (bodies in storage)" icon={<Clock />} description="How long current bodies have been held — flags turnover pressure.">
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a?.los_buckets ?? []} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="bucket" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={chart.tooltip} cursor={chart.cursor} />
                <Bar dataKey="count" name="Bodies" fill={chart.series[2]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DxPanel>

        <DxPanel title="Billing by charge type" icon={<Banknote />} description={`Billed ${naira(a?.billing.total ?? 0)} · Collected ${naira(a?.billing.collected ?? 0)} · Outstanding ${naira(a?.billing.outstanding ?? 0)}`}>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(a?.billing.by_type ?? []).map((b) => ({ type: b.type.replace("_", " "), amount: Number(b.amount) }))} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
                <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="type" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chart.tooltip} cursor={chart.cursor} formatter={(value) => naira(value as number)} />
                <Bar dataKey="amount" name="Amount" fill={chart.series[0]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DxPanel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DxPanel title="Unit occupancy" icon={<Gauge />} description="Live utilisation per storage unit." flush>
            <div className="p-3 space-y-2.5">
              {(a?.unit_utilization ?? []).length === 0 ? (
                <p className="py-6 text-center text-[12.5px] text-[var(--dx-text-muted)]">No storage units yet.</p>
              ) : (
                (a?.unit_utilization ?? []).map((u) => (
                  <div key={u.code}>
                    <div className="mb-1 flex items-center justify-between text-[12px]">
                      <span className="font-semibold text-[var(--dx-text)]">{u.name}</span>
                      <span className="text-[var(--dx-text-muted)]">{u.occupied}/{u.capacity} · {u.pct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--dx-surface-sunken)]">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(u.pct, 100)}%`, background: u.pct >= 85 ? "var(--dx-danger)" : u.pct >= 50 ? "var(--dx-warning)" : "var(--dx-accent)" }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </DxPanel>
        </div>

        <DxPanel title="Autopsy throughput" icon={<Scissors />} flush>
          <DxProps items={[
            { label: "Total", value: a?.autopsy.total ?? 0 },
            { label: "Requested", value: a?.autopsy.requested ?? 0 },
            { label: "Scheduled", value: a?.autopsy.scheduled ?? 0 },
            { label: "Completed", value: a?.autopsy.completed ?? 0 },
            { label: "Clinical", value: a?.autopsy.clinical ?? 0 },
            { label: "Medico-legal", value: a?.autopsy.medico_legal ?? 0 },
          ]} />
        </DxPanel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <DxPanel title="Long-stay bodies (> 14 days)" icon={<AlertTriangle />} description="Bodies held longest — act on claims, transfers or disposal." flush>
          <DxGrid<MortuaryAnalytics["long_stay"][number]>
            borderless
            columns={longStayColumns}
            data={a?.long_stay ?? []}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(routes.mortuaryDeceasedDetail.replace(":recordId", String(r.id)))}
            empty={{ icon: Snowflake, title: "No long-stay bodies", description: "Nothing has been held beyond 14 days." }}
          />
        </DxPanel>

        <DxPanel title="Top causes of death" icon={<Activity />} flush>
          <DxGrid<MortuaryAnalytics["top_causes"][number]>
            borderless
            columns={causeColumns}
            data={a?.top_causes ?? []}
            rowKey={(r) => r.cause}
            empty={{ icon: Activity, title: "No cause data", description: "Causes of death will appear as records are captured." }}
          />
        </DxPanel>
      </div>
    </DxPage>
  );
}
