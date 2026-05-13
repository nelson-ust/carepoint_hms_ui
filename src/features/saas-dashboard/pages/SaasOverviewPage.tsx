import { PageHeader } from "@/components/layout/PageHeader";
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
  TrendingUp,
  CreditCard,
  Activity,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  Layers,
  Zap,
  Calendar,
  Search,
  Filter,
} from "lucide-react";
import { useSaasMetrics, useSaasTenants } from "../hooks/use-saas-analytics";
import { useSystemHealth } from "../hooks/use-system-health";
import { format } from "date-fns";
import { useState } from "react";

export function SaasOverviewPage() {
  const { data: metrics, isLoading: isMetricsLoading } = useSaasMetrics();
  const { data: health } = useSystemHealth();
  const { data: tenantData } = useSaasTenants(1, 5);
  const [activeTab, setActiveTab] = useState<'revenue' | 'usage'>('revenue');

  if (isMetricsLoading) {
    return (
      <div className="h-[80vh] w-full flex flex-col items-center justify-center">
        <div className="relative">
          <div className="h-24 w-24 border-4 border-secondary-100 rounded-full" />
          <div className="absolute inset-0 h-24 w-24 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="mt-8 text-sm font-bold text-secondary-400 uppercase tracking-[0.4em] animate-pulse">Aggregating Ecosystem Data</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="SaaS Ecosystem Overview"
          description="Global performance metrics, revenue growth, and tenant distribution analytics."
        />
        <div className="flex gap-3">
          <div className="flex bg-white/50 p-1.5 rounded-2xl border border-secondary-100/50 shadow-sm">
            <button
              onClick={() => setActiveTab('revenue')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'revenue' ? 'bg-secondary-900 text-white shadow-lg' : 'text-secondary-400 hover:bg-white'}`}
            >
              Revenue
            </button>
            <button
              onClick={() => setActiveTab('usage')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'usage' ? 'bg-secondary-900 text-white shadow-lg' : 'text-secondary-400 hover:bg-white'}`}
            >
              Usage
            </button>
          </div>
          <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
            <Zap className="h-5 w-5" />
            <span className="font-bold">System Health</span>
          </button>
        </div>
      </div>

      {/* KPI Cards with micro-animations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Total ARR", value: `$${(metrics?.total_arr || 0).toLocaleString()}`, icon: CreditCard, trend: "+12.5%", color: "secondary" },
          { label: "Active Tenants", value: metrics?.active_tenants || 0, icon: Users, trend: "+8.2%", color: "emerald" },
          { label: "Platform Uptime", value: `${metrics?.platform_uptime || 99.98}%`, icon: Activity, trend: "-0.01%", color: "primary" },
          { label: "Net Expansion", value: `${metrics?.net_expansion || 0}%`, icon: ShieldCheck, trend: "+15.0%", color: "amber" },
        ].map((kpi, i) => (
          <div key={i} className="glass-card group rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium hover:scale-[1.02] transition-all duration-500">
            <div className="flex justify-between items-start mb-6">
              <div className={`h-14 w-14 rounded-2xl bg-${kpi.color === 'secondary' ? 'secondary-900' : kpi.color + '-500'} text-white flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform`}>
                <kpi.icon className="h-7 w-7" />
              </div>
              <span className={`flex items-center gap-1 ${kpi.trend.startsWith('+') ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'} text-[10px] font-black px-2 py-1 rounded-lg`}>
                {kpi.trend.startsWith('+') ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />} {kpi.trend}
              </span>
            </div>
            <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">{kpi.label}</p>
            <h4 className="text-3xl font-black text-secondary-900 mt-2">{kpi.value}</h4>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Growth Chart */}
        <div className="lg:col-span-2 glass-card rounded-[3rem] p-10 border border-secondary-100/50 bg-white/40 shadow-premium relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 blur-[100px] -translate-y-1/2 translate-x-1/2" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-12 gap-6">
            <div>
              <h4 className="text-xl font-black text-secondary-900">Performance Trajectory</h4>
              <p className="text-xs text-secondary-400 font-bold mt-1">Growth analysis for the current fiscal period</p>
            </div>
            <div className="flex gap-2">
              <button className="p-2.5 rounded-xl border border-secondary-100 hover:bg-white transition-all">
                <Calendar className="h-4 w-4 text-secondary-600" />
              </button>
              <button className="p-2.5 rounded-xl border border-secondary-100 hover:bg-white transition-all">
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
                      <stop offset="5%" stopColor="#0F172A" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#0F172A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748B' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748B' }} tickFormatter={(val) => `$${val / 1000}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '1rem' }}
                    itemStyle={{ fontWeight: 900, fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#0F172A" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              ) : (
                <BarChart data={metrics?.revenue_trend || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748B' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748B' }} />
                  <Tooltip
                    cursor={{ fill: '#F1F5F9' }}
                    contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '1rem' }}
                  />
                  <Bar dataKey="users" fill="#0F172A" radius={[10, 10, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plan Distribution */}
        <div className="lg:col-span-1 glass-card rounded-[3rem] p-10 border border-secondary-100/50 bg-white/40 shadow-premium flex flex-col relative overflow-hidden">
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
                    <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-black text-secondary-900">{metrics?.active_tenants || 0}</span>
              <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Total</span>
            </div>
          </div>

          <div className="space-y-3 mt-12">
            {metrics?.plan_distribution?.map((item) => (
              <div key={item.name} className="flex items-center justify-between p-4 rounded-2xl bg-white/50 border border-secondary-50 hover:border-secondary-200 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
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
        <div className="lg:col-span-1 glass-card rounded-[3rem] p-10 border border-secondary-100/50 bg-white/40 shadow-premium">
          <div className="flex items-center justify-between mb-10">
            <h4 className="text-xl font-black text-secondary-900">Live Activity</h4>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="space-y-6">
            {metrics?.recent_activities?.map((activity) => (
              <div key={activity.id} className="flex gap-4 group">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${activity.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  <Activity className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0 border-b border-secondary-100/50 pb-4 group-last:border-0">
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-sm font-bold text-secondary-900 truncate">{activity.action}</p>
                    <span className="text-[10px] font-bold text-secondary-400 shrink-0">{format(new Date(activity.timestamp), 'HH:mm')}</span>
                  </div>
                  <p className="text-[11px] text-secondary-500 mt-1 font-medium italic">{activity.tenant}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-8 py-4 rounded-2xl bg-secondary-900 text-white text-xs font-black uppercase tracking-widest hover:bg-secondary-800 transition-colors">
            View All Logs
          </button>
        </div>

        {/* Top Tenants */}
        <div className="lg:col-span-2 glass-card rounded-[3rem] p-10 border border-secondary-100/50 bg-white/40 shadow-premium">
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
                <tr className="border-b border-secondary-100">
                  <th className="text-left pb-4 text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Tenant</th>
                  <th className="text-left pb-4 text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Code</th>
                  <th className="text-left pb-4 text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Revenue</th>
                  <th className="text-right pb-4 text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Growth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100/50">
                {metrics?.top_tenants?.map((tenant) => (
                  <tr key={tenant.id} className="group hover:bg-white/50 transition-colors">
                    <td className="py-6">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-secondary-100 flex items-center justify-center font-black text-secondary-600">
                          {tenant.name.charAt(0)}
                        </div>
                        <span className="text-sm font-bold text-secondary-900">{tenant.name}</span>
                      </div>
                    </td>
                    <td className="py-6">
                      <span className="px-2 py-1 rounded bg-secondary-50 text-[10px] font-black text-secondary-600 uppercase tracking-tighter">
                        {tenant.code}
                      </span>
                    </td>
                    <td className="py-6">
                      <span className="text-sm font-black text-secondary-900">${tenant.revenue.toLocaleString()}</span>
                    </td>
                    <td className="py-6 text-right">
                      <span className="flex items-center justify-end gap-1 text-emerald-600 text-xs font-black">
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
