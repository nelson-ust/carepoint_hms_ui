import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { MetricCard, type MetricTone } from "@/components/charts/MetricCard";
import { useChartTheme } from "@/components/charts/chart-theme";
import { routes } from "@/config/routes";
import { useUnreadPatientMessageCount } from "@/features/portal-messages/hooks/use-portal-messages";
import {
  Users,
  CreditCard,
  Package,
  Clock,
  Stethoscope,
  UserPlus,
  Activity,
  Banknote,
  MessageSquare,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useState, useEffect } from "react";
import {
  getDashboardOverview,
  getRecentActivity,
  type TenantOverviewData,
  type TenantActivityEvent,
} from "../api/tenant-dashboard.api";

function activityLabel(event: TenantActivityEvent): { title: string; detail: string } {
  switch (event.type) {
    case "patient_registered":
      return { title: "Patient registered", detail: event.label || "New patient record created" };
    case "visit_started":
      return { title: "Visit started", detail: event.patient_id ? `Patient #${event.patient_id}` : "New encounter opened" };
    case "payment_received":
      return {
        title: "Payment received",
        detail: `₦${(event.amount ?? 0).toLocaleString()}${event.method ? ` • ${event.method}` : ""}`,
      };
    default:
      return { title: event.type.replace(/_/g, " "), detail: event.label || "" };
  }
}

export function TenantOverviewPage() {
  const [overview, setOverview] = useState<TenantOverviewData | null>(null);
  const [activities, setActivities] = useState<TenantActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const chart = useChartTheme();
  const { data: unreadMessages = 0, isLoading: messagesLoading } =
    useUnreadPatientMessageCount();

  useEffect(() => {
    async function loadMetrics() {
      try {
        const [overviewResponse, activityEvents] = await Promise.all([
          getDashboardOverview(),
          getRecentActivity(10).catch(() => [] as TenantActivityEvent[]),
        ]);
        if (overviewResponse.success) {
          setOverview(overviewResponse.data);
        }
        setActivities(activityEvents);
      } catch (err) {
        console.error("Failed to load dashboard metrics", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadMetrics();
  }, []);

  const inventoryAlerts =
    (overview?.inventory_alerts?.low_stock_count ?? 0) +
    (overview?.inventory_alerts?.expiring_soon_count ?? 0);

  const stats: {
    label: string;
    value: string;
    icon: typeof Users;
    tone: MetricTone;
  }[] = [
    { label: "Active Patients", value: (overview?.patients?.total ?? 0).toLocaleString(), icon: Users, tone: "primary" },
    { label: "Visits Today", value: (overview?.visits?.total_today ?? 0).toString(), icon: Stethoscope, tone: "cyan" },
    { label: "Collected (MTD)", value: `₦${(overview?.billing?.collected_this_month ?? 0).toLocaleString()}`, icon: CreditCard, tone: "primary" },
    { label: "Inventory Alerts", value: inventoryAlerts.toString(), icon: Package, tone: "rose" },
  ];

  const todayChartData = overview
    ? [
        { name: "New Patients", count: overview.today.new_patients_today },
        { name: "Visits", count: overview.today.visits_today },
        { name: "In Progress", count: overview.visits.in_progress },
        { name: "Completed", count: overview.visits.completed_today },
        { name: "Appointments", count: overview.today.appointments_today },
      ]
    : [];

  return (
    <section className="space-y-10 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Facility Intelligence"
          description="Operational insights and real-time performance tracking for your healthcare facility."
        />
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <MetricCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            tone={stat.tone}
            isLoading={isLoading}
          />
        ))}
        <Link
          to={routes.patientMessages}
          className="rounded-3xl transition-transform hover:-translate-y-0.5"
          title="View patient messages"
        >
          <MetricCard
            label="Patient Messages"
            value={unreadMessages.toLocaleString()}
            icon={MessageSquare}
            tone="amber"
            isLoading={messagesLoading}
          />
        </Link>
      </div>

      {/* Charts & Activity Section */}
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-8">
          <div className="glass-card rounded-[2rem] p-8 md:p-10">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-xl font-bold">Today's Operations</h3>
                <p className="text-sm text-secondary-500">Live counts for registrations, visits and appointments today</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: chart.series[0] }} />
                <span className="text-xs font-bold text-secondary-600">Count</span>
              </div>
            </div>
            <div className="h-[350px] w-full">
              {isLoading ? (
                <div className="h-full w-full rounded-2xl bg-secondary-100/30 animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={todayChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={chart.tick}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={chart.tick}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={chart.cursor}
                      contentStyle={chart.tooltip}
                    />
                    <Bar
                      dataKey="count"
                      fill={chart.series[0]}
                      radius={[8, 8, 0, 0]}
                      barSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="glass-card rounded-[2rem] p-8 md:p-10 flex flex-col h-full">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold">Recent Stream</h3>
            </div>
            <div className="space-y-6 flex-1 overflow-y-auto pr-2 scrollbar-hide">
              {activities.length === 0 && !isLoading ? (
                <p className="text-sm font-medium text-secondary-400">No recent activity.</p>
              ) : (
                activities.map((activity, index) => {
                  const { title, detail } = activityLabel(activity);
                  const Icon =
                    activity.type === "patient_registered"
                      ? UserPlus
                      : activity.type === "payment_received"
                        ? Banknote
                        : activity.type === "visit_started"
                          ? Activity
                          : Clock;
                  return (
                    <div key={`${activity.type}-${activity.occurred_at}-${index}`} className="flex gap-4 group cursor-pointer">
                      <div className="h-10 w-10 shrink-0 rounded-xl bg-secondary-50 flex items-center justify-center text-secondary-500 group-hover:bg-primary-50 group-hover:text-primary-600 transition-all dark:bg-white/5 dark:group-hover:bg-primary-500/10 dark:group-hover:text-primary-400">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0 border-b border-secondary-400 pb-4 dark:border-white/10">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-bold text-secondary-900 truncate">{title}</p>
                          <span className="text-[10px] font-bold text-secondary-400 whitespace-nowrap">
                            {activity.occurred_at
                              ? new Date(activity.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                              : ""}
                          </span>
                        </div>
                        <p className="text-xs text-secondary-500 line-clamp-1">{detail}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <button className="btn-secondary w-full mt-8 py-2.5">
              Generate Report
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
