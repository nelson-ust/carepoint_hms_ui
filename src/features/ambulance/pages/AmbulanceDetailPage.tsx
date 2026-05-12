import { PageHeader } from "@/components/layout/PageHeader";
import {
  ArrowLeft,
  Truck,
  User,
  Wrench,
  Shield,
  Activity,
  History,
  Calendar,
  AlertTriangle,
  ChevronRight,
  MoreHorizontal,
  Settings as SettingsIcon,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { routes } from "@/config/routes";
import { useAmbulance } from "../hooks/use-ambulance";
import { format } from "date-fns";

export function AmbulanceDetailPage() {
  const navigate = useNavigate();
  const { ambulanceId } = useParams<{ ambulanceId: string }>();
  const { data: ambulance, isLoading, error } = useAmbulance(Number(ambulanceId));

  if (isLoading) return <div className="p-20 text-center">Loading vehicle data...</div>;
  if (!ambulance) return <div className="p-20 text-center">Vehicle not found.</div>;

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <button 
            onClick={() => navigate(routes.ambulances)}
            className="flex items-center gap-2 text-secondary-400 hover:text-secondary-900 font-bold transition-all group"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] uppercase tracking-widest">Back to Fleet</span>
          </button>
          <PageHeader
            title={`${ambulance.manufacturer} ${ambulance.model}`}
            description={`Fleet Code: ${ambulance.code} • Plate: ${ambulance.plate_number}`}
          />
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary gap-3 py-3 px-6">
            <SettingsIcon className="h-4 w-4" />
            <span className="font-bold">Maintenance Mode</span>
          </button>
          <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
            <Wrench className="h-5 w-5" />
            <span className="font-bold">Schedule Service</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Main Stats */}
        <div className="lg:col-span-2 space-y-8">
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="glass-card rounded-[2rem] p-6 border border-secondary-100/50 bg-white/40">
                 <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-2">Status</p>
                 <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100">
                    {ambulance.status}
                 </span>
              </div>
              <div className="glass-card rounded-[2rem] p-6 border border-secondary-100/50 bg-white/40">
                 <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-2">Current Odometer</p>
                 <p className="text-xl font-black text-secondary-900">{ambulance.current_mileage.toLocaleString()} KM</p>
              </div>
              <div className="glass-card rounded-[2rem] p-6 border border-secondary-100/50 bg-white/40">
                 <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-2">Readiness</p>
                 <p className="text-xl font-black text-emerald-600">100%</p>
              </div>
           </div>

           {/* Tabs / Sub-sections */}
           <div className="space-y-6">
              <div className="flex border-b border-secondary-100 gap-8">
                 <button className="pb-4 border-b-2 border-primary-500 text-secondary-900 font-bold text-sm">Overview</button>
                 <button className="pb-4 text-secondary-400 font-bold text-sm hover:text-secondary-600">Equipments</button>
                 <button className="pb-4 text-secondary-400 font-bold text-sm hover:text-secondary-600">Service Logs</button>
                 <button className="pb-4 text-secondary-400 font-bold text-sm hover:text-secondary-600">Mission History</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40">
                    <h4 className="text-sm font-bold text-secondary-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                       <Shield className="h-4 w-4 text-primary-500" />
                       Assigned Drivers
                    </h4>
                    <div className="space-y-4">
                       <div className="flex items-center gap-4 p-4 rounded-2xl bg-secondary-900/5">
                          <div className="h-10 w-10 rounded-xl bg-secondary-200" />
                          <div>
                             <p className="text-sm font-bold text-secondary-900">John Doe</p>
                             <p className="text-[10px] text-secondary-500 font-medium">Class C License • Active</p>
                          </div>
                       </div>
                       <button className="w-full py-3 rounded-2xl border-2 border-dashed border-secondary-200 text-secondary-400 text-xs font-bold hover:border-primary-500 hover:text-primary-500 transition-all">
                          + Assign Driver
                       </button>
                    </div>
                 </div>

                 <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40">
                    <h4 className="text-sm font-bold text-secondary-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                       <Activity className="h-4 w-4 text-primary-500" />
                       Recent Mission
                    </h4>
                    <div className="p-4 rounded-2xl bg-primary-50/50 border border-primary-100">
                       <p className="text-[10px] font-bold text-primary-600 uppercase tracking-widest mb-2">Last Dispatch</p>
                       <h5 className="text-sm font-bold text-secondary-900 mb-1">Trauma Emergency #829</h5>
                       <p className="text-xs text-secondary-500 font-medium">May 11, 2026 • 14:22 - 15:10</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Technical Data Sidebar */}
        <div className="lg:col-span-1 space-y-6">
           <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium">
              <h4 className="text-sm font-bold text-secondary-900 uppercase tracking-widest mb-6">Technical Specifications</h4>
              <div className="space-y-4">
                 <div className="flex justify-between py-3 border-b border-secondary-50">
                    <span className="text-xs text-secondary-400 font-bold">Year</span>
                    <span className="text-xs text-secondary-900 font-black">{ambulance.year}</span>
                 </div>
                 <div className="flex justify-between py-3 border-b border-secondary-50">
                    <span className="text-xs text-secondary-400 font-bold">Engine Type</span>
                    <span className="text-xs text-secondary-900 font-black">2.8L Turbo Diesel</span>
                 </div>
                 <div className="flex justify-between py-3 border-b border-secondary-50">
                    <span className="text-xs text-secondary-400 font-bold">Oxygen Capacity</span>
                    <span className="text-xs text-secondary-900 font-black">2000L (2 Cyl)</span>
                 </div>
                 <div className="flex justify-between py-3">
                    <span className="text-xs text-secondary-400 font-bold">Last Inspected</span>
                    <span className="text-xs text-secondary-900 font-black">April 12, 2026</span>
                 </div>
              </div>
           </div>

           <div className="glass-card rounded-[2.5rem] p-8 border border-amber-100 bg-amber-50/30">
              <div className="flex items-start gap-4">
                 <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0" />
                 <div>
                    <h4 className="text-sm font-bold text-secondary-900 mb-1">Service Reminder</h4>
                    <p className="text-xs text-secondary-500 leading-relaxed">
                       This vehicle is due for a routine oil change and brake inspection in 1,240 KM.
                    </p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
