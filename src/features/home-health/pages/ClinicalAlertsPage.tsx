import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import { BellRing, RefreshCw, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import {
  alertsApi,
  labelize,
  severityVariant,
  type ClinicalAlert,
} from "../api/home-health.api";

function fmt(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return isValid(d) ? format(d, "MMM d • h:mm a") : "—";
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

  const columns: DataTableColumn<ClinicalAlert>[] = useMemo(
    () => [
      { key: "severity", header: "Severity", render: (r) => <Badge variant={severityVariant(r.severity)}>{labelize(r.severity)}</Badge> },
      {
        key: "title",
        header: "Alert",
        render: (r) => (
          <div>
            <div className="font-semibold text-secondary-900 dark:text-white">{r.title}</div>
            <div className="text-xs text-secondary-500">{r.message}</div>
          </div>
        ),
      },
      { key: "patient", header: "Patient", render: (r) => r.patient_name || `#${r.patient_id}` },
      { key: "type", header: "Type", render: (r) => labelize(r.alert_type) },
      { key: "status", header: "Status", render: (r) => <Badge variant={r.status === "RESOLVED" ? "soft-success" : r.status === "ESCALATED" ? "soft-danger" : "secondary"}>{labelize(r.status)}</Badge> },
      { key: "triggered", header: "Triggered", render: (r) => fmt(r.triggered_at) },
      {
        key: "actions",
        header: "",
        align: "right",
        render: (r) => {
          const closed = r.status === "RESOLVED" || r.status === "DISMISSED";
          if (closed) return null;
          return (
            <div className="flex justify-end gap-1.5">
              {r.status === "OPEN" && <Button size="sm" variant="secondary" onClick={() => ackMut.mutate(r.id)}>Ack</Button>}
              <Button size="sm" variant="danger" onClick={() => escalateMut.mutate(r.id)}>Escalate</Button>
              <Button size="sm" variant="primary" onClick={() => resolveMut.mutate(r.id)}>Resolve</Button>
              <Button size="sm" variant="ghost" onClick={() => dismissMut.mutate(r.id)}>Dismiss</Button>
            </div>
          );
        },
      },
    ],
    [ackMut, escalateMut, resolveMut, dismissMut],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clinical Alerts"
        description="Early-warning alerts from monitoring, visits and care plans — triaged by severity."
        actions={<Button variant="ghost" size="sm" onClick={() => { listQuery.refetch(); summaryQuery.refetch(); }}><RefreshCw className="h-4 w-4" /> Refresh</Button>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryTile label="Open alerts" value={summary?.open_total ?? 0} tone="info" />
        <SummaryTile label="Emergency" value={summary?.by_severity?.["AlertSeverity.EMERGENCY"] ?? summary?.by_severity?.EMERGENCY ?? 0} tone="danger" />
        <SummaryTile label="Urgent" value={summary?.by_severity?.["AlertSeverity.URGENT"] ?? summary?.by_severity?.URGENT ?? 0} tone="danger" />
        <SummaryTile label="Warning" value={summary?.by_severity?.["AlertSeverity.WARNING"] ?? summary?.by_severity?.WARNING ?? 0} tone="warning" />
      </div>

      <Card className="flex flex-wrap items-end gap-4">
        <div className="w-52"><Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={STATUS_OPTIONS} /></div>
        <div className="w-52"><Select label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)} options={SEVERITY_OPTIONS} /></div>
        <label className="flex items-center gap-2 pb-2 text-sm text-secondary-600 dark:text-secondary-300">
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} /> Open only
        </label>
      </Card>

      <Card padding="none">
        <DataTable<ClinicalAlert>
          columns={columns}
          data={items}
          rowKey={(r) => r.id}
          isLoading={listQuery.isLoading}
          error={listQuery.isError ? apiErrorMessage(listQuery.error, "Couldn't load alerts.") : null}
          onRetry={() => listQuery.refetch()}
          empty={{ icon: BellRing, title: "No alerts", description: "You're all caught up." }}
        />
      </Card>
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: "info" | "danger" | "warning" }) {
  const ring = tone === "danger" ? "text-rose-500" : tone === "warning" ? "text-amber-500" : "text-cyan-500";
  return (
    <Card className="flex items-center gap-3">
      <ShieldAlert className={`h-8 w-8 ${ring}`} />
      <div>
        <div className="text-2xl font-bold text-secondary-900 dark:text-white">{value}</div>
        <div className="text-xs font-semibold uppercase tracking-widest text-secondary-400">{label}</div>
      </div>
    </Card>
  );
}
