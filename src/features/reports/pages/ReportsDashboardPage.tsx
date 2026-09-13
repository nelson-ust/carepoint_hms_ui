import { useRef, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Activity,
  AlertCircle,
  Banknote,
  CreditCard,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Package,
  PieChart,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricCard } from "@/components/charts/MetricCard";
import { useChartTheme } from "@/components/charts/chart-theme";
import { useToast } from "@/components/feedback/ToastProvider";
import { cn } from "@/lib/utils/cn";
import {
  REPORT_DEFINITIONS,
  saveReportFile,
  type ReportDefinition,
  type ReportFileType,
  type ReportType,
} from "../api/reports.api";
import {
  useAggregationSummary,
  useGenerateReport,
  useOperationalSummary,
  useRefreshReports,
} from "../hooks/use-reports";

// ---------- Local run tracking ----------
// The backend generates reports on the fly and streams the file back —
// there is no server-side run-history endpoint — so recent runs are
// tracked client-side for the session.

type RunStatus = "RUNNING" | "COMPLETED" | "FAILED";

type ReportRun = {
  id: number;
  type: ReportType;
  label: string;
  fileType: ReportFileType;
  status: RunStatus;
  startedAt: string;
  filename?: string;
};

const runStatusVariants: Record<RunStatus, BadgeProps["variant"]> = {
  RUNNING: "soft-warning",
  COMPLETED: "soft-success",
  FAILED: "soft-danger",
};

const reportIcons: Record<ReportType, LucideIcon> = {
  financial: CreditCard,
  clinical: Activity,
  inventory: Database,
  workforce: ShieldCheck,
  comprehensive: PieChart,
};

const reportIconChips: Record<ReportType, string> = {
  financial: "bg-primary-500/10 text-primary-500",
  clinical: "bg-cyan-500/10 text-cyan-500",
  inventory: "bg-amber-500/10 text-amber-500",
  workforce: "bg-violet-500/10 text-violet-500",
  comprehensive: "bg-rose-500/10 text-rose-500",
};

function formatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function shortDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return format(parsed, "MMM d");
}

function ChartCard({
  title,
  description,
  isLoading,
  isEmpty,
  emptyLabel,
  children,
}: {
  title: string;
  description: string;
  isLoading: boolean;
  isEmpty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="h-72 w-full">
        {isLoading ? (
          <div className="flex h-full flex-col justify-end gap-3">
            <Skeleton className="h-2/3 w-full" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ) : isEmpty ? (
          <EmptyState
            title={emptyLabel}
            description="Data will appear here as records are captured."
            className="py-10"
          />
        ) : (
          children
        )}
      </div>
    </Card>
  );
}

