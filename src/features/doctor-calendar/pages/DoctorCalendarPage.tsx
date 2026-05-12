import { PageHeader } from "@/components/layout/PageHeader";
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  MoreVertical,
  Plus,
  ChevronLeft,
  ChevronRight,
  Filter,
  Users,
} from "lucide-react";
import { useState } from "react";

const timeSlots = [
  "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"
];

const appointments = [
  { time: "09:00 AM", patient: "Alice Cooper", type: "General Consultation", duration: "30m", color: "bg-blue-500" },
  { time: "11:00 AM", patient: "John Smith", type: "Follow-up", duration: "45m", color: "bg-emerald-500" },
  { time: "02:00 PM", patient: "Maria Garcia", type: "Surgical Review", duration: "1h", color: "bg-primary-500" },
];

export function DoctorCalendarPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Physician Calendar"
          description="Manage consultation schedules, surgery bookings, and clinic availability."
        />
        <div className="flex gap-3">
          <button className="btn-secondary gap-3 py-3 px-6">
            <Filter className="h-4 w-4" />
            <span className="font-bold">Team View</span>
          </button>
          <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
            <Plus className="h-5 w-5" />
            <span className="font-bold">Book Slot</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* Date Selection Sidebar */}
        <div className="lg:col-span-1 space-y-6">
           <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium">
              <div className="flex items-center justify-between mb-8">
                 <h4 className="text-sm font-bold text-secondary-900 uppercase tracking-widest">May 2026</h4>
                 <div className="flex gap-2">
                    <button className="p-2 hover:bg-secondary-100 rounded-xl transition-all"><ChevronLeft className="h-4 w-4" /></button>
                    <button className="p-2 hover:bg-secondary-100 rounded-xl transition-all"><ChevronRight className="h-4 w-4" /></button>
                 </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center mb-4">
                 {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                    <span key={d} className="text-[10px] font-black text-secondary-300">{d}</span>
                 ))}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                 {Array.from({ length: 31 }).map((_, i) => (
                    <button 
                       key={i} 
                       className={`h-9 w-9 rounded-xl text-xs font-bold transition-all flex items-center justify-center
                          ${i + 1 === 12 ? 'bg-secondary-900 text-white shadow-lg shadow-secondary-900/20' : 'hover:bg-primary-50 text-secondary-600'}
                       `}
                    >
                       {i + 1}
                    </button>
                 ))}
              </div>
           </div>

           <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-100/50 bg-white/40 shadow-premium">
              <h4 className="text-sm font-bold text-secondary-900 uppercase tracking-widest mb-6">Upcoming Today</h4>
              <div className="space-y-4">
                 <div className="p-4 rounded-2xl bg-primary-50 border border-primary-100">
                    <p className="text-[10px] font-bold text-primary-600 uppercase tracking-widest mb-1">In 15 Mins</p>
                    <p className="text-sm font-black text-secondary-900">Ward Round - West Wing</p>
                 </div>
                 <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">In 2 Hours</p>
                    <p className="text-sm font-black text-secondary-900">OPD Consultation (12)</p>
                 </div>
              </div>
           </div>
        </div>

        {/* Schedule View */}
        <div className="lg:col-span-3">
           <div className="glass-card rounded-[3rem] overflow-hidden border border-secondary-100/50 shadow-premium bg-white/40 min-h-[600px]">
              <div className="grid grid-cols-1 divide-y divide-secondary-100/50">
                 {timeSlots.map(time => {
                    const apt = appointments.find(a => a.time === time);
                    return (
                       <div key={time} className="flex min-h-[80px] group">
                          <div className="w-32 py-6 px-8 border-r border-secondary-100/50 flex flex-col items-center justify-center shrink-0">
                             <span className="text-[10px] font-black text-secondary-400">{time}</span>
                          </div>
                          <div className="flex-1 p-4 relative">
                             {apt ? (
                                <div className={`h-full w-full rounded-[1.5rem] p-6 ${apt.color} text-white shadow-xl flex items-center justify-between`}>
                                   <div>
                                      <h5 className="font-black text-sm">{apt.patient}</h5>
                                      <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mt-1">{apt.type} • {apt.duration}</p>
                                   </div>
                                   <div className="flex gap-2">
                                      <button className="h-10 w-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all">
                                         <User className="h-4 w-4" />
                                      </button>
                                      <button className="h-10 w-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all">
                                         <MoreVertical className="h-4 w-4" />
                                      </button>
                                   </div>
                                </div>
                             ) : (
                                <div className="h-full w-full rounded-[1.5rem] border-2 border-dashed border-secondary-50 group-hover:border-primary-200 transition-all cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100">
                                   <Plus className="h-6 w-6 text-primary-300" />
                                </div>
                             )}
                          </div>
                       </div>
                    );
                 })}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
