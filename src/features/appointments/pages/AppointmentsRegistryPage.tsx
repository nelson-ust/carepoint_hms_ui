import { PageHeader } from "@/components/layout/PageHeader";
import {
   Calendar,
   Clock,
   User,
   Plus,
   Search,
   Filter,
   MoreVertical,
   CheckCircle2,
   XCircle,
   AlertCircle,
   RefreshCw,
   ChevronLeft,
   ChevronRight,
   ExternalLink,
} from "lucide-react";
import { useState, useEffect } from "react";
import { appointmentsApi, type Appointment } from "../api/appointments.api";
import { useNavigate } from "react-router-dom";
import { routes } from "@/config/routes";

export function AppointmentsRegistryPage() {
   const navigate = useNavigate();
   const [appointments, setAppointments] = useState<Appointment[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);

   const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
         const data = await appointmentsApi.list();
         setAppointments(data.items || []);
      } catch (err: any) {
         setError("Failed to synchronize with the appointment registry.");
      } finally {
         setIsLoading(false);
      }
   };

   useEffect(() => {
      load();
   }, []);

   const getStatusColor = (status: string) => {
      switch (status) {
         case 'SCHEDULED': return 'bg-primary-50 text-primary-600 border-primary-100';
         case 'CHECKED_IN': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
         case 'CANCELLED': return 'bg-rose-50 text-rose-600 border-rose-100';
         case 'COMPLETED': return 'bg-secondary-50 text-secondary-600 border-secondary-400';
         default: return 'bg-secondary-50 text-secondary-400 border-secondary-400';
      }
   };

   return (
      <div className="space-y-10 animate-fade-in pb-20">
         <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <PageHeader
               title="Appointment Registry"
               description="Manage patient bookings, clinician schedules, and session availability."
            />
            <div className="flex gap-3">
               <button onClick={load} className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400 hover:rotate-180 transition-transform duration-500">
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
               </button>
               <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
                  <Plus className="h-5 w-5" />
                  <span className="font-bold">Book Appointment</span>
               </button>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
            {/* Filters Sidebar */}
            <div className="lg:col-span-1 space-y-6">
               <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 shadow-premium">
                  <h4 className="text-[10px] font-bold text-secondary-400 uppercase tracking-[0.2em] mb-6">Calendar View</h4>
                  <div className="space-y-4">
                     <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-black text-secondary-900">May 2026</span>
                        <div className="flex gap-1">
                           <ChevronLeft className="h-4 w-4 text-secondary-400 cursor-pointer" />
                           <ChevronRight className="h-4 w-4 text-secondary-400 cursor-pointer" />
                        </div>
                     </div>
                     <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: 31 }).map((_, i) => (
                           <div key={i} className={`h-8 w-8 flex items-center justify-center text-[10px] font-bold rounded-lg ${i + 1 === 12 ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'text-secondary-500 hover:bg-secondary-50'}`}>
                              {i + 1}
                           </div>
                        ))}
                     </div>
                  </div>
               </div>

               <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 shadow-premium">
                  <h4 className="text-[10px] font-bold text-secondary-400 uppercase tracking-[0.2em] mb-6">Clinician Filter</h4>
                  <div className="relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
                     <input type="text" placeholder="Search staff..." className="w-full bg-white/50 border border-secondary-400 rounded-xl pl-10 pr-4 py-3 text-xs outline-none" />
                  </div>
               </div>
            </div>

            {/* Main List */}
            <div className="lg:col-span-3 space-y-6">
               {error && (
                  <div className="p-6 rounded-[2rem] bg-rose-50 border border-rose-100 text-rose-600 flex items-center gap-4 animate-shake">
                     <AlertCircle className="h-6 w-6" />
                     <p className="text-sm font-bold">{error}</p>
                  </div>
               )}

               <div className="glass-card rounded-[2.5rem] overflow-hidden border border-secondary-400/50 shadow-premium bg-white/40">
                  <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead>
                           <tr className="bg-secondary-900/5">
                              <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Time & Date</th>
                              <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Patient</th>
                              <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Clinician</th>
                              <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Status</th>
                              <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-right">Actions</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary-100/50">
                           {isLoading ? (
                              Array.from({ length: 5 }).map((_, i) => (
                                 <tr key={i} className="animate-pulse">
                                    <td colSpan={5} className="px-8 py-6"><div className="h-10 bg-secondary-100/30 rounded-xl" /></td>
                                 </tr>
                              ))
                           ) : appointments.length === 0 ? (
                              <tr>
                                 <td colSpan={5} className="px-8 py-32 text-center">
                                    <Calendar className="h-12 w-12 mx-auto text-secondary-200 mb-4" />
                                    <h4 className="text-lg font-bold text-secondary-900">No Appointments Recorded</h4>
                                    <p className="text-sm text-secondary-400 mt-2">Start booking patients to see them here.</p>
                                 </td>
                              </tr>
                           ) : (
                              appointments.map((apt) => (
                                 <tr key={apt.id} className="hover:bg-primary-50/20 transition-all group">
                                    <td className="px-8 py-6">
                                       <div className="flex flex-col">
                                          <span className="text-sm font-black text-secondary-900">{apt.start_time}</span>
                                          <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">{apt.appointment_date}</span>
                                       </div>
                                    </td>
                                    <td className="px-8 py-6">
                                       <div className="flex items-center gap-3">
                                          <div className="h-9 w-9 rounded-xl bg-secondary-50 flex items-center justify-center text-secondary-400 font-bold text-xs uppercase tracking-tighter">
                                             {apt.patient_name.split(' ').map(n => n[0]).join('')}
                                          </div>
                                          <span className="text-sm font-bold text-secondary-900">{apt.patient_name}</span>
                                       </div>
                                    </td>
                                    <td className="px-8 py-6">
                                       <p className="text-sm font-medium text-secondary-700">Dr. {apt.clinician_name}</p>
                                    </td>
                                    <td className="px-8 py-6">
                                       <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${getStatusColor(apt.status)}`}>
                                          {apt.status}
                                       </span>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                       <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                          <button className="p-2.5 rounded-xl bg-white border border-secondary-400 text-secondary-400 hover:text-primary-600 transition-all">
                                             <CheckCircle2 className="h-4 w-4" />
                                          </button>
                                          <button className="p-2.5 rounded-xl bg-white border border-secondary-400 text-secondary-400 hover:text-rose-600 transition-all">
                                             <XCircle className="h-4 w-4" />
                                          </button>
                                          <button className="p-2.5 rounded-xl bg-secondary-900 text-white shadow-lg shadow-secondary-900/10">
                                             <MoreVertical className="h-4 w-4" />
                                          </button>
                                       </div>
                                    </td>
                                 </tr>
                              ))
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
