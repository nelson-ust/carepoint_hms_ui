import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarClock, CheckCircle2, Clock, RotateCcw, Ticket, TrendingUp, UserX } from "lucide-react";
import {
  DxPage, DxPageHeader, DxSegmented, DxKpi, DxPanel, DxGrid, DxBadge, DxButton,
  DxInput, DxMessage, DxStatusBar, DxStatusItem,
  type DxGridColumn,
} from "@/components/dx";
import { useChartTheme } from "@/components/charts/chart-theme";
import { useQueueStats } from "../hooks/use-queue";
import type { ServicePointQueueStats } from "../api/queues.api";

// ============================================================
// Range handling
// ============================================================

type RangeKey = "today" | "7d" | "30d" | "custom";

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "custom", label: "Custom" },
];

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function resolveWindow(
  range: RangeKey,
  customFrom: string,
  customTo: string,
): { from?: string; to?: string } {
  const todayStart = startOfDay(new Date());
  const tomorrowStart = addDays(todayStart, 1);
  switch (range) {
    case "today":
      return { from: todayStart.toISOString(), to: tomorrowStart.toISOString() };
    case "7d":
      return { from: addDays(todayStart, -6).toISOString(), to: tomorrowStart.toISOString() };
    case "30d":
      return { from: addDays(todayStart, -29).toISOString(), to: tomorrowStart.toISOString() };
    case "custom": {
      const from = customFrom ? startOfDay(new Date(`${customFrom}T00:00:00`)) : todayStart;
      const toBase = customTo ? startOfDay(new Date(`${customTo}T00:00:00`)) : todayStart;
      return { from: from.toISOString(), to: addDays(toBase, 1).toISOString() };
    }
  }
}

// ============================================================
// Formatters
// ============================================================

function minutesLabel(value?: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(1)} min`;
}

function percentLabel(rate?: number | null): string {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

function noShowTone(rate?: number | null): "neutral" | "danger" | "warning" | "success" {
  if (rate == null) return "neutral";
  if (rate >= 0.25) return "danger";
  if (rate >= 0.1) return "warning";
  return "success";
}

function windowLabel(dateFrom?: string, dateTo?: string): string {
  if (!dateFrom || !dateTo) return "";
  const from = new Date(dateFrom);
  const to = new Date(new Date(dateTo).getTime() - 1); // exclusive end → last covered instant
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${fmt(from)} – ${fmt(to)}`;
}

// ============================================================
// Page
// ============================================================

