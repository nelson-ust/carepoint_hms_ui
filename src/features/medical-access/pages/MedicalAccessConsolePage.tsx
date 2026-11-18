import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, RotateCcw, ShieldCheck, Check, X, Ban, FileText, Eye, Clock, ScrollText,
  Inbox, Send, CircleCheck, FileCheck,
} from "lucide-react";
import {
  DxPage, DxPageHeader, DxSegmented, DxGrid, DxKpi, DxBadge, DxButton, DxPopup,
  DxInput, DxSelect, DxTextarea, DxCheckbox, DxMessage,
  type DxGridColumn, type DxBadgeTone,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { medicalAccessApi, type AccessRequest, type AuditEvent, type MedicalRecord } from "../api/medicalAccess.api";
import { RecordView } from "./RecordView";

function fmt(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString(undefined,
    { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const statusTone: Record<string, DxBadgeTone> = {
  APPROVED: "success", PENDING: "warning", FULFILLED: "info",
  DECLINED: "danger", EXPIRED: "neutral", CANCELLED: "neutral",
};
const decisionTone: Record<string, DxBadgeTone> = {
  APPROVED: "success", DECLINED: "danger", PENDING: "warning",
};

const muted = "text-[var(--dx-text-muted)]";

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

  const items = useMemo(() => list.data ?? [], [list.data]);
  const counts = useMemo(() => ({
    total: items.length,
    pending: items.filter((r) => r.status === "PENDING").length,
    approved: items.filter((r) => r.status === "APPROVED").length,
    fulfilled: items.filter((r) => r.status === "FULFILLED").length,
  }), [items]);

  const columns: DxGridColumn<AccessRequest>[] = [
    {
      key: "patient", header: "Patient / request",
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[var(--dx-text)]">{r.patient_display_name || r.patient_global_id}</div>
          <div className="dx-mono text-[11px] text-[var(--dx-text-muted)]">{r.request_no}</div>
          {r.reason ? <div className={`mt-0.5 max-w-[18rem] truncate text-[11.5px] italic ${muted}`}>“{r.reason}”</div> : null}
        </div>
      ),
    },
    { key: "status", header: "Status", align: "center", render: (r) => <DxBadge tone={statusTone[r.status] ?? "neutral"}>{r.status}</DxBadge> },
    { key: "scope", header: "Scope", align: "center", render: (r) => <DxBadge tone="neutral">{r.scope.replace(/_/g, " ")}</DxBadge> },
    {
      key: "requester", header: tab === "incoming" ? "Requested by" : "Requested from",
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] text-[var(--dx-text)]">{r.requester_name}{r.requester_type === "DEVELOPER" ? " (developer)" : ""}</div>
          <div className={`text-[11px] ${muted}`}>{fmt(r.requested_at)}</div>
        </div>
      ),
    },
    {
      key: "consent", header: "Consent & link",
      render: (r) => (
        <div className="flex flex-wrap gap-1.5">
          {r.requires_patient_approval ? <DxBadge tone={decisionTone[r.patient_decision] ?? "neutral"}>Patient: {r.patient_decision}</DxBadge> : null}
          {r.requires_hospital_approval ? <DxBadge tone={decisionTone[r.hospital_decision] ?? "neutral"}>Hospital: {r.hospital_decision}</DxBadge> : null}
          {r.status === "APPROVED" && r.link_expires_at ? <DxBadge tone="info"><Clock className="mr-1 inline h-3 w-3" />Expires {fmt(r.link_expires_at)}</DxBadge> : null}
          {r.link_used_at ? <DxBadge tone="neutral">Link used</DxBadge> : null}
          {r.decline_reason ? <span className="w-full text-[11px] text-[var(--dx-danger)]">Decline: {r.decline_reason}</span> : null}
        </div>
      ),
    },
    {
      key: "actions", header: "", align: "right",
      render: (r) => (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {tab === "incoming" && r.status === "PENDING" && r.hospital_decision === "PENDING" ? (
            <>
              <DxButton size="sm" variant="primary" leftIcon={<Check className="h-3.5 w-3.5" />} onClick={() => { setReason(""); setDecideFor({ req: r, approve: true }); }}>Approve</DxButton>
              <DxButton size="sm" variant="danger" leftIcon={<X className="h-3.5 w-3.5" />} onClick={() => { setReason(""); setDecideFor({ req: r, approve: false }); }}>Decline</DxButton>
            </>
          ) : null}
          {tab === "outgoing" && r.status === "APPROVED" && !r.link_used_at ? (
            <DxButton size="sm" variant="primary" leftIcon={<Eye className="h-3.5 w-3.5" />} isLoading={open.isPending} onClick={() => open.mutate(r)}>Open records</DxButton>
          ) : null}
          {tab === "outgoing" && (r.status === "PENDING" || r.status === "APPROVED") ? (
            <DxButton size="sm" variant="outline-danger" leftIcon={<Ban className="h-3.5 w-3.5" />} onClick={() => cancel.mutate(r.id)}>Cancel</DxButton>
          ) : null}
          <DxButton size="sm" leftIcon={<ScrollText className="h-3.5 w-3.5" />} onClick={() => setAuditFor(r)}>Audit</DxButton>
        </div>
      ),
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Medical access" }]}
        title="Medical Record Sharing"
        subtitle="Request and authorize consent-gated access to patients' medical histories, with secure one-time links."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={() => list.refetch()} isLoading={list.isFetching}><RotateCcw /></DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setSubmitOpen(true)}>New request</DxButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DxKpi label={tab === "incoming" ? "Incoming" : "Outgoing"} value={counts.total} icon={tab === "incoming" ? Inbox : Send} tone="accent" sub="requests in view" />
        <DxKpi label="Pending" value={counts.pending} icon={Clock} tone={counts.pending > 0 ? "warning" : "neutral"} sub="awaiting a decision" />
        <DxKpi label="Approved" value={counts.approved} icon={CircleCheck} tone="success" sub="link issued or ready" />
        <DxKpi label="Fulfilled" value={counts.fulfilled} icon={FileCheck} tone="info" sub="records retrieved" />
      </div>

      <DxSegmented<"incoming" | "outgoing">
        value={tab}
        onChange={setTab}
        ariaLabel="Request direction"
        items={[
          { key: "incoming", label: "Incoming (as primary hospital)", icon: <Inbox className="h-4 w-4" /> },
          { key: "outgoing", label: "Outgoing (our requests)", icon: <Send className="h-4 w-4" /> },
        ]}
      />

      <DxGrid
        columns={columns}
        data={items}
        rowKey={(r) => r.id}
        isLoading={list.isLoading}
        empty={{
          icon: ShieldCheck,
          title: tab === "incoming" ? "No incoming access requests" : "No outgoing requests",
          description: tab === "incoming"
            ? "No hospital has requested access to your patients' records yet."
            : "You haven't requested any patient records from other hospitals yet.",
        }}
      />

      <SubmitModal open={submitOpen} onClose={() => setSubmitOpen(false)}
        onDone={() => { setSubmitOpen(false); setTab("outgoing"); invalidate(); }} />

      {/* Decision modal */}
      <DxPopup isOpen={!!decideFor} onClose={() => setDecideFor(null)} title={decideFor?.approve ? "Approve access" : "Decline access"} locked={decide.isPending}
        footer={
          <>
            <DxButton onClick={() => setDecideFor(null)} disabled={decide.isPending}>Cancel</DxButton>
            <DxButton isLoading={decide.isPending} variant={decideFor?.approve ? "primary" : "danger"} onClick={() => decide.mutate()}>
              {decideFor?.approve ? "Approve" : "Decline"}
            </DxButton>
          </>
        }>
        <div className="space-y-4">
          <DxMessage tone={decideFor?.approve ? "info" : "warning"}>
            {decideFor?.approve
              ? "Approving records your hospital's authorization. Once every required party approves, a secure one-time link is issued to the requester."
              : "Declining stops this request. No records will be shared."}
          </DxMessage>
          <DxTextarea label={decideFor?.approve ? "Note (optional)" : "Reason (optional)"} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </DxPopup>

      {/* Audit modal */}
      <DxPopup isOpen={!!auditFor} onClose={() => setAuditFor(null)} title={`Audit trail — ${auditFor?.request_no ?? ""}`} size="lg">
        {audit.isLoading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="dx-skeleton h-10 w-full" />)}</div>
        ) : (audit.data ?? []).length === 0 ? (
          <p className={`py-10 text-center text-[13px] ${muted}`}>No audit events recorded yet.</p>
        ) : (
          <ol className="relative ml-2 space-y-4 border-l border-[var(--dx-border)]">
            {(audit.data ?? []).map((a: AuditEvent) => (
              <li key={a.id} className="ml-4">
                <div className="absolute -left-[5px] mt-1 h-2.5 w-2.5 rounded-full bg-[var(--dx-accent)]" />
                <p className="text-[13px] font-semibold text-[var(--dx-text)]">{a.event.replace(/_/g, " ")}</p>
                <p className={`text-[11.5px] ${muted}`}>
                  {a.actor_type}{a.actor_display ? ` · ${a.actor_display}` : ""} · {fmt(a.occurred_at)}
                </p>
                {a.detail ? <p className={`mt-0.5 text-[11.5px] ${muted}`}>{a.detail}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </DxPopup>

      {/* Record viewer modal */}
      <DxPopup isOpen={!!record} onClose={() => setRecord(null)} title={`Records — ${record?.req.patient_display_name ?? ""}`} size="xl">
        <div className="space-y-4">
          <DxMessage tone="warning" title="One-time read-only access">
            This link is now spent and cannot be reopened.
          </DxMessage>
          {record ? <RecordView data={record.data} /> : null}
        </div>
      </DxPopup>
    </DxPage>
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
    <DxPopup isOpen={open} onClose={onClose} title="Request patient medical history" locked={submit.isPending}
      footer={
        <>
          <DxButton onClick={onClose} disabled={submit.isPending}>Cancel</DxButton>
          <DxButton variant="primary" isLoading={submit.isPending}
            disabled={!f.holding_tenant_code.trim() || !f.patient_global_id.trim() || !f.reason.trim()}
            onClick={() => submit.mutate()}>Submit request</DxButton>
        </>
      }>
      <div className="space-y-4">
        <DxInput label="Primary hospital code" required value={f.holding_tenant_code}
          onChange={(e) => setF({ ...f, holding_tenant_code: e.target.value })} placeholder="e.g. STNICH" />
        <DxInput label="Patient global ID" mono required value={f.patient_global_id}
          onChange={(e) => setF({ ...f, patient_global_id: e.target.value })} placeholder="GPID-…" />
        <DxTextarea label="Reason (continuity of care)" required rows={3} value={f.reason}
          onChange={(e) => setF({ ...f, reason: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <DxSelect label="Scope" value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })}
            options={[{ value: "MEDICAL_HISTORY", label: "Medical history" }, { value: "BASELINE_DIAGNOSTICS", label: "Baseline diagnostics" }]} />
          <DxInput label="Link expiry (hours)" type="number" min={1} max={168} value={f.link_expiry_hours}
            onChange={(e) => setF({ ...f, link_expiry_hours: e.target.value })} />
        </div>
        <div className="space-y-2">
          <DxCheckbox label="Require patient approval" checked={f.requires_patient_approval} onChange={(e) => setF({ ...f, requires_patient_approval: e.target.checked })} />
          <DxCheckbox label="Require primary-hospital approval" checked={f.requires_hospital_approval} onChange={(e) => setF({ ...f, requires_hospital_approval: e.target.checked })} />
        </div>
      </div>
    </DxPopup>
  );
}
