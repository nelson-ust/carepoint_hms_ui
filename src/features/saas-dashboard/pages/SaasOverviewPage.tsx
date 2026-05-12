import { PageHeader } from "@/components/layout/PageHeader";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
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
  Layers
} from "lucide-react";

const revenueData = [
  { month: "Jan", revenue: 45000, users: 120 },
  { month: "Feb", revenue: 52000, users: 145 },
  { month: "Mar", revenue: 48000, users: 138 },
  { month: "Apr", revenue: 61000, users: 180 },
  { month: "May", revenue: 68000, users: 210 },
  { month: "Jun", revenue: 75000, users: 245 },
];

const planData = [
  { name: "Starter", value: 45, color: "#94A3B8" },
  { name: "Pro", value: 35, color: "#10B981" },
  { name: "Enterprise", value: 20, color: "#0F172A" },
];

export function SaasOverviewPage() {
  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="SaaS Ecosystem Overview"
          description="Global performance metrics, revenue growth, and tenant distribution analytics."
        />
        <div className="flex gap-3">
          <button className="btn-secondary gap-3 py-3 px-6">
            <Globe className="h-4 w-4" />
            <span className="font-bold">Region Map</span>
          </button>
          <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
            <Layers className="h-5 w-5" />
            <span className="font-bold">Manage Plans</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium">
           <div className="flex justify-between items-start mb-4">
              <div className="h-12 w-12 rounded-2xl bg-secondary-900 text-white flex items-center justify-center shadow-lg shadow-secondary-900/10">
                 <CreditCard className="h-6 w-6" />
              </div>
              <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-black bg-emerald-50 px-2 py-1 rounded-lg">
                 <ArrowUpRight className="h-3 w-3" /> +12.5%
              </span>
           </div>
           <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Total ARR</p>
           <h4 className="text-3xl font-black text-secondary-900 mt-1">$1.42M</h4>
        </div>

        <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium">
           <div className="flex justify-between items-start mb-4">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/10">
                 <Users className="h-6 w-6" />
              </div>
              <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-black bg-emerald-50 px-2 py-1 rounded-lg">
                 <ArrowUpRight className="h-3 w-3" /> +8.2%
              </span>
           </div>
           <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Active Tenants</p>
           <h4 className="text-3xl font-black text-secondary-900 mt-1">284</h4>
        </div>

        <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium">
           <div className="flex justify-between items-start mb-4">
              <div className="h-12 w-12 rounded-2xl bg-primary-500 text-white flex items-center justify-center shadow-lg shadow-primary-500/20">
                 <Activity className="h-6 w-6" />
              </div>
              <span className="flex items-center gap-1 text-rose-500 text-[10px] font-black bg-rose-50 px-2 py-1 rounded-lg">
                 <ArrowDownRight className="h-3 w-3" /> -2.1%
              </span>
           </div>
           <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Platform Uptime</p>
           <h4 className="text-3xl font-black text-secondary-900 mt-1">99.94%</h4>
        </div>

        <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium">
           <div className="flex justify-between items-start mb-4">
              <div className="h-12 w-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/10">
                 <ShieldCheck className="h-6 w-6" />
              </div>
              <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-black bg-emerald-50 px-2 py-1 rounded-lg">
                 <ArrowUpRight className="h-3 w-3" /> +15.0%
              </span>
           </div>
           <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Net Expansion</p>
           <h4 className="text-3xl font-black text-secondary-900 mt-1">104.2%</h4>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Growth Chart */}
        <div className="lg:col-span-2 glass-card rounded-[3rem] p-10 border border-secondary-100/50 bg-white/40 shadow-premium">
           <div className="flex items-center justify-between mb-10">
              <div>
                 <h4 className="text-lg font-black text-secondary-900">Revenue Trajectory</h4>
                 <p className="text-xs text-secondary-400 font-bold mt-1">Monthly recurring revenue growth for FY2026</p>
              </div>
              <div className="flex gap-4">
                 <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-secondary-900" />
                    <span className="text-[10px] font-bold text-secondary-400">Revenue</span>
                 </div>
              </div>
           </div>
           <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={revenueData}>
                    <defs>
                       <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0F172A" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#0F172A" stopOpacity={0}/>
                       </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis 
                       dataKey="month" 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fontSize: 11, fontWeight: 700, fill: '#64748B' }} 
                    />
                    <YAxis 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fontSize: 11, fontWeight: 700, fill: '#64748B' }}
                       tickFormatter={(value) => `$${value/1000}k`}
                    />
                    <Tooltip 
                       contentStyle={{ 
                          borderRadius: '1.5rem', 
                          border: 'none', 
                          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                          padding: '1rem'
                       }} 
                    />
                    <Area 
                       type="monotone" 
                       dataKey="revenue" 
                       stroke="#0F172A" 
                       strokeWidth={4} 
                       fillOpacity={1} 
                       fill="url(#colorRev)" 
                    />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Plan Distribution */}
        <div className="lg:col-span-1 glass-card rounded-[3rem] p-10 border border-secondary-100/50 bg-white/40 shadow-premium flex flex-col">
           <h4 className="text-lg font-black text-secondary-900 mb-2">Plan Mix</h4>
           <p className="text-xs text-secondary-400 font-bold mb-10">Market share by subscription tier</p>
           
           <div className="h-[250px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie
                       data={planData}
                       cx="50%"
                       cy="50%"
                       innerRadius={60}
                       outerRadius={100}
                       paddingAngle={8}
                       dataKey="value"
                    >
                       {planData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                       ))}
                    </Pie>
                    <Tooltip />
                 </PieChart>
              </ResponsiveContainer>
           </div>

           <div className="space-y-4 mt-10">
              {planData.map(item => (
                 <div key={item.name} className="flex items-center justify-between p-4 rounded-2xl bg-white/50 border border-secondary-50">
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
    </div>
  );
}
