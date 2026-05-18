import { PageHeader } from "@/components/layout/PageHeader";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Truck,
  User,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { routes } from "@/config/routes";
import { useAmbulances } from "../hooks/use-ambulance";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { RegisterAmbulanceForm } from "../components/RegisterAmbulanceForm";
import { AmbulanceStats } from "../components/AmbulanceStats";

export function AmbulanceListingPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useAmbulances();
  const ambulances = data?.items || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "AVAILABLE":
        return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case "ON_MISSION":
        return "bg-blue-50 text-blue-600 border-blue-100";
      case "MAINTENANCE":
        return "bg-amber-50 text-amber-600 border-amber-100";
      case "OUT_OF_SERVICE":
        return "bg-rose-50 text-rose-600 border-rose-100";
      default:
        return "bg-secondary-50 text-secondary-600 border-secondary-400";
    }
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Ambulance Fleet"
          description="Manage emergency response vehicles, driver certifications, and readiness status."
        />
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20"
        >
          <Plus className="h-5 w-5" />
          <span className="font-bold">Register Ambulance</span>
        </button>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Register New Ambulance"
        size="lg"
      >
        <RegisterAmbulanceForm
          onSuccess={() => {
            setIsModalOpen(false);
            refetch();
          }}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      <div className="grid gap-8">
        {/* Stats Dashboard */}
        <AmbulanceStats />

        {/* Search & Filter Bar */}
        <div className="glass-card rounded-[2rem] p-4 flex flex-col md:flex-row gap-4 items-center bg-white/40 backdrop-blur-md">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
            <input
              type="text"
              placeholder="Search by vehicle code, plate number or model..."
              className="w-full bg-white/50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
            />
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button className="btn-secondary flex-1 md:flex-none gap-2 px-6 py-4 rounded-2xl bg-white/80 border-secondary-400">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-bold">Filters</span>
            </button>
            <button onClick={() => refetch()} className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400 hover:rotate-180 transition-transform duration-500">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Fleet Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 bg-white/40 rounded-[2.5rem] animate-pulse" />
            ))
          ) : error ? (
            <div className="col-span-full py-20 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto text-rose-500 mb-4" />
              <p className="text-secondary-600 font-bold">Failed to load fleet data</p>
            </div>
          ) : ambulances.length > 0 ? (
            ambulances.map((ambulance) => (
              <div
                key={ambulance.id}
                onClick={() => navigate(routes.ambulances + "/" + ambulance.id)}
                className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 shadow-premium bg-white/40 hover:bg-white/60 transition-all group cursor-pointer"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="h-14 w-14 rounded-2xl bg-secondary-900/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Truck className="h-7 w-7 text-secondary-900" />
                  </div>
                  <span className={`px-4 py-2 rounded-xl text-[10px] font-bold border ${getStatusColor(ambulance.status)}`}>
                    {ambulance.status}
                  </span>
                </div>

                <div className="space-y-1 mb-6">
                  <h3 className="text-lg font-bold text-secondary-900">{ambulance.manufacturer} {ambulance.model}</h3>
                  <div className="flex items-center gap-2 text-secondary-400 text-xs font-bold">
                    <span className="bg-secondary-100 px-2 py-0.5 rounded uppercase">{ambulance.plate_number}</span>
                    <span>•</span>
                    <span>{ambulance.code}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 py-4 border-t border-secondary-400/50">
                  <div>
                    <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-1">Mileage</p>
                    <p className="text-sm font-bold text-secondary-900">{ambulance.current_mileage.toLocaleString()} KM</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-1">Equipment</p>
                    <p className="text-sm font-bold text-emerald-600">Ready</p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <div className="flex -space-x-2">
                    <div className="h-8 w-8 rounded-full bg-secondary-200 border-2 border-white flex items-center justify-center text-[10px] font-bold">DR</div>
                    <div className="h-8 w-8 rounded-full bg-primary-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-primary-700">+</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-secondary-300 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-32 text-center bg-white/20 rounded-[3rem] border-2 border-dashed border-secondary-200">
              <Truck className="h-16 w-16 mx-auto text-secondary-100 mb-6" />
              <h3 className="text-xl font-bold text-secondary-900">No Vehicles Registered</h3>
              <p className="text-secondary-500 mt-2 max-w-sm mx-auto">Start by adding your first ambulance vehicle to the system.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
