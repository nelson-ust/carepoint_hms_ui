import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileCheck2, Landmark, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { useToast } from "@/components/feedback/ToastProvider";
import { financeExtApi, fmtNaira, downloadBlob } from "../api/finance-ext.api";
import {
  statutoryApi, type StatutoryPosition, type StatutoryRemittance, type WhtRecord,
} from "../api/statutory.api";

type Tab = "positions" | "remittances" | "wht" | "schedules";

const currentPeriod = () => new Date().toISOString().slice(0, 7);

const TYPE_LABELS: Record<string, string> = {
  PAYE: "PAYE (staff income tax)",
  PENSION: "Pension contributions",
  NHF: "National Housing Fund",
  WHT: "Withholding tax",
  VAT: "Value added tax",
  OTHER: "Other deductions",
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
  const remittances = useQuery({
    queryKey: ["stat", "remittances"],
    queryFn: () => statutoryApi.listRemittances(),
    enabled: tab === "remittances",
  });
  const whtRegister = useQuery({
    queryKey: ["stat", "wht", period],
    queryFn: () => statutoryApi.whtRegister({ period_code: period }),
    enabled: tab === "wht",
  });
  const schedule = useQuery({
    queryKey: ["stat", "schedule", scheduleKind, period],
    queryFn: () => statutoryApi.schedule(scheduleKind, period),
    enabled: tab === "schedules",
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["stat"] });

  const remitColumns: DataTableColumn<StatutoryRemittance>[] = [
    { key: "remittance_type", header: "Type",
      render: (r) => <Badge variant="soft-info">{r.remittance_type}</Badge> },
    { key: "period_code", header: "Period" },
    { key: "authority", header: "Authority", render: (r) => r.authority ?? "—" },
    { key: "amount", header: "Amount", align: "right",
      render: (r) => <span className="font-semibold">{fmtNaira(r.amount)}</span> },
    { key: "paid_at", header: "Paid" },
    { key: "reference", header: "Reference", render: (r) => r.reference ?? "—" },
  ];

  const whtColumns: DataTableColumn<WhtRecord>[] = [
    { key: "payee_name", header: "Payee", render: (r) => (
        <div>
          <div className="font-semibold">{r.payee_name}</div>
          <div className="text-xs text-secondary-500">
            {r.payee_tax_id ?? "no TIN"} · {r.payee_kind ?? "—"}
          </div>
        </div>) },
    { key: "gross_amount", header: "Gross", align: "right", render: (r) => fmtNaira(r.gross_amount) },
    { key: "rate_percent", header: "Rate", align: "right",
      render: (r) => `${parseFloat(r.rate_percent)}%` },
    { key: "wht_amount", header: "WHT", align: "right",
      render: (r) => <span className="font-semibold">{fmtNaira(r.wht_amount)}</span> },
    { key: "status", header: "Status", render: (r) => (
        <Badge variant={r.status === "REMITTED" || r.status === "CERTIFICATE_ISSUED"
          ? "soft-success" : "soft-warning"}>{r.status.replace(/_/g, " ")}</Badge>) },
    { key: "cert", header: "", align: "right", render: (r) => (
        (r.status === "REMITTED") ? (
          <Button size="sm" variant="ghost" onClick={() => setCertFor(r)}>
            <FileCheck2 className="mr-1 h-4 w-4" /> Certificate
          </Button>
        ) : r.certificate_no ? (
          <span className="text-xs text-secondary-500">{r.certificate_no}</span>
        ) : null) },
  ];

  return (
    <div>
      <PageHeader title="Statutory Remittances"
        description="PAYE, pension, NHF, WHT and VAT — what has accrued, what has been remitted, and the filing schedules."
        actions={<Button variant="secondary" onClick={() => setWhtModal(true)}>
          <Plus className="mr-1 h-4 w-4" /> Record WHT
        </Button>} />

      <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-secondary-100 p-1 sm:w-fit">
        {([["positions", "Positions"], ["remittances", "Remittances"],
           ["wht", "WHT register"], ["schedules", "Filing schedules"]] as [Tab, string][])
          .map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === t ? "bg-white text-secondary-900 shadow-sm"
                        : "text-secondary-500 hover:text-secondary-800"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "positions" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(positions.data ?? []).map((p) => (
            <Card key={p.type} className="p-5">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-semibold text-secondary-900">
                  {TYPE_LABELS[p.type] ?? p.type}
                </h3>
                <Landmark className="h-4 w-4 text-secondary-400" />
              </div>
              <p className="mb-3 text-xs text-secondary-500">{p.account}</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Accrued</span>
                  <span>{fmtNaira(p.accrued)}</span></div>
                <div className="flex justify-between"><span>Remitted</span>
                  <span>{fmtNaira(p.remitted)}</span></div>
                <div className="flex justify-between border-t border-secondary-200 pt-1 font-semibold">
                  <span>Outstanding</span>
                  <span className={parseFloat(p.outstanding) > 0 ? "text-warning-600" : "text-success-600"}>
                    {fmtNaira(p.outstanding)}
                  </span>
                </div>
                {p.type === "WHT" && (p.wht_pending_records ?? 0) > 0 && (
                  <p className="text-xs text-secondary-500">
                    {p.wht_pending_records} un-remitted WHT record(s) · {fmtNaira(p.wht_pending_value)}
                  </p>
                )}
                {p.last_remitted_at && (
                  <p className="text-xs text-secondary-400">Last remitted {p.last_remitted_at}</p>
                )}
              </div>
              <Button className="mt-4 w-full" size="sm"
                disabled={parseFloat(p.outstanding) <= 0}
                onClick={() => setRemitFor(p)}>
                Remit {p.type}
              </Button>
            </Card>
          ))}
          {positions.isLoading && <Card className="p-5 text-secondary-500">Loading…</Card>}
        </div>
      )}

      {tab === "remittances" && (
        <Card className="p-4">
          <DataTable columns={remitColumns} data={remittances.data} rowKey={(r) => r.id}
            isLoading={remittances.isLoading}
            error={remittances.isError ? "Could not load remittances." : null}
            onRetry={() => remittances.refetch()}
            empty={{ title: "No remittances yet",
              description: "Record PAYE, pension, NHF, WHT or VAT payments from the Positions tab." }} />
        </Card>
      )}

      {tab === "wht" && (
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <Input label="Period" type="month" value={period}
              onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <DataTable columns={whtColumns} data={whtRegister.data} rowKey={(r) => r.id}
            isLoading={whtRegister.isLoading}
            error={whtRegister.isError ? "Could not load the WHT register." : null}
            onRetry={() => whtRegister.refetch()}
            empty={{ title: "No WHT in this period",
              description: "WHT appears here automatically when you withhold on vendor payments, or record it manually." }} />
        </Card>
      )}

      {tab === "schedules" && (
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <Select label="Schedule" value={scheduleKind}
              onChange={(e) => setScheduleKind(e.target.value)}
              options={[{ value: "PAYE", label: "PAYE (per staff)" },
                        { value: "PENSION", label: "Pension (per staff + PFA)" },
                        { value: "NHF", label: "NHF (per staff)" },
                        { value: "WHT", label: "WHT (per payee)" }]} />
            <Input label="Period" type="month" value={period}
              onChange={(e) => setPeriod(e.target.value)} />
            <Button variant="secondary" onClick={() =>
              statutoryApi.scheduleXlsx(scheduleKind, period)
                .then((b) => downloadBlob(b, `${scheduleKind.toLowerCase()}_schedule_${period}.xlsx`))
                .catch(() => toast.error("Could not download the schedule."))}>
              <Download className="mr-1 h-4 w-4" /> Download XLSX
            </Button>
            <span className="pb-2 text-sm text-secondary-500">
              {schedule.data ? `${schedule.data.count} row(s) · total ${fmtNaira(schedule.data.total)}` : ""}
            </span>
          </div>
          <DataTable
            columns={(schedule.data?.rows?.length
              ? Object.keys(schedule.data.rows[0]).map((k) => ({
                  key: k, header: k.replace(/_/g, " ").toUpperCase(),
                  align: (k.includes("amount") || k.includes("pay") ? "right" : "left") as "left" | "right",
                  render: (r: Record<string, string | number | null>) =>
                    k.includes("amount") || k.includes("pay")
                      ? fmtNaira(r[k] as string) : String(r[k] ?? "—"),
                }))
              : [])}
            data={schedule.data?.rows} rowKey={(_, i) => i}
            isLoading={schedule.isLoading}
            error={schedule.isError ? "Could not load the schedule." : null}
            onRetry={() => schedule.refetch()}
            empty={{ title: `No ${scheduleKind} entries for ${period}` }} />
        </Card>
      )}

      {remitFor && (
        <RemitModal position={remitFor} onClose={() => setRemitFor(null)}
          onSaved={(msg) => { setRemitFor(null); invalidate(); toast.success(msg); }} />
      )}
      {whtModal && (
        <WhtModal onClose={() => setWhtModal(false)}
          onSaved={() => { setWhtModal(false); invalidate(); }} />
      )}
      {certFor && (
        <CertificateModal record={certFor} onClose={() => setCertFor(null)}
          onSaved={() => { setCertFor(null); invalidate(); }} />
      )}
    </div>
  );
}

