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
  Cell,
} from "recharts";
import { Truck, Activity, ShieldCheck, Clock } from "lucide-react";

const missionData = [
  { day: "Mon", count: 12 },
  { day: "Tue", count: 18 },
  { day: "Wed", count: 15 },
  { day: "Thu", count: 22 },
  { day: "Fri", count: 28 },
  { day: "Sat", count: 19 },
  { day: "Sun", count: 14 },
];

const statusData = [
  { name: "Available", value: 8, color: "#10B981" },
  { name: "On Mission", value: 3, color: "#3B82F6" },
  { name: "Maintenance", value: 1, color: "#F59E0B" },
];

export function AmbulanceStats() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Quick Stats */}
      <div className="lg:col-span-1 space-y-4">
        <div className="glass-card rounded-[2rem] p-6 border border-secondary-100/50 bg-white/40 shadow-premium">
           <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-secondary-900 text-white flex items-center justify-center shadow-lg shadow-secondary-900/10">
                 <Truck className="h-6 w-6" />
              </div>
              <div>
                 <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Total Fleet</p>
                 <h4 className="text-2xl font-black text-secondary-900">12</h4>
              </div>
           </div>
        </div>
        <div className="glass-card rounded-[2rem] p-6 border border-secondary-100/50 bg-white/40 shadow-premium">
           <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/10">
                 <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                 <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Ready</p>
                 <h4 className="text-2xl font-black text-secondary-900">8</h4>
              </div>
           </div>
        </div>
        <div className="glass-card rounded-[2rem] p-6 border border-secondary-100/50 bg-white/40 shadow-premium">
           <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-primary-500 text-white flex items-center justify-center shadow-lg shadow-primary-500/10">
                 <Activity className="h-6 w-6" />
              </div>
              <div>
                 <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Avg Response</p>
                 <h4 className="text-2xl font-black text-secondary-900">8.4m</h4>
              </div>
           </div>
        </div>
      </div>

      {/* Mission Chart */}
      <div className="lg:col-span-2 glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium">
         <div className="flex items-center justify-between mb-8">
            <h4 className="text-sm font-bold text-secondary-900 uppercase tracking-widest">Mission Volume (7d)</h4>
            <div className="flex gap-2">
               <span className="h-2 w-2 rounded-full bg-primary-500" />
               <span className="text-[10px] font-bold text-secondary-400">Emergencies</span>
            </div>
         </div>
         <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={missionData}>
                  <defs>
                     <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0F172A" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#0F172A" stopOpacity={0}/>
                     </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis 
                     dataKey="day" 
                     axisLine={false} 
                     tickLine={false} 
                     tick={{ fontSize: 10, fontWeight: 700, fill: '#94A3B8' }} 
                  />
                  <YAxis hide />
                  <Tooltip 
                     contentStyle={{ 
                        borderRadius: '1rem', 
                        border: 'none', 
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        fontSize: '12px',
                        fontWeight: 'bold'
                     }} 
                  />
                  <Area 
                     type="monotone" 
                     dataKey="count" 
                     stroke="#0F172A" 
                     strokeWidth={3} 
                     fillOpacity={1} 
                     fill="url(#colorCount)" 
                  />
               </AreaChart>
            </ResponsiveContainer>
         </div>
      </div>

      {/* Fleet Distribution */}
      <div className="lg:col-span-1 glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium flex flex-col">
         <h4 className="text-sm font-bold text-secondary-900 uppercase tracking-widest mb-8 text-center">Fleet Distribution</h4>
         <div className="h-[150px] w-full mb-6">
            <ResponsiveContainer width="100%" height="100%">
               <BarChart data={statusData}>
                  <Bar dataKey="value" radius={[4, 4, 4, 4]}>
                     {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                     ))}
                  </Bar>
               </BarChart>
            </ResponsiveContainer>
         </div>
         <div className="space-y-3 mt-auto">
            {statusData.map(item => (
               <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                     <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                     <span className="text-[10px] font-bold text-secondary-500 uppercase">{item.name}</span>
                  </div>
                  <span className="text-xs font-black text-secondary-900">{item.value}</span>
               </div>
            ))}
         </div>
      </div>
    </div>
  );
}
