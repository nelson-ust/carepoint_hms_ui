import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import { BellRing, RotateCcw, ShieldAlert, Siren, TriangleAlert } from "lucide-react";
import {
  DxPage, DxPageHeader, DxGrid, DxKpi, DxBadge, DxButton, DxSelect, DxCheckbox,
  type DxGridColumn, type DxBadgeTone,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import {
  alertsApi,
  labelize,
  type ClinicalAlert,
} from "../api/home-health.api";

function fmt(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return isValid(d) ? format(d, "MMM d • h:mm a") : "—";
}

function severityTone(sev?: string | null): DxBadgeTone {
  switch (sev) {
    case "EMERGENCY":
    case "URGENT":
      return "danger";
    case "WARNING":
      return "warning";
    case "INFORMATION":
      return "info";
    default:
      return "neutral";
  }
}

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "OPEN", label: "Open" },
  { value: "ACKNOWLEDGED", label: "Acknowledged" },
  { value: "IN_REVIEW", label: "In review" },
  { value: "ESCALATED", label: "Escalated" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "DISMISSED", label: "Dismissed" },
];

const SEVERITY_OPTIONS = [
  { value: "", label: "All severities" },
  { value: "EMERGENCY", label: "Emergency" },
  { value: "URGENT", label: "Urgent" },
  { value: "WARNING", label: "Warning" },
  { value: "INFORMATION", label: "Information" },
];

export function ClinicalAlertsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [openOnly, setOpenOnly] = useState(true);

  const summaryQuery = useQuery({ queryKey: ["alerts", "summary"], queryFn: () => alertsApi.summary() });
  const listQuery = useQuery({
    queryKey: ["alerts", "list", status, severity, openOnly],
    queryFn: () => alertsApi.list({ status: status || undefined, severity: severity || undefined, open_only: openOnly, limit: 100 }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["alerts"] });
  };

  const ackMut = useMutation({ mutationFn: (id: number) => alertsApi.acknowledge(id), onSuccess: () => { toast.success("Alert acknowledged"); invalidate(); }, onError: (e) => toast.error("Failed", apiErrorMessage(e, "Try again.")) });
  const resolveMut = useMutation({ mutationFn: (id: number) => alertsApi.resolve(id, undefined), onSuccess: () => { toast.success("Alert resolved"); invalidate(); }, onError: (e) => toast.error("Failed", apiErrorMessage(e, "Try again.")) });
  const escalateMut = useMutation({ mutationFn: (id: number) => alertsApi.escalate(id), onSuccess: () => { toast.success("Alert escalated"); invalidate(); }, onError: (e) => toast.error("Failed", apiErrorMessage(e, "Try again.")) });
  const dismissMut = useMutation({ mutationFn: (id: number) => alertsApi.dismiss(id, undefined), onSuccess: () => { toast.success("Alert dismissed"); invalidate(); }, onError: (e) => toast.error("Failed", apiErrorMessage(e, "Try again.")) });

  const items = listQuery.data?.items ?? [];
  const summary = summaryQuery.data;

  const columns: DxGridColumn<ClinicalAlert>[] = useMemo(
    () => [
      { key: "severity", header: "Severity", align: "center", render: (r) => <DxBadge tone={severityTone(r.severity)}>{labelize(r.severity)}</DxBadge> },
      {
        key: "title",
        header: "Alert",
        render: (r) => (
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-[var(--dx-text)]">{r.title}</div>
            <div className="max-w-[24rem] truncate text-[11.5px] text-[var(--dx-text-muted)]">{r.message}</div>
          </div>
        ),
      },
      { key: "patient", header: "Patient", render: (r) => <span className="text-[13px] text-[var(--dx-text)]">{r.patient_name || `#${r.patient_id}`}</span> },
      { key: "type", header: "Type", render: (r) => <span className="text-[13px] text-[var(--dx-text-muted)]">{labelize(r.alert_type)}</span> },
      { key: "status", header: "Status", align: "center", render: (r) => <DxBadge tone={r.status === "RESOLVED" ? "success" : r.status === "ESCALATED" ? "danger" : "neutral"}>{labelize(r.status)}</DxBadge> },
      { key: "triggered", header: "Triggered", align: "right", render: (r) => <span className="text-[13px] text-[var(--dx-text-muted)]">{fmt(r.triggered_at)}</span> },
      {
        key: "actions",
        header: "",
        align: "right",
        render: (r) => {
          const closed = r.status === "RESOLVED" || r.status === "DISMISSED";
          if (closed) return null;
          return (
            <div className="flex justify-end gap-1.5">
              {r.status === "OPEN" ? <DxButton size="sm" onClick={() => ackMut.mutate(r.id)}>Ack</DxButton> : null}
              <DxButton size="sm" variant="outline-danger" onClick={() => escalateMut.mutate(r.id)}>Escalate</DxButton>
              <DxButton size="sm" variant="primary" onClick={() => resolveMut.mutate(r.id)}>Resolve</DxButton>
              <DxButton size="sm" variant="text" onClick={() => dismissMut.mutate(r.id)}>Dismiss</DxButton>
            </div>
          );
        },
      },
    ],
    [ackMut, escalateMut, resolveMut, dismissMut],
  );

  const bySev = (key: string) => summary?.by_severity?.[`AlertSeverity.${key}`] ?? summary?.by_severity?.[key] ?? 0;

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Home health" }, { label: "Alerts" }]}
        title="Clinical Alerts"
        subtitle="Early-warning alerts from monitoring, visits and care plans — triaged by severity."
        actions={<DxButton icon title="Refresh" onClick={() => { listQuery.refetch(); summaryQuery.refetch(); }} isLoading={listQuery.isFetching || summaryQuery.isFetching}><RotateCcw /></DxButton>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <DxKpi label="Open alerts" value={summary?.open_total ?? 0} icon={BellRing} tone="info" isLoading={summaryQuery.isLoading} />
        <DxKpi label="Emergency" value={bySev("EMERGENCY")} icon={Siren} tone="danger" isLoading={summaryQuery.isLoading} />
        <DxKpi label="Urgent" value={bySev("URGENT")} icon={ShieldAlert} tone="danger" isLoading={summaryQuery.isLoading} />
        <DxKpi label="Warning" value={bySev("WARNING")} icon={TriangleAlert} tone="warning" isLoading={summaryQuery.isLoading} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-52"><DxSelect label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={STATUS_OPTIONS} /></div>
        <div className="w-52"><DxSelect label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)} options={SEVERITY_OPTIONS} /></div>
        <div className="pb-2"><DxCheckbox label="Open only" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} /></div>
      </div>

      <DxGrid<ClinicalAlert>
        columns={columns}
        data={items}
        rowKey={(r) => r.id}
        isLoading={listQuery.isLoading}
        error={listQuery.isError ? apiErrorMessage(listQuery.error, "Couldn't load alerts.") : null}
        onRetry={() => listQuery.refetch()}
        empty={{ icon: BellRing, title: "No alerts", description: "You're all caught up." }}
      />
    </DxPage>
  );
}
