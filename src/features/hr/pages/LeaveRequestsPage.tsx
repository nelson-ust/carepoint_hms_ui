import { PageHeader } from "@/components/layout/PageHeader";
import {
   Calendar,
   Clock,
   User,
   Plus,
   CheckCircle2,
   XCircle,
   AlertCircle,
   RefreshCw,
   Filter,
   ChevronRight,
   MoreVertical,
} from "lucide-react";
import { useState, useEffect } from "react";
import { leaveApi, type LeaveRequest } from "../api/leave.api";

export function LeaveRequestsPage() {
   const [requests, setRequests] = useState<LeaveRequest[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);

   const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
         const data = await leaveApi.list();
         setRequests(data.items || []);
      } catch (err: any) {
         setError("Failed to synchronize with the leave registry.");
      } finally {
         setIsLoading(false);
      }
   };

   useEffect(() => {
      load();
   }, []);

   const getStatusColor = (status: string) => {
      switch (status) {
         case 'PENDING': return 'bg-amber-50 text-amber-600 border-amber-100';
         case 'APPROVED': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
         case 'REJECTED': return 'bg-rose-50 text-rose-600 border-rose-100';
         default: return 'bg-secondary-50 text-secondary-400 border-secondary-400';
      }
   };

   return (
      <div className="space-y-10 animate-fade-in pb-20">
         <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <PageHeader
               title="Leave Management"
               description="Track and process staff absence requests across all departments."
            />
            <div className="flex gap-3">
               <button onClick={load} className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400 hover:rotate-180 transition-transform duration-500">
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
               </button>
               <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
                  <Plus className="h-5 w-5" />
                  <span className="font-bold">New Request</span>
               </button>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
            {/* Statistics Overview */}
            <div className="lg:col-span-1 space-y-6">
               <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 shadow-premium">
                  <h4 className="text-[10px] font-bold text-secondary-400 uppercase tracking-[0.2em] mb-6">Attendance Pulse</h4>
                  <div className="space-y-6">
                     <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-secondary-700">Currently on Leave</span>
                        <span className="text-xl font-black text-secondary-900">12</span>
                     </div>
                     <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-secondary-700">Pending Approval</span>
                        <span className="text-xl font-black text-amber-500">5</span>
                     </div>
                     <div className="pt-6 border-t border-secondary-400">
                        <button className="w-full btn-secondary py-3 text-[10px] font-black uppercase tracking-widest">
                           View Staff Roster
                        </button>
                     </div>
                  </div>
               </div>
            </div>

            {/* Requests Table */}
            <div className="lg:col-span-3 space-y-6">
               {error && (
                  <div className="p-6 rounded-[2rem] bg-rose-50 border border-rose-100 text-rose-600 flex items-center gap-4 animate-shake">
                     <AlertCircle className="h-6 w-6" />
                     <p className="text-sm font-bold">{error}</p>
                  </div>
               )}

               <div className="glass-card rounded-[2.5rem] overflow-hidden border border-secondary-400/50 shadow-premium bg-white/40">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="bg-secondary-900/5">
                           <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Employee</th>
                           <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Period</th>
                           <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Type</th>
                           <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Status</th>
                           <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-right">Action</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-secondary-100/50">
                        {isLoading ? (
                           Array.from({ length: 5 }).map((_, i) => (
                              <tr key={i} className="animate-pulse">
                                 <td colSpan={5} className="px-8 py-6"><div className="h-10 bg-secondary-100/30 rounded-xl" /></td>
                              </tr>
                           ))
                        ) : requests.length === 0 ? (
                           <tr>
                              <td colSpan={5} className="px-8 py-32 text-center">
                                 <Calendar className="h-12 w-12 mx-auto text-secondary-200 mb-4" />
                                 <h4 className="text-lg font-bold text-secondary-900">No Active Requests</h4>
                                 <p className="text-sm text-secondary-400 mt-2">Staff leave applications will appear here.</p>
                              </td>
                           </tr>
                        ) : (
                           requests.map((req) => (
                              <tr key={req.id} className="hover:bg-primary-50/20 transition-all group">
                                 <td className="px-8 py-6">
                                    <div className="flex items-center gap-3">
                                       <div className="h-9 w-9 rounded-xl bg-secondary-50 flex items-center justify-center text-secondary-400 font-bold text-xs">
                                          {req.staff_name[0]}
                                       </div>
                                       <span className="text-sm font-bold text-secondary-900">{req.staff_name}</span>
                                    </div>
                                 </td>
                                 <td className="px-8 py-6">
                                    <div className="flex flex-col">
                                       <span className="text-sm font-black text-secondary-900">{new Date(req.start_date).toLocaleDateString()}</span>
                                       <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Until {new Date(req.end_date).toLocaleDateString()}</span>
                                    </div>
                                 </td>
                                 <td className="px-8 py-6">
                                    <span className="text-xs font-medium text-secondary-700">{req.leave_type}</span>
                                 </td>
                                 <td className="px-8 py-6">
                                    <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${getStatusColor(req.status)}`}>
                                       {req.status}
                                    </span>
                                 </td>
                                 <td className="px-8 py-6 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                       <button className="p-2.5 rounded-xl bg-white border border-secondary-400 text-secondary-400 hover:text-primary-600 transition-all shadow-sm">
                                          <CheckCircle2 className="h-4 w-4" />
                                       </button>
                                       <button className="p-2.5 rounded-xl bg-white border border-secondary-400 text-secondary-400 hover:text-rose-600 transition-all shadow-sm">
                                          <XCircle className="h-4 w-4" />
                                       </button>
                                       <button className="p-2.5 rounded-xl bg-secondary-900 text-white shadow-lg shadow-secondary-900/10">
                                          <MoreVertical className="h-4 w-4" />
                                       </button>
                                    </div>
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
