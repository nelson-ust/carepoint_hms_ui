import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Banknote,
  BedDouble,
  CalendarCheck,
  Clock,
  CreditCard,
  FlaskConical,
  HeartPulse,
  MessageSquare,
  Package,
  Pill,
  Receipt,
  RotateCcw,
  Stethoscope,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxKpi,
  DxLiveDot,
  DxPage,
  DxPageHeader,
  DxPageLoading,
  DxPanel,
  DxStatusBar,
  DxStatusItem,
  formatNaira,
} from "@/components/dx";
import { useChartTheme } from "@/components/charts/chart-theme";
import { routes } from "@/config/routes";
import { useUnreadPatientMessageCount } from "@/features/portal-messages/hooks/use-portal-messages";
import {
  getDashboardOverview,
  getRecentActivity,
  type TenantActivityEvent,
} from "../api/tenant-dashboard.api";

function activityMeta(event: TenantActivityEvent): { title: string; detail: string; icon: typeof Clock } {
  switch (event.type) {
    case "patient_registered":
      return { title: "Patient registered", detail: event.label || "New patient record created", icon: UserPlus };
    case "visit_started":
      return { title: "Visit started", detail: event.patient_id ? `Patient #${event.patient_id}` : "New encounter opened", icon: Activity };
    case "payment_received":
      return {
        title: "Payment received",
        detail: `${formatNaira(event.amount ?? 0)}${event.method ? ` · ${event.method}` : ""}`,
        icon: Banknote,
      };
    default:
      return { title: event.type.replace(/_/g, " "), detail: event.label || "", icon: Clock };
  }
}

