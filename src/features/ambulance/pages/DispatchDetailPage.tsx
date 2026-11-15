import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CheckCircle2, ClipboardList, HeartPulse, Plus, Radio, RotateCcw, Save, Users } from "lucide-react";
import {
  DxBadge, DxButton, DxForm, DxGrid, DxInput, DxPage, DxPageHeader, DxPageLoading, DxPanel, DxPopup,
  DxProps, DxSelect, DxTabs, DxTextarea, apiErrorMessage, formatDateTime, type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { routes } from "@/config/routes";
import { dispatchApi, type AmbulanceCrew, type AmbulancePCR, type TripCharge } from "../api/ambulance.api";

type Tab = "overview" | "crew" | "pcr" | "billing";
const naira = (n: number | string) => `₦ ${Number(n).toLocaleString()}`;
const NEXT: Record<string, { action: "depart" | "arrive" | "patient-picked" | "complete"; label: string } | undefined> = {
  ASSIGNED: { action: "depart", label: "Depart" }, EN_ROUTE: { action: "arrive", label: "Arrived" },
  ARRIVED: { action: "patient-picked", label: "Patient picked" }, PATIENT_PICKED: { action: "complete", label: "Complete" },
};

export function DispatchDetailPage() {
  const { dispatchId } = useParams();
  const id = Number(dispatchId);
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [crewOpen, setCrewOpen] = useState(false);
  const [crewForm, setCrewForm] = useState({ role: "PARAMEDIC", member_name: "", notes: "" });
  const [chargeOpen, setChargeOpen] = useState(false);
  const [chargeForm, setChargeForm] = useState({ description: "", amount: "", payer_name: "" });
  const [pcr, setPcr] = useState<AmbulancePCR>({});

  const dispQ = useQuery({ queryKey: ["amb", "dispatch", id], queryFn: () => dispatchApi.get(id), enabled: Number.isFinite(id) });
  const crewQ = useQuery({ queryKey: ["amb", "dispatch", id, "crew"], queryFn: () => dispatchApi.listCrew(id), enabled: Number.isFinite(id) });
  const pcrQ = useQuery({ queryKey: ["amb", "dispatch", id, "pcr"], queryFn: () => dispatchApi.getPcr(id), enabled: Number.isFinite(id) });
  const chargesQ = useQuery({ queryKey: ["amb", "dispatch", id, "charges"], queryFn: () => dispatchApi.listCharges(id), enabled: Number.isFinite(id) });
  useEffect(() => { if (pcrQ.data && Object.keys(pcrQ.data).length) setPcr(pcrQ.data); }, [pcrQ.data]);

  const d = dispQ.data;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["amb", "dispatch", id] });

  const transition = useMutation({ mutationFn: (action: "depart" | "arrive" | "patient-picked" | "complete" | "cancel") => dispatchApi.transition(id, action), onSuccess: () => { toast.success("Dispatch updated"); invalidate(); }, onError: (e) => toast.error("Failed", apiErrorMessage(e)) });
  const addCrew = useMutation({ mutationFn: () => dispatchApi.addCrew(id, crewForm), onSuccess: () => { toast.success("Crew assigned"); setCrewOpen(false); setCrewForm({ role: "PARAMEDIC", member_name: "", notes: "" }); invalidate(); }, onError: (e) => toast.error("Failed", apiErrorMessage(e)) });
  const rmCrew = useMutation({ mutationFn: (cid: number) => dispatchApi.removeCrew(cid), onSuccess: () => { toast.success("Removed"); invalidate(); }, onError: (e) => toast.error("Failed", apiErrorMessage(e)) });
  const savePcr = useMutation({ mutationFn: () => dispatchApi.savePcr(id, pcr as Record<string, unknown>), onSuccess: () => { toast.success("PCR saved"); invalidate(); }, onError: (e) => toast.error("Failed", apiErrorMessage(e)) });
  const addCharge = useMutation({ mutationFn: () => dispatchApi.addCharge(id, { description: chargeForm.description || undefined, amount: Number(chargeForm.amount) || 0, payer_name: chargeForm.payer_name || undefined }), onSuccess: () => { toast.success("Charge added"); setChargeOpen(false); setChargeForm({ description: "", amount: "", payer_name: "" }); invalidate(); }, onError: (e) => toast.error("Failed", apiErrorMessage(e)) });
  const chargeStatus = useMutation({ mutationFn: ({ cid, s }: { cid: number; s: "PAID" | "WAIVED" }) => dispatchApi.setChargeStatus(cid, s), onSuccess: () => { toast.success("Updated"); invalidate(); }, onError: (e) => toast.error("Failed", apiErrorMessage(e)) });

  if (dispQ.isLoading) return <DxPageLoading label="Loading dispatch…" />;
  if (!d) return <DxPage><DxPageHeader crumbs={[{ label: "Ambulance", to: routes.ambulances }, { label: `#${dispatchId}` }]} title="Dispatch not found" /></DxPage>;

  const terminal = d.dispatch_status === "COMPLETED" || d.dispatch_status === "CANCELLED";
  const next = NEXT[d.dispatch_status];
  const crewCols: DxGridColumn<AmbulanceCrew>[] = [
    { key: "role", header: "Role", align: "center", render: (c) => <DxBadge tone="info">{c.role}</DxBadge> },
    { key: "member_name", header: "Member", render: (c) => c.member_name ?? "—" },
    { key: "notes", header: "Notes", render: (c) => c.notes ?? "—" },
    { key: "actions", header: "", align: "right", render: (c) => <DxButton size="sm" variant="text" onClick={() => rmCrew.mutate(c.id)}>Remove</DxButton> },
  ];
  const chargeCols: DxGridColumn<TripCharge>[] = [
    { key: "description", header: "Description", render: (c) => c.description ?? "Ambulance service" },
    { key: "amount", header: "Amount", align: "right", render: (c) => <span className="font-semibold">{naira(c.amount)}</span> },
    { key: "status", header: "Status", align: "center", render: (c) => <DxBadge tone={c.status === "PAID" ? "success" : c.status === "WAIVED" ? "neutral" : "warning"}>{c.status}</DxBadge> },
    { key: "actions", header: "", align: "right", render: (c) => c.status === "PENDING" ? (
      <div className="flex items-center justify-end gap-1.5">
        <DxButton size="sm" leftIcon={<CheckCircle2 />} onClick={() => chargeStatus.mutate({ cid: c.id, s: "PAID" })}>Paid</DxButton>
        <DxButton size="sm" variant="text" onClick={() => chargeStatus.mutate({ cid: c.id, s: "WAIVED" })}>Waive</DxButton>
      </div>
    ) : null },
  ];

  const P = (k: keyof AmbulancePCR) => (e: { target: { value: string } }) => setPcr((f) => ({ ...f, [k]: e.target.value }));

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Ambulance", to: routes.ambulances }, { label: d.dispatch_no }]}
        title={`Dispatch ${d.dispatch_no}`}
        subtitle="Emergency dispatch lifecycle, crew, patient care report and trip billing."
        actions={<>
          <DxButton icon title="Refresh" onClick={() => invalidate()}><RotateCcw /></DxButton>
          {next ? <DxButton variant="primary" leftIcon={<Radio />} isLoading={transition.isPending} onClick={() => transition.mutate(next.action)}>{next.label}</DxButton> : null}
          {!terminal ? <DxButton variant="outline-danger" onClick={() => transition.mutate("cancel")}>Cancel</DxButton> : null}
        </>}
      />

      <DxPanel title="Dispatch" icon={<Radio />} flush>
        <DxProps items={[
          { label: "Status", value: <DxBadge tone={d.dispatch_status === "COMPLETED" ? "success" : d.dispatch_status === "CANCELLED" ? "danger" : "info"}>{d.dispatch_status.replace(/_/g, " ")}</DxBadge> },
          { label: "Pickup", value: d.pickup_location ?? "—" },
          { label: "Destination", value: d.destination_location ?? "—" },
          { label: "Requested", value: formatDateTime(d.requested_at) },
          { label: "Assigned", value: formatDateTime(d.assigned_at) },
          { label: "Departed", value: formatDateTime(d.departed_at) },
          { label: "Arrived", value: formatDateTime(d.arrived_at) },
          { label: "Completed", value: formatDateTime(d.completed_at) },
          { label: "Incident", value: d.incident_description ?? "—" },
        ]} />
      </DxPanel>

      <DxTabs<Tab> value={tab} onChange={setTab} className="mt-4 mb-3" items={[
        { key: "overview", label: "Overview", icon: <ClipboardList /> },
        { key: "crew", label: "Crew", icon: <Users />, count: crewQ.data?.items?.length ?? null },
        { key: "pcr", label: "Patient Care Report", icon: <HeartPulse /> },
        { key: "billing", label: "Billing", icon: <Banknote />, count: chargesQ.data?.items?.length ?? null },
      ]} />

      {tab === "overview" ? (
        <DxPanel title="Timeline" icon={<ClipboardList />} flush>
          <DxProps items={[
            { label: "Requested", value: formatDateTime(d.requested_at) },
            { label: "Assigned", value: formatDateTime(d.assigned_at) },
            { label: "En route", value: formatDateTime(d.departed_at) },
            { label: "Arrived on scene", value: formatDateTime(d.arrived_at) },
            { label: "Completed", value: formatDateTime(d.completed_at) },
          ]} />
        </DxPanel>
      ) : null}

      {tab === "crew" ? (
        <DxPanel title="Crew" icon={<Users />} flush actions={<DxButton size="sm" leftIcon={<Plus />} onClick={() => setCrewOpen(true)}>Assign crew</DxButton>}>
          <DxGrid borderless columns={crewCols} data={crewQ.data?.items ?? []} rowKey={(c) => c.id} isLoading={crewQ.isLoading} empty={{ icon: Users, title: "No crew assigned", description: "Assign the paramedic, EMT or nurse for this run." }} />
        </DxPanel>
      ) : null}

      {tab === "pcr" ? (
        <DxPanel title="Patient Care Report" icon={<HeartPulse />} actions={<DxButton size="sm" variant="primary" leftIcon={<Save />} isLoading={savePcr.isPending} onClick={() => savePcr.mutate()}>Save PCR</DxButton>}>
          <DxForm cols={2}>
            <DxInput label="Chief complaint" fieldClassName="dx-col-span-full" value={pcr.chief_complaint ?? ""} onChange={P("chief_complaint")} />
            <DxInput label="Blood pressure" value={pcr.blood_pressure ?? ""} onChange={P("blood_pressure")} placeholder="120/80" />
            <DxInput label="Pulse (bpm)" type="number" value={pcr.pulse_rate ?? ""} onChange={(e) => setPcr((f) => ({ ...f, pulse_rate: e.target.value ? Number(e.target.value) : undefined }))} />
            <DxInput label="Temp (°C)" type="number" value={(pcr.temperature_celsius as number) ?? ""} onChange={(e) => setPcr((f) => ({ ...f, temperature_celsius: e.target.value }))} />
            <DxInput label="SpO₂ (%)" type="number" value={pcr.oxygen_saturation ?? ""} onChange={(e) => setPcr((f) => ({ ...f, oxygen_saturation: e.target.value ? Number(e.target.value) : undefined }))} />
            <DxInput label="Resp rate" type="number" value={pcr.respiratory_rate ?? ""} onChange={(e) => setPcr((f) => ({ ...f, respiratory_rate: e.target.value ? Number(e.target.value) : undefined }))} />
            <DxInput label="Condition on handover" value={pcr.condition_on_handover ?? ""} onChange={P("condition_on_handover")} />
            <DxTextarea label="Interventions" fieldClassName="dx-col-span-full" rows={2} value={pcr.interventions ?? ""} onChange={P("interventions")} />
            <DxTextarea label="Medications given" fieldClassName="dx-col-span-full" rows={2} value={pcr.medications_given ?? ""} onChange={P("medications_given")} />
            <DxInput label="Receiving facility" value={pcr.receiving_facility ?? ""} onChange={P("receiving_facility")} />
            <DxInput label="Receiving staff" value={pcr.receiving_staff ?? ""} onChange={P("receiving_staff")} />
            <DxTextarea label="Narrative" fieldClassName="dx-col-span-full" rows={3} value={pcr.narrative ?? ""} onChange={P("narrative")} />
          </DxForm>
        </DxPanel>
      ) : null}

      {tab === "billing" ? (
        <DxPanel title="Trip charges" icon={<Banknote />} flush actions={<DxButton size="sm" leftIcon={<Plus />} onClick={() => setChargeOpen(true)}>Add charge</DxButton>}>
          <DxGrid borderless columns={chargeCols} data={chargesQ.data?.items ?? []} rowKey={(c) => c.id} isLoading={chargesQ.isLoading} empty={{ icon: Banknote, title: "No charges", description: "Bill the ambulance service for this trip." }} />
        </DxPanel>
      ) : null}

      <DxPopup isOpen={crewOpen} onClose={() => setCrewOpen(false)} title="Assign crew" locked={addCrew.isPending}
        footer={<><DxButton onClick={() => setCrewOpen(false)}>Cancel</DxButton><DxButton variant="primary" isLoading={addCrew.isPending} onClick={() => addCrew.mutate()}>Assign</DxButton></>}>
        <DxForm cols={2}>
          <DxSelect label="Role" value={crewForm.role} onChange={(e) => setCrewForm((f) => ({ ...f, role: e.target.value }))} options={["DRIVER", "PARAMEDIC", "EMT", "NURSE", "DOCTOR", "OTHER"].map((v) => ({ value: v, label: v[0] + v.slice(1).toLowerCase() }))} />
          <DxInput label="Member name" value={crewForm.member_name} onChange={(e) => setCrewForm((f) => ({ ...f, member_name: e.target.value }))} />
          <DxTextarea label="Notes" fieldClassName="dx-col-span-full" rows={2} value={crewForm.notes} onChange={(e) => setCrewForm((f) => ({ ...f, notes: e.target.value }))} />
        </DxForm>
      </DxPopup>

      <DxPopup isOpen={chargeOpen} onClose={() => setChargeOpen(false)} title="Add trip charge" locked={addCharge.isPending}
        footer={<><DxButton onClick={() => setChargeOpen(false)}>Cancel</DxButton><DxButton variant="primary" isLoading={addCharge.isPending} disabled={!(Number(chargeForm.amount) >= 0 && chargeForm.amount !== "")} onClick={() => addCharge.mutate()}>Add</DxButton></>}>
        <DxForm cols={2}>
          <DxInput label="Description" fieldClassName="dx-col-span-full" value={chargeForm.description} onChange={(e) => setChargeForm((f) => ({ ...f, description: e.target.value }))} placeholder="Emergency transport" />
          <DxInput label="Amount (₦)" required type="number" value={chargeForm.amount} onChange={(e) => setChargeForm((f) => ({ ...f, amount: e.target.value }))} />
          <DxInput label="Payer" value={chargeForm.payer_name} onChange={(e) => setChargeForm((f) => ({ ...f, payer_name: e.target.value }))} />
        </DxForm>
      </DxPopup>
    </DxPage>
  );
}
