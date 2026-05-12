import { PageHeader } from "@/components/layout/PageHeader";
import {
  Building2,
  Plus,
  RefreshCw,
  Search,
  Filter,
  MoreHorizontal,
  ChevronRight,
  Settings as SettingsIcon,
  Activity,
  Users,
  Trash2,
} from "lucide-react";
import { useServicePoints, useDeleteServicePoint } from "../hooks/use-sdp";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { CardSkeleton } from "@/components/ui/Skeleton";

export function SDPListingPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data, isLoading, refetch } = useServicePoints();
  const deleteMutation = useDeleteServicePoint();
  
  const sdps = data?.items || [];

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Service Delivery Points"
          description="Manage clinical service points (Triage, Lab, Pharmacy) and their associated queue prefixes."
        />
        <button 
           onClick={() => setIsModalOpen(true)}
           className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20"
        >
          <Plus className="h-5 w-5" />
          <span className="font-bold">New Service Point</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* KPI Cards */}
        <div className="lg:col-span-1 space-y-4">
           <div className="glass-card rounded-[2rem] p-6 border border-secondary-100/50 bg-white/40 shadow-premium">
              <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-2">Active Points</p>
              <h4 className="text-2xl font-black text-secondary-900">{sdps.length}</h4>
           </div>
           <div className="glass-card rounded-[2rem] p-6 border border-secondary-100/50 bg-white/40 shadow-premium">
              <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-2">Total Queued Today</p>
              <h4 className="text-2xl font-black text-primary-600">142</h4>
           </div>
        </div>

        {/* SDP List */}
        <div className="lg:col-span-3 space-y-6">
           <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-secondary-900 flex items-center gap-2">
                 <Building2 className="h-5 w-5 text-primary-500" />
                 Operational Units
              </h3>
              <div className="flex gap-2">
                 <button className="btn-secondary p-2.5 rounded-xl"><Filter className="h-4 w-4" /></button>
                 <button onClick={() => refetch()} className="btn-secondary p-2.5 rounded-xl"><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /></button>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {isLoading ? (
                 Array.from({ length: 4 }).map((_, i) => (
                    <CardSkeleton key={i} />
                 ))
              ) : sdps.length > 0 ? (
                 sdps.map((sdp) => (
                    <div key={sdp.id} className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40 hover:bg-white/60 transition-all group relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                             onClick={() => { if(confirm('Delete this point?')) deleteMutation.mutate(sdp.id) }}
                             className="p-2 hover:bg-rose-50 text-secondary-400 hover:text-rose-500 rounded-xl"
                          >
                             <Trash2 className="h-4 w-4" />
                          </button>
                       </div>
                       
                       <div className="flex items-center gap-5 mb-6">
                          <div className="h-14 w-14 rounded-2xl bg-secondary-900 text-white flex items-center justify-center shadow-lg shadow-secondary-900/10">
                             <Activity className="h-7 w-7" />
                          </div>
                          <div>
                             <h4 className="text-lg font-black text-secondary-900">{sdp.name}</h4>
                             <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mt-1">Prefix: {sdp.queue_prefix}</p>
                          </div>
                       </div>
                       
                       <div className="flex items-center justify-between pt-6 border-t border-secondary-50">
                          <div className="flex items-center gap-2">
                             <Users className="h-4 w-4 text-secondary-400" />
                             <span className="text-xs font-bold text-secondary-600">12 Waiting</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${sdp.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                             {sdp.is_active ? 'OPERATIONAL' : 'INACTIVE'}
                          </span>
                       </div>
                    </div>
                 ))
              ) : (
                 <div className="col-span-full py-24 text-center bg-white/20 rounded-[3rem] border-2 border-dashed border-secondary-100">
                    <Building2 className="h-16 w-16 mx-auto text-secondary-100 mb-6" />
                    <h4 className="text-xl font-bold text-secondary-900">No Service Points</h4>
                    <p className="text-secondary-500 mt-2 max-w-xs mx-auto">
                       Create your first clinical unit to start processing patient queues.
                    </p>
                 </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
