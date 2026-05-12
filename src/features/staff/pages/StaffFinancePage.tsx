import { PageHeader } from "@/components/layout/PageHeader";
import {
  Wallet,
  Receipt,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { useState, useEffect } from "react";
import { staffFinanceApi, type SalaryAdvance, type Reimbursement } from "../api/staff-finance.api";

export function StaffFinancePage() {
  const [activeTab, setActiveTab] = useState<'ADVANCES' | 'REIMBURSEMENTS'>('ADVANCES');
  const [advances, setAdvances] = useState<SalaryAdvance[]>([]);
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (activeTab === 'ADVANCES') {
        const data = await staffFinanceApi.listAdvances();
        setAdvances(data.items || []);
      } else {
        const data = await staffFinanceApi.listReimbursements();
        setReimbursements(data.items || []);
      }
    } catch (err: any) {
      setError("Failed to synchronize with the staff ledger.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [activeTab]);

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Staff Financial Services"
          description="Manage salary advances, expense reimbursements, and internal fiscal requests."
        />
        <div className="flex gap-3">
          <button onClick={load} className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-100 transition-all">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
            <Plus className="h-5 w-5" />
            <span className="font-bold">New Request</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
         {/* Ledger Summary */}
         <div className="lg:col-span-1 space-y-6">
            <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium">
               <h4 className="text-[10px] font-bold text-secondary-400 uppercase tracking-[0.2em] mb-8">Disbursement Pulse</h4>
               <div className="space-y-10">
                  <div>
                     <p className="text-sm font-bold text-secondary-500 mb-1">Total Outstanding Advances</p>
                     <p className="text-3xl font-black text-secondary-900">₦2,450,000</p>
                     <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-rose-500">
                        <TrendingUp className="h-3 w-3" />
                        <span>+12% vs last month</span>
                     </div>
                  </div>
                  <div>
                     <p className="text-sm font-bold text-secondary-500 mb-1">Pending Reimbursements</p>
                     <p className="text-3xl font-black text-amber-500">₦182,500</p>
                  </div>
                  <div className="pt-6 border-t border-secondary-100">
                     <button className="w-full btn-secondary py-3 text-[10px] font-black uppercase tracking-widest bg-secondary-900 text-white border-none shadow-lg shadow-secondary-900/10 hover:bg-black">
                        Reconcile Ledger
                     </button>
                  </div>
               </div>
            </div>
         </div>

         {/* Transactions */}
         <div className="lg:col-span-3 space-y-8">
            <div className="flex items-center gap-1 bg-secondary-100/50 p-1 rounded-2xl w-fit">
               <button 
                  onClick={() => setActiveTab('ADVANCES')}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'ADVANCES' ? 'bg-white text-primary-600 shadow-sm' : 'text-secondary-400 hover:text-secondary-600'}`}
               >
                  Salary Advances
               </button>
               <button 
                  onClick={() => setActiveTab('REIMBURSEMENTS')}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'REIMBURSEMENTS' ? 'bg-white text-primary-600 shadow-sm' : 'text-secondary-400 hover:text-secondary-600'}`}
               >
                  Expense Claims
               </button>
            </div>

            {error && (
               <div className="p-6 rounded-[2rem] bg-rose-50 border border-rose-100 text-rose-600 flex items-center gap-4 animate-shake">
                  <AlertCircle className="h-6 w-6" />
                  <p className="text-sm font-bold">{error}</p>
               </div>
            )}

            <div className="glass-card rounded-[2.5rem] overflow-hidden border border-secondary-100/50 shadow-premium bg-white/40">
               <table className="w-full text-left">
                  <thead>
                     <tr className="bg-secondary-900/5">
                        <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Staff</th>
                        <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Details</th>
                        <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Amount</th>
                        <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Status</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary-100/50">
                     {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                           <tr key={i} className="animate-pulse">
                              <td colSpan={4} className="px-8 py-6"><div className="h-10 bg-secondary-100/30 rounded-xl" /></td>
                           </tr>
                        ))
                     ) : (activeTab === 'ADVANCES' ? advances : reimbursements).length === 0 ? (
                        <tr>
                           <td colSpan={4} className="px-8 py-32 text-center">
                              <DollarSign className="h-12 w-12 mx-auto text-secondary-200 mb-4" />
                              <h4 className="text-lg font-bold text-secondary-900">No Pending Requests</h4>
                              <p className="text-sm text-secondary-400 mt-2">Financial requests will appear here after submission.</p>
                           </td>
                        </tr>
                     ) : (
                        (activeTab === 'ADVANCES' ? advances : reimbursements).map((item: any) => (
                           <tr key={item.id} className="hover:bg-primary-50/20 transition-all group">
                              <td className="px-8 py-6">
                                 <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-xl bg-secondary-50 flex items-center justify-center text-secondary-400 font-bold text-xs uppercase">
                                       {item.staff_name[0]}
                                    </div>
                                    <span className="text-sm font-bold text-secondary-900">{item.staff_name}</span>
                                 </div>
                              </td>
                              <td className="px-8 py-6">
                                 <div className="flex flex-col">
                                    <span className="text-xs font-medium text-secondary-700 truncate max-w-[200px]">
                                       {activeTab === 'ADVANCES' ? item.reason : item.description}
                                    </span>
                                    <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mt-1">
                                       {new Date(item.created_at).toLocaleDateString()}
                                    </span>
                                 </div>
                              </td>
                              <td className="px-8 py-6">
                                 <span className="text-sm font-black text-secondary-900">
                                    ₦{item.amount.toLocaleString()}
                                 </span>
                              </td>
                              <td className="px-8 py-6">
                                 <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                    item.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                    item.status === 'PENDING' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                    'bg-rose-50 text-rose-600 border-rose-100'
                                 }`}>
                                    {item.status}
                                 </span>
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
