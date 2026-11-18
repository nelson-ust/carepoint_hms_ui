import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  RefreshCw, Send, Download, ArrowLeftRight, Search,
  ShieldCheck, X, Eye, FileText, Building2, Hospital, UserRound, UserPlus, CheckCircle2, AlertTriangle,
} from "lucide-react";
import {
  DxPage, DxPageHeader, DxSegmented, DxTabs, DxGrid, DxBadge, DxButton, DxPopup,
  DxInput, DxSelect, DxTextarea, DxCheckbox, DxMessage,
  type DxGridColumn, type DxBadgeTone,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { routes } from "@/config/routes";
import { facilitiesApi, type Facility } from "@/features/facilities/api/facilities.api";
import type { ReferralImportPreview, ReferralImportResult } from "../api/interoperability.api";
import { searchPatients } from "@/features/patients/api/patients.api";
import {
  interopApi, interopReferralApi, facilityReferralApi,
  type DataRequest, type DataRequestStatus, type InterFacilityReferral, type FacilityReferral, type PartnerTenant,
} from "../api/interoperability.api";

type Mode = "INTERNAL" | "CROSS";
type Tab = "REFER_OUT" | "REFER_IN" | "DATA_OUT" | "DATA_IN";

const reqTone: Record<DataRequestStatus, DxBadgeTone> = {
  PENDING: "warning", APPROVED: "success", DENIED: "danger",
  FULFILLED: "success", EXPIRED: "neutral", CANCELLED: "neutral",
};
const refTone: Record<string, DxBadgeTone> = {
  PENDING: "warning", ACCEPTED: "success", DECLINED: "danger",
  COMPLETED: "success", CANCELLED: "neutral",
};

function fmt(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

const mono = "dx-mono font-semibold text-[var(--dx-text)]";
const muted = "text-[var(--dx-text-muted)]";

export function InteroperabilityPage() {
  const [mode, setMode] = useState<Mode>("INTERNAL");
  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Interoperability" }]}
        title="Interoperability"
        subtitle="Move patients and records between your own facilities, and exchange records with other hospitals on the platform under consent and approval."
      />
      <DxSegmented<Mode>
        ariaLabel="Interoperability scope"
        value={mode}
        onChange={setMode}
        items={[
          { key: "INTERNAL", label: "Within my hospital", icon: <Hospital className="h-4 w-4" /> },
          { key: "CROSS", label: "Across hospitals", icon: <ArrowLeftRight className="h-4 w-4" /> },
        ]}
      />
      {mode === "INTERNAL" ? <WithinHospital /> : <AcrossHospitals />}
    </DxPage>
  );
}

// ════════════════════════════ WITHIN MY HOSPITAL (facilities, same DB) ════════════════════════════

function WithinHospital() {
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"OUT" | "IN">("IN");
  const [referOpen, setReferOpen] = useState(false);

  const facilities = useQuery({ queryKey: ["facilities", "all"], queryFn: () => facilitiesApi.list() });
  const facName = useMemo(() => {
    const m = new Map<number, string>();
    (facilities.data ?? []).forEach((f) => m.set(f.id, f.name));
    return m;
  }, [facilities.data]);

  const incoming = useQuery({ queryKey: ["facility-referrals", "in"], queryFn: () => facilityReferralApi.incoming() });
  const outgoing = useQuery({ queryKey: ["facility-referrals", "out"], queryFn: () => facilityReferralApi.outgoing() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["facility-referrals"] });

  const complete = useMutation({
    mutationFn: (id: number) => facilityReferralApi.updateStatus(id, "COMPLETED"),
    onSuccess: () => { invalidate(); toast.success("Marked as seen"); },
    onError: () => toast.error("Couldn't update", "Please try again."),
  });

  const list = tab === "IN" ? incoming : outgoing;

  const columns: DxGridColumn<FacilityReferral>[] = [
    { key: "referral_no", header: "Referral", render: (r) => <span className={mono}>{r.referral_no}</span> },
    { key: "patient_id", header: "Patient", render: (r) => <span className="text-[13px] text-[var(--dx-text)]">Patient #{r.patient_id}</span> },
    {
      key: "facility",
      header: tab === "IN" ? "From facility" : "To facility",
      render: (r) => (
        <span className="text-[13px] text-[var(--dx-text)]">
          {tab === "IN"
            ? (r.source_facility_id ? facName.get(r.source_facility_id) ?? `#${r.source_facility_id}` : "—")
            : (r.destination_facility_id ? facName.get(r.destination_facility_id) ?? r.destination_facility : r.destination_facility)}
        </span>
      ),
    },
    { key: "reason_for_referral", header: "Reason", render: (r) => <span className={`block max-w-[16rem] truncate text-[13px] ${muted}`}>{r.reason_for_referral}</span> },
    { key: "status", header: "Status", align: "center", render: (r) => <DxBadge tone={refTone[r.status] ?? "neutral"}>{r.status}</DxBadge> },
    {
      key: "actions", header: "", align: "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <DxButton size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => navigate(routes.patientDetail.replace(":patientId", String(r.patient_id)))}>Open record</DxButton>
          {tab === "IN" && r.status === "PENDING" ? (
            <DxButton size="sm" variant="text" onClick={() => complete.mutate(r.id)}>Mark seen</DxButton>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <DxMessage tone="info" title="Internal referrals are instant">
        Your facilities share one patient record. Referring a patient to another of your facilities is instant — the receiving
        facility can open the full record right away. No consent or export step is required within your hospital.
      </DxMessage>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <DxTabs<"IN" | "OUT">
          value={tab}
          onChange={setTab}
          items={[
            { key: "IN", label: "Received", count: incoming.data?.length ?? 0 },
            { key: "OUT", label: "Sent", count: outgoing.data?.length ?? 0 },
          ]}
        />
        <div className="flex gap-2">
          <DxButton icon title="Refresh" onClick={() => { incoming.refetch(); outgoing.refetch(); }} isLoading={list.isFetching}><RefreshCw /></DxButton>
          <DxButton variant="primary" leftIcon={<Send className="h-4 w-4" />} onClick={() => setReferOpen(true)}>Refer to a facility</DxButton>
        </div>
      </div>

      <DxGrid
        columns={columns}
        data={list.data ?? []}
        rowKey={(r) => r.id}
        isLoading={list.isLoading}
        empty={{
          icon: Building2,
          title: tab === "IN" ? "No referrals to your facility" : "No referrals sent",
          description: tab === "IN" ? "Referrals from your other facilities appear here." : "Refer a patient to one of your other facilities.",
        }}
      />

      <ReferWithinModal isOpen={referOpen} onClose={() => setReferOpen(false)} facilities={facilities.data ?? []} onSaved={invalidate} />
    </div>
  );
}

function ReferWithinModal({ isOpen, onClose, facilities, onSaved }: { isOpen: boolean; onClose: () => void; facilities: Facility[]; onSaved: () => void }) {
  const toast = useToast();
  const [term, setTerm] = useState("");
  const [patient, setPatient] = useState<{ id: number; label: string } | null>(null);
  const [facility, setFacility] = useState("");
  const [reason, setReason] = useState("");
  const [summary, setSummary] = useState("");

  const results = useQuery({
    queryKey: ["patient-search", term],
    queryFn: () => searchPatients(term, 10),
    enabled: isOpen && term.trim().length >= 2 && patient === null,
  });

  const reset = () => { setTerm(""); setPatient(null); setFacility(""); setReason(""); setSummary(""); };
  const create = useMutation({
    mutationFn: () => facilityReferralApi.create({
      patient_id: patient!.id, destination_facility_id: Number(facility),
      reason_for_referral: reason.trim(), clinical_summary: summary.trim() || undefined,
    }),
    onSuccess: () => { toast.success("Referred", "The receiving facility can open the record now."); onSaved(); onClose(); reset(); },
    onError: (e: any) => toast.error("Couldn't refer", apiErrorMessage(e, "Check the fields and try again.")),
  });
  function submit() {
    if (!patient) return toast.error("Select a patient", "Search and pick the patient to refer.");
    if (!facility) return toast.error("Select a facility", "Choose the receiving facility.");
    if (!reason.trim()) return toast.error("Missing reason", "State the reason for referral.");
    create.mutate();
  }
  return (
    <DxPopup isOpen={isOpen} onClose={onClose} title="Refer to a facility" size="md" locked={create.isPending}
      footer={<><DxButton onClick={onClose} disabled={create.isPending}>Cancel</DxButton><DxButton variant="primary" leftIcon={<Send className="h-4 w-4" />} onClick={submit} isLoading={create.isPending}>Send referral</DxButton></>}>
      <div className="space-y-4">
        {patient ? (
          <div className="flex items-center justify-between rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] px-3 py-2.5">
            <span className="flex items-center gap-2 text-[13px] font-semibold text-[var(--dx-text)]"><UserRound className="h-4 w-4 text-[var(--dx-accent)]" /> {patient.label}</span>
            <button onClick={() => setPatient(null)} className="rounded p-1 text-[var(--dx-danger)] hover:bg-[var(--dx-danger-soft)]"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <div>
            <DxInput label="Find patient" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search name, hospital no. or phone…" leftIcon={<Search className="h-3.5 w-3.5" />} />
            {term.trim().length >= 2 ? (
              <div className="mt-2 max-h-52 divide-y divide-[var(--dx-border)] overflow-y-auto rounded-md border border-[var(--dx-border)]">
                {results.isLoading ? (
                  <div className="dx-skeleton m-3 h-6" />
                ) : (results.data?.items ?? []).length === 0 ? (
                  <p className={`p-3 text-[12px] ${muted}`}>No matches.</p>
                ) : (
                  (results.data?.items ?? []).map((p: any) => {
                    const label = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || `Patient #${p.id}`;
                    const sub = p.patient_number || p.hospital_number || p.global_patient_id || "";
                    return (
                      <button key={p.id} onClick={() => setPatient({ id: p.id, label: sub ? `${label} · ${sub}` : label })}
                        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[var(--dx-surface-alt)]">
                        <span className="text-[13px] font-medium text-[var(--dx-text)]">{label}</span>
                        {sub ? <span className={`dx-mono text-[11px] ${muted}`}>{sub}</span> : null}
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>
        )}
        <DxSelect label="Receiving facility" value={facility} onChange={(e) => setFacility(e.target.value)}
          placeholder="— Select facility —"
          options={facilities.map((f) => ({ value: String(f.id), label: `${f.name} (${f.code})` }))} />
        <DxTextarea label="Reason for referral" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        <DxTextarea label="Clinical note (optional)" rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} />
        <p className={`text-[11px] ${muted}`}>The receiving facility shares this patient record — they can open it immediately on acceptance.</p>
      </div>
    </DxPopup>
  );
}

// ════════════════════════════ ACROSS HOSPITALS (tenants, gated exchange) ════════════════════════════

function AcrossHospitals() {
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("REFER_OUT");
  const [newReferral, setNewReferral] = useState(false);
  const [newRequest, setNewRequest] = useState(false);
  const [respondTo, setRespondTo] = useState<InterFacilityReferral | null>(null);
  const [approve, setApprove] = useState<DataRequest | null>(null);
  const [viewRecord, setViewRecord] = useState<DataRequest | null>(null);
  const [viewReferralRecord, setViewReferralRecord] = useState<InterFacilityReferral | null>(null);
  const [importReferral, setImportReferral] = useState<InterFacilityReferral | null>(null);

  const partners = useQuery({ queryKey: ["interop", "partners"], queryFn: () => interopApi.partners() });
  const partnerName = useMemo(() => {
    const m = new Map<number, string>();
    (partners.data ?? []).forEach((p) => m.set(p.id, p.name));
    return m;
  }, [partners.data]);

  const referOut = useQuery({ queryKey: ["interop", "refer-out"], queryFn: () => interopReferralApi.outgoing() });
  const referIn = useQuery({ queryKey: ["interop", "refer-in"], queryFn: () => interopReferralApi.incoming() });
  const dataOut = useQuery({ queryKey: ["interop", "data-out"], queryFn: () => interopApi.outgoingRequests() });
  const dataIn = useQuery({ queryKey: ["interop", "data-in"], queryFn: () => interopApi.incomingRequests() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["interop"] });

  const cancelReq = useMutation({
    mutationFn: (id: number) => interopApi.cancelRequest(id),
    onSuccess: () => { invalidate(); toast.success("Request cancelled"); },
    onError: () => toast.error("Couldn't cancel", "Please try again."),
  });

  const referOutCols: DxGridColumn<InterFacilityReferral>[] = [
    { key: "referral_no", header: "Referral", render: (r) => <span className={mono}>{r.referral_no}</span> },
    { key: "patient_global_id", header: "Patient (global ID)", render: (r) => <span className="dx-mono text-[12px] text-[var(--dx-text-muted)]">{r.patient_global_id}</span> },
    { key: "target", header: "To hospital", render: (r) => <span className="text-[13px] text-[var(--dx-text)]">{partnerName.get(r.target_tenant_id) ?? `#${r.target_tenant_id}`}</span> },
    { key: "reason_for_referral", header: "Reason", render: (r) => <span className={`block max-w-[16rem] truncate text-[13px] ${muted}`}>{r.reason_for_referral}</span> },
    { key: "status", header: "Status", align: "center", render: (r) => <DxBadge tone={refTone[r.status] ?? "neutral"}>{r.status}</DxBadge> },
    { key: "referral_date", header: "Date", align: "right", render: (r) => <span className={`text-[13px] ${muted}`}>{fmt(r.referral_date)}</span> },
  ];

  const referInCols: DxGridColumn<InterFacilityReferral>[] = [
    { key: "referral_no", header: "Referral", render: (r) => <span className={mono}>{r.referral_no}</span> },
    { key: "patient_global_id", header: "Patient (global ID)", render: (r) => <span className="dx-mono text-[12px] text-[var(--dx-text-muted)]">{r.patient_global_id}</span> },
    { key: "source", header: "From hospital", render: (r) => <span className="text-[13px] text-[var(--dx-text)]">{partnerName.get(r.source_tenant_id) ?? `#${r.source_tenant_id}`}</span> },
    { key: "reason_for_referral", header: "Reason", render: (r) => <span className={`block max-w-[16rem] truncate text-[13px] ${muted}`}>{r.reason_for_referral}</span> },
    { key: "status", header: "Status", align: "center", render: (r) => <DxBadge tone={refTone[r.status] ?? "neutral"}>{r.status}</DxBadge> },
    {
      key: "actions", header: "", align: "right",
      render: (r) => r.status === "PENDING" ? (
        <DxButton size="sm" variant="primary" onClick={() => setRespondTo(r)}>Respond</DxButton>
      ) : r.status === "ACCEPTED" && r.is_history_access_granted ? (
        <DxButton size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => setViewReferralRecord(r)}>Open record</DxButton>
      ) : <span className={`text-[12px] ${muted}`}>—</span>,
    },
  ];

  const dataOutCols: DxGridColumn<DataRequest>[] = [
    { key: "request_no", header: "Request", render: (r) => <span className={mono}>{r.request_no}</span> },
    {
      key: "patient", header: "Patient",
      render: (r) => (
        <div className="min-w-0">
          <div className="dx-mono text-[12px] text-[var(--dx-text-muted)]">{r.patient_global_id}</div>
          {r.patient_display_name ? <div className={`truncate text-[11px] ${muted}`}>{r.patient_display_name}</div> : null}
        </div>
      ),
    },
    { key: "holding", header: "Holding hospital", render: (r) => <span className="text-[13px] text-[var(--dx-text)]">{r.holding_tenant_name ?? partnerName.get(r.holding_tenant_id) ?? `#${r.holding_tenant_id}`}</span> },
    { key: "purpose", header: "Purpose", render: (r) => <span className={`block max-w-[14rem] truncate text-[13px] ${muted}`}>{r.purpose}</span> },
    { key: "status", header: "Status", align: "center", render: (r) => <DxBadge tone={reqTone[r.status]}>{r.status}</DxBadge> },
    {
      key: "actions", header: "", align: "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          {(r.status === "APPROVED" || r.status === "FULFILLED") ? (
            <DxButton size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => setViewRecord(r)}>View record</DxButton>
          ) : null}
          {(r.status === "PENDING" || r.status === "APPROVED") ? (
            <DxButton icon size="sm" variant="outline-danger" title="Cancel" onClick={() => cancelReq.mutate(r.id)}><X /></DxButton>
          ) : null}
        </div>
      ),
    },
  ];

  const dataInCols: DxGridColumn<DataRequest>[] = [
    { key: "request_no", header: "Request", render: (r) => <span className={mono}>{r.request_no}</span> },
    { key: "patient_global_id", header: "Patient (global ID)", render: (r) => <span className="dx-mono text-[12px] text-[var(--dx-text-muted)]">{r.patient_global_id}</span> },
    { key: "requesting", header: "Requesting hospital", render: (r) => <span className="text-[13px] text-[var(--dx-text)]">{r.requesting_tenant_name ?? partnerName.get(r.requesting_tenant_id) ?? `#${r.requesting_tenant_id}`}</span> },
    { key: "purpose", header: "Purpose", render: (r) => <span className={`block max-w-[14rem] truncate text-[13px] ${muted}`}>{r.purpose}</span> },
    { key: "status", header: "Status", align: "center", render: (r) => <DxBadge tone={reqTone[r.status]}>{r.status}</DxBadge> },
    {
      key: "actions", header: "", align: "right",
      render: (r) => r.status === "PENDING" ? (
        <DxButton size="sm" variant="primary" leftIcon={<ShieldCheck className="h-3.5 w-3.5" />} onClick={() => setApprove(r)}>Review</DxButton>
      ) : <span className={`text-[12px] ${muted}`}>—</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <DxTabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { key: "REFER_OUT", label: "Referrals sent", count: referOut.data?.length ?? 0 },
            { key: "REFER_IN", label: "Referrals received", count: referIn.data?.length ?? 0 },
            { key: "DATA_OUT", label: "Records requested", count: dataOut.data?.length ?? 0 },
            { key: "DATA_IN", label: "Incoming data requests", count: dataIn.data?.length ?? 0 },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <DxButton leftIcon={<Search className="h-4 w-4" />} onClick={() => setNewRequest(true)}>Request records</DxButton>
          <DxButton variant="primary" leftIcon={<Send className="h-4 w-4" />} onClick={() => setNewReferral(true)}>Refer a patient</DxButton>
        </div>
      </div>

      {tab === "REFER_OUT" ? (
        <DxGrid columns={referOutCols} data={referOut.data ?? []} rowKey={(r) => r.id} isLoading={referOut.isLoading}
          empty={{ icon: Send, title: "No referrals sent", description: "Refer a patient to another hospital to share their care." }} />
      ) : null}
      {tab === "REFER_IN" ? (
        <DxGrid columns={referInCols} data={referIn.data ?? []} rowKey={(r) => r.id} isLoading={referIn.isLoading}
          empty={{ icon: ArrowLeftRight, title: "No incoming referrals", description: "Referrals from other hospitals will appear here." }} />
      ) : null}
      {tab === "DATA_OUT" ? (
        <DxGrid columns={dataOutCols} data={dataOut.data ?? []} rowKey={(r) => r.id} isLoading={dataOut.isLoading}
          empty={{ icon: FileText, title: "No records requested", description: "Request a patient's records from the hospital that holds them." }} />
      ) : null}
      {tab === "DATA_IN" ? (
        <DxGrid columns={dataInCols} data={dataIn.data ?? []} rowKey={(r) => r.id} isLoading={dataIn.isLoading}
          empty={{ icon: ShieldCheck, title: "No incoming data requests", description: "When another hospital requests a patient's records, approve or deny it here." }} />
      ) : null}

      <NewReferralModal isOpen={newReferral} onClose={() => setNewReferral(false)} partners={partners.data ?? []} onSaved={invalidate} />
      <RequestRecordsModal isOpen={newRequest} onClose={() => setNewRequest(false)} partners={partners.data ?? []} onSaved={invalidate} />
      <RespondReferralModal referral={respondTo} onClose={() => setRespondTo(null)} onSaved={invalidate} />
      <ApproveRequestModal request={approve} onClose={() => setApprove(null)} onSaved={invalidate} />
      <ViewRecordModal request={viewRecord} onClose={() => setViewRecord(null)} />
      <ReferralRecordModal referral={viewReferralRecord} onClose={() => setViewReferralRecord(null)} onCreatePatient={(r) => { setViewReferralRecord(null); setImportReferral(r); }} />
      <CreatePatientFromReferralModal referral={importReferral} onClose={() => setImportReferral(null)} onCreated={invalidate} />
    </div>
  );
}

function NewReferralModal({ isOpen, onClose, partners, onSaved }: { isOpen: boolean; onClose: () => void; partners: PartnerTenant[]; onSaved: () => void }) {
  const toast = useToast();
  const [target, setTarget] = useState("");
  const [gid, setGid] = useState("");
  const [reason, setReason] = useState("");
  const [summary, setSummary] = useState("");
  const reset = () => { setTarget(""); setGid(""); setReason(""); setSummary(""); };
  const create = useMutation({
    mutationFn: () => interopReferralApi.create({
      target_tenant_id: Number(target), target_facility_id: 0,
      patient_global_id: gid.trim(), reason_for_referral: reason.trim(), clinical_summary: summary.trim() || undefined,
    }),
    onSuccess: () => { toast.success("Referral sent", "The receiving hospital has been notified."); onSaved(); onClose(); reset(); },
    onError: (e: any) => toast.error("Couldn't refer", apiErrorMessage(e, "Check the fields and try again.")),
  });
  function submit() {
    if (!target) return toast.error("Missing hospital", "Choose the hospital to refer to.");
    if (!gid.trim()) return toast.error("Missing patient", "Enter the patient's global ID.");
    if (!reason.trim()) return toast.error("Missing reason", "State the reason for referral.");
    create.mutate();
  }
  return (
    <DxPopup isOpen={isOpen} onClose={onClose} title="Refer a patient to another hospital" size="md" locked={create.isPending}
      footer={<><DxButton onClick={onClose} disabled={create.isPending}>Cancel</DxButton><DxButton variant="primary" leftIcon={<Send className="h-4 w-4" />} onClick={submit} isLoading={create.isPending}>Send referral</DxButton></>}>
      <div className="space-y-4">
        <DxSelect label="Refer to hospital" value={target} onChange={(e) => setTarget(e.target.value)}
          placeholder="— Select hospital —" options={partners.map((p) => ({ value: String(p.id), label: `${p.name} (${p.code})` }))} />
        <DxInput label="Patient global ID" mono value={gid} onChange={(e) => setGid(e.target.value)} placeholder="e.g. GPID-XXXX" hint="The patient's platform-wide global ID." />
        <DxTextarea label="Reason for referral" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        <DxTextarea label="Clinical summary (optional)" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
        <p className={`text-[11px] ${muted}`}>On acceptance, the receiving hospital is granted time-limited access to this patient's history.</p>
      </div>
    </DxPopup>
  );
}

function RequestRecordsModal({ isOpen, onClose, partners, onSaved }: { isOpen: boolean; onClose: () => void; partners: PartnerTenant[]; onSaved: () => void }) {
  const toast = useToast();
  const [holding, setHolding] = useState("");
  const [gid, setGid] = useState("");
  const [purpose, setPurpose] = useState("");
  const [name, setName] = useState("");
  const [checking, setChecking] = useState(false);
  const [lookup, setLookup] = useState<null | { found: boolean; display_name?: string | null }>(null);
  const reset = () => { setHolding(""); setGid(""); setPurpose(""); setName(""); setLookup(null); };
  async function doLookup() {
    if (!holding || !gid.trim()) return toast.error("Missing details", "Pick a hospital and enter the global ID first.");
    setChecking(true); setLookup(null);
    try {
      const r = await interopApi.lookupPatient(Number(holding), gid.trim());
      setLookup(r);
      if (r.found && r.display_name) setName(r.display_name);
      if (!r.found) toast.info("Not found", "No patient with that global ID at this hospital.");
    } catch { toast.error("Lookup failed", "Please try again."); }
    finally { setChecking(false); }
  }
  const create = useMutation({
    mutationFn: () => interopApi.createDataRequest({
      holding_tenant_id: Number(holding), patient_global_id: gid.trim(),
      patient_display_name: name.trim() || undefined, purpose: purpose.trim(),
    }),
    onSuccess: () => { toast.success("Request sent", "The holding hospital must confirm consent and approve before records are shared."); onSaved(); onClose(); reset(); },
    onError: (e: any) => toast.error("Couldn't request", apiErrorMessage(e, "Check the fields and try again.")),
  });
  function submit() {
    if (!holding) return toast.error("Missing hospital", "Choose the holding hospital.");
    if (!gid.trim()) return toast.error("Missing patient", "Enter the patient's global ID.");
    if (!purpose.trim()) return toast.error("Missing purpose", "State the clinical purpose.");
    create.mutate();
  }
  return (
    <DxPopup isOpen={isOpen} onClose={onClose} title="Request patient records" size="md" locked={create.isPending}
      footer={<><DxButton onClick={onClose} disabled={create.isPending}>Cancel</DxButton><DxButton variant="primary" onClick={submit} isLoading={create.isPending}>Send request</DxButton></>}>
      <div className="space-y-4">
        <DxSelect label="Holding hospital" value={holding} onChange={(e) => { setHolding(e.target.value); setLookup(null); }}
          placeholder="— Select hospital —" options={partners.map((p) => ({ value: String(p.id), label: `${p.name} (${p.code})` }))} />
        <div className="flex items-end gap-2">
          <div className="flex-1"><DxInput label="Patient global ID" mono value={gid} onChange={(e) => { setGid(e.target.value); setLookup(null); }} placeholder="e.g. GPID-XXXX" /></div>
          <DxButton onClick={doLookup} isLoading={checking} leftIcon={<Search className="h-4 w-4" />}>Verify</DxButton>
        </div>
        {lookup ? (
          <DxMessage tone={lookup.found ? "success" : "warning"}>
            {lookup.found ? `Found${lookup.display_name ? `: ${lookup.display_name}` : ""}` : "Not found at this hospital."}
          </DxMessage>
        ) : null}
        <DxTextarea label="Clinical purpose" rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Why the records are needed." />
        <p className={`text-[11px] ${muted}`}>The holding hospital must confirm the patient's consent and approve before any records are released.</p>
      </div>
    </DxPopup>
  );
}

function RespondReferralModal({ referral, onClose, onSaved }: { referral: InterFacilityReferral | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [days, setDays] = useState("30");
  const respond = useMutation({
    mutationFn: (status: "ACCEPTED" | "DECLINED") =>
      interopReferralApi.respond(referral!.id, { status, note: note.trim() || undefined, access_expiry_days: Number(days) || 30 }),
    onSuccess: (_d, status) => { toast.success(`Referral ${status.toLowerCase()}`); onSaved(); onClose(); setNote(""); },
    onError: (e: any) => toast.error("Couldn't respond", apiErrorMessage(e, "Please try again.")),
  });
  return (
    <DxPopup isOpen={referral !== null} onClose={onClose} title="Respond to referral" size="md" locked={respond.isPending}
      footer={
        <>
          <DxButton variant="outline-danger" onClick={() => respond.mutate("DECLINED")} isLoading={respond.isPending && respond.variables === "DECLINED"}>Decline</DxButton>
          <DxButton variant="primary" onClick={() => respond.mutate("ACCEPTED")} isLoading={respond.isPending && respond.variables === "ACCEPTED"}>Accept</DxButton>
        </>
      }>
      {referral ? (
        <div className="space-y-4">
          <div className="rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] p-3 text-[13px]">
            <p className={mono}>{referral.referral_no}</p>
            <p className={`mt-1 ${muted}`}>Patient <span className="dx-mono">{referral.patient_global_id}</span></p>
            <p className="mt-2 text-[var(--dx-text)]">{referral.reason_for_referral}</p>
            {referral.clinical_summary ? <p className={`mt-2 text-[12px] ${muted}`}>{referral.clinical_summary}</p> : null}
          </div>
          <DxInput label="Record access window (days)" type="number" min="1" max="365" value={days} onChange={(e) => setDays(e.target.value)} hint="On accept, you get read access to this patient's history for this many days." />
          <DxTextarea label="Note (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      ) : null}
    </DxPopup>
  );
}

function ApproveRequestModal({ request, onClose, onSaved }: { request: DataRequest | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [consent, setConsent] = useState(false);
  const [ref, setRef] = useState("");
  const [days, setDays] = useState("30");
  const [denyReason, setDenyReason] = useState("");
  const approve = useMutation({
    mutationFn: () => interopApi.approveRequest(request!.id, { consent_confirmed: consent, consent_reference: ref.trim(), access_expiry_days: Number(days) || 30 }),
    onSuccess: () => { toast.success("Approved", "The full record has been shared with the requesting hospital."); onSaved(); onClose(); setConsent(false); setRef(""); },
    onError: (e: any) => toast.error("Couldn't approve", apiErrorMessage(e, "Please try again.")),
  });
  const deny = useMutation({
    mutationFn: () => interopApi.denyRequest(request!.id, denyReason.trim() || "Denied."),
    onSuccess: () => { toast.success("Denied"); onSaved(); onClose(); setDenyReason(""); },
    onError: (e: any) => toast.error("Couldn't deny", apiErrorMessage(e, "Please try again.")),
  });
  function doApprove() {
    if (!consent) return toast.error("Consent required", "Confirm the patient has consented to this share.");
    if (!ref.trim()) return toast.error("Consent reference required", "Enter the recorded consent reference.");
    approve.mutate();
  }
  return (
    <DxPopup isOpen={request !== null} onClose={onClose} title="Review data request" size="md" locked={approve.isPending || deny.isPending}
      footer={
        <div className="flex w-full justify-between gap-2">
          <DxButton variant="outline-danger" onClick={() => deny.mutate()} isLoading={deny.isPending}>Deny</DxButton>
          <DxButton variant="primary" onClick={doApprove} isLoading={approve.isPending} leftIcon={<ShieldCheck className="h-4 w-4" />}>Confirm consent &amp; share</DxButton>
        </div>
      }>
      {request ? (
        <div className="space-y-4">
          <div className="rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] p-3 text-[13px]">
            <p className={mono}>{request.request_no}</p>
            <p className={`mt-1 ${muted}`}>Patient <span className="dx-mono">{request.patient_global_id}</span></p>
            <p className="mt-2 text-[var(--dx-text)]">From <b>{request.requesting_tenant_name ?? `#${request.requesting_tenant_id}`}</b> — {request.purpose}</p>
          </div>
          <DxCheckbox
            className="rounded-md border border-[var(--dx-border)] px-3 py-2.5"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            label={<span className="text-[13px] text-[var(--dx-text)]">I confirm this patient has <b>consented</b> to sharing their full record with the requesting hospital.</span>}
          />
          <DxInput label="Consent reference" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. CONSENT-2026-0012" hint="Reference to the recorded patient consent." />
          <DxInput label="Access window (days)" type="number" min="1" max="365" value={days} onChange={(e) => setDays(e.target.value)} />
          <div className="border-t border-[var(--dx-border)] pt-3">
            <DxTextarea label="Or deny with a reason" rows={2} value={denyReason} onChange={(e) => setDenyReason(e.target.value)} placeholder="Reason for denial (used only if you Deny)." />
          </div>
        </div>
      ) : null}
    </DxPopup>
  );
}

function BaselineChips({ patient }: { patient: any }) {
  if (!patient) return null;
  const items: [string, string | null | undefined][] = [
    ["Blood group", patient.blood_group],
    ["Genotype", patient.genotype],
    ["Gender", patient.gender],
    ["Date of birth", patient.date_of_birth],
    ["Allergies", patient.known_allergies ?? patient.allergies],
  ];
  const present = items.filter(([, v]) => v != null && String(v).trim() !== "");
  if (present.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {present.map(([label, value]) => (
        <span key={label} className="rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface)] px-2.5 py-1 text-[12px]">
          <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">{label}</span>
          <span className="font-semibold text-[var(--dx-text)]">{String(value)}</span>
        </span>
      ))}
    </div>
  );
}

function RecordSummary({ payload, counts, sections }: { payload: any; counts: Record<string, number>; sections: Record<string, any[]> }) {
  return (
    <div className="space-y-5">
      <div className="rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">Patient</p>
        <p className="text-[17px] font-bold text-[var(--dx-text)]">{(payload.patient?.first_name ?? "") + " " + (payload.patient?.last_name ?? "")}</p>
        <p className="dx-mono text-[12px] text-[var(--dx-text-muted)]">{payload.global_patient_id}</p>
        <BaselineChips patient={payload.patient} />
      </div>
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">Clinical history sections</p>
        {Object.keys(sections).length === 0 ? (
          <p className={`text-[13px] ${muted}`}>Demographics only — no additional clinical records on file.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries(counts).map(([name, n]) => (
              <div key={name} className="rounded-md border border-[var(--dx-border)] p-3">
                <p className="text-[18px] font-bold text-[var(--dx-text)]">{n}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">{name}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReferralRecordModal({ referral, onClose, onCreatePatient }: { referral: InterFacilityReferral | null; onClose: () => void; onCreatePatient?: (r: InterFacilityReferral) => void }) {
  const toast = useToast();
  const recordQuery = useQuery({
    queryKey: ["interop", "referral-record", referral?.id],
    queryFn: () => interopReferralApi.record(referral!.id),
    enabled: referral !== null,
    retry: 1,
  });
  const payload = recordQuery.data?.payload;
  const sections = (payload?.sections ?? {}) as Record<string, any[]>;
  const counts = (payload?.counts ?? {}) as Record<string, number>;
  function download() {
    if (!payload) return;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${referral?.referral_no ?? "referred-patient-record"}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Downloaded", "The referred patient's record was saved as JSON.");
  }
  return (
    <DxPopup isOpen={referral !== null} onClose={onClose} title="Referred patient record" size="lg"
      footer={<><DxButton onClick={onClose}>Close</DxButton><DxButton onClick={download} disabled={!payload} leftIcon={<Download className="h-4 w-4" />}>Download JSON</DxButton>{referral && onCreatePatient ? (<DxButton variant="primary" onClick={() => onCreatePatient(referral)} leftIcon={<UserPlus className="h-4 w-4" />}>Create patient record</DxButton>) : null}</>}>
      {recordQuery.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="dx-skeleton h-10 w-full" />)}</div>
      ) : recordQuery.isError ? (
        <p className="py-10 text-center text-[13px] font-semibold text-[var(--dx-danger)]">{apiErrorMessage(recordQuery.error, "Couldn't open the record — try again.")}</p>
      ) : !payload ? (
        <p className={`py-10 text-center ${muted}`}>No record available.</p>
      ) : (
        <div className="space-y-4">
          <RecordSummary payload={payload} counts={counts} sections={sections} />
          <p className={`text-[11px] ${muted}`}>
            Live record from the referring hospital under referral {recordQuery.data?.referral_no}
            {recordQuery.data?.access_expires_at ? ` — access expires ${fmt(recordQuery.data.access_expires_at)}` : ""}.
            Every access is security-audited.
          </p>
        </div>
      )}
    </DxPopup>
  );
}

function CreatePatientFromReferralModal({ referral, onClose, onCreated }: { referral: InterFacilityReferral | null; onClose: () => void; onCreated?: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState<Record<string, string>>({});
  const [seeded, setSeeded] = useState<number | null>(null);
  const [force, setForce] = useState(false);
  const [result, setResult] = useState<ReferralImportResult | null>(null);

  const previewQuery = useQuery({
    queryKey: ["interop", "import-preview", referral?.id],
    queryFn: () => interopReferralApi.importPreview(referral!.id),
    enabled: referral !== null,
    retry: 1,
  });
  const preview = previewQuery.data as ReferralImportPreview | undefined;
  const p = preview?.package?.patient ?? {};

  if (preview && seeded !== referral?.id) {
    const init: Record<string, string> = {};
    for (const k of EDITABLE_FIELDS) init[k] = (p?.[k] ?? "") as string;
    setForm(init);
    setSeeded(referral?.id ?? null);
  }
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const createMut = useMutation({
    mutationFn: () => {
      const overrides: Record<string, unknown> = {};
      for (const k of EDITABLE_FIELDS) {
        const v = (form[k] ?? "").trim();
        if (v !== "" && v !== ((p?.[k] ?? "") as string)) overrides[k] = v;
      }
      return interopReferralApi.createPatient(referral!.id, { overrides, force });
    },
    onSuccess: (res) => {
      setResult(res);
      toast.success("Patient registered", `Hospital No ${res.hospital_number} created from the referral.`);
      onCreated?.();
    },
    onError: (err) => toast.error("Import failed", apiErrorMessage(err, "Could not create the patient record.")),
  });

  const plan = preview?.plan;
  const dupes = preview?.possible_duplicates ?? [];
  const warnings = preview?.warnings ?? [];

  return (
    <DxPopup isOpen={referral !== null} onClose={onClose} title="Create patient record from referral" size="lg" locked={createMut.isPending}
      footer={result ? (
        <><DxButton onClick={onClose}>Done</DxButton><DxButton variant="primary" onClick={() => navigate(routes.patientDetail.replace(":patientId", String(result.patient_id)))} leftIcon={<Eye className="h-4 w-4" />}>Open patient</DxButton></>
      ) : (
        <><DxButton onClick={onClose} disabled={createMut.isPending}>Cancel</DxButton><DxButton variant="primary" onClick={() => createMut.mutate()} isLoading={createMut.isPending} disabled={!preview || preview.already_imported} leftIcon={<UserPlus className="h-4 w-4" />}>Create patient record</DxButton></>
      )}>
      {previewQuery.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="dx-skeleton h-10 w-full" />)}</div>
      ) : previewQuery.isError ? (
        <p className="py-10 text-center text-[13px] font-semibold text-[var(--dx-danger)]">{apiErrorMessage(previewQuery.error, "Couldn't load the import preview.")}</p>
      ) : result ? (
        <div className="space-y-4 py-4 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-[var(--dx-success)]" />
          <div>
            <p className="text-[17px] font-bold text-[var(--dx-text)]">{result.full_name}</p>
            <p className={`text-[13px] ${muted}`}>registered from referral {result.referral_no}</p>
          </div>
          <div className="mx-auto grid max-w-md grid-cols-2 gap-3 text-left">
            <div className="rounded-md border border-[var(--dx-border)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">Hospital number</p>
              <p className="dx-mono text-[13px] font-bold text-[var(--dx-text)]">{result.hospital_number}</p>
            </div>
            <div className="rounded-md border border-[var(--dx-border)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">Global patient ID</p>
              <p className="dx-mono text-[12px] font-semibold text-[var(--dx-text)]">{result.global_patient_id}</p>
            </div>
          </div>
          <div className="mx-auto flex max-w-md flex-wrap justify-center gap-2">
            {Object.entries(result.records_created ?? {}).map(([k, n]) => (
              <DxBadge key={k} tone="accent">{n} {k.replace(/_/g, " ")}</DxBadge>
            ))}
          </div>
        </div>
      ) : !preview ? (
        <p className={`py-10 text-center ${muted}`}>No referral package available.</p>
      ) : (
        <div className="space-y-5">
          {preview.already_imported ? (
            <DxMessage tone="warning">This patient has already been registered here from the referral (patient #{preview.existing_patient_id}).</DxMessage>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-[var(--dx-accent-soft)] bg-[var(--dx-accent-soft)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">New hospital number</p>
              <p className="dx-mono text-[13px] font-bold text-[var(--dx-accent)]">{plan?.next_hospital_number}</p>
            </div>
            <div className="rounded-md border border-[var(--dx-border)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">Preserved global ID</p>
              <p className="dx-mono text-[12px] font-semibold text-[var(--dx-text)]">{plan?.global_patient_id_preserved}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <DxBadge tone="success">Patient record</DxBadge>
            {plan?.will_create_baseline_profile ? <DxBadge tone="success">Baseline medical profile</DxBadge> : null}
            {(plan?.recent_visits_to_import ?? 0) > 0 ? <DxBadge tone="success">{plan?.recent_visits_to_import} recent visit(s)</DxBadge> : null}
            {Object.entries(plan?.clinical_records_available ?? {}).map(([k, n]) => (
              <DxBadge key={k} tone="neutral">{n} {k}</DxBadge>
            ))}
          </div>

          {warnings.length > 0 ? (
            <DxMessage tone="warning" title="Please review">
              <ul className="list-disc space-y-0.5 pl-5">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </DxMessage>
          ) : null}

          {dupes.length > 0 ? (
            <DxMessage tone="danger" title="Possible existing patients">
              <ul className="space-y-0.5">{dupes.map((d) => <li key={d.id}>{d.name} — {d.hospital_number}</li>)}</ul>
              <DxCheckbox className="mt-2 text-[12px] font-medium" checked={force} onChange={(e) => setForce(e.target.checked)} label="Register anyway (not a duplicate)" />
            </DxMessage>
          ) : null}

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">Review &amp; amend details</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {EDITABLE_LABELS.map(([k, label]) => (
                <DxInput key={k} label={label} value={form[k] ?? ""} onChange={set(k)} />
              ))}
            </div>
            <p className={`mt-2 text-[11px] ${muted}`}>Hospital-specific data (membership cards, the referring hospital's number, billing) is never imported. Every import is audited with full provenance.</p>
          </div>
        </div>
      )}
    </DxPopup>
  );
}

const EDITABLE_FIELDS = ["first_name", "last_name", "middle_name", "date_of_birth", "phone_number", "email", "address", "city", "state", "next_of_kin_name", "next_of_kin_phone", "emergency_contact_name", "emergency_contact_phone"];
const EDITABLE_LABELS: [string, string][] = [
  ["first_name", "First name"], ["last_name", "Last name"], ["middle_name", "Middle name"],
  ["date_of_birth", "Date of birth"], ["phone_number", "Phone"], ["email", "Email"],
  ["address", "Address"], ["city", "City"], ["state", "State"],
  ["next_of_kin_name", "Next of kin"], ["next_of_kin_phone", "Next of kin phone"],
  ["emergency_contact_name", "Emergency contact"], ["emergency_contact_phone", "Emergency phone"],
];

function ViewRecordModal({ request, onClose }: { request: DataRequest | null; onClose: () => void }) {
  const toast = useToast();
  const recordQuery = useQuery({
    queryKey: ["interop", "record", request?.id],
    queryFn: () => interopApi.retrieveRecord(request!.id),
    enabled: request !== null,
  });
  const payload = recordQuery.data?.payload;
  const sections = (payload?.sections ?? {}) as Record<string, any[]>;
  const counts = (payload?.counts ?? {}) as Record<string, number>;
  function download() {
    if (!payload) return;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${request?.request_no ?? "patient-record"}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Downloaded", "The shared record was saved as JSON.");
  }
  return (
    <DxPopup isOpen={request !== null} onClose={onClose} title="Shared patient record" size="lg"
      footer={<><DxButton onClick={onClose}>Close</DxButton><DxButton onClick={download} disabled={!payload} leftIcon={<Download className="h-4 w-4" />}>Download JSON</DxButton></>}>
      {recordQuery.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="dx-skeleton h-10 w-full" />)}</div>
      ) : !payload ? (
        <p className={`py-10 text-center ${muted}`}>No record available.</p>
      ) : (
        <div className="space-y-4">
          <RecordSummary payload={payload} counts={counts} sections={sections} />
          <p className={`text-[11px] ${muted}`}>Point-in-time export shared with your hospital under the patient's consent. Access reference: {recordQuery.data?.request_no}.</p>
        </div>
      )}
    </DxPopup>
  );
}
