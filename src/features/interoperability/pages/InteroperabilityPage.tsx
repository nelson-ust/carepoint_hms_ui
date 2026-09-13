import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  RefreshCw, Send, Download, ArrowLeftRight, Search,
  ShieldCheck, X, Eye, FileText, Building2, Hospital, UserRound, UserPlus, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { routes } from "@/config/routes";
import { facilitiesApi, type Facility } from "@/features/facilities/api/facilities.api";
import type { ReferralImportPreview, ReferralImportResult } from "../api/interoperability.api";
import { searchPatients } from "@/features/patients/api/patients.api";
import {
  interopApi, interopReferralApi, facilityReferralApi,
  type DataRequest, type DataRequestStatus, type InterFacilityReferral, type PartnerTenant,
} from "../api/interoperability.api";

type Mode = "INTERNAL" | "CROSS";
type Tab = "REFER_OUT" | "REFER_IN" | "DATA_OUT" | "DATA_IN";

const reqVariant: Record<DataRequestStatus, BadgeProps["variant"]> = {
  PENDING: "soft-warning", APPROVED: "soft-success", DENIED: "soft-danger",
  FULFILLED: "soft-success", EXPIRED: "secondary", CANCELLED: "secondary",
};
const refVariant: Record<string, BadgeProps["variant"]> = {
  PENDING: "soft-warning", ACCEPTED: "soft-success", DECLINED: "soft-danger",
  COMPLETED: "soft-success", CANCELLED: "secondary",
};

