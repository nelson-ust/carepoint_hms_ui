import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Banknote, CheckCircle2, ClipboardList, FileText, HandHeart, Eye, Plus, Receipt, RotateCcw, Scissors, Snowflake } from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxForm,
  DxGrid,
  DxInput,
  DxPage,
  DxPageHeader,
  DxPageLoading,
  DxPanel,
  DxPopup,
  DxProps,
  DxSelect,
  DxStatusBadge,
  DxTabs,
  DxTextarea,
  apiErrorMessage,
  formatDateTime,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { routes } from "@/config/routes";
import {
  mortuaryApi,
  type Autopsy,
  type Certificate,
  type Charge,
  type Effect,
  type Embalming,
  type MortuaryPayment2,
  type Viewing,
} from "../api/mortuary.api";

type TabKey = "overview" | "autopsy" | "embalming" | "effects" | "viewings" | "charges" | "certificate";
type FormKind = "autopsy" | "embalming" | "effect" | "viewing" | "charge" | "certificate" | "payment" | null;

const naira = (n: number | string) => `₦ ${Number(n).toLocaleString()}`;

const MANNER_OF_DEATH_OPTIONS = [
  { value: "Natural", label: "Natural" },
  { value: "Accident", label: "Accident" },
  { value: "Suicide", label: "Suicide" },
  { value: "Homicide", label: "Homicide" },
  { value: "Undetermined", label: "Undetermined" },
  { value: "Pending investigation", label: "Pending investigation" },
];
const EMBALM_METHOD_OPTIONS = [
  { value: "Arterial", label: "Arterial" },
  { value: "Cavity", label: "Cavity" },
  { value: "Arterial + Cavity", label: "Arterial + Cavity" },
  { value: "Surface", label: "Surface" },
  { value: "Hypodermic", label: "Hypodermic" },
  { value: "Other", label: "Other" },
];
const RELATIONSHIP_OPTIONS = [
  { value: "Spouse", label: "Spouse" },
  { value: "Child", label: "Child" },
  { value: "Parent", label: "Parent" },
  { value: "Sibling", label: "Sibling" },
  { value: "Grandchild", label: "Grandchild" },
  { value: "Other relative", label: "Other relative" },
  { value: "Friend", label: "Friend" },
  { value: "Guardian", label: "Guardian" },
  { value: "Employer", label: "Employer" },
  { value: "Other", label: "Other" },
];

/**
 * Per-body mortuary workstation: everything a standard mortuary does for a
 * single deceased record — autopsy, embalming, personal effects, family
 * viewings, billing and the death certificate.
 */
