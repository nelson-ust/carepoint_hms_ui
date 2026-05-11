import { PageHeader } from "@/components/layout/PageHeader";
import { 
  Users, 
  Calendar, 
  CreditCard, 
  Package, 
  ArrowUpRight, 
  ArrowDownRight,
  Activity,
  TrendingUp,
  Clock,
  UserCheck,
  Stethoscope
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { useState, useEffect } from "react";
import { getDashboardOverview, DashboardMetrics } from "../api/tenant-dashboard.api";

export function TenantOverviewPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics["data"] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const response = await getDashboardOverview();
        if (response.success) {
          setMetrics(response.data);
        }
      } catch (err) {
        console.error("Failed to load dashboard metrics", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadMetrics();
  }, []);

  const stats = [
    { label: "Active Patients", value: metrics?.total_patients?.toLocaleString() || "0", icon: Users, trend: "+12.5%", color: "primary" },
    { label: "Daily Consultations", value: metrics?.active_visits?.toString() || "0", icon: Stethoscope, trend: "+5.2%", color: "blue" },
    { label: "Gross Revenue", value: `₦${metrics?.total_revenue?.toLocaleString() || "0"}`, icon: CreditCard, trend: "+18.4%", color: "primary" },
    { label: "Inventory Alerts", value: metrics?.pending_appointments?.toString() || "0", icon: Package, trend: "-2", color: "rose" },
  ];

  const recentActivities = metrics?.recent_activities || [];


  return (
    <section className="space-y-10 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Facility Intelligence"
          description="Operational insights and real-time performance tracking for your healthcare facility."
        />
        <div className="flex items-center gap-2 rounded-2xl bg-white border border-secondary-200 p-1.5 shadow-sm">
          {["Daily", "Weekly", "Monthly"].map((period) => (
            <button 
              key={period}
              className={`px-6 py-2 text-xs font-bold rounded-xl transition-all ${
                period === "Weekly" ? "bg-secondary-900 text-white shadow-premium" : "text-secondary-500 hover:text-secondary-900 hover:bg-secondary-50"
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="glass-card rounded-[2rem] p-8 group transition-all duration-500 hover:translate-y-[-8px] hover:shadow-premium">
            <div className="flex items-start justify-between">
              <div className={`p-4 rounded-2xl bg-${stat.color}-500/10 text-${stat.color}-600 group-hover:bg-${stat.color}-500 group-hover:text-white transition-all duration-300`}>
                <stat.icon className="h-7 w-7" />
              </div>
              <div className={`flex items-center gap-1 text-[11px] font-bold ${
                stat.trend.startsWith('+') ? "text-primary-600 bg-primary-50" : "text-rose-600 bg-rose-50"
              } px-3 py-1.5 rounded-full ring-1 ring-inset ${
                stat.trend.startsWith('+') ? "ring-primary-500/20" : "ring-rose-500/20"
              }`}>
                {stat.trend.startsWith('+') ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {stat.trend}
              </div>
            </div>
            <div className="mt-6">
              <p className="text-sm font-bold text-secondary-500 uppercase tracking-widest">{stat.label}</p>
              <p className="mt-2 text-4xl font-bold tracking-tight text-secondary-900 font-display">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts & Activity Section */}
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-8">
          <div className="glass-card rounded-[2rem] p-8 md:p-10">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-xl font-bold">Patient Admissions</h3>
                <p className="text-sm text-secondary-500">Weekly breakdown of patient visits and registrations</p>
              </div>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-primary-500" />
                    <span className="text-xs font-bold text-secondary-600">Visits</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-secondary-200" />
                    <span className="text-xs font-bold text-secondary-600">Admissions</span>
                 </div>
              </div>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics?.visit_trends || []}>

                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}}
                  />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}}
                  />
                  <Bar 
                    dataKey="visits" 
                    fill="#10B981" 
                    radius={[8, 8, 0, 0]} 
                    barSize={40}
                  />
                  <Bar 
                    dataKey="patients" 
                    fill="#e2e8f0" 
                    radius={[8, 8, 0, 0]} 
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
           <div className="glass-card rounded-[2rem] p-8 md:p-10 flex flex-col h-full">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold">Recent Stream</h3>
                <button className="text-xs font-bold text-primary-600 hover:underline">View All</button>
              </div>
              <div className="space-y-6 flex-1 overflow-y-auto pr-2 scrollbar-hide">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex gap-4 group cursor-pointer">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-secondary-50 flex items-center justify-center text-secondary-500 group-hover:bg-primary-50 group-hover:text-primary-600 transition-all">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0 border-b border-secondary-100 pb-4">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-bold text-secondary-900 truncate">{activity.user}</p>
                        <span className="text-[10px] font-bold text-secondary-400 whitespace-nowrap">{activity.time}</span>
                      </div>
                      <p className="text-xs text-secondary-500 line-clamp-1">{activity.detail}</p>
                    </div>
                  </div>
                ))}
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