export function ReportsDashboardPage() {
  const chart = useChartTheme();
  const toast = useToast();

  const aggregation = useAggregationSummary();
  const operational = useOperationalSummary();
  const generate = useGenerateReport();
  const refreshReports = useRefreshReports();

  const [runs, setRuns] = useState<ReportRun[]>([]);
  const runIdRef = useRef(0);

  const summary = aggregation.data;
  const financial = summary?.financial;
  const clinical = summary?.clinical;
  const inventory = summary?.inventory;
  const workforce = summary?.workforce;

  const isRunning = (type: ReportType, fileType: ReportFileType) =>
    runs.some((r) => r.type === type && r.fileType === fileType && r.status === "RUNNING");

  const runReport = (definition: ReportDefinition, fileType: ReportFileType) => {
    if (isRunning(definition.type, fileType)) return;
    const runId = ++runIdRef.current;
    setRuns((prev) =>
      [
        {
          id: runId,
          type: definition.type,
          label: definition.label,
          fileType,
          status: "RUNNING" as RunStatus,
          startedAt: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 8)
    );

    const updateRun = (patch: Partial<ReportRun>) =>
      setRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, ...patch } : r)));

    generate.mutate(
      { reportType: definition.type, fileType },
      {
        onSuccess: (file) => {
          updateRun({ status: "COMPLETED", filename: file.filename });
          saveReportFile(file);
          toast.success(`${definition.label} generated`, file.filename);
        },
        onError: () => {
          updateRun({ status: "FAILED" });
          toast.error(`Could not generate ${definition.label}.`);
        },
      }
    );
  };

  const visitTrends = (clinical?.visit_trends ?? []).map((point) => ({
    ...point,
    label: shortDate(point.date),
  }));
  const topDiagnoses = clinical?.top_diagnoses ?? [];

  const summaryLoading = aggregation.isLoading;

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      <PageHeader
        title="Reports & Analytics"
        description="Clinical registries, financial audits and operational performance across your hospital."
        actions={
          <Button
            variant="secondary"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={refreshReports}
            isLoading={aggregation.isFetching || operational.isFetching}
          >
            Refresh Data
          </Button>
        }
      />

      {/* KPI row — /reports/aggregation-summary + /reports/operational-summary */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Revenue"
          value={
            financial
              ? formatCurrency(financial.total_revenue, financial.currency)
              : "—"
          }
          icon={Banknote}
          tone="primary"
          isLoading={summaryLoading}
        />
        <MetricCard
          label="Registered Patients"
          value={operational.data ? operational.data.total_patients.toLocaleString() : "—"}
          icon={Users}
          tone="cyan"
          isLoading={operational.isLoading}
        />
        <MetricCard
          label="Active Visits"
          value={
            operational.data ? operational.data.total_active_visits.toLocaleString() : "—"
          }
          icon={Activity}
          tone="violet"
          isLoading={operational.isLoading}
        />
        <MetricCard
          label="Low Stock Items"
          value={inventory ? inventory.low_stock_items.toLocaleString() : "—"}
          icon={Package}
          tone="amber"
          isLoading={summaryLoading}
        />
      </div>

      {/* Summary load failure */}
      {aggregation.isError ? (
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
              <AlertCircle className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-bold text-secondary-900">
                Could not load analytics summary.
              </p>
              <p className="text-xs font-medium text-secondary-500">
                The charts below need the aggregation summary to render.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => aggregation.refetch()}
            leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
          >
            Retry
          </Button>
        </Card>
      ) : null}

      {/* Charts — theme tokens only, no hardcoded hex */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ChartCard
            title="Visit Trends"
          description="Patient visits over the last 7 days."
          isLoading={summaryLoading}
          isEmpty={aggregation.isError || visitTrends.length === 0}
          emptyLabel="No visit activity yet"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={visitTrends} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="reports-visits-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chart.areaGradient.from} />
                  <stop offset="100%" stopColor={chart.areaGradient.to} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={chart.tick} axisLine={false} tickLine={false} dy={8} />
              <YAxis tick={chart.tick} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip cursor={chart.cursor} contentStyle={chart.tooltip} />
              <Area
                type="monotone"
                dataKey="count"
                name="Visits"
                stroke={chart.series[0]}
                strokeWidth={2.5}
                fill="url(#reports-visits-gradient)"
              />
            </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="lg:col-span-2">
          <ChartCard
            title="Top Diagnoses"
            description="Most frequent diagnoses recorded."
            isLoading={summaryLoading}
            isEmpty={aggregation.isError || topDiagnoses.length === 0}
            emptyLabel="No diagnoses recorded"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topDiagnoses}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={chart.tick} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={chart.tick}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip cursor={chart.cursor} contentStyle={chart.tooltip} />
                <Bar dataKey="count" name="Cases" radius={[0, 8, 8, 0]} barSize={18}>
                  {topDiagnoses.map((entry, index) => (
                    <Cell key={entry.name} fill={chart.series[index % chart.series.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="lg:col-span-5">
          <ChartCard
            title="Staff by Department"
            description={`${workforce?.total_staff ?? 0} staff · ${workforce?.active_shifts_today ?? 0} on shift today.`}
            isLoading={summaryLoading}
            isEmpty={aggregation.isError || (workforce?.staff_by_department ?? []).length === 0}
            emptyLabel="No workforce data"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={workforce?.staff_by_department ?? []}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={chart.tick} axisLine={false} tickLine={false} dy={8} />
                <YAxis tick={chart.tick} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={chart.cursor} contentStyle={chart.tooltip} />
                <Bar
                  dataKey="count"
                  name="Staff"
                  fill={chart.series[1]}
                  radius={[8, 8, 0, 0]}
                  barSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* Report catalog + recent runs */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Report Catalog"
              description="Generate a report on demand — files download instantly as PDF or Excel."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {REPORT_DEFINITIONS.map((definition) => {
                const Icon = reportIcons[definition.type];
                return (
                  <div
                    key={definition.type}
                    className="rounded-3xl border border-secondary-100 p-5 transition-colors hover:border-primary-500/30 dark:border-white/10"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                          reportIconChips[definition.type]
                        )}
                      >
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-secondary-900">
                          {definition.label}
                        </h4>
                        <p className="mt-1 text-xs font-medium text-secondary-500">
                          {definition.description}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<FileText className="h-3.5 w-3.5" />}
                        isLoading={isRunning(definition.type, "pdf")}
                        onClick={() => runReport(definition, "pdf")}
                      >
                        Run PDF
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<FileSpreadsheet className="h-3.5 w-3.5" />}
                        isLoading={isRunning(definition.type, "excel")}
                        onClick={() => runReport(definition, "excel")}
                      >
                        Excel
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Recent Runs"
            description={
              summary
                ? `Data as of ${format(new Date(summary.generated_at), "MMM d, HH:mm")}.`
                : "Reports generated this session."
            }
          />
          {runs.length === 0 ? (
            <EmptyState
              icon={Download}
              title="No runs yet"
              description="Trigger a report from the catalog and its status will show here."
              className="py-10"
            />
          ) : (
            <ul className="space-y-3">
              {runs.map((run) => (
                <li
                  key={run.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-secondary-100 px-4 py-3 dark:border-white/10"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-secondary-900">
                      {run.label}
                    </p>
                    <p className="data-mono mt-0.5 text-[11px] text-secondary-400">
                      {run.fileType.toUpperCase()} ·{" "}
                      {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <Badge
                    variant={runStatusVariants[run.status]}
                    className={cn(run.status === "RUNNING" && "animate-pulse")}
                  >
                    {run.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
