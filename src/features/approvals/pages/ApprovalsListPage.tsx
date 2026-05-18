import { PageHeader } from "@/components/layout/PageHeader";
import {
   ShieldCheck,
   CheckCircle2,
   XCircle,
   Clock,
   Filter,
   RefreshCw,
   MoreHorizontal,
   FileText,
   User,
   ArrowRight,
   Search,
   AlertCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { approvalsApi, type ApprovalRequest } from "../api/approvals.api";

export function ApprovalsListPage() {
   const [requests, setRequests] = useState<ApprovalRequest[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);

   const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
         const data = await approvalsApi.list();
         setRequests(data.items || []);
      } catch (err: any) {
         setError("Failed to load approval requests. Please check your connection.");
      } finally {
         setIsLoading(false);
      }
   };

   useEffect(() => {
      load();
   }, []);

   const handleAction = async (id: number, action: 'approve' | 'reject') => {
      try {
         if (action === 'approve') {
            await approvalsApi.approve(id);
         } else {
            await approvalsApi.reject(id, "Rejected by admin");
         }
         load(); // Refresh
      } catch (err) {
         alert("Action failed. Please try again.");
      }
   };

   return (
      <div className="space-y-10 animate-fade-in pb-20">
         <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <PageHeader
               title="Approval Gateway"
               description="Centralized oversight for requisitions, clinical orders, and administrative overrides."
            />
            <div className="flex gap-3">
               <button onClick={load} className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400 hover:rotate-180 transition-transform duration-500">
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
               </button>
            </div>
         </div>

         {/* Overview Cards */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card rounded-[2rem] p-8 border border-secondary-400/50 bg-white/40 shadow-premium">
               <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-2">Pending Review</p>
               <h4 className="text-3xl font-black text-amber-500">{requests.filter(r => r.status === 'PENDING').length}</h4>
            </div>
            <div className="glass-card rounded-[2rem] p-8 border border-secondary-400/50 bg-white/40 shadow-premium">
               <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-2">Approved (Today)</p>
               <h4 className="text-3xl font-black text-emerald-600">12</h4>
            </div>
            <div className="glass-card rounded-[2rem] p-8 border border-secondary-400/50 bg-white/40 shadow-premium">
               <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-2">Decision Accuracy</p>
               <h4 className="text-3xl font-black text-secondary-900">98.4%</h4>
            </div>
         </div>

         <div className="space-y-6">
            <div className="flex items-center justify-between">
               <h3 className="text-lg font-bold text-secondary-900 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary-500" />
                  Pending Approvals
               </h3>
               <div className="flex gap-2">
                  <div className="relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
                     <input type="text" placeholder="Search..." className="bg-white/50 border border-secondary-400 rounded-xl pl-10 pr-4 py-2 text-xs outline-none" />
                  </div>
                  <button className="btn-secondary p-2 rounded-xl"><Filter className="h-4 w-4" /></button>
               </div>
            </div>

            {error && (
               <div className="p-6 rounded-[2rem] bg-rose-50 border border-rose-100 text-rose-600 flex items-center gap-4">
                  <AlertCircle className="h-6 w-6" />
                  <p className="text-sm font-bold">{error}</p>
               </div>
            )}

            <div className="grid gap-4">
               {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                     <div key={i} className="h-24 glass-card rounded-[2rem] animate-pulse bg-secondary-100/20" />
                  ))
               ) : requests.length === 0 ? (
                  <div className="p-20 text-center glass-card rounded-[3rem] border border-dashed border-secondary-200">
                     <Clock className="h-12 w-12 mx-auto text-secondary-200 mb-4" />
                     <p className="text-secondary-400 font-bold">No pending approval requests found.</p>
                  </div>
               ) : (
                  requests.map((req) => (
                     <div key={req.id} className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 hover:bg-white/60 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 group">
                        <div className="flex items-center gap-6">
                           <div className="h-14 w-14 rounded-2xl bg-secondary-900 text-white flex items-center justify-center shadow-lg">
                              <FileText className="h-7 w-7" />
                           </div>
                           <div>
                              <div className="flex items-center gap-2 mb-1">
                                 <span className="text-[10px] font-black text-primary-600 uppercase tracking-widest">{req.request_type.replace('_', ' ')}</span>
                                 <span className="h-1 w-1 rounded-full bg-secondary-200" />
                                 <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">{new Date(req.created_at).toLocaleDateString()}</span>
                              </div>
                              <h4 className="text-lg font-black text-secondary-900">{req.title}</h4>
                              <div className="flex items-center gap-2 mt-2">
                                 <div className="h-5 w-5 rounded-full bg-secondary-100 flex items-center justify-center text-[8px] font-bold">JD</div>
                                 <p className="text-xs text-secondary-500 font-medium">Requested by <span className="font-bold text-secondary-700">{req.requester_name}</span></p>
                              </div>
                           </div>
                        </div>

                        <div className="flex items-center gap-4">
                           <div className="text-right mr-4">
                              {req.amount && <p className="text-lg font-black text-secondary-900">${req.amount.toLocaleString()}</p>}
                              <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Decision Pending</p>
                           </div>
                           <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                              <button
                                 onClick={() => handleAction(req.id, 'reject')}
                                 className="h-12 w-12 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white border border-rose-100 flex items-center justify-center transition-all"
                              >
                                 <XCircle className="h-5 w-5" />
                              </button>
                              <button
                                 onClick={() => handleAction(req.id, 'approve')}
                                 className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white border border-emerald-100 flex items-center justify-center transition-all shadow-lg shadow-emerald-500/10"
                              >
                                 <CheckCircle2 className="h-5 w-5" />
                              </button>
                           </div>
                           <button className="h-12 w-12 rounded-xl bg-secondary-50 text-secondary-400 flex items-center justify-center hover:bg-secondary-100 transition-all">
                              <ArrowRight className="h-5 w-5" />
                           </button>
                        </div>
                     </div>
                  ))
               )}
            </div>
         </div>
      </div>
   );
}
