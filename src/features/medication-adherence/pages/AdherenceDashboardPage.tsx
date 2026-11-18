import {
  AlertTriangle,
  Bell,
  Filter,
  MoreHorizontal,
  Pill,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import {
  DxPage, DxPageHeader, DxPanel, DxGrid, DxBadge, DxButton,
  type DxGridColumn, type DxBadgeTone,
} from "@/components/dx";
import {
  useAdherenceAlerts,
  useAdherenceDoses,
  useAdherenceProfiles,
  useAdherenceSchedules,
  useAdherenceSnapshots,
  useConfirmDose,
} from "../hooks/use-adherence";

const RING_CIRCUMFERENCE = 364.4;

function doseStatusTone(status: string): DxBadgeTone {
  switch (status) {
    case "TAKEN":
      return "success";
    case "SCHEDULED":
    case "DELAYED":
      return "warning";
    case "MISSED":
      return "danger";
    default:
      return "neutral";
  }
}

type Dose = { id: number; schedule_id: number; patient_id: number; scheduled_for: string; status: string };

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

  const doseColumns: DxGridColumn<Dose>[] = [
    {
      key: "medication",
      header: "Medication",
      render: (dose) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]"><Pill className="h-4 w-4" /></div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[var(--dx-text)]">{medicationByScheduleId.get(dose.schedule_id) || `Schedule #${dose.schedule_id}`}</p>
            <p className="text-[11px] text-[var(--dx-text-muted)]">Patient #{dose.patient_id}</p>
          </div>
        </div>
      ),
    },
    { key: "scheduled_for", header: "Scheduled time", render: (dose) => <span className="text-[13px] text-[var(--dx-text-muted)]">{format(new Date(dose.scheduled_for), "MMM d, HH:mm")}</span> },
    { key: "status", header: "Status", align: "center", render: (dose) => <DxBadge tone={doseStatusTone(dose.status)}>{dose.status}</DxBadge> },
    {
      key: "action", header: "", align: "right",
      render: (dose) =>
        dose.status === "SCHEDULED" || dose.status === "DELAYED" ? (
          <DxButton size="sm" variant="primary" isLoading={confirmDose.isPending}
            onClick={() => confirmDose.mutate({ doseId: dose.id, payload: { status: "TAKEN", source: "STAFF_DASHBOARD" } })}>
            Confirm intake
          </DxButton>
        ) : null,
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Medication adherence" }]}
        title="Medication Adherence"
        subtitle="Monitor dose schedules, track patient adherence metrics, and respond to missed medication alerts."
        actions={
          <>
            <DxButton leftIcon={<TrendingUp className="h-4 w-4" />}>Adherence reports</DxButton>
            <DxButton variant="primary" leftIcon={<Bell className="h-4 w-4" />}>Configure alerts</DxButton>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        {/* Adherence Score */}
        <DxPanel className="lg:col-span-1">
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <div className="relative mb-4 h-32 w-32">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 128 128">
                <circle cx="64" cy="64" r="58" stroke="var(--dx-border)" strokeWidth="12" fill="transparent" />
                <circle cx="64" cy="64" r="58" stroke="var(--dx-accent)" strokeWidth="12" fill="transparent" strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE} strokeDashoffset={ringOffset} style={{ transition: "stroke-dashoffset 0.6s ease" }} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[28px] font-bold text-[var(--dx-text)]">{snapshotsLoading || dosesLoading ? "…" : adherencePct === null ? "—" : `${adherencePct}%`}</span>
              </div>
            </div>
            <h4 className="text-[15px] font-bold text-[var(--dx-text)]">Overall adherence</h4>
            <p className="mt-2 text-[12px] text-[var(--dx-text-muted)]">
              {snapshots.length > 0
                ? `Average across ${snapshots.length} adherence snapshot${snapshots.length === 1 ? "" : "s"}.`
                : adherencePct !== null
                  ? "Derived from confirmed dose outcomes."
                  : "No adherence data recorded yet."}
            </p>
          </div>
        </DxPanel>

        {/* Alerts */}
        <DxPanel
          className="lg:col-span-3"
          title="Critical adherence alerts"
          icon={<AlertTriangle className="h-4 w-4 text-[var(--dx-danger)]" />}
          actions={<DxBadge tone={alerts.length > 0 ? "danger" : "neutral"}>{alerts.length} new</DxBadge>}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {alertsLoading ? (
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="dx-skeleton h-20 w-full" />)
            ) : alerts.length > 0 ? (
              alerts.map((alert) => {
                const high = alert.severity === "HIGH" || alert.severity === "CRITICAL";
                return (
                  <div key={alert.id} className="flex items-start gap-3 rounded-md border p-3"
                    style={{ borderColor: high ? "var(--dx-danger-soft)" : "var(--dx-border)", background: high ? "var(--dx-danger-soft)" : "var(--dx-surface)" }}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white" style={{ background: high ? "var(--dx-danger)" : "var(--dx-warning)" }}>
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-[var(--dx-text)]">{alert.message || alert.title}</p>
                      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-[var(--dx-text-muted)]">{format(new Date(alert.triggered_at), "MMM d, HH:mm")} · {alert.severity}</p>
                    </div>
                    <DxButton icon size="sm" variant="text" title="More"><MoreHorizontal /></DxButton>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full rounded-md border border-dashed border-[var(--dx-border)] py-10 text-center">
                <p className="text-[13px] font-medium text-[var(--dx-text-muted)]">No active alerts.</p>
              </div>
            )}
          </div>
        </DxPanel>

        {/* Recent Doses */}
        <DxPanel
          className="lg:col-span-4"
          title="Upcoming & recent doses"
          icon={<Pill className="h-4 w-4" />}
          flush
          actions={
            <>
              <DxButton icon size="sm" title="Filter"><Filter /></DxButton>
              <DxButton icon size="sm" title="Refresh" onClick={() => refetchDoses()} isLoading={dosesLoading}><RotateCcw /></DxButton>
            </>
          }
        >
          <DxGrid<Dose>
            columns={doseColumns}
            data={doses.slice(0, 25)}
            rowKey={(d) => d.id}
            isLoading={dosesLoading}
            empty={{ icon: Pill, title: "No doses scheduled yet", description: "Scheduled and recent doses will appear here." }}
          />
        </DxPanel>
      </div>
    </DxPage>
  );
}
