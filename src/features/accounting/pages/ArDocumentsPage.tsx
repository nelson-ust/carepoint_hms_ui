import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ReceiptText, Undo2 } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxButton, DxBadge, DxInput, DxSelect, DxPopup,
  DxGrid, type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { financeExtApi, fmtNaira, type CreditNote, type Refund } from "../api/finance-ext.api";
import { PatientPicker, InvoicePicker } from "@/components/forms/pickers";
import type { EntityOption } from "@/components/forms/EntityPicker";

export function ArDocumentsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [cnModal, setCnModal] = useState(false);
  const [refundModal, setRefundModal] = useState(false);
  const [writeOffModal, setWriteOffModal] = useState(false);

  const creditNotes = useQuery({ queryKey: ["fin", "cns"], queryFn: () => financeExtApi.listCreditNotes() });
  const refunds = useQuery({ queryKey: ["fin", "refunds"], queryFn: financeExtApi.listRefunds });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["fin"] });

  const cnColumns: DxGridColumn<CreditNote>[] = [
    { key: "credit_note_no", header: "Credit note" },
    { key: "invoice_no", header: "Invoice", render: (r) => r.invoice_no ?? `#${r.invoice_id}` },
    { key: "reason", header: "Reason", render: (r) => r.reason ?? "—" },
    { key: "total_amount", header: "Amount", align: "right", render: (r) => <span className="dx-mono">{fmtNaira(r.total_amount)}</span> },
    { key: "status", header: "Status", render: (r) => (
        <DxBadge tone={r.status === "APPLIED" || r.status === "ISSUED" ? "success" : r.status === "CANCELLED" ? "danger" : "neutral"}>{r.status}</DxBadge>) },
    { key: "act", header: "", align: "right", render: (r) => r.status === "DRAFT" ? (
        <DxButton size="sm" variant="primary" onClick={() => financeExtApi.issueCreditNote(r.id)
          .then(() => { toast.success("Credit note issued and posted."); invalidate(); })
          .catch((e) => toast.error(e?.response?.data?.detail ?? "Failed."))}>Issue</DxButton>) : null },
  ];

  const refundColumns: DxGridColumn<Refund>[] = [
    { key: "refund_no", header: "Refund" },
    { key: "amount", header: "Amount", align: "right", render: (r) => <span className="dx-mono">{fmtNaira(r.amount)}</span> },
    { key: "reason", header: "Reason", render: (r) => r.reason ?? "—" },
    { key: "status", header: "Status", render: (r) => (
        <DxBadge tone={r.status === "PAID" ? "success" : r.status === "CANCELLED" ? "danger" : "warning"}>{r.status}</DxBadge>) },
    { key: "act", header: "", align: "right", render: (r) => r.status === "PENDING" ? (
        <DxButton size="sm" variant="primary" onClick={() => financeExtApi.payRefund(r.id)
          .then(() => { toast.success("Refund paid."); invalidate(); })
          .catch((e) => toast.error(e?.response?.data?.detail ?? "Failed."))}>Pay out</DxButton>) : null },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Accounting" }, { label: "Credit Notes" }]}
        title="Credit Notes & Refunds"
        subtitle="Adjust invoices, return money and write off bad debt — every action posts to the ledger."
        actions={
          <>
            <DxButton variant="default" leftIcon={<Undo2 className="h-4 w-4" />} onClick={() => setWriteOffModal(true)}>Write off invoice</DxButton>
            <DxButton variant="default" onClick={() => setRefundModal(true)}>Refund</DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCnModal(true)}>Credit note</DxButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <DxPanel title="Credit notes" icon={<ReceiptText className="h-4 w-4" />} flush>
          <DxGrid<CreditNote>
            borderless columns={cnColumns} data={creditNotes.data} rowKey={(r) => r.id} isLoading={creditNotes.isLoading}
            error={creditNotes.isError ? "Could not load credit notes." : null}
            onRetry={() => creditNotes.refetch()} empty={{ title: "No credit notes" }}
          />
        </DxPanel>
        <DxPanel title="Refunds" flush>
          <DxGrid<Refund>
            borderless columns={refundColumns} data={refunds.data} rowKey={(r) => r.id} isLoading={refunds.isLoading}
            error={refunds.isError ? "Could not load refunds." : null}
            onRetry={() => refunds.refetch()} empty={{ title: "No refunds" }}
          />
        </DxPanel>
      </div>

      {cnModal && <CreditNoteModal onClose={() => setCnModal(false)} onSaved={() => { setCnModal(false); invalidate(); }} />}
      {refundModal && <RefundModal onClose={() => setRefundModal(false)} onSaved={() => { setRefundModal(false); invalidate(); }} />}
      {writeOffModal && <WriteOffModal onClose={() => setWriteOffModal(false)} onSaved={() => { setWriteOffModal(false); invalidate(); }} />}
    </DxPage>
  );
}

function CreditNoteModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [patient, setPatient] = useState<EntityOption | null>(null);
  const [invoice, setInvoice] = useState<EntityOption | null>(null);
  const [form, setForm] = useState({ amount: "", reason: "" });
  const [busy, setBusy] = useState(false);
  return (
    <DxPopup isOpen onClose={onClose} title="Draft a credit note" size="md"
      footer={<>
        <DxButton variant="text" onClick={onClose}>Cancel</DxButton>
        <DxButton variant="primary" disabled={!invoice || !form.amount || busy} isLoading={busy} onClick={() => {
          setBusy(true);
          financeExtApi.createCreditNote({ invoice_id: invoice!.value, reason: form.reason || undefined,
            items: [{ amount: Number(form.amount), description: form.reason || undefined }] })
            .then(onSaved).catch((e) => toast.error(e?.response?.data?.detail ?? "Failed.")).finally(() => setBusy(false));
        }}>Create draft</DxButton>
      </>}>
      <div className="space-y-4">
        <PatientPicker value={patient} onChange={(o) => { setPatient(o); setInvoice(null); }} hint="Search by name, hospital number or phone." />
        <InvoicePicker patientId={patient?.value ?? null} value={invoice} onChange={setInvoice} hint="The invoice being adjusted — its balance is shown." />
        <DxInput label="Amount to credit (₦)" type="number" mono value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
        <DxInput label="Reason" value={form.reason} placeholder="e.g. overbilled dressing" onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
      </div>
    </DxPopup>
  );
}

function RefundModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const banks = useQuery({ queryKey: ["fin", "banks"], queryFn: financeExtApi.listBankAccounts });
  const [patient, setPatient] = useState<EntityOption | null>(null);
  const [invoice, setInvoice] = useState<EntityOption | null>(null);
  const [form, setForm] = useState({ amount: "", bank_account_id: "", reason: "" });
  const [busy, setBusy] = useState(false);
  return (
    <DxPopup isOpen onClose={onClose} title="Raise a refund" size="md"
      footer={<>
        <DxButton variant="text" onClick={onClose}>Cancel</DxButton>
        <DxButton variant="primary" disabled={!form.amount || !form.bank_account_id || busy} isLoading={busy} onClick={() => {
          setBusy(true);
          financeExtApi.createRefund({ amount: Number(form.amount), patient_id: patient?.value, invoice_id: invoice?.value,
            bank_account_id: Number(form.bank_account_id), reason: form.reason || undefined })
            .then(onSaved).catch((e) => toast.error(e?.response?.data?.detail ?? "Failed.")).finally(() => setBusy(false));
        }}>Raise refund</DxButton>
      </>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><PatientPicker value={patient} onChange={(o) => { setPatient(o); setInvoice(null); }} hint="Who is the money going back to?" /></div>
        <div className="sm:col-span-2"><InvoicePicker label="Related invoice (optional)" patientId={patient?.value ?? null} value={invoice} onChange={setInvoice} /></div>
        <DxInput label="Amount (₦)" type="number" mono value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
        <DxSelect label="Pay from" value={form.bank_account_id} onChange={(e) => setForm((f) => ({ ...f, bank_account_id: e.target.value }))}
          options={[{ value: "", label: "Select bank…" }, ...(banks.data ?? []).map((b) => ({ value: String(b.id), label: `${b.name} (${fmtNaira(b.balance)})` }))]} />
        <div className="sm:col-span-2"><DxInput label="Reason" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} /></div>
      </div>
    </DxPopup>
  );
}

function WriteOffModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [patient, setPatient] = useState<EntityOption | null>(null);
  const [invoice, setInvoice] = useState<EntityOption | null>(null);
  const [form, setForm] = useState({ amount: "", reason: "" });
  const [busy, setBusy] = useState(false);
  return (
    <DxPopup isOpen onClose={onClose} title="Write off an invoice balance" size="md"
      footer={<>
        <DxButton variant="text" onClick={onClose}>Cancel</DxButton>
        <DxButton variant="primary" disabled={!invoice || busy} isLoading={busy} onClick={() => {
          setBusy(true);
          financeExtApi.writeOffInvoice(invoice!.value, { amount: form.amount ? Number(form.amount) : undefined, reason: form.reason || undefined })
            .then(() => { toast.success("Balance written off to Bad Debt."); onSaved(); })
            .catch((e) => toast.error(e?.response?.data?.detail ?? "Failed.")).finally(() => setBusy(false));
        }}>Write off</DxButton>
      </>}>
      <div className="space-y-4">
        <PatientPicker value={patient} onChange={(o) => { setPatient(o); setInvoice(null); }} />
        <InvoicePicker patientId={patient?.value ?? null} value={invoice} onChange={setInvoice} hint="The remaining balance posts to Bad Debt Expense." />
        <DxInput label="Amount (blank = full balance)" type="number" mono value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
        <DxInput label="Reason" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
      </div>
    </DxPopup>
  );
}
