import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Bell,
  CalendarClock,
  CalendarPlus,
  ChevronRight,
  Clock,
  CreditCard,
  FlaskConical,
  MapPin,
  MessageSquare,
  Stethoscope,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MetricCard } from "@/components/charts/MetricCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDisclosure } from "@/hooks/useDisclosure";
import { formatNaira, getStoredPortalSession } from "../api/portal.api";
import type { PortalCardTransaction } from "../api/portal.api";
import { usePortalAppointments, usePortalDashboard } from "../hooks/use-portal";
import { FundCardModal } from "../components/FundCardModal";
import { AppointmentRequestModal } from "../components/AppointmentRequestModal";
import { MessageHospitalModal } from "../components/MessageHospitalModal";

function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
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

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function relativeTo(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const mins = Math.round((d.getTime() - Date.now()) / 60000);
  if (mins <= 0) return "Now";
  if (mins < 60) return `In ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `In ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Tomorrow";
  if (days < 14) return `In ${days} days`;
  return `In ${Math.round(days / 7)} weeks`;
}

function isCredit(tx: PortalCardTransaction): boolean {
  return ["FUND", "CREDIT", "TOPUP", "TOP_UP", "REFUND"].includes(
    tx.transaction_type?.toUpperCase() ?? "",
  );
}

