import { useMemo, useState } from "react";
import { CalendarDays, Clock, Search, UserCheck, UserX } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxGrid, DxKpi, DxBadge, DxInput,
  type DxGridColumn,
} from "@/components/dx";
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

  const columns: DxGridColumn<AttendanceRecord>[] = [
    {
      key: "staff",
      header: "Staff Member",
      render: (r) => (
        <div>
          <p className="text-[13px] font-semibold text-[var(--dx-text)]">{nameMap.get(r.staff_profile_id) ?? `Staff #${r.staff_profile_id}`}</p>
          <p className="dx-mono text-[10px] text-[var(--dx-text-muted)]">SP-{r.staff_profile_id}</p>
        </div>
      ),
    },
    { key: "work_date", header: "Date", render: (r) => <span className="text-[13px] font-medium text-[var(--dx-text)]">{fmtDate(r.work_date)}</span> },
    { key: "clock_in_at", header: "Check-in", render: (r) => <span className="dx-mono text-[13px]">{fmtTime(r.clock_in_at)}</span> },
    { key: "clock_out_at", header: "Check-out", render: (r) => <span className="dx-mono text-[13px]">{fmtTime(r.clock_out_at)}</span> },
    { key: "hours", header: "Hours", align: "right", render: (r) => <span className="dx-mono text-[13px]">{hoursWorked(r)}</span> },
    { key: "method", header: "Method", render: (r) => <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">{r.method}</span> },
    {
      key: "status", header: "Status",
      render: (r) =>
        r.is_absent ? <DxBadge tone="danger">Absent</DxBadge>
          : r.is_late ? <DxBadge tone="warning">Late {r.minutes_late ? `+${r.minutes_late}m` : ""}</DxBadge>
            : <DxBadge tone="success">On Time</DxBadge>,
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "HR" }, { label: "Attendance" }]}
        title="Attendance Log"
        subtitle="Clock-in and clock-out records across the selected date range."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DxKpi label="Records" value={stats.total} icon={CalendarDays} tone="neutral" isLoading={attendanceQuery.isLoading} />
        <DxKpi label="Present" value={stats.present} icon={UserCheck} tone="accent" isLoading={attendanceQuery.isLoading} />
        <DxKpi label="Late Arrivals" value={stats.late} icon={Clock} tone="warning" isLoading={attendanceQuery.isLoading} />
        <DxKpi label="Absences" value={stats.absent} icon={UserX} tone="danger" isLoading={attendanceQuery.isLoading} />
      </div>

      <DxPanel title="Attendance" icon={<CalendarDays className="h-4 w-4" />} flush>
        <div className="flex flex-wrap items-end gap-3 border-b border-[var(--dx-border)] px-4 py-3">
          <div className="w-64">
            <DxInput leftIcon={<Search className="h-3.5 w-3.5" />} placeholder="Search staff…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-44">
            <DxInput label="From" type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} editorSize="sm" />
          </div>
          <div className="w-44">
            <DxInput label="To" type="date" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} editorSize="sm" />
          </div>
        </div>
        <DxGrid<AttendanceRecord>
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
      </DxPanel>
    </DxPage>
  );
}
