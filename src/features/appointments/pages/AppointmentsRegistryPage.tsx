import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CalendarX,
  ChevronLeft,
  ChevronRight,
  CircleSlash,
  Clock,
  PlayCircle,
  MapPin,
  RefreshCw,
  Search,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { MetricCard } from "@/components/charts/MetricCard";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import {
  appointmentsApi,
  APPOINTMENT_STATUS_OPTIONS,
  appointmentStatusLabel,
  canStartVisit,
  type Appointment,
} from "../api/appointments.api";
import { routes } from "@/config/routes";
import { BookAppointmentModal } from "../components/BookAppointmentModal";

const PAGE_SIZE = 25;

function fmtDateTime(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return isValid(d) ? format(d, "MMM d, yyyy • h:mm a") : "—";
}

function fmtTimeRange(start?: string | null, end?: string | null): string {
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;
  if (!s || !isValid(s)) return "—";
  const startStr = format(s, "h:mm a");
  if (e && isValid(e)) return `${startStr} – ${format(e, "h:mm a")}`;
  return startStr;
}

function statusVariant(
  status: string,
): "soft-success" | "soft-warning" | "soft-danger" | "soft-info" | "secondary" {
  switch (status) {
    case "COMPLETED":
      return "soft-success";
    case "SCHEDULED":
      return "soft-info";
    case "ARRIVED":
    case "IN_PROGRESS":
      return "soft-warning";
    case "MISSED":
    case "CANCELLED":
      return "soft-danger";
    default:
      return "secondary";
  }
}

/** toDt is treated as an EXCLUSIVE upper bound by the API, so add a day to
 *  include appointments that fall on the selected end date. */
