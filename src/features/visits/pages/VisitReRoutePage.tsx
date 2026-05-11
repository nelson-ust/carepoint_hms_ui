import { PageHeader } from "@/components/layout/PageHeader";
import { useState, useEffect } from "react";
import { 
  ArrowRight, 
  Activity, 
  Clock, 
  ShieldCheck, 
  Stethoscope, 
  AlertCircle,
  ChevronRight,
  ClipboardList,
  Flame,
  CheckCircle2,
  Building2,
  RefreshCw,
  FileText,
  User,
  History,
  MoveHorizontal,
  MapPin,
  ArrowUpRight
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { getVisitDetails, getServiceDeliveryPoints, rerouteVisit, ServiceDeliveryPoint, Visit } from "../api/visits.api";
import { routes } from "@/config/routes";

export function VisitReRoutePage() {
  const { visitId } = useParams<{ visitId: string }>();
  const navigate = useNavigate();

  const [visit, setVisit] = useState<any>(null);
  const [sdps, setSdps] = useState<ServiceDeliveryPoint[]>([]);
  const [selectedSdp, setSelectedSdp] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!visitId) return;
      setIsLoading(true);
      try {
        const [visitData, sdpData] = await Promise.all([
          getVisitDetails(Number(visitId)),
          getServiceDeliveryPoints()
        ]);
        setVisit(visitData);
        const activeSdps = sdpData.filter(s => s.is_active && s.id !== visitData.current_service_delivery_point_id);
        setSdps(activeSdps);
        if (activeSdps.length > 0) setSelectedSdp(activeSdps[0].id);
      } catch (err: any) {
        setError("Failed to load visit context. Please ensure the visit ID is valid.");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [visitId]);

  const handleReroute = async () => {
    if (!visitId || !selectedSdp) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await rerouteVisit(Number(visitId), {
        service_delivery_point_id: selectedSdp,
        routed_by_id: 1, // Current user ID (mock)
        reason: reason,
        create_queue_ticket: true,
        queue_status: "WAITING",
        queue_position: 1,
        mark_as_current: true
      });
      navigate(routes.visits);
    } catch (err: any) {
      setError(err.response?.data?.message || "Rerouting failed. The target service point may be at capacity.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="h-16 w-16 border-4 border-primary-500 border-t-transparent rounded-[2rem] animate-spin shadow-2xl shadow-primary-500/20" />
        <p className="text-sm font-black text-secondary-400 uppercase tracking-[0.3em] animate-pulse">Initializing Reroute Context...</p>
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-8 animate-fade-in">
        <div className="h-24 w-24 bg-rose-50 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner">
          <AlertCircle className="h-12 w-12 text-rose-500" />
        </div>
        <div>
          <h3 className="text-3xl font-black text-secondary-900 tracking-tight">Visit Not Resolved</h3>
          <p className="text-secondary-500 mt-4 leading-relaxed max-w-md mx-auto">The requested visit identifier could not be located in the active registry. Please verify the visit record and try again.</p>
        </div>
        <button onClick={() => navigate(routes.visits)} className="btn-secondary px-8 py-4">Return to Registry</button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <PageHeader 
          title="Clinical Rerouting" 
          description="Transition patients between service delivery points to continue their care lifecycle."
        />
        <div className="flex items-center gap-4 bg-secondary-900/5 px-6 py-3 rounded-2xl border border-secondary-900/10">
          <History className="h-4 w-4 text-secondary-400" />
          <span className="text-[11px] font-mono font-bold text-secondary-600 uppercase tracking-widest">Encounter: {visit.visit_number}</span>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-12">
        {/* Left: Active Status */}
        <div className="lg:col-span-5 space-y-8">
          <div className="glass-card rounded-[3rem] p-10 border border-secondary-100 shadow-premium bg-white/50 backdrop-blur-2xl">
            <div className="flex items-center gap-5 mb-12">
              <div className="h-14 w-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center shadow-xl shadow-primary-500/20">
                <User className="h-7 w-7" />
              </div>
              <div>
                <h4 className="text-2xl font-black font-display tracking-tight text-secondary-900">{visit.patient?.first_name} {visit.patient?.last_name}</h4>
                <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-[0.25em] mt-1 flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  Currently In Progress
                </p>
              </div>
            </div>

            <div className="space-y-10">
              <div className="p-8 rounded-[2rem] bg-slate-900 text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700" />
                <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-4">Active Service Point</p>
                <div className="flex items-center gap-6">
                  <div className="h-16 w-16 rounded-[1.25rem] bg-white/10 flex items-center justify-center border border-white/10">
                    <Building2 className="h-8 w-8 text-primary-400" />
                  </div>
                  <div>
                    <h5 className="text-xl font-black tracking-tight leading-none mb-2">{visit.current_sdp_name || "Triaging / Registration"}</h5>
                    <p className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-tighter">SDP-ID: {visit.current_service_delivery_point_id || "N/A"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-3 text-secondary-900">
                  <Activity className="h-5 w-5 text-emerald-500" />
                  <h6 className="font-black text-sm uppercase tracking-widest">Initial Clinical Reason</h6>
                </div>
                <div className="p-6 rounded-3xl bg-secondary-50 border border-secondary-100 italic text-sm text-secondary-600 leading-relaxed shadow-inner">
                  "{visit.visit_reason || "No clinical indication provided at admission."}"
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Reroute Form */}
        <div className="lg:col-span-7 space-y-8">
          {error && (
            <div className="p-8 bg-rose-50 border border-rose-100 text-rose-600 rounded-[2.5rem] flex items-center gap-6 animate-shake shadow-lg shadow-rose-500/5">
              <div className="h-16 w-16 rounded-[1.5rem] bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <AlertCircle className="h-8 w-8" />
              </div>
              <p className="font-bold text-sm leading-relaxed">{error}</p>
            </div>
          )}

          <div className="glass-card rounded-[3rem] p-12 md:p-14 space-y-14 bg-white/80 shadow-premium relative">
            <div className="flex items-center gap-6 border-b border-secondary-100 pb-10">
              <div className="h-16 w-16 rounded-[1.75rem] bg-slate-900 text-white flex items-center justify-center shadow-2xl">
                <MoveHorizontal className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-3xl font-black font-display tracking-tight text-secondary-900">Transition Flow</h3>
                <p className="text-secondary-400 font-bold text-[11px] uppercase tracking-[0.3em] mt-1.5">New Clinical Checkpoint</p>
              </div>
            </div>

            <div className="space-y-12">
              <div className="space-y-6">
                <label className="text-[11px] font-bold uppercase tracking-widest text-secondary-500 flex items-center gap-2 ml-1">
                  <MapPin className="h-4 w-4 text-primary-500" />
                  Destination Service Point
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  {sdps.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSdp(s.id)}
                      className={`flex items-center justify-between p-6 rounded-[1.5rem] border-2 transition-all duration-300 group ${
                        selectedSdp === s.id 
                        ? "bg-secondary-900 border-secondary-900 text-white shadow-2xl shadow-primary-500/10 scale-105" 
                        : "bg-white border-secondary-100 text-secondary-600 hover:border-primary-200"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors ${selectedSdp === s.id ? "bg-white/10" : "bg-secondary-50"}`}>
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-black tracking-tight leading-none mb-1">{s.name}</p>
                          <p className={`text-[10px] font-bold uppercase tracking-tighter ${selectedSdp === s.id ? "text-white/40" : "text-secondary-400"}`}>{s.code}</p>
                        </div>
                      </div>
                      <ArrowUpRight className={`h-5 w-5 transition-transform ${selectedSdp === s.id ? "text-white translate-x-1 -translate-y-1" : "text-secondary-200"}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <label className="text-[11px] font-bold uppercase tracking-widest text-secondary-500 flex items-center gap-2 ml-1">
                  <FileText className="h-4 w-4 text-emerald-500" />
                  Transition Rationale
                </label>
                <textarea 
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="input-field h-40 pt-6 px-8 bg-white/50 border-secondary-100 text-base font-medium placeholder:text-secondary-300 resize-none rounded-[2rem]" 
                  placeholder="Summarize the reason for rerouting (e.g., Clinical referral, Lab investigations completed...)"
                />
              </div>
            </div>

            <div className="pt-10 flex flex-col md:flex-row items-center justify-between gap-10">
              <div className="flex items-center gap-4 text-secondary-400">
                <ShieldCheck className="h-6 w-6 text-emerald-500" />
                <p className="text-[11px] font-bold uppercase tracking-widest leading-none">Security Cleared</p>
              </div>
              <button 
                onClick={handleReroute}
                disabled={!selectedSdp || isSubmitting}
                className="w-full md:w-auto btn-primary bg-primary-600 hover:bg-primary-700 px-16 py-6 rounded-[2rem] font-black text-sm tracking-tight shadow-2xl shadow-primary-500/20 flex items-center justify-center gap-5 group disabled:opacity-30 transition-all active:scale-95"
              >
                <span>{isSubmitting ? "Processing Flow Transition..." : "Execute Rerouting"}</span>
                <ArrowRight className="h-6 w-6 group-hover:translate-x-2 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
