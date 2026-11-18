import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CalendarX,
  CircleSlash,
  Clock,
  PlayCircle,
  MapPin,
  RotateCcw,
  Search,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";
import {
  DxPage,
  DxPageHeader,
  DxPanel,
  DxKpi,
  DxBadge,
  DxButton,
  DxInput,
  DxSelect,
  DxGrid,
  DxPager,
  type DxGridColumn,
  type DxBadgeTone,
} from "@/components/dx";
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

function statusTone(status: string): DxBadgeTone {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "SCHEDULED":
      return "info";
    case "ARRIVED":
    case "IN_PROGRESS":
      return "warning";
    case "MISSED":
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
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

  const columns: DxGridColumn<Appointment>[] = [
    {
      key: "when",
      header: "Date & time",
      render: (a) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[var(--dx-text)]">
              {fmtDateTime(a.scheduled_start_at).split(" • ")[0]}
            </p>
            <p className="flex items-center gap-1 text-[11px] text-[var(--dx-text-muted)]">
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
      render: (a) => <span className="dx-mono text-[11px] text-[var(--dx-text-muted)]">{a.appointment_code}</span>,
    },
    {
      key: "patient",
      header: "Patient",
      render: (a) => (
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 shrink-0 text-[var(--dx-text-faint)]" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[var(--dx-text)]">
              {a.patient_name || `Patient #${a.patient_id}`}
            </p>
            {a.patient_phone ? (
              <p className="text-[11px] text-[var(--dx-text-muted)]">{a.patient_phone}</p>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: "clinician",
      header: "Clinician",
      render: (a) => (
        <span className="flex items-center gap-1.5 text-[13px] text-[var(--dx-text)]">
          <Stethoscope className="h-3.5 w-3.5 text-[var(--dx-text-faint)]" />
          {a.staff_name || "Unassigned"}
        </span>
      ),
    },
    {
      key: "sdp",
      header: "Service point",
      render: (a) =>
        a.service_delivery_point_name ? (
          <span className="flex items-center gap-1.5 text-[12px] text-[var(--dx-text-muted)]">
            <MapPin className="h-3.5 w-3.5 text-[var(--dx-text-faint)]" />
            {a.service_delivery_point_name}
          </span>
        ) : (
          <span className="text-[12px] text-[var(--dx-text-faint)]">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (a) => <DxBadge tone={statusTone(a.status)} dot>{appointmentStatusLabel(a.status)}</DxBadge>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (a) =>
        a.status === "SCHEDULED" || a.status === "ARRIVED" ? (
          <div className="flex items-center justify-end gap-2">
            <DxButton
              size="sm"
              variant="primary"
              disabled={!canStartVisit(a) || checkInMut.isPending}
              title={
                canStartVisit(a)
                  ? "Check in and start the visit"
                  : "A visit can only be started on the appointment date"
              }
              leftIcon={<PlayCircle className="h-3.5 w-3.5" />}
              onClick={(e) => {
                e.stopPropagation();
                checkInMut.mutate(a.id);
              }}
            >
              Start Visit
            </DxButton>
            <DxButton
              size="sm"
              variant="outline-danger"
              leftIcon={<CircleSlash className="h-3.5 w-3.5" />}
              onClick={(e) => {
                e.stopPropagation();
                const reason = window.prompt("Reason for cancelling? (optional)") ?? undefined;
                // A null return means the user dismissed the prompt — treat as abort.
                if (reason === undefined) return;
                cancelMut.mutate({ id: a.id, reason: reason || undefined });
              }}
            >
              Cancel
            </DxButton>
          </div>
        ) : null,
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Scheduling" }, { label: "Appointments" }]}
        title="Scheduled Appointments"
        subtitle="Browse every appointment booked across the hospital, with optional filters."
        actions={
          <>
            <DxButton
              onClick={() => query.refetch()}
              isLoading={query.isFetching}
              leftIcon={<RotateCcw className="h-4 w-4" />}
            >
              Refresh
            </DxButton>
            <DxButton
              variant="primary"
              onClick={() => setShowBook(true)}
              leftIcon={<CalendarPlus className="h-4 w-4" />}
            >
              Book appointment
            </DxButton>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <DxKpi label="Total (all filters)" value={total} icon={CalendarCheck} tone="accent" isLoading={query.isLoading} />
        <DxKpi label="Scheduled (page)" value={counts.scheduled} icon={CalendarClock} tone="info" isLoading={query.isLoading} />
        <DxKpi label="Cancelled / Missed (page)" value={counts.cancelledOrMissed} icon={CalendarX} tone="danger" isLoading={query.isLoading} />
      </div>

      {/* Filters */}
      <DxPanel>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <DxSelect
            label="Status"
            value={status}
            onChange={(e) => changeFilter(() => setStatus(e.target.value))}
            options={APPOINTMENT_STATUS_OPTIONS}
          />
          <DxInput
            label="From date"
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => changeFilter(() => setFromDate(e.target.value))}
          />
          <DxInput
            label="To date"
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => changeFilter(() => setToDate(e.target.value))}
          />
          <DxInput
            label="Search (this page)"
            leftIcon={<Search className="h-3.5 w-3.5" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Patient, clinician, ref…"
          />
        </div>
        {anyFilter ? (
          <div className="mt-4 flex justify-end">
            <DxButton variant="text" size="sm" onClick={resetFilters} leftIcon={<X className="h-4 w-4" />}>
              Clear filters
            </DxButton>
          </div>
        ) : null}
      </DxPanel>

      <DxPanel flush>
        <DxGrid
          columns={columns}
          data={rows}
          rowKey={(a) => a.id}
          isLoading={query.isLoading}
          error={query.error ? apiErrorMessage(query.error, "Unable to load appointments.") : null}
          onRetry={() => query.refetch()}
          borderless
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
          <DxPager
            page={page + 1}
            totalPages={totalPages}
            totalItems={total}
            pageSize={PAGE_SIZE}
            onPageChange={(p) => setPage(p - 1)}
          />
        ) : null}
      </DxPanel>

      <BookAppointmentModal
        isOpen={showBook}
        onClose={() => setShowBook(false)}
        onBooked={() => {
          setPage(0);
          query.refetch();
        }}
      />
    </DxPage>
  );
}