function endOfDayExclusive(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

export function AppointmentsRegistryPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Applied filters (what the query actually uses).
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [showBook, setShowBook] = useState(false);

  const skip = page * PAGE_SIZE;

  const query = useQuery({
    queryKey: ["appointments", "list", status, fromDate, toDate, skip],
    queryFn: () =>
      appointmentsApi.list({
        skip,
        limit: PAGE_SIZE,
        status: status || undefined,
        from_dt: fromDate ? new Date(`${fromDate}T00:00:00`).toISOString() : undefined,
        to_dt: toDate ? endOfDayExclusive(toDate) : undefined,
      }),
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Client-side text search over the current page (patient, clinician, code, SDP).
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (a) =>
        (a.patient_name || "").toLowerCase().includes(q) ||
        (a.staff_name || "").toLowerCase().includes(q) ||
        (a.appointment_code || "").toLowerCase().includes(q) ||
        (a.service_delivery_point_name || "").toLowerCase().includes(q) ||
        (a.patient_phone || "").toLowerCase().includes(q),
    );
  }, [items, search]);

  const counts = useMemo(() => {
    const scheduled = items.filter((a) => a.status === "SCHEDULED").length;
    const completed = items.filter((a) => a.status === "COMPLETED").length;
    const cancelledOrMissed = items.filter(
      (a) => a.status === "CANCELLED" || a.status === "MISSED",
    ).length;
    return { scheduled, completed, cancelledOrMissed };
  }, [items]);

  const cancelMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      appointmentsApi.cancel(id, reason),
    onSuccess: () => {
      toast.success("Appointment cancelled", "The booking has been cancelled.");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (err) => toast.error("Couldn't cancel", apiErrorMessage(err, "Please try again.")),
  });

  const checkInMut = useMutation({
    mutationFn: (id: number) => appointmentsApi.checkIn(id, { initiate_visit: true }),
    onSuccess: (res) => {
      toast.success(
        "Visit started",
        res.visit_code
          ? `Visit ${res.visit_code} initiated from the appointment.`
          : "The patient has been checked in.",
      );
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      if (res.visit_id) {
        navigate(routes.visitDetail.replace(":visitId", String(res.visit_id)));
      }
    },
    onError: (err) =>
      toast.error("Couldn't start visit", apiErrorMessage(err, "Please try again.")),
  });

  const anyFilter = !!(status || fromDate || toDate || search);
  const resetFilters = () => {
    setStatus("");
    setFromDate("");
    setToDate("");
    setSearch("");
    setPage(0);
  };

  const changeFilter = (fn: () => void) => {
    fn();
    setPage(0);
  };

  const columns: DataTableColumn<Appointment>[] = [
    {
      key: "when",
      header: "Date & time",
      render: (a) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10 text-primary-500">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-bold text-secondary-900">
              {fmtDateTime(a.scheduled_start_at).split(" • ")[0]}
            </p>
            <p className="flex items-center gap-1 text-[11px] text-secondary-400">
              <Clock className="h-3 w-3" />
              {fmtTimeRange(a.scheduled_start_at, a.scheduled_end_at)}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "code",
      header: "Ref",
      render: (a) => <span className="data-mono text-[11px] text-secondary-500">{a.appointment_code}</span>,
    },
    {
      key: "patient",
      header: "Patient",
      render: (a) => (
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 shrink-0 text-secondary-400" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-secondary-900">
              {a.patient_name || `Patient #${a.patient_id}`}
            </p>
            {a.patient_phone ? (
              <p className="text-[11px] text-secondary-400">{a.patient_phone}</p>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: "clinician",
      header: "Clinician",
      render: (a) => (
        <span className="flex items-center gap-1.5 text-sm text-secondary-700">
          <Stethoscope className="h-3.5 w-3.5 text-secondary-400" />
          {a.staff_name || "Unassigned"}
        </span>
      ),
    },
    {
      key: "sdp",
      header: "Service point",
      render: (a) =>
        a.service_delivery_point_name ? (
          <span className="flex items-center gap-1.5 text-xs text-secondary-600">
            <MapPin className="h-3.5 w-3.5 text-secondary-400" />
            {a.service_delivery_point_name}
          </span>
        ) : (
          <span className="text-xs text-secondary-400">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (a) => <Badge variant={statusVariant(a.status)}>{appointmentStatusLabel(a.status)}</Badge>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (a) =>
        a.status === "SCHEDULED" || a.status === "ARRIVED" ? (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={!canStartVisit(a) || checkInMut.isPending}
              title={
                canStartVisit(a)
                  ? "Check in and start the visit"
                  : "A visit can only be started on the appointment date"
              }
              onClick={(e) => {
                e.stopPropagation();
                checkInMut.mutate(a.id);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PlayCircle className="h-3.5 w-3.5" /> Start Visit
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const reason = window.prompt("Reason for cancelling? (optional)") ?? undefined;
                // A null return means the user dismissed the prompt — treat as abort.
                if (reason === undefined) return;
                cancelMut.mutate({ id: a.id, reason: reason || undefined });
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-100"
            >
              <CircleSlash className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <PageHeader
        title="Scheduled Appointments"
        description="Browse every appointment booked across the hospital, with optional filters."
        actions={
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={() => query.refetch()}
              leftIcon={<RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />}
            >
              Refresh
            </Button>
            <Button onClick={() => setShowBook(true)} leftIcon={<CalendarPlus className="h-4 w-4" />}>
              Book Appointment
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 sm:grid-cols-3">
        <MetricCard label="Total (all filters)" value={total} icon={CalendarCheck} tone="primary" isLoading={query.isLoading} />
        <MetricCard label="Scheduled (page)" value={counts.scheduled} icon={CalendarClock} tone="cyan" isLoading={query.isLoading} />
        <MetricCard label="Cancelled / Missed (page)" value={counts.cancelledOrMissed} icon={CalendarX} tone="rose" isLoading={query.isLoading} />
      </div>

      {/* Filters */}
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Status"
            value={status}
            onChange={(e) => changeFilter(() => setStatus(e.target.value))}
            options={APPOINTMENT_STATUS_OPTIONS}
          />
          <Input
            label="From date"
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => changeFilter(() => setFromDate(e.target.value))}
          />
          <Input
            label="To date"
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => changeFilter(() => setToDate(e.target.value))}
          />
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-secondary-500">
              Search (this page)
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Patient, clinician, ref…"
                className="w-full rounded-xl border border-secondary-300 bg-white/70 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary-500 dark:bg-white/5"
              />
            </div>
          </div>
        </div>
        {anyFilter ? (
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" size="sm" onClick={resetFilters} leftIcon={<X className="h-4 w-4" />}>
              Clear filters
            </Button>
          </div>
        ) : null}
      </Card>

      <Card padding="none">
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(a) => a.id}
          isLoading={query.isLoading}
          error={query.error ? apiErrorMessage(query.error, "Unable to load appointments.") : null}
          onRetry={() => query.refetch()}
          empty={{
            icon: CalendarClock,
            title: anyFilter ? "No matching appointments" : "No appointments yet",
            description: anyFilter
              ? "Try widening the date range or changing the status filter."
              : "Booked appointments will appear here.",
          }}
        />

        {/* Pagination */}
        {total > PAGE_SIZE ? (
          <div className="flex items-center justify-between border-t border-secondary-200 px-6 py-4 dark:border-white/10">
            <p className="text-xs font-medium text-secondary-500">
              Page {page + 1} of {totalPages} · {total} total
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page === 0 || query.isFetching}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                leftIcon={<ChevronLeft className="h-4 w-4" />}
              >
                Prev
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page + 1 >= totalPages || query.isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <BookAppointmentModal
        isOpen={showBook}
        onClose={() => setShowBook(false)}
        onBooked={() => {
          setPage(0);
          query.refetch();
        }}
      />
    </div>
  );
}