export function PortalDashboardPage() {
  const { data, isLoading, isError, refetch } = usePortalDashboard();
  const { data: appointments } = usePortalAppointments();
  const nextAppointment = appointments?.next_appointment ?? null;
  const session = getStoredPortalSession();

  const fundCard = useDisclosure();
  const appointment = useDisclosure();
  const message = useDisclosure();

  const firstName = useMemo(() => {
    if (data?.patient?.first_name) return data.patient.first_name;
    return session?.full_name?.split(" ")[0] ?? "there";
  }, [data, session]);

  const cardStatusVariant =
    data?.card?.status?.toUpperCase() === "ACTIVE" ? "soft-success" : "soft-warning";

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        eyebrow="Patient portal"
        title={`${greetingForNow()}, ${firstName}`}
        description={
          session?.hospital_number
            ? `Hospital number ${session.hospital_number} — here's a snapshot of your care.`
            : "Here's a snapshot of your care."
        }
        actions={
          <Button
            leftIcon={<CalendarPlus className="h-4 w-4" />}
            onClick={appointment.open}
          >
            Request Appointment
          </Button>
        }
      />

      {isError ? (
        <Card>
          <EmptyState
            icon={Bell}
            title="We couldn't load your dashboard"
            description="Please check your connection and try again."
            action={<Button onClick={() => refetch()}>Retry</Button>}
          />
        </Card>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Card Balance"
              value={formatNaira(data?.wallet_balance)}
              icon={Wallet}
              tone="primary"
              isLoading={isLoading}
            />
            <MetricCard
              label="Unread Notifications"
              value={data?.unread_notifications_count ?? 0}
              icon={Bell}
              tone="amber"
              isLoading={isLoading}
            />
            <MetricCard
              label="Recent Lab Results"
              value={data?.recent_lab_results?.length ?? 0}
              icon={FlaskConical}
              tone="cyan"
              isLoading={isLoading}
            />
            <MetricCard
              label="Membership Card"
              value={data?.card ? data.card.status : "None"}
              icon={CreditCard}
              tone="violet"
              isLoading={isLoading}
            />
          </div>

          {/* Next appointment — emphasised, links to full history */}
          {nextAppointment ? (
            <Link
              to="/portal/appointments"
              className="group relative block overflow-hidden rounded-3xl border border-primary-500/20 bg-gradient-to-br from-primary-600 to-primary-800 p-6 text-white shadow-xl shadow-primary-900/20 transition-transform hover:-translate-y-0.5"
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              <div className="relative flex items-center gap-5">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                  <CalendarClock className="h-7 w-7" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-white/70">
                    <Clock className="h-3.5 w-3.5" /> Your next appointment
                  </div>
                  <p className="mt-1 truncate text-xl font-black">
                    {formatDateTime(nextAppointment.scheduled_start_at)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-white/80">
                    {nextAppointment.staff_name ? (
                      <span className="inline-flex items-center gap-1">
                        <Stethoscope className="h-3.5 w-3.5" /> {nextAppointment.staff_name}
                      </span>
                    ) : null}
                    {nextAppointment.service_delivery_point_name ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />{" "}
                        {nextAppointment.service_delivery_point_name}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="hidden shrink-0 items-center gap-2 sm:flex">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black backdrop-blur">
                    {relativeTo(nextAppointment.scheduled_start_at)}
                  </span>
                  <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          ) : null}

          {/* Notifications & reminders */}
          <Card>
            <CardHeader
              title="Notifications & reminders"
              description="Appointment reminders and messages from your hospital."
              actions={
                <Link
                  to="/portal/notifications"
                  className="text-xs font-bold uppercase tracking-widest text-primary-600 transition-colors hover:text-primary-700 dark:text-primary-300"
                >
                  View all
                </Link>
              }
            />
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : data?.recent_notifications?.length ? (
              <ul className="divide-y divide-secondary-100 dark:divide-white/5">
                {data.recent_notifications.map((n) => (
                  <li key={n.id} className="flex items-start gap-4 py-3.5">
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                      <Bell className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-secondary-900">
                        {n.subject || "Notification"}
                      </p>
                      <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs font-medium text-secondary-500">
                        {n.body}
                      </p>
                      <p className="mt-1 text-[11px] text-secondary-400">
                        {formatDateTime(n.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Bell}
                title="No new notifications"
                description="Appointment reminders and hospital messages will appear here."
              />
            )}
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader
              title="Quick actions"
              description="Common things you can do from home."
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Button
                variant="secondary"
                className="w-full justify-center"
                leftIcon={<CalendarPlus className="h-4 w-4" />}
                onClick={appointment.open}
              >
                Request Appointment
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-center"
                leftIcon={<Wallet className="h-4 w-4" />}
                onClick={fundCard.open}
              >
                Fund Card
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-center"
                leftIcon={<MessageSquare className="h-4 w-4" />}
                onClick={message.open}
              >
                Message Hospital
              </Button>
            </div>
          </Card>

          {/* Recent activity */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Recent card activity"
                description="Latest transactions on your membership card."
              />
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : data?.recent_transactions?.length ? (
                <ul className="divide-y divide-secondary-100 dark:divide-white/5">
                  {data.recent_transactions.map((tx) => {
                    const credit = isCredit(tx);
                    return (
                      <li key={tx.id} className="flex items-center gap-4 py-3.5">
                        <span
                          className={
                            credit
                              ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500"
                              : "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500"
                          }
                        >
                          {credit ? (
                            <ArrowUpCircle className="h-5 w-5" aria-hidden />
                          ) : (
                            <ArrowDownCircle className="h-5 w-5" aria-hidden />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-secondary-900">
                            {tx.narration || tx.transaction_type}
                          </p>
                          <p className="text-xs text-secondary-400">
                            {formatDate(tx.transaction_date)}
                            {tx.payment_source ? ` • ${tx.payment_source}` : ""}
                          </p>
                        </div>
                        <p
                          className={
                            credit
                              ? "data-mono text-sm font-bold text-emerald-500"
                              : "data-mono text-sm font-bold text-rose-500"
                          }
                        >
                          {credit ? "+" : "-"}
                          {formatNaira(tx.amount)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState
                  icon={Wallet}
                  title="No card activity yet"
                  description="Fund your membership card to start using it for visits."
                  action={
                    <Button size="sm" onClick={fundCard.open}>
                      Fund Card
                    </Button>
                  }
                />
              )}
            </Card>

            <Card>
              <CardHeader
                title="Recent lab results"
                description="Results released to you by the laboratory."
              />
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : data?.recent_lab_results?.length ? (
                <ul className="divide-y divide-secondary-100 dark:divide-white/5">
                  {data.recent_lab_results.map((result) => (
                    <li key={result.id} className="flex items-center gap-4 py-3.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-500">
                        <FlaskConical className="h-5 w-5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-secondary-900">
                          {result.result_value ||
                            result.result_text ||
                            `Result #${result.id}`}
                          {result.unit_of_measure ? ` ${result.unit_of_measure}` : ""}
                        </p>
                        <p className="text-xs text-secondary-400">
                          {formatDate(result.released_at ?? result.created_at)}
                          {result.reference_range
                            ? ` • Ref: ${result.reference_range}`
                            : ""}
                        </p>
                      </div>
                      <Badge
                        variant={
                          result.result_status?.toUpperCase() === "RELEASED"
                            ? "soft-success"
                            : "soft-info"
                        }
                      >
                        {result.result_status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={FlaskConical}
                  title="No lab results yet"
                  description="Released results from the laboratory will show up here."
                />
              )}
            </Card>
          </div>

          {/* Membership card summary */}
          {data?.card ? (
            <Card>
              <CardHeader
                title="My membership card"
                actions={<Badge variant={cardStatusVariant}>{data.card.status}</Badge>}
              />
              <div className="grid gap-6 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">
                    Card number
                  </p>
                  <p className="data-mono mt-1 text-sm font-bold text-secondary-900">
                    {data.card.card_number}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">
                    Balance
                  </p>
                  <p className="data-mono mt-1 text-sm font-bold text-secondary-900">
                    {formatNaira(data.card.balance)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">
                    Expires
                  </p>
                  <p className="mt-1 text-sm font-bold text-secondary-900">
                    {formatDate(data.card.expiry_date)}
                  </p>
                </div>
              </div>
            </Card>
          ) : null}
        </>
      )}

      {/* Modals */}
      <FundCardModal
        isOpen={fundCard.isOpen}
        onClose={fundCard.close}
        card={data?.card}
      />
      <AppointmentRequestModal isOpen={appointment.isOpen} onClose={appointment.close} />
      <MessageHospitalModal isOpen={message.isOpen} onClose={message.close} />
    </div>
  );
}
