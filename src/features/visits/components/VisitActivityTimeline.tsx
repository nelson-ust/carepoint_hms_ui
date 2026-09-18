import { useQuery } from "@tanstack/react-query";
import {
  Activity, Banknote, BedDouble, FlaskConical, Pill, Radiation,
  ScrollText, Stethoscope, Syringe, UserCheck, Waypoints,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiClient } from "@/lib/api/api-client";

type TimelineEvent = {
  at: string;
  type: string;
  title: string;
  department?: string | null;
  notes?: string | null;
  ref?: string | null;
  staff_name?: string | null;
};

type TimelineResponse = {
  visit_id: number;
  visit_number?: string | null;
  status?: string | null;
  events: TimelineEvent[];
  count: number;
};

const TYPE_META: Record<string, { icon: any; tone: string }> = {
  VISIT_STARTED: { icon: UserCheck, tone: "bg-primary-500" },
  VISIT_COMPLETED: { icon: UserCheck, tone: "bg-emerald-500" },
  ROUTED: { icon: Waypoints, tone: "bg-cyan-500" },
  STEP_CLOSED: { icon: Waypoints, tone: "bg-secondary-400" },
  TRIAGE: { icon: Activity, tone: "bg-amber-500" },
  VITALS: { icon: Activity, tone: "bg-amber-500" },
  CONSULTATION: { icon: Stethoscope, tone: "bg-indigo-500" },
  LAB_ORDERED: { icon: FlaskConical, tone: "bg-violet-500" },
  LAB_RESULT: { icon: FlaskConical, tone: "bg-violet-600" },
  RADIOLOGY_ORDERED: { icon: Radiation, tone: "bg-fuchsia-500" },
  RADIOLOGY_REPORT: { icon: Radiation, tone: "bg-fuchsia-600" },
  PRESCRIBED: { icon: ScrollText, tone: "bg-teal-500" },
  DISPENSED: { icon: Pill, tone: "bg-teal-600" },
  PROCEDURE: { icon: Syringe, tone: "bg-rose-500" },
  INVOICE: { icon: Banknote, tone: "bg-emerald-500" },
  PAYMENT: { icon: Banknote, tone: "bg-emerald-600" },
  ADMITTED: { icon: BedDouble, tone: "bg-sky-500" },
  DISCHARGED: { icon: BedDouble, tone: "bg-sky-600" },
};

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

/**
 * The visit's chronological activity stream — every routing hop, triage,
 * consultation, order, result, medication, procedure, billing event and
 * admission in one audited timeline, assembled live from the clinical record.
 */
export function VisitActivityTimeline({ visitId }: { visitId: number }) {
  const timeline = useQuery({
    queryKey: ["visits", visitId, "timeline"],
    queryFn: async () =>
      (await apiClient.get<TimelineResponse>(`/visits/${visitId}/timeline`)).data,
    refetchInterval: 60_000,
  });
  const events = timeline.data?.events ?? [];

  return (
    <div className="glass-card rounded p-10 md:p-12 border border-secondary-400 bg-white/80 shadow-premium">
      <div className="flex items-center justify-between border-b border-secondary-400 pb-8 mb-10">
        <div className="flex items-center gap-5">
          <div className="h-14 w-14 rounded bg-gradient-to-br from-primary-600 to-cyan-500 text-white flex items-center justify-center shadow-2xl">
            <Activity className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-2xl font-black font-display tracking-tight">Visit Timeline</h3>
            <p className="text-secondary-400 font-bold text-[11px] uppercase tracking-[0.3em] mt-1">
              Every activity · timestamped · attributed
            </p>
          </div>
        </div>
        <span className="px-4 py-2 rounded bg-secondary-100 text-secondary-600 text-[10px] font-bold uppercase tracking-widest">
          {events.length} {events.length === 1 ? "Event" : "Events"}
        </span>
      </div>

      {timeline.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : events.length === 0 ? (
        <p className="py-10 text-center text-secondary-400 font-bold">
          Activity will appear here as the visit progresses.
        </p>
      ) : (
        <div className="relative">
          <div className="absolute left-[15px] top-3 bottom-3 w-px bg-secondary-200" />
          <div className="space-y-5">
            {events.map((e, i) => {
              const meta = TYPE_META[e.type] ?? { icon: Activity, tone: "bg-secondary-400" };
              const Icon = meta.icon;
              return (
                <div key={i} className="relative flex gap-4 pl-0">
                  <div className={`relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow ${meta.tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <p className="text-sm font-black text-secondary-900">{e.title}</p>
                      <span className="data-mono text-[10px] font-bold text-secondary-400">{fmtWhen(e.at)}</span>
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-secondary-400">
                      {[e.department, e.staff_name, e.ref].filter(Boolean).join(" · ") || "—"}
                    </p>
                    {e.notes && (
                      <p className="mt-1 text-xs text-secondary-500 line-clamp-2">{e.notes}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
