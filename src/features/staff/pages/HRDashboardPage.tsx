import { PageHeader } from "@/components/layout/PageHeader";
import {
   Users,
   Wallet,
   Calendar,
   Clock,
   TrendingUp,
   ArrowUpRight,
   UserCheck,
   UserX,
   CreditCard,
   Download,
   Filter,
   RefreshCw,
   MoreHorizontal,
} from "lucide-react";
import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

const payrollTrend = [
   { month: "Jan", amount: 45000 },
   { month: "Feb", amount: 46200 },
   { month: "Mar", amount: 44800 },
   { month: "Apr", amount: 48500 },
   { month: "May", amount: 49100 },
];

export function HRDashboardPage() {
   return (
      <div className="space-y-10 animate-fade-in pb-20">
         <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <PageHeader
               title="HR & Payroll Analytics"
               description="Monitor staff attendance, manage payroll cycles, and track workforce expenditures."
            />
            <div className="flex gap-3">
               <button className="btn-secondary gap-3 py-3 px-6">
                  <Calendar className="h-4 w-4" />
                  <span className="font-bold">Attendance Log</span>
               </button>
               <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
                  <Wallet className="h-5 w-5" />
                  <span className="font-bold">Process Payroll</span>
               </button>
            </div>
         </div>

         {/* KPI Stats */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 shadow-premium">
               <div className="flex justify-between items-start mb-4">
                  <div className="h-12 w-12 rounded-2xl bg-secondary-900 text-white flex items-center justify-center">
                     <Users className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">+4 New</span>
               </div>
               <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Active Staff</p>
               <h4 className="text-3xl font-black text-secondary-900 mt-1">158</h4>
            </div>

            <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 shadow-premium">
               <div className="flex justify-between items-start mb-4">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center">
                     <UserCheck className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">94.2%</span>
               </div>
               <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Attendance Today</p>
               <h4 className="text-3xl font-black text-secondary-900 mt-1">149</h4>
            </div>

            <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 shadow-premium">
               <div className="flex justify-between items-start mb-4">
                  <div className="h-12 w-12 rounded-2xl bg-primary-500 text-white flex items-center justify-center">
                     <CreditCard className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-1 rounded-lg">+1.2%</span>
               </div>
               <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Monthly Payroll</p>
               <h4 className="text-3xl font-black text-secondary-900 mt-1">$49.1k</h4>
            </div>

            <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 shadow-premium">
               <div className="flex justify-between items-start mb-4">
                  <div className="h-12 w-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center">
                     <Clock className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-black text-secondary-400 bg-secondary-50 px-2 py-1 rounded-lg">3 Avg</span>
               </div>
               <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Pending Leaves</p>
               <h4 className="text-3xl font-black text-secondary-900 mt-1">12</h4>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Payroll Trend */}
            <div className="lg:col-span-2 glass-card rounded-[3rem] p-10 border border-secondary-400/50 bg-white/40 shadow-premium">
               <div className="flex items-center justify-between mb-10">
                  <h4 className="text-sm font-bold text-secondary-900 uppercase tracking-widest">Payroll Expenditure (5m)</h4>
                  <button className="text-[10px] font-black text-primary-500 hover:underline">View Detailed Report</button>
               </div>
               <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={payrollTrend}>
                        <defs>
                           <linearGradient id="colorPay" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0F172A" stopOpacity={0.1} />
                              <stop offset="95%" stopColor="#0F172A" stopOpacity={0} />
                           </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748B' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748B' }} tickFormatter={(v) => `$${v / 1000}k`} />
                        <Tooltip contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                        <Area type="monotone" dataKey="amount" stroke="#0F172A" strokeWidth={4} fillOpacity={1} fill="url(#colorPay)" />
                     </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>

            {/* Staff Attendance Sidebar */}
            <div className="lg:col-span-1 glass-card rounded-[3rem] p-10 border border-secondary-400/50 bg-white/40 shadow-premium">
               <h4 className="text-sm font-bold text-secondary-900 uppercase tracking-widest mb-8">Daily Check-ins</h4>
               <div className="space-y-4">
                  {[
                     { name: 'Dr. Sarah Connor', time: '07:45 AM', status: 'ON_TIME' },
                     { name: 'John Doe (Nurse)', time: '08:12 AM', status: 'LATE' },
                     { name: 'Dr. James Howlett', time: '08:00 AM', status: 'ON_TIME' },
                     { name: 'Admin Clerk #4', time: '08:05 AM', status: 'ON_TIME' },
                  ].map((staff, i) => (
                     <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/50 border border-secondary-50">
                        <div className="flex items-center gap-3">
                           <div className="h-8 w-8 rounded-full bg-secondary-100 flex items-center justify-center text-[10px] font-bold">SC</div>
                           <div>
                              <p className="text-xs font-bold text-secondary-900">{staff.name}</p>
                              <p className="text-[10px] text-secondary-400 font-medium">{staff.time}</p>
                           </div>
                        </div>
                        <span className={`h-2 w-2 rounded-full ${staff.status === 'ON_TIME' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                     </div>
                  ))}
               </div>
               <button className="w-full mt-8 py-4 rounded-2xl bg-secondary-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all">
                  Full Attendance Sheet
               </button>
            </div>
         </div>
      </div>
   );
}
