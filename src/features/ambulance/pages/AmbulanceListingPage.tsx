import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, AlertTriangle, Ambulance as AmbIcon, Banknote, Clock, Fuel, Gauge, Plus, Radio, RotateCcw, Truck, Wrench } from "lucide-react";
import {
  DxBadge, DxButton, DxForm, DxGrid, DxInput, DxKpi, DxPage, DxPageHeader, DxPanel, DxPopup,
  DxSearchBox, DxSelect, DxTabs, DxTextarea, DxToolbar, DxToolbarSeparator, DxToolbarSpacer,
  apiErrorMessage, formatDateTime, type DxGridColumn,
} from "@/components/dx";
import { useChartTheme } from "@/components/charts/chart-theme";
import { useToast } from "@/components/feedback/ToastProvider";
import { routes } from "@/config/routes";
import { ambulanceApi, dispatchApi, type Ambulance, type AmbulanceDispatch } from "../api/ambulance.api";

type Tab = "fleet" | "dispatches" | "analytics";
const naira = (n: number | string) => `₦ ${Number(n).toLocaleString()}`;

// Common ambulance manufacturers and their models (Model options depend on Manufacturer).
const AMBULANCE_MAKES: { manufacturer: string; models: string[] }[] = [
  { manufacturer: "Toyota", models: ["HiAce", "Hilux", "Land Cruiser", "Coaster"] },
  { manufacturer: "Mercedes-Benz", models: ["Sprinter", "Vito", "Viano"] },
  { manufacturer: "Ford", models: ["Transit", "Transit Custom", "Ranger"] },
  { manufacturer: "Nissan", models: ["Urvan (NV350)", "Patrol", "Civilian"] },
  { manufacturer: "Volkswagen", models: ["Transporter", "Crafter"] },
  { manufacturer: "Renault", models: ["Master", "Trafic"] },
  { manufacturer: "Peugeot", models: ["Boxer", "Expert"] },
  { manufacturer: "Isuzu", models: ["D-Max", "NPR"] },
  { manufacturer: "Fiat", models: ["Ducato"] },
  { manufacturer: "Hyundai", models: ["H-1 / Starex", "H350"] },
  { manufacturer: "Other", models: ["Other"] },
];
const MAKE_OPTIONS = AMBULANCE_MAKES.map((m) => ({ value: m.manufacturer, label: m.manufacturer }));

function statusTone(s: string) {
  if (s === "AVAILABLE" || s === "COMPLETED") return "success" as const;
  if (s === "OUT_OF_SERVICE" || s === "CANCELLED") return "danger" as const;
  if (s === "UNDER_MAINTENANCE" || s === "PENDING") return "warning" as const;
  return "info" as const;
}
const NEXT: Record<string, { action: "depart" | "arrive" | "patient-picked" | "complete"; label: string } | undefined> = {
  ASSIGNED: { action: "depart", label: "Depart" },
  EN_ROUTE: { action: "arrive", label: "Arrived" },
  ARRIVED: { action: "patient-picked", label: "Patient picked" },
  PATIENT_PICKED: { action: "complete", label: "Complete" },
};

