import { useMemo } from "react";
import {
  BellRing,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  Clock,
  History,
  MapPin,
  Stethoscope,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDisclosure } from "@/hooks/useDisclosure";
import type { PortalAppointment } from "../api/portal.api";
import { usePortalAppointments } from "../hooks/use-portal";
import { AppointmentRequestModal } from "../components/AppointmentRequestModal";

// ---- formatting helpers ------------------------------------------------

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Human "in 3 days" / "in 2 hours" / "today" countdown for the current one. */
function relativeTo(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = d.getTime() - Date.now();
  const mins = Math.round(diffMs / 60000);
  if (mins <= 0) return "Now";
  if (mins < 60) return `In ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `In ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Tomorrow";
  if (days < 14) return `In ${days} days`;
  const weeks = Math.round(days / 7);
  return `In ${weeks} week${weeks === 1 ? "" : "s"}`;
}

function statusBadge(status: string) {
  switch (status?.toUpperCase()) {
    case "SCHEDULED":
      return { variant: "soft-info" as const, label: "Scheduled" };
    case "ARRIVED":
      return { variant: "soft-info" as const, label: "Arrived" };
    case "IN_PROGRESS":
      return { variant: "soft-warning" as const, label: "In progress" };
    case "COMPLETED":
      return { variant: "soft-success" as const, label: "Completed" };
    case "CANCELLED":
      return { variant: "soft-danger" as const, label: "Cancelled" };
    case "MISSED":
      return { variant: "soft-danger" as const, label: "Missed" };
    case "RESCHEDULED":
      return { variant: "soft-warning" as const, label: "Rescheduled" };
    default:
      return { variant: "secondary" as const, label: status || "—" };
  }
}

// ---- row for upcoming / past lists -------------------------------------

function AppointmentRow({ appt }: { appt: PortalAppointment }) {
  const badge = statusBadge(appt.status);
  return (
    <li className="flex items-start gap-4 py-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-300">
        <CalendarClock className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-bold text-secondary-900 dark:text-white">
            {formatDate(appt.scheduled_start_at)}
          </p>
          <span className="text-xs text-secondary-400">{formatTime(appt.scheduled_start_at)}</span>
          <Badge variant={badge.variant} className="ml-auto sm:ml-0">
            {badge.label}
          </Badge>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-secondary-500 dark:text-secondary-300">
          {appt.staff_name ? (
            <span className="inline-flex items-center gap-1">
              <Stethoscope className="h-3.5 w-3.5" /> {appt.staff_name}
            </span>
          ) : null}
          {appt.service_delivery_point_name ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {appt.service_delivery_point_name}
            </span>
          ) : null}
          <span className="data-mono text-[11px] text-secondary-400">{appt.appointment_code}</span>
        </div>
        {appt.reason ? (
          <p className="mt-1 line-clamp-2 text-xs text-secondary-500 dark:text-secondary-400">
            {appt.reason}
          </p>
        ) : null}
      </div>
    </li>
  );
}

// ---- page --------------------------------------------------------------

export function PortalAppointmentsPage() {
  const { data, isLoading, isError, refetch } = usePortalAppointments();
  const appointment = useDisclosure();

  const current = data?.next_appointment ?? null;
  // The rest of the upcoming schedule, after the emphasised current one.
  const laterUpcoming = useMemo(
    () => (data?.upcoming ?? []).filter((a) => a.id !== current?.id),
    [data, current],
  );
  const past = data?.past ?? [];
  const currentBadge = current ? statusBadge(current.status) : null;

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        eyebrow="Patient portal"
        title="My appointments"
        description="Every appointment you've scheduled, with your next visit up top."
        actions={
          <Button leftIcon={<CalendarPlus className="h-4 w-4" />} onClick={appointment.open}>
            Request Appointment
          </Button>
        }
      />

      {isError ? (
        <Card>
          <EmptyState
            icon={CalendarX2}
            title="We couldn't load your appointments"
            description="Please check your connection and try again."
            action={<Button onClick={() => refetch()}>Retry</Button>}
          />
        </Card>
      ) : isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-44 w-full rounded-3xl" />
          <Skeleton className="h-40 w-full rounded-3xl" />
        </div>
      ) : (
        <>
          {/* Current (next) appointment — emphasised hero */}
          {current ? (
            <div className="relative overflow-hidden rounded-3xl border border-primary-500/20 bg-gradient-to-br from-primary-600 to-primary-800 p-6 text-white shadow-xl shadow-primary-900/20 sm:p-8">
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-white/70">
                    <Clock className="h-3.5 w-3.5" /> Your next appointment
                  </div>
                  <p className="mt-2 text-2xl font-black leading-tight sm:text-3xl">
                    {formatDateTime(current.scheduled_start_at)}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/80">
                    {current.staff_name ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Stethoscope className="h-4 w-4" /> {current.staff_name}
                      </span>
                    ) : null}
                    {current.service_delivery_point_name ? (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" /> {current.service_delivery_point_name}
                      </span>
                    ) : null}
                    <span className="data-mono text-xs text-white/60">
                      {current.appointment_code}
                    </span>
                  </div>
                  {current.reason ? (
                    <p className="mt-3 max-w-xl text-sm text-white/80">{current.reason}</p>
                  ) : null}
                  <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur">
                    <BellRing className="h-3.5 w-3.5" />
                    We'll remind you a day before and 3 hours before.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
                  <span className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-black backdrop-blur">
                    {relativeTo(current.scheduled_start_at)}
                  </span>
                  {currentBadge ? (
                    <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-black uppercase tracking-wide text-primary-700">
                      {currentBadge.label}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <Card>
              <EmptyState
                icon={CalendarClock}
                title="No upcoming appointment"
                description="You don't have a scheduled visit right now. Request one and it'll appear here."
                action={
                  <Button
                    leftIcon={<CalendarPlus className="h-4 w-4" />}
                    onClick={appointment.open}
                  >
                    Request Appointment
                  </Button>
                }
              />
            </Card>
          )}

          {/* More upcoming */}
          {laterUpcoming.length > 0 ? (
            <Card>
              <CardHeader
                title="Upcoming"
                description={`${laterUpcoming.length} more scheduled visit${
                  laterUpcoming.length === 1 ? "" : "s"
                }.`}
              />
              <ul className="divide-y divide-secondary-100 dark:divide-white/5">
                {laterUpcoming.map((a) => (
                  <AppointmentRow key={a.id} appt={a} />
                ))}
              </ul>
            </Card>
          ) : null}

          {/* Past history */}
          <Card>
            <CardHeader
              title="History"
              description="Past and closed appointments."
              actions={
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-secondary-400">
                  <History className="h-4 w-4" /> {past.length}
                </span>
              }
            />
            {past.length > 0 ? (
              <ul className="divide-y divide-secondary-100 dark:divide-white/5">
                {past.map((a) => (
                  <AppointmentRow key={a.id} appt={a} />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={History}
                title="No past appointments"
                description="Once a visit is completed or elapses, it'll be listed here."
              />
            )}
          </Card>
        </>
      )}

      <AppointmentRequestModal isOpen={appointment.isOpen} onClose={appointment.close} />
    </div>
  );
}
