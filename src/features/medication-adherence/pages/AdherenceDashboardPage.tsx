import { PageHeader } from "@/components/layout/PageHeader";
import {
   AlertTriangle,
   Bell,
   Filter,
   MoreHorizontal,
   Pill,
   RefreshCw,
   TrendingUp,
} from "lucide-react";
import {
   useAdherenceAlerts,
   useAdherenceDoses,
   useAdherenceProfiles,
   useAdherenceSchedules,
   useAdherenceSnapshots,
   useConfirmDose,
} from "../hooks/use-adherence";
import { format } from "date-fns";

const RING_CIRCUMFERENCE = 364.4;

const doseStatusClasses: Record<string, string> = {
   TAKEN: "bg-emerald-50 text-emerald-600 border-emerald-100",
   SCHEDULED: "bg-amber-50 text-amber-600 border-amber-100",
   DELAYED: "bg-amber-50 text-amber-600 border-amber-100",
   MISSED: "bg-rose-50 text-rose-600 border-rose-100",
   SKIPPED: "bg-secondary-50 text-secondary-600 border-secondary-200",
   STOPPED: "bg-secondary-50 text-secondary-600 border-secondary-200",
};

export function AdherenceDashboardPage() {
   const { data: alertsData, isLoading: alertsLoading } = useAdherenceAlerts();
   const { data: dosesData, isLoading: dosesLoading, refetch: refetchDoses } = useAdherenceDoses();
   const { data: schedulesData } = useAdherenceSchedules();
   const { data: profilesData } = useAdherenceProfiles();
   const { data: snapshotsData, isLoading: snapshotsLoading } = useAdherenceSnapshots();
   const confirmDose = useConfirmDose();

   const alerts = alertsData?.items || [];
   const doses = dosesData?.items || [];
   const snapshots = snapshotsData?.items || [];

   // schedule_id -> medication name, resolved via schedules -> profiles.
   const profileNameById = new Map(
      (profilesData?.items || []).map((p) => [p.id, p.drug_name_snapshot]),
   );
   const medicationByScheduleId = new Map(
      (schedulesData?.items || []).map((s) => [s.id, profileNameById.get(s.medication_profile_id)]),
   );

   // Adherence score: average of persisted snapshots; if none, derive from
   // confirmed dose outcomes; otherwise unknown ("—").
   let adherencePct: number | null = null;
   if (snapshots.length > 0) {
      const total = snapshots.reduce((sum, s) => sum + Number(s.adherence_pct || 0), 0);
      adherencePct = Math.round(total / snapshots.length);
   } else {
      const decided = doses.filter((d) => ["TAKEN", "MISSED", "SKIPPED"].includes(d.status));
      if (decided.length > 0) {
         const taken = decided.filter((d) => d.status === "TAKEN").length;
         adherencePct = Math.round((taken / decided.length) * 100);
      }
   }
   const ringOffset =
      adherencePct === null
         ? RING_CIRCUMFERENCE
         : RING_CIRCUMFERENCE * (1 - Math.min(Math.max(adherencePct, 0), 100) / 100);

   return (
      <div className="space-y-10 animate-fade-in pb-20">
         <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <PageHeader
               title="Medication Adherence"
               description="Monitor dose schedules, track patient adherence metrics, and respond to missed medication alerts."
            />
            <div className="flex gap-3">
               <button className="btn-secondary gap-3 py-3 px-6">
                  <TrendingUp className="h-4 w-4" />
                  <span className="font-bold">Adherence Reports</span>
               </button>
               <button className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
                  <Bell className="h-5 w-5" />
                  <span className="font-bold">Configure Alerts</span>
               </button>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Adherence Score Card */}
            <div className="lg:col-span-1 glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 shadow-premium flex flex-col items-center justify-center text-center">
               <div className="relative h-32 w-32 mb-6">
                  <svg className="h-full w-full -rotate-90">
                     <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-secondary-100" />
                     <circle
                        cx="64"
                        cy="64"
                        r="58"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="transparent"
                        strokeDasharray={RING_CIRCUMFERENCE}
                        strokeDashoffset={ringOffset}
                        className="text-primary-500"
                     />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                     <span className="text-3xl font-black text-secondary-900">
                        {snapshotsLoading || dosesLoading ? "…" : adherencePct === null ? "—" : `${adherencePct}%`}
                     </span>
                  </div>
               </div>
               <h4 className="text-lg font-bold text-secondary-900">Overall Adherence</h4>
               <p className="text-xs text-secondary-400 mt-2 font-medium">
                  {snapshots.length > 0
                     ? `Average across ${snapshots.length} adherence snapshot${snapshots.length === 1 ? "" : "s"}.`
                     : adherencePct !== null
                        ? "Derived from confirmed dose outcomes."
                        : "No adherence data recorded yet."}
               </p>
            </div>

            {/* Alerts Section */}
            <div className="lg:col-span-3 space-y-6">
               <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-secondary-900 flex items-center gap-2">
                     <AlertTriangle className="h-5 w-5 text-rose-500" />
                     Critical Adherence Alerts
                  </h3>
                  <span className="px-3 py-1 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                     {alerts.length} NEW
                  </span>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {alertsLoading ? (
                     Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-24 bg-white/40 rounded-[2rem] animate-pulse" />
                     ))
                  ) : alerts.length > 0 ? (
                     alerts.map(alert => (
                        <div key={alert.id} className={`glass-card rounded-[2rem] p-5 border flex items-start gap-4 hover:scale-[1.02] transition-transform ${alert.severity === 'HIGH' || alert.severity === 'CRITICAL' ? 'bg-rose-50/50 border-rose-100' : 'bg-white/40 border-secondary-400/50'}`}>
                           <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${alert.severity === 'HIGH' || alert.severity === 'CRITICAL' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'}`}>
                              <AlertTriangle className="h-6 w-6" />
                           </div>
                           <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-secondary-900 truncate">{alert.message || alert.title}</p>
                              <p className="text-[10px] font-bold text-secondary-500 uppercase tracking-tighter mt-1">
                                 {format(new Date(alert.triggered_at), "MMM d, HH:mm")} • {alert.severity}
                              </p>
                           </div>
                           <button className="p-2 hover:bg-secondary-100 rounded-xl">
                              <MoreHorizontal className="h-5 w-5 text-secondary-400" />
                           </button>
                        </div>
                     ))
                  ) : (
                     <div className="col-span-full py-10 text-center bg-white/20 rounded-[2rem] border border-dashed border-secondary-200">
                        <p className="text-secondary-400 font-bold">No active alerts.</p>
                     </div>
                  )}
               </div>
            </div>

            {/* Recent Doses Table */}
            <div className="lg:col-span-4 space-y-6">
               <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-secondary-900 flex items-center gap-2">
                     <Pill className="h-5 w-5 text-primary-500" />
                     Upcoming & Recent Doses
                  </h3>
                  <div className="flex gap-2">
                     <button className="btn-secondary p-2.5 rounded-xl"><Filter className="h-4 w-4" /></button>
                     <button onClick={() => refetchDoses()} className="btn-secondary p-2.5 rounded-xl">
                        <RefreshCw className={`h-4 w-4 ${dosesLoading ? "animate-spin" : ""}`} />
                     </button>
                  </div>
               </div>

               <div className="glass-card rounded-[2.5rem] overflow-hidden border border-secondary-400/50 shadow-premium bg-white/40">
                  <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead>
                           <tr className="bg-secondary-900/5">
                              <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Medication</th>
                              <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Scheduled Time</th>
                              <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Status</th>
                              <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-right">Action</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary-100/50">
                           {dosesLoading ? (
                              Array.from({ length: 5 }).map((_, i) => (
                                 <tr key={i} className="animate-pulse">
                                    <td colSpan={4} className="px-8 py-6"><div className="h-10 bg-secondary-100/30 rounded-xl" /></td>
                                 </tr>
                              ))
                           ) : doses.length === 0 ? (
                              <tr>
                                 <td colSpan={4} className="px-8 py-20 text-center">
                                    <Pill className="h-12 w-12 mx-auto text-secondary-200 mb-4" />
                                    <p className="text-secondary-400 font-bold">No doses scheduled yet.</p>
                                 </td>
                              </tr>
                           ) : (
                              doses.slice(0, 25).map((dose) => (
                                 <tr key={dose.id} className="hover:bg-primary-50/30 transition-all group">
                                    <td className="px-8 py-6">
                                       <div className="flex items-center gap-4">
                                          <div className="h-10 w-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center">
                                             <Pill className="h-5 w-5" />
                                          </div>
                                          <div>
                                             <p className="text-sm font-bold text-secondary-900">
                                                {medicationByScheduleId.get(dose.schedule_id) || `Schedule #${dose.schedule_id}`}
                                             </p>
                                             <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-tighter">
                                                Patient #{dose.patient_id}
                                             </p>
                                          </div>
                                       </div>
                                    </td>
                                    <td className="px-8 py-6 text-sm font-bold text-secondary-700">
                                       {format(new Date(dose.scheduled_for), "MMM d, HH:mm")}
                                    </td>
                                    <td className="px-8 py-6">
                                       <span className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border ${doseStatusClasses[dose.status] || doseStatusClasses.SKIPPED}`}>
                                          {dose.status}
                                       </span>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                       {(dose.status === "SCHEDULED" || dose.status === "DELAYED") && (
                                          <button
                                             onClick={() =>
                                                confirmDose.mutate({
                                                   doseId: dose.id,
                                                   payload: { status: "TAKEN", source: "STAFF_DASHBOARD" },
                                                })
                                             }
                                             disabled={confirmDose.isPending}
                                             className="btn-primary py-2 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-60"
                                          >
                                             Confirm Intake
                                          </button>
                                       )}
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
