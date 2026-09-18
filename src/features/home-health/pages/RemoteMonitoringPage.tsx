import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import { Activity, Plus, RefreshCw } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { useToast } from "@/components/feedback/ToastProvider";
import { PatientPicker } from "@/components/forms/pickers";
import type { EntityOption } from "@/components/forms/EntityPicker";
import { apiErrorMessage } from "@/lib/api/api-error";
import {
  monitoringApi,
  labelize,
  severityVariant,
  READING_TYPE_OPTIONS,
  type MonitoringReading,
  type MonitoringReadingType,
} from "../api/home-health.api";

function fmt(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return isValid(d) ? format(d, "MMM d • h:mm a") : "—";
}

function readingValue(r: MonitoringReading): string {
  if (r.reading_type === "BLOOD_PRESSURE") return `${r.systolic ?? "?"}/${r.diastolic ?? "?"} ${r.unit ?? "mmHg"}`;
  if (r.primary_value == null) return "—";
  return `${r.primary_value}${r.unit ? ` ${r.unit}` : ""}`;
}

export function RemoteMonitoringPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [patient, setPatient] = useState<EntityOption | null>(null);
  const [trendType, setTrendType] = useState<MonitoringReadingType>("BLOOD_PRESSURE");
  const [showRecord, setShowRecord] = useState(false);

  const readingsQuery = useQuery({
    queryKey: ["monitoring", "readings", patient?.value ?? null],
    queryFn: () => monitoringApi.listReadings({ patient_id: patient?.value, limit: 100 }),
  });
  const trendQuery = useQuery({
    queryKey: ["monitoring", "trend", patient?.value ?? null, trendType],
    queryFn: () => monitoringApi.trend(patient!.value, trendType),
    enabled: !!patient,
  });

  const readings = readingsQuery.data?.items ?? [];

  const chartData = useMemo(() => {
    const pts = trendQuery.data?.points ?? [];
    return pts.map((p) => ({
      t: fmt(p.recorded_at),
      value: p.systolic ?? (p.primary_value != null ? Number(p.primary_value) : null),
      dia: p.diastolic ?? null,
    }));
  }, [trendQuery.data]);

  const columns: DataTableColumn<MonitoringReading>[] = useMemo(
    () => [
      { key: "type", header: "Type", render: (r) => labelize(r.reading_type) },
      { key: "value", header: "Value", render: (r) => <span className="font-semibold">{readingValue(r)}</span> },
      { key: "source", header: "Source", render: (r) => labelize(r.source) },
      {
        key: "flag",
        header: "Flag",
        render: (r) => r.is_abnormal ? <Badge variant={severityVariant(r.severity)}>{labelize(r.severity) || "Abnormal"}</Badge> : <Badge variant="soft-success">Normal</Badge>,
      },
      { key: "recorded_at", header: "Recorded", render: (r) => fmt(r.recorded_at) },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Remote Patient Monitoring"
        description="Capture and trend patient vitals from home — automatically screened for early warning signs."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => readingsQuery.refetch()}><RefreshCw className="h-4 w-4" /> Refresh</Button>
            <Button onClick={() => setShowRecord(true)}><Plus className="h-4 w-4" /> Record reading</Button>
          </>
        }
      />

      <Card className="max-w-md">
        <PatientPicker label="Filter by patient" value={patient} onChange={setPatient} hint="Pick a patient to see trends." />
      </Card>

      {patient && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-secondary-500">
              <Activity className="h-4 w-4" /> Trend — {patient.label}
            </h3>
            <div className="w-52">
              <Select value={trendType} onChange={(e) => setTrendType(e.target.value as MonitoringReadingType)}
                options={READING_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
            </div>
          </div>
          {chartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="t" tick={{ fontSize: 11 }} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#0ea5e9" strokeWidth={2} dot={false} name={trendType === "BLOOD_PRESSURE" ? "Systolic" : labelize(trendType)} />
                  {trendType === "BLOOD_PRESSURE" && <Line type="monotone" dataKey="dia" stroke="#f59e0b" strokeWidth={2} dot={false} name="Diastolic" />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-secondary-400">No {labelize(trendType).toLowerCase()} readings for this patient yet.</p>
          )}
        </Card>
      )}

      <Card padding="none">
        <DataTable<MonitoringReading>
          columns={columns}
          data={readings}
          rowKey={(r) => r.id}
          isLoading={readingsQuery.isLoading}
          error={readingsQuery.isError ? apiErrorMessage(readingsQuery.error, "Couldn't load readings.") : null}
          onRetry={() => readingsQuery.refetch()}
          empty={{ icon: Activity, title: "No readings", description: "Record one to get started." }}
        />
      </Card>

      {showRecord && (
        <RecordReadingModal
          presetPatient={patient}
          onClose={() => setShowRecord(false)}
          onSaved={(alertRaised) => {
            setShowRecord(false);
            qc.invalidateQueries({ queryKey: ["monitoring"] });
            if (alertRaised) toast.error("Reading recorded — clinical alert raised", "The care team has been notified.");
            else toast.success("Reading recorded");
          }}
        />
      )}
    </div>
  );
}

function RecordReadingModal({
  presetPatient, onClose, onSaved,
}: {
  presetPatient: EntityOption | null;
  onClose: () => void;
  onSaved: (alertRaised: boolean) => void;
}) {
  const toast = useToast();
  const [patient, setPatient] = useState<EntityOption | null>(presetPatient);
  const [type, setType] = useState<MonitoringReadingType>("BLOOD_PRESSURE");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [primary, setPrimary] = useState("");
  const [notes, setNotes] = useState("");

  const unit = READING_TYPE_OPTIONS.find((o) => o.value === type)?.unit ?? "";
  const isBp = type === "BLOOD_PRESSURE";

  const mutation = useMutation({
    mutationFn: () =>
      monitoringApi.recordReading({
        patient_id: patient!.value,
        reading_type: type,
        source: "CAREGIVER",
        unit,
        systolic: isBp ? Number(systolic) : undefined,
        diastolic: isBp ? Number(diastolic) : undefined,
        primary_value: !isBp && primary !== "" ? Number(primary) : undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: (res) => onSaved(res.alert_raised),
    onError: (e) => toast.error("Couldn't record reading", apiErrorMessage(e, "Review the values.")),
  });

  const submit = () => {
    if (!patient) return toast.error("Patient required", "Select a patient.");
    if (isBp && (!systolic || !diastolic)) return toast.error("Blood pressure needs both values", "Enter systolic and diastolic.");
    if (!isBp && primary === "") return toast.error("Value required", "Enter a value.");
    mutation.mutate();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Record a monitoring reading"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : "Save reading"}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <PatientPicker value={patient} onChange={setPatient} />
        <Select label="Measurement" value={type} onChange={(e) => setType(e.target.value as MonitoringReadingType)}
          options={READING_TYPE_OPTIONS.map((o) => ({ value: o.value, label: `${o.label} (${o.unit})` }))} />
        {isBp ? (
          <div className="grid grid-cols-2 gap-4">
            <Input label="Systolic (mmHg)" type="number" value={systolic} onChange={(e) => setSystolic(e.target.value)} />
            <Input label="Diastolic (mmHg)" type="number" value={diastolic} onChange={(e) => setDiastolic(e.target.value)} />
          </div>
        ) : (
          <Input label={`Value (${unit})`} type="number" value={primary} onChange={(e) => setPrimary(e.target.value)} />
        )}
        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Modal>
  );
}
