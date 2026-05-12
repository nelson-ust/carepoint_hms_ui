import { PageHeader } from "@/components/layout/PageHeader";
import {
  Percent,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
  FileText,
  AlertCircle,
  CheckCircle2,
  MoreVertical,
  ShieldCheck,
  BarChart3,
} from "lucide-react";
import { useState, useEffect } from "react";
import { taxApi, type TaxRule } from "../api/tax.api";

export function TaxDashboardPage() {
  const [rules, setRules] = useState<TaxRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await taxApi.listRules();
      setRules(data.items || []);
    } catch (err: any) {
      setError("Unable to sync tax configurations from the fiscal server.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Fiscal & Tax Rules"
          description="Manage VAT, service taxes, and automated fiscal reporting rules."
        />
        <div className="flex gap-3">
          <button onClick={load} className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-100 transition-all active:scale-95">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
            <Plus className="h-5 w-5" />
            <span className="font-bold">Add Tax Rule</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
         {/* Fiscal Summary */}
         <div className="lg:col-span-1 space-y-6">
            <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium relative overflow-hidden">
               <div className="absolute top-0 right-0 p-6 opacity-10">
                  <ShieldCheck className="h-24 w-24" />
               </div>
               <h4 className="text-[10px] font-bold text-secondary-400 uppercase tracking-[0.2em] mb-8">Fiscal Compliance</h4>
               <div className="space-y-8">
                  <div>
                     <p className="text-sm font-bold text-secondary-500 mb-1">Total Tax Liability (MTD)</p>
                     <p className="text-3xl font-black text-secondary-900">₦482,900.00</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Status</p>
                        <p className="text-xs font-bold text-emerald-700">COMPLIANT</p>
                     </div>
                     <div className="p-4 rounded-2xl bg-primary-50 border border-primary-100">
                        <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest mb-1">Audits</p>
                        <p className="text-xs font-bold text-primary-700">CLEAN</p>
                     </div>
                  </div>
                  <button className="w-full btn-secondary py-3 gap-2 text-[10px] font-black uppercase tracking-widest">
                     <FileText className="h-4 w-4" />
                     Generate Audit Export
                  </button>
               </div>
            </div>

            <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-primary-900 text-white shadow-xl shadow-primary-900/20">
               <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
                  <BarChart3 className="h-6 w-6" />
               </div>
               <h4 className="text-lg font-bold mb-2">Tax Analytics</h4>
               <p className="text-sm text-primary-100 leading-relaxed mb-6">
                  Real-time breakdown of tax collection by department and service point.
               </p>
               <button className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 hover:translate-x-2 transition-transform">
                  Explore Insights →
               </button>
            </div>
         </div>

         {/* Active Tax Rules */}
         <div className="lg:col-span-2 space-y-6">
            <h3 className="text-lg font-black text-secondary-900 flex items-center gap-3">
               <Percent className="h-5 w-5 text-primary-500" />
               Active Tax Configurations
            </h3>

            {error && (
               <div className="p-6 rounded-[2rem] bg-rose-50 border border-rose-100 text-rose-600 flex items-center gap-4 animate-shake">
                  <AlertCircle className="h-6 w-6" />
                  <p className="text-sm font-bold">{error}</p>
               </div>
            )}

            <div className="space-y-4">
               {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                     <div key={i} className="h-32 bg-white/40 rounded-[2.5rem] animate-pulse" />
                  ))
               ) : rules.length === 0 ? (
                  <div className="py-24 text-center bg-white/20 rounded-[3rem] border-2 border-dashed border-secondary-100">
                     <Percent className="h-16 w-16 mx-auto text-secondary-100 mb-6" />
                     <h4 className="text-xl font-bold text-secondary-900">No Tax Rules Defined</h4>
                     <p className="text-secondary-500 mt-2">Fiscal calculations will default to zero.</p>
                  </div>
               ) : (
                  rules.map((rule) => (
                     <div key={rule.id} className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40 hover:bg-white/60 transition-all group">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-5">
                              <div className="h-14 w-14 rounded-2xl bg-secondary-900 text-white flex items-center justify-center shadow-lg">
                                 <span className="text-lg font-black">{rule.rate_percentage}%</span>
                              </div>
                              <div>
                                 <h4 className="text-lg font-black text-secondary-900">{rule.name}</h4>
                                 <div className="flex items-center gap-3 mt-1">
                                    <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">{rule.tax_code}</span>
                                    {rule.is_active && (
                                       <span className="flex items-center gap-1 text-[8px] font-black text-emerald-500 uppercase tracking-widest">
                                          <CheckCircle2 className="h-3 w-3" /> Active
                                       </span>
                                    )}
                                 </div>
                              </div>
                           </div>
                           <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all">
                              <button className="p-3 hover:bg-secondary-100 rounded-2xl transition-all">
                                 <SettingsIcon className="h-5 w-5 text-secondary-400" />
                              </button>
                              <button className="p-3 hover:bg-secondary-100 rounded-2xl transition-all">
                                 <MoreVertical className="h-5 w-5 text-secondary-400" />
                              </button>
                           </div>
                        </div>
                        
                        <div className="mt-8 flex flex-wrap gap-2">
                           {rule.apply_to_consultations && <span className="px-3 py-1 rounded-full bg-secondary-50 text-secondary-500 text-[9px] font-bold uppercase tracking-widest">Consultations</span>}
                           {rule.apply_to_drugs && <span className="px-3 py-1 rounded-full bg-secondary-50 text-secondary-500 text-[9px] font-bold uppercase tracking-widest">Pharmacy</span>}
                           {rule.apply_to_lab_tests && <span className="px-3 py-1 rounded-full bg-secondary-50 text-secondary-500 text-[9px] font-bold uppercase tracking-widest">Laboratory</span>}
                        </div>
                     </div>
                  ))
               )}
            </div>
         </div>
      </div>
    </div>
  );
}
