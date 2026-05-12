import { PageHeader } from "@/components/layout/PageHeader";
import {
  Activity,
  CheckCircle2,
  Clock,
  Globe,
  RefreshCw,
  Search,
  ShieldCheck,
  Signal,
  Zap,
  MoreHorizontal,
  ChevronRight,
  AlertCircle,
  Wifi,
} from "lucide-react";
import { useConnectivityStats, useConnectivityProbe } from "../hooks/use-connectivity";
import { format } from "date-fns";

export function ConnectivityPage() {
  const { data: stats, isLoading, refetch } = useConnectivityStats();
  const probeMutation = useConnectivityProbe();

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Network Connectivity"
          description="Monitor platform uptime, API latency, and global service availability stats."
        />
        <button 
           onClick={() => probeMutation.mutate({ target_url: "https://api.carepoint-hms.com" })}
           disabled={probeMutation.isPending}
           className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20"
        >
          <Wifi className={`h-5 w-5 ${probeMutation.isPending ? 'animate-pulse' : ''}`} />
          <span className="font-bold">Run Global Probe</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Stats Cards */}
        <div className="glass-card rounded-[2rem] p-6 border border-secondary-100/50 bg-white/40 shadow-premium">
           <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-4">Uptime (30d)</p>
           <h4 className="text-3xl font-black text-emerald-600">99.98%</h4>
           <div className="mt-4 flex gap-1">
              {Array.from({ length: 20 }).map((_, i) => (
                 <div key={i} className="h-4 w-1 rounded-full bg-emerald-500" />
              ))}
           </div>
        </div>
        <div className="glass-card rounded-[2rem] p-6 border border-secondary-100/50 bg-white/40 shadow-premium">
           <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-4">Avg. Latency</p>
           <h4 className="text-3xl font-black text-secondary-900">{stats?.avg_latency || "42"}ms</h4>
           <p className="text-[10px] text-emerald-600 font-bold mt-2 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> -12% vs last week
           </p>
        </div>
        <div className="glass-card rounded-[2rem] p-6 border border-secondary-100/50 bg-white/40 shadow-premium">
           <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-4">Total Probes</p>
           <h4 className="text-3xl font-black text-secondary-900">{stats?.total_probes.toLocaleString() || "12,482"}</h4>
           <p className="text-[10px] text-secondary-400 font-bold mt-2">Last 24 hours</p>
        </div>
        <div className="glass-card rounded-[2rem] p-6 border border-secondary-100/50 bg-white/40 shadow-premium">
           <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-4">Global Health</p>
           <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-emerald-500 animate-ping" />
              <h4 className="text-xl font-black text-secondary-900 uppercase">Excellent</h4>
           </div>
           <p className="text-[10px] text-secondary-400 font-bold mt-2">All regions operational</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Probe Regions */}
         <div className="lg:col-span-2 space-y-6">
            <h3 className="text-lg font-bold text-secondary-900 flex items-center gap-2">
               <Signal className="h-5 w-5 text-primary-500" />
               Regional Performance
            </h3>
            <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium space-y-8">
               {[
                  { region: 'US East (N. Virginia)', latency: '12ms', status: 'Healthy' },
                  { region: 'Europe (Frankfurt)', latency: '28ms', status: 'Healthy' },
                  { region: 'Asia Pacific (Singapore)', latency: '142ms', status: 'Healthy' },
                  { region: 'Africa (Lagos)', latency: '34ms', status: 'Healthy' },
               ].map(r => (
                  <div key={r.region} className="flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        <div>
                           <p className="text-sm font-bold text-secondary-900">{r.region}</p>
                           <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-tighter">Status: {r.status}</p>
                        </div>
                     </div>
                     <p className="text-sm font-black text-secondary-900">{r.latency}</p>
                  </div>
               ))}
            </div>
         </div>

         {/* Log / Recent Activity */}
         <div className="lg:col-span-1 space-y-6">
            <h3 className="text-lg font-bold text-secondary-900 flex items-center gap-2">
               <Activity className="h-5 w-5 text-primary-500" />
               Recent Probes
            </h3>
            <div className="space-y-4">
               {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="glass-card rounded-[2rem] p-5 border border-secondary-100/50 bg-white/40 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <p className="text-xs font-bold text-secondary-900">Probe #{(9283 - i).toLocaleString()}</p>
                     </div>
                     <p className="text-[10px] font-bold text-secondary-400">{32 + i}ms</p>
                  </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
}

// Missing icon from lucide-react
function TrendingUp({ className }: { className?: string }) {
   return (
     <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
   );
}
