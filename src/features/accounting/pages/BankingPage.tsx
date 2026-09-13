import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Landmark, Plus, Upload } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { useToast } from "@/components/feedback/ToastProvider";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import {
  financeExtApi, fmtNaira, type BankAccount, type Reconciliation,
} from "../api/finance-ext.api";

export function BankingPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [modal, setModal] = useState<null | "account" | "deposit" | "transfer" | "startRec">(null);
  const [openRecId, setOpenRecId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<number | null>(null);

  const accounts = useQuery({ queryKey: ["fin", "banks"], queryFn: financeExtApi.listBankAccounts });
  const recs = useQuery({ queryKey: ["fin", "recs"], queryFn: () => financeExtApi.listReconciliations() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["fin"] });

  const accountColumns: DataTableColumn<BankAccount>[] = [
    { key: "name", header: "Account", render: (r) => (
        <div>
          <div className="font-semibold">{r.name} {r.is_default && <Badge className="ml-1" variant="soft-info">default</Badge>}</div>
          <div className="text-xs text-secondary-500">{r.bank_name} · {r.account_number_masked ?? "—"} · GL {r.ledger_code}</div>
        </div>) },
    { key: "balance", header: "Ledger balance", align: "right",
      render: (r) => <span className="font-semibold">{fmtNaira(r.balance)}</span> },
    { key: "act", header: "", align: "right", render: (r) => (
        <Button size="sm" variant="ghost" onClick={() => {
          uploadTarget.current = r.id;
          fileRef.current?.click();
        }}><Upload className="mr-1 h-4 w-4" /> Statement CSV</Button>) },
  ];

  const recColumns: DataTableColumn<Reconciliation>[] = [
    { key: "id", header: "#", render: (r) => `REC-${r.id}` },
    { key: "period", header: "Period", render: (r) => `${r.period_from} → ${r.period_to}` },
    { key: "status", header: "Status", render: (r) => (
        <Badge variant={r.status === "COMPLETED" ? "soft-success" : "soft-warning"}>{r.status.replace(/_/g, " ")}</Badge>) },
    { key: "act", header: "", align: "right", render: (r) => (
        <Button size="sm" variant="ghost" onClick={() => setOpenRecId(r.id)}>Open</Button>) },
  ];

  return (
    <div>
      <PageHeader title="Banking" description="Bank accounts, deposits, transfers and reconciliation."
        actions={<div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setModal("deposit")}>Deposit</Button>
          <Button variant="secondary" onClick={() => setModal("transfer")}>
            <ArrowLeftRight className="mr-1 h-4 w-4" /> Transfer
          </Button>
          <Button onClick={() => setModal("account")}><Plus className="mr-1 h-4 w-4" /> Bank account</Button>
        </div>} />

      <input ref={fileRef} type="file" accept=".csv" className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          const id = uploadTarget.current;
          if (f && id) {
            try {
              const out = await financeExtApi.importStatement(id, f);
              toast.success(`Imported ${out.lines} statement lines.`);
              invalidate();
            } catch (err: any) {
              toast.error(err?.response?.data?.detail ?? "Import failed.");
            }
          }
          e.target.value = "";
        }} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-secondary-900">
            <Landmark className="h-5 w-5" /> Bank accounts
          </h2>
          <DataTable columns={accountColumns} data={accounts.data} rowKey={(r) => r.id}
            isLoading={accounts.isLoading}
            error={accounts.isError ? "Could not load bank accounts." : null}
            onRetry={() => accounts.refetch()}
            empty={{ title: "No bank accounts",
              description: "Add your first bank account to route money movements.",
              action: <Button size="sm" onClick={() => setModal("account")}>
                <Plus className="mr-1 h-4 w-4" /> Add bank account</Button> }} />
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-secondary-900">Reconciliations</h2>
            <Button size="sm" variant="secondary" onClick={() => setModal("startRec")}>Start reconciliation</Button>
          </div>
          <DataTable columns={recColumns} data={recs.data} rowKey={(r) => r.id}
            isLoading={recs.isLoading}
            error={recs.isError ? "Could not load reconciliations." : null}
            onRetry={() => recs.refetch()}
            empty={{ title: "No reconciliations", description: "Import a statement, then start a reconciliation." }} />
        </Card>
      </div>

      {modal === "account" && <AccountModal onClose={() => setModal(null)} onSaved={() => { setModal(null); invalidate(); }} />}
      {modal === "deposit" && <MoveMoneyModal kind="deposit" accounts={accounts.data ?? []}
        onClose={() => setModal(null)} onSaved={() => { setModal(null); invalidate(); }} />}
      {modal === "transfer" && <MoveMoneyModal kind="transfer" accounts={accounts.data ?? []}
        onClose={() => setModal(null)} onSaved={() => { setModal(null); invalidate(); }} />}
      {modal === "startRec" && <StartRecModal accounts={accounts.data ?? []}
        onClose={() => setModal(null)}
        onSaved={(id) => { setModal(null); invalidate(); setOpenRecId(id); }} />}
      {openRecId != null && <ReconciliationModal recId={openRecId}
        onClose={() => { setOpenRecId(null); invalidate(); }} />}
    </div>
  );
}

function AccountModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", bank_name: "", account_number: "", is_default: false });
  return (
    <Modal isOpen onClose={onClose} title="New bank account"
      footer={<div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={!form.name} onClick={() =>
          financeExtApi.createBankAccount(form).then(onSaved)
            .catch((e) => toast.error(e?.response?.data?.detail ?? "Failed."))}>Create</Button>
      </div>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Display name" value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <Input label="Bank" value={form.bank_name}
          onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))} />
        <Input label="Account number" value={form.account_number}
          onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))} />
        <label className="mt-7 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_default}
            onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))} />
          Default account
        </label>
      </div>
    </Modal>
  );
}

function MoveMoneyModal({ kind, accounts, onClose, onSaved }: {
  kind: "deposit" | "transfer"; accounts: BankAccount[];
  onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ from: "", to: "", amount: "", date: today, reference: "" });
  const opts = accounts.map((a) => ({ value: String(a.id), label: `${a.name} (${fmtNaira(a.balance)})` }));
  const submit = () => {
    const done = kind === "deposit"
      ? financeExtApi.recordDeposit({ bank_account_id: Number(form.to), amount: Number(form.amount),
          deposit_date: form.date, reference: form.reference || undefined })
      : financeExtApi.recordTransfer({ from_bank_account_id: Number(form.from),
          to_bank_account_id: Number(form.to), amount: Number(form.amount),
          transfer_date: form.date, reference: form.reference || undefined });
    done.then(onSaved).catch((e) => toast.error(e?.response?.data?.detail ?? "Failed."));
  };
  return (
    <Modal isOpen onClose={onClose}
      title={kind === "deposit" ? "Bank a cash deposit" : "Inter-account transfer"}
      footer={<div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit}
          disabled={!form.amount || !form.to || (kind === "transfer" && !form.from)}>Post</Button>
      </div>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {kind === "transfer" && (
          <Select label="From" value={form.from}
            onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))}
            options={[{ value: "", label: "Select…" }, ...opts]} />
        )}
        <Select label={kind === "deposit" ? "Into bank account" : "To"} value={form.to}
          onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
          options={[{ value: "", label: "Select…" }, ...opts]} />
        <Input label="Amount (₦)" type="number" value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
        <Input label="Date" type="date" value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        <Input label="Reference" value={form.reference}
          onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} />
      </div>
    </Modal>
  );
}

function StartRecModal({ accounts, onClose, onSaved }: {
  accounts: BankAccount[]; onClose: () => void; onSaved: (id: number) => void;
}) {
  const toast = useToast();
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const [form, setForm] = useState({ bank: "", from: first,
    to: now.toISOString().slice(0, 10), closing: "" });
  return (
    <Modal isOpen onClose={onClose} title="Start bank reconciliation"
      footer={<div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={!form.bank} onClick={() =>
          financeExtApi.startReconciliation({ bank_account_id: Number(form.bank),
            period_from: form.from, period_to: form.to,
            statement_closing_balance: form.closing ? Number(form.closing) : undefined })
          .then((r) => onSaved(r.id))
          .catch((e) => toast.error(e?.response?.data?.detail ?? "Failed."))}>Start</Button>
      </div>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select label="Bank account" value={form.bank}
          onChange={(e) => setForm((f) => ({ ...f, bank: e.target.value }))}
          options={[{ value: "", label: "Select…" },
            ...accounts.map((a) => ({ value: String(a.id), label: a.name }))]} />
        <Input label="Statement closing balance" type="number" value={form.closing}
          onChange={(e) => setForm((f) => ({ ...f, closing: e.target.value }))} />
        <Input label="From" type="date" value={form.from}
          onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))} />
        <Input label="To" type="date" value={form.to}
          onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))} />
      </div>
    </Modal>
  );
}

