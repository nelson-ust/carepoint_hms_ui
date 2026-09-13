import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  CalendarClock,
  Clock,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricCard } from "@/components/charts/MetricCard";
import { useChartTheme } from "@/components/charts/chart-theme";
import { routes } from "@/config/routes";
import { useAttendance, useHrLeaveRequests } from "@/features/hr/hooks/use-hr";
import { usePayrollRuns } from "@/features/payroll/hooks/use-payroll";
import type { PayrollRun } from "@/features/payroll/api/payroll.api";
import { useStaffNameMap } from "../hooks/use-staff";
import { useHeadcountReport } from "../hooks/use-hr-dashboard";

// ---------- Formatting helpers ----------

const money = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactMoney = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function fmtTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function monthLabel(value: string): string {
  const d = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Payroll runs that carry real calculated totals (anything past DRAFT, not cancelled). */
function processedRuns(runs: PayrollRun[]): PayrollRun[] {
  return runs.filter((r) => r.status !== "DRAFT" && r.status !== "CANCELLED");
}

// ---------- Page ----------

export function HRDashboardPage() {
  const navigate = useNavigate();
  const todayKey = isoDate(new Date());

  const headcountQuery = useHeadcountReport();
  const attendanceQuery = useAttendance({ from_date: todayKey, to_date: todayKey });
  const pendingLeaveQuery = useHrLeaveRequests({ leave_status: "PENDING" });
  const runsQuery = usePayrollRuns();
  const { nameMap, staff, isLoading: staffLoading } = useStaffNameMap();

  // --- KPI aggregates ---

  const activeStaff = useMemo(() => {
    const rows = headcountQuery.data ?? [];
    if (rows.length > 0) {
      return rows
        .filter((r) => r.employment_status?.toUpperCase() === "ACTIVE")
        .reduce((sum, r) => sum + r.count, 0);
    }
    // Fallback when the headcount report has no rows yet.
    return staff.length;
  }, [headcountQuery.data, staff]);

  const todayAttendance = attendanceQuery.data ?? [];
  const presentToday = useMemo(
    () => todayAttendance.filter((r) => !r.is_absent && r.clock_in_at).length,
    [todayAttendance],
  );
  const lateToday = useMemo(
    () => todayAttendance.filter((r) => r.is_late).length,
    [todayAttendance],
  );

  const pendingLeaves = pendingLeaveQuery.data?.length ?? 0;

  const trendRuns = useMemo(() => {
    const usable = processedRuns(runsQuery.data ?? []);
    return usable
      .slice()
      .sort((a, b) => a.period_start.localeCompare(b.period_start))
      .slice(-6);
  }, [runsQuery.data]);

  const latestRun = trendRuns.length > 0 ? trendRuns[trendRuns.length - 1] : undefined;

  const payrollDelta = useMemo(() => {
    if (trendRuns.length < 2) return undefined;
    const prev = trendRuns[trendRuns.length - 2].total_net;
    const curr = trendRuns[trendRuns.length - 1].total_net;
    if (prev <= 0) return undefined;
    return ((curr - prev) / prev) * 100;
  }, [trendRuns]);

  const trendData = useMemo(
    () =>
      trendRuns.map((r) => ({
        month: monthLabel(r.period_start),
        net: r.total_net,
        gross: r.total_gross,
      })),
    [trendRuns],
  );

  const checkIns = useMemo(
    () =>
      todayAttendance
        .filter((r) => r.clock_in_at)
        .slice()
        .sort((a, b) => (b.clock_in_at ?? "").localeCompare(a.clock_in_at ?? ""))
        .slice(0, 6),
    [todayAttendance],
  );

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      <PageHeader
        title="HR & Payroll Analytics"
        description="Monitor staff attendance, manage payroll cycles, and track workforce expenditures."
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<Calendar className="h-4 w-4" />}
              onClick={() => navigate("/hr/attendance")}
            >
              Attendance Log
            </Button>
            <Button
              leftIcon={<Wallet className="h-4 w-4" />}
              onClick={() => navigate(routes.payroll)}
            >
              Payroll Runs
            </Button>
          </>
        }
      />

      {/* KPI Stats */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active Staff"
          value={activeStaff}
          icon={Users}
          tone="slate"
          isLoading={headcountQuery.isLoading && staffLoading}
        />
        <MetricCard
          label="Checked In Today"
          value={presentToday}
          icon={UserCheck}
          tone="primary"
          deltaLabel={activeStaff > 0 ? `of ${activeStaff} staff` : undefined}
          delta={activeStaff > 0 ? (presentToday / activeStaff) * 100 : undefined}
          isLoading={attendanceQuery.isLoading}
        />
        <MetricCard
          label="Last Payroll (Net)"
          value={latestRun ? compactMoney.format(latestRun.total_net) : "—"}
          icon={Wallet}
          tone="cyan"
          delta={payrollDelta}
          deltaLabel={payrollDelta !== undefined ? "vs previous run" : undefined}
          isLoading={runsQuery.isLoading}
        />
        <MetricCard
          label="Pending Leaves"
          value={pendingLeaves}
          icon={CalendarClock}
          tone="amber"
          isLoading={pendingLeaveQuery.isLoading}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Payroll trend */}
        <Card className="lg:col-span-2" padding="lg">
          <CardHeader
            title="Payroll Expenditure"
            description="Net payout per processed payroll run."
            actions={
              <Button variant="ghost" size="sm" onClick={() => navigate(routes.payroll)}>
                View Runs
              </Button>
            }
          />
          {runsQuery.isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : runsQuery.isError ? (
            <EmptyState
              icon={Wallet}
              title="Could not load payroll data"
              description="The payroll trend failed to load."
              action={
                <Button size="sm" variant="secondary" onClick={() => runsQuery.refetch()}>
                  Retry
                </Button>
              }
            />
          ) : trendData.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No processed payroll runs"
              description="Once payroll runs are calculated, expenditure will trend here."
              action={
                <Button size="sm" onClick={() => navigate(routes.payroll)}>
                  Go to Payroll
                </Button>
              }
            />
          ) : (
            <PayrollTrendChart data={trendData} />
          )}
        </Card>

        {/* Daily check-ins */}
        <Card padding="lg">
          <CardHeader
            title="Daily Check-ins"
            description="Latest clock-ins recorded today."
          />
          {attendanceQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : attendanceQuery.isError ? (
            <EmptyState
              icon={Clock}
              title="Could not load check-ins"
              action={
                <Button size="sm" variant="secondary" onClick={() => attendanceQuery.refetch()}>
                  Retry
                </Button>
              }
            />
          ) : checkIns.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No check-ins yet"
              description="No staff have clocked in today."
            />
          ) : (
            <div className="space-y-3">
              {checkIns.map((r) => {
                const name = nameMap.get(r.staff_profile_id) ?? `Staff #${r.staff_profile_id}`;
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-2xl bg-secondary-500/5 px-4 py-3 dark:bg-white/5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-[10px] font-black text-primary-500">
                        {initials(name) || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-secondary-900">{name}</p>
                        <p className="data-mono text-[10px] font-medium text-secondary-400">
                          {fmtTime(r.clock_in_at)}
                          {r.is_late && r.minutes_late ? ` · +${r.minutes_late}m late` : ""}
                        </p>
                      </div>
                    </div>
                    <span
                      className={
                        r.is_absent
                          ? "h-2 w-2 shrink-0 rounded-full bg-rose-500"
                          : r.is_late
                            ? "h-2 w-2 shrink-0 rounded-full bg-amber-500"
                            : "h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                      }
                      aria-label={r.is_absent ? "Absent" : r.is_late ? "Late" : "On time"}
                    />
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-6 flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-secondary-400">
              {lateToday > 0 ? `${lateToday} late arrival${lateToday === 1 ? "" : "s"} today` : "No late arrivals today"}
            </p>
            <Button variant="secondary" size="sm" onClick={() => navigate("/hr/attendance")}>
              Full Attendance
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------- Chart ----------

function PayrollTrendChart({
  data,
}: {
  data: { month: string; net: number; gross: number }[];
}) {
  const chart = useChartTheme();

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="hrPayrollNet" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chart.areaGradient.from} />
              <stop offset="95%" stopColor={chart.areaGradient.to} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={chart.tick} />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={chart.tick}
            tickFormatter={(v: number) => compactMoney.format(v)}
            width={56}
          />
          <Tooltip
            cursor={chart.cursor}
            contentStyle={chart.tooltip}
            formatter={(value, name) => [
              money.format(Number(value)),
              name === "net" ? "Net pay" : "Gross pay",
            ]}
          />
          <Area
            type="monotone"
            dataKey="gross"
            stroke={chart.muted}
            strokeWidth={2}
            fill="transparent"
          />
          <Area
            type="monotone"
            dataKey="net"
            stroke={chart.series[0]}
            strokeWidth={3}
            fill="url(#hrPayrollNet)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
