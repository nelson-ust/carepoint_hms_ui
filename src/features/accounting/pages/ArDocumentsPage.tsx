import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ReceiptText, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  financeExtApi, fmtNaira, type CreditNote, type Refund,
} from "../api/finance-ext.api";
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

  const cnColumns: DataTableColumn<CreditNote>[] = [
    { key: "credit_note_no", header: "Credit note" },
    { key: "invoice_no", header: "Invoice", render: (r) => r.invoice_no ?? `#${r.invoice_id}` },
    { key: "reason", header: "Reason", render: (r) => r.reason ?? "—" },
    { key: "total_amount", header: "Amount", align: "right", render: (r) => fmtNaira(r.total_amount) },
    { key: "status", header: "Status", render: (r) => (
        <Badge variant={r.status === "APPLIED" || r.status === "ISSUED" ? "soft-success"
          : r.status === "CANCELLED" ? "soft-danger" : "secondary"}>{r.status}</Badge>) },
    { key: "act", header: "", align: "right", render: (r) => r.status === "DRAFT" ? (
        <Button size="sm" onClick={() => financeExtApi.issueCreditNote(r.id)
          .then(() => { toast.success("Credit note issued and posted."); invalidate(); })
          .catch((e) => toast.error(e?.response?.data?.detail ?? "Failed."))}>Issue</Button>) : null },
  ];

  const refundColumns: DataTableColumn<Refund>[] = [
    { key: "refund_no", header: "Refund" },
    { key: "amount", header: "Amount", align: "right", render: (r) => fmtNaira(r.amount) },
    { key: "reason", header: "Reason", render: (r) => r.reason ?? "—" },
    { key: "status", header: "Status", render: (r) => (
        <Badge variant={r.status === "PAID" ? "soft-success"
          : r.status === "CANCELLED" ? "soft-danger" : "soft-warning"}>{r.status}</Badge>) },
    { key: "act", header: "", align: "right", render: (r) => r.status === "PENDING" ? (
        <Button size="sm" onClick={() => financeExtApi.payRefund(r.id)
          .then(() => { toast.success("Refund paid."); invalidate(); })
          .catch((e) => toast.error(e?.response?.data?.detail ?? "Failed."))}>Pay out</Button>) : null },
  ];

  return (
    <div>
      <PageHeader title="Credit Notes & Refunds"
        description="Adjust invoices, return money and write off bad debt — every action posts to the ledger."
        actions={<div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setWriteOffModal(true)}>
            <Undo2 className="mr-1 h-4 w-4" /> Write off invoice
          </Button>
          <Button variant="secondary" onClick={() => setRefundModal(true)}>Refund</Button>
          <Button onClick={() => setCnModal(true)}><Plus className="mr-1 h-4 w-4" /> Credit note</Button>
        </div>} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-secondary-900">
            <ReceiptText className="h-5 w-5" /> Credit notes
          </h2>
          <DataTable columns={cnColumns} data={creditNotes.data} rowKey={(r) => r.id}
            isLoading={creditNotes.isLoading}
            error={creditNotes.isError ? "Could not load credit notes." : null}
            onRetry={() => creditNotes.refetch()} empty={{ title: "No credit notes" }} />
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 text-lg font-semibold text-secondary-900">Refunds</h2>
          <DataTable columns={refundColumns} data={refunds.data} rowKey={(r) => r.id}
            isLoading={refunds.isLoading}
            error={refunds.isError ? "Could not load refunds." : null}
            onRetry={() => refunds.refetch()} empty={{ title: "No refunds" }} />
        </Card>
      </div>

      {cnModal && <CreditNoteModal onClose={() => setCnModal(false)}
        onSaved={() => { setCnModal(false); invalidate(); }} />}
      {refundModal && <RefundModal onClose={() => setRefundModal(false)}
        onSaved={() => { setRefundModal(false); invalidate(); }} />}
      {writeOffModal && <WriteOffModal onClose={() => setWriteOffModal(false)}
        onSaved={() => { setWriteOffModal(false); invalidate(); }} />}
    </div>
  );
}

function CreditNoteModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [patient, setPatient] = useState<EntityOption | null>(null);
  const [invoice, setInvoice] = useState<EntityOption | null>(null);
  const [form, setForm] = useState({ amount: "", reason: "" });
  const [busy, setBusy] = useState(false);
  return (
    <Modal isOpen onClose={onClose} title="Draft a credit note"
      footer={<div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={!invoice || !form.amount || busy} onClick={() => {
          setBusy(true);
          financeExtApi.createCreditNote({ invoice_id: invoice!.value,
            reason: form.reason || undefined,
            items: [{ amount: Number(form.amount), description: form.reason || undefined }] })
            .then(onSaved).catch((e) => toast.error(e?.response?.data?.detail ?? "Failed."))
            .finally(() => setBusy(false));
        }}>
          {busy ? "Saving…" : "Create draft"}
        </Button>
      </div>}>
      <div className="space-y-4">
        <PatientPicker value={patient}
          onChange={(o) => { setPatient(o); setInvoice(null); }}
          hint="Search by name, hospital number or phone." />
        <InvoicePicker patientId={patient?.value ?? null} value={invoice} onChange={setInvoice}
          hint="The invoice being adjusted — its balance is shown." />
        <Input label="Amount to credit (₦)" type="number" value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
        <Input label="Reason" value={form.reason} placeholder="e.g. overbilled dressing"
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
      </div>
    </Modal>
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
    <Modal isOpen onClose={onClose} title="Raise a refund"
      footer={<div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={!form.amount || !form.bank_account_id || busy} onClick={() => {
          setBusy(true);
          financeExtApi.createRefund({
            amount: Number(form.amount),
            patient_id: patient?.value,
            invoice_id: invoice?.value,
            bank_account_id: Number(form.bank_account_id),
            reason: form.reason || undefined })
            .then(onSaved).catch((e) => toast.error(e?.response?.data?.detail ?? "Failed."))
            .finally(() => setBusy(false));
        }}>
          {busy ? "Saving…" : "Raise refund"}
        </Button>
      </div>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PatientPicker className="col-span-2" value={patient}
          onChange={(o) => { setPatient(o); setInvoice(null); }}
          hint="Who is the money going back to?" />
        <InvoicePicker className="col-span-2" label="Related invoice (optional)"
          patientId={patient?.value ?? null} value={invoice} onChange={setInvoice} />
        <Input label="Amount (₦)" type="number" value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
        <Select label="Pay from" value={form.bank_account_id}
          onChange={(e) => setForm((f) => ({ ...f, bank_account_id: e.target.value }))}
          options={[{ value: "", label: "Select bank…" },
            ...(banks.data ?? []).map((b) => ({ value: String(b.id),
              label: `${b.name} (${fmtNaira(b.balance)})` }))]} />
        <Input label="Reason" value={form.reason} className="col-span-2"
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
      </div>
    </Modal>
  );
}

function WriteOffModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [patient, setPatient] = useState<EntityOption | null>(null);
  const [invoice, setInvoice] = useState<EntityOption | null>(null);
  const [form, setForm] = useState({ amount: "", reason: "" });
  const [busy, setBusy] = useState(false);
  return (
    <Modal isOpen onClose={onClose} title="Write off an invoice balance"
      footer={<div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={!invoice || busy} onClick={() => {
          setBusy(true);
          financeExtApi.writeOffInvoice(invoice!.value, {
            amount: form.amount ? Number(form.amount) : undefined,
            reason: form.reason || undefined })
            .then(() => { toast.success("Balance written off to Bad Debt."); onSaved(); })
            .catch((e) => toast.error(e?.response?.data?.detail ?? "Failed."))
            .finally(() => setBusy(false));
        }}>
          {busy ? "Posting…" : "Write off"}
        </Button>
      </div>}>
      <div className="space-y-4">
        <PatientPicker value={patient}
          onChange={(o) => { setPatient(o); setInvoice(null); }} />
        <InvoicePicker patientId={patient?.value ?? null} value={invoice} onChange={setInvoice}
          hint="The remaining balance posts to Bad Debt Expense." />
        <Input label="Amount (blank = full balance)" type="number" value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
        <Input label="Reason" value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
      </div>
    </Modal>
  );
}
