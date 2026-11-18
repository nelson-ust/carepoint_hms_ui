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
import { DxPage, DxPageHeader, DxPanel, DxKpi, DxButton } from "@/components/dx";
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
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "HR & Payroll" }, { label: "Analytics" }]}
        title="HR & Payroll Analytics"
        subtitle="Monitor staff attendance, manage payroll cycles, and track workforce expenditures."
        actions={
          <>
            <DxButton leftIcon={<Calendar className="h-4 w-4" />} onClick={() => navigate("/hr/attendance")}>Attendance log</DxButton>
            <DxButton variant="primary" leftIcon={<Wallet className="h-4 w-4" />} onClick={() => navigate(routes.payroll)}>Payroll runs</DxButton>
          </>
        }
      />

      {/* KPI Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DxKpi label="Active Staff" value={activeStaff} icon={Users} tone="neutral" isLoading={headcountQuery.isLoading && staffLoading} />
        <DxKpi label="Checked In Today" value={presentToday} icon={UserCheck} tone="accent" sub={activeStaff > 0 ? `of ${activeStaff} staff` : undefined} isLoading={attendanceQuery.isLoading} />
        <DxKpi label="Last Payroll (Net)" value={latestRun ? compactMoney.format(latestRun.total_net) : "—"} icon={Wallet} tone="info"
          sub={payrollDelta !== undefined ? `${payrollDelta >= 0 ? "+" : ""}${payrollDelta.toFixed(1)}% vs previous run` : undefined} isLoading={runsQuery.isLoading} />
        <DxKpi label="Pending Leaves" value={pendingLeaves} icon={CalendarClock} tone="warning" isLoading={pendingLeaveQuery.isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Payroll trend */}
        <DxPanel
          className="lg:col-span-2"
          title="Payroll Expenditure"
          description="Net payout per processed payroll run."
          actions={<DxButton variant="text" size="sm" onClick={() => navigate(routes.payroll)}>View runs</DxButton>}
        >
          {runsQuery.isLoading ? (
            <div className="dx-skeleton h-[300px] w-full" />
          ) : runsQuery.isError ? (
            <div className="py-16 text-center">
              <Wallet className="mx-auto mb-3 h-9 w-9 text-[var(--dx-text-faint)]" />
              <p className="text-[14px] font-semibold text-[var(--dx-text)]">Could not load payroll data</p>
              <p className="mt-1 text-[13px] text-[var(--dx-text-muted)]">The payroll trend failed to load.</p>
              <DxButton className="mx-auto mt-4" size="sm" onClick={() => runsQuery.refetch()}>Retry</DxButton>
            </div>
          ) : trendData.length === 0 ? (
            <div className="py-16 text-center">
              <Wallet className="mx-auto mb-3 h-9 w-9 text-[var(--dx-text-faint)]" />
              <p className="text-[14px] font-semibold text-[var(--dx-text)]">No processed payroll runs</p>
              <p className="mt-1 text-[13px] text-[var(--dx-text-muted)]">Once payroll runs are calculated, expenditure will trend here.</p>
              <DxButton className="mx-auto mt-4" variant="primary" size="sm" onClick={() => navigate(routes.payroll)}>Go to Payroll</DxButton>
            </div>
          ) : (
            <PayrollTrendChart data={trendData} />
          )}
        </DxPanel>

        {/* Daily check-ins */}
        <DxPanel title="Daily Check-ins" description="Latest clock-ins recorded today.">
          {attendanceQuery.isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="dx-skeleton h-14 w-full" />)}</div>
          ) : attendanceQuery.isError ? (
            <div className="py-10 text-center">
              <Clock className="mx-auto mb-3 h-9 w-9 text-[var(--dx-text-faint)]" />
              <p className="text-[14px] font-semibold text-[var(--dx-text)]">Could not load check-ins</p>
              <DxButton className="mx-auto mt-4" size="sm" onClick={() => attendanceQuery.refetch()}>Retry</DxButton>
            </div>
          ) : checkIns.length === 0 ? (
            <div className="py-10 text-center">
              <Clock className="mx-auto mb-3 h-9 w-9 text-[var(--dx-text-faint)]" />
              <p className="text-[14px] font-semibold text-[var(--dx-text)]">No check-ins yet</p>
              <p className="mt-1 text-[13px] text-[var(--dx-text-muted)]">No staff have clocked in today.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {checkIns.map((r) => {
                const name = nameMap.get(r.staff_profile_id) ?? `Staff #${r.staff_profile_id}`;
                const dotColor = r.is_absent ? "var(--dx-danger)" : r.is_late ? "var(--dx-warning)" : "var(--dx-success)";
                return (
                  <div key={r.id} className="flex items-center justify-between rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--dx-accent-soft)] text-[10px] font-bold text-[var(--dx-accent)]">{initials(name) || "?"}</div>
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-semibold text-[var(--dx-text)]">{name}</p>
                        <p className="dx-mono text-[10px] font-medium text-[var(--dx-text-muted)]">{fmtTime(r.clock_in_at)}{r.is_late && r.minutes_late ? ` · +${r.minutes_late}m late` : ""}</p>
                      </div>
                    </div>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dotColor }} aria-label={r.is_absent ? "Absent" : r.is_late ? "Late" : "On time"} />
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-6 flex items-center justify-between gap-3">
            <p className="text-[12px] font-medium text-[var(--dx-text-muted)]">{lateToday > 0 ? `${lateToday} late arrival${lateToday === 1 ? "" : "s"} today` : "No late arrivals today"}</p>
            <DxButton size="sm" onClick={() => navigate("/hr/attendance")}>Full attendance</DxButton>
          </div>
        </DxPanel>
      </div>
    </DxPage>
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
