import { PageHeader } from "@/components/layout/PageHeader";
import {
  ArrowLeft,
  Boxes,
  History,
  TrendingUp,
  AlertCircle,
  Clock,
  Package,
  ShieldCheck,
  ChevronRight,
  MoreHorizontal,
  RefreshCw,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { routes } from "@/config/routes";

export function StockItemDetailPage() {
  const navigate = useNavigate();
  const { itemId } = useParams<{ itemId: string }>();

  // Mock data
  const item = {
    id: itemId || "1",
    name: "Paracetamol 500mg",
    sku: "PCM-500-T",
    type: "DRUG",
    onHand: 450,
    uom: "Tablets",
    reorderLevel: 100,
    expiryDate: "2027-10-15",
    batch: "BCH-88291",
    store: "Main Pharmacy",
    cost: 1500,
    movements: [
      { id: 1, type: 'IN', qty: 500, date: '2026-05-01', ref: 'PO-992' },
      { id: 2, type: 'OUT', qty: 20, date: '2026-05-10', ref: 'REQ-102' },
      { id: 3, type: 'OUT', qty: 30, date: '2026-05-11', ref: 'REQ-105' },
    ]
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <button 
            onClick={() => navigate(routes.inventoryItems)}
            className="flex items-center gap-2 text-secondary-400 hover:text-secondary-900 font-bold transition-all group"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] uppercase tracking-widest">Back to Inventory</span>
          </button>
          <PageHeader
            title={item.name}
            description={`Batch: ${item.batch} • SKU: ${item.sku}`}
          />
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary gap-3 py-3 px-6">
            <History className="h-4 w-4" />
            <span className="font-bold">Adjust Stock</span>
          </button>
          <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
            <Plus className="h-5 w-5" />
            <span className="font-bold">Restock Batch</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Main Stats */}
        <div className="lg:col-span-2 space-y-8">
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="glass-card rounded-[2rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium">
                 <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-2">On Hand</p>
                 <h4 className="text-3xl font-black text-secondary-900">{item.onHand} <span className="text-sm font-bold text-secondary-400 uppercase">{item.uom}</span></h4>
              </div>
              <div className="glass-card rounded-[2rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium">
                 <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-2">Expiry Status</p>
                 <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100 uppercase">
                    Healthy (520 Days)
                 </span>
              </div>
              <div className="glass-card rounded-[2rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium">
                 <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-2">Avg. Consumption</p>
                 <h4 className="text-3xl font-black text-secondary-900">12.5 <span className="text-sm font-bold text-secondary-400 uppercase">/day</span></h4>
              </div>
           </div>

           <div className="space-y-6">
              <div className="flex items-center justify-between">
                 <h3 className="text-lg font-bold text-secondary-900 flex items-center gap-2">
                    <History className="h-5 w-5 text-primary-500" />
                    Batch Movement History
                 </h3>
                 <button className="btn-secondary p-2 rounded-xl"><RefreshCw className="h-4 w-4" /></button>
              </div>

              <div className="glass-card rounded-[2.5rem] overflow-hidden border border-secondary-100/50 shadow-premium bg-white/40">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="bg-secondary-900/5">
                          <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Date</th>
                          <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Transaction</th>
                          <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-center">Type</th>
                          <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-right">Quantity</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary-100/50">
                       {item.movements.map((m) => (
                          <tr key={m.id} className="hover:bg-primary-50/30 transition-all">
                             <td className="px-8 py-6 text-sm font-bold text-secondary-900">{m.date}</td>
                             <td className="px-8 py-6">
                                <p className="text-sm font-medium text-secondary-700">{m.ref}</p>
                                <p className="text-[10px] text-secondary-400 uppercase font-bold">Internal Requisition</p>
                             </td>
                             <td className="px-8 py-6 text-center">
                                <span className={`px-3 py-1 rounded-xl text-[10px] font-black inline-flex items-center gap-1
                                   ${m.type === 'IN' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}
                                `}>
                                   {m.type === 'IN' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                                   {m.type}
                                </span>
                             </td>
                             <td className="px-8 py-6 text-right text-sm font-black text-secondary-900">
                                {m.type === 'IN' ? '+' : '-'}{m.qty}
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>

        {/* Sidebar Info */}
        <div className="lg:col-span-1 space-y-6">
           <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium">
              <h4 className="text-sm font-bold text-secondary-900 uppercase tracking-widest mb-6">Technical Data</h4>
              <div className="space-y-4">
                 <div className="flex justify-between py-3 border-b border-secondary-50">
                    <span className="text-xs text-secondary-400 font-bold">Storage Temp</span>
                    <span className="text-xs text-secondary-900 font-black">15°C - 25°C</span>
                 </div>
                 <div className="flex justify-between py-3 border-b border-secondary-50">
                    <span className="text-xs text-secondary-400 font-bold">Hazard Class</span>
                    <span className="text-xs text-secondary-900 font-black">Non-Hazardous</span>
                 </div>
                 <div className="flex justify-between py-3 border-b border-secondary-50">
                    <span className="text-xs text-secondary-400 font-bold">Manufacturer</span>
                    <span className="text-xs text-secondary-900 font-black">PharmaCore Ltd.</span>
                 </div>
              </div>
           </div>

           <div className="glass-card rounded-[2.5rem] p-8 border border-amber-100 bg-amber-50/30">
              <div className="flex items-start gap-4">
                 <AlertCircle className="h-6 w-6 text-amber-500 shrink-0" />
                 <div>
                    <h4 className="text-sm font-bold text-secondary-900 mb-1">Reorder Notification</h4>
                    <p className="text-xs text-secondary-500 leading-relaxed">
                       This item is currently healthy, but at current consumption rates, you will reach the reorder level in 28 days.
                    </p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
