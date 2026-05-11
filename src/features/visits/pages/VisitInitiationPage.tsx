import { PageHeader } from "@/components/layout/PageHeader";
import { useState, useEffect } from "react";
import {
  Search,
  User,
  ArrowRight,
  Clock,
  AlertCircle,
  ChevronRight,
  ClipboardList,
  Flame,
  CheckCircle2,
  Building2,
  RefreshCw,
  FileText,
  GitBranch,
} from "lucide-react";
import { searchPatients } from "@/features/patients/api/patients.api";
import type { Patient } from "@/features/patients/api/patients.api";
import { initiateVisit, getServiceDeliveryPoints } from "../api/visits.api";
import type { ServiceDeliveryPoint } from "../api/visits.api";
import { getVisitTemplates } from "../api/visit-flows.api";
import type { VisitTemplate } from "../api/visit-flows.api";
import { useNavigate, useLocation } from "react-router-dom";
import { routes } from "@/config/routes";

export function VisitInitiationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const patientFromState = location.state?.patient as Patient | undefined;

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(patientFromState || null);
  const [isSearching, setIsSearching] = useState(false);
  
  const [sdps, setSdps] = useState<ServiceDeliveryPoint[]>([]);
  const [templates, setTemplates] = useState<VisitTemplate[]>([]);
  const [selectedSdp, setSelectedSdp] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  
  const [priority, setPriority] = useState("ROUTINE");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Context Data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [sdpData, templateData] = await Promise.all([
          getServiceDeliveryPoints().catch(() => [] as ServiceDeliveryPoint[]),
          getVisitTemplates().catch(() => null),
        ]);

        // SDPs already come from /service-delivery-points/active so every entry
        // is active, but we filter defensively in case of stale records.
        const activeSdps = (Array.isArray(sdpData) ? sdpData : []).filter(
          (s) => s.is_active !== false,
        );
        setSdps(activeSdps);

        // Templates may come as { items: [] } or a defensive empty result
        const templateItems = Array.isArray(templateData?.items)
          ? templateData!.items
          : [];
        setTemplates(templateItems);

        if (activeSdps.length > 0) setSelectedSdp(activeSdps[0].id);
        if (templateItems.length > 0) setSelectedTemplate(templateItems[0].id);
      } catch (err) {
        console.error("Failed to load initiation context", err);
      }
    };
    loadData();
  }, []);

  // Search logic
  useEffect(() => {
    if (searchQuery.length > 2) {
      const delay = setTimeout(async () => {
        setIsSearching(true);
        try {
          const results = await searchPatients(searchQuery);
          setSearchResults((results as any).items || []);
        } catch (err) {
          console.error(err);
        } finally {
          setIsSearching(false);
        }
      }, 300);
      return () => clearTimeout(delay);
    }
  }, [searchQuery]);

  const handleInitiate = async () => {
    if (!selectedPatient || !selectedSdp) {
      setError("Pick a patient and a starting service point before initiating.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      // Build the payload defensively — drop any optional field that's empty
      // or zero so the backend doesn't trip on it. The spec matches the curl
      // example you shared.
      const payload: Record<string, unknown> = {
        patient_id: selectedPatient.id,
        priority,
        first_service_delivery_point_id: selectedSdp,
        use_appointment_service_point: false,
        visit_date: now,
        check_in_time: now,
        create_first_flow_step: true,
        create_queue_ticket: true,
        first_step_status: "PENDING",
        first_queue_status: "WAITING",
        mark_visit_waiting: true,
        fast_track: priority === "EMERGENCY",
        queue_position: 1,
      };
      // Optional fields — only include when they actually have a value
      if (reason.trim()) payload.visit_reason = reason.trim();
      if (selectedTemplate) payload.visit_flow_template_id = selectedTemplate;
      // Some backends reject "ACTIVE" on POST /initiate and assign the
      // status themselves. Only include it when the backend exposes the
      // expected enum — left off here to maximise compatibility.

      await initiateVisit(payload as Parameters<typeof initiateVisit>[0]);
      navigate(routes.visits);
    } catch (err: any) {
      // Surface the actual server complaint — FastAPI uses `detail`, some
      // endpoints use `message`, validation 422s come back as arrays.
      const data = err?.response?.data;
      const message =
        (typeof data?.message === "string" && data.message) ||
        (typeof data?.detail === "string" && data.detail) ||
        (Array.isArray(data?.detail) &&
          data.detail
            .map((d: any) => `${d.loc?.join(".") ?? "field"}: ${d.msg ?? "invalid"}`)
            .join(" · ")) ||
        "Visit initiation failed. Please verify clinical capacity.";
      setError(message);
      // Also log the full payload for debugging
      console.error("Visit initiation failed", { payload: err?.config?.data, response: data });
    } finally {
      setIsSubmitting(false);
    }
  };

  const priorityOptions = [
    { value: "ROUTINE", label: "Routine", color: "bg-emerald-500", icon: CheckCircle2 },
    { value: "URGENT", label: "Urgent", color: "bg-amber-500", icon: Clock },
    { value: "EMERGENCY", label: "Emergency", color: "bg-rose-500", icon: Flame },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <PageHeader 
          title="Clinical Admission & Routing" 
          description="Initiate a new care lifecycle and orchestrate the patient pathway."
        />
        <div className="flex gap-3">
          <button onClick={() => navigate(-1)} className="btn-secondary px-6 py-3 rounded-2xl">Cancel</button>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-12">
        {/* Left: Patient Sidebar */}
        <div className="lg:col-span-4 space-y-8">
          <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-100 shadow-premium min-h-[600px] flex flex-col bg-white/50 backdrop-blur-xl">
            <div className="flex items-center gap-4 mb-10">
              <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
                <User className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-black font-display tracking-tight">Patient Identity</h3>
                <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mt-0.5">Verification & Context</p>
              </div>
            </div>

            {!selectedPatient ? (
              <div className="space-y-6 flex-1">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400 group-focus-within:text-primary-500 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Search by ID or Name..." 
                    className="input-field pl-12 bg-white/80 border-secondary-100 h-14 text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                  {isSearching ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                      <div className="h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest tracking-[0.2em]">Searching Registry...</p>
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map(p => (
                      <button 
                        key={p.id}
                        onClick={() => setSelectedPatient(p)}
                        className="w-full flex items-center justify-between p-5 rounded-[1.5rem] bg-white border border-secondary-50 hover:border-primary-200 hover:shadow-xl hover:shadow-primary-500/5 transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-secondary-50 text-secondary-600 flex items-center justify-center font-black text-sm group-hover:bg-primary-500 group-hover:text-white transition-all">
                            {p.first_name[0]}{p.last_name[0]}
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-black text-secondary-900 group-hover:text-primary-600 transition-colors">{p.first_name} {p.last_name}</p>
                            <p className="text-[10px] font-mono font-bold text-secondary-400 uppercase tracking-tighter mt-0.5">{p.hospital_number}</p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-secondary-300 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
                      </button>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                      <p className="text-[10px] font-bold text-secondary-300 uppercase tracking-[0.25em]">Ready for Patient Search</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-8 animate-slide-up flex-1">
                <div className="relative p-8 rounded-[2.5rem] bg-slate-900 text-white shadow-2xl overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                  
                  <button 
                    onClick={() => setSelectedPatient(null)}
                    className="absolute top-6 right-6 p-2.5 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  
                  <div className="flex flex-col items-center text-center space-y-6">
                    <div className="h-24 w-24 rounded-[2.5rem] bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-3xl font-black shadow-2xl">
                      {selectedPatient.first_name[0]}{selectedPatient.last_name[0]}
                    </div>
                    <div>
                      <h4 className="text-2xl font-black tracking-tight mb-2">{selectedPatient.first_name} {selectedPatient.last_name}</h4>
                      <div className="inline-flex px-4 py-1.5 bg-white/10 rounded-full text-[11px] font-mono font-bold tracking-widest uppercase">
                        {selectedPatient.hospital_number}
                      </div>
                    </div>
                  </div>

                  <div className="mt-10 space-y-4">
                    <div className="flex items-center justify-between p-5 bg-white/5 rounded-3xl">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Gender</span>
                      <span className="text-xs font-black uppercase">{selectedPatient.gender}</span>
                    </div>
                    <div className="flex items-center justify-between p-5 bg-white/5 rounded-3xl">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Birth Date</span>
                      <span className="text-xs font-black">{selectedPatient.date_of_birth}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Encounter Setup */}
        <div className="lg:col-span-8 space-y-8">
          {error && (
            <div className="p-8 bg-rose-50 border border-rose-100 text-rose-600 rounded-[2.5rem] flex items-center gap-6 animate-shake shadow-lg">
              <AlertCircle className="h-8 w-8" />
              <div>
                <p className="text-lg font-black tracking-tight">Initiation Error</p>
                <p className="text-sm font-medium text-rose-500/80">{error}</p>
              </div>
            </div>
          )}

          <div className="glass-card rounded-[3rem] p-10 md:p-14 space-y-16 bg-white/80 shadow-premium relative overflow-hidden">
            <div className="flex items-center gap-6 border-b border-secondary-100 pb-10">
              <div className="h-16 w-16 rounded-[1.75rem] bg-primary-600 text-white flex items-center justify-center shadow-2xl">
                <ClipboardList className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-3xl font-black font-display tracking-tight text-secondary-900">Encounter Setup</h3>
                <p className="text-secondary-400 font-bold text-[11px] uppercase tracking-[0.3em] mt-1.5 flex items-center gap-2">
                  Orchestrate Lifecycle & Routing
                </p>
              </div>
            </div>

            <div className="space-y-12">
              <div className="grid gap-12 md:grid-cols-2">
                {/* Urgency */}
                <div className="space-y-6">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-secondary-500 flex items-center gap-2 ml-1">
                    <Flame className="h-4 w-4 text-amber-500" />
                    Encounter Priority
                  </label>
                  <div className="flex gap-3">
                    {priorityOptions.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPriority(opt.value)}
                        className={`flex-1 flex flex-col items-center gap-3 py-6 px-4 rounded-[2rem] transition-all border-2 ${
                          priority === opt.value 
                          ? `${opt.color} text-white border-transparent shadow-2xl` 
                          : "bg-white border-secondary-100 text-secondary-400 hover:border-primary-200"
                        }`}
                      >
                        <opt.icon className={`h-6 w-6 ${priority === opt.value ? 'text-white' : 'text-secondary-300'}`} />
                        <span className="font-black text-[10px] uppercase tracking-widest">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Initial Routing */}
                <div className="space-y-6">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-secondary-500 flex items-center gap-2 ml-1">
                    <Building2 className="h-4 w-4 text-primary-500" />
                    Initial Service Point (SDP)
                  </label>
                  <select 
                    value={selectedSdp || ""} 
                    onChange={(e) => setSelectedSdp(Number(e.target.value))}
                    className="input-field h-16 pl-6 font-black text-sm bg-white/50 border-secondary-100"
                  >
                    <option value="" disabled>Select Starting Point...</option>
                    {sdps.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pathway Template */}
              <div className="space-y-6">
                <label className="text-[11px] font-bold uppercase tracking-widest text-secondary-500 flex items-center gap-2 ml-1">
                  <GitBranch className="h-4 w-4 text-primary-500" />
                  Visit Flow Template
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  {templates.length > 0 ? templates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t.id)}
                      className={`p-6 rounded-[2rem] border-2 text-left transition-all group ${
                        selectedTemplate === t.id 
                        ? "bg-slate-900 text-white border-slate-900 shadow-xl" 
                        : "bg-white border-secondary-100 text-secondary-600 hover:border-primary-200"
                      }`}
                    >
                      <h5 className="font-black text-sm mb-2">{t.name}</h5>
                      <p className={`text-[10px] font-bold uppercase tracking-widest ${selectedTemplate === t.id ? 'text-white/40' : 'text-secondary-400'}`}>
                        {Array.isArray(t.steps) ? t.steps.length : 0} Defined Checkpoints
                      </p>
                      {t.code && (
                        <p className={`text-[9px] font-mono font-bold mt-1 ${selectedTemplate === t.id ? 'text-white/30' : 'text-secondary-300'}`}>
                          {t.code}
                        </p>
                      )}
                    </button>
                  )) : (
                    <div className="col-span-2 p-8 rounded-[2rem] border-2 border-dashed border-secondary-100 flex flex-col items-center justify-center text-center space-y-3">
                      <GitBranch className="h-8 w-8 text-secondary-200" />
                      <div>
                        <p className="text-sm font-black text-secondary-900">No Pathway Templates Found</p>
                        <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mt-1">Visit will proceed without a pre-defined flow</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-6">
                <label className="text-[11px] font-bold uppercase tracking-widest text-secondary-500 flex items-center gap-2 ml-1">
                  <FileText className="h-4 w-4 text-emerald-500" />
                  Clinical Indication / Chief Complaint
                </label>
                <textarea 
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="input-field h-32 pt-6 px-8 resize-none bg-white border-secondary-100 text-base font-medium" 
                  placeholder="Summarize the primary rationale for this clinical encounter..."
                />
              </div>
            </div>

            <div className="pt-12 border-t border-secondary-100 flex flex-col md:flex-row items-center justify-between gap-10">
              <div className="flex items-center gap-4 text-secondary-400">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                <p className="text-[10px] font-black uppercase tracking-widest">Enterprise Validation Ready</p>
              </div>
              
              <button 
                onClick={handleInitiate}
                disabled={!selectedPatient || !selectedSdp || isSubmitting}
                className="w-full md:w-auto btn-primary bg-slate-900 hover:bg-black text-white px-16 py-6 rounded-[2rem] font-black text-base tracking-tight shadow-2xl flex items-center justify-center gap-5 group disabled:opacity-30 transition-all active:scale-95"
              >
                <span>{isSubmitting ? "Generating Lifecycle..." : "Initialize Patient Visit"}</span>
                <ArrowRight className="h-6 w-6 group-hover:translate-x-2 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