function RemitModal({ position, onClose, onSaved }: {
  position: StatutoryPosition; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const toast = useToast();
  const banks = useQuery({ queryKey: ["fin", "banks"], queryFn: financeExtApi.listBankAccounts });
  const [form, setForm] = useState({
    period_code: currentPeriod(),
    paid_at: new Date().toISOString().slice(0, 10),
    amount: position.outstanding,
    bank_account_id: "",
    authority: position.default_authority,
    reference: "",
  });
  const [busy, setBusy] = useState(false);
  return (
    <Modal isOpen onClose={onClose} title={`Remit ${position.type}`}
      footer={<div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={busy || !form.amount} onClick={() => {
          setBusy(true);
          statutoryApi.createRemittance({
            remittance_type: position.type,
            period_code: form.period_code,
            paid_at: form.paid_at,
            amount: Number(form.amount),
            bank_account_id: form.bank_account_id ? Number(form.bank_account_id) : undefined,
            authority: form.authority || undefined,
            reference: form.reference || undefined,
          }).then((r) => onSaved(
              `${position.type} ${r.period_code} remitted — ${fmtNaira(r.amount)} posted to the ledger` +
              (r.wht_records_marked ? `; ${r.wht_records_marked} WHT record(s) marked remitted.` : ".")))
            .catch((e) => toast.error(e?.response?.data?.detail ?? "Remittance failed."))
            .finally(() => setBusy(false));
        }}>
          {busy ? "Posting…" : "Record remittance"}
        </Button>
      </div>}>
      <p className="mb-4 rounded-lg bg-secondary-50 p-3 text-sm text-secondary-600">
        Outstanding {position.type}: <strong>{fmtNaira(position.outstanding)}</strong>.
        Posting clears the payable ({position.account}) against the bank.
        {position.type === "WHT" &&
          " All un-remitted WHT records deducted in the period will be marked REMITTED."}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Period" type="month" value={form.period_code}
          onChange={(e) => setForm((f) => ({ ...f, period_code: e.target.value }))} />
        <Input label="Paid on" type="date" value={form.paid_at}
          onChange={(e) => setForm((f) => ({ ...f, paid_at: e.target.value }))} />
        <Input label="Amount (₦)" type="number" value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
        <Select label="Paid from" value={form.bank_account_id}
          onChange={(e) => setForm((f) => ({ ...f, bank_account_id: e.target.value }))}
          options={[{ value: "", label: "Default bank account" },
            ...(banks.data ?? []).map((b) => ({ value: String(b.id),
              label: `${b.name} (${fmtNaira(b.balance)})` }))]} />
        <Input label="Authority" value={form.authority} className="sm:col-span-2"
          onChange={(e) => setForm((f) => ({ ...f, authority: e.target.value }))} />
        <Input label="Payment reference / receipt no" value={form.reference}
          className="sm:col-span-2"
          onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} />
      </div>
    </Modal>
  );
}

function WhtModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ payee_name: "", payee_tax_id: "",
    gross_amount: "", rate_percent: "5", payee_kind: "VENDOR", notes: "" });
  const wht = (parseFloat(form.gross_amount) || 0) * (parseFloat(form.rate_percent) || 0) / 100;
  return (
    <Modal isOpen onClose={onClose} title="Record withholding tax"
      footer={<div className="flex w-full items-center justify-between">
        <span className="text-sm text-secondary-500">WHT: <strong>{fmtNaira(wht)}</strong></span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!form.payee_name || !form.gross_amount} onClick={() =>
            statutoryApi.recordWht({
              payee_name: form.payee_name,
              payee_tax_id: form.payee_tax_id || undefined,
              gross_amount: Number(form.gross_amount),
              rate_percent: Number(form.rate_percent),
              payee_kind: form.payee_kind, notes: form.notes || undefined })
              .then(() => { toast.success("WHT recorded in the register."); onSaved(); })
              .catch((e) => toast.error(e?.response?.data?.detail ?? "Failed."))}>
            Record
          </Button>
        </div>
      </div>}>
      <p className="mb-4 text-sm text-secondary-500">
        Tip: WHT on vendor bill payments is captured automatically when you pay with a
        WHT rate (Accounts Payable). Use this form for withholding outside that flow
        (rent, professional fees paid directly, etc.).
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Payee" value={form.payee_name}
          onChange={(e) => setForm((f) => ({ ...f, payee_name: e.target.value }))} />
        <Input label="Payee TIN" value={form.payee_tax_id}
          onChange={(e) => setForm((f) => ({ ...f, payee_tax_id: e.target.value }))} />
        <Input label="Gross amount (₦)" type="number" value={form.gross_amount}
          onChange={(e) => setForm((f) => ({ ...f, gross_amount: e.target.value }))} />
        <Select label="Rate" value={form.rate_percent}
          onChange={(e) => setForm((f) => ({ ...f, rate_percent: e.target.value }))}
          options={[{ value: "5", label: "5% — services / supplies" },
                    { value: "10", label: "10% — professional fees / rent (company)" },
                    { value: "2.5", label: "2.5% — construction" }]} />
        <Input label="Notes" value={form.notes} className="sm:col-span-2"
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
      </div>
    </Modal>
  );
}

function CertificateModal({ record, onClose, onSaved }: {
  record: WhtRecord; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({ certificate_no: "", certificate_url: "" });
  return (
    <Modal isOpen onClose={onClose} title={`WHT certificate — ${record.payee_name}`}
      footer={<div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={!form.certificate_no && !form.certificate_url} onClick={() =>
          statutoryApi.attachCertificate(record.id, {
            certificate_no: form.certificate_no || undefined,
            certificate_url: form.certificate_url || undefined })
            .then(() => { toast.success("Certificate recorded."); onSaved(); })
            .catch((e) => toast.error(e?.response?.data?.detail ?? "Failed."))}>
          Save certificate
        </Button>
      </div>}>
      <div className="space-y-4">
        <Input label="Certificate number" value={form.certificate_no}
          onChange={(e) => setForm((f) => ({ ...f, certificate_no: e.target.value }))} />
        <Input label="Certificate URL (scan)" value={form.certificate_url}
          onChange={(e) => setForm((f) => ({ ...f, certificate_url: e.target.value }))} />
      </div>
    </Modal>
  );
}
