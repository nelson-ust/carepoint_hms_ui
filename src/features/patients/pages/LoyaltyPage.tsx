import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { useChartTheme } from "@/components/charts/chart-theme";
import {
   Gift,
   Plus,
   Star,
   History,
   RefreshCw,
   ArrowUpRight,
   ArrowDownLeft,
   ChevronRight,
} from "lucide-react";
import { useParams } from "react-router-dom";
import { usePatientPoints, useLoyaltyHistory } from "../hooks/use-loyalty";
import { useDisclosure } from "@/hooks/useDisclosure";
import { tierForBalance } from "../loyalty-tiers";
import { PointsActionModal } from "../components/PointsActionModal";
import { TierBenefitsModal } from "../components/TierBenefitsModal";
import { format } from "date-fns";
import {
   AreaChart,
   Area,
   XAxis,
   YAxis,
   CartesianGrid,
   Tooltip,
   ResponsiveContainer,
} from "recharts";

type LoyaltyChartPoint = { month: string; points: number };

/** Cumulative points balance sampled at the end of each of the last 6 months. */
function buildAccumulationSeries(
   history: { points: number; transaction_type: "EARN" | "REDEEM"; created_at: string }[],
): LoyaltyChartPoint[] {
   const now = new Date();
   const months: { label: string; end: Date }[] = [];
   for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      months.push({
         label: new Date(now.getFullYear(), now.getMonth() - i, 1).toLocaleString("default", { month: "short" }),
         end: d, // exclusive upper bound (first day of next month)
      });
   }
   const sorted = [...history].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
   );
   return months.map(({ label, end }) => {
      const points = sorted
         .filter((tx) => new Date(tx.created_at) < end)
         .reduce((sum, tx) => sum + (tx.transaction_type === "EARN" ? tx.points : -tx.points), 0);
      return { month: label, points: Math.max(points, 0) };
   });
}

