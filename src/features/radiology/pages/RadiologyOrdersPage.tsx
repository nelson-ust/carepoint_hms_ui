import { PageHeader } from "@/components/layout/PageHeader";
import {
  Activity,
  Plus,
  Search,
  Filter,
  RefreshCw,
  MoreHorizontal,
  Image as ImageIcon,
  Zap,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

export function RadiologyOrdersPage() {
  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Radiology & Imaging"
          description="Manage X-Ray, MRI, and Ultrasound orders, track processing status, and view digital results."
        />
        <div className="flex gap-3">
          <button className="btn-secondary gap-3 py-3 px-6">
            <Zap className="h-4 w-4" />
            <span className="font-bold">PACS Viewer</span>
          </button>
          <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
            <Plus className="h-5 w-5" />
            <span className="font-bold">New Scan Order</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="glass-card rounded-[2rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium">
            <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-2">Pending Scans</p>
            <h4 className="text-3xl font-black text-amber-500">18</h4>
            <p className="text-[10px] text-secondary-400 font-bold mt-2">Average wait time: 24 mins</p>
         </div>
         <div className="glass-card rounded-[2rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium">
            <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-2">Completed Today</p>
            <h4 className="text-3xl font-black text-emerald-600">32</h4>
            <p className="text-[10px] text-secondary-400 font-bold mt-2">All results synced to EMR</p>
         </div>
         <div className="glass-card rounded-[2rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium">
            <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-2">Equipment Status</p>
            <h4 className="text-3xl font-black text-secondary-900">4/5</h4>
            <p className="text-[10px] text-rose-500 font-bold mt-2">MRI Unit #1 in Maintenance</p>
         </div>
      </div>

      <div className="space-y-6">
         <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-secondary-900 flex items-center gap-2">
               <ImageIcon className="h-5 w-5 text-primary-500" />
               Recent Imaging Orders
            </h3>
            <div className="flex gap-2">
               <button className="btn-secondary p-2.5 rounded-xl"><Filter className="h-4 w-4" /></button>
               <button className="btn-secondary p-2.5 rounded-xl"><RefreshCw className="h-4 w-4" /></button>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { id: 'RAD-2026-001', patient: 'Tony Stark', scan: 'Head CT Scan', priority: 'URGENT', status: 'PENDING' },
              { id: 'RAD-2026-002', patient: 'Steve Rogers', scan: 'Chest X-Ray', priority: 'ROUTINE', status: 'COMPLETED' },
              { id: 'RAD-2026-003', patient: 'Natasha Romanoff', scan: 'Pelvic Ultrasound', priority: 'ROUTINE', status: 'PROCESSING' },
              { id: 'RAD-2026-004', patient: 'Bruce Banner', scan: 'Full Body MRI', priority: 'STAT', status: 'PENDING' },
            ].map((order) => (
              <div key={order.id} className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40 hover:bg-white/60 transition-all group">
                 <div className="flex justify-between items-start mb-6">
                    <div className="h-14 w-14 rounded-2xl bg-secondary-900 text-white flex items-center justify-center">
                       <Activity className="h-7 w-7" />
                    </div>
                    <span className={`px-3 py-1 rounded-xl text-[10px] font-black 
                       ${order.priority === 'URGENT' || order.priority === 'STAT' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-secondary-50 text-secondary-600 border border-secondary-100'}
                    `}>
                       {order.priority}
                    </span>
                 </div>
                 
                 <div className="space-y-1 mb-6">
                    <h4 className="text-lg font-black text-secondary-900">{order.scan}</h4>
                    <p className="text-xs font-bold text-secondary-500">{order.patient} • {order.id}</p>
                 </div>

                 <div className="flex items-center justify-between pt-6 border-t border-secondary-50">
                    <div className="flex items-center gap-2">
                       {order.status === 'COMPLETED' ? (
                         <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                       ) : (
                         <Clock className="h-4 w-4 text-amber-500 animate-pulse" />
                       )}
                       <span className="text-[10px] font-black text-secondary-900 uppercase tracking-widest">{order.status}</span>
                    </div>
                    <button className="flex items-center gap-1 text-[10px] font-black text-primary-500 hover:translate-x-1 transition-transform uppercase tracking-widest">
                       View Details <ChevronRight className="h-3 w-3" />
                    </button>
                 </div>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
}
