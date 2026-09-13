import {
   Tooltip,
   ResponsiveContainer,
   BarChart,
   Bar,
   XAxis,
   YAxis,
   CartesianGrid,
   Cell,
} from "recharts";
import { Truck, ShieldCheck, Users, Wrench, AlertTriangle } from "lucide-react";
import { MetricCard } from "@/components/charts/MetricCard";
import { useChartTheme } from "@/components/charts/chart-theme";
import { useAmbulanceFleetStats } from "../hooks/use-ambulance";

/** Human labels + chart theme series index per fleet status. */
const STATUS_META: { key: string; label: string; seriesIndex: number }[] = [
   { key: "AVAILABLE", label: "Available", seriesIndex: 0 },
   { key: "DISPATCHED", label: "Dispatched", seriesIndex: 1 },
   { key: "IN_TRANSIT", label: "In Transit", seriesIndex: 2 },
   { key: "UNDER_MAINTENANCE", label: "Under Maintenance", seriesIndex: 3 },
   { key: "OUT_OF_SERVICE", label: "Out of Service", seriesIndex: 4 },
];

export function AmbulanceStats() {
   const chart = useChartTheme();
   const { data: stats, isLoading, error } = useAmbulanceFleetStats();

   const byStatus = stats?.by_status ?? {};
   const statusData = STATUS_META.map((meta) => ({
      name: meta.label,
      value: byStatus[meta.key] ?? 0,
      seriesIndex: meta.seriesIndex,
   }));

   return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
         {/* Quick Stats */}
         <div className="lg:col-span-1 space-y-4">
            <MetricCard label="Total Fleet" value={stats?.fleet_total ?? 0} icon={Truck} tone="slate" isLoading={isLoading} />
            <MetricCard label="Ready" value={stats?.ready_count ?? 0} icon={ShieldCheck} tone="primary" isLoading={isLoading} />
            <MetricCard label="Drivers" value={stats?.drivers_total ?? 0} icon={Users} tone="cyan" isLoading={isLoading} />
            <MetricCard label="Open Maintenance" value={stats?.maintenance_open ?? 0} icon={Wrench} tone="amber" isLoading={isLoading} />
         </div>

         {/* Fleet Distribution */}
         <div className="lg:col-span-3 glass-card rounded-[2.5rem] p-8 shadow-premium flex flex-col">
            <h4 className="text-sm font-bold text-secondary-900 uppercase tracking-widest mb-8">Fleet Distribution</h4>
            {isLoading ? (
               <div className="h-[220px] w-full rounded-2xl bg-secondary-100/30 animate-pulse" />
            ) : error ? (
               <div className="h-[220px] w-full flex flex-col items-center justify-center text-center">
                  <AlertTriangle className="h-8 w-8 text-rose-500 mb-3" />
                  <p className="text-xs font-bold text-secondary-500">Unable to load fleet statistics.</p>
               </div>
            ) : (
               <>
                  <div className="h-[220px] w-full mb-6">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={statusData}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chart.tick} />
                           <YAxis hide allowDecimals={false} />
                           <Tooltip cursor={chart.cursor} contentStyle={chart.tooltip} />
                           <Bar dataKey="value" radius={[4, 4, 4, 4]}>
                              {statusData.map((entry) => (
                                 <Cell
                                    key={`cell-${entry.name}`}
                                    fill={chart.series[entry.seriesIndex % chart.series.length]}
                                 />
                              ))}
                           </Bar>
                        </BarChart>
                     </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-auto">
                     {statusData.map((item) => (
                        <div key={item.name} className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                              <div
                                 className="h-1.5 w-1.5 rounded-full"
                                 style={{ backgroundColor: chart.series[item.seriesIndex % chart.series.length] }}
                              />
                              <span className="text-[10px] font-bold text-secondary-500 uppercase">{item.name}</span>
                           </div>
                           <span className="text-xs font-black text-secondary-900">{item.value}</span>
                        </div>
                     ))}
                  </div>
               </>
            )}
         </div>
      </div>
   );
}
