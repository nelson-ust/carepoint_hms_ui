import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { 
  User, 
  Activity, 
  Calendar, 
  Clock, 
  ArrowRight, 
  ChevronRight, 
  ShieldCheck, 
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  FileText,
  ClipboardList,
  Plus,
  History,
  TrendingUp,
  HeartPulse,
  Stethoscope,
  FlaskConical,
  Zap
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { getPatientById } from "../api/patients.api";
import type { Patient } from "../api/patients.api";
import { getVisits } from "@/features/visits/api/visits.api";
import type { Visit } from "@/features/visits/api/visits.api";
import { routes } from "@/config/routes";

export function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  
  const [patient, setPatient] = useState<Patient | null>(null);
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [recentVisits, setRecentVisits] = useState<Visit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) return;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const id = Number(patientId);
        const [patientData, visitsResponse] = await Promise.all([
          getPatientById(id),
          getVisits({ patient_id: id, limit: 10 })
        ]);
        
        setPatient(patientData);
        
        const allVisits = visitsResponse.items || [];
        const active = allVisits.find(v => v.status === 'ACTIVE' || v.status === 'IN_PROGRESS' || v.status === 'WAITING');
        setActiveVisit(active || null);
        setRecentVisits(allVisits.filter(v => v.id !== active?.id));
        
      } catch (err: any) {
        console.error("Failed to load patient dashboard", err);
        setError("Unable to retrieve patient clinical records.");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [patientId]);

  if (isLoading) {
    return (
      <div className="h-[80vh] w-full flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <div className="h-20 w-20 border-4 border-secondary-100 rounded-full" />
          <div className="absolute inset-0 h-20 w-20 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-xs font-black uppercase tracking-[0.3em] text-secondary-400 animate-pulse">Synchronizing Clinical Data</p>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="h-[80vh] w-full flex items-center justify-center">
        <div className="glass-card rounded-[3rem] p-12 text-center max-w-md border border-rose-100 bg-white/50 backdrop-blur-xl">
          <AlertCircle className="h-16 w-16 text-rose-500 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-secondary-900 mb-2">Record Access Failed</h2>
          <p className="text-secondary-500 mb-8 font-medium">{error || "Patient not found."}</p>
          <button onClick={() => navigate(routes.patients)} className="btn-primary w-full py-4">Return to Registry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="h-20 w-20 rounded-[2.5rem] bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center text-3xl font-black shadow-2xl shadow-primary-500/30 ring-8 ring-primary-500/10">
            {patient.first_name?.[0]}{patient.last_name?.[0]}
          </div>
          <div>
            <h1 className="text-4xl font-black font-display tracking-tight text-secondary-900 leading-none">
              {patient.first_name} {patient.last_name}
            </h1>
            <div className="flex items-center gap-3 mt-3">
              <span className="px-3 py-1 bg-secondary-900 text-white rounded-lg text-[10px] font-mono font-bold tracking-widest uppercase">
                {patient.hospital_number}
              </span>
              <span className="h-1 w-1 bg-secondary-300 rounded-full" />
              <p className="text-xs font-bold text-secondary-400 uppercase tracking-widest">
                {patient.gender} • {patient.date_of_birth ? `${new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()} Years` : 'Age N/A'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(routes.visitInitiate, { state: { patient } })}
            disabled={!!activeVisit}
            className={`btn-primary px-8 py-4 rounded-2xl flex items-center gap-3 shadow-xl ${activeVisit ? 'opacity-30 grayscale cursor-not-allowed' : 'shadow-primary-500/20'}`}
          >
            <Plus className="h-5 w-5" />
            <span className="font-bold">Initiate Visit</span>
          </button>
        </div>
      </div>

      {/* Status Banner for Active Visit */}
      {activeVisit && (
        <div className="relative overflow-hidden group">
          <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-md" />
          <div className="relative border-2 border-emerald-500/20 rounded-[3rem] p-8 lg:p-10 flex flex-col lg:flex-row items-center justify-between gap-8 shadow-2xl shadow-emerald-500/10">
            <div className="flex items-center gap-8">
              <div className="h-20 w-20 rounded-[2rem] bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 animate-pulse-slow">
                <Activity className="h-10 w-10" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  <h3 className="text-2xl font-black text-secondary-900">Active Encounter Detected</h3>
                </div>
                <p className="text-secondary-500 font-medium max-w-md">
                  This patient is currently undergoing a clinical lifecycle at <span className="font-bold text-secondary-900">{activeVisit.current_service_delivery_point?.name || 'Reception'}</span>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 w-full lg:w-auto">
              <div className="flex-1 lg:flex-none px-8 py-4 bg-white/50 border border-emerald-100 rounded-2xl text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-1">Visit Code</p>
                <p className="text-sm font-mono font-black text-secondary-900">{activeVisit.visit_code}</p>
              </div>
              <Link 
                to={routes.visitDetail.replace(':visitId', String(activeVisit.id))}
                className="flex-1 lg:flex-none btn-primary bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20"
              >
                <span className="font-black uppercase tracking-widest text-xs">Access Lifecycle</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-10">
        {/* Left: Vital Info & Identity */}
        <div className="lg:col-span-4 space-y-10">
          <div className="glass-card rounded-[3rem] p-10 border border-secondary-100/50 shadow-premium bg-white/40 backdrop-blur-xl">
            <h3 className="text-xl font-black font-display mb-10 flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-primary-500" />
              Identity Context
            </h3>
            
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex items-center gap-4 group">
                  <div className="h-10 w-10 rounded-xl bg-secondary-50 flex items-center justify-center group-hover:bg-primary-50 transition-colors">
                    <Phone className="h-5 w-5 text-secondary-400 group-hover:text-primary-500 transition-colors" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">Mobile Terminal</p>
                    <p className="text-sm font-bold text-secondary-900">{patient.phone_number}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 group">
                  <div className="h-10 w-10 rounded-xl bg-secondary-50 flex items-center justify-center group-hover:bg-primary-50 transition-colors">
                    <Mail className="h-5 w-5 text-secondary-400 group-hover:text-primary-500 transition-colors" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">Secure Email</p>
                    <p className="text-sm font-bold text-secondary-900">{patient.email || 'None Provided'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 group">
                  <div className="h-10 w-10 rounded-xl bg-secondary-50 flex items-center justify-center group-hover:bg-primary-50 transition-colors">
                    <MapPin className="h-5 w-5 text-secondary-400 group-hover:text-primary-500 transition-colors" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">Primary Residence</p>
                    <p className="text-sm font-bold text-secondary-900 leading-tight">{patient.address}, {patient.city}</p>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-secondary-100">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-secondary-400 mb-6">Financial Classification</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100">
                    <p className="text-[9px] font-black uppercase text-emerald-600 mb-1">Payer Group</p>
                    <p className="text-xs font-black text-emerald-900 uppercase">{patient.payer_type}</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-primary-50 border border-primary-100">
                    <p className="text-[9px] font-black uppercase text-primary-600 mb-1">Account Type</p>
                    <p className="text-xs font-black text-primary-900 uppercase">{patient.patient_type}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-6">
            <div className="glass-card rounded-[2.5rem] p-6 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-xl shadow-indigo-500/20">
              <TrendingUp className="h-6 w-6 mb-4 opacity-50" />
              <p className="text-2xl font-black leading-none">12</p>
              <p className="text-[9px] font-black uppercase tracking-widest mt-2 opacity-70">Total Encounters</p>
            </div>
            <div className="glass-card rounded-[2.5rem] p-6 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-xl shadow-emerald-500/20">
              <HeartPulse className="h-6 w-6 mb-4 opacity-50" />
              <p className="text-2xl font-black leading-none">98%</p>
              <p className="text-[9px] font-black uppercase tracking-widest mt-2 opacity-70">Adherence Score</p>
            </div>
          </div>
        </div>

        {/* Right: Clinical Timeline & Modules */}
        <div className="lg:col-span-8 space-y-10">
          {/* Quick Actions / Modules */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Triage', icon: HeartPulse, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-100' },
              { label: 'Notes', icon: FileText, color: 'text-primary-500', bg: 'bg-primary-50', border: 'border-primary-100' },
              { label: 'Laboratory', icon: FlaskConical, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100' },
              { label: 'Prescriptions', icon: Stethoscope, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            ].map(mod => (
              <button key={mod.label} className={`p-6 rounded-[2rem] border ${mod.border} ${mod.bg} flex flex-col items-center gap-3 hover:scale-105 transition-all group`}>
                <mod.icon className={`h-6 w-6 ${mod.color}`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-secondary-900">{mod.label}</span>
              </button>
            ))}
          </div>

          {/* Historical Encounters */}
          <div className="glass-card rounded-[3rem] p-10 border border-secondary-100/50 shadow-premium bg-white/40">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-secondary-900 text-white flex items-center justify-center">
                  <History className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black font-display tracking-tight text-secondary-900">Encounter History</h3>
                  <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-widest mt-0.5">Clinical Timeline</p>
                </div>
              </div>
              <Link 
                to={`${routes.visits}?patient_id=${patient.id}`}
                className="text-[10px] font-black uppercase tracking-widest text-primary-600 hover:text-primary-700 flex items-center gap-2"
              >
                View All <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-4">
              {recentVisits.length > 0 ? recentVisits.map(visit => (
                <div key={visit.id} className="p-6 rounded-[2rem] bg-white/60 border border-secondary-100 flex items-center justify-between group hover:border-primary-200 hover:bg-white transition-all">
                  <div className="flex items-center gap-6">
                    <div className="h-14 w-14 rounded-2xl bg-secondary-50 flex flex-col items-center justify-center text-secondary-500 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
                      <span className="text-xs font-black leading-none">{new Date(visit.visit_date).getDate()}</span>
                      <span className="text-[8px] font-bold uppercase mt-1">{new Date(visit.visit_date).toLocaleString('default', { month: 'short' })}</span>
                    </div>
                    <div>
                      <p className="text-sm font-black text-secondary-900">#{visit.visit_code}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">{visit.status}</span>
                        <span className="h-1 w-1 bg-secondary-200 rounded-full" />
                        <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">{visit.priority}</span>
                      </div>
                    </div>
                  </div>
                  <Link 
                    to={routes.visitDetail.replace(':visitId', String(visit.id))}
                    className="p-3 bg-secondary-50 group-hover:bg-primary-500 group-hover:text-white rounded-xl transition-all"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )) : (
                <div className="py-20 text-center space-y-4">
                  <div className="h-20 w-20 bg-secondary-50 rounded-3xl flex items-center justify-center mx-auto">
                    <ClipboardList className="h-10 w-10 text-secondary-200" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-secondary-300">No Historical Records</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
