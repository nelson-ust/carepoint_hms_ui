import { PageHeader } from "@/components/layout/PageHeader";
import {
   ShieldCheck,
   Plus,
   Search,
   Filter,
   RefreshCw,
   MoreHorizontal,
   Building2,
   FileText,
   CheckCircle2,
   Clock,
   XCircle,
   TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { CardSkeleton } from "@/components/ui/Skeleton";

export function InsuranceClaimsPage() {
   const [isLoading, setIsLoading] = useState(false);

   return (
      <div className="space-y-10 animate-fade-in pb-20">
         <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <PageHeader
               title="Insurance & Claims"
               description="Manage healthcare insurance providers, claim submissions, and reimbursement tracking."
            />
            <div className="flex gap-3">
               <button className="btn-secondary gap-3 py-3 px-6">
                  <Building2 className="h-4 w-4" />
                  <span className="font-bold">Providers</span>
               </button>
               <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
                  <Plus className="h-5 w-5" />
                  <span className="font-bold">New Claim</span>
               </button>
            </div>
         </div>

         {/* Claims KPI Dashboard */}
         <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="glass-card rounded-[2rem] p-6 border border-secondary-400/50 bg-white/40 shadow-premium">
               <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-2">Total Active Claims</p>
               <h4 className="text-2xl font-black text-secondary-900">124</h4>
            </div>
            <div className="glass-card rounded-[2rem] p-6 border border-secondary-400/50 bg-white/40 shadow-premium">
               <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-2">Pending Approval</p>
               <h4 className="text-2xl font-black text-amber-500">42</h4>
            </div>
            <div className="glass-card rounded-[2rem] p-6 border border-secondary-400/50 bg-white/40 shadow-premium">
               <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-2">Settled Value (MTD)</p>
               <h4 className="text-2xl font-black text-emerald-600">$84,200</h4>
            </div>
            <div className="glass-card rounded-[2rem] p-6 border border-secondary-400/50 bg-white/40 shadow-premium">
               <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-2">Rejection Rate</p>
               <h4 className="text-2xl font-black text-rose-500">2.4%</h4>
            </div>
         </div>

         <div className="space-y-6">
            <div className="flex items-center justify-between">
               <h3 className="text-lg font-bold text-secondary-900 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary-500" />
                  Claim History
               </h3>
               <div className="flex gap-2">
                  <div className="relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
                     <input
                        type="text"
                        placeholder="Search claims..."
                        className="bg-white/50 border border-secondary-400 rounded-xl pl-10 pr-4 py-2 text-xs font-bold focus:ring-2 focus:ring-primary-500/20 transition-all outline-none"
                     />
                  </div>
                  <button className="btn-secondary p-2 rounded-xl"><Filter className="h-4 w-4" /></button>
               </div>
            </div>

            <div className="glass-card rounded-[2.5rem] overflow-hidden border border-secondary-400/50 shadow-premium bg-white/40">
               <table className="w-full text-left">
                  <thead>
                     <tr className="bg-secondary-900/5">
                        <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Claim ID</th>
                        <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Patient</th>
                        <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Provider</th>
                        <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Amount</th>
                        <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Status</th>
                        <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-right">Actions</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary-100/50">
                     {[
                        { id: 'CLM-001', patient: 'Michael Scott', provider: 'Blue Shield', amount: 1250, status: 'APPROVED' },
                        { id: 'CLM-002', patient: 'Pam Beesly', provider: 'AXA Mansard', amount: 450, status: 'PENDING' },
                        { id: 'CLM-003', patient: 'Jim Halpert', provider: 'Allianz', amount: 3200, status: 'SUBMITTED' },
                        { id: 'CLM-004', patient: 'Dwight Schrute', provider: 'Blue Shield', amount: 800, status: 'REJECTED' },
                        { id: 'CLM-005', patient: 'Stanley Hudson', provider: 'AXA Mansard', amount: 150, status: 'PAID' },
                     ].map((claim) => (
                        <tr key={claim.id} className="hover:bg-primary-50/30 transition-all group">
                           <td className="px-8 py-6 font-bold text-secondary-900 text-sm">{claim.id}</td>
                           <td className="px-8 py-6 text-sm font-medium text-secondary-700">{claim.patient}</td>
                           <td className="px-8 py-6">
                              <div className="flex items-center gap-2">
                                 <Building2 className="h-3 w-3 text-secondary-400" />
                                 <span className="text-xs font-bold text-secondary-600">{claim.provider}</span>
                              </div>
                           </td>
                           <td className="px-8 py-6 text-sm font-black text-secondary-900">${claim.amount.toLocaleString()}</td>
                           <td className="px-8 py-6">
                              <span className={`px-3 py-1 rounded-xl text-[10px] font-black flex items-center gap-1 w-fit
                             ${claim.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                    claim.status === 'PENDING' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                       claim.status === 'REJECTED' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                                          'bg-secondary-100 text-secondary-600'}
                          `}>
                                 {claim.status === 'APPROVED' && <CheckCircle2 className="h-3 w-3" />}
                                 {claim.status === 'PENDING' && <Clock className="h-3 w-3" />}
                                 {claim.status === 'REJECTED' && <XCircle className="h-3 w-3" />}
                                 {claim.status}
                              </span>
                           </td>
                           <td className="px-8 py-6 text-right">
                              <button className="p-2 hover:bg-secondary-100 rounded-xl text-secondary-400 transition-all">
                                 <MoreHorizontal className="h-4 w-4" />
                              </button>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
   );
}