function fmt(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function InteroperabilityPage() {
  const [mode, setMode] = useState<Mode>("INTERNAL");
  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <PageHeader
        title="Interoperability"
        description="Move patients and records between your own facilities seamlessly, and exchange records with other hospitals on the platform under consent and approval."
      />
      <div className="flex items-center gap-1 bg-secondary-100/50 p-1 rounded-2xl w-fit">
        {([["INTERNAL", "Within My Hospital", Hospital], ["CROSS", "Across Hospitals", ArrowLeftRight]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setMode(key)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${mode === key ? "bg-white text-primary-600 shadow-sm" : "text-secondary-400 hover:text-secondary-600"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      {mode === "INTERNAL" ? <WithinHospital /> : <AcrossHospitals />}
    </div>
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

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-primary-500/5 border border-primary-100 px-5 py-4 text-sm text-secondary-600">
        Your facilities share one patient record. Referring a patient to another of your facilities is instant — the receiving
        facility can open the full record right away. No consent or export step is required within your hospital.
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-secondary-100/50 p-1 rounded-2xl w-fit">
          {([["IN", `Received (${incoming.data?.length ?? 0})`], ["OUT", `Sent (${outgoing.data?.length ?? 0})`]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${tab === k ? "bg-white text-primary-600 shadow-sm" : "text-secondary-400"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={() => { incoming.refetch(); outgoing.refetch(); }} className="btn-secondary p-3 rounded-2xl bg-white/80 border-secondary-400" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
          <Button leftIcon={<Send className="h-4 w-4" />} onClick={() => setReferOpen(true)}>Refer to a facility</Button>
        </div>
      </div>

      <TableCard
        loading={list.isLoading}
        empty={(list.data?.length ?? 0) === 0}
        emptyIcon={Building2}
        emptyTitle={tab === "IN" ? "No referrals to your facility" : "No referrals sent"}
        emptyText={tab === "IN" ? "Referrals from your other facilities appear here." : "Refer a patient to one of your other facilities."}
        head={["Referral", "Patient", tab === "IN" ? "From Facility" : "To Facility", "Reason", "Status", "Action"]}
      >
        {(list.data ?? []).map((r) => (
          <tr key={r.id} className="hover:bg-primary-50/20">
            <td className="px-6 py-4 font-mono font-bold text-secondary-900">{r.referral_no}</td>
            <td className="px-6 py-4 text-secondary-700">Patient #{r.patient_id}</td>
            <td className="px-6 py-4 text-secondary-700">
              {tab === "IN"
                ? (r.source_facility_id ? facName.get(r.source_facility_id) ?? `#${r.source_facility_id}` : "—")
                : (r.destination_facility_id ? facName.get(r.destination_facility_id) ?? r.destination_facility : r.destination_facility)}
            </td>
            <td className="px-6 py-4 text-secondary-500 max-w-[16rem] truncate">{r.reason_for_referral}</td>
            <td className="px-6 py-4"><Badge variant={refVariant[r.status] ?? "secondary"}>{r.status}</Badge></td>
            <td className="px-6 py-4">
              <div className="flex items-center justify-end gap-2">
                <Button size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => navigate(routes.patientDetail.replace(":patientId", String(r.patient_id)))}>
                  Open record
                </Button>
                {tab === "IN" && r.status === "PENDING" && (
                  <Button size="sm" variant="ghost" onClick={() => complete.mutate(r.id)}>Mark seen</Button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </TableCard>

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
    <Modal isOpen={isOpen} onClose={onClose} title="Refer to a Facility" size="md"
      footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} isLoading={create.isPending}>Send referral</Button></div>}>
      <div className="space-y-4">
        {patient ? (
          <div className="flex items-center justify-between rounded-2xl border border-secondary-200 bg-secondary-50 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-bold text-secondary-800"><UserRound className="h-4 w-4 text-primary-500" /> {patient.label}</span>
            <button onClick={() => setPatient(null)} className="rounded-lg p-1.5 hover:bg-rose-50"><X className="h-4 w-4 text-rose-400" /></button>
          </div>
        ) : (
          <div>
            <Input label="Find patient" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search name, hospital no. or phone…" />
            {term.trim().length >= 2 && (
              <div className="mt-2 max-h-52 overflow-y-auto rounded-2xl border border-secondary-100 divide-y divide-secondary-100">
                {results.isLoading ? (
                  <div className="p-3"><Skeleton className="h-6 w-full" /></div>
                ) : (results.data?.items ?? []).length === 0 ? (
                  <p className="p-3 text-xs text-secondary-400">No matches.</p>
                ) : (
                  (results.data?.items ?? []).map((p: any) => {
                    const label = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || `Patient #${p.id}`;
                    const sub = p.patient_number || p.hospital_number || p.global_patient_id || "";
                    return (
                      <button key={p.id} onClick={() => { setPatient({ id: p.id, label: sub ? `${label} · ${sub}` : label }); }}
                        className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-primary-50/40">
                        <span className="text-sm font-semibold text-secondary-800">{label}</span>
                        {sub ? <span className="font-mono text-[11px] text-secondary-400">{sub}</span> : null}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
        <Select label="Receiving facility" value={facility} onChange={(e) => setFacility(e.target.value)}
          options={[{ value: "", label: "— Select facility —" }, ...facilities.map((f) => ({ value: String(f.id), label: `${f.name} (${f.code})` }))]} />
        <Textarea label="Reason for referral" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        <Textarea label="Clinical note (optional)" rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} />
        <p className="text-[11px] text-secondary-400">The receiving facility shares this patient record — they can open it immediately on acceptance.</p>
      </div>
    </Modal>
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

  const tabs: [Tab, string, number][] = [
    ["REFER_OUT", "Referrals Sent", referOut.data?.length ?? 0],
    ["REFER_IN", "Referrals Received", referIn.data?.length ?? 0],
    ["DATA_OUT", "Records Requested", dataOut.data?.length ?? 0],
    ["DATA_IN", "Incoming Data Requests", dataIn.data?.length ?? 0],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 bg-secondary-100/50 p-1 rounded-2xl w-fit">
          {tabs.map(([key, label, count]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${tab === key ? "bg-white text-primary-600 shadow-sm" : "text-secondary-400 hover:text-secondary-600"}`}>
              {label} ({count})
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" leftIcon={<Search className="h-4 w-4" />} onClick={() => setNewRequest(true)}>Request Records</Button>
          <Button leftIcon={<Send className="h-5 w-5" />} onClick={() => setNewReferral(true)}>Refer a Patient</Button>
        </div>
      </div>

      {tab === "REFER_OUT" && (
        <TableCard loading={referOut.isLoading} empty={(referOut.data?.length ?? 0) === 0} emptyIcon={Send}
          emptyTitle="No referrals sent" emptyText="Refer a patient to another hospital to share their care."
          head={["Referral", "Patient (Global ID)", "To Hospital", "Reason", "Status", "Date"]}>
          {(referOut.data ?? []).map((r) => (
            <tr key={r.id} className="hover:bg-primary-50/20">
              <td className="px-6 py-4 font-mono font-bold text-secondary-900">{r.referral_no}</td>
              <td className="px-6 py-4 font-mono text-secondary-600">{r.patient_global_id}</td>
              <td className="px-6 py-4 text-secondary-700">{partnerName.get(r.target_tenant_id) ?? `#${r.target_tenant_id}`}</td>
              <td className="px-6 py-4 text-secondary-500 max-w-[16rem] truncate">{r.reason_for_referral}</td>
              <td className="px-6 py-4"><Badge variant={refVariant[r.status] ?? "secondary"}>{r.status}</Badge></td>
              <td className="px-6 py-4 text-secondary-500">{fmt(r.referral_date)}</td>
            </tr>
          ))}
        </TableCard>
      )}

      {tab === "REFER_IN" && (
        <TableCard loading={referIn.isLoading} empty={(referIn.data?.length ?? 0) === 0} emptyIcon={ArrowLeftRight}
          emptyTitle="No incoming referrals" emptyText="Referrals from other hospitals will appear here."
          head={["Referral", "Patient (Global ID)", "From Hospital", "Reason", "Status", "Action"]}>
          {(referIn.data ?? []).map((r) => (
            <tr key={r.id} className="hover:bg-primary-50/20">
              <td className="px-6 py-4 font-mono font-bold text-secondary-900">{r.referral_no}</td>
              <td className="px-6 py-4 font-mono text-secondary-600">{r.patient_global_id}</td>
              <td className="px-6 py-4 text-secondary-700">{partnerName.get(r.source_tenant_id) ?? `#${r.source_tenant_id}`}</td>
              <td className="px-6 py-4 text-secondary-500 max-w-[16rem] truncate">{r.reason_for_referral}</td>
              <td className="px-6 py-4"><Badge variant={refVariant[r.status] ?? "secondary"}>{r.status}</Badge></td>
              <td className="px-6 py-4 text-right">
                {r.status === "PENDING" ? (
                  <Button size="sm" onClick={() => setRespondTo(r)}>Respond</Button>
                ) : r.status === "ACCEPTED" && r.is_history_access_granted ? (
                  <Button size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />}
                    onClick={() => setViewReferralRecord(r)}>
                    Open record
                  </Button>
                ) : (
                  <span className="text-xs text-secondary-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </TableCard>
      )}

      {tab === "DATA_OUT" && (
        <TableCard loading={dataOut.isLoading} empty={(dataOut.data?.length ?? 0) === 0} emptyIcon={FileText}
          emptyTitle="No records requested" emptyText="Request a patient's records from the hospital that holds them."
          head={["Request", "Patient", "Holding Hospital", "Purpose", "Status", "Action"]}>
          {(dataOut.data ?? []).map((r) => (
            <tr key={r.id} className="hover:bg-primary-50/20">
              <td className="px-6 py-4 font-mono font-bold text-secondary-900">{r.request_no}</td>
              <td className="px-6 py-4">
                <span className="font-mono text-secondary-600">{r.patient_global_id}</span>
                {r.patient_display_name ? <p className="text-xs text-secondary-400">{r.patient_display_name}</p> : null}
              </td>
              <td className="px-6 py-4 text-secondary-700">{r.holding_tenant_name ?? partnerName.get(r.holding_tenant_id) ?? `#${r.holding_tenant_id}`}</td>
              <td className="px-6 py-4 text-secondary-500 max-w-[14rem] truncate">{r.purpose}</td>
              <td className="px-6 py-4"><Badge variant={reqVariant[r.status]}>{r.status}</Badge></td>
              <td className="px-6 py-4">
                <div className="flex items-center justify-end gap-2">
                  {(r.status === "APPROVED" || r.status === "FULFILLED") && (
                    <Button size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => setViewRecord(r)}>View record</Button>
                  )}
                  {(r.status === "PENDING" || r.status === "APPROVED") && (
                    <button onClick={() => cancelReq.mutate(r.id)} className="p-2 rounded-xl hover:bg-rose-50" title="Cancel"><X className="h-4 w-4 text-rose-400" /></button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </TableCard>
      )}

      {tab === "DATA_IN" && (
        <TableCard loading={dataIn.isLoading} empty={(dataIn.data?.length ?? 0) === 0} emptyIcon={ShieldCheck}
          emptyTitle="No incoming data requests" emptyText="When another hospital requests a patient's records, approve or deny it here."
          head={["Request", "Patient (Global ID)", "Requesting Hospital", "Purpose", "Status", "Action"]}>
          {(dataIn.data ?? []).map((r) => (
            <tr key={r.id} className="hover:bg-primary-50/20">
              <td className="px-6 py-4 font-mono font-bold text-secondary-900">{r.request_no}</td>
              <td className="px-6 py-4 font-mono text-secondary-600">{r.patient_global_id}</td>
              <td className="px-6 py-4 text-secondary-700">{r.requesting_tenant_name ?? partnerName.get(r.requesting_tenant_id) ?? `#${r.requesting_tenant_id}`}</td>
              <td className="px-6 py-4 text-secondary-500 max-w-[14rem] truncate">{r.purpose}</td>
              <td className="px-6 py-4"><Badge variant={reqVariant[r.status]}>{r.status}</Badge></td>
              <td className="px-6 py-4 text-right">
                {r.status === "PENDING" ? <Button size="sm" leftIcon={<ShieldCheck className="h-3.5 w-3.5" />} onClick={() => setApprove(r)}>Review</Button> : <span className="text-xs text-secondary-400">—</span>}
              </td>
            </tr>
          ))}
        </TableCard>
      )}

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

function TableCard({ loading, empty, emptyIcon: Icon, emptyTitle, emptyText, head, children }: {
  loading: boolean; empty: boolean; emptyIcon: any; emptyTitle: string; emptyText: string; head: string[]; children: React.ReactNode;
}) {
  return (
    <Card variant="panel" className="p-0 overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-secondary-900/5 text-[10px] font-bold uppercase tracking-widest text-secondary-500">
            {head.map((h, i) => <th key={i} className={`px-6 py-4 ${i === head.length - 1 ? "text-right" : ""}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-secondary-100/60">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={head.length} className="px-6 py-4"><Skeleton className="h-8 w-full" /></td></tr>)
          ) : empty ? (
            <tr><td colSpan={head.length} className="px-6 py-24 text-center">
              <Icon className="h-12 w-12 mx-auto text-secondary-200 mb-3" />
              <p className="font-bold text-secondary-900">{emptyTitle}</p>
              <p className="text-sm text-secondary-400 mt-1">{emptyText}</p>
            </td></tr>
          ) : children}
        </tbody>
      </table>
    </Card>
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
    <Modal isOpen={isOpen} onClose={onClose} title="Refer a Patient to Another Hospital" size="md"
      footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} isLoading={create.isPending}>Send referral</Button></div>}>
      <div className="space-y-4">
        <Select label="Refer to hospital" value={target} onChange={(e) => setTarget(e.target.value)}
          options={[{ value: "", label: "— Select hospital —" }, ...partners.map((p) => ({ value: String(p.id), label: `${p.name} (${p.code})` }))]} />
        <Input label="Patient global ID" value={gid} onChange={(e) => setGid(e.target.value)} placeholder="e.g. GPID-XXXX" hint="The patient's platform-wide global ID." />
        <Textarea label="Reason for referral" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        <Textarea label="Clinical summary (optional)" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
        <p className="text-[11px] text-secondary-400">On acceptance, the receiving hospital is granted time-limited access to this patient's history.</p>
      </div>
    </Modal>
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
    <Modal isOpen={isOpen} onClose={onClose} title="Request Patient Records" size="md"
      footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} isLoading={create.isPending}>Send request</Button></div>}>
      <div className="space-y-4">
        <Select label="Holding hospital" value={holding} onChange={(e) => { setHolding(e.target.value); setLookup(null); }}
          options={[{ value: "", label: "— Select hospital —" }, ...partners.map((p) => ({ value: String(p.id), label: `${p.name} (${p.code})` }))]} />
        <div className="flex items-end gap-3">
          <div className="flex-1"><Input label="Patient global ID" value={gid} onChange={(e) => { setGid(e.target.value); setLookup(null); }} placeholder="e.g. GPID-XXXX" /></div>
          <Button variant="secondary" onClick={doLookup} isLoading={checking} leftIcon={<Search className="h-4 w-4" />}>Verify</Button>
        </div>
        {lookup ? (
          lookup.found ? (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm font-bold text-emerald-700">✓ Found{lookup.display_name ? `: ${lookup.display_name}` : ""}</div>
          ) : (
            <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm font-bold text-amber-700">Not found at this hospital.</div>
          )
        ) : null}
        <Textarea label="Clinical purpose" rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Why the records are needed." />
        <p className="text-[11px] text-secondary-400">The holding hospital must confirm the patient's consent and approve before any records are released.</p>
      </div>
    </Modal>
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
    <Modal isOpen={referral !== null} onClose={onClose} title="Respond to Referral" size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => respond.mutate("DECLINED")} isLoading={respond.isPending && respond.variables === "DECLINED"}>Decline</Button>
          <Button onClick={() => respond.mutate("ACCEPTED")} isLoading={respond.isPending && respond.variables === "ACCEPTED"}>Accept</Button>
        </div>
      }>
      {referral ? (
        <div className="space-y-4">
          <div className="rounded-2xl bg-secondary-50 p-4 text-sm">
            <p className="font-bold text-secondary-900">{referral.referral_no}</p>
            <p className="text-secondary-500 mt-1">Patient <span className="font-mono">{referral.patient_global_id}</span></p>
            <p className="text-secondary-600 mt-2">{referral.reason_for_referral}</p>
            {referral.clinical_summary ? <p className="text-secondary-500 mt-2 text-xs">{referral.clinical_summary}</p> : null}
          </div>
          <Input label="Record access window (days)" type="number" min="1" max="365" value={days} onChange={(e) => setDays(e.target.value)} hint="On accept, you get read access to this patient's history for this many days." />
          <Textarea label="Note (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      ) : null}
    </Modal>
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
    <Modal isOpen={request !== null} onClose={onClose} title="Review Data Request" size="md"
      footer={
        <div className="flex justify-between gap-3 w-full">
          <Button variant="secondary" onClick={() => deny.mutate()} isLoading={deny.isPending}>Deny</Button>
          <Button onClick={doApprove} isLoading={approve.isPending} leftIcon={<ShieldCheck className="h-4 w-4" />}>Confirm consent &amp; share</Button>
        </div>
      }>
      {request ? (
        <div className="space-y-4">
          <div className="rounded-2xl bg-secondary-50 p-4 text-sm">
            <p className="font-bold text-secondary-900">{request.request_no}</p>
            <p className="text-secondary-500 mt-1">Patient <span className="font-mono">{request.patient_global_id}</span></p>
            <p className="text-secondary-600 mt-2">From <b>{request.requesting_tenant_name ?? `#${request.requesting_tenant_id}`}</b> — {request.purpose}</p>
          </div>
          <label className="flex items-start gap-3 rounded-2xl border border-secondary-200 px-4 py-3 cursor-pointer">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
            <span className="text-sm text-secondary-700">I confirm this patient has <b>consented</b> to sharing their full record with the requesting hospital.</span>
          </label>
          <Input label="Consent reference" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. CONSENT-2026-0012" hint="Reference to the recorded patient consent." />
          <Input label="Access window (days)" type="number" min="1" max="365" value={days} onChange={(e) => setDays(e.target.value)} />
          <div className="border-t border-secondary-100 pt-3">
            <Textarea label="Or deny with a reason" rows={2} value={denyReason} onChange={(e) => setDenyReason(e.target.value)} placeholder="Reason for denial (used only if you Deny)." />
          </div>
        </div>
      ) : null}
    </Modal>
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
        <span key={label}
          className="rounded-xl border border-primary-500/20 bg-white px-3 py-1.5 text-xs dark:bg-white/5">
          <span className="mr-1.5 font-black uppercase tracking-widest text-[9px] text-secondary-400">{label}</span>
          <span className="font-bold text-secondary-900 dark:text-secondary-100">{String(value)}</span>
        </span>
      ))}
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
    <Modal isOpen={referral !== null} onClose={onClose} title="Referred Patient Record" size="lg"
      footer={<div className="flex flex-wrap justify-end gap-3"><Button variant="secondary" onClick={onClose}>Close</Button><Button variant="secondary" onClick={download} disabled={!payload} leftIcon={<Download className="h-4 w-4" />}>Download JSON</Button>{referral && onCreatePatient ? (<Button onClick={() => onCreatePatient(referral)} leftIcon={<UserPlus className="h-4 w-4" />}>Create patient record</Button>) : null}</div>}>
      {recordQuery.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : recordQuery.isError ? (
        <p className="py-10 text-center text-sm text-rose-500 font-semibold">
          {apiErrorMessage(recordQuery.error, "Couldn't open the record — try again.")}
        </p>
      ) : !payload ? (
        <p className="py-10 text-center text-secondary-400">No record available.</p>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl bg-primary-500/5 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">Patient</p>
            <p className="text-lg font-black text-secondary-900">{(payload.patient?.first_name ?? "") + " " + (payload.patient?.last_name ?? "")}</p>
            <p className="text-xs font-mono text-secondary-500">{payload.global_patient_id}</p>
            <BaselineChips patient={payload.patient} />
          </div>
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-secondary-400">Clinical history sections</p>
            {Object.keys(sections).length === 0 ? (
              <p className="text-sm text-secondary-400">Demographics only — no additional clinical records on file.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(counts).map(([name, n]) => (
                  <div key={name} className="rounded-2xl border border-secondary-100 p-4">
                    <p className="text-xl font-black text-secondary-900">{n}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">{name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-[11px] text-secondary-400">
            Live record from the referring hospital under referral {recordQuery.data?.referral_no}
            {recordQuery.data?.access_expires_at ? ` — access expires ${fmt(recordQuery.data.access_expires_at)}` : ""}.
            Every access is security-audited.
          </p>
        </div>
      )}
    </Modal>
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

  // Seed the editable form once per referral.
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
    <Modal isOpen={referral !== null} onClose={onClose} title="Create Patient Record from Referral" size="lg"
      footer={result ? (
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Done</Button>
          <Button onClick={() => navigate(routes.patientDetail.replace(":patientId", String(result.patient_id)))} leftIcon={<Eye className="h-4 w-4" />}>Open patient</Button>
        </div>
      ) : (
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => createMut.mutate()} isLoading={createMut.isPending} disabled={!preview || preview.already_imported}
            leftIcon={<UserPlus className="h-4 w-4" />}>Create patient record</Button>
        </div>
      )}>
      {previewQuery.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : previewQuery.isError ? (
        <p className="py-10 text-center text-sm font-semibold text-rose-500">{apiErrorMessage(previewQuery.error, "Couldn't load the import preview.")}</p>
      ) : result ? (
        <div className="space-y-4 py-4 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <div>
            <p className="text-lg font-black text-secondary-900">{result.full_name}</p>
            <p className="text-sm text-secondary-500">registered from referral {result.referral_no}</p>
          </div>
          <div className="mx-auto grid max-w-md grid-cols-2 gap-3 text-left">
            <div className="rounded-2xl border border-secondary-100 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">Hospital number</p>
              <p className="data-mono text-sm font-black text-secondary-900">{result.hospital_number}</p>
            </div>
            <div className="rounded-2xl border border-secondary-100 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">Global patient ID</p>
              <p className="data-mono text-xs font-bold text-secondary-700">{result.global_patient_id}</p>
            </div>
          </div>
          <div className="mx-auto flex max-w-md flex-wrap justify-center gap-2">
            {Object.entries(result.records_created ?? {}).map(([k, n]) => (
              <span key={k} className="rounded-full bg-primary-500/10 px-3 py-1 text-[11px] font-bold text-primary-600">{n} {k.replace(/_/g, " ")}</span>
            ))}
          </div>
        </div>
      ) : !preview ? (
        <p className="py-10 text-center text-secondary-400">No referral package available.</p>
      ) : (
        <div className="space-y-5">
          {preview.already_imported ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700">
              This patient has already been registered here from the referral (patient #{preview.existing_patient_id}).
            </div>
          ) : null}

          {/* Import plan */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-primary-100 bg-primary-500/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">New hospital number</p>
              <p className="data-mono text-sm font-black text-primary-700">{plan?.next_hospital_number}</p>
            </div>
            <div className="rounded-2xl border border-secondary-100 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">Preserved global ID</p>
              <p className="data-mono text-xs font-bold text-secondary-700">{plan?.global_patient_id_preserved}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-600">Patient record</span>
            {plan?.will_create_baseline_profile ? <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-600">Baseline medical profile</span> : null}
            {(plan?.recent_visits_to_import ?? 0) > 0 ? <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-600">{plan?.recent_visits_to_import} recent visit(s)</span> : null}
            {Object.entries(plan?.clinical_records_available ?? {}).map(([k, n]) => (
              <span key={k} className="rounded-full bg-secondary-500/10 px-3 py-1 text-secondary-500">{n} {k}</span>
            ))}
          </div>

          {warnings.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> Please review</p>
              <ul className="list-disc space-y-0.5 pl-5 text-sm text-amber-700">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          ) : null}

          {dupes.length > 0 ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="mb-1 text-xs font-black uppercase tracking-widest text-rose-600">Possible existing patients</p>
              <ul className="space-y-0.5 text-sm text-rose-700">{dupes.map((d) => <li key={d.id}>{d.name} — {d.hospital_number}</li>)}</ul>
              <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-rose-700">
                <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> Register anyway (not a duplicate)
              </label>
            </div>
          ) : null}

          {/* Editable review form */}
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-secondary-400">Review &amp; amend details</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {EDITABLE_LABELS.map(([k, label]) => (
                <label key={k} className="text-xs font-bold text-secondary-500">{label}
                  <Input value={form[k] ?? ""} onChange={set(k)} className="mt-1" />
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-secondary-400">Hospital-specific data (membership cards, the referring hospital's number, billing) is never imported. Every import is audited with full provenance.</p>
          </div>
        </div>
      )}
    </Modal>
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
    <Modal isOpen={request !== null} onClose={onClose} title="Shared Patient Record" size="lg"
      footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose}>Close</Button><Button onClick={download} disabled={!payload} leftIcon={<Download className="h-4 w-4" />}>Download JSON</Button></div>}>
      {recordQuery.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : !payload ? (
        <p className="py-10 text-center text-secondary-400">No record available.</p>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl bg-primary-500/5 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">Patient</p>
            <p className="text-lg font-black text-secondary-900">{(payload.patient?.first_name ?? "") + " " + (payload.patient?.last_name ?? "")}</p>
            <p className="text-xs font-mono text-secondary-500">{payload.global_patient_id}</p>
            <BaselineChips patient={payload.patient} />
          </div>
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-secondary-400">Included sections</p>
            {Object.keys(sections).length === 0 ? (
              <p className="text-sm text-secondary-400">Demographics only — no additional clinical records on file.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(counts).map(([name, n]) => (
                  <div key={name} className="rounded-2xl border border-secondary-100 p-4">
                    <p className="text-xl font-black text-secondary-900">{n}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">{name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-[11px] text-secondary-400">Point-in-time export shared with your hospital under the patient's consent. Access reference: {recordQuery.data?.request_no}.</p>
        </div>
      )}
    </Modal>
  );
}
