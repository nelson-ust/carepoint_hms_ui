import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import { Activity, Plus, RotateCcw } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  DxPage, DxPageHeader, DxPanel, DxGrid, DxBadge, DxButton, DxPopup,
  DxInput, DxSelect,
  type DxGridColumn, type DxBadgeTone,
} from "@/components/dx";
import { useChartTheme } from "@/components/charts/chart-theme";
import { useToast } from "@/components/feedback/ToastProvider";
import { PatientPicker } from "@/components/forms/pickers";
import type { EntityOption } from "@/components/forms/EntityPicker";
import { apiErrorMessage } from "@/lib/api/api-error";
import {
  monitoringApi,
  labelize,
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

export function RemoteMonitoringPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const chart = useChartTheme();
  const axisTick = { fill: chart.tick.fill, fontSize: chart.tick.fontSize, fontWeight: chart.tick.fontWeight };
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

  const columns: DxGridColumn<MonitoringReading>[] = useMemo(
    () => [
      { key: "type", header: "Type", render: (r) => <span className="text-[13px] text-[var(--dx-text)]">{labelize(r.reading_type)}</span> },
      { key: "value", header: "Value", render: (r) => <span className="dx-mono text-[13px] font-semibold text-[var(--dx-text)]">{readingValue(r)}</span> },
      { key: "source", header: "Source", render: (r) => <span className="text-[13px] text-[var(--dx-text-muted)]">{labelize(r.source)}</span> },
      {
        key: "flag",
        header: "Flag",
        align: "center",
        render: (r) => r.is_abnormal ? <DxBadge tone={severityTone(r.severity)}>{labelize(r.severity) || "Abnormal"}</DxBadge> : <DxBadge tone="success">Normal</DxBadge>,
      },
      { key: "recorded_at", header: "Recorded", align: "right", render: (r) => <span className="text-[13px] text-[var(--dx-text-muted)]">{fmt(r.recorded_at)}</span> },
    ],
    [],
  );

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Home health" }, { label: "Monitoring" }]}
        title="Remote Patient Monitoring"
        subtitle="Capture and trend patient vitals from home — automatically screened for early warning signs."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={() => readingsQuery.refetch()} isLoading={readingsQuery.isFetching}><RotateCcw /></DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowRecord(true)}>Record reading</DxButton>
          </>
        }
      />

      <div className="max-w-md">
        <PatientPicker label="Filter by patient" value={patient} onChange={setPatient} hint="Pick a patient to see trends." />
      </div>

      {patient ? (
        <DxPanel
          title={`Trend — ${patient.label}`}
          icon={<Activity className="h-4 w-4" />}
          actions={
            <div className="w-52">
              <DxSelect value={trendType} onChange={(e) => setTrendType(e.target.value as MonitoringReadingType)}
                options={READING_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
            </div>
          }
        >
          {chartData.length > 0 ? (
            <div style={{ height: 256 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                  <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="t" tick={axisTick} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={36} />
                  <Tooltip cursor={chart.cursor} contentStyle={chart.tooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="value" stroke={chart.series[0]} strokeWidth={2.5} dot={false} name={trendType === "BLOOD_PRESSURE" ? "Systolic" : labelize(trendType)} />
                  {trendType === "BLOOD_PRESSURE" ? <Line type="monotone" dataKey="dia" stroke={chart.series[3]} strokeWidth={2.5} dot={false} name="Diastolic" /> : null}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-10 text-center text-[13px] text-[var(--dx-text-muted)]">No {labelize(trendType).toLowerCase()} readings for this patient yet.</p>
          )}
        </DxPanel>
      ) : null}

      <DxGrid<MonitoringReading>
        columns={columns}
        data={readings}
        rowKey={(r) => r.id}
        isLoading={readingsQuery.isLoading}
        error={readingsQuery.isError ? apiErrorMessage(readingsQuery.error, "Couldn't load readings.") : null}
        onRetry={() => readingsQuery.refetch()}
        empty={{ icon: Activity, title: "No readings", description: "Record one to get started." }}
      />

      {showRecord ? (
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
      ) : null}
    </DxPage>
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
    <DxPopup
      isOpen
      onClose={onClose}
      title="Record a monitoring reading"
      locked={mutation.isPending}
      footer={
        <>
          <DxButton onClick={onClose} disabled={mutation.isPending}>Cancel</DxButton>
          <DxButton variant="primary" onClick={submit} isLoading={mutation.isPending}>Save reading</DxButton>
        </>
      }
    >
      <div className="space-y-4">
        <PatientPicker value={patient} onChange={setPatient} />
        <DxSelect label="Measurement" value={type} onChange={(e) => setType(e.target.value as MonitoringReadingType)}
          options={READING_TYPE_OPTIONS.map((o) => ({ value: o.value, label: `${o.label} (${o.unit})` }))} />
        {isBp ? (
          <div className="grid grid-cols-2 gap-4">
            <DxInput label="Systolic (mmHg)" type="number" value={systolic} onChange={(e) => setSystolic(e.target.value)} />
            <DxInput label="Diastolic (mmHg)" type="number" value={diastolic} onChange={(e) => setDiastolic(e.target.value)} />
          </div>
        ) : (
          <DxInput label={`Value (${unit})`} type="number" value={primary} onChange={(e) => setPrimary(e.target.value)} />
        )}
        <DxInput label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </DxPopup>
  );
}
