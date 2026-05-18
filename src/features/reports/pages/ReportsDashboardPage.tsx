import { PageHeader } from "@/components/layout/PageHeader";
import {
   BarChart3,
   Download,
   FileText,
   PieChart,
   Activity,
   TrendingUp,
   Filter,
   RefreshCw,
   ChevronRight,
   Database,
   Shield,
   CreditCard,
} from "lucide-react";
import { useState } from "react";

export function ReportsDashboardPage() {
   const categories = [
      { id: 'FINANCIAL', label: 'Financial Performance', icon: CreditCard, count: 12, color: 'text-emerald-500' },
      { id: 'CLINICAL', label: 'Clinical Analytics', icon: Activity, count: 8, color: 'text-primary-500' },
      { id: 'INVENTORY', label: 'Inventory & Supply', icon: Database, count: 15, color: 'text-amber-500' },
      { id: 'STAFF', label: 'Workforce Reports', icon: Shield, count: 5, color: 'text-secondary-900' },
   ];

   return (
      <div className="space-y-10 animate-fade-in pb-20">
         <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <PageHeader
               title="Intelligence Hub"
               description="Access clinical registries, financial audits, and operational performance metrics."
            />
            <div className="flex gap-3">
               <button className="btn-secondary gap-3 py-3 px-6">
                  <RefreshCw className="h-4 w-4" />
                  <span className="font-bold">Refresh Data</span>
               </button>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {categories.map((cat) => (
               <div key={cat.id} className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 hover:bg-white/60 transition-all cursor-pointer group shadow-premium">
                  <div className={`h-14 w-14 rounded-2xl bg-secondary-900 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                     <cat.icon className="h-7 w-7 text-white" />
                  </div>
                  <h4 className="text-lg font-black text-secondary-900 mb-1">{cat.label}</h4>
                  <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">{cat.count} Available Reports</p>
                  <div className="mt-8 flex items-center justify-between pt-6 border-t border-secondary-50">
                     <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest">Explore</span>
                     <ChevronRight className="h-4 w-4 text-secondary-300 group-hover:translate-x-1 transition-transform" />
                  </div>
               </div>
            ))}
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Featured Reports */}
            <div className="lg:col-span-2 space-y-6">
               <h3 className="text-sm font-bold text-secondary-400 uppercase tracking-[0.2em] ml-4">Featured Analytics</h3>
               <div className="grid gap-4">
                  {[
                     { title: 'Monthly Revenue Trajectory', cat: 'Financial', date: 'May 12, 2026', size: '2.4 MB' },
                     { title: 'Disease Incidence Registry', cat: 'Clinical', date: 'May 10, 2026', size: '1.8 MB' },
                     { title: 'High-Value Stock Audit', cat: 'Inventory', date: 'May 11, 2026', size: '4.2 MB' },
                  ].map((rep, i) => (
                     <div key={i} className="glass-card rounded-[2rem] p-6 border border-secondary-400/50 bg-white/40 flex items-center justify-between group hover:bg-primary-50/20 transition-all">
                        <div className="flex items-center gap-6">
                           <div className="h-12 w-12 rounded-xl bg-primary-50 flex items-center justify-center">
                              <FileText className="h-6 w-6 text-primary-600" />
                           </div>
                           <div>
                              <h5 className="text-sm font-black text-secondary-900">{rep.title}</h5>
                              <p className="text-[10px] text-secondary-500 font-medium">{rep.cat} • Generated {rep.date}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-4">
                           <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">{rep.size}</span>
                           <button className="p-2.5 rounded-xl bg-secondary-900 text-white hover:bg-black transition-all shadow-lg shadow-secondary-900/10">
                              <Download className="h-4 w-4" />
                           </button>
                        </div>
                     </div>
                  ))}
               </div>
            </div>

            {/* Quick Export Sidebar */}
            <div className="lg:col-span-1 space-y-6">
               <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-secondary-900 text-white shadow-premium">
                  <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center mb-8">
                     <PieChart className="h-7 w-7 text-white" />
                  </div>
                  <h4 className="text-xl font-black mb-2">Custom Audit</h4>
                  <p className="text-sm text-secondary-400 font-medium leading-relaxed mb-10">
                     Generate a real-time snapshot of your hospital's operational health in seconds.
                  </p>
                  <div className="space-y-4">
                     <button className="w-full py-4 rounded-2xl bg-white text-secondary-900 text-[11px] font-black uppercase tracking-widest hover:bg-primary-50 transition-all">
                        Run Comprehensive Audit
                     </button>
                     <button className="w-full py-4 rounded-2xl bg-white/10 text-white text-[11px] font-bold uppercase tracking-widest hover:bg-white/20 transition-all border border-white/10">
                        Schedule Recurring
                     </button>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}