function ReconciliationModal({ recId, onClose }: { recId: number; onClose: () => void }) {
  const toast = useToast();
  const report = useQuery({
    queryKey: ["fin", "rec", recId],
    queryFn: () => financeExtApi.reconciliationReport(recId),
  });
  const r = report.data;
  const [adj, setAdj] = useState({ kind: "BANK_CHARGE", amount: "", date: "" });
  const [confirmComplete, setConfirmComplete] = useState(false);

  const refresh = () => report.refetch();

  return (
    <Modal isOpen onClose={onClose} title={`Reconciliation REC-${recId}`} size="2xl"
      footer={<div className="flex w-full items-center justify-between">
        <span className="text-sm text-secondary-500">
          Book {fmtNaira(r?.book_closing_balance)} · Statement {fmtNaira(r?.statement_closing_balance)} ·
          Difference <span className={r?.difference && parseFloat(r.difference) !== 0
            ? "font-semibold text-danger-600" : "font-semibold text-success-600"}>
            {fmtNaira(r?.difference)}</span>
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() =>
            financeExtApi.autoMatch(recId).then(refresh)}>Auto-match</Button>
          <Button disabled={r?.status === "COMPLETED"} onClick={() => setConfirmComplete(true)}>
            Complete
          </Button>
        </div>
      </div>}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 font-semibold text-secondary-900">
            Unmatched statement lines ({r?.unmatched_statement_lines?.length ?? 0})
          </h3>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {(r?.unmatched_statement_lines ?? []).map((s) => (
              <div key={s.id} className="rounded-lg bg-secondary-50 px-3 py-2 text-sm">
                <div className="flex justify-between">
                  <span>{s.date} · {s.description ?? s.reference ?? "—"}</span>
                  <span className="font-medium">
                    {parseFloat(s.debit) ? `+${fmtNaira(s.debit)}` : `−${fmtNaira(s.credit)}`}
                  </span>
                </div>
              </div>
            ))}
            {r?.unmatched_statement_lines?.length === 0 && (
              <p className="text-sm text-success-600">Everything on the statement is matched.</p>)}
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Select label="Adjustment" value={adj.kind}
              onChange={(e) => setAdj((a) => ({ ...a, kind: e.target.value }))}
              options={[{ value: "BANK_CHARGE", label: "Bank charge" },
                        { value: "INTEREST", label: "Interest income" }]} />
            <Input label="Amount" type="number" value={adj.amount}
              onChange={(e) => setAdj((a) => ({ ...a, amount: e.target.value }))} />
            <Input label="Date" type="date" value={adj.date}
              onChange={(e) => setAdj((a) => ({ ...a, date: e.target.value }))} />
            <Button variant="secondary" disabled={!adj.amount} onClick={() =>
              financeExtApi.addAdjustment(recId, { kind: adj.kind, amount: Number(adj.amount),
                adj_date: adj.date || undefined })
                .then(() => financeExtApi.autoMatch(recId)).then(refresh)
                .catch((e) => toast.error(e?.response?.data?.detail ?? "Failed."))}>
              Book
            </Button>
          </div>
        </div>
        <div>
          <h3 className="mb-2 font-semibold text-secondary-900">
            Unmatched book entries ({r?.unmatched_book_lines?.length ?? 0})
          </h3>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {(r?.unmatched_book_lines ?? []).map((l) => (
              <div key={l.journal_line_id} className="rounded-lg bg-secondary-50 px-3 py-2 text-sm">
                <div className="flex justify-between">
                  <span>{l.date} · {l.memo ?? l.entry_no}</span>
                  <span className="font-medium">
                    {parseFloat(l.debit) ? `+${fmtNaira(l.debit)}` : `−${fmtNaira(l.credit)}`}
                  </span>
                </div>
              </div>
            ))}
            {r?.unmatched_book_lines?.length === 0 && (
              <p className="text-sm text-success-600">All book entries are matched.</p>)}
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={confirmComplete}
        onClose={() => setConfirmComplete(false)}
        tone="primary"
        title="Complete this reconciliation?"
        description={`${r?.unmatched_statement_lines?.length ?? 0} statement line(s) and ${r?.unmatched_book_lines?.length ?? 0} book entrie(s) are still unmatched — they will carry into the next reconciliation. The session locks once completed.`}
        confirmLabel="Complete reconciliation"
        onConfirm={async () => {
          try {
            await financeExtApi.completeReconciliation(recId);
            toast.success("Reconciliation completed.");
            setConfirmComplete(false);
            onClose();
          } catch (e: any) {
            toast.error(e?.response?.data?.detail ?? "Failed.");
          }
        }}
      />
    </Modal>
  );
}
