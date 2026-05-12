import { PageHeader } from "@/components/layout/PageHeader";
import {
  Globe,
  ShieldCheck,
  ShieldAlert,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  ExternalLink,
  MoreHorizontal,
  ChevronRight,
  Info,
  Lock,
} from "lucide-react";
import { useTenantDomains, useVerifyDomain } from "../hooks/use-domains";
import { format } from "date-fns";

export function DomainsPage() {
  // Hardcoded for now, should come from auth/tenant context
  const tenantId = 1; 
  const { data: domains, isLoading, refetch } = useTenantDomains(tenantId);
  const verifyMutation = useVerifyDomain(tenantId);

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Domain Management"
          description="Configure custom white-label domains and SSL certificates for your hospital portal."
        />
        <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
          <Plus className="h-5 w-5" />
          <span className="font-bold">Connect Domain</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Help Panel */}
        <div className="lg:col-span-1 space-y-6">
           <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40">
              <h4 className="text-sm font-bold text-secondary-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                 <Info className="h-4 w-4 text-primary-500" />
                 DNS Instructions
              </h4>
              <div className="space-y-6">
                 <div className="space-y-2">
                    <p className="text-[10px] font-black text-secondary-400 uppercase tracking-tighter">Root Domain (A Record)</p>
                    <code className="block p-3 rounded-xl bg-secondary-900 text-secondary-100 text-[10px] font-mono break-all">
                       76.76.21.21
                    </code>
                 </div>
                 <div className="space-y-2">
                    <p className="text-[10px] font-black text-secondary-400 uppercase tracking-tighter">Subdomain (CNAME)</p>
                    <code className="block p-3 rounded-xl bg-secondary-900 text-secondary-100 text-[10px] font-mono break-all">
                       cname.carepoint-hms.com
                    </code>
                 </div>
              </div>
           </div>
        </div>

        {/* Domains List */}
        <div className="lg:col-span-2 space-y-6">
           <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-secondary-900 flex items-center gap-2">
                 <Globe className="h-5 w-5 text-primary-500" />
                 Active Domains
              </h3>
              <button onClick={() => refetch()} className="p-2 hover:bg-secondary-100 rounded-xl transition-all">
                 <RefreshCw className={`h-4 w-4 text-secondary-400 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
           </div>

           <div className="space-y-4">
              {isLoading ? (
                 Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-32 bg-white/40 rounded-[2rem] animate-pulse" />
                 ))
              ) : domains && domains.length > 0 ? (
                 domains.map((domain) => (
                    <div 
                       key={domain.id}
                       className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40 hover:bg-white/60 transition-all group"
                    >
                       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                          <div className="flex items-center gap-5">
                             <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg ${domain.is_verified ? 'bg-secondary-900 text-white shadow-secondary-900/10' : 'bg-secondary-100 text-secondary-400 shadow-none'}`}>
                                <Globe className="h-7 w-7" />
                             </div>
                             <div>
                                <div className="flex items-center gap-3">
                                   <h4 className="text-lg font-black text-secondary-900">{domain.domain_name}</h4>
                                   {domain.is_primary && (
                                      <span className="px-2 py-0.5 rounded-lg bg-primary-500 text-white text-[10px] font-bold">
                                         PRIMARY
                                      </span>
                                   )}
                                </div>
                                <div className="flex items-center gap-4 mt-2">
                                   <span className={`flex items-center gap-1.5 text-[10px] font-bold ${domain.is_verified ? 'text-emerald-600' : 'text-amber-500'}`}>
                                      {domain.is_verified ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                                      {domain.is_verified ? 'Verified' : 'Pending Verification'}
                                   </span>
                                   <span className={`flex items-center gap-1.5 text-[10px] font-bold ${domain.ssl_enabled ? 'text-blue-600' : 'text-secondary-400'}`}>
                                      <Lock className="h-3 w-3" />
                                      {domain.ssl_enabled ? 'SSL Active' : 'No SSL'}
                                   </span>
                                </div>
                             </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                             {!domain.is_verified && (
                                <button 
                                   onClick={() => verifyMutation.mutate(domain.id)}
                                   disabled={verifyMutation.isPending}
                                   className="btn-primary py-2 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest"
                                >
                                   Verify Now
                                </button>
                             )}
                             <button className="p-3 hover:bg-secondary-100 rounded-2xl transition-all">
                                <MoreHorizontal className="h-5 w-5 text-secondary-400" />
                             </button>
                          </div>
                       </div>
                    </div>
                 ))
              ) : (
                 <div className="py-24 text-center bg-white/20 rounded-[3rem] border-2 border-dashed border-secondary-100">
                    <Globe className="h-16 w-16 mx-auto text-secondary-100 mb-6" />
                    <h4 className="text-xl font-bold text-secondary-900">No Custom Domains</h4>
                    <p className="text-secondary-500 mt-2 max-w-xs mx-auto">
                       Link your own domain (e.g., portal.myhospital.com) to provide a seamless experience.
                    </p>
                 </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
