import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, CheckCircle2, ClipboardList, Fuel, Plus, RotateCcw, ShieldCheck, Truck, Wrench } from "lucide-react";
import {
  DxBadge, DxButton, DxForm, DxGrid, DxInput, DxPage, DxPageHeader, DxPageLoading, DxPanel, DxPopup,
  DxProps, DxTabs, DxTextarea, apiErrorMessage, formatDateTime, type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { routes } from "@/config/routes";
import { ambulanceApi, fuelApi, type AmbulanceEquipment, type AmbulanceMaintenance, type FuelLog } from "../api/ambulance.api";

type Tab = "overview" | "equipment" | "maintenance" | "fuel";
const naira = (n: number | string) => `₦ ${Number(n).toLocaleString()}`;

export function AmbulanceDetailPage() {
  const { ambulanceId } = useParams();
  const id = Number(ambulanceId);
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [dialog, setDialog] = useState<null | "equipment" | "maintenance" | "fuel">(null);
  const [eq, setEq] = useState({ equipment_name: "", equipment_code: "", quantity: "1", condition_status: "GOOD" });
  const [mt, setMt] = useState({ maintenance_type: "", issue_description: "", service_provider: "" });
  const [fl, setFl] = useState({ litres: "", cost: "", odometer: "", station: "" });

  const ambQ = useQuery({ queryKey: ["amb", "detail", id], queryFn: () => ambulanceApi.get(id), enabled: Number.isFinite(id) });
  const readyQ = useQuery({ queryKey: ["amb", "detail", id, "ready"], queryFn: () => ambulanceApi.getReadiness(id), enabled: Number.isFinite(id) });
  const eqQ = useQuery({ queryKey: ["amb", "detail", id, "equipment"], queryFn: () => ambulanceApi.listEquipment(id), enabled: Number.isFinite(id) });
  const mtQ = useQuery({ queryKey: ["amb", "detail", id, "maintenance"], queryFn: () => ambulanceApi.listMaintenance(id), enabled: Number.isFinite(id) });
  const flQ = useQuery({ queryKey: ["amb", "detail", id, "fuel"], queryFn: () => fuelApi.list(id), enabled: Number.isFinite(id) });

  const a = ambQ.data;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["amb", "detail", id] });
  const close = () => setDialog(null);

  const addEq = useMutation({ mutationFn: () => ambulanceApi.createEquipment(id, { ambulance_id: id, equipment_name: eq.equipment_name, equipment_code: eq.equipment_code, quantity: Number(eq.quantity) || 1, condition_status: eq.condition_status } as never), onSuccess: () => { toast.success("Equipment added"); close(); setEq({ equipment_name: "", equipment_code: "", quantity: "1", condition_status: "GOOD" }); invalidate(); }, onError: (e) => toast.error("Failed", apiErrorMessage(e)) });
  const addMt = useMutation({ mutationFn: () => ambulanceApi.createMaintenance(id, { ambulance_id: id, maintenance_type: mt.maintenance_type, issue_description: mt.issue_description, service_provider: mt.service_provider, maintenance_date: new Date().toISOString() } as never), onSuccess: () => { toast.success("Maintenance scheduled"); close(); setMt({ maintenance_type: "", issue_description: "", service_provider: "" }); invalidate(); }, onError: (e) => toast.error("Failed", apiErrorMessage(e)) });
  const addFl = useMutation({ mutationFn: () => fuelApi.add(id, { litres: Number(fl.litres) || 0, cost: fl.cost ? Number(fl.cost) : undefined, odometer: fl.odometer ? Number(fl.odometer) : undefined, station: fl.station || undefined }), onSuccess: () => { toast.success("Fuel logged"); close(); setFl({ litres: "", cost: "", odometer: "", station: "" }); invalidate(); }, onError: (e) => toast.error("Failed", apiErrorMessage(e)) });

  if (ambQ.isLoading) return <DxPageLoading label="Loading ambulance…" />;
  if (!a) return <DxPage><DxPageHeader crumbs={[{ label: "Ambulance", to: routes.ambulances }, { label: `#${ambulanceId}` }]} title="Ambulance not found" /></DxPage>;

  const eqCols: DxGridColumn<AmbulanceEquipment>[] = [
    { key: "equipment_name", header: "Equipment", render: (e) => <span className="font-semibold">{e.equipment_name}</span> },
    { key: "equipment_code", header: "Code", render: (e) => <span className="dx-mono">{e.equipment_code}</span> },
    { key: "quantity", header: "Qty", align: "center" },
    { key: "condition_status", header: "Condition", align: "center", render: (e) => <DxBadge tone={e.condition_status === "GOOD" ? "success" : "warning"}>{e.condition_status}</DxBadge> },
    { key: "expiry_date", header: "Expiry", render: (e) => e.expiry_date ? formatDateTime(e.expiry_date) : "—" },
  ];
  const mtCols: DxGridColumn<AmbulanceMaintenance>[] = [
    { key: "maintenance_type", header: "Type", render: (m) => <span className="font-semibold">{m.maintenance_type}</span> },
    { key: "maintenance_status", header: "Status", align: "center", render: (m) => <DxBadge tone={m.maintenance_status === "COMPLETED" ? "success" : "warning"}>{m.maintenance_status}</DxBadge> },
    { key: "service_provider", header: "Provider", render: (m) => m.service_provider ?? "—" },
    { key: "maintenance_date", header: "Date", render: (m) => formatDateTime(m.maintenance_date) },
    { key: "cost", header: "Cost", align: "right", render: (m) => m.cost ? naira(m.cost) : "—" },
  ];
  const flCols: DxGridColumn<FuelLog>[] = [
    { key: "logged_at", header: "Date", render: (f) => formatDateTime(f.logged_at) },
    { key: "litres", header: "Litres", align: "right", render: (f) => `${Number(f.litres).toLocaleString()} L` },
    { key: "cost", header: "Cost", align: "right", render: (f) => f.cost ? naira(f.cost) : "—" },
    { key: "odometer", header: "Odometer", align: "right", render: (f) => f.odometer ? `${Number(f.odometer).toLocaleString()} km` : "—" },
    { key: "station", header: "Station", render: (f) => f.station ?? "—" },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Ambulance", to: routes.ambulances }, { label: a.code }]}
        title={`${[a.manufacturer, a.model].filter(Boolean).join(" ") || a.code}`}
        subtitle="Vehicle readiness, equipment, maintenance and fuel."
        actions={<>
          <DxButton icon title="Refresh" onClick={() => invalidate()}><RotateCcw /></DxButton>
          <DxButton leftIcon={<Truck />} onClick={() => nav(routes.ambulances)}>Back to fleet</DxButton>
        </>}
      />

      <DxPanel title="Vehicle" icon={<Truck />} flush>
        <DxProps items={[
          { label: "Code", value: <span className="dx-mono">{a.code}</span> },
          { label: "Plate", value: a.plate_number },
          { label: "Status", value: <DxBadge tone={a.status === "AVAILABLE" ? "success" : a.status === "OUT_OF_SERVICE" ? "danger" : "info"}>{a.status.replace(/_/g, " ")}</DxBadge> },
          { label: "Readiness", value: readyQ.data ? (readyQ.data.ready ? <DxBadge tone="success" dot>Ready</DxBadge> : <DxBadge tone="warning" dot>Not ready</DxBadge>) : "—" },
          { label: "Year", value: a.year_of_manufacture ?? "—" },
          { label: "Mileage", value: a.current_mileage ? `${Number(a.current_mileage).toLocaleString()} km` : "—" },
        ]} />
        {readyQ.data && !readyQ.data.ready && readyQ.data.reasons?.length ? (
          <div className="px-3 pb-3 text-[12px] text-[var(--dx-warning)]">Not ready: {readyQ.data.reasons.join(", ")}</div>
        ) : null}
      </DxPanel>

      <DxTabs<Tab> value={tab} onChange={setTab} className="mt-4 mb-3" items={[
        { key: "overview", label: "Overview", icon: <ShieldCheck /> },
        { key: "equipment", label: "Equipment", icon: <Boxes />, count: eqQ.data?.items?.length ?? null },
        { key: "maintenance", label: "Maintenance", icon: <Wrench />, count: mtQ.data?.items?.length ?? null },
        { key: "fuel", label: "Fuel", icon: <Fuel />, count: flQ.data?.items?.length ?? null },
      ]} />

      {tab === "overview" ? (
        <DxPanel title="Readiness" icon={<ClipboardList />} flush>
          <DxProps items={[
            { label: "Primary driver", value: readyQ.data?.primary_driver_id ? `#${readyQ.data.primary_driver_id}` : "Not assigned" },
            { label: "Expired equipment", value: String(readyQ.data?.expired_equipment_ids?.length ?? 0) },
            { label: "Open maintenance", value: String(readyQ.data?.open_maintenance_ids?.length ?? 0) },
          ]} />
        </DxPanel>
      ) : null}

      {tab === "equipment" ? (
        <DxPanel title="Equipment" icon={<Boxes />} flush actions={<DxButton size="sm" leftIcon={<Plus />} onClick={() => setDialog("equipment")}>Add equipment</DxButton>}>
          <DxGrid borderless columns={eqCols} data={eqQ.data?.items ?? []} rowKey={(e) => e.id} isLoading={eqQ.isLoading} empty={{ icon: Boxes, title: "No equipment", description: "Add the vehicle's medical kit." }} />
        </DxPanel>
      ) : null}

      {tab === "maintenance" ? (
        <DxPanel title="Maintenance" icon={<Wrench />} flush actions={<DxButton size="sm" leftIcon={<Plus />} onClick={() => setDialog("maintenance")}>Schedule</DxButton>}>
          <DxGrid borderless columns={mtCols} data={mtQ.data?.items ?? []} rowKey={(m) => m.id} isLoading={mtQ.isLoading} empty={{ icon: Wrench, title: "No maintenance", description: "Schedule servicing or log a repair." }} />
        </DxPanel>
      ) : null}

      {tab === "fuel" ? (
        <DxPanel title="Fuel log" icon={<Fuel />} flush actions={<DxButton size="sm" leftIcon={<Plus />} onClick={() => setDialog("fuel")}>Log fuel</DxButton>}>
          <DxGrid borderless columns={flCols} data={flQ.data?.items ?? []} rowKey={(f) => f.id} isLoading={flQ.isLoading} empty={{ icon: Fuel, title: "No fuel logs", description: "Record refuelling and odometer readings." }} />
        </DxPanel>
      ) : null}

      <DxPopup isOpen={dialog === "equipment"} onClose={close} title="Add equipment" locked={addEq.isPending}
        footer={<><DxButton onClick={close}>Cancel</DxButton><DxButton variant="primary" isLoading={addEq.isPending} disabled={!eq.equipment_name.trim()} onClick={() => addEq.mutate()}>Add</DxButton></>}>
        <DxForm cols={2}>
          <DxInput label="Name" required value={eq.equipment_name} onChange={(e) => setEq((f) => ({ ...f, equipment_name: e.target.value }))} />
          <DxInput label="Code" value={eq.equipment_code} onChange={(e) => setEq((f) => ({ ...f, equipment_code: e.target.value }))} />
          <DxInput label="Quantity" type="number" value={eq.quantity} onChange={(e) => setEq((f) => ({ ...f, quantity: e.target.value }))} />
          <DxInput label="Condition" value={eq.condition_status} onChange={(e) => setEq((f) => ({ ...f, condition_status: e.target.value }))} />
        </DxForm>
      </DxPopup>

      <DxPopup isOpen={dialog === "maintenance"} onClose={close} title="Schedule maintenance" locked={addMt.isPending}
        footer={<><DxButton onClick={close}>Cancel</DxButton><DxButton variant="primary" isLoading={addMt.isPending} disabled={!mt.maintenance_type.trim()} onClick={() => addMt.mutate()}>Schedule</DxButton></>}>
        <DxForm cols={2}>
          <DxInput label="Type" required value={mt.maintenance_type} onChange={(e) => setMt((f) => ({ ...f, maintenance_type: e.target.value }))} placeholder="Service / repair" />
          <DxInput label="Service provider" value={mt.service_provider} onChange={(e) => setMt((f) => ({ ...f, service_provider: e.target.value }))} />
          <DxTextarea label="Issue" fieldClassName="dx-col-span-full" rows={2} value={mt.issue_description} onChange={(e) => setMt((f) => ({ ...f, issue_description: e.target.value }))} />
        </DxForm>
      </DxPopup>

      <DxPopup isOpen={dialog === "fuel"} onClose={close} title="Log fuel" locked={addFl.isPending}
        footer={<><DxButton onClick={close}>Cancel</DxButton><DxButton variant="primary" isLoading={addFl.isPending} disabled={!(Number(fl.litres) > 0)} onClick={() => addFl.mutate()}>Log</DxButton></>}>
        <DxForm cols={2}>
          <DxInput label="Litres" required type="number" value={fl.litres} onChange={(e) => setFl((f) => ({ ...f, litres: e.target.value }))} />
          <DxInput label="Cost (₦)" type="number" value={fl.cost} onChange={(e) => setFl((f) => ({ ...f, cost: e.target.value }))} />
          <DxInput label="Odometer (km)" type="number" value={fl.odometer} onChange={(e) => setFl((f) => ({ ...f, odometer: e.target.value }))} />
          <DxInput label="Station" value={fl.station} onChange={(e) => setFl((f) => ({ ...f, station: e.target.value }))} />
        </DxForm>
      </DxPopup>
    </DxPage>
  );
}
