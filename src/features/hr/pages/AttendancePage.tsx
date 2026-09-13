import { useMemo, useState } from "react";
import { CalendarDays, Clock, UserCheck, UserX } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { MetricCard } from "@/components/charts/MetricCard";
import { SearchInput } from "@/components/forms/SearchInput";
import { useStaffNameMap } from "@/features/staff/hooks/use-staff";
import { useAttendance } from "../hooks/use-hr";
import type { AttendanceRecord } from "../api/hr.api";

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

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" });
}

function hoursWorked(record: AttendanceRecord): string {
  if (!record.clock_in_at || !record.clock_out_at) return "—";
  const start = new Date(record.clock_in_at).getTime();
  const end = new Date(record.clock_out_at).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "—";
  return `${((end - start) / 3_600_000).toFixed(1)}h`;
}

export function AttendancePage() {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 6);

  const [fromDate, setFromDate] = useState(isoDate(weekAgo));
  const [toDate, setToDate] = useState(isoDate(today));
  const [search, setSearch] = useState("");

  const attendanceQuery = useAttendance({
    from_date: fromDate || undefined,
    to_date: toDate || undefined,
  });
  const { nameMap } = useStaffNameMap();

  const records = useMemo(() => {
    const all = attendanceQuery.data ?? [];
    if (!search.trim()) return all;
    const q = search.trim().toLowerCase();
    return all.filter((r) =>
      (nameMap.get(r.staff_profile_id) ?? `Staff #${r.staff_profile_id}`)
        .toLowerCase()
        .includes(q),
    );
  }, [attendanceQuery.data, search, nameMap]);

  const stats = useMemo(() => {
    const all = attendanceQuery.data ?? [];
    return {
      total: all.length,
      present: all.filter((r) => !r.is_absent && r.clock_in_at).length,
      late: all.filter((r) => r.is_late).length,
      absent: all.filter((r) => r.is_absent).length,
    };
  }, [attendanceQuery.data]);

  const columns: DataTableColumn<AttendanceRecord>[] = [
    {
      key: "staff",
      header: "Staff Member",
      render: (r) => (
        <div>
          <p className="text-sm font-bold text-secondary-900">
            {nameMap.get(r.staff_profile_id) ?? `Staff #${r.staff_profile_id}`}
          </p>
          <p className="data-mono text-[10px] text-secondary-400">SP-{r.staff_profile_id}</p>
        </div>
      ),
    },
    {
      key: "work_date",
      header: "Date",
      render: (r) => <span className="text-sm font-medium text-secondary-700">{fmtDate(r.work_date)}</span>,
    },
    {
      key: "clock_in_at",
      header: "Check-in",
      render: (r) => <span className="data-mono text-sm">{fmtTime(r.clock_in_at)}</span>,
    },
    {
      key: "clock_out_at",
      header: "Check-out",
      render: (r) => <span className="data-mono text-sm">{fmtTime(r.clock_out_at)}</span>,
    },
    {
      key: "hours",
      header: "Hours",
      align: "right",
      render: (r) => <span className="data-mono text-sm">{hoursWorked(r)}</span>,
    },
    {
      key: "method",
      header: "Method",
      render: (r) => (
        <span className="text-xs font-bold uppercase tracking-widest text-secondary-400">
          {r.method}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) =>
        r.is_absent ? (
          <Badge variant="soft-danger">Absent</Badge>
        ) : r.is_late ? (
          <Badge variant="soft-warning">Late {r.minutes_late ? `+${r.minutes_late}m` : ""}</Badge>
        ) : (
          <Badge variant="soft-success">On Time</Badge>
        ),
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      <PageHeader
        title="Attendance Log"
        description="Clock-in and clock-out records across the selected date range."
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Records"
          value={stats.total}
          icon={CalendarDays}
          tone="slate"
          isLoading={attendanceQuery.isLoading}
        />
        <MetricCard
          label="Present"
          value={stats.present}
          icon={UserCheck}
          tone="primary"
          isLoading={attendanceQuery.isLoading}
        />
        <MetricCard
          label="Late Arrivals"
          value={stats.late}
          icon={Clock}
          tone="amber"
          isLoading={attendanceQuery.isLoading}
        />
        <MetricCard
          label="Absences"
          value={stats.absent}
          icon={UserX}
          tone="rose"
          isLoading={attendanceQuery.isLoading}
        />
      </div>

      <Card padding="none">
        <div className="flex flex-wrap items-end gap-3 px-6 py-4">
          <SearchInput onSearch={setSearch} placeholder="Search staff…" className="w-64" />
          <Input
            label="From"
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-44 py-2.5"
          />
          <Input
            label="To"
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => setToDate(e.target.value)}
            className="w-44 py-2.5"
          />
        </div>
        <DataTable
          columns={columns}
          data={records}
          rowKey={(r) => r.id}
          isLoading={attendanceQuery.isLoading}
          error={attendanceQuery.isError ? "Could not load attendance records." : null}
          onRetry={() => attendanceQuery.refetch()}
          empty={{
            icon: CalendarDays,
            title: "No attendance records",
            description: "No clock-ins were recorded in this date range.",
          }}
        />
      </Card>
    </div>
  );
}
