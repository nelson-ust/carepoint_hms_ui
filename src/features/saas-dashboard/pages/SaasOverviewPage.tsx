import { useChartTheme } from "@/components/charts/chart-theme";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import {
  Users,
  CreditCard,
  Activity,
  ShieldCheck,
  ArrowUpRight,
  Zap,
  ScrollText,
} from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxGrid,
  DxKpi,
  DxPage,
  DxPageHeader,
  DxPageLoading,
  DxPanel,
  DxSegmented,
  type DxGridColumn,
  type DxKpiTone,
} from "@/components/dx";
import { useSaasMetrics, useSaasTenants } from "../hooks/use-saas-analytics";
import { useSystemHealth } from "../hooks/use-system-health";
import { format } from "date-fns";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { routes } from "@/config/routes";

type TopTenant = { id: number | string; name: string; code: string; revenue: number; growth: number };

export function SaasOverviewPage() {
  const { data: metrics, isLoading: isMetricsLoading } = useSaasMetrics();
  useSystemHealth();
  useSaasTenants(1, 5);
  const [activeTab, setActiveTab] = useState<"revenue" | "usage">("revenue");
  const chart = useChartTheme();
  const navigate = useNavigate();

  if (isMetricsLoading) return <DxPageLoading label="Aggregating ecosystem data…" />;

  const kpis: { label: string; value: string | number; icon: typeof Users; tone: DxKpiTone }[] = [
    { label: "Total ARR", value: `₦${(metrics?.total_arr || 0).toLocaleString()}`, icon: CreditCard, tone: "accent" },
    { label: "Active tenants", value: metrics?.active_tenants || 0, icon: Users, tone: "info" },
    { label: "Platform uptime", value: metrics?.platform_uptime != null ? `${metrics.platform_uptime}%` : "—", icon: Activity, tone: "success" },
    { label: "Net expansion", value: metrics?.net_expansion != null ? `${metrics.net_expansion}%` : "—", icon: ShieldCheck, tone: "warning" },
  ];

  const topTenantCols: DxGridColumn<TopTenant>[] = [
    {
      key: "name",
      header: "Tenant",
      minWidth: 180,
      render: (t) => (
        <div className="flex items-center gap-2.5">
          <span className="h-8 w-8 rounded-[var(--dx-radius)] bg-[var(--dx-surface-alt)] border border-[var(--dx-border)] flex items-center justify-center font-semibold text-[var(--dx-text-muted)]">
            {t.name.charAt(0)}
          </span>
          <span className="font-medium text-[var(--dx-text)]">{t.name}</span>
        </div>
      ),
    },
    { key: "code", header: "Code", width: 110, render: (t) => <span className="font-mono text-[12px]">{t.code}</span> },
    {
      key: "revenue",
      header: "Revenue",
      width: 140,
      align: "right",
      accessor: (t) => t.revenue,
      render: (t) => <span className="font-mono">₦{t.revenue.toLocaleString()}</span>,
    },
    {
      key: "growth",
      header: "Growth",
      width: 110,
      align: "right",
      accessor: (t) => t.growth,
      render: (t) => (
        <span className="inline-flex items-center justify-end gap-1 text-[var(--dx-success)] font-semibold">
          <ArrowUpRight className="h-3.5 w-3.5" />
          {t.growth}%
        </span>
      ),
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "SaaS admin" }, { label: "Overview" }]}
        title="SaaS ecosystem overview"
        subtitle="Global performance, revenue growth, and tenant distribution analytics."
        actions={
          <div className="flex items-center gap-2">
            <DxButton variant="default" leftIcon={<ScrollText className="h-4 w-4" />} onClick={() => navigate(routes.saasAuditLogs)}>
              Audit logs
            </DxButton>
            <DxButton variant="primary" leftIcon={<Zap className="h-4 w-4" />} onClick={() => navigate(routes.connectivity)}>
              System health
            </DxButton>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <DxKpi key={kpi.label} label={kpi.label} value={kpi.value} icon={kpi.icon} tone={kpi.tone} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DxPanel
          className="lg:col-span-2"
          title="Performance trajectory"
          description="Growth analysis for the current fiscal period"
          actions={
            <DxSegmented
              value={activeTab}
              onChange={setActiveTab}
              items={[
                { key: "revenue", label: "Revenue" },
                { key: "usage", label: "Usage" },
              ]}
            />
          }
        >
          <div className="h-[380px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {activeTab === "revenue" ? (
                <AreaChart data={metrics?.revenue_trend || []}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chart.areaGradient.from} />
                      <stop offset="95%" stopColor={chart.areaGradient.to} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={chart.tick} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={chart.tick} tickFormatter={(val) => `₦${val / 1000}k`} />
                  <Tooltip contentStyle={chart.tooltip} formatter={(value) => [`₦${Number(value).toLocaleString()}`, "Revenue"]} />
                  <Area type="monotone" dataKey="revenue" stroke={chart.series[0]} strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              ) : (
                <BarChart data={metrics?.revenue_trend || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={chart.tick} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={chart.tick} />
                  <Tooltip cursor={chart.cursor} contentStyle={chart.tooltip} />
                  <Bar dataKey="users" fill={chart.series[0]} radius={[6, 6, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </DxPanel>

        <DxPanel title="Market share" description="Tenant distribution by plan tier">
          <div className="h-[240px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metrics?.plan_distribution || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={100}
                  paddingAngle={6}
                  dataKey="value"
                >
                  {metrics?.plan_distribution?.map((entry, index) => (
                    <Cell key={`cell-${entry.name}`} fill={chart.series[index % chart.series.length]} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chart.tooltip} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-semibold text-[var(--dx-text)]">{metrics?.active_tenants || 0}</span>
              <span className="text-[11px] text-[var(--dx-text-muted)]">Total</span>
            </div>
          </div>
          <div className="space-y-1.5 mt-4">
            {(!metrics?.plan_distribution || metrics.plan_distribution.length === 0) && (
              <p className="text-[var(--dx-text-muted)] text-center">No active subscription plans yet.</p>
            )}
            {metrics?.plan_distribution?.map((item, index) => (
              <div
                key={item.name}
                className="flex items-center justify-between px-3 py-2 rounded-[var(--dx-radius)] bg-[var(--dx-surface-alt)] border border-[var(--dx-border)]"
              >
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chart.series[index % chart.series.length] }} />
                  <span className="font-medium text-[var(--dx-text)]">{item.name}</span>
                </span>
                <span className="font-semibold text-[var(--dx-text)]">{item.value}%</span>
              </div>
            ))}
          </div>
        </DxPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DxPanel
          title="Live activity"
          actions={<DxBadge tone="success" dot>Live</DxBadge>}
          footer={
            <DxButton size="sm" className="w-full" onClick={() => navigate(routes.connectivity)}>
              View all logs
            </DxButton>
          }
        >
          <div className="space-y-3">
            {(!metrics?.recent_activities || metrics.recent_activities.length === 0) && (
              <p className="text-[var(--dx-text-muted)] py-4 text-center">No recent platform activity yet.</p>
            )}
            {metrics?.recent_activities?.map((activity) => (
              <div key={activity.id} className="flex gap-3">
                <span
                  className={`h-8 w-8 rounded-[var(--dx-radius)] flex items-center justify-center shrink-0 ${
                    activity.status === "SUCCESS"
                      ? "bg-[var(--dx-success-soft)] text-[var(--dx-success)]"
                      : "bg-[var(--dx-danger-soft)] text-[var(--dx-danger)]"
                  }`}
                >
                  <Activity className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0 border-b border-[var(--dx-border)] pb-3 last:border-0">
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-medium text-[var(--dx-text)] truncate">{activity.action}</p>
                    <span className="text-[11px] text-[var(--dx-text-muted)] shrink-0">
                      {format(new Date(activity.timestamp), "HH:mm")}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--dx-text-muted)] mt-0.5">{activity.tenant}</p>
                </div>
              </div>
            ))}
          </div>
        </DxPanel>

        <DxPanel className="lg:col-span-2" title="Performance leaders" flush>
          <DxGrid
            borderless
            columns={topTenantCols}
            data={(metrics?.top_tenants as TopTenant[]) || []}
            rowKey={(t) => t.id}
            empty={{ icon: Users, title: "No tenants", description: "No tenants to rank yet." }}
          />
        </DxPanel>
      </div>
    </DxPage>
  );
}
