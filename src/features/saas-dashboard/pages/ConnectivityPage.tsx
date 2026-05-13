
// carepoint_hms_ui/src/features/saas-dashboard/pages/ConnectivityPage.tsx
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
import { useSystemHealth } from "../hooks/use-system-health";
import { useConnectivityProbe } from "../hooks/use-connectivity";
import { format } from "date-fns";
import { Key, ReactElement, JSXElementConstructor, ReactNode, ReactPortal } from "react";

export function ConnectivityPage() {
   const { data: health, isLoading: isHealthLoading, refetch: refetchHealth } = useSystemHealth();
   const probeMutation = useConnectivityProbe();

   const network = health?.network;

   return (
      <div className="space-y-10 animate-fade-in pb-20">
         <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <PageHeader
               title="Network Connectivity"
               description="Monitor platform uptime, API latency, and global service availability stats."
            />
            <button
               onClick={() => {
                  probeMutation.mutate({ target_url: "https://api.carepoint-hms.com" });
                  refetchHealth();
               }}
               disabled={probeMutation.isPending || isHealthLoading}
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
               <h4 className="text-3xl font-black text-emerald-600">{network?.uptime_30d || "0.00%"}</h4>
               <div className="mt-4 flex gap-1">
                  {Array.from({ length: 20 }).map((_, i) => (
                     <div key={i} className={`h-4 w-1 rounded-full ${i < 19 ? 'bg-emerald-500' : 'bg-emerald-500/30'}`} title="Historical Data Point" />
                  ))}
               </div>
            </div>
            <div className="glass-card rounded-[2rem] p-6 border border-secondary-100/50 bg-white/40 shadow-premium">
               <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-4">Avg. Latency</p>
               <h4 className="text-3xl font-black text-secondary-900">{network?.avg_latency_ms || "0"}ms</h4>
               {network?.latency_trend !== undefined && (
                  <p className={`text-[10px] ${network.latency_trend <= 0 ? 'text-emerald-600' : 'text-rose-600'} font-bold mt-2 flex items-center gap-1`}>
                     <TrendingUp className={`h-3 w-3 ${network.latency_trend > 0 ? 'rotate-180' : ''}`} />
                     {Math.abs(network.latency_trend)}% vs last interval
                  </p>
               )}
            </div>
            <div className="glass-card rounded-[2rem] p-6 border border-secondary-100/50 bg-white/40 shadow-premium">
               <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-4">Total Probes</p>
               <h4 className="text-3xl font-black text-secondary-900">{network?.total_probes_24h.toLocaleString() || "0"}</h4>
               <p className="text-[10px] text-secondary-400 font-bold mt-2">Last 24 hours</p>
            </div>
            <div className="glass-card rounded-[2rem] p-6 border border-secondary-100/50 bg-white/40 shadow-premium">
               <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-4">Global Health</p>
               <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full animate-ping ${network?.global_health === 'HEALTHY' ? 'bg-emerald-500' : network?.global_health === 'DEGRADED' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                  <h4 className="text-xl font-black text-secondary-900 uppercase">{network?.global_health || "UNKNOWN"}</h4>
               </div>
               <p className="text-[10px] text-secondary-400 font-bold mt-2">{network?.global_health_detail || "Checking system status..."}</p>
            </div>
         </div>

         {/* Core Services Health */}
         <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium">
            <h3 className="text-lg font-bold text-secondary-900 flex items-center gap-2 mb-8">
               <ShieldCheck className="h-5 w-5 text-primary-500" />
               Core Services Status
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               <div className="flex items-center gap-4 p-4 rounded-3xl bg-white/50 border border-white">
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${health?.database.connected ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                     <Zap className="h-6 w-6" />
                  </div>
                  <div>
                     <p className="text-xs font-bold text-secondary-400 uppercase tracking-tighter">Database</p>
                     <p className="text-sm font-black text-secondary-900">{health?.database.connected ? 'CONNECTED' : 'DISCONNECTED'}</p>
                  </div>
               </div>
               <div className="flex items-center gap-4 p-4 rounded-3xl bg-white/50 border border-white">
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${health?.scheduler.running ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                     <Clock className="h-6 w-6" />
                  </div>
                  <div>
                     <p className="text-xs font-bold text-secondary-400 uppercase tracking-tighter">Scheduler</p>
                     <p className="text-sm font-black text-secondary-900">{health?.scheduler.running ? 'RUNNING' : health?.scheduler.available ? 'AVAILABLE' : 'OFFLINE'}</p>
                  </div>
               </div>
               <div className="flex items-center gap-4 p-4 rounded-3xl bg-white/50 border border-white">
                  <div className="h-12 w-12 rounded-2xl bg-primary-100 text-primary-600 flex items-center justify-center">
                     <Activity className="h-6 w-6" />
                  </div>
                  <div>
                     <p className="text-xs font-bold text-secondary-400 uppercase tracking-tighter">System Uptime</p>
                     <p className="text-sm font-black text-secondary-900">
                        {network?.system.uptime_seconds ? `${Math.floor(network.system.uptime_seconds / 3600)}h ${Math.floor((network.system.uptime_seconds % 3600) / 60)}m` : '0s'}
                     </p>
                  </div>
               </div>
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
                  {network?.regional_performance.length ? network.regional_performance.map((r: { region: string; status: string; latency_ms: number; }) => (
                     <div key={r.region} className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <div className={`h-2 w-2 rounded-full ${r.status === 'HEALTHY' ? 'bg-emerald-500' : r.status === 'DEGRADED' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                           <div>
                              <p className="text-sm font-bold text-secondary-900">{r.region}</p>
                              <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-tighter">Status: {r.status}</p>
                           </div>
                        </div>
                        <p className="text-sm font-black text-secondary-900">{r.latency_ms}ms</p>
                     </div>
                  )) : (
                     <div className="py-10 text-center">
                        <Globe className="h-10 w-10 text-secondary-200 mx-auto mb-4 animate-spin-slow" />
                        <p className="text-sm text-secondary-400 font-medium">Fetching regional data...</p>
                     </div>
                  )}
               </div>
            </div>

            {/* Log / Recent Activity */}
            <div className="lg:col-span-1 space-y-6">
               <h3 className="text-lg font-bold text-secondary-900 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary-500" />
                  Recent Probes
               </h3>
               <div className="space-y-4">
                  {network?.recent_probes.length ? network.recent_probes.slice(0, 6).map((probe: { id: string; status: string; timestamp: string | number | Date; latency_ms: number; }) => (
                     <div key={probe.id} className="glass-card rounded-[2rem] p-5 border border-secondary-100/50 bg-white/40 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <CheckCircle2 className={`h-4 w-4 ${probe.status === 'HEALTHY' ? 'text-emerald-500' : 'text-amber-500'}`} />
                           <div>
                              <p className="text-xs font-bold text-secondary-900">Probe #{probe.id}</p>
                              <p className="text-[9px] text-secondary-400 font-medium">{format(new Date(probe.timestamp), 'HH:mm:ss')}</p>
                           </div>
                        </div>
                        <p className="text-[10px] font-black text-secondary-900">{probe.latency_ms}ms</p>
                     </div>
                  )) : (
                     <div className="p-10 text-center border-2 border-dashed border-secondary-100 rounded-3xl">
                        <p className="text-xs text-secondary-400 font-bold italic">No recent probes recorded</p>
                     </div>
                  )}
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