function StatTile({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  const color = tone === "success" ? "var(--dx-success)" : tone === "danger" ? "var(--dx-danger)" : "var(--dx-text)";
  return (
    <div className="rounded-xl border border-[var(--dx-border)] bg-[var(--dx-surface)] px-3 py-2.5">
      <div className="dx-caption">{label}</div>
      <div className="text-[16px] font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

export function DeceasedDetailPage() {
  const { recordId } = useParams();
  const id = Number(recordId);
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const [tab, setTab] = useState<TabKey>("overview");
  const [form, setForm] = useState<FormKind>(null);

  // form state (one object per kind; reset on open)
  const [autopsyForm, setAutopsyForm] = useState({ autopsy_type: "CLINICAL", requested_by: "", pathologist: "", scheduled_at: "", consent_by: "", notes: "" });
  const [embalmForm, setEmbalmForm] = useState({ embalmer_name: "", method: "", chemicals_used: "", embalmed_at: "", mark_completed: true, notes: "" });
  const [effectForm, setEffectForm] = useState({ item: "", quantity: "1", description: "", received_from: "" });
  const [viewingForm, setViewingForm] = useState({ visitor_name: "", relationship_to_deceased: "", contact: "", authorized_by: "", notes: "" });
  const [chargeForm, setChargeForm] = useState({ charge_type: "STORAGE", fee_schedule_id: "", description: "", quantity: "1", unit_amount: "", account_code: "", notes: "" });
  const [certForm, setCertForm] = useState({ issued_by: "", certifying_doctor: "", cause_of_death: "", manner_of_death: "", place_of_death: "Hospital", notes: "" });
  const [payForm, setPayForm] = useState({ amount: "", method: "CASH", reference: "", payer_name: "" });

  const recordQuery = useQuery({ queryKey: ["mortuary", "deceased", id], queryFn: () => mortuaryApi.getDeceased(id), enabled: Number.isFinite(id) });
  const autopsiesQuery = useQuery({ queryKey: ["mortuary", "deceased", id, "autopsies"], queryFn: () => mortuaryApi.listRecordAutopsies(id), enabled: Number.isFinite(id) });
  const embalmingQuery = useQuery({ queryKey: ["mortuary", "deceased", id, "embalming"], queryFn: () => mortuaryApi.listEmbalming(id), enabled: Number.isFinite(id) });
  const effectsQuery = useQuery({ queryKey: ["mortuary", "deceased", id, "effects"], queryFn: () => mortuaryApi.listEffects(id), enabled: Number.isFinite(id) });
  const viewingsQuery = useQuery({ queryKey: ["mortuary", "deceased", id, "viewings"], queryFn: () => mortuaryApi.listViewings(id), enabled: Number.isFinite(id) });
  const chargesQuery = useQuery({ queryKey: ["mortuary", "deceased", id, "charges"], queryFn: () => mortuaryApi.listRecordCharges(id), enabled: Number.isFinite(id) });
  const billQuery = useQuery({ queryKey: ["mortuary", "deceased", id, "billing"], queryFn: () => mortuaryApi.getBillingSummary(id), enabled: Number.isFinite(id) });
  const certificateQuery = useQuery({ queryKey: ["mortuary", "deceased", id, "certificate"], queryFn: () => mortuaryApi.getCertificate(id), enabled: Number.isFinite(id) });
  const accountsQuery = useQuery({ queryKey: ["mortuary", "accounts"], queryFn: mortuaryApi.listAccounts });
  const feesQuery = useQuery({ queryKey: ["mortuary", "fee-schedule", "active"], queryFn: () => mortuaryApi.listFees(true) });

  const record = recordQuery.data;
  const accountOptions = useMemo(() => (accountsQuery.data ?? []).map((a) => ({ value: a.code, label: `${a.code} — ${a.name}` })), [accountsQuery.data]);
  const feeItems = useMemo(() => feesQuery.data?.items ?? [], [feesQuery.data]);
  const feeOptions = useMemo(() => feeItems.map((f) => ({ value: String(f.id), label: `${f.name} — ${naira(f.unit_price)}` })), [feeItems]);
  const applyFeeItem = (feeId: string) => {
    const fee = feeItems.find((f) => String(f.id) === feeId);
    setChargeForm((f) => fee
      ? { ...f, fee_schedule_id: feeId, charge_type: fee.charge_type, unit_amount: String(fee.unit_price ?? ""), description: f.description || fee.name, account_code: fee.account_code ?? "" }
      : { ...f, fee_schedule_id: "" });
  };
  const invalidate = () => qc.invalidateQueries({ queryKey: ["mortuary", "deceased", id] });
  const closeForm = () => setForm(null);

  const useMut = <T,>(fn: () => Promise<T>, okMsg: string, failMsg: string) =>
    useMutation({ mutationFn: fn, onSuccess: () => { toast.success(okMsg); invalidate(); closeForm(); }, onError: (e) => toast.error(failMsg, apiErrorMessage(e)) });

  const createAutopsy = useMut(() => mortuaryApi.createAutopsy(id, { ...autopsyForm, scheduled_at: autopsyForm.scheduled_at || undefined }), "Autopsy recorded", "Could not record autopsy");
  const createEmbalm = useMut(() => mortuaryApi.createEmbalming(id, { ...embalmForm, embalmed_at: embalmForm.embalmed_at || undefined }), "Embalming recorded", "Could not record embalming");
  const createEffect = useMut(() => mortuaryApi.createEffect(id, { ...effectForm, quantity: Number(effectForm.quantity) || 1 }), "Effect logged", "Could not log effect");
  const createViewing = useMut(() => mortuaryApi.createViewing(id, viewingForm), "Viewing logged", "Could not log viewing");
  const createCharge = useMut(() => mortuaryApi.createCharge(id, {
    charge_type: chargeForm.charge_type,
    description: chargeForm.description || undefined,
    quantity: Number(chargeForm.quantity) || 1,
    unit_amount: chargeForm.unit_amount === "" ? undefined : Number(chargeForm.unit_amount),
    account_code: chargeForm.account_code || undefined,
    fee_schedule_id: chargeForm.fee_schedule_id ? Number(chargeForm.fee_schedule_id) : undefined,
    notes: chargeForm.notes || undefined,
  }), "Charge added", "Could not add charge");
  const issueCert = useMut(() => mortuaryApi.issueCertificate(id, certForm), "Certificate issued", "Could not issue certificate");
  const createPayment = useMut(() => mortuaryApi.addPayment(id, { amount: Number(payForm.amount) || 0, method: payForm.method, reference: payForm.reference || undefined, payer_name: payForm.payer_name || undefined }), "Payment recorded", "Could not record payment");

  const autopsyStatusMut = useMutation({ mutationFn: ({ aid, status }: { aid: number; status: string }) => mortuaryApi.updateAutopsy(aid, { status }), onSuccess: () => { toast.success("Autopsy updated"); invalidate(); }, onError: (e) => toast.error("Could not update", apiErrorMessage(e)) });
  const releaseEffectMut = useMutation({ mutationFn: ({ eid, to }: { eid: number; to: string }) => mortuaryApi.releaseEffect(eid, to), onSuccess: () => { toast.success("Effect released"); invalidate(); }, onError: (e) => toast.error("Could not release", apiErrorMessage(e)) });
  const chargeStatusMut = useMutation({ mutationFn: ({ cid, status }: { cid: number; status: "PAID" | "WAIVED" }) => mortuaryApi.setChargeStatus(cid, status), onSuccess: () => { toast.success("Charge updated"); invalidate(); }, onError: (e) => toast.error("Could not update", apiErrorMessage(e)) });

  const chargesSummary = chargesQuery.data?.meta?.summary;
  const certificate = (certificateQuery.data?.data && "certificate_number" in certificateQuery.data.data) ? (certificateQuery.data.data as Certificate) : null;

  // ---- columns ----
  const autopsyColumns: DxGridColumn<Autopsy>[] = [
    { key: "autopsy_type", header: "Type", align: "center", render: (a) => <DxBadge tone={a.autopsy_type === "MEDICO_LEGAL" ? "danger" : "info"}>{a.autopsy_type.replace("_", " ")}</DxBadge> },
    { key: "status", header: "Status", align: "center", render: (a) => <DxBadge tone={a.status === "COMPLETED" ? "success" : a.status === "CANCELLED" ? "neutral" : a.status === "SCHEDULED" ? "info" : "warning"}>{a.status}</DxBadge> },
    { key: "pathologist", header: "Pathologist", render: (a) => a.pathologist ?? "—" },
    { key: "when", header: "Scheduled / performed", render: (a) => formatDateTime(a.performed_at ?? a.scheduled_at) },
    { key: "findings", header: "Findings", wrap: true, render: (a) => a.findings ?? <span className="text-[var(--dx-text-faint)]">—</span> },
    { key: "actions", header: "", align: "right", render: (a) =>
      a.status !== "COMPLETED" && a.status !== "CANCELLED" ? (
        <DxButton size="sm" leftIcon={<CheckCircle2 />} onClick={() => autopsyStatusMut.mutate({ aid: a.id, status: "COMPLETED" })}>Complete</DxButton>
      ) : null },
  ];
  const embalmColumns: DxGridColumn<Embalming>[] = [
    { key: "status", header: "Status", align: "center", render: (e) => <DxBadge tone={e.status === "COMPLETED" ? "success" : "warning"}>{e.status}</DxBadge> },
    { key: "embalmer_name", header: "Embalmer", render: (e) => e.embalmer_name ?? "—" },
    { key: "method", header: "Method", render: (e) => e.method ?? "—" },
    { key: "embalmed_at", header: "When", render: (e) => formatDateTime(e.embalmed_at) },
  ];
  const effectColumns: DxGridColumn<Effect>[] = [
    { key: "item", header: "Item", render: (e) => <span className="font-semibold">{e.item}</span> },
    { key: "quantity", header: "Qty", align: "center" },
    { key: "received_from", header: "Received from", render: (e) => e.received_from ?? "—" },
    { key: "status", header: "Status", align: "center", render: (e) => <DxBadge tone={e.status === "RELEASED" ? "success" : "info"}>{e.status}</DxBadge> },
    { key: "released_to", header: "Released to", render: (e) => e.released_to ?? "—" },
    { key: "actions", header: "", align: "right", render: (e) =>
      e.status === "HELD" ? (
        <DxButton size="sm" leftIcon={<HandHeart />} onClick={() => { const to = window.prompt("Release to (name):"); if (to) releaseEffectMut.mutate({ eid: e.id, to }); }}>Release</DxButton>
      ) : null },
  ];
  const viewingColumns: DxGridColumn<Viewing>[] = [
    { key: "visitor_name", header: "Visitor", render: (v) => <span className="font-semibold">{v.visitor_name}</span> },
    { key: "relationship_to_deceased", header: "Relationship", render: (v) => v.relationship_to_deceased ?? "—" },
    { key: "contact", header: "Contact", render: (v) => v.contact ?? "—" },
    { key: "viewed_at", header: "Viewed", render: (v) => formatDateTime(v.viewed_at) },
    { key: "authorized_by", header: "Authorized by", render: (v) => v.authorized_by ?? "—" },
  ];
  const chargeColumns: DxGridColumn<Charge>[] = [
    { key: "charge_type", header: "Type", align: "center", render: (c) => <DxBadge tone="neutral">{c.charge_type.replace("_", " ")}</DxBadge> },
    { key: "description", header: "Description", render: (c) => c.description ?? "—" },
    { key: "quantity", header: "Qty", align: "right" },
    { key: "unit_amount", header: "Unit", align: "right", render: (c) => naira(c.unit_amount) },
    { key: "amount", header: "Amount", align: "right", render: (c) => <span className="font-semibold">{naira(c.amount)}</span> },
    { key: "status", header: "Status", align: "center", render: (c) => <DxBadge tone={c.status === "PAID" ? "success" : c.status === "WAIVED" ? "neutral" : "warning"}>{c.status}</DxBadge> },
    { key: "actions", header: "", align: "right", render: (c) =>
      c.status === "PENDING" ? (
        <div className="flex items-center justify-end gap-1.5">
          <DxButton size="sm" leftIcon={<CheckCircle2 />} onClick={() => chargeStatusMut.mutate({ cid: c.id, status: "PAID" })}>Paid</DxButton>
          <DxButton size="sm" variant="text" onClick={() => chargeStatusMut.mutate({ cid: c.id, status: "WAIVED" })}>Waive</DxButton>
        </div>
      ) : null },
  ];
  const paymentColumns: DxGridColumn<MortuaryPayment2>[] = [
    { key: "paid_at", header: "Date", render: (p) => formatDateTime(p.paid_at) },
    { key: "method", header: "Method", align: "center", render: (p) => <DxBadge tone="info">{p.method}</DxBadge> },
    { key: "amount", header: "Amount", align: "right", render: (p) => <span className="font-semibold">{naira(p.amount)}</span> },
    { key: "reference", header: "Reference", render: (p) => p.reference ?? "—" },
    { key: "payer_name", header: "Payer", render: (p) => p.payer_name ?? "—" },
  ];

  const overviewItems = useMemo(() => record ? [
    { label: "Tag", value: <span className="dx-mono">{record.tag_number}</span> },
    { label: "Source", value: record.source === "BROUGHT_IN" ? "Brought-in" : "In-hospital" },
    { label: "Status", value: <DxBadge tone={record.status === "RELEASED" ? "success" : record.status === "IN_STORAGE" ? "info" : "warning"}>{record.status.replace("_", " ")}</DxBadge> },
    { label: "Gender / age", value: [record.gender, record.age_years != null ? `${record.age_years} yrs` : null].filter(Boolean).join(" · ") || "—" },
    { label: "Date of death", value: formatDateTime(record.date_of_death) },
    { label: "Cause of death", value: record.cause_of_death || "—" },
    { label: "Storage unit", value: record.mortuary_unit_name ?? "—" },
    { label: "Next of kin", value: record.next_of_kin_name ? `${record.next_of_kin_name}${record.next_of_kin_phone ? ` · ${record.next_of_kin_phone}` : ""}` : "—" },
    { label: "Police case", value: record.is_police_case ? `Yes${record.police_reference ? ` · ${record.police_reference}` : ""}` : "No" },
  ] : [], [record]);

  if (recordQuery.isLoading) return <DxPageLoading label="Loading record…" />;
  if (!record) return (
    <DxPage>
      <DxPageHeader crumbs={[{ label: "Mortuary", to: routes.mortuary }, { label: `#${recordId}` }]} title="Record not found" />
    </DxPage>
  );

  const openAdd = (k: FormKind) => setForm(k);

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Mortuary", to: routes.mortuary }, { label: record.tag_number }]}
        title={record.deceased_name}
        subtitle="Mortuary case — autopsy, embalming, effects, viewings, billing and certificate."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={() => invalidate()}><RotateCcw /></DxButton>
            <DxButton leftIcon={<ClipboardList />} onClick={() => navigate(routes.mortuary)}>Back to register</DxButton>
          </>
        }
      />

      <DxPanel title="Case summary" icon={<Archive />} flush>
        <DxProps items={overviewItems} />
      </DxPanel>

      <DxTabs<TabKey>
        value={tab}
        onChange={setTab}
        className="mt-4 mb-3"
        items={[
          { key: "overview", label: "Overview", icon: <ClipboardList /> },
          { key: "autopsy", label: "Autopsy", icon: <Scissors />, count: autopsiesQuery.data?.items?.length ?? null },
          { key: "embalming", label: "Embalming", icon: <Snowflake />, count: embalmingQuery.data?.items?.length ?? null },
          { key: "effects", label: "Effects", icon: <HandHeart />, count: effectsQuery.data?.items?.length ?? null },
          { key: "viewings", label: "Viewings", icon: <Eye />, count: viewingsQuery.data?.items?.length ?? null },
          { key: "charges", label: "Billing", icon: <Receipt />, count: chargesQuery.data?.items?.length ?? null },
          { key: "certificate", label: "Certificate", icon: <FileText /> },
        ]}
      />

      {tab === "overview" ? (
        <DxPanel title="Status & next of kin" icon={<ClipboardList />} flush>
          <DxProps items={overviewItems} />
        </DxPanel>
      ) : null}

      {tab === "autopsy" ? (
        <DxPanel title="Post-mortem" icon={<Scissors />} flush actions={<DxButton size="sm" leftIcon={<Plus />} onClick={() => openAdd("autopsy")}>Request autopsy</DxButton>}>
          <DxGrid<Autopsy> borderless columns={autopsyColumns} data={autopsiesQuery.data?.items ?? []} rowKey={(a) => a.id} isLoading={autopsiesQuery.isLoading} empty={{ icon: Scissors, title: "No autopsy", description: "Request a post-mortem for this body." }} />
        </DxPanel>
      ) : null}

      {tab === "embalming" ? (
        <DxPanel title="Embalming / body prep" icon={<Snowflake />} flush actions={<DxButton size="sm" leftIcon={<Plus />} onClick={() => openAdd("embalming")}>Record embalming</DxButton>}>
          <DxGrid<Embalming> borderless columns={embalmColumns} data={embalmingQuery.data?.items ?? []} rowKey={(e) => e.id} isLoading={embalmingQuery.isLoading} empty={{ icon: Snowflake, title: "No embalming recorded" }} />
        </DxPanel>
      ) : null}

      {tab === "effects" ? (
        <DxPanel title="Personal effects" icon={<HandHeart />} flush actions={<DxButton size="sm" leftIcon={<Plus />} onClick={() => openAdd("effect")}>Log effect</DxButton>}>
          <DxGrid<Effect> borderless columns={effectColumns} data={effectsQuery.data?.items ?? []} rowKey={(e) => e.id} isLoading={effectsQuery.isLoading} empty={{ icon: HandHeart, title: "No effects logged", description: "Record belongings handed in with the body." }} />
        </DxPanel>
      ) : null}

      {tab === "viewings" ? (
        <DxPanel title="Family viewings" icon={<Eye />} flush actions={<DxButton size="sm" leftIcon={<Plus />} onClick={() => openAdd("viewing")}>Log viewing</DxButton>}>
          <DxGrid<Viewing> borderless columns={viewingColumns} data={viewingsQuery.data?.items ?? []} rowKey={(v) => v.id} isLoading={viewingsQuery.isLoading} empty={{ icon: Eye, title: "No viewings logged" }} />
        </DxPanel>
      ) : null}

      {tab === "charges" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Billed" value={naira(billQuery.data?.total_billed ?? chargesSummary?.total ?? 0)} />
            <StatTile label="Paid" value={naira(billQuery.data?.total_paid ?? 0)} tone="success" />
            <StatTile label="Waived" value={naira(billQuery.data?.waived ?? 0)} />
            <StatTile label="Outstanding" value={naira(billQuery.data?.outstanding ?? chargesSummary?.outstanding ?? 0)} tone={Number(billQuery.data?.outstanding ?? 0) > 0 ? "danger" : "success"} />
          </div>
          <DxPanel
            title="Mortuary charges"
            icon={<Receipt />}
            flush
            actions={<DxButton size="sm" leftIcon={<Plus />} onClick={() => openAdd("charge")}>Add charge</DxButton>}
          >
            <DxGrid<Charge> borderless columns={chargeColumns} data={chargesQuery.data?.items ?? []} rowKey={(c) => c.id} isLoading={chargesQuery.isLoading} empty={{ icon: Receipt, title: "No charges", description: "Add storage, embalming or autopsy charges." }} />
          </DxPanel>
          <DxPanel
            title="Payments"
            icon={<Banknote />}
            flush
            actions={<DxButton size="sm" leftIcon={<Plus />} onClick={() => openAdd("payment")}>Record payment</DxButton>}
          >
            <DxGrid<MortuaryPayment2> borderless columns={paymentColumns} data={billQuery.data?.payments ?? []} rowKey={(p) => p.id} isLoading={billQuery.isLoading} empty={{ icon: Banknote, title: "No payments", description: "Record a payment against this mortuary bill." }} />
          </DxPanel>
        </div>
      ) : null}

      {tab === "certificate" ? (
        <DxPanel title="Death certificate" icon={<FileText />} flush actions={!certificate ? <DxButton size="sm" leftIcon={<Plus />} onClick={() => openAdd("certificate")}>Issue certificate</DxButton> : undefined}>
          {certificate ? (
            <DxProps items={[
              { label: "Certificate no.", value: <span className="dx-mono font-semibold">{certificate.certificate_number}</span> },
              { label: "Issued", value: formatDateTime(certificate.issued_at) },
              { label: "Issued by", value: certificate.issued_by ?? "—" },
              { label: "Certifying doctor", value: certificate.certifying_doctor ?? "—" },
              { label: "Cause of death", value: certificate.cause_of_death ?? "—" },
              { label: "Manner of death", value: certificate.manner_of_death ?? "—" },
              { label: "Place of death", value: certificate.place_of_death ?? "—" },
            ]} />
          ) : (
            <p className="px-3 py-6 text-center text-[12.5px] text-[var(--dx-text-muted)]">No death certificate issued yet.</p>
          )}
        </DxPanel>
      ) : null}

      {/* ---------- Add dialogs ---------- */}
      <DxPopup isOpen={form === "payment"} onClose={closeForm} title="Record mortuary payment" locked={createPayment.isPending}
        footer={<><DxButton onClick={closeForm}>Cancel</DxButton><DxButton variant="primary" leftIcon={<Banknote />} isLoading={createPayment.isPending} disabled={!(Number(payForm.amount) > 0)} onClick={() => createPayment.mutate()}>Record</DxButton></>}>
        <DxForm cols={2}>
          <DxInput label="Amount (₦)" required type="number" value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} />
          <DxSelect label="Method" value={payForm.method} onChange={(e) => setPayForm((f) => ({ ...f, method: e.target.value }))} options={[{ value: "CASH", label: "Cash" }, { value: "POS", label: "POS" }, { value: "TRANSFER", label: "Transfer" }, { value: "CARD", label: "Card" }, { value: "HMO", label: "HMO" }]} />
          <DxInput label="Payer name" value={payForm.payer_name} onChange={(e) => setPayForm((f) => ({ ...f, payer_name: e.target.value }))} />
          <DxInput label="Reference" value={payForm.reference} onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))} />
        </DxForm>
      </DxPopup>

      <DxPopup isOpen={form === "autopsy"} onClose={closeForm} title="Request / schedule autopsy" locked={createAutopsy.isPending}
        footer={<><DxButton onClick={closeForm}>Cancel</DxButton><DxButton variant="primary" isLoading={createAutopsy.isPending} onClick={() => createAutopsy.mutate()}>Save</DxButton></>}>
        <DxForm cols={2}>
          <DxSelect label="Type" value={autopsyForm.autopsy_type} onChange={(e) => setAutopsyForm((f) => ({ ...f, autopsy_type: e.target.value }))} options={[{ value: "CLINICAL", label: "Clinical" }, { value: "MEDICO_LEGAL", label: "Medico-legal" }]} />
          <DxInput label="Scheduled at" type="datetime-local" value={autopsyForm.scheduled_at} onChange={(e) => setAutopsyForm((f) => ({ ...f, scheduled_at: e.target.value }))} />
          <DxInput label="Requested by" value={autopsyForm.requested_by} onChange={(e) => setAutopsyForm((f) => ({ ...f, requested_by: e.target.value }))} />
          <DxInput label="Pathologist" value={autopsyForm.pathologist} onChange={(e) => setAutopsyForm((f) => ({ ...f, pathologist: e.target.value }))} />
          <DxInput label="Consent by (next of kin)" fieldClassName="dx-col-span-full" value={autopsyForm.consent_by} onChange={(e) => setAutopsyForm((f) => ({ ...f, consent_by: e.target.value }))} />
          <DxTextarea label="Notes" fieldClassName="dx-col-span-full" rows={2} value={autopsyForm.notes} onChange={(e) => setAutopsyForm((f) => ({ ...f, notes: e.target.value }))} />
        </DxForm>
      </DxPopup>

      <DxPopup isOpen={form === "embalming"} onClose={closeForm} title="Record embalming" locked={createEmbalm.isPending}
        footer={<><DxButton onClick={closeForm}>Cancel</DxButton><DxButton variant="primary" isLoading={createEmbalm.isPending} onClick={() => createEmbalm.mutate()}>Save</DxButton></>}>
        <DxForm cols={2}>
          <DxInput label="Embalmer" value={embalmForm.embalmer_name} onChange={(e) => setEmbalmForm((f) => ({ ...f, embalmer_name: e.target.value }))} />
          <DxSelect label="Method" value={embalmForm.method} onChange={(e) => setEmbalmForm((f) => ({ ...f, method: e.target.value }))} options={EMBALM_METHOD_OPTIONS} placeholder="Select…" />
          <DxInput label="Embalmed at" type="datetime-local" value={embalmForm.embalmed_at} onChange={(e) => setEmbalmForm((f) => ({ ...f, embalmed_at: e.target.value }))} />
          <DxInput label="Chemicals used" value={embalmForm.chemicals_used} onChange={(e) => setEmbalmForm((f) => ({ ...f, chemicals_used: e.target.value }))} />
          <DxTextarea label="Notes" fieldClassName="dx-col-span-full" rows={2} value={embalmForm.notes} onChange={(e) => setEmbalmForm((f) => ({ ...f, notes: e.target.value }))} />
        </DxForm>
      </DxPopup>

      <DxPopup isOpen={form === "effect"} onClose={closeForm} title="Log personal effect" locked={createEffect.isPending}
        footer={<><DxButton onClick={closeForm}>Cancel</DxButton><DxButton variant="primary" isLoading={createEffect.isPending} disabled={!effectForm.item.trim()} onClick={() => createEffect.mutate()}>Save</DxButton></>}>
        <DxForm cols={2}>
          <DxInput label="Item" required value={effectForm.item} onChange={(e) => setEffectForm((f) => ({ ...f, item: e.target.value }))} placeholder="Wristwatch, phone, wallet…" />
          <DxInput label="Quantity" type="number" value={effectForm.quantity} onChange={(e) => setEffectForm((f) => ({ ...f, quantity: e.target.value }))} />
          <DxInput label="Received from" value={effectForm.received_from} onChange={(e) => setEffectForm((f) => ({ ...f, received_from: e.target.value }))} />
          <DxTextarea label="Description" fieldClassName="dx-col-span-full" rows={2} value={effectForm.description} onChange={(e) => setEffectForm((f) => ({ ...f, description: e.target.value }))} />
        </DxForm>
      </DxPopup>

      <DxPopup isOpen={form === "viewing"} onClose={closeForm} title="Log family viewing" locked={createViewing.isPending}
        footer={<><DxButton onClick={closeForm}>Cancel</DxButton><DxButton variant="primary" isLoading={createViewing.isPending} disabled={!viewingForm.visitor_name.trim()} onClick={() => createViewing.mutate()}>Save</DxButton></>}>
        <DxForm cols={2}>
          <DxInput label="Visitor name" required fieldClassName="dx-col-span-full" value={viewingForm.visitor_name} onChange={(e) => setViewingForm((f) => ({ ...f, visitor_name: e.target.value }))} />
          <DxSelect label="Relationship" value={viewingForm.relationship_to_deceased} onChange={(e) => setViewingForm((f) => ({ ...f, relationship_to_deceased: e.target.value }))} options={RELATIONSHIP_OPTIONS} placeholder="Select…" />
          <DxInput label="Contact" value={viewingForm.contact} onChange={(e) => setViewingForm((f) => ({ ...f, contact: e.target.value }))} />
          <DxInput label="Authorized by" fieldClassName="dx-col-span-full" value={viewingForm.authorized_by} onChange={(e) => setViewingForm((f) => ({ ...f, authorized_by: e.target.value }))} />
          <DxTextarea label="Notes" fieldClassName="dx-col-span-full" rows={2} value={viewingForm.notes} onChange={(e) => setViewingForm((f) => ({ ...f, notes: e.target.value }))} />
        </DxForm>
      </DxPopup>

      <DxPopup isOpen={form === "charge"} onClose={closeForm} title="Add mortuary charge" locked={createCharge.isPending}
        footer={<><DxButton onClick={closeForm}>Cancel</DxButton><DxButton variant="primary" isLoading={createCharge.isPending} onClick={() => createCharge.mutate()}>Save</DxButton></>}>
        <DxForm cols={2}>
          <DxSelect label="Price list item" fieldClassName="dx-col-span-full" value={chargeForm.fee_schedule_id} onChange={(e) => applyFeeItem(e.target.value)}
            options={feeOptions} placeholder="Pick from price list (optional) — or enter manually below"
            hint="Choosing an item fills the type, amount and account code." />
          <DxSelect label="Type" value={chargeForm.charge_type} onChange={(e) => setChargeForm((f) => ({ ...f, charge_type: e.target.value }))}
            options={[{ value: "STORAGE", label: "Storage" }, { value: "EMBALMING", label: "Embalming" }, { value: "PRESERVATION", label: "Preservation" }, { value: "AUTOPSY", label: "Autopsy" }, { value: "BODY_PREP", label: "Body prep" }, { value: "DRESSING", label: "Washing & dressing" }, { value: "COFFIN", label: "Coffin / casket" }, { value: "HEARSE", label: "Hearse / ambulance" }, { value: "DOCUMENTATION", label: "Documentation" }, { value: "PENALTY", label: "Penalty" }, { value: "MORTUARY_FEE", label: "Mortuary fee" }, { value: "OTHER", label: "Other" }]} />
          <DxSelect label="Account code" value={chargeForm.account_code} onChange={(e) => setChargeForm((f) => ({ ...f, account_code: e.target.value }))}
            options={accountOptions} placeholder="Auto — by charge type" hint="Ledger this costing posts to." />
          <DxInput label="Description" fieldClassName="dx-col-span-full" value={chargeForm.description} onChange={(e) => setChargeForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. 3 days cold storage" />
          <DxInput label="Quantity" type="number" value={chargeForm.quantity} onChange={(e) => setChargeForm((f) => ({ ...f, quantity: e.target.value }))} hint="e.g. number of days" />
          <DxInput label="Unit amount (₦)" type="number" value={chargeForm.unit_amount} onChange={(e) => setChargeForm((f) => ({ ...f, unit_amount: e.target.value }))} hint="Leave blank to use the price-list rate." />
          <DxTextarea label="Notes" fieldClassName="dx-col-span-full" rows={2} value={chargeForm.notes} onChange={(e) => setChargeForm((f) => ({ ...f, notes: e.target.value }))} />
        </DxForm>
      </DxPopup>

      <DxPopup isOpen={form === "certificate"} onClose={closeForm} title="Issue death certificate" locked={issueCert.isPending}
        footer={<><DxButton onClick={closeForm}>Cancel</DxButton><DxButton variant="primary" isLoading={issueCert.isPending} onClick={() => issueCert.mutate()}>Issue</DxButton></>}>
        <DxForm cols={2}>
          <DxInput label="Certifying doctor" value={certForm.certifying_doctor} onChange={(e) => setCertForm((f) => ({ ...f, certifying_doctor: e.target.value }))} />
          <DxInput label="Issued by" value={certForm.issued_by} onChange={(e) => setCertForm((f) => ({ ...f, issued_by: e.target.value }))} />
          <DxTextarea label="Cause of death" fieldClassName="dx-col-span-full" rows={2} value={certForm.cause_of_death} onChange={(e) => setCertForm((f) => ({ ...f, cause_of_death: e.target.value }))} />
          <DxSelect label="Manner of death" value={certForm.manner_of_death} onChange={(e) => setCertForm((f) => ({ ...f, manner_of_death: e.target.value }))} options={MANNER_OF_DEATH_OPTIONS} placeholder="Select…" />
          <DxInput label="Place of death" value={certForm.place_of_death} onChange={(e) => setCertForm((f) => ({ ...f, place_of_death: e.target.value }))} />
          <DxTextarea label="Notes" fieldClassName="dx-col-span-full" rows={2} value={certForm.notes} onChange={(e) => setCertForm((f) => ({ ...f, notes: e.target.value }))} />
        </DxForm>
      </DxPopup>
    </DxPage>
  );
}
