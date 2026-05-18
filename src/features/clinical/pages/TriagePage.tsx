import { PageHeader } from "@/components/layout/PageHeader";
import { useState, useEffect } from "react";
import {
   Activity,
   Thermometer,
   Heart,
   Wind,
   Weight,
   ArrowUpRight,
   Scale,
   Droplet,
   Save,
   Clock,
   User,
   History,
   AlertCircle
} from "lucide-react";
import { recordVitalSigns, getVisitVitalSigns, VitalSign } from "../api/vital-signs.api";
import { getCurrentStaff } from "@/features/staff/api/staff.api";
import { getVisitDetails, rerouteVisit, Visit } from "@/features/visits/api/visits.api";
import { useParams, useNavigate } from "react-router-dom";
import { routes } from "@/config/routes";

export function TriagePage() {
   const navigate = useNavigate();
   const { visitId } = useParams<{ visitId: string }>();

   const [visit, setVisit] = useState<Visit | null>(null);
   const [history, setHistory] = useState<VitalSign[]>([]);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);

   const [vitals, setVitals] = useState<any>({
      temperature_celsius: undefined,
      pulse_rate: undefined,
      respiratory_rate: undefined,
      systolic_bp: undefined,
      diastolic_bp: undefined,
      oxygen_saturation: undefined,
      weight_kg: undefined,
      height_cm: undefined,
      pain_score: 0,
   });

   const [bmi, setBmi] = useState<number | null>(null);

   useEffect(() => {
      const loadContext = async () => {
         if (!visitId) return;
         setIsLoading(true);
         try {
            const [visitData, vitalsHistory] = await Promise.all([
               getVisitDetails(Number(visitId)),
               getVisitVitalSigns(Number(visitId))
            ]);
            setVisit(visitData);
            setHistory(vitalsHistory.items);
         } catch (err) {
            console.error("Failed to load triage context", err);
            setError("Could not load visit details. Please verify the visit ID.");
         } finally {
            setIsLoading(false);
         }
      };
      loadContext();
   }, [visitId]);

   useEffect(() => {
      if (vitals.weight_kg && vitals.height_cm) {
         const heightInMeters = vitals.height_cm / 100;
         const calculatedBmi = vitals.weight_kg / (heightInMeters * heightInMeters);
         setBmi(parseFloat(calculatedBmi.toFixed(1)));
      } else {
         setBmi(null);
      }
   }, [vitals.weight_kg, vitals.height_cm]);

   const handleSave = async () => {
      if (!visitId) return;
      setIsSubmitting(true);
      setError(null);
      try {
         const currentStaff = await getCurrentStaff();
         if (!currentStaff) {
            setError("Unable to identify current clinician. Please re-login.");
            return;
         }

         await recordVitalSigns({
            visit_id: Number(visitId),
            recorded_by_staff_id: currentStaff.id,
            ...vitals
         });

         // Route back to queues or dashboard
         navigate(routes.queues);
      } catch (err: any) {
         setError(err.response?.data?.message || "Failed to save vital signs.");
      } finally {
         setIsSubmitting(false);
      }
   };

   const vitalConfigs = [
      { key: "temperature_celsius", label: "Temperature", unit: "°C", icon: Thermometer, color: "rose", placeholder: "36.5" },
      { key: "pulse_rate", label: "Pulse Rate", unit: "bpm", icon: Heart, color: "rose", placeholder: "72" },
      { key: "respiratory_rate", label: "Respiratory Rate", unit: "cpm", icon: Wind, color: "blue", placeholder: "16" },
      { key: "oxygen_saturation", label: "SpO2", unit: "%", icon: Droplet, color: "blue", placeholder: "98" },
      { key: "weight_kg", label: "Weight", unit: "kg", icon: Weight, color: "emerald", placeholder: "70" },
      { key: "height_cm", label: "Height", unit: "cm", icon: ArrowUpRight, color: "emerald", placeholder: "175" },
   ];

   if (isLoading) return <div className="p-20 text-center animate-pulse">Loading triage context...</div>;

   return (
      <div className="max-w-6xl mx-auto space-y-10 animate-fade-in">
         <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <PageHeader
               title="Clinical Triage"
               description="Capture clinical baseline data and determine encounter priority."
            />
            {visit && (
               <div className="flex items-center gap-4 px-6 py-4 rounded-[1.5rem] bg-white border border-secondary-200 shadow-sm">
                  <div className="h-10 w-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold">
                     {visit.patient?.first_name[0]}{visit.patient?.last_name[0]}
                  </div>
                  <div>
                     <p className="text-sm font-black text-secondary-900">{visit.patient?.first_name} {visit.patient?.last_name}</p>
                     <p className="text-[10px] font-mono font-bold text-secondary-400 uppercase tracking-widest">{visit.patient?.hospital_number}</p>
                  </div>
               </div>
            )}
         </div>

         {error && (
            <div className="p-6 bg-rose-50 border border-rose-100 text-rose-600 rounded-3xl flex items-center gap-4">
               <AlertCircle className="h-6 w-6" />
               <p className="font-bold">{error}</p>
            </div>
         )}

         <div className="grid gap-8 lg:grid-cols-12">
            {/* Left: Input Form */}
            <div className="lg:col-span-8 space-y-8">
               <div className="glass-card rounded-[2.5rem] p-10 md:p-12 shadow-premium">
                  <div className="grid gap-8 md:grid-cols-2">
                     {vitalConfigs.map((cfg) => (
                        <div key={cfg.key} className="space-y-3 group">
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                 <div className={`p-2 rounded-lg bg-${cfg.color}-50 text-${cfg.color}-600 group-focus-within:bg-${cfg.color}-600 group-focus-within:text-white transition-all`}>
                                    <cfg.icon className="h-4 w-4" />
                                 </div>
                                 <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">{cfg.label}</label>
                              </div>
                              <span className="text-[10px] font-bold text-secondary-400 uppercase">{cfg.unit}</span>
                           </div>
                           <input
                              type="number"
                              step="0.1"
                              placeholder={cfg.placeholder}
                              value={vitals[cfg.key] || ""}
                              onChange={(e) => setVitals({ ...vitals, [cfg.key]: parseFloat(e.target.value) })}
                              className="input-field py-4 text-xl font-black bg-secondary-50/50 border-secondary-400 focus:bg-white"
                           />
                        </div>
                     ))}

                     <div className="space-y-3 col-span-2 pt-6 border-t border-secondary-400 mt-4">
                        <div className="flex items-center gap-2">
                           <div className="p-2 rounded-lg bg-slate-900 text-white">
                              <Activity className="h-4 w-4" />
                           </div>
                           <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Arterial Blood Pressure (Systolic / Diastolic)</label>
                        </div>
                        <div className="flex items-center gap-6">
                           <div className="flex-1 space-y-2">
                              <input
                                 type="number"
                                 placeholder="120"
                                 value={vitals.systolic_bp || ""}
                                 onChange={(e) => setVitals({ ...vitals, systolic_bp: parseInt(e.target.value) })}
                                 className="input-field py-5 text-2xl font-black text-center bg-white border-2 border-secondary-400 focus:border-primary-500"
                              />
                              <p className="text-[9px] text-center font-bold text-secondary-400 uppercase tracking-widest">Systolic (mmHg)</p>
                           </div>
                           <span className="text-4xl font-light text-secondary-200">/</span>
                           <div className="flex-1 space-y-2">
                              <input
                                 type="number"
                                 placeholder="80"
                                 value={vitals.diastolic_bp || ""}
                                 onChange={(e) => setVitals({ ...vitals, diastolic_bp: parseInt(e.target.value) })}
                                 className="input-field py-5 text-2xl font-black text-center bg-white border-2 border-secondary-400 focus:border-primary-500"
                              />
                              <p className="text-[9px] text-center font-bold text-secondary-400 uppercase tracking-widest">Diastolic (mmHg)</p>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="flex items-center justify-end gap-6 mt-16 pt-10 border-t border-secondary-400">
                     <button onClick={() => setVitals({})} className="btn-secondary px-10 py-4 rounded-2xl font-bold">Clear All</button>
                     <button
                        onClick={handleSave}
                        disabled={isSubmitting}
                        className="btn-primary px-16 py-4 rounded-2xl gap-3 text-base shadow-xl shadow-primary-500/20"
                     >
                        {isSubmitting ? "Processing..." : (
                           <>
                              <Save className="h-5 w-5" />
                              <span>Synchronize & Complete</span>
                           </>
                        )}
                     </button>
                  </div>
               </div>
            </div>

            {/* Right: Calculations & Clinical History */}
            <div className="lg:col-span-4 space-y-8">
               <div className="glass-card rounded-[2.5rem] p-10 bg-slate-900 text-white relative overflow-hidden shadow-2xl">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                     <Scale className="h-40 w-40" />
                  </div>
                  <div className="flex items-center gap-3 mb-10 relative z-10">
                     <div className="p-2 rounded-lg bg-white/10">
                        <Activity className="h-4 w-4 text-primary-400" />
                     </div>
                     <h3 className="text-sm font-bold uppercase tracking-widest">Physiological Index</h3>
                  </div>

                  <div className="space-y-10 relative z-10">
                     <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-2">Calculated BMI</span>
                        <div className="flex items-end gap-4">
                           <p className="text-6xl font-black tracking-tighter">{bmi || "--.-"}</p>
                           <div className={`mb-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${bmi && bmi < 25 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              }`}>
                              {bmi ? (bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal Range" : bmi < 30 ? "Overweight" : "Obese Class") : "Awaiting Data"}
                           </div>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <div className="p-5 rounded-3xl bg-white/5 border border-white/5">
                           <p className="text-[10px] font-bold text-white/30 uppercase mb-2">Weight</p>
                           <p className="text-xl font-bold">{vitals.weight_kg || "-"} <span className="text-xs opacity-40">kg</span></p>
                        </div>
                        <div className="p-5 rounded-3xl bg-white/5 border border-white/5">
                           <p className="text-[10px] font-bold text-white/30 uppercase mb-2">Height</p>
                           <p className="text-xl font-bold">{vitals.height_cm || "-"} <span className="text-xs opacity-40">cm</span></p>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="glass-card rounded-[2.5rem] p-10 bg-white shadow-premium">
                  <div className="flex items-center justify-between mb-10">
                     <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-secondary-50 text-secondary-400">
                           <History className="h-4 w-4" />
                        </div>
                        <h3 className="text-sm font-bold uppercase tracking-widest">Visit Timeline</h3>
                     </div>
                  </div>

                  <div className="space-y-8">
                     {history.length > 0 ? history.map((entry) => (
                        <div key={entry.id} className="flex gap-5 group relative">
                           <div className="h-10 w-10 shrink-0 rounded-2xl bg-secondary-50 flex items-center justify-center text-secondary-400 group-hover:bg-primary-50 group-hover:text-primary-600 transition-all border border-secondary-400">
                              <Clock className="h-5 w-5" />
                           </div>
                           <div className="flex-1 min-w-0 border-b border-secondary-50 pb-6">
                              <p className="text-xs font-black text-secondary-900">{new Date(entry.recorded_at).toLocaleDateString()} • {new Date(entry.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                              <div className="grid grid-cols-2 gap-2 mt-3">
                                 <div className="px-3 py-2 rounded-xl bg-secondary-50 border border-secondary-400">
                                    <p className="text-[9px] font-bold text-secondary-400 uppercase tracking-tighter">BP</p>
                                    <p className="text-xs font-black">{entry.systolic_bp}/{entry.diastolic_bp}</p>
                                 </div>
                                 <div className="px-3 py-2 rounded-xl bg-secondary-50 border border-secondary-400">
                                    <p className="text-[9px] font-bold text-secondary-400 uppercase tracking-tighter">Temp</p>
                                    <p className="text-xs font-black">{entry.temperature_celsius}°C</p>
                                 </div>
                              </div>
                           </div>
                        </div>
                     )) : (
                        <div className="py-12 text-center">
                           <p className="text-[10px] font-bold text-secondary-300 uppercase tracking-widest leading-relaxed">No physiological history found for this visit.</p>
                        </div>
                     )}
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}