export function TenantOverviewPage() {
  const navigate = useNavigate();
  const chart = useChartTheme();
  const axisTick = { fill: chart.tick.fill, fontSize: chart.tick.fontSize, fontWeight: chart.tick.fontWeight };

  const overviewQuery = useQuery({ queryKey: ["dashboard", "overview"], queryFn: getDashboardOverview });
  const activityQuery = useQuery({ queryKey: ["dashboard", "recent-activity"], queryFn: () => getRecentActivity(10) });
  const { data: unreadMessages = 0, isLoading: messagesLoading } = useUnreadPatientMessageCount();

  if (overviewQuery.isLoading) return <DxPageLoading label="Building facility overview…" />;

  const d = overviewQuery.data?.data;
  const activities = activityQuery.data ?? [];

  const inventoryAlerts =
    (d?.inventory_alerts?.low_stock_count ?? 0) + (d?.inventory_alerts?.expiring_soon_count ?? 0);
  const backlog =
    (d?.lab_pharmacy_backlog?.lab_orders_pending ?? 0) +
    (d?.lab_pharmacy_backlog?.prescriptions_pending ?? 0) +
    (d?.lab_pharmacy_backlog?.dispenses_pending ?? 0);
  const totalBeds = d?.inpatient?.total_beds ?? 0;
  const occupied = d?.inpatient?.occupied_beds ?? 0;
  const utilisation = d?.inpatient?.utilisation_pct ?? 0;

  const todayChartData = d
    ? [
        { name: "New patients", count: d.today.new_patients_today },
        { name: "Visits", count: d.today.visits_today },
        { name: "In progress", count: d.visits.in_progress },
        { name: "Completed", count: d.visits.completed_today },
        { name: "Appointments", count: d.today.appointments_today },
      ]
    : [];

  const backlogData = d
    ? [
        { name: "Lab orders", count: d.lab_pharmacy_backlog.lab_orders_pending },
        { name: "Prescriptions", count: d.lab_pharmacy_backlog.prescriptions_pending },
        { name: "Dispenses", count: d.lab_pharmacy_backlog.dispenses_pending },
      ]
    : [];
  const backlogColors = [chart.series[0], chart.series[2], chart.series[3]];

  const appts = d?.appointments;
  const apptData = appts
    ? [
        { name: "Scheduled", count: appts.scheduled },
        { name: "Completed", count: appts.completed },
        { name: "Cancelled", count: appts.cancelled },
        { name: "No-show", count: appts.no_show },
      ]
    : [];
  const apptColors = [chart.series[0], chart.series[1], chart.series[4], chart.series[3]];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Overview" }, { label: "Dashboard" }]}
        title="Facility Overview"
        subtitle="Operational insight and real-time performance across the facility — patients, visits, beds, billing and backlog."
        actions={
          <>
            <DxButton onClick={() => navigate(routes.reports)}>
              <Receipt /> Reports
            </DxButton>
            <DxButton
              icon
              title="Refresh"
              onClick={() => {
                overviewQuery.refetch();
                activityQuery.refetch();
              }}
              isLoading={overviewQuery.isFetching}
            >
              <RotateCcw />
            </DxButton>
          </>
        }
      />

      <DxStatusBar>
        <DxStatusItem icon={<CalendarCheck className="h-3.5 w-3.5" />}>As of {d?.today?.date ?? "—"}</DxStatusItem>
        <DxStatusItem icon={<Banknote className="h-3.5 w-3.5" />}>Revenue today {formatNaira(d?.today?.revenue_today ?? 0)}</DxStatusItem>
        <DxStatusItem><DxLiveDot label="Live" /></DxStatusItem>
      </DxStatusBar>

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <DxKpi label="Active patients" value={(d?.patients?.total ?? 0).toLocaleString()} icon={Users} tone="accent" sub={`${d?.patients?.new_this_month ?? 0} new this month`} onClick={() => navigate(routes.patients)} />
        <DxKpi label="Visits today" value={(d?.visits?.total_today ?? 0).toLocaleString()} icon={Stethoscope} tone="info" sub={`${d?.visits?.in_progress ?? 0} in progress · ${d?.visits?.completed_today ?? 0} done`} onClick={() => navigate(routes.visits)} />
        <DxKpi label="Collected (MTD)" value={formatNaira(d?.billing?.collected_this_month ?? 0)} icon={CreditCard} tone="success" sub={`${formatNaira(d?.billing?.billed_this_month ?? 0)} billed`} onClick={() => navigate(routes.billing)} />
        <DxKpi label="Outstanding" value={formatNaira(d?.billing?.outstanding_total ?? 0)} icon={Wallet} tone="warning" sub={`${d?.billing?.unpaid_invoice_count ?? 0} unpaid invoices`} onClick={() => navigate(routes.billing)} />
        <DxKpi label="Bed occupancy" value={`${occupied}/${totalBeds}`} icon={BedDouble} tone={utilisation >= 90 ? "danger" : utilisation >= 70 ? "warning" : "success"} sub={`${utilisation}% utilisation`} onClick={() => navigate(routes.beds)} />
        <DxKpi label="Admitted" value={(d?.inpatient?.admitted ?? 0).toLocaleString()} icon={HeartPulse} tone="accent" sub={`${d?.inpatient?.discharged_today ?? 0} discharged today`} onClick={() => navigate(routes.admissions)} />
        <DxKpi label="Care backlog" value={backlog.toLocaleString()} icon={FlaskConical} tone={backlog > 0 ? "warning" : "neutral"} sub="lab · pharmacy pending" />
        <DxKpi label="Inventory alerts" value={inventoryAlerts.toLocaleString()} icon={Package} tone={inventoryAlerts > 0 ? "danger" : "neutral"} sub={`${d?.inventory_alerts?.low_stock_count ?? 0} low · ${d?.inventory_alerts?.expiring_soon_count ?? 0} expiring`} onClick={() => navigate(routes.inventory)} />
      </div>

      {/* Today's operations + activity stream */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DxPanel title="Today's operations" icon={<Activity />} description="Live counts for registrations, visits and appointments today.">
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={todayChartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} dy={6} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                  <Tooltip cursor={chart.cursor} contentStyle={chart.tooltip} />
                  <Bar dataKey="count" name="Count" fill={chart.series[0]} radius={[6, 6, 0, 0]} barSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DxPanel>
        </div>

        <DxPanel
          title="Recent activity"
          icon={<Clock />}
          description="Latest registrations, visits and payments."
          flush
          actions={<DxButton size="sm" onClick={() => navigate(routes.reports)}>View all</DxButton>}
        >
          <div className="max-h-[300px] space-y-1 overflow-y-auto p-2">
            {activities.length === 0 ? (
              <p className="py-10 text-center text-[12.5px] text-[var(--dx-text-muted)]">No recent activity.</p>
            ) : (
              activities.map((a, i) => {
                const { title, detail, icon: Icon } = activityMeta(a);
                return (
                  <div key={`${a.type}-${a.occurred_at}-${i}`} className="flex items-start gap-3 rounded-md px-2.5 py-2 hover:bg-[var(--dx-surface-alt)]">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[13px] font-semibold text-[var(--dx-text)]">{title}</p>
                        <span className="shrink-0 text-[10.5px] text-[var(--dx-text-muted)]">
                          {a.occurred_at ? new Date(a.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                      </div>
                      <p className="truncate text-[11.5px] text-[var(--dx-text-muted)]">{detail}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DxPanel>
      </div>

      {/* Backlog + appointments + bed utilisation */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <DxPanel title="Care backlog" icon={<Pill />} description="Pending lab orders, prescriptions and dispenses.">
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={backlogData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} dy={6} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                <Tooltip cursor={chart.cursor} contentStyle={chart.tooltip} />
                <Bar dataKey="count" name="Pending" radius={[6, 6, 0, 0]} barSize={46}>
                  {backlogData.map((_e, i) => (
                    <Cell key={i} fill={backlogColors[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DxPanel>

        <DxPanel title="Appointments today" icon={<CalendarCheck />} description="Status split for today's appointments.">
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={apptData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} dy={6} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                <Tooltip cursor={chart.cursor} contentStyle={chart.tooltip} />
                <Bar dataKey="count" name="Appointments" radius={[6, 6, 0, 0]} barSize={46}>
                  {apptData.map((_e, i) => (
                    <Cell key={i} fill={apptColors[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DxPanel>

        <DxPanel title="Inpatient & beds" icon={<BedDouble />} description="Ward occupancy at a glance." flush>
          <div className="space-y-3 p-3">
            <div className="rounded-md bg-[var(--dx-surface-sunken)] px-3 py-2.5">
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-[var(--dx-text-muted)]">Bed utilisation</span>
                <span className="dx-mono font-bold text-[var(--dx-text)]">{utilisation}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--dx-border)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, utilisation)}%`,
                    backgroundColor: utilisation >= 90 ? "var(--dx-danger)" : utilisation >= 70 ? "var(--dx-warning)" : "var(--dx-success)",
                  }}
                />
              </div>
              <div className="mt-1.5 text-[11.5px] text-[var(--dx-text-muted)]">{occupied} of {totalBeds} beds occupied</div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[var(--dx-border)] px-3 py-2">
              <span className="inline-flex items-center gap-2 text-[12.5px] text-[var(--dx-text-muted)]"><HeartPulse className="h-3.5 w-3.5" /> Currently admitted</span>
              <span className="text-[13px] font-semibold text-[var(--dx-text)]">{d?.inpatient?.admitted ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[var(--dx-border)] px-3 py-2">
              <span className="inline-flex items-center gap-2 text-[12.5px] text-[var(--dx-text-muted)]"><UserPlus className="h-3.5 w-3.5" /> Discharged today</span>
              <span className="text-[13px] font-semibold text-[var(--dx-text)]">{d?.inpatient?.discharged_today ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[var(--dx-border)] px-3 py-2">
              <span className="inline-flex items-center gap-2 text-[12.5px] text-[var(--dx-text-muted)]"><MessageSquare className="h-3.5 w-3.5" /> Patient messages</span>
              <DxBadge tone={unreadMessages > 0 ? "warning" : "neutral"}>{messagesLoading ? "…" : `${unreadMessages} unread`}</DxBadge>
            </div>
            <DxButton className="w-full justify-center" onClick={() => navigate(routes.beds)}>
              <BedDouble /> Manage beds
            </DxButton>
          </div>
        </DxPanel>
      </div>
    </DxPage>
  );
}
