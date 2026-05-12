import { PageHeader } from "@/components/layout/PageHeader";
import {
  CreditCard,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldCheck,
  Zap,
  MoreHorizontal,
  ChevronRight,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { usePaymentGateways, useTestGateway } from "../hooks/use-patient-payment";

export function PaymentGatewaysPage() {
  const { data, isLoading, refetch } = usePaymentGateways();
  const testMutation = useTestGateway();
  
  const gateways = data?.items || [];

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Payment Gateways"
          description="Configure direct patient payment integrations via Paystack, Flutterwave, Stripe, or local banks."
        />
        <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
          <Plus className="h-5 w-5" />
          <span className="font-bold">Add Gateway</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Security Summary */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40">
             <div className="h-12 w-12 rounded-2xl bg-primary-500 text-white flex items-center justify-center mb-6 shadow-lg shadow-primary-500/20">
                <ShieldCheck className="h-6 w-6" />
             </div>
             <h4 className="text-lg font-bold text-secondary-900 mb-2">Secure Transactions</h4>
             <p className="text-sm text-secondary-500 leading-relaxed mb-6">
                All patient payments are processed through secure 3D-Secure gateways. 
                Sensitive card data is never stored on hospital servers.
             </p>
             <div className="flex items-center gap-2 text-[10px] font-bold text-secondary-400 uppercase tracking-widest">
                PCI-DSS Compliant Infrastructure
             </div>
          </div>
        </div>

        {/* Gateways List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-secondary-900 flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Connected Providers
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
            ) : gateways.length > 0 ? (
              gateways.map((gw) => (
                <div 
                  key={gw.id}
                  className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40 hover:bg-white/60 transition-all group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                      <div className="h-14 w-14 rounded-2xl bg-secondary-900 text-white flex items-center justify-center shadow-lg shadow-secondary-900/10">
                        <CreditCard className="h-7 w-7" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h4 className="text-lg font-black text-secondary-900">{gw.gateway_name}</h4>
                          {gw.is_active && (
                             <span className="px-2 py-0.5 rounded-lg bg-emerald-500 text-white text-[10px] font-bold">
                                LIVE
                             </span>
                          )}
                        </div>
                        <p className="text-xs text-secondary-400 mt-1 font-medium italic">
                           Merchant ID: {gw.config.merchant_id || 'Not Set'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                       <button 
                         onClick={() => testMutation.mutate(gw.id)}
                         disabled={testMutation.isPending}
                         className="btn-secondary py-2 px-4 rounded-xl text-[10px] font-bold"
                       >
                          Test Gateway
                       </button>
                       <button className="p-3 hover:bg-secondary-100 rounded-2xl transition-all">
                          <SettingsIcon className="h-5 w-5 text-secondary-400" />
                       </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-24 text-center bg-white/20 rounded-[3rem] border-2 border-dashed border-secondary-100">
                <CreditCard className="h-16 w-16 mx-auto text-secondary-100 mb-6" />
                <h4 className="text-xl font-bold text-secondary-900">No Gateways Configured</h4>
                <p className="text-secondary-500 mt-2 max-w-xs mx-auto">
                   Enable direct patient payments by connecting your first gateway.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
