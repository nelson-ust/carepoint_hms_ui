import { PageHeader } from "@/components/layout/PageHeader";
import {
   Clock,
   Plus,
   RefreshCw,
   CheckCircle2,
   XCircle,
   AlertCircle,
   Calendar,
   MoreVertical,
   Filter,
   User,
   ChevronRight,
} from "lucide-react";
import { useState, useEffect } from "react";
import { timesheetsApi, type Timesheet } from "../../hr/api/timesheets.api";

export function TimesheetsPage() {
   const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);

   const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
         const data = await timesheetsApi.list();
         setTimesheets(data.items || []);
      } catch (err: any) {
         setError("Failed to synchronize with the time tracking server.");
      } finally {
         setIsLoading(false);
      }
   };

   useEffect(() => {
      load();
   }, []);

   const getStatusColor = (status: string) => {
      switch (status) {
         case 'APPROVED': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
         case 'SUBMITTED': return 'bg-primary-50 text-primary-600 border-primary-100';
         case 'REJECTED': return 'bg-rose-50 text-rose-600 border-rose-100';
         default: return 'bg-secondary-50 text-secondary-400 border-secondary-400';
      }
   };

   return (
      <div className="space-y-10 animate-fade-in pb-20">
         <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <PageHeader
               title="Staff Timesheets"
               description="Review and approve hours worked, overtime, and night shifts across the facility."
            />
            <div className="flex gap-3">
               <button onClick={load} className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400 transition-all hover:rotate-180 duration-500">
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
               </button>
               <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
                  <Plus className="h-5 w-5" />
                  <span className="font-bold">Log Hours</span>
               </button>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
            {/* Time Stats */}
            <div className="lg:col-span-1 space-y-6">
               <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 shadow-premium">
                  <div className="h-16 w-16 rounded-2xl bg-primary-500 text-white flex items-center justify-center mb-6 shadow-lg shadow-primary-500/20">
                     <Clock className="h-8 w-8" />
                  </div>
                  <h4 className="text-xl font-black text-secondary-900 mb-2">Cycle Tracking</h4>
                  <p className="text-xs text-secondary-500 leading-relaxed mb-8">
                     Current Payroll Cycle: **May 1st - May 15th**. All timesheets must be submitted by the 16th.
                  </p>
                  <div className="space-y-6">
                     <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-secondary-700">Approved</span>
                        <span className="text-xl font-black text-emerald-500">42</span>
                     </div>
                     <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-secondary-700">Pending</span>
                        <span className="text-xl font-black text-amber-500">12</span>
                     </div>
                     <div className="pt-6 border-t border-secondary-400">
                        <button className="w-full btn-secondary py-3 text-[10px] font-black uppercase tracking-widest">
                           Export for Payroll
                        </button>
                     </div>
                  </div>
               </div>
            </div>

            {/* Timesheets Registry */}
            <div className="lg:col-span-3 space-y-6">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <button className="px-4 py-2 rounded-xl bg-primary-500 text-white text-[10px] font-bold uppercase tracking-widest shadow-md shadow-primary-500/10">All Entries</button>
                     <button className="px-4 py-2 rounded-xl text-secondary-400 text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-all">Pending Approval</button>
                  </div>
                  <button className="btn-secondary py-2.5 px-5 rounded-2xl gap-2 text-[10px] font-bold uppercase tracking-widest">
                     <Filter className="h-3.5 w-3.5" />
                     Filter By Dept
                  </button>
               </div>

               {error && (
                  <div className="p-6 rounded-[2rem] bg-rose-50 border border-rose-100 text-rose-600 flex items-center gap-4">
                     <AlertCircle className="h-6 w-6" />
                     <p className="text-sm font-bold">{error}</p>
                  </div>
               )}

               <div className="glass-card rounded-[2.5rem] overflow-hidden border border-secondary-400/50 shadow-premium bg-white/40">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="bg-secondary-900/5">
                           <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Staff Member</th>
                           <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Period</th>
                           <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Regular / OT</th>
                           <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Status</th>
                           <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-right">Review</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-secondary-100/50">
                        {isLoading ? (
                           Array.from({ length: 5 }).map((_, i) => (
                              <tr key={i} className="animate-pulse">
                                 <td colSpan={5} className="px-8 py-6"><div className="h-10 bg-secondary-100/30 rounded-xl" /></td>
                              </tr>
                           ))
                        ) : timesheets.length === 0 ? (
                           <tr>
                              <td colSpan={5} className="px-8 py-32 text-center">
                                 <Clock className="h-12 w-12 mx-auto text-secondary-200 mb-4" />
                                 <h4 className="text-lg font-bold text-secondary-900">No Timesheets Recorded</h4>
                                 <p className="text-sm text-secondary-400 mt-2">Staff attendance records will appear here.</p>
                              </td>
                           </tr>
                        ) : (
                           timesheets.map((ts) => (
                              <tr key={ts.id} className="hover:bg-primary-50/20 transition-all group">
                                 <td className="px-8 py-6">
                                    <div className="flex items-center gap-3">
                                       <div className="h-9 w-9 rounded-xl bg-secondary-900 text-white flex items-center justify-center text-[10px] font-black">
                                          {ts.staff_name[0]}
                                       </div>
                                       <span className="text-sm font-bold text-secondary-900">{ts.staff_name}</span>
                                    </div>
                                 </td>
                                 <td className="px-8 py-6">
                                    <span className="text-xs font-medium text-secondary-700">
                                       {new Date(ts.period_start).toLocaleDateString()} - {new Date(ts.period_end).toLocaleDateString()}
                                    </span>
                                 </td>
                                 <td className="px-8 py-6">
                                    <div className="flex items-center gap-2">
                                       <span className="text-sm font-black text-secondary-900">40h</span>
                                       <span className="text-[10px] font-bold text-amber-500">/ 5.5h OT</span>
                                    </div>
                                 </td>
                                 <td className="px-8 py-6">
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusColor(ts.status)}`}>
                                       {ts.status}
                                    </span>
                                 </td>
                                 <td className="px-8 py-6 text-right">
                                    <button className="p-3 hover:bg-secondary-100 rounded-2xl transition-all text-secondary-400 group-hover:text-primary-600 shadow-sm">
                                       <ChevronRight className="h-5 w-5" />
                                    </button>
                                 </td>
                              </tr>
                           ))
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>
      </div>
   );
}
