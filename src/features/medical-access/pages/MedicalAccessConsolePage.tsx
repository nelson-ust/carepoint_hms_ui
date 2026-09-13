import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, RefreshCw, ShieldCheck, Check, X, Ban, FileText, Eye, Clock, ScrollText,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { medicalAccessApi, type AccessRequest, type AuditEvent, type MedicalRecord } from "../api/medicalAccess.api";
import { RecordView } from "./RecordView";

function fmt(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString(undefined,
    { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusVariant(s: string): any {
  return s === "APPROVED" ? "success" : s === "PENDING" ? "warning"
    : s === "FULFILLED" ? "info" : "destructive";
}
function decisionVariant(s: string): any {
  return s === "APPROVED" ? "soft-success" : s === "DECLINED" ? "soft-danger" : "soft-warning";
}

export function MedicalAccessConsolePage() {
  const toast = useToast();
  const qc = useQueryClient();
  const params = new URLSearchParams(window.location.search);
  const [tab, setTab] = useState<"incoming" | "outgoing">(params.get("tab") === "outgoing" ? "outgoing" : "incoming");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [decideFor, setDecideFor] = useState<{ req: AccessRequest; approve: boolean } | null>(null);
  const [reason, setReason] = useState("");
  const [auditFor, setAuditFor] = useState<AccessRequest | null>(null);
  const [record, setRecord] = useState<{ req: AccessRequest; data: MedicalRecord } | null>(null);

  const list = useQuery({ queryKey: ["mra", tab], queryFn: () => medicalAccessApi.list(tab) });
  const audit = useQuery({
    queryKey: ["mra-audit", auditFor?.id],
    queryFn: () => medicalAccessApi.audit(auditFor!.id),
    enabled: !!auditFor,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["mra"] });

  const decide = useMutation({
    mutationFn: () => medicalAccessApi.hospitalDecision(decideFor!.req.id, decideFor!.approve, reason || undefined),
    onSuccess: () => { invalidate(); setDecideFor(null); setReason(""); toast.success("Decision recorded"); },
    onError: (e: any) => toast.error("Couldn't record decision", medicalAccessApi.errMsg(e, "")),
  });
  const cancel = useMutation({
    mutationFn: (id: number) => medicalAccessApi.cancel(id),
    onSuccess: () => { invalidate(); toast.success("Request cancelled"); },
    onError: (e: any) => toast.error("Couldn't cancel", medicalAccessApi.errMsg(e, "")),
  });
  const open = useMutation({
    mutationFn: (req: AccessRequest) => medicalAccessApi.retrieve(req.id).then((data) => ({ req, data })),
    onSuccess: (res) => { invalidate(); setRecord(res); },
    onError: (e: any) => toast.error("Couldn't open records", medicalAccessApi.errMsg(e, "")),
  });

  const items = list.data ?? [];

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader title="Medical Record Sharing" description="Request and authorize consent-gated access to patients' medical histories, with secure one-time links." />
        <div className="flex gap-3">
          <button onClick={() => list.refetch()} className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${list.isFetching ? "animate-spin" : ""}`} />
          </button>
          <Button leftIcon={<Plus className="h-5 w-5" />} onClick={() => setSubmitOpen(true)}>New request</Button>
        </div>
      </div>

      <div className="flex gap-2">
        {(["incoming", "outgoing"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === t ? "bg-primary-600 text-white" : "bg-secondary-100 text-secondary-600"}`}>
            {t === "incoming" ? "Incoming (as primary hospital)" : "Outgoing (our requests)"}
          </button>
        ))}
      </div>

      {list.isLoading ? <Skeleton className="h-32 w-full" /> : items.length === 0 ? (
        <Card className="p-10 text-center text-secondary-500">
          <ShieldCheck className="h-8 w-8 mx-auto mb-3 opacity-40" />
          {tab === "incoming" ? "No hospital has requested access to your patients' records yet."
            : "You haven't requested any patient records from other hospitals yet."}
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{r.patient_display_name || r.patient_global_id}</span>
                    <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                    <Badge variant="secondary">{r.scope.replace(/_/g, " ")}</Badge>
                    <span className="text-xs font-mono text-secondary-400">{r.request_no}</span>
                  </div>
                  <p className="text-sm text-secondary-500">
                    {tab === "incoming" ? "Requested by " : "Requested from hospital · "}
                    <strong>{r.requester_name}</strong>{r.requester_type === "DEVELOPER" ? " (developer)" : ""} · {fmt(r.requested_at)}
                  </p>
                  <p className="text-sm text-secondary-600 italic">“{r.reason}”</p>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {r.requires_patient_approval && <Badge variant={decisionVariant(r.patient_decision)}>Patient: {r.patient_decision}</Badge>}
                    {r.requires_hospital_approval && <Badge variant={decisionVariant(r.hospital_decision)}>Hospital: {r.hospital_decision}</Badge>}
                    {r.status === "APPROVED" && r.link_expires_at && (
                      <Badge variant="soft-info"><Clock className="h-3 w-3 mr-1 inline" />Link expires {fmt(r.link_expires_at)}</Badge>
                    )}
                    {r.link_used_at && <Badge variant="soft-info">Link used {fmt(r.link_used_at)}</Badge>}
                  </div>
                  {r.decline_reason && <p className="text-xs text-rose-600">Decline reason: {r.decline_reason}</p>}
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  {tab === "incoming" && r.status === "PENDING" && r.hospital_decision === "PENDING" && (
                    <>
                      <Button size="sm" leftIcon={<Check className="h-3.5 w-3.5" />} onClick={() => { setReason(""); setDecideFor({ req: r, approve: true }); }}>Approve</Button>
                      <Button size="sm" variant="danger" leftIcon={<X className="h-3.5 w-3.5" />} onClick={() => { setReason(""); setDecideFor({ req: r, approve: false }); }}>Decline</Button>
                    </>
                  )}
                  {tab === "outgoing" && r.status === "APPROVED" && !r.link_used_at && (
                    <Button size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />} isLoading={open.isPending} onClick={() => open.mutate(r)}>Open records</Button>
                  )}
                  {tab === "outgoing" && (r.status === "PENDING" || r.status === "APPROVED") && (
                    <Button size="sm" variant="secondary" leftIcon={<Ban className="h-3.5 w-3.5" />} onClick={() => cancel.mutate(r.id)}>Cancel</Button>
                  )}
                  <Button size="sm" variant="secondary" leftIcon={<ScrollText className="h-3.5 w-3.5" />} onClick={() => setAuditFor(r)}>Audit</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Submit modal */}
      <SubmitModal open={submitOpen} onClose={() => setSubmitOpen(false)}
        onDone={() => { setSubmitOpen(false); setTab("outgoing"); invalidate(); }} />

      {/* Decision modal */}
      <Modal isOpen={!!decideFor} onClose={() => setDecideFor(null)} title={decideFor?.approve ? "Approve access" : "Decline access"}>
        <div className="space-y-4">
          <p className="text-sm text-secondary-600">
            {decideFor?.approve
              ? "Approving records your hospital's authorization. Once every required party approves, a secure one-time link is issued to the requester."
              : "Declining stops this request. No records will be shared."}
          </p>
          <Textarea label={decideFor?.approve ? "Note (optional)" : "Reason (optional)"} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-3">
            <Button isLoading={decide.isPending} variant={decideFor?.approve ? "primary" : "danger"} onClick={() => decide.mutate()}>
              {decideFor?.approve ? "Approve" : "Decline"}
            </Button>
            <Button variant="secondary" onClick={() => setDecideFor(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Audit modal */}
      <Modal isOpen={!!auditFor} onClose={() => setAuditFor(null)} title={`Audit trail — ${auditFor?.request_no ?? ""}`} size="lg">
        {audit.isLoading ? <Skeleton className="h-40 w-full" /> : (
          <ol className="relative border-l border-secondary-200 ml-2 space-y-4">
            {(audit.data ?? []).map((a: AuditEvent) => (
              <li key={a.id} className="ml-4">
                <div className="absolute -left-1.5 h-3 w-3 rounded-full bg-primary-500" />
                <p className="text-sm font-semibold">{a.event.replace(/_/g, " ")}</p>
                <p className="text-xs text-secondary-500">
                  {a.actor_type}{a.actor_display ? ` · ${a.actor_display}` : ""} · {fmt(a.occurred_at)}
                </p>
                {a.detail && <p className="text-xs text-secondary-600 mt-0.5">{a.detail}</p>}
              </li>
            ))}
          </ol>
        )}
      </Modal>

      {/* Record viewer modal */}
      <Modal isOpen={!!record} onClose={() => setRecord(null)} title={`Records — ${record?.req.patient_display_name ?? ""}`} size="2xl">
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4" /> One-time read-only access. This link is now spent and cannot be reopened.
        </div>
        {record && <RecordView data={record.data} />}
      </Modal>
    </div>
  );
}

function SubmitModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    holding_tenant_code: "", patient_global_id: "", reason: "",
    scope: "MEDICAL_HISTORY", link_expiry_hours: "24",
    requires_patient_approval: true, requires_hospital_approval: true,
  });
  const submit = useMutation({
    mutationFn: () => medicalAccessApi.submit({
      holding_tenant_code: f.holding_tenant_code, patient_global_id: f.patient_global_id,
      reason: f.reason, scope: f.scope,
      link_expiry_hours: f.link_expiry_hours ? Number(f.link_expiry_hours) : undefined,
      requires_patient_approval: f.requires_patient_approval,
      requires_hospital_approval: f.requires_hospital_approval,
    }),
    onSuccess: () => { toast.success("Request submitted", "The patient and their hospital have been notified."); onDone(); },
    onError: (e: any) => toast.error("Couldn't submit", medicalAccessApi.errMsg(e, "")),
  });

  return (
    <Modal isOpen={open} onClose={onClose} title="Request patient medical history">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}>
        <Input label="Primary hospital code" required value={f.holding_tenant_code}
          onChange={(e) => setF({ ...f, holding_tenant_code: e.target.value })} placeholder="e.g. STNICH" />
        <Input label="Patient global ID" required value={f.patient_global_id}
          onChange={(e) => setF({ ...f, patient_global_id: e.target.value })} placeholder="GPID-..." />
        <Textarea label="Reason (continuity of care)" required rows={3} value={f.reason}
          onChange={(e) => setF({ ...f, reason: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Scope" value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })}>
            <option value="MEDICAL_HISTORY">Medical history</option>
            <option value="BASELINE_DIAGNOSTICS">Baseline diagnostics</option>
          </Select>
          <Input label="Link expiry (hours)" type="number" min={1} max={168} value={f.link_expiry_hours}
            onChange={(e) => setF({ ...f, link_expiry_hours: e.target.value })} />
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.requires_patient_approval} onChange={(e) => setF({ ...f, requires_patient_approval: e.target.checked })} />
            Require patient approval
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.requires_hospital_approval} onChange={(e) => setF({ ...f, requires_hospital_approval: e.target.checked })} />
            Require primary-hospital approval
          </label>
        </div>
        <Button type="submit" isLoading={submit.isPending}>Submit request</Button>
      </form>
    </Modal>
  );
}