export function LoyaltyPage() {
   const { patientId } = useParams<{ patientId: string }>();
   const id = Number(patientId) || 0;
   const { data: pointsData, isLoading: pointsLoading } = usePatientPoints(id);
   const { data: historyData, isLoading: historyLoading, refetch } = useLoyaltyHistory(id);
   const chart = useChartTheme();

   const history = historyData?.items || [];
   const loyaltyData = buildAccumulationSeries(history);
   const balance = pointsData?.total_points ?? 0;
   const { tier, next } = tierForBalance(balance);

   const award = useDisclosure();
   const redeem = useDisclosure();
   const tiers = useDisclosure();

   return (
      <div className="space-y-10 animate-fade-in pb-20">
         <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <PageHeader
               title="Patient Loyalty"
               description="Track and manage patient reward points, redemption history, and membership tiers."
            />
            <div className="flex flex-wrap gap-3">
               <button onClick={tiers.open} className="btn-secondary gap-3 py-3 px-6">
                  <Star className="h-4 w-4 text-amber-500" />
                  <span className="font-bold">Tier Benefits</span>
               </button>
               <button onClick={award.open} className="btn-secondary gap-3 py-3 px-6">
                  <Plus className="h-4 w-4 text-emerald-500" />
                  <span className="font-bold">Award Points</span>
               </button>
               <button
                  onClick={redeem.open}
                  disabled={balance <= 0}
                  className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20 disabled:opacity-50"
               >
                  <Gift className="h-5 w-5" />
                  <span className="font-bold">Redeem Points</span>
               </button>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Points Summary Card */}
            <div className="lg:col-span-1 glass-card rounded-[2.5rem] p-8 border border-amber-100 bg-amber-50/30 flex flex-col items-center text-center">
               <div className="h-20 w-20 rounded-[2rem] bg-amber-500 text-white flex items-center justify-center mb-6 shadow-xl shadow-amber-500/20">
                  <Star className="h-10 w-10 fill-white" />
               </div>
               <p className="text-[10px] font-bold text-amber-600 uppercase tracking-[0.2em] mb-2">Available Balance</p>
               <h4 className="text-5xl font-black text-secondary-900 mb-2">
                  {pointsLoading ? "..." : balance.toLocaleString()}
               </h4>
               <p className="text-xs font-bold text-secondary-500">Loyalty Points</p>

               <div className="w-full h-px bg-amber-100 my-8" />

               <button
                  onClick={tiers.open}
                  className="w-full flex justify-between items-center px-4 rounded-2xl py-2 transition-colors hover:bg-amber-100/40"
               >
                  <div className="text-left">
                     <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-tighter">Points Tier</p>
                     <p className="text-sm font-black text-secondary-900">{pointsLoading ? "…" : tier.name}</p>
                     <p className="text-[10px] text-secondary-400 font-medium mt-1">
                        {next
                           ? `${Math.max(next.min - balance, 0).toLocaleString()} pts to ${next.name} (at ${next.min.toLocaleString()})`
                           : "Top tier reached"}
                     </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-amber-500" />
               </button>
            </div>

            {/* Growth Chart */}
            <div className="lg:col-span-3 glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 shadow-premium">
               <h4 className="text-sm font-bold text-secondary-900 uppercase tracking-widest mb-6">Points Accumulation (6 Months)</h4>
               {historyLoading ? (
                  <div className="h-[200px] w-full rounded-2xl bg-secondary-100/30 animate-pulse" />
               ) : history.length === 0 ? (
                  <div className="h-[200px] w-full flex items-center justify-center">
                     <p className="text-secondary-400 font-bold text-sm">No loyalty activity recorded yet.</p>
                  </div>
               ) : (
               <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={loyaltyData}>
                        <defs>
                           <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={chart.areaGradient.from} />
                              <stop offset="95%" stopColor={chart.areaGradient.to} />
                           </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
                        <XAxis
                           dataKey="month"
                           axisLine={false}
                           tickLine={false}
                           tick={chart.tick}
                        />
                        <YAxis hide />
                        <Tooltip contentStyle={chart.tooltip} />
                        <Area
                           type="monotone"
                           dataKey="points"
                           stroke={chart.series[0]}
                           strokeWidth={3}
                           fillOpacity={1}
                           fill="url(#colorPoints)"
                        />
                     </AreaChart>
                  </ResponsiveContainer>
               </div>
               )}
            </div>

            {/* History Section */}
            <div className="lg:col-span-4 space-y-6">
               <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-secondary-900 flex items-center gap-2">
                     <History className="h-5 w-5 text-primary-500" />
                     Transaction History
                  </h3>
                  <button onClick={() => refetch()} className="p-2 hover:bg-secondary-100 rounded-xl transition-all">
                     <RefreshCw className={`h-4 w-4 text-secondary-400 ${historyLoading ? 'animate-spin' : ''}`} />
                  </button>
               </div>

               <div className="glass-card rounded-[2.5rem] overflow-hidden border border-secondary-400/50 shadow-premium bg-white/40">
                  <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead>
                           <tr className="bg-secondary-900/5">
                              <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Transaction</th>
                              <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Date</th>
                              <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Points</th>
                              <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-right">Status</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary-100/50">
                           {historyLoading ? (
                              Array.from({ length: 4 }).map((_, i) => (
                                 <tr key={i} className="animate-pulse">
                                    <td colSpan={4} className="px-8 py-8"><div className="h-10 bg-secondary-100/30 rounded-xl" /></td>
                                 </tr>
                              ))
                           ) : history.length > 0 ? (
                              history.map((tx) => (
                                 <tr key={tx.id} className="hover:bg-primary-50/30 transition-all group">
                                    <td className="px-8 py-6">
                                       <div className="flex items-center gap-4">
                                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${tx.transaction_type === 'EARN' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'bg-rose-500/10 text-rose-600 dark:text-rose-300'}`}>
                                             {tx.transaction_type === 'EARN' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
                                          </div>
                                          <div>
                                             <p className="text-sm font-bold text-secondary-900">{tx.reason}</p>
                                             <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-tighter mt-0.5">#{tx.id}</p>
                                          </div>
                                       </div>
                                    </td>
                                    <td className="px-8 py-6 text-sm font-bold text-secondary-700">
                                       {format(new Date(tx.created_at), "MMM d, yyyy")}
                                    </td>
                                    <td className="px-8 py-6">
                                       <p className={`text-sm font-black ${tx.transaction_type === 'EARN' ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
                                          {tx.transaction_type === 'EARN' ? '+' : '-'}{tx.points.toLocaleString()}
                                       </p>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                       <Badge variant="soft-success">Success</Badge>
                                    </td>
                                 </tr>
                              ))
                           ) : (
                              <tr>
                                 <td colSpan={4} className="px-8 py-20 text-center">
                                    <p className="text-secondary-500 font-bold">No transactions found.</p>
                                 </td>
                              </tr>
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
         </div>

         <PointsActionModal
            isOpen={award.isOpen}
            onClose={award.close}
            mode="earn"
            patientId={id}
            balance={balance}
         />
         <PointsActionModal
            isOpen={redeem.isOpen}
            onClose={redeem.close}
            mode="redeem"
            patientId={id}
            balance={balance}
         />
         <TierBenefitsModal isOpen={tiers.isOpen} onClose={tiers.close} balance={balance} />
      </div>
   );
}