export function QueueAnalyticsPage() {
  const chart = useChartTheme();
  const axisTick = { fill: chart.tick.fill, fontSize: chart.tick.fontSize, fontWeight: chart.tick.fontWeight };
  const [range, setRange] = useState<RangeKey>("today");
  const [customFrom, setCustomFrom] = useState(() => toDateInputValue(addDays(new Date(), -6)));
  const [customTo, setCustomTo] = useState(() => toDateInputValue(new Date()));

  const { from, to } = useMemo(
    () => resolveWindow(range, customFrom, customTo),
    [range, customFrom, customTo],
  );

  const statsQuery = useQueueStats(from, to);
  const stats = statsQuery.data;
  const totals = stats?.totals;
  const servicePoints = stats?.service_points ?? [];
  const errorMessage = statsQuery.isError
    ? "Unable to load queue statistics. Please retry."
    : null;

  const chartData = useMemo(
    () =>
      servicePoints.map((sp) => ({
        name: sp.service_delivery_point_code || sp.service_delivery_point_name,
        fullName: sp.service_delivery_point_name,
        served: sp.served,
        avg_wait: sp.avg_wait_minutes ?? 0,
      })),
    [servicePoints],
  );

  const columns: DxGridColumn<ServicePointQueueStats>[] = [
    {
      key: "service_point",
      header: "Service point",
      render: (sp) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-[var(--dx-text)]">{sp.service_delivery_point_name}</p>
          {sp.service_delivery_point_code ? <p className="dx-mono text-[11px] text-[var(--dx-text-muted)]">{sp.service_delivery_point_code}</p> : null}
        </div>
      ),
    },
    {
      key: "live",
      header: "Live depth",
      align: "center",
      render: (sp) => (
        <div>
          <span className="dx-mono text-[13px] font-bold text-[var(--dx-text)]">{sp.waiting_now + sp.called_now + sp.serving_now}</span>
          <p className="text-[10px] font-medium text-[var(--dx-text-muted)]">{sp.waiting_now}W · {sp.called_now}C · {sp.serving_now}S</p>
        </div>
      ),
    },
    { key: "issued", header: "Issued", align: "center", accessor: (sp) => sp.issued, render: (sp) => <span className="dx-mono text-[13px] text-[var(--dx-text)]">{sp.issued}</span> },
    { key: "served", header: "Served", align: "center", accessor: (sp) => sp.served, render: (sp) => <span className="dx-mono text-[13px] text-[var(--dx-text)]">{sp.served}</span> },
    { key: "missed", header: "Missed", align: "center", accessor: (sp) => sp.missed, render: (sp) => <span className="dx-mono text-[13px] text-[var(--dx-text)]">{sp.missed}</span> },
    { key: "cancelled", header: "Cancelled", align: "center", accessor: (sp) => sp.cancelled, render: (sp) => <span className="dx-mono text-[13px] text-[var(--dx-text)]">{sp.cancelled}</span> },
    { key: "avg_wait", header: "Avg wait", align: "right", accessor: (sp) => sp.avg_wait_minutes ?? 0, render: (sp) => <span className="dx-mono text-[12px] text-[var(--dx-text-muted)]">{minutesLabel(sp.avg_wait_minutes)}</span> },
    { key: "avg_service", header: "Avg service", align: "right", accessor: (sp) => sp.avg_service_minutes ?? 0, render: (sp) => <span className="dx-mono text-[12px] text-[var(--dx-text-muted)]">{minutesLabel(sp.avg_service_minutes)}</span> },
    {
      key: "no_show", header: "No-show", align: "right", accessor: (sp) => sp.no_show_rate ?? 0,
      render: (sp) => <DxBadge tone={noShowTone(sp.no_show_rate)}>{percentLabel(sp.no_show_rate)}</DxBadge>,
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Queues" }, { label: "Analytics" }]}
        title="Queue Analytics"
        subtitle="Throughput, wait times and no-show rates per service delivery point."
        actions={<DxButton icon title="Refresh" onClick={() => statsQuery.refetch()} isLoading={statsQuery.isFetching}><RotateCcw /></DxButton>}
      />

      {/* Range picker */}
      <div className="flex flex-wrap items-end gap-3">
        <DxSegmented<RangeKey>
          value={range}
          onChange={setRange}
          ariaLabel="Date range"
          items={RANGE_OPTIONS.map((o) => ({ key: o.key, label: o.label }))}
        />
        {range === "custom" ? (
          <div className="flex items-end gap-3">
            <div className="w-40"><DxInput label="From" type="date" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} /></div>
            <div className="w-40"><DxInput label="To" type="date" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} /></div>
          </div>
        ) : null}
      </div>

      {stats ? (
        <DxStatusBar>
          <DxStatusItem icon={<CalendarClock className="h-3.5 w-3.5" />}>{windowLabel(stats.date_from, stats.date_to)}</DxStatusItem>
          <DxStatusItem icon={<Ticket className="h-3.5 w-3.5" />}>{totals?.issued ?? 0} issued · {totals?.served ?? 0} served</DxStatusItem>
        </DxStatusBar>
      ) : null}

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <DxKpi label="Tickets issued" value={totals?.issued ?? 0} icon={Ticket} tone="accent" isLoading={statsQuery.isLoading} />
        <DxKpi label="Served" value={totals?.served ?? 0} icon={CheckCircle2} tone="success" isLoading={statsQuery.isLoading} />
        <DxKpi label="Avg wait" value={minutesLabel(totals?.avg_wait_minutes)} icon={Clock} tone="warning" isLoading={statsQuery.isLoading} />
        <DxKpi label="No-show rate" value={percentLabel(totals?.no_show_rate)} icon={UserX} tone={noShowTone(totals?.no_show_rate)} isLoading={statsQuery.isLoading} />
      </div>

      {errorMessage ? (
        <DxPanel title="Statistics unavailable" icon={<TrendingUp className="h-4 w-4" />}>
          <div className="py-10 text-center">
            <p className="text-[13px] text-[var(--dx-text-muted)]">{errorMessage}</p>
            <DxButton className="mx-auto mt-4" size="sm" onClick={() => statsQuery.refetch()}>Retry</DxButton>
          </div>
        </DxPanel>
      ) : (
        <>
          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <DxPanel title="Served per service point" icon={<CheckCircle2 className="h-4 w-4" />} description="Tickets completed within the selected window.">
              <ChartBody isLoading={statsQuery.isLoading} isEmpty={chartData.length === 0} emptyText="No queue activity in this window.">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                    <Tooltip cursor={chart.cursor} contentStyle={chart.tooltip} />
                    <Bar dataKey="served" name="Served" fill={chart.series[0]} radius={[6, 6, 0, 0]} barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartBody>
            </DxPanel>

            <DxPanel title="Average wait per service point" icon={<Clock className="h-4 w-4" />} description="Mean minutes from ticket issue to service start.">
              <ChartBody isLoading={statsQuery.isLoading} isEmpty={chartData.length === 0} emptyText="No wait-time data in this window.">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} unit="m" width={40} />
                    <Tooltip cursor={chart.cursor} contentStyle={chart.tooltip} />
                    <Bar dataKey="avg_wait" name="Avg wait (min)" fill={chart.series[3]} radius={[6, 6, 0, 0]} barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartBody>
            </DxPanel>
          </div>

          {/* Per-SDP breakdown */}
          <DxPanel title="Service point breakdown" icon={<TrendingUp className="h-4 w-4" />} description="Live queue depth alongside window throughput." flush>
            <DxGrid
              columns={columns}
              data={servicePoints}
              rowKey={(sp) => sp.service_delivery_point_id}
              isLoading={statsQuery.isLoading}
              empty={{
                icon: TrendingUp,
                title: "No statistics yet",
                description: "Queue activity in the selected window will appear here.",
              }}
            />
          </DxPanel>
        </>
      )}
    </DxPage>
  );
}

function ChartBody({
  isLoading,
  isEmpty,
  emptyText,
  children,
}: {
  isLoading: boolean;
  isEmpty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  if (isLoading) return <div className="dx-skeleton h-[280px] w-full" />;
  if (isEmpty) {
    return (
      <div className="flex h-[280px] items-center justify-center">
        <p className="text-[13px] font-medium text-[var(--dx-text-muted)]">{emptyText}</p>
      </div>
    );
  }
  return <>{children}</>;
}
