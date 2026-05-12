import { PageHeader } from "@/components/layout/PageHeader";
import {
  Receipt,
  Plus,
  Search,
  Filter,
  RefreshCw,
  MoreHorizontal,
  CreditCard,
  History,
  TrendingUp,
  ChevronRight,
  Download,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { routes } from "@/config/routes";
import { CardSkeleton } from "@/components/ui/Skeleton";

export function BillingListPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Patient Billing"
          description="Manage invoices, billing cycles, and payment charges for all clinical services."
        />
        <div className="flex gap-3">
          <button className="btn-secondary gap-3 py-3 px-6">
            <History className="h-4 w-4" />
            <span className="font-bold">Audit Logs</span>
          </button>
          <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
            <Plus className="h-5 w-5" />
            <span className="font-bold">Create Invoice</span>
          </button>
        </div>
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="glass-card rounded-[2rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium">
            <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-2">Total Outstanding</p>
            <h4 className="text-3xl font-black text-rose-600">$12,482.50</h4>
            <p className="text-[10px] text-rose-500 font-bold mt-2 flex items-center gap-1">
               <AlertCircle className="h-3 w-3" /> 15 Invoices Overdue
            </p>
         </div>
         <div className="glass-card rounded-[2rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium">
            <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-2">Collected Today</p>
            <h4 className="text-3xl font-black text-emerald-600">$4,200.00</h4>
            <p className="text-[10px] text-emerald-600 font-bold mt-2 flex items-center gap-1">
               <TrendingUp className="h-3 w-3" /> +18% from yesterday
            </p>
         </div>
         <div className="glass-card rounded-[2rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium">
            <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-2">Pending Approvals</p>
            <h4 className="text-3xl font-black text-secondary-900">8</h4>
            <p className="text-[10px] text-secondary-400 font-bold mt-2">Insurance confirmation needed</p>
         </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
           <h3 className="text-lg font-bold text-secondary-900 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary-500" />
              Recent Invoices
           </h3>
           <div className="flex gap-2">
              <button className="btn-secondary p-2.5 rounded-xl"><Filter className="h-4 w-4" /></button>
              <button className="btn-secondary p-2.5 rounded-xl"><RefreshCw className="h-4 w-4" /></button>
           </div>
        </div>

        <div className="glass-card rounded-[2.5rem] overflow-hidden border border-secondary-100/50 shadow-premium bg-white/40">
           <div className="overflow-x-auto">
              <table className="w-full text-left">
                 <thead>
                    <tr className="bg-secondary-900/5">
                       <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Invoice</th>
                       <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Patient</th>
                       <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Amount</th>
                       <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Status</th>
                       <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-right">Action</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-secondary-100/50">
                    {[1, 2, 3, 4, 5].map((i) => (
                       <tr 
                          key={i} 
                          onClick={() => navigate(routes.billing + `/INV-2026-00${i}`)}
                          className="hover:bg-primary-50/30 transition-all group cursor-pointer"
                       >
                          <td className="px-8 py-6">
                             <p className="text-sm font-bold text-secondary-900">INV-2026-00{i}</p>
                             <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-tighter mt-0.5">May 12, 2026</p>
                          </td>
                          <td className="px-8 py-6">
                             <p className="text-sm font-bold text-secondary-900">Patient #{100 + i}</p>
                             <p className="text-[10px] font-medium text-secondary-500">Consultation Fee</p>
                          </td>
                          <td className="px-8 py-6 text-sm font-black text-secondary-900">
                             ${(150 * i).toFixed(2)}
                          </td>
                          <td className="px-8 py-6">
                             <span className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border ${i % 2 === 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                {i % 2 === 0 ? 'PAID' : 'PENDING'}
                             </span>
                          </td>
                          <td className="px-8 py-6 text-right">
                             <div className="flex items-center justify-end gap-2">
                                <button className="p-2 hover:bg-secondary-100 rounded-xl text-secondary-400">
                                   <Download className="h-4 w-4" />
                                </button>
                                <button className="p-2 hover:bg-secondary-100 rounded-xl text-secondary-400">
                                   <MoreHorizontal className="h-4 w-4" />
                                </button>
                             </div>
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      </div>
    </div>
  );
}