export function AmbulanceListingPage() {
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const chart = useChartTheme();
  const [tab, setTab] = useState<Tab>("fleet");
  const [search, setSearch] = useState("");
  const [regOpen, setRegOpen] = useState(false);
  const [reg, setReg] = useState({ code: "", plate_number: "", model: "", manufacturer: "", year_of_manufacture: "", color: "" });
  const [dispOpen, setDispOpen] = useState(false);
  const [disp, setDisp] = useState({ ambulance_id: "", pickup_location: "", destination_location: "", incident_description: "" });
  const [assignFor, setAssignFor] = useState<AmbulanceDispatch | null>(null);
  const [assign, setAssign] = useState({ ambulance_id: "", driver_id: "" });

  const statsQ = useQuery({ queryKey: ["amb", "stats"], queryFn: ambulanceApi.getStats });
  const fleetQ = useQuery({ queryKey: ["amb", "fleet"], queryFn: () => ambulanceApi.list({ limit: 200 }) });
  const driversQ = useQuery({ queryKey: ["amb", "drivers"], queryFn: ambulanceApi.listDrivers, enabled: assignFor != null });
  const dispatchesQ = useQuery({ queryKey: ["amb", "dispatches"], queryFn: () => dispatchApi.list({ limit: 200 }), enabled: tab === "dispatches" });
  const analyticsQ = useQuery({ queryKey: ["amb", "analytics"], queryFn: () => dispatchApi.analytics(), enabled: tab === "analytics" });

  const stats = statsQ.data;
  const fleet = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = fleetQ.data?.items ?? [];
    return q ? rows.filter((a) => `${a.code} ${a.plate_number} ${a.model} ${a.manufacturer}`.toLowerCase().includes(q)) : rows;
  }, [fleetQ.data, search]);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["amb"] });

  const regMut = useMutation({
    mutationFn: () => ambulanceApi.create({ ...reg, year_of_manufacture: reg.year_of_manufacture ? Number(reg.year_of_manufacture) : undefined } as never),
    onSuccess: () => { toast.success("Ambulance registered"); setRegOpen(false); setReg({ code: "", plate_number: "", model: "", manufacturer: "", year_of_manufacture: "", color: "" }); invalidate(); },
    onError: (e) => toast.error("Could not register", apiErrorMessage(e)),
  });
  const dispMut = useMutation({
    mutationFn: () => dispatchApi.create({ ambulance_id: disp.ambulance_id ? Number(disp.ambulance_id) : undefined, pickup_location: disp.pickup_location || undefined, destination_location: disp.destination_location || undefined, incident_description: disp.incident_description || undefined, requested_at: new Date().toISOString() }),
    onSuccess: () => { toast.success("Dispatch opened"); setDispOpen(false); setDisp({ ambulance_id: "", pickup_location: "", destination_location: "", incident_description: "" }); invalidate(); },
    onError: (e) => toast.error("Could not open dispatch", apiErrorMessage(e)),
  });
  const transition = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "depart" | "arrive" | "patient-picked" | "complete" | "cancel" }) => dispatchApi.transition(id, action),
    onSuccess: () => { toast.success("Dispatch updated"); invalidate(); },
    onError: (e) => toast.error("Could not update dispatch", apiErrorMessage(e)),
  });
  const assignMut = useMutation({
    mutationFn: () => dispatchApi.transition(assignFor!.id, "assign", { ambulance_id: Number(assign.ambulance_id), driver_id: assign.driver_id ? Number(assign.driver_id) : undefined }),
    onSuccess: () => { toast.success("Dispatch assigned"); setAssignFor(null); setAssign({ ambulance_id: "", driver_id: "" }); invalidate(); },
    onError: (e) => toast.error("Could not assign", apiErrorMessage(e)),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, s }: { id: number; s: string }) => ambulanceApi.updateStatus(id, s),
    onSuccess: () => { toast.success("Status updated"); invalidate(); },
    onError: (e) => toast.error("Could not update", apiErrorMessage(e)),
  });

  const fleetCols: DxGridColumn<Ambulance>[] = [
    { key: "code", header: "Code", render: (a) => <span className="dx-mono font-semibold">{a.code}</span> },
    { key: "plate_number", header: "Plate", render: (a) => <DxBadge tone="neutral">{a.plate_number}</DxBadge> },
    { key: "model", header: "Vehicle", render: (a) => <span className="font-semibold">{[a.manufacturer, a.model].filter(Boolean).join(" ") || "—"}</span> },
    { key: "status", header: "Status", align: "center", render: (a) => <DxBadge tone={statusTone(a.status)}>{a.status.replace(/_/g, " ")}</DxBadge> },
    { key: "current_mileage", header: "Mileage", align: "right", render: (a) => a.current_mileage ? `${Number(a.current_mileage).toLocaleString()} km` : "—" },
    { key: "actions", header: "", align: "right", render: (a) => (
      <div className="flex items-center justify-end gap-1.5">
        {a.status !== "OUT_OF_SERVICE" ? <DxButton size="sm" variant="text" onClick={(e) => { e.stopPropagation(); setStatus.mutate({ id: a.id, s: "OUT_OF_SERVICE" }); }}>Out of service</DxButton>
          : <DxButton size="sm" onClick={(e) => { e.stopPropagation(); setStatus.mutate({ id: a.id, s: "AVAILABLE" }); }}>Return</DxButton>}
      </div>
    ) },
  ];
  const dispCols: DxGridColumn<AmbulanceDispatch>[] = [
    { key: "dispatch_no", header: "Dispatch", render: (d) => <span className="dx-mono font-semibold">{d.dispatch_no}</span> },
    { key: "route", header: "Route", render: (d) => <span className="text-[12px]">{d.pickup_location ?? "—"} → {d.destination_location ?? "—"}</span> },
    { key: "dispatch_status", header: "Status", align: "center", render: (d) => <DxBadge tone={statusTone(d.dispatch_status)}>{d.dispatch_status.replace(/_/g, " ")}</DxBadge> },
    { key: "requested_at", header: "Requested", render: (d) => formatDateTime(d.requested_at) },
    { key: "actions", header: "", align: "right", render: (d) => {
      const terminal = d.dispatch_status === "COMPLETED" || d.dispatch_status === "CANCELLED";
      const next = NEXT[d.dispatch_status];
      return (
        <div className="flex items-center justify-end gap-1.5">
          {d.dispatch_status === "PENDING" ? <DxButton size="sm" onClick={(e) => { e.stopPropagation(); setAssignFor(d); setAssign({ ambulance_id: d.ambulance_id ? String(d.ambulance_id) : "", driver_id: d.driver_id ? String(d.driver_id) : "" }); }}>Assign</DxButton> : null}
          {next ? <DxButton size="sm" variant="primary" onClick={(e) => { e.stopPropagation(); transition.mutate({ id: d.id, action: next.action }); }}>{next.label}</DxButton> : null}
          {!terminal ? <DxButton size="sm" variant="text" onClick={(e) => { e.stopPropagation(); transition.mutate({ id: d.id, action: "cancel" }); }}>Cancel</DxButton> : null}
        </div>
      );
    } },
  ];

  const ambulanceOptions = (fleetQ.data?.items ?? []).map((a) => ({ value: String(a.id), label: `${a.code} · ${a.plate_number}` }));
  const an = analyticsQ.data;

  return (
    <DxPage>
      <DxPageHeader
        title="Ambulance Services"
        subtitle="Fleet readiness, emergency dispatch, crew, patient care reports, fuel and trip billing."
        actions={tab === "dispatches"
          ? <DxButton variant="primary" leftIcon={<Radio />} onClick={() => setDispOpen(true)}>New dispatch</DxButton>
          : tab === "fleet" ? <DxButton variant="primary" leftIcon={<Plus />} onClick={() => setRegOpen(true)}>Register ambulance</DxButton>
          : <DxButton icon title="Refresh" onClick={() => analyticsQ.refetch()}><RotateCcw /></DxButton>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <DxKpi label="Fleet" value={stats?.fleet_total ?? 0} icon={Truck} tone="accent" isLoading={statsQ.isLoading} />
        <DxKpi label="Ready" value={stats?.ready_count ?? 0} icon={AmbIcon} tone="success" isLoading={statsQ.isLoading} sub="dispatch-ready" />
        <DxKpi label="On call" value={stats?.by_status?.DISPATCHED ?? ((stats?.by_status?.IN_TRANSIT ?? 0))} icon={Radio} tone="info" isLoading={statsQ.isLoading} />
        <DxKpi label="Maintenance" value={stats?.maintenance_open ?? 0} icon={Wrench} tone="warning" isLoading={statsQ.isLoading} sub="open jobs" />
        <DxKpi label="Drivers" value={stats?.drivers_total ?? 0} icon={Gauge} tone="neutral" isLoading={statsQ.isLoading} />
        <DxKpi label="Avg response" value={`${an?.avg_response_minutes ?? "—"}m`} icon={Clock} tone="danger" sub="dispatch → scene" />
      </div>

      <DxTabs<Tab> value={tab} onChange={setTab} className="mt-4 mb-3" items={[
        { key: "fleet", label: "Fleet", icon: <Truck />, count: fleet.length },
        { key: "dispatches", label: "Dispatches", icon: <Radio />, count: dispatchesQ.data?.items?.length ?? null },
        { key: "analytics", label: "Analytics", icon: <Activity /> },
      ]} />

      {tab === "fleet" ? (
        <>
          <DxToolbar attached>
            <DxSearchBox onSearch={setSearch} placeholder="Code, plate, model…" className="w-72" />
            <DxToolbarSeparator />
            <DxToolbarSpacer />
          </DxToolbar>
          <DxGrid columns={fleetCols} data={fleet} rowKey={(a) => a.id} onRowClick={(a) => nav(routes.ambulanceDetail.replace(":ambulanceId", String(a.id)))}
            isLoading={fleetQ.isLoading} error={fleetQ.isError ? apiErrorMessage(fleetQ.error) : null}
            empty={{ icon: Truck, title: "No ambulances", description: "Register a vehicle to build the fleet." }} />
        </>
      ) : null}

      {tab === "dispatches" ? (
        <DxGrid columns={dispCols} data={dispatchesQ.data?.items ?? []} rowKey={(d) => d.id} onRowClick={(d) => nav(routes.ambulanceDispatchDetail.replace(":dispatchId", String(d.id)))}
          isLoading={dispatchesQ.isLoading} error={dispatchesQ.isError ? apiErrorMessage(dispatchesQ.error) : null}
          empty={{ icon: Radio, title: "No dispatches", description: "Open a dispatch for an emergency call." }} />
      ) : null}

      {tab === "analytics" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <DxKpi label="Trips" value={an?.trips_total ?? 0} icon={Radio} tone="accent" />
            <DxKpi label="Completed" value={an?.trips_completed ?? 0} icon={AmbIcon} tone="success" />
            <DxKpi label="Active now" value={an?.trips_active ?? 0} icon={Activity} tone="info" />
            <DxKpi label="Avg transport" value={`${an?.avg_transport_minutes ?? 0}m`} icon={Clock} tone="warning" />
            <DxKpi label="Fuel cost" value={naira(an?.fuel_cost ?? 0)} icon={Fuel} tone="neutral" sub={`${an?.fuel_litres ?? 0} L`} />
            <DxKpi label="Revenue" value={naira(an?.revenue_collected ?? 0)} icon={Banknote} tone="success" sub={`of ${naira(an?.revenue_billed ?? 0)}`} />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <DxPanel title="Trips per month" icon={<Activity />}>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={an?.trip_trend ?? []} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: chart.tick.fill, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: chart.tick.fill, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={chart.tooltip} cursor={chart.cursor} />
                    <Line type="monotone" dataKey="trips" name="Trips" stroke={chart.series[0]} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </DxPanel>
            <DxPanel title="Dispatches by status" icon={<Radio />}>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={Object.entries(an?.by_status ?? {}).map(([k, v]) => ({ status: k.replace(/_/g, " "), count: v }))} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="status" tick={{ fill: chart.tick.fill, fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fill: chart.tick.fill, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={chart.tooltip} cursor={chart.cursor} />
                    <Bar dataKey="count" name="Dispatches" fill={chart.series[1]} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </DxPanel>
          </div>
        </div>
      ) : null}

      {/* register ambulance */}
      <DxPopup isOpen={regOpen} onClose={() => setRegOpen(false)} title="Register ambulance" locked={regMut.isPending}
        footer={<><DxButton onClick={() => setRegOpen(false)}>Cancel</DxButton><DxButton variant="primary" isLoading={regMut.isPending} disabled={!reg.code.trim() || !reg.plate_number.trim()} onClick={() => regMut.mutate()}>Register</DxButton></>}>
        <DxForm cols={2}>
          <DxInput label="Code" required value={reg.code} onChange={(e) => setReg((f) => ({ ...f, code: e.target.value }))} placeholder="AMB-01" />
          <DxInput label="Plate number" required value={reg.plate_number} onChange={(e) => setReg((f) => ({ ...f, plate_number: e.target.value }))} />
          <DxSelect label="Manufacturer" value={reg.manufacturer} onChange={(e) => setReg((f) => ({ ...f, manufacturer: e.target.value, model: "" }))} placeholder="Select manufacturer" options={MAKE_OPTIONS} />
          <DxSelect label="Model" value={reg.model} onChange={(e) => setReg((f) => ({ ...f, model: e.target.value }))} placeholder={reg.manufacturer ? "Select model" : "Select manufacturer first"} options={(AMBULANCE_MAKES.find((m) => m.manufacturer === reg.manufacturer)?.models ?? []).map((v) => ({ value: v, label: v }))} />
          <DxInput label="Year" type="number" value={reg.year_of_manufacture} onChange={(e) => setReg((f) => ({ ...f, year_of_manufacture: e.target.value }))} />
          <DxInput label="Colour" value={reg.color} onChange={(e) => setReg((f) => ({ ...f, color: e.target.value }))} />
        </DxForm>
      </DxPopup>

      {/* new dispatch */}
      <DxPopup isOpen={dispOpen} onClose={() => setDispOpen(false)} title="New dispatch" locked={dispMut.isPending}
        footer={<><DxButton onClick={() => setDispOpen(false)}>Cancel</DxButton><DxButton variant="primary" leftIcon={<Radio />} isLoading={dispMut.isPending} onClick={() => dispMut.mutate()}>Open dispatch</DxButton></>}>
        <DxForm cols={2}>
          <DxSelect label="Ambulance (optional)" fieldClassName="dx-col-span-full" value={disp.ambulance_id} onChange={(e) => setDisp((f) => ({ ...f, ambulance_id: e.target.value }))} placeholder="Assign later" options={ambulanceOptions} />
          <DxInput label="Pickup location" value={disp.pickup_location} onChange={(e) => setDisp((f) => ({ ...f, pickup_location: e.target.value }))} />
          <DxInput label="Destination" value={disp.destination_location} onChange={(e) => setDisp((f) => ({ ...f, destination_location: e.target.value }))} />
          <DxTextarea label="Incident description" fieldClassName="dx-col-span-full" rows={2} value={disp.incident_description} onChange={(e) => setDisp((f) => ({ ...f, incident_description: e.target.value }))} />
        </DxForm>
      </DxPopup>

      {/* assign dispatch */}
      <DxPopup isOpen={assignFor != null} onClose={() => setAssignFor(null)} title={`Assign — ${assignFor?.dispatch_no ?? ""}`} locked={assignMut.isPending}
        footer={<><DxButton onClick={() => setAssignFor(null)}>Cancel</DxButton><DxButton variant="primary" isLoading={assignMut.isPending} disabled={!assign.ambulance_id} onClick={() => assignMut.mutate()}>Assign</DxButton></>}>
        <DxForm cols={1}>
          <DxSelect label="Ambulance" required value={assign.ambulance_id} onChange={(e) => setAssign((f) => ({ ...f, ambulance_id: e.target.value }))} options={ambulanceOptions} />
          <DxSelect label="Driver" value={assign.driver_id} onChange={(e) => setAssign((f) => ({ ...f, driver_id: e.target.value }))} placeholder="Select driver"
            options={(driversQ.data?.items ?? []).map((dr) => ({ value: String(dr.id), label: `Driver #${dr.id}${dr.driver_license_no ? ` · ${dr.driver_license_no}` : ""}` }))} />
        </DxForm>
      </DxPopup>
    </DxPage>
  );
}
