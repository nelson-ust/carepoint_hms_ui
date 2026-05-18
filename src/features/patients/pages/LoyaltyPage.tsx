import { PageHeader } from "@/components/layout/PageHeader";
import {
   Gift,
   Star,
   History,
   TrendingUp,
   RefreshCw,
   Search,
   Filter,
   ArrowUpRight,
   ArrowDownLeft,
   MoreHorizontal,
   ChevronRight,
} from "lucide-react";
import { useParams } from "react-router-dom";
import { usePatientPoints, useLoyaltyHistory } from "../hooks/use-loyalty";
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

const loyaltyData = [
   { month: "Jan", points: 1200 },
   { month: "Feb", points: 2100 },
   { month: "Mar", points: 1800 },
   { month: "Apr", points: 3200 },
   { month: "May", points: 4500 },
   { month: "Jun", points: 5200 },
];

export function LoyaltyPage() {
   const { patientId } = useParams<{ patientId: string }>();
   const id = Number(patientId) || 1; // Fallback to 1 for demo if no ID in URL
   const { data: pointsData, isLoading: pointsLoading } = usePatientPoints(id);
   const { data: historyData, isLoading: historyLoading, refetch } = useLoyaltyHistory(id);

   const history = historyData?.items || [];

   return (
      <div className="space-y-10 animate-fade-in pb-20">
         <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <PageHeader
               title="Patient Loyalty"
               description="Track and manage patient reward points, redemption history, and membership tiers."
            />
            <div className="flex gap-3">
               <button className="btn-secondary gap-3 py-3 px-6">
                  <Star className="h-4 w-4 text-amber-500" />
                  <span className="font-bold">Tier Benefits</span>
               </button>
               <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
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
                  {pointsLoading ? "..." : pointsData?.total_points.toLocaleString() || "0"}
               </h4>
               <p className="text-xs font-bold text-secondary-500">Loyalty Points</p>

               <div className="w-full h-px bg-amber-100 my-8" />

               <div className="w-full flex justify-between items-center px-4">
                  <div className="text-left">
                     <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-tighter">Current Tier</p>
                     <p className="text-sm font-black text-secondary-900">Gold Member</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-amber-500" />
               </div>
            </div>

            {/* Growth Chart */}
            <div className="lg:col-span-3 glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 shadow-premium">
               <h4 className="text-sm font-bold text-secondary-900 uppercase tracking-widest mb-6">Points Accumulation</h4>
               <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={loyaltyData}>
                        <defs>
                           <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.1} />
                              <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                           </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis
                           dataKey="month"
                           axisLine={false}
                           tickLine={false}
                           tick={{ fontSize: 10, fontWeight: 700, fill: '#94A3B8' }}
                        />
                        <YAxis hide />
                        <Tooltip
                           contentStyle={{
                              borderRadius: '1rem',
                              border: 'none',
                              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                              fontSize: '12px'
                           }}
                        />
                        <Area
                           type="monotone"
                           dataKey="points"
                           stroke="#F59E0B"
                           strokeWidth={3}
                           fillOpacity={1}
                           fill="url(#colorPoints)"
                        />
                     </AreaChart>
                  </ResponsiveContainer>
               </div>
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
                                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${tx.transaction_type === 'EARN' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
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
                                       <p className={`text-sm font-black ${tx.transaction_type === 'EARN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                          {tx.transaction_type === 'EARN' ? '+' : '-'}{tx.points.toLocaleString()}
                                       </p>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                       <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100">
                                          SUCCESS
                                       </span>
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
      </div>
   );
}
