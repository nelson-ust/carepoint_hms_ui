import { useQuery } from "@tanstack/react-query";
import { Activity, RotateCcw } from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxMessage,
  DxPanel,
  DxSkeleton,
  DxTimeline,
  apiErrorMessage,
  formatDateTime,
  type DxTimelineItem,
} from "@/components/dx";
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

const TYPE_TONE: Record<string, DxTimelineItem["tone"]> = {
  VISIT_STARTED: "accent",
  VISIT_COMPLETED: "success",
  ROUTED: "accent",
  LAB_RESULT: "accent",
  RADIOLOGY_REPORT: "accent",
  DISPENSED: "success",
  INVOICE: "default",
  PAYMENT: "success",
  PROCEDURE: "danger",
  ADMITTED: "accent",
  DISCHARGED: "success",
};

/**
 * The visit's chronological activity stream — every routing hop, triage,
 * consultation, order, result, medication, procedure, billing event and
 * admission in one audited timeline, assembled live from the clinical record.
 */
export function VisitActivityTimeline({ visitId }: { visitId: number }) {
  const timeline = useQuery({
    queryKey: ["visits", visitId, "timeline"],
    queryFn: async () => (await apiClient.get<TimelineResponse>(`/visits/${visitId}/timeline`)).data,
    refetchInterval: 60_000,
  });
  const events = timeline.data?.events ?? [];

  const items: DxTimelineItem[] = events.map((e, i) => ({
    key: `${e.type}-${e.at}-${i}`,
    title: e.title,
    meta: formatDateTime(e.at),
    tone: TYPE_TONE[e.type] ?? "default",
    body: (
      <>
        <span>{[e.department, e.staff_name, e.ref].filter(Boolean).join(" · ") || "—"}</span>
        {e.notes ? <span className="mt-0.5 block line-clamp-2">{e.notes}</span> : null}
      </>
    ),
  }));

  return (
    <DxPanel
      title="Activity"
      icon={<Activity />}
      description="Every activity on this encounter, timestamped and attributed."
      actions={
        <>
          <DxBadge tone="neutral">{events.length} {events.length === 1 ? "event" : "events"}</DxBadge>
          <DxButton size="sm" variant="text" icon title="Refresh" onClick={() => timeline.refetch()} isLoading={timeline.isFetching}>
            <RotateCcw />
          </DxButton>
        </>
      }
    >
      {timeline.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <DxSkeleton key={i} className="h-8" />
          ))}
        </div>
      ) : timeline.isError ? (
        <DxMessage
          tone="danger"
          title="Could not load the activity stream"
          action={
            <DxButton size="sm" onClick={() => timeline.refetch()} leftIcon={<RotateCcw />}>
              Retry
            </DxButton>
          }
        >
          {apiErrorMessage(timeline.error)}
        </DxMessage>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-[12.5px] text-[var(--dx-text-muted)]">
          Activity will appear here as the visit progresses.
        </p>
      ) : (
        <DxTimeline items={items} />
      )}
    </DxPanel>
  );
}
