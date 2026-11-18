import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileCheck2, Landmark, Plus } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxButton, DxBadge, DxInput, DxSelect, DxPopup,
  DxTabs, DxGrid, type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { financeExtApi, fmtNaira, downloadBlob } from "../api/finance-ext.api";
import { statutoryApi, type StatutoryPosition, type StatutoryRemittance, type WhtRecord } from "../api/statutory.api";

type Tab = "positions" | "remittances" | "wht" | "schedules";

const currentPeriod = () => new Date().toISOString().slice(0, 7);

const TYPE_LABELS: Record<string, string> = {
  PAYE: "PAYE (staff income tax)", PENSION: "Pension contributions", NHF: "National Housing Fund",
  WHT: "Withholding tax", VAT: "Value added tax", OTHER: "Other deductions",
};

export function StatutoryPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("positions");
  const [remitFor, setRemitFor] = useState<StatutoryPosition | null>(null);
  const [certFor, setCertFor] = useState<WhtRecord | null>(null);
  const [whtModal, setWhtModal] = useState(false);
  const [period, setPeriod] = useState(currentPeriod());
  const [scheduleKind, setScheduleKind] = useState("PAYE");

  const positions = useQuery({ queryKey: ["stat", "positions"], queryFn: statutoryApi.positions });
  const remittances = useQuery({ queryKey: ["stat", "remittances"], queryFn: () => statutoryApi.listRemittances(), enabled: tab === "remittances" });
  const whtRegister = useQuery({ queryKey: ["stat", "wht", period], queryFn: () => statutoryApi.whtRegister({ period_code: period }), enabled: tab === "wht" });
  const schedule = useQuery({ queryKey: ["stat", "schedule", scheduleKind, period], queryFn: () => statutoryApi.schedule(scheduleKind, period), enabled: tab === "schedules" });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["stat"] });

  const remitColumns: DxGridColumn<StatutoryRemittance>[] = [
    { key: "remittance_type", header: "Type", render: (r) => <DxBadge tone="info">{r.remittance_type}</DxBadge> },
    { key: "period_code", header: "Period" },
    { key: "authority", header: "Authority", render: (r) => r.authority ?? "—" },
    { key: "amount", header: "Amount", align: "right", render: (r) => <span className="dx-mono font-semibold">{fmtNaira(r.amount)}</span> },
    { key: "paid_at", header: "Paid" },
    { key: "reference", header: "Reference", render: (r) => r.reference ?? "—" },
  ];

  const whtColumns: DxGridColumn<WhtRecord>[] = [
    { key: "payee_name", header: "Payee", render: (r) => (
        <div>
          <div className="font-semibold text-[var(--dx-text)]">{r.payee_name}</div>
          <div className="text-[11.5px] text-[var(--dx-text-muted)]">{r.payee_tax_id ?? "no TIN"} · {r.payee_kind ?? "—"}</div>
        </div>) },
    { key: "gross_amount", header: "Gross", align: "right", render: (r) => <span className="dx-mono">{fmtNaira(r.gross_amount)}</span> },
    { key: "rate_percent", header: "Rate", align: "right", render: (r) => `${parseFloat(r.rate_percent)}%` },
    { key: "wht_amount", header: "WHT", align: "right", render: (r) => <span className="dx-mono font-semibold">{fmtNaira(r.wht_amount)}</span> },
    { key: "status", header: "Status", render: (r) => <DxBadge tone={r.status === "REMITTED" || r.status === "CERTIFICATE_ISSUED" ? "success" : "warning"}>{r.status.replace(/_/g, " ")}</DxBadge> },
    { key: "cert", header: "", align: "right", render: (r) =>
        r.status === "REMITTED" ? (
          <DxButton size="sm" variant="text" leftIcon={<FileCheck2 className="h-4 w-4" />} onClick={() => setCertFor(r)}>Certificate</DxButton>
        ) : r.certificate_no ? <span className="text-[11.5px] text-[var(--dx-text-muted)]">{r.certificate_no}</span> : null },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Accounting" }, { label: "Statutory" }]}
        title="Statutory Remittances"
        subtitle="PAYE, pension, NHF, WHT and VAT — what has accrued, what has been remitted, and the filing schedules."
        actions={<DxButton variant="default" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setWhtModal(true)}>Record WHT</DxButton>}
      />

      <DxTabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { key: "positions", label: "Positions" },
          { key: "remittances", label: "Remittances" },
          { key: "wht", label: "WHT register" },
          { key: "schedules", label: "Filing schedules" },
        ]}
      />

      {tab === "positions" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(positions.data ?? []).map((p) => (
            <DxPanel key={p.type}>
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-semibold text-[var(--dx-text)]">{TYPE_LABELS[p.type] ?? p.type}</h3>
                <Landmark className="h-4 w-4 text-[var(--dx-text-faint)]" />
              </div>
              <p className="mb-3 text-[11.5px] text-[var(--dx-text-muted)]">{p.account}</p>
              <div className="space-y-1 text-[13px]">
                <div className="flex justify-between"><span className="text-[var(--dx-text-muted)]">Accrued</span><span className="dx-mono">{fmtNaira(p.accrued)}</span></div>
                <div className="flex justify-between"><span className="text-[var(--dx-text-muted)]">Remitted</span><span className="dx-mono">{fmtNaira(p.remitted)}</span></div>
                <div className="flex justify-between border-t border-[var(--dx-border)] pt-1 font-semibold">
                  <span className="text-[var(--dx-text)]">Outstanding</span>
                  <span className={`dx-mono ${parseFloat(p.outstanding) > 0 ? "text-[var(--dx-warning,#d97706)]" : "text-[var(--dx-success,#10b981)]"}`}>{fmtNaira(p.outstanding)}</span>
                </div>
                {p.type === "WHT" && (p.wht_pending_records ?? 0) > 0 && (
                  <p className="text-[11.5px] text-[var(--dx-text-muted)]">{p.wht_pending_records} un-remitted WHT record(s) · {fmtNaira(p.wht_pending_value)}</p>
                )}
                {p.last_remitted_at && <p className="text-[11.5px] text-[var(--dx-text-faint)]">Last remitted {p.last_remitted_at}</p>}
              </div>
              <DxButton className="mt-4 w-full" size="sm" variant="primary" disabled={parseFloat(p.outstanding) <= 0} onClick={() => setRemitFor(p)}>Remit {p.type}</DxButton>
            </DxPanel>
          ))}
          {positions.isLoading && <DxPanel><span className="text-[13px] text-[var(--dx-text-muted)]">Loading…</span></DxPanel>}
        </div>
      )}

      {tab === "remittances" && (
        <DxPanel flush>
          <DxGrid<StatutoryRemittance>
            borderless columns={remitColumns} data={remittances.data} rowKey={(r) => r.id} isLoading={remittances.isLoading}
            error={remittances.isError ? "Could not load remittances." : null}
            onRetry={() => remittances.refetch()}
            empty={{ title: "No remittances yet", description: "Record PAYE, pension, NHF, WHT or VAT payments from the Positions tab." }}
          />
        </DxPanel>
      )}

      {tab === "wht" && (
        <DxPanel flush>
          <div className="flex flex-wrap items-end gap-3 px-4 py-3">
            <DxInput label="Period" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <DxGrid<WhtRecord>
            borderless columns={whtColumns} data={whtRegister.data} rowKey={(r) => r.id} isLoading={whtRegister.isLoading}
            error={whtRegister.isError ? "Could not load the WHT register." : null}
            onRetry={() => whtRegister.refetch()}
            empty={{ title: "No WHT in this period", description: "WHT appears here automatically when you withhold on vendor payments, or record it manually." }}
          />
        </DxPanel>
      )}

      {tab === "schedules" && (
        <DxPanel flush>
          <div className="flex flex-wrap items-end gap-3 px-4 py-3">
            <DxSelect label="Schedule" value={scheduleKind} onChange={(e) => setScheduleKind(e.target.value)}
              options={[{ value: "PAYE", label: "PAYE (per staff)" }, { value: "PENSION", label: "Pension (per staff + PFA)" }, { value: "NHF", label: "NHF (per staff)" }, { value: "WHT", label: "WHT (per payee)" }]} />
            <DxInput label="Period" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
            <DxButton variant="default" leftIcon={<Download className="h-4 w-4" />} onClick={() =>
              statutoryApi.scheduleXlsx(scheduleKind, period).then((b) => downloadBlob(b, `${scheduleKind.toLowerCase()}_schedule_${period}.xlsx`)).catch(() => toast.error("Could not download the schedule."))}>Download XLSX</DxButton>
            <span className="pb-2 text-[13px] text-[var(--dx-text-muted)]">{schedule.data ? `${schedule.data.count} row(s) · total ${fmtNaira(schedule.data.total)}` : ""}</span>
          </div>
          <DxGrid<Record<string, string | number | null>>
            borderless
            columns={(schedule.data?.rows?.length
              ? Object.keys(schedule.data.rows[0]).map((k) => ({
                  key: k, header: k.replace(/_/g, " ").toUpperCase(),
                  align: (k.includes("amount") || k.includes("pay") ? "right" : "left") as "left" | "right",
                  render: (r: Record<string, string | number | null>) =>
                    k.includes("amount") || k.includes("pay") ? <span className="dx-mono">{fmtNaira(r[k] as string)}</span> : String(r[k] ?? "—"),
                }))
              : [])}
            data={schedule.data?.rows} rowKey={(_, i) => i} isLoading={schedule.isLoading}
            error={schedule.isError ? "Could not load the schedule." : null}
            onRetry={() => schedule.refetch()}
            empty={{ title: `No ${scheduleKind} entries for ${period}` }}
          />
        </DxPanel>
      )}

      {remitFor && <RemitModal position={remitFor} onClose={() => setRemitFor(null)} onSaved={(msg) => { setRemitFor(null); invalidate(); toast.success(msg); }} />}
      {whtModal && <WhtModal onClose={() => setWhtModal(false)} onSaved={() => { setWhtModal(false); invalidate(); }} />}
      {certFor && <CertificateModal record={certFor} onClose={() => setCertFor(null)} onSaved={() => { setCertFor(null); invalidate(); }} />}
    </DxPage>
  );
}

