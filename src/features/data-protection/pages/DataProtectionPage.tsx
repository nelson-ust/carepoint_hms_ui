import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileLock2,
  FileText,
  Gavel,
  Plus,
  Save,
  ScrollText,
  Settings as SettingsIcon,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxCheckbox,
  DxForm,
  DxGrid,
  DxInput,
  DxKpi,
  DxPage,
  DxPageHeader,
  DxPanel,
  DxPopup,
  DxSearchBox,
  DxSelect,
  DxTabs,
  DxTextarea,
  apiErrorMessage,
  formatDateTime,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { dpApi, type Breach, type Consent, type DPSettings, type DSR, type Ropa } from "../api/data-protection.api";

type Tab = "overview" | "consents" | "requests" | "breaches" | "ropa" | "settings";
type Dialog = "consent" | "dsr" | "breach" | "ropa" | null;

const LAWFUL = ["CONSENT", "CONTRACT", "LEGAL_OBLIGATION", "VITAL_INTEREST", "PUBLIC_INTEREST", "LEGITIMATE_INTEREST"].map((v) => ({ value: v, label: v.replace(/_/g, " ") }));
const CONSENT_TYPES = ["DATA_PROCESSING", "DATA_SHARING", "MARKETING", "RESEARCH", "CROSS_BORDER_TRANSFER"].map((v) => ({ value: v, label: v.replace(/_/g, " ") }));
const DSR_TYPES = ["ACCESS", "RECTIFICATION", "ERASURE", "RESTRICTION", "PORTABILITY", "OBJECTION"].map((v) => ({ value: v, label: v[0] + v.slice(1).toLowerCase() }));
const SEVERITY = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((v) => ({ value: v, label: v[0] + v.slice(1).toLowerCase() }));

