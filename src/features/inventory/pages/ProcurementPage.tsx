import { PageHeader } from "@/components/layout/PageHeader";
import {
   ShoppingCart,
   Plus,
   RefreshCw,
   FileText,
   AlertCircle,
   Truck,
   CheckCircle2,
   XCircle,
   Clock,
   ChevronRight,
   MoreVertical,
   Layers,
   ArrowUpRight,
} from "lucide-react";
import { useState, useEffect } from "react";
import { procurementApi, type Requisition } from "../api/procurement.api";

export function ProcurementPage() {
   const [requisitions, setRequisitions] = useState<Requisition[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);

   const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
         const data = await procurementApi.listRequisitions();
         setRequisitions(data.items || []);
      } catch (err: any) {
         setError("Failed to fetch procurement requisitions.");
      } finally {
         setIsLoading(false);
      }
   };

   useEffect(() => {
      load();
   }, []);

   const getStatusStyle = (status: string) => {
      switch (status) {
         case 'APPROVED': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
         case 'PENDING': return 'bg-amber-50 text-amber-600 border-amber-100';
         case 'REJECTED': return 'bg-rose-50 text-rose-600 border-rose-100';
         case 'FULFILLED': return 'bg-primary-50 text-primary-600 border-primary-100';
         default: return 'bg-secondary-50 text-secondary-400 border-secondary-400';
      }
   };

   return (
      <div className="space-y-10 animate-fade-in pb-20">
         <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <PageHeader
               title="Procurement & Requisitions"
               description="Manage stock requests, purchase orders, and supplier deliveries."
            />
            <div className="flex gap-3">
               <button onClick={load} className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400 transition-all active:scale-95">
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
               </button>
               <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
                  <Plus className="h-5 w-5" />
                  <span className="font-bold">Create Requisition</span>
               </button>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
            {/* Procurement Stats */}
            <div className="lg:col-span-1 space-y-6">
               <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 shadow-premium">
                  <h4 className="text-[10px] font-bold text-secondary-400 uppercase tracking-[0.2em] mb-8">Supply Chain Health</h4>
                  <div className="space-y-8">
                     <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                           <span className="text-sm font-bold text-secondary-700">Open Orders</span>
                           <span className="text-2xl font-black text-secondary-900">14</span>
                        </div>
                        <Truck className="h-8 w-8 text-secondary-200" />
                     </div>
                     <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                           <span className="text-sm font-bold text-secondary-700">Pending Approval</span>
                           <span className="text-2xl font-black text-amber-500">6</span>
                        </div>
                        <Clock className="h-8 w-8 text-amber-200" />
                     </div>
                     <div className="pt-6 border-t border-secondary-400">
                        <button className="w-full btn-secondary py-3 text-[10px] font-black uppercase tracking-widest gap-2 flex items-center justify-center">
                           <FileText className="h-4 w-4" />
                           Purchase Order Registry
                        </button>
                     </div>
                  </div>
               </div>

               <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-primary-900 text-white shadow-xl shadow-primary-900/20">
                  <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
                     <ShoppingCart className="h-6 w-6" />
                  </div>
                  <h4 className="text-lg font-bold mb-2">Inventory Re-order</h4>
                  <p className="text-sm text-primary-100 leading-relaxed mb-6">
                     24 items are below the safety threshold and require replenishment.
                  </p>
                  <button className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 hover:translate-x-2 transition-transform">
                     Generate Auto-Requisition →
                  </button>
               </div>
            </div>

            {/* Requisitions List */}
            <div className="lg:col-span-3 space-y-6">
               <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-secondary-900 flex items-center gap-3">
                     <Layers className="h-5 w-5 text-primary-500" />
                     Recent Requisitions
                  </h3>
                  <div className="flex items-center gap-2">
                     <span className="text-xs font-bold text-secondary-400">Sort by:</span>
                     <select className="bg-transparent text-xs font-bold text-secondary-900 outline-none">
                        <option>Newest First</option>
                        <option>Priority</option>
                        <option>Amount</option>
                     </select>
                  </div>
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
                           <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Request ID</th>
                           <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Department</th>
                           <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Value</th>
                           <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Status</th>
                           <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-right">Details</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-secondary-100/50">
                        {isLoading ? (
                           Array.from({ length: 5 }).map((_, i) => (
                              <tr key={i} className="animate-pulse">
                                 <td colSpan={5} className="px-8 py-6"><div className="h-10 bg-secondary-100/30 rounded-xl" /></td>
                              </tr>
                           ))
                        ) : requisitions.length === 0 ? (
                           <tr>
                              <td colSpan={5} className="px-8 py-32 text-center">
                                 <ShoppingCart className="h-12 w-12 mx-auto text-secondary-200 mb-4" />
                                 <h4 className="text-lg font-bold text-secondary-900">No Requisitions Found</h4>
                                 <p className="text-sm text-secondary-400 mt-2">Active stock requests will appear here.</p>
                              </td>
                           </tr>
                        ) : (
                           requisitions.map((req) => (
                              <tr key={req.id} className="hover:bg-primary-50/20 transition-all group">
                                 <td className="px-8 py-6">
                                    <div className="flex flex-col">
                                       <span className="text-sm font-black text-secondary-900">{req.request_no}</span>
                                       <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">{new Date(req.created_at).toLocaleDateString()}</span>
                                    </div>
                                 </td>
                                 <td className="px-8 py-6">
                                    <span className="text-xs font-bold text-secondary-700 uppercase tracking-widest">{req.department_name}</span>
                                 </td>
                                 <td className="px-8 py-6">
                                    <span className="text-sm font-black text-secondary-900">₦{req.total_amount.toLocaleString()}</span>
                                 </td>
                                 <td className="px-8 py-6">
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusStyle(req.status)}`}>
                                       {req.status}
                                    </span>
                                 </td>
                                 <td className="px-8 py-6 text-right">
                                    <button className="h-10 w-10 rounded-xl bg-secondary-50 flex items-center justify-center text-secondary-400 hover:bg-primary-500 hover:text-white transition-all shadow-sm">
                                       <ArrowUpRight className="h-4 w-4" />
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