function RemitModal({ position, onClose, onSaved }: {
  position: StatutoryPosition; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const toast = useToast();
  const banks = useQuery({ queryKey: ["fin", "banks"], queryFn: financeExtApi.listBankAccounts });
  const [form, setForm] = useState({
    period_code: currentPeriod(), paid_at: new Date().toISOString().slice(0, 10),
    amount: position.outstanding, bank_account_id: "", authority: position.default_authority, reference: "",
  });
  const [busy, setBusy] = useState(false);
  return (
    <DxPopup isOpen onClose={onClose} title={`Remit ${position.type}`} size="md"
      footer={<>
        <DxButton variant="text" onClick={onClose}>Cancel</DxButton>
        <DxButton variant="primary" disabled={busy || !form.amount} isLoading={busy} onClick={() => {
          setBusy(true);
          statutoryApi.createRemittance({
            remittance_type: position.type, period_code: form.period_code, paid_at: form.paid_at,
            amount: Number(form.amount), bank_account_id: form.bank_account_id ? Number(form.bank_account_id) : undefined,
            authority: form.authority || undefined, reference: form.reference || undefined,
          }).then((r) => onSaved(`${position.type} ${r.period_code} remitted — ${fmtNaira(r.amount)} posted to the ledger` + (r.wht_records_marked ? `; ${r.wht_records_marked} WHT record(s) marked remitted.` : ".")))
            .catch((e) => toast.error(e?.response?.data?.detail ?? "Remittance failed."))
            .finally(() => setBusy(false));
        }}>Record remittance</DxButton>
      </>}>
      <p className="mb-4 rounded-md bg-[var(--dx-surface-sunken)] p-3 text-[13px] text-[var(--dx-text-muted)]">
        Outstanding {position.type}: <strong className="text-[var(--dx-text)]">{fmtNaira(position.outstanding)}</strong>. Posting clears the payable ({position.account}) against the bank.
        {position.type === "WHT" && " All un-remitted WHT records deducted in the period will be marked REMITTED."}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DxInput label="Period" type="month" value={form.period_code} onChange={(e) => setForm((f) => ({ ...f, period_code: e.target.value }))} />
        <DxInput label="Paid on" type="date" value={form.paid_at} onChange={(e) => setForm((f) => ({ ...f, paid_at: e.target.value }))} />
        <DxInput label="Amount (₦)" type="number" mono value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
        <DxSelect label="Paid from" value={form.bank_account_id} onChange={(e) => setForm((f) => ({ ...f, bank_account_id: e.target.value }))}
          options={[{ value: "", label: "Default bank account" }, ...(banks.data ?? []).map((b) => ({ value: String(b.id), label: `${b.name} (${fmtNaira(b.balance)})` }))]} />
        <div className="sm:col-span-2"><DxInput label="Authority" value={form.authority} onChange={(e) => setForm((f) => ({ ...f, authority: e.target.value }))} /></div>
        <div className="sm:col-span-2"><DxInput label="Payment reference / receipt no" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} /></div>
      </div>
    </DxPopup>
  );
}

function WhtModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ payee_name: "", payee_tax_id: "", gross_amount: "", rate_percent: "5", payee_kind: "VENDOR", notes: "" });
  const wht = (parseFloat(form.gross_amount) || 0) * (parseFloat(form.rate_percent) || 0) / 100;
  return (
    <DxPopup isOpen onClose={onClose} title="Record withholding tax" size="md"
      footer={<div className="flex w-full items-center justify-between">
        <span className="text-[13px] text-[var(--dx-text-muted)]">WHT: <strong className="text-[var(--dx-text)]">{fmtNaira(wht)}</strong></span>
        <div className="flex gap-2">
          <DxButton variant="text" onClick={onClose}>Cancel</DxButton>
          <DxButton variant="primary" disabled={!form.payee_name || !form.gross_amount} onClick={() =>
            statutoryApi.recordWht({ payee_name: form.payee_name, payee_tax_id: form.payee_tax_id || undefined, gross_amount: Number(form.gross_amount), rate_percent: Number(form.rate_percent), payee_kind: form.payee_kind, notes: form.notes || undefined })
              .then(() => { toast.success("WHT recorded in the register."); onSaved(); })
              .catch((e) => toast.error(e?.response?.data?.detail ?? "Failed."))}>Record</DxButton>
        </div>
      </div>}>
      <p className="mb-4 text-[13px] text-[var(--dx-text-muted)]">
        Tip: WHT on vendor bill payments is captured automatically when you pay with a WHT rate (Accounts Payable). Use this form for withholding outside that flow (rent, professional fees paid directly, etc.).
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DxInput label="Payee" value={form.payee_name} onChange={(e) => setForm((f) => ({ ...f, payee_name: e.target.value }))} />
        <DxInput label="Payee TIN" value={form.payee_tax_id} onChange={(e) => setForm((f) => ({ ...f, payee_tax_id: e.target.value }))} />
        <DxInput label="Gross amount (₦)" type="number" mono value={form.gross_amount} onChange={(e) => setForm((f) => ({ ...f, gross_amount: e.target.value }))} />
        <DxSelect label="Rate" value={form.rate_percent} onChange={(e) => setForm((f) => ({ ...f, rate_percent: e.target.value }))}
          options={[{ value: "5", label: "5% — services / supplies" }, { value: "10", label: "10% — professional fees / rent (company)" }, { value: "2.5", label: "2.5% — construction" }]} />
        <div className="sm:col-span-2"><DxInput label="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
      </div>
    </DxPopup>
  );
}

function CertificateModal({ record, onClose, onSaved }: {
  record: WhtRecord; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({ certificate_no: "", certificate_url: "" });
  return (
    <DxPopup isOpen onClose={onClose} title={`WHT certificate — ${record.payee_name}`} size="md"
      footer={<>
        <DxButton variant="text" onClick={onClose}>Cancel</DxButton>
        <DxButton variant="primary" disabled={!form.certificate_no && !form.certificate_url} onClick={() =>
          statutoryApi.attachCertificate(record.id, { certificate_no: form.certificate_no || undefined, certificate_url: form.certificate_url || undefined })
            .then(() => { toast.success("Certificate recorded."); onSaved(); })
            .catch((e) => toast.error(e?.response?.data?.detail ?? "Failed."))}>Save certificate</DxButton>
      </>}>
      <div className="space-y-4">
        <DxInput label="Certificate number" value={form.certificate_no} onChange={(e) => setForm((f) => ({ ...f, certificate_no: e.target.value }))} />
        <DxInput label="Certificate URL (scan)" value={form.certificate_url} onChange={(e) => setForm((f) => ({ ...f, certificate_url: e.target.value }))} />
      </div>
    </DxPopup>
  );
}
