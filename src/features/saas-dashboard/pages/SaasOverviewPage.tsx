import { PageHeader } from "@/components/layout/PageHeader";
import { MetricCard, type MetricTone } from "@/components/charts/MetricCard";
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
  Calendar,
  Search,
  Filter,
} from "lucide-react";
import { useSaasMetrics, useSaasTenants } from "../hooks/use-saas-analytics";
import { useSystemHealth } from "../hooks/use-system-health";
import { format } from "date-fns";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { routes } from "@/config/routes";

export function SaasOverviewPage() {
  const { data: metrics, isLoading: isMetricsLoading } = useSaasMetrics();
  useSystemHealth();
  useSaasTenants(1, 5);
  const [activeTab, setActiveTab] = useState<'revenue' | 'usage'>('revenue');
  const chart = useChartTheme();
  const navigate = useNavigate();

  if (isMetricsLoading) {
    return (
      <div className="h-[80vh] w-full flex flex-col items-center justify-center">
        <div className="relative">
          <div className="h-24 w-24 border-4 border-secondary-400 rounded-full" />
          <div className="absolute inset-0 h-24 w-24 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="mt-8 text-sm font-bold text-secondary-400 uppercase tracking-[0.4em] animate-pulse">Aggregating Ecosystem Data</p>
      </div>
    );
  }

  const kpis: {
    label: string;
    value: string | number;
    icon: typeof Users;
    tone: MetricTone;
  }[] = [
    { label: "Total ARR", value: `₦${(metrics?.total_arr || 0).toLocaleString()}`, icon: CreditCard, tone: "slate" },
    { label: "Active Tenants", value: metrics?.active_tenants || 0, icon: Users, tone: "primary" },
    { label: "Platform Uptime", value: metrics?.platform_uptime != null ? `${metrics.platform_uptime}%` : "—", icon: Activity, tone: "cyan" },
    { label: "Net Expansion", value: metrics?.net_expansion != null ? `${metrics.net_expansion}%` : "—", icon: ShieldCheck, tone: "amber" },
  ];

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="SaaS Ecosystem Overview"
          description="Global performance metrics, revenue growth, and tenant distribution analytics."
        />
        <div className="flex gap-3">
          <div className="flex bg-white/50 p-1.5 rounded-2xl border border-secondary-400/50 shadow-sm dark:bg-white/5 dark:border-white/10">
            <button
              onClick={() => setActiveTab('revenue')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'revenue' ? 'bg-secondary-900 text-white shadow-lg dark:bg-white/15' : 'text-secondary-400 hover:bg-white dark:hover:bg-white/10'}`}
            >
              Revenue
            </button>
            <button
              onClick={() => setActiveTab('usage')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'usage' ? 'bg-secondary-900 text-white shadow-lg dark:bg-white/15' : 'text-secondary-400 hover:bg-white dark:hover:bg-white/10'}`}
            >
              Usage
            </button>
          </div>
          <button onClick={() => navigate(routes.connectivity)} className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
            <Zap className="h-5 w-5" />
            <span className="font-bold">System Health</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi) => (
          <MetricCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            tone={kpi.tone}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Growth Chart */}
        <div className="lg:col-span-2 glass-card rounded-[3rem] p-10 shadow-premium relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 blur-[100px] -translate-y-1/2 translate-x-1/2" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-12 gap-6">
            <div>
              <h4 className="text-xl font-black text-secondary-900">Performance Trajectory</h4>
              <p className="text-xs text-secondary-400 font-bold mt-1">Growth analysis for the current fiscal period</p>
            </div>
            <div className="flex gap-2">
              <button className="p-2.5 rounded-xl border border-secondary-400 hover:bg-white transition-all dark:border-white/10 dark:hover:bg-white/10">
                <Calendar className="h-4 w-4 text-secondary-600" />
              </button>
              <button className="p-2.5 rounded-xl border border-secondary-400 hover:bg-white transition-all dark:border-white/10 dark:hover:bg-white/10">
                <Filter className="h-4 w-4 text-secondary-600" />
              </button>
            </div>
          </div>

          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {activeTab === 'revenue' ? (
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
                  <Area type="monotone" dataKey="revenue" stroke={chart.series[0]} strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              ) : (
                <BarChart data={metrics?.revenue_trend || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={chart.tick} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={chart.tick} />
                  <Tooltip cursor={chart.cursor} contentStyle={chart.tooltip} />
                  <Bar dataKey="users" fill={chart.series[0]} radius={[10, 10, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plan Distribution */}
        <div className="lg:col-span-1 glass-card rounded-[3rem] p-10 shadow-premium flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 blur-[80px] -translate-y-1/2 translate-x-1/2" />
          <h4 className="text-xl font-black text-secondary-900 mb-2">Market Share</h4>
          <p className="text-xs text-secondary-400 font-bold mb-12">Tenant distribution by plan tier</p>

          <div className="h-[280px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metrics?.plan_distribution || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={10}
                  dataKey="value"
                >
                  {metrics?.plan_distribution?.map((entry, index) => (
                    <Cell
                      key={`cell-${entry.name}`}
                      fill={chart.series[index % chart.series.length]}
                      strokeWidth={0}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={chart.tooltip} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-black text-secondary-900">{metrics?.active_tenants || 0}</span>
              <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Total</span>
            </div>
          </div>

          <div className="space-y-3 mt-12">
            {(!metrics?.plan_distribution || metrics.plan_distribution.length === 0) && (
              <p className="text-sm text-secondary-400 italic text-center">No active subscription plans yet.</p>
            )}
            {metrics?.plan_distribution?.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between p-4 rounded-2xl bg-white/50 border border-secondary-50 hover:border-secondary-200 transition-colors dark:bg-white/5 dark:border-white/5 dark:hover:border-white/15">
                <div className="flex items-center gap-3">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: chart.series[index % chart.series.length] }}
                  />
                  <span className="text-sm font-bold text-secondary-700">{item.name}</span>
                </div>
                <span className="text-sm font-black text-secondary-900">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-1 glass-card rounded-[3rem] p-10 shadow-premium">
          <div className="flex items-center justify-between mb-10">
            <h4 className="text-xl font-black text-secondary-900">Live Activity</h4>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="space-y-6">
            {(!metrics?.recent_activities || metrics.recent_activities.length === 0) && (
              <p className="text-sm text-secondary-400 italic py-6 text-center">No recent platform activity yet.</p>
            )}
            {metrics?.recent_activities?.map((activity) => (
              <div key={activity.id} className="flex gap-4 group">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${activity.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'bg-rose-500/10 text-rose-600 dark:text-rose-300'}`}>
                  <Activity className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0 border-b border-secondary-400/50 pb-4 group-last:border-0 dark:border-white/10">
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-sm font-bold text-secondary-900 truncate">{activity.action}</p>
                    <span className="text-[10px] font-bold text-secondary-400 shrink-0">{format(new Date(activity.timestamp), 'HH:mm')}</span>
                  </div>
                  <p className="text-[11px] text-secondary-500 mt-1 font-medium italic">{activity.tenant}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => navigate(routes.connectivity)} className="w-full mt-8 py-4 rounded-2xl bg-secondary-900 text-white text-xs font-black uppercase tracking-widest hover:bg-secondary-800 transition-colors dark:bg-white/10 dark:hover:bg-white/15">
            View All Logs
          </button>
        </div>

        {/* Top Tenants */}
        <div className="lg:col-span-2 glass-card rounded-[3rem] p-10 shadow-premium">
          <div className="flex items-center justify-between mb-10">
            <h4 className="text-xl font-black text-secondary-900">Performance Leaders</h4>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-secondary-400" />
              <input type="text" placeholder="Search tenants..." className="bg-transparent border-0 focus:ring-0 text-sm font-bold placeholder:text-secondary-300" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-secondary-400 dark:border-white/10">
                  <th className="text-left pb-4 text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Tenant</th>
                  <th className="text-left pb-4 text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Code</th>
                  <th className="text-left pb-4 text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Revenue</th>
                  <th className="text-right pb-4 text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Growth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100/50 dark:divide-white/5">
                {(!metrics?.top_tenants || metrics.top_tenants.length === 0) && (
                  <tr><td colSpan={4} className="py-10 text-center text-sm text-secondary-400 italic">No tenants to rank yet.</td></tr>
                )}
                {metrics?.top_tenants?.map((tenant) => (
                  <tr key={tenant.id} className="group hover:bg-white/50 transition-colors dark:hover:bg-white/5">
                    <td className="py-6">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-secondary-100 flex items-center justify-center font-black text-secondary-600 dark:bg-white/10">
                          {tenant.name.charAt(0)}
                        </div>
                        <span className="text-sm font-bold text-secondary-900">{tenant.name}</span>
                      </div>
                    </td>
                    <td className="py-6">
                      <span className="data-mono px-2 py-1 rounded bg-secondary-50 text-[10px] font-black text-secondary-600 uppercase tracking-tighter dark:bg-white/10">
                        {tenant.code}
                      </span>
                    </td>
                    <td className="py-6">
                      <span className="data-mono text-sm font-black text-secondary-900">₦{tenant.revenue.toLocaleString()}</span>
                    </td>
                    <td className="py-6 text-right">
                      <span className="flex items-center justify-end gap-1 text-emerald-600 text-xs font-black dark:text-emerald-300">
                        <ArrowUpRight className="h-3.5 w-3.5" /> {tenant.growth}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
