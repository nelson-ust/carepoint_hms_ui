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
import { CheckCircle2, Clock, Ticket, TrendingUp, UserX } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricCard } from "@/components/charts/MetricCard";
import { useChartTheme } from "@/components/charts/chart-theme";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { cn } from "@/lib/utils/cn";
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

function noShowBadgeVariant(rate?: number | null): BadgeProps["variant"] {
  if (rate == null) return "secondary";
  if (rate >= 0.25) return "soft-danger";
  if (rate >= 0.1) return "soft-warning";
  return "soft-success";
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

  const columns: DataTableColumn<ServicePointQueueStats>[] = [
    {
      key: "service_point",
      header: "Service Point",
      render: (sp) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-secondary-900">
            {sp.service_delivery_point_name}
          </p>
          {sp.service_delivery_point_code ? (
            <p className="data-mono text-xs text-secondary-400">{sp.service_delivery_point_code}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "live",
      header: "Live Depth",
      align: "center",
      render: (sp) => (
        <div>
          <span className="data-mono font-bold text-secondary-900">
            {sp.waiting_now + sp.called_now + sp.serving_now}
          </span>
          <p className="text-[10px] font-medium text-secondary-400">
            {sp.waiting_now}W · {sp.called_now}C · {sp.serving_now}S
          </p>
        </div>
      ),
    },
    { key: "issued", header: "Issued", align: "center", render: (sp) => <span className="data-mono">{sp.issued}</span> },
    { key: "served", header: "Served", align: "center", render: (sp) => <span className="data-mono">{sp.served}</span> },
    { key: "missed", header: "Missed", align: "center", render: (sp) => <span className="data-mono">{sp.missed}</span> },
    { key: "cancelled", header: "Cancelled", align: "center", render: (sp) => <span className="data-mono">{sp.cancelled}</span> },
    {
      key: "avg_wait",
      header: "Avg Wait",
      align: "right",
      render: (sp) => <span className="data-mono text-xs">{minutesLabel(sp.avg_wait_minutes)}</span>,
    },
    {
      key: "avg_service",
      header: "Avg Service",
      align: "right",
      render: (sp) => <span className="data-mono text-xs">{minutesLabel(sp.avg_service_minutes)}</span>,
    },
    {
      key: "no_show",
      header: "No-show",
      align: "right",
      render: (sp) => (
        <Badge variant={noShowBadgeVariant(sp.no_show_rate)}>{percentLabel(sp.no_show_rate)}</Badge>
      ),
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Queue Analytics"
        description="Throughput, wait times and no-show rates per service delivery point."
      />

      {/* Range picker */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="inline-flex overflow-hidden rounded-2xl border border-secondary-200 dark:border-white/10">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setRange(opt.key)}
              className={cn(
                "px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors",
                range === opt.key
                  ? "bg-primary-500 text-white shadow-glow-sm"
                  : "text-secondary-500 hover:bg-secondary-500/5 dark:hover:bg-white/5",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {range === "custom" && (
          <div className="flex items-end gap-3">
            <Input
              label="From"
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="w-44 py-2.5"
            />
            <Input
              label="To"
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
              className="w-44 py-2.5"
            />
          </div>
        )}
        {stats ? (
          <span className="data-mono pb-2 text-xs text-secondary-400">
            {windowLabel(stats.date_from, stats.date_to)}
          </span>
        ) : null}
      </div>

      {/* Totals */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Tickets Issued"
          value={totals?.issued ?? 0}
          icon={Ticket}
          tone="primary"
          isLoading={statsQuery.isLoading}
        />
        <MetricCard
          label="Served"
          value={totals?.served ?? 0}
          icon={CheckCircle2}
          tone="cyan"
          isLoading={statsQuery.isLoading}
        />
        <MetricCard
          label="Avg Wait"
          value={minutesLabel(totals?.avg_wait_minutes)}
          icon={Clock}
          tone="amber"
          isLoading={statsQuery.isLoading}
        />
        <MetricCard
          label="No-show Rate"
          value={percentLabel(totals?.no_show_rate)}
          icon={UserX}
          tone="rose"
          isLoading={statsQuery.isLoading}
        />
      </div>

      {errorMessage ? (
        <Card>
          <EmptyState
            icon={TrendingUp}
            title="Statistics unavailable"
            description={errorMessage}
            action={
              <Button variant="secondary" size="sm" onClick={() => statsQuery.refetch()}>
                Retry
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Served per Service Point"
                description="Tickets completed within the selected window."
              />
              <ChartBody
                isLoading={statsQuery.isLoading}
                isEmpty={chartData.length === 0}
                emptyText="No queue activity in this window."
              >
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={chart.tick} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={chart.tick} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip cursor={chart.cursor} contentStyle={chart.tooltip} />
                    <Bar dataKey="served" name="Served" fill={chart.series[0]} radius={[8, 8, 0, 0]} barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartBody>
            </Card>

            <Card>
              <CardHeader
                title="Average Wait per Service Point"
                description="Mean minutes from ticket issue to service start."
              />
              <ChartBody
                isLoading={statsQuery.isLoading}
                isEmpty={chartData.length === 0}
                emptyText="No wait-time data in this window."
              >
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={chart.tick} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={chart.tick} axisLine={false} tickLine={false} unit="m" />
                    <Tooltip cursor={chart.cursor} contentStyle={chart.tooltip} />
                    <Bar dataKey="avg_wait" name="Avg wait (min)" fill={chart.series[3]} radius={[8, 8, 0, 0]} barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartBody>
            </Card>
          </div>

          {/* Per-SDP breakdown */}
          <Card padding="none">
            <CardHeader
              title="Service Point Breakdown"
              description="Live queue depth alongside window throughput."
              className="px-6 pt-6"
            />
            <DataTable
              columns={columns}
              data={servicePoints}
              rowKey={(sp) => sp.service_delivery_point_id}
              isLoading={statsQuery.isLoading}
              error={null}
              empty={{
                icon: TrendingUp,
                title: "No statistics yet",
                description: "Queue activity in the selected window will appear here.",
              }}
            />
          </Card>
        </>
      )}
    </div>
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
  if (isLoading) return <Skeleton className="h-[280px] w-full rounded-2xl" />;
  if (isEmpty) {
    return (
      <div className="flex h-[280px] items-center justify-center">
        <p className="text-sm font-medium text-secondary-400">{emptyText}</p>
      </div>
    );
  }
  return <>{children}</>;
}