function download(name: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

/**
 * Data Protection (NDPA) — consent, data-subject rights, breach register,
 * records of processing activities and DPO/retention settings.
 */
export function DataProtectionPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [dialog, setDialog] = useState<Dialog>(null);

  const [consentForm, setConsentForm] = useState({ subject_name: "", patient_id: "", consent_type: "DATA_PROCESSING", lawful_basis: "CONSENT", method: "STAFF", purpose: "", notes: "" });
  const [dsrForm, setDsrForm] = useState({ subject_name: "", patient_id: "", subject_contact: "", request_type: "ACCESS", details: "" });
  const [breachForm, setBreachForm] = useState({ title: "", description: "", severity: "MEDIUM", data_categories: "", subjects_affected: "" });
  const [ropaForm, setRopaForm] = useState({ name: "", purpose: "", lawful_basis: "CONSENT", data_categories: "", data_subjects: "", recipients: "", retention_period: "", cross_border: false, cross_border_detail: "", owner: "" });
  const [settings, setSettings] = useState<DPSettings>({});

  const dashQ = useQuery({ queryKey: ["dp", "dashboard"], queryFn: dpApi.getDashboard });
  const consentsQ = useQuery({ queryKey: ["dp", "consents"], queryFn: () => dpApi.listConsents(), enabled: tab === "consents" });
  const dsrQ = useQuery({ queryKey: ["dp", "dsr"], queryFn: () => dpApi.listDSR(), enabled: tab === "requests" });
  const breachesQ = useQuery({ queryKey: ["dp", "breaches"], queryFn: () => dpApi.listBreaches(), enabled: tab === "breaches" });
  const ropaQ = useQuery({ queryKey: ["dp", "ropa"], queryFn: () => dpApi.listRopa(), enabled: tab === "ropa" });
  const settingsQ = useQuery({ queryKey: ["dp", "settings"], queryFn: dpApi.getSettings, enabled: tab === "settings" || tab === "overview" });
  useEffect(() => { if (settingsQ.data) setSettings(settingsQ.data); }, [settingsQ.data]);

  const d = dashQ.data;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["dp"] });
  const close = () => setDialog(null);
  const useMut = <T,>(fn: () => Promise<T>, ok: string) =>
    useMutation({ mutationFn: fn, onSuccess: () => { toast.success(ok); invalidate(); close(); }, onError: (e) => toast.error("Failed", apiErrorMessage(e)) });

  const createConsent = useMut(() => dpApi.recordConsent({ ...consentForm, patient_id: consentForm.patient_id ? Number(consentForm.patient_id) : undefined }), "Consent recorded");
  const createDsr = useMut(() => dpApi.createDSR({ ...dsrForm, patient_id: dsrForm.patient_id ? Number(dsrForm.patient_id) : undefined }), "Request logged");
  const createBreach = useMut(() => dpApi.createBreach({ ...breachForm, subjects_affected: breachForm.subjects_affected ? Number(breachForm.subjects_affected) : undefined }), "Breach logged");
  const createRopa = useMut(() => dpApi.createRopa(ropaForm), "Activity added");
  const saveSettings = useMutation({ mutationFn: () => dpApi.updateSettings(settings), onSuccess: () => { toast.success("Settings saved"); invalidate(); }, onError: (e) => toast.error("Failed", apiErrorMessage(e)) });

  const withdrawMut = useMutation({ mutationFn: (id: number) => dpApi.withdrawConsent(id), onSuccess: () => { toast.success("Consent withdrawn"); invalidate(); }, onError: (e) => toast.error("Failed", apiErrorMessage(e)) });
  const dsrStatusMut = useMutation({ mutationFn: ({ id, status }: { id: number; status: string }) => dpApi.updateDSR(id, { status }), onSuccess: () => { toast.success("Updated"); invalidate(); }, onError: (e) => toast.error("Failed", apiErrorMessage(e)) });
  const notifyMut = useMutation({ mutationFn: (id: number) => dpApi.notifyNdpc(id), onSuccess: () => { toast.success("NDPC notification recorded"); invalidate(); }, onError: (e) => toast.error("Failed", apiErrorMessage(e)) });
  const exportMut = useMutation({ mutationFn: (r: DSR) => dpApi.exportDSR(r.id).then((data) => ({ r, data })), onSuccess: ({ r, data }) => { download(`${r.subject_name.replace(/\s+/g, "_")}_data_export.json`, data); toast.success("Data export downloaded"); }, onError: (e) => toast.error("Could not export", apiErrorMessage(e)) });

  const consentCols: DxGridColumn<Consent>[] = [
    { key: "subject_name", header: "Data subject", render: (c) => <span className="font-semibold">{c.subject_name}</span> },
    { key: "consent_type", header: "Purpose", align: "center", render: (c) => <DxBadge tone="info">{c.consent_type.replace(/_/g, " ")}</DxBadge> },
    { key: "lawful_basis", header: "Lawful basis", render: (c) => c.lawful_basis.replace(/_/g, " ") },
    { key: "status", header: "Status", align: "center", render: (c) => <DxBadge tone={c.status === "GRANTED" ? "success" : "danger"}>{c.status}</DxBadge> },
    { key: "granted_at", header: "Granted", render: (c) => formatDateTime(c.granted_at) },
    { key: "actions", header: "", align: "right", render: (c) => c.status === "GRANTED" ? <DxButton size="sm" variant="outline-danger" onClick={() => withdrawMut.mutate(c.id)}>Withdraw</DxButton> : null },
  ];
  const dsrCols: DxGridColumn<DSR>[] = [
    { key: "subject_name", header: "Data subject", render: (r) => <span className="font-semibold">{r.subject_name}</span> },
    { key: "request_type", header: "Type", align: "center", render: (r) => <DxBadge tone="accent">{r.request_type}</DxBadge> },
    { key: "status", header: "Status", align: "center", render: (r) => <DxBadge tone={r.status === "COMPLETED" ? "success" : r.status === "REJECTED" ? "neutral" : r.overdue ? "danger" : "warning"}>{r.status.replace("_", " ")}{r.overdue ? " · overdue" : ""}</DxBadge> },
    { key: "due_at", header: "Due", render: (r) => formatDateTime(r.due_at) },
    { key: "actions", header: "", align: "right", render: (r) => (
      <div className="flex items-center justify-end gap-1.5">
        {r.patient_id && (r.request_type === "ACCESS" || r.request_type === "PORTABILITY") ? <DxButton size="sm" leftIcon={<Download />} onClick={() => exportMut.mutate(r)}>Export</DxButton> : null}
        {r.status === "RECEIVED" ? <DxButton size="sm" onClick={() => dsrStatusMut.mutate({ id: r.id, status: "IN_PROGRESS" })}>Start</DxButton> : null}
        {r.status !== "COMPLETED" && r.status !== "REJECTED" ? <DxButton size="sm" leftIcon={<CheckCircle2 />} onClick={() => dsrStatusMut.mutate({ id: r.id, status: "COMPLETED" })}>Complete</DxButton> : null}
      </div>
    ) },
  ];
  const breachCols: DxGridColumn<Breach>[] = [
    { key: "title", header: "Incident", render: (b) => <span className="font-semibold">{b.title}</span> },
    { key: "severity", header: "Severity", align: "center", render: (b) => <DxBadge tone={b.severity === "CRITICAL" || b.severity === "HIGH" ? "danger" : b.severity === "MEDIUM" ? "warning" : "neutral"}>{b.severity}</DxBadge> },
    { key: "status", header: "Status", align: "center", render: (b) => <DxBadge tone={b.status === "RESOLVED" ? "success" : "warning"}>{b.status}</DxBadge> },
    { key: "ndpc", header: "NDPC (72h)", align: "center", render: (b) => b.ndpc_notified ? <DxBadge tone="success">Notified</DxBadge> : <DxBadge tone={b.notify_overdue ? "danger" : "warning"}>{b.notify_overdue ? "Overdue" : "Due"}</DxBadge> },
    { key: "discovered_at", header: "Discovered", render: (b) => formatDateTime(b.discovered_at) },
    { key: "actions", header: "", align: "right", render: (b) => (
      <div className="flex items-center justify-end gap-1.5">
        {!b.ndpc_notified ? <DxButton size="sm" leftIcon={<Gavel />} onClick={() => notifyMut.mutate(b.id)}>Notify NDPC</DxButton> : null}
        {b.status !== "RESOLVED" ? <DxButton size="sm" variant="text" onClick={() => dpApi.updateBreach(b.id, { status: "RESOLVED" }).then(invalidate)}>Resolve</DxButton> : null}
      </div>
    ) },
  ];
  const ropaCols: DxGridColumn<Ropa>[] = [
    { key: "name", header: "Activity", render: (a) => <span className="font-semibold">{a.name}</span> },
    { key: "lawful_basis", header: "Lawful basis", render: (a) => a.lawful_basis.replace(/_/g, " ") },
    { key: "data_categories", header: "Data categories", wrap: true, render: (a) => a.data_categories ?? "—" },
    { key: "retention_period", header: "Retention", render: (a) => a.retention_period ?? "—" },
    { key: "cross_border", header: "Cross-border", align: "center", render: (a) => a.cross_border ? <DxBadge tone="warning">Yes</DxBadge> : <DxBadge tone="neutral">No</DxBadge> },
    { key: "actions", header: "", align: "right", render: (a) => <DxButton size="sm" variant="text" onClick={() => dpApi.deleteRopa(a.id).then(invalidate)}>Remove</DxButton> },
  ];

  const checklist = useMemo(() => [
    { ok: d?.dpo_set, label: "Data Protection Officer designated" },
    { ok: d?.privacy_policy_set, label: "Privacy policy published" },
    { ok: d?.ndpc_registered, label: "Registered with the NDPC" },
    { ok: (d?.ropa_count ?? 0) > 0, label: "Records of processing activities maintained" },
    { ok: (d?.dsr_overdue ?? 0) === 0, label: "No overdue data-subject requests" },
    { ok: (d?.breaches_overdue_ndpc ?? 0) === 0, label: "No breaches past the 72-hour NDPC window" },
  ], [d]);

  return (
    <DxPage>
      <DxPageHeader
        title="Data Protection (NDPA)"
        subtitle="Consent, data-subject rights, breach notification, processing register and DPO settings — Nigeria Data Protection Act 2023."
        actions={
          tab === "consents" ? <DxButton variant="primary" leftIcon={<Plus />} onClick={() => setDialog("consent")}>Record consent</DxButton>
          : tab === "requests" ? <DxButton variant="primary" leftIcon={<Plus />} onClick={() => setDialog("dsr")}>Log request</DxButton>
          : tab === "breaches" ? <DxButton variant="primary" leftIcon={<Plus />} onClick={() => setDialog("breach")}>Log breach</DxButton>
          : tab === "ropa" ? <DxButton variant="primary" leftIcon={<Plus />} onClick={() => setDialog("ropa")}>Add activity</DxButton>
          : undefined
        }
      />

      <DxTabs<Tab>
        value={tab}
        onChange={setTab}
        className="mb-3"
        items={[
          { key: "overview", label: "Overview", icon: <ShieldCheck /> },
          { key: "consents", label: "Consents", icon: <UserCheck /> },
          { key: "requests", label: "Subject Requests", icon: <FileText />, count: d?.dsr_open ?? null },
          { key: "breaches", label: "Breaches", icon: <ShieldAlert />, count: d?.breaches_open ?? null },
          { key: "ropa", label: "Processing Register", icon: <ScrollText /> },
          { key: "settings", label: "Settings", icon: <SettingsIcon /> },
        ]}
      />

      {tab === "overview" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <DxKpi label="Active consents" value={d?.consents_active ?? 0} icon={UserCheck} tone="success" sub={`${d?.consents_withdrawn ?? 0} withdrawn`} />
            <DxKpi label="Open requests" value={d?.dsr_open ?? 0} icon={FileText} tone="info" sub={`${d?.dsr_total ?? 0} total`} />
            <DxKpi label="Overdue requests" value={d?.dsr_overdue ?? 0} icon={AlertTriangle} tone={(d?.dsr_overdue ?? 0) > 0 ? "danger" : "neutral"} sub="past response window" />
            <DxKpi label="Open breaches" value={d?.breaches_open ?? 0} icon={ShieldAlert} tone={(d?.breaches_open ?? 0) > 0 ? "warning" : "neutral"} sub={`${d?.breaches_awaiting_ndpc ?? 0} awaiting NDPC`} />
            <DxKpi label="Breaches overdue NDPC" value={d?.breaches_overdue_ndpc ?? 0} icon={Gavel} tone={(d?.breaches_overdue_ndpc ?? 0) > 0 ? "danger" : "success"} sub="72-hour rule" />
            <DxKpi label="Processing activities" value={d?.ropa_count ?? 0} icon={ScrollText} tone="accent" sub="RoPA entries" />
          </div>
          <DxPanel title="Compliance checklist" icon={<FileLock2 />} flush>
            <div className="p-3 space-y-2">
              {checklist.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-[13px]">
                  {c.ok ? <CheckCircle2 className="h-4 w-4 text-[var(--dx-success)]" /> : <AlertTriangle className="h-4 w-4 text-[var(--dx-warning)]" />}
                  <span className={c.ok ? "text-[var(--dx-text)]" : "text-[var(--dx-text-muted)]"}>{c.label}</span>
                </div>
              ))}
            </div>
          </DxPanel>
        </div>
      ) : null}

      {tab === "consents" ? (
        <DxGrid columns={consentCols} data={consentsQ.data?.items ?? []} rowKey={(c) => c.id} isLoading={consentsQ.isLoading} error={consentsQ.isError ? apiErrorMessage(consentsQ.error) : null} empty={{ icon: UserCheck, title: "No consent records", description: "Record a data subject's consent for a processing purpose." }} />
      ) : null}

      {tab === "requests" ? (
        <DxGrid columns={dsrCols} data={dsrQ.data?.items ?? []} rowKey={(r) => r.id} isLoading={dsrQ.isLoading} error={dsrQ.isError ? apiErrorMessage(dsrQ.error) : null} empty={{ icon: FileText, title: "No requests", description: "Log an access, rectification, erasure or portability request." }} />
      ) : null}

      {tab === "breaches" ? (
        <DxGrid columns={breachCols} data={breachesQ.data?.items ?? []} rowKey={(b) => b.id} isLoading={breachesQ.isLoading} error={breachesQ.isError ? apiErrorMessage(breachesQ.error) : null} empty={{ icon: ShieldAlert, title: "No breaches logged", description: "Log a personal-data breach to start the 72-hour NDPC clock." }} />
      ) : null}

      {tab === "ropa" ? (
        <DxGrid columns={ropaCols} data={ropaQ.data?.items ?? []} rowKey={(a) => a.id} isLoading={ropaQ.isLoading} error={ropaQ.isError ? apiErrorMessage(ropaQ.error) : null} empty={{ icon: ScrollText, title: "No processing activities", description: "Document how and why personal data is processed." }} />
      ) : null}

      {tab === "settings" ? (
        <DxPanel title="Data-protection settings" icon={<SettingsIcon />} actions={<DxButton variant="primary" size="sm" leftIcon={<Save />} isLoading={saveSettings.isPending} onClick={() => saveSettings.mutate()}>Save</DxButton>}>
          <DxForm cols={2}>
            <DxInput label="DPO name" value={settings.dpo_name ?? ""} onChange={(e) => setSettings((s) => ({ ...s, dpo_name: e.target.value }))} />
            <DxInput label="DPO email" value={settings.dpo_email ?? ""} onChange={(e) => setSettings((s) => ({ ...s, dpo_email: e.target.value }))} />
            <DxInput label="DPO phone" value={settings.dpo_phone ?? ""} onChange={(e) => setSettings((s) => ({ ...s, dpo_phone: e.target.value }))} />
            <DxInput label="Privacy policy version" value={settings.privacy_policy_version ?? ""} onChange={(e) => setSettings((s) => ({ ...s, privacy_policy_version: e.target.value }))} placeholder="e.g. v1.2 (2026)" />
            <DxInput label="Privacy policy URL" fieldClassName="dx-col-span-full" value={settings.privacy_policy_url ?? ""} onChange={(e) => setSettings((s) => ({ ...s, privacy_policy_url: e.target.value }))} />
            <DxTextarea label="Privacy policy text" fieldClassName="dx-col-span-full" rows={3} value={settings.privacy_policy_text ?? ""} onChange={(e) => setSettings((s) => ({ ...s, privacy_policy_text: e.target.value }))} />
            <DxInput label="Retention (months)" type="number" value={settings.retention_months ?? ""} onChange={(e) => setSettings((s) => ({ ...s, retention_months: e.target.value ? Number(e.target.value) : undefined }))} />
            <DxInput label="Breach notify window (hours)" type="number" value={settings.breach_notify_hours ?? 72} onChange={(e) => setSettings((s) => ({ ...s, breach_notify_hours: Number(e.target.value) }))} hint="NDPA: within 72 hours" />
            <DxInput label="DSR response window (days)" type="number" value={settings.dsr_response_days ?? 30} onChange={(e) => setSettings((s) => ({ ...s, dsr_response_days: Number(e.target.value) }))} />
            <DxCheckbox className="dx-col-span-full" label="Registered with the Nigeria Data Protection Commission (NDPC)" checked={!!settings.ndpc_registered} onChange={(e) => setSettings((s) => ({ ...s, ndpc_registered: (e.target as HTMLInputElement).checked }))} />
          </DxForm>
        </DxPanel>
      ) : null}

      {/* ---------- dialogs ---------- */}
      <DxPopup isOpen={dialog === "consent"} onClose={close} title="Record consent" locked={createConsent.isPending}
        footer={<><DxButton onClick={close}>Cancel</DxButton><DxButton variant="primary" isLoading={createConsent.isPending} disabled={!consentForm.subject_name.trim()} onClick={() => createConsent.mutate()}>Record</DxButton></>}>
        <DxForm cols={2}>
          <DxInput label="Data subject" required value={consentForm.subject_name} onChange={(e) => setConsentForm((f) => ({ ...f, subject_name: e.target.value }))} />
          <DxInput label="Patient ID (optional)" type="number" value={consentForm.patient_id} onChange={(e) => setConsentForm((f) => ({ ...f, patient_id: e.target.value }))} />
          <DxSelect label="Purpose" value={consentForm.consent_type} onChange={(e) => setConsentForm((f) => ({ ...f, consent_type: e.target.value }))} options={CONSENT_TYPES} />
          <DxSelect label="Lawful basis" value={consentForm.lawful_basis} onChange={(e) => setConsentForm((f) => ({ ...f, lawful_basis: e.target.value }))} options={LAWFUL} />
          <DxSelect label="Method" value={consentForm.method} onChange={(e) => setConsentForm((f) => ({ ...f, method: e.target.value }))} options={[{ value: "STAFF", label: "Captured by staff" }, { value: "PORTAL", label: "Patient portal" }, { value: "PAPER", label: "Paper form" }, { value: "VERBAL", label: "Verbal" }]} />
          <DxInput label="Purpose detail" value={consentForm.purpose} onChange={(e) => setConsentForm((f) => ({ ...f, purpose: e.target.value }))} />
          <DxTextarea label="Notes" fieldClassName="dx-col-span-full" rows={2} value={consentForm.notes} onChange={(e) => setConsentForm((f) => ({ ...f, notes: e.target.value }))} />
        </DxForm>
      </DxPopup>

      <DxPopup isOpen={dialog === "dsr"} onClose={close} title="Log data-subject request" locked={createDsr.isPending}
        footer={<><DxButton onClick={close}>Cancel</DxButton><DxButton variant="primary" isLoading={createDsr.isPending} disabled={!dsrForm.subject_name.trim()} onClick={() => createDsr.mutate()}>Log request</DxButton></>}>
        <DxForm cols={2}>
          <DxInput label="Data subject" required value={dsrForm.subject_name} onChange={(e) => setDsrForm((f) => ({ ...f, subject_name: e.target.value }))} />
          <DxSelect label="Request type" value={dsrForm.request_type} onChange={(e) => setDsrForm((f) => ({ ...f, request_type: e.target.value }))} options={DSR_TYPES} />
          <DxInput label="Patient ID (for access/portability)" type="number" value={dsrForm.patient_id} onChange={(e) => setDsrForm((f) => ({ ...f, patient_id: e.target.value }))} />
          <DxInput label="Contact" value={dsrForm.subject_contact} onChange={(e) => setDsrForm((f) => ({ ...f, subject_contact: e.target.value }))} />
          <DxTextarea label="Details" fieldClassName="dx-col-span-full" rows={2} value={dsrForm.details} onChange={(e) => setDsrForm((f) => ({ ...f, details: e.target.value }))} />
        </DxForm>
      </DxPopup>

      <DxPopup isOpen={dialog === "breach"} onClose={close} title="Log data breach" locked={createBreach.isPending}
        footer={<><DxButton onClick={close}>Cancel</DxButton><DxButton variant="primary" isLoading={createBreach.isPending} disabled={!breachForm.title.trim()} onClick={() => createBreach.mutate()}>Log breach</DxButton></>}>
        <DxForm cols={2}>
          <DxInput label="Incident title" required fieldClassName="dx-col-span-full" value={breachForm.title} onChange={(e) => setBreachForm((f) => ({ ...f, title: e.target.value }))} />
          <DxSelect label="Severity" value={breachForm.severity} onChange={(e) => setBreachForm((f) => ({ ...f, severity: e.target.value }))} options={SEVERITY} />
          <DxInput label="Subjects affected" type="number" value={breachForm.subjects_affected} onChange={(e) => setBreachForm((f) => ({ ...f, subjects_affected: e.target.value }))} />
          <DxInput label="Data categories" fieldClassName="dx-col-span-full" value={breachForm.data_categories} onChange={(e) => setBreachForm((f) => ({ ...f, data_categories: e.target.value }))} placeholder="e.g. names, phone numbers, diagnoses" />
          <DxTextarea label="Description" fieldClassName="dx-col-span-full" rows={2} value={breachForm.description} onChange={(e) => setBreachForm((f) => ({ ...f, description: e.target.value }))} />
        </DxForm>
      </DxPopup>

      <DxPopup isOpen={dialog === "ropa"} onClose={close} title="Add processing activity" size="lg" locked={createRopa.isPending}
        footer={<><DxButton onClick={close}>Cancel</DxButton><DxButton variant="primary" isLoading={createRopa.isPending} disabled={!ropaForm.name.trim()} onClick={() => createRopa.mutate()}>Add</DxButton></>}>
        <DxForm cols={2}>
          <DxInput label="Activity name" required value={ropaForm.name} onChange={(e) => setRopaForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Patient registration" />
          <DxSelect label="Lawful basis" value={ropaForm.lawful_basis} onChange={(e) => setRopaForm((f) => ({ ...f, lawful_basis: e.target.value }))} options={LAWFUL} />
          <DxInput label="Purpose" fieldClassName="dx-col-span-full" value={ropaForm.purpose} onChange={(e) => setRopaForm((f) => ({ ...f, purpose: e.target.value }))} />
          <DxInput label="Data categories" value={ropaForm.data_categories} onChange={(e) => setRopaForm((f) => ({ ...f, data_categories: e.target.value }))} />
          <DxInput label="Data subjects" value={ropaForm.data_subjects} onChange={(e) => setRopaForm((f) => ({ ...f, data_subjects: e.target.value }))} placeholder="patients, staff…" />
          <DxInput label="Recipients" value={ropaForm.recipients} onChange={(e) => setRopaForm((f) => ({ ...f, recipients: e.target.value }))} placeholder="HMOs, labs…" />
          <DxInput label="Retention period" value={ropaForm.retention_period} onChange={(e) => setRopaForm((f) => ({ ...f, retention_period: e.target.value }))} placeholder="e.g. 7 years" />
          <DxInput label="Owner" value={ropaForm.owner} onChange={(e) => setRopaForm((f) => ({ ...f, owner: e.target.value }))} />
          <DxCheckbox className="dx-col-span-full" label="Involves cross-border transfer of data" checked={ropaForm.cross_border} onChange={(e) => setRopaForm((f) => ({ ...f, cross_border: (e.target as HTMLInputElement).checked }))} />
          {ropaForm.cross_border ? <DxInput label="Cross-border detail" fieldClassName="dx-col-span-full" value={ropaForm.cross_border_detail} onChange={(e) => setRopaForm((f) => ({ ...f, cross_border_detail: e.target.value }))} /> : null}
        </DxForm>
      </DxPopup>
    </DxPage>
  );
}
