import { PageHeader } from "@/components/layout/PageHeader";
import {
   CreditCard,
   Plus,
   RefreshCw,
   Search,
   Filter,
   CheckCircle2,
   XCircle,
   Clock,
   ShieldCheck,
   User,
   ExternalLink,
   QrCode,
   AlertCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { membershipApi, type MembershipCard } from "../api/membership.api";

export function MembershipCardsPage() {
   const [cards, setCards] = useState<MembershipCard[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);

   const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
         const data = await membershipApi.list();
         setCards(data.items || []);
      } catch (err: any) {
         setError("Failed to synchronize with the membership registry.");
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
               title="Membership Cards"
               description="Issue and manage physical or digital patient identification cards."
            />
            <div className="flex gap-3">
               <button onClick={load} className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400 transition-all active:rotate-180 duration-500">
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
               </button>
               <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
                  <Plus className="h-5 w-5" />
                  <span className="font-bold">Issue New Card</span>
               </button>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
            {/* Summary */}
            <div className="lg:col-span-1 space-y-6">
               <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 shadow-premium">
                  <div className="h-16 w-16 rounded-2xl bg-primary-900 text-white flex items-center justify-center mb-6 shadow-lg shadow-primary-900/20">
                     <ShieldCheck className="h-8 w-8" />
                  </div>
                  <h4 className="text-xl font-black text-secondary-900 mb-2">Card Integrity</h4>
                  <p className="text-xs text-secondary-500 leading-relaxed mb-8">
                     All issued cards are encoded with encrypted QR codes for instant verification at service points.
                  </p>
                  <div className="space-y-4">
                     <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-secondary-700">Active Cards</span>
                        <span className="text-xl font-black text-emerald-500">1,240</span>
                     </div>
                     <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-secondary-700">Expired</span>
                        <span className="text-xl font-black text-rose-500">12</span>
                     </div>
                  </div>
               </div>
            </div>

            {/* Registry */}
            <div className="lg:col-span-3 space-y-6">
               <div className="flex items-center justify-between">
                  <div className="relative max-w-sm w-full group">
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400 group-focus-within:text-primary-500 transition-colors" />
                     <input
                        type="text"
                        placeholder="Search by card number or patient name..."
                        className="w-full pl-12 pr-6 py-3 rounded-2xl bg-white/60 border border-secondary-400 focus:border-primary-500 transition-all text-sm font-medium outline-none"
                     />
                  </div>
               </div>

               {error && (
                  <div className="p-6 rounded-[2rem] bg-rose-50 border border-rose-100 text-rose-600 flex items-center gap-4">
                     <AlertCircle className="h-6 w-6" />
                     <p className="text-sm font-bold">{error}</p>
                  </div>
               )}

               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
                  {isLoading ? (
                     Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-48 bg-white/40 rounded-[2.5rem] animate-pulse" />
                     ))
                  ) : cards.length === 0 ? (
                     <div className="col-span-2 py-32 text-center bg-white/20 rounded-[3rem] border-2 border-dashed border-secondary-400">
                        <CreditCard className="h-12 w-12 mx-auto text-secondary-200 mb-4" />
                        <h4 className="text-lg font-bold text-secondary-900">No Cards Issued</h4>
                        <p className="text-sm text-secondary-400 mt-2">Start issuing identification cards to patients.</p>
                     </div>
                  ) : (
                     cards.map((card) => (
                        <div key={card.id} className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 hover:bg-white/60 transition-all group relative overflow-hidden">
                           <div className="absolute -top-6 -right-6 h-24 w-24 bg-primary-500/5 rounded-full blur-xl" />
                           <div className="flex items-start justify-between mb-8">
                              <div className="flex items-center gap-4">
                                 <div className="h-12 w-12 rounded-2xl bg-secondary-900 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                    <CreditCard className="h-6 w-6" />
                                 </div>
                                 <div>
                                    <h4 className="text-sm font-black text-secondary-900 uppercase tracking-widest">{card.card_number}</h4>
                                    <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-[0.2em] mt-1">{card.patient_name}</p>
                                 </div>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${card.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                                 }`}>
                                 {card.status}
                              </span>
                           </div>

                           <div className="flex items-center justify-between pt-6 border-t border-secondary-400/50">
                              <div className="flex flex-col">
                                 <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">Valid Thru</span>
                                 <span className="text-xs font-black text-secondary-900">{new Date(card.expiry_date).toLocaleDateString()}</span>
                              </div>
                              <div className="flex gap-2">
                                 <button className="h-10 w-10 rounded-xl bg-secondary-50 flex items-center justify-center text-secondary-400 hover:bg-primary-500 hover:text-white transition-all shadow-sm">
                                    <QrCode className="h-4 w-4" />
                                 </button>
                                 <button className="h-10 w-10 rounded-xl bg-secondary-50 flex items-center justify-center text-secondary-400 hover:bg-primary-500 hover:text-white transition-all shadow-sm">
                                    <ExternalLink className="h-4 w-4" />
                                 </button>
                              </div>
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
