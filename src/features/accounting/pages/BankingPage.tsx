import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Landmark, Plus, Upload } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxButton, DxBadge, DxInput, DxSelect, DxCheckbox,
  DxPopup, DxGrid, type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { financeExtApi, fmtNaira, type BankAccount, type Reconciliation } from "../api/finance-ext.api";

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

  const accountColumns: DxGridColumn<BankAccount>[] = [
    { key: "name", header: "Account", render: (r) => (
        <div>
          <div className="font-semibold text-[var(--dx-text)]">{r.name} {r.is_default && <DxBadge className="ml-1" tone="info">default</DxBadge>}</div>
          <div className="text-[11.5px] text-[var(--dx-text-muted)]">{r.bank_name} · {r.account_number_masked ?? "—"} · GL {r.ledger_code}</div>
        </div>) },
    { key: "balance", header: "Ledger balance", align: "right", render: (r) => <span className="dx-mono font-semibold">{fmtNaira(r.balance)}</span> },
    { key: "act", header: "", align: "right", render: (r) => (
        <DxButton size="sm" variant="text" leftIcon={<Upload className="h-4 w-4" />} onClick={() => { uploadTarget.current = r.id; fileRef.current?.click(); }}>Statement CSV</DxButton>) },
  ];

  const recColumns: DxGridColumn<Reconciliation>[] = [
    { key: "id", header: "#", render: (r) => `REC-${r.id}` },
    { key: "period", header: "Period", render: (r) => `${r.period_from} → ${r.period_to}` },
    { key: "status", header: "Status", render: (r) => <DxBadge tone={r.status === "COMPLETED" ? "success" : "warning"}>{r.status.replace(/_/g, " ")}</DxBadge> },
    { key: "act", header: "", align: "right", render: (r) => <DxButton size="sm" variant="text" onClick={() => setOpenRecId(r.id)}>Open</DxButton> },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Accounting" }, { label: "Banking" }]}
        title="Banking"
        subtitle="Bank accounts, deposits, transfers and reconciliation."
        actions={
          <>
            <DxButton variant="default" onClick={() => setModal("deposit")}>Deposit</DxButton>
            <DxButton variant="default" leftIcon={<ArrowLeftRight className="h-4 w-4" />} onClick={() => setModal("transfer")}>Transfer</DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setModal("account")}>Bank account</DxButton>
          </>
        }
      />

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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <DxPanel title="Bank accounts" icon={<Landmark className="h-4 w-4" />} flush>
          <DxGrid<BankAccount>
            borderless columns={accountColumns} data={accounts.data} rowKey={(r) => r.id} isLoading={accounts.isLoading}
            error={accounts.isError ? "Could not load bank accounts." : null}
            onRetry={() => accounts.refetch()}
            empty={{ title: "No bank accounts", description: "Add your first bank account to route money movements.", action: <DxButton size="sm" variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setModal("account")}>Add bank account</DxButton> }}
          />
        </DxPanel>

        <DxPanel
          title="Reconciliations" flush
          actions={<DxButton size="sm" variant="default" onClick={() => setModal("startRec")}>Start reconciliation</DxButton>}
        >
          <DxGrid<Reconciliation>
            borderless columns={recColumns} data={recs.data} rowKey={(r) => r.id} isLoading={recs.isLoading}
            error={recs.isError ? "Could not load reconciliations." : null}
            onRetry={() => recs.refetch()}
            empty={{ title: "No reconciliations", description: "Import a statement, then start a reconciliation." }}
          />
        </DxPanel>
      </div>

      {modal === "account" && <AccountModal onClose={() => setModal(null)} onSaved={() => { setModal(null); invalidate(); }} />}
      {modal === "deposit" && <MoveMoneyModal kind="deposit" accounts={accounts.data ?? []} onClose={() => setModal(null)} onSaved={() => { setModal(null); invalidate(); }} />}
      {modal === "transfer" && <MoveMoneyModal kind="transfer" accounts={accounts.data ?? []} onClose={() => setModal(null)} onSaved={() => { setModal(null); invalidate(); }} />}
      {modal === "startRec" && <StartRecModal accounts={accounts.data ?? []} onClose={() => setModal(null)} onSaved={(id) => { setModal(null); invalidate(); setOpenRecId(id); }} />}
      {openRecId != null && <ReconciliationModal recId={openRecId} onClose={() => { setOpenRecId(null); invalidate(); }} />}
    </DxPage>
  );
}

function AccountModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", bank_name: "", account_number: "", is_default: false });
  return (
    <DxPopup isOpen onClose={onClose} title="New bank account" size="md"
      footer={<>
        <DxButton variant="text" onClick={onClose}>Cancel</DxButton>
        <DxButton variant="primary" disabled={!form.name} onClick={() => financeExtApi.createBankAccount(form).then(onSaved).catch((e) => toast.error(e?.response?.data?.detail ?? "Failed."))}>Create</DxButton>
      </>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DxInput label="Display name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <DxInput label="Bank" value={form.bank_name} onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))} />
        <DxInput label="Account number" value={form.account_number} onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))} />
        <div className="flex items-end pb-1">
          <DxCheckbox label="Default account" checked={form.is_default} onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))} />
        </div>
      </div>
    </DxPopup>
  );
}

function MoveMoneyModal({ kind, accounts, onClose, onSaved }: {
  kind: "deposit" | "transfer"; accounts: BankAccount[]; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ from: "", to: "", amount: "", date: today, reference: "" });
  const opts = accounts.map((a) => ({ value: String(a.id), label: `${a.name} (${fmtNaira(a.balance)})` }));
  const submit = () => {
    const done = kind === "deposit"
      ? financeExtApi.recordDeposit({ bank_account_id: Number(form.to), amount: Number(form.amount), deposit_date: form.date, reference: form.reference || undefined })
      : financeExtApi.recordTransfer({ from_bank_account_id: Number(form.from), to_bank_account_id: Number(form.to), amount: Number(form.amount), transfer_date: form.date, reference: form.reference || undefined });
    done.then(onSaved).catch((e) => toast.error(e?.response?.data?.detail ?? "Failed."));
  };
  return (
    <DxPopup isOpen onClose={onClose} title={kind === "deposit" ? "Bank a cash deposit" : "Inter-account transfer"} size="md"
      footer={<>
        <DxButton variant="text" onClick={onClose}>Cancel</DxButton>
        <DxButton variant="primary" onClick={submit} disabled={!form.amount || !form.to || (kind === "transfer" && !form.from)}>Post</DxButton>
      </>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {kind === "transfer" && (
          <DxSelect label="From" value={form.from} onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))} options={[{ value: "", label: "Select…" }, ...opts]} />
        )}
        <DxSelect label={kind === "deposit" ? "Into bank account" : "To"} value={form.to} onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))} options={[{ value: "", label: "Select…" }, ...opts]} />
        <DxInput label="Amount (₦)" type="number" mono value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
        <DxInput label="Date" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        <DxInput label="Reference" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} />
      </div>
    </DxPopup>
  );
}

function StartRecModal({ accounts, onClose, onSaved }: {
  accounts: BankAccount[]; onClose: () => void; onSaved: (id: number) => void;
}) {
  const toast = useToast();
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const [form, setForm] = useState({ bank: "", from: first, to: now.toISOString().slice(0, 10), closing: "" });
  return (
    <DxPopup isOpen onClose={onClose} title="Start bank reconciliation" size="md"
      footer={<>
        <DxButton variant="text" onClick={onClose}>Cancel</DxButton>
        <DxButton variant="primary" disabled={!form.bank} onClick={() =>
          financeExtApi.startReconciliation({ bank_account_id: Number(form.bank), period_from: form.from, period_to: form.to, statement_closing_balance: form.closing ? Number(form.closing) : undefined })
            .then((r) => onSaved(r.id)).catch((e) => toast.error(e?.response?.data?.detail ?? "Failed."))}>Start</DxButton>
      </>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DxSelect label="Bank account" value={form.bank} onChange={(e) => setForm((f) => ({ ...f, bank: e.target.value }))} options={[{ value: "", label: "Select…" }, ...accounts.map((a) => ({ value: String(a.id), label: a.name }))]} />
        <DxInput label="Statement closing balance" type="number" mono value={form.closing} onChange={(e) => setForm((f) => ({ ...f, closing: e.target.value }))} />
        <DxInput label="From" type="date" value={form.from} onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))} />
        <DxInput label="To" type="date" value={form.to} onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))} />
      </div>
    </DxPopup>
  );
}

function ReconciliationModal({ recId, onClose }: { recId: number; onClose: () => void }) {
  const toast = useToast();
  const report = useQuery({ queryKey: ["fin", "rec", recId], queryFn: () => financeExtApi.reconciliationReport(recId) });
  const r = report.data;
  const [adj, setAdj] = useState({ kind: "BANK_CHARGE", amount: "", date: "" });
  const [confirmComplete, setConfirmComplete] = useState(false);

  const refresh = () => report.refetch();

  return (
    <DxPopup isOpen onClose={onClose} title={`Reconciliation REC-${recId}`} size="lg"
      footer={<div className="flex w-full items-center justify-between">
        <span className="text-[13px] text-[var(--dx-text-muted)]">
          Book {fmtNaira(r?.book_closing_balance)} · Statement {fmtNaira(r?.statement_closing_balance)} ·
          Difference <span className={r?.difference && parseFloat(r.difference) !== 0 ? "font-semibold text-[var(--dx-danger,#e11d48)]" : "font-semibold text-[var(--dx-success,#10b981)]"}>{fmtNaira(r?.difference)}</span>
        </span>
        <div className="flex gap-2">
          <DxButton variant="default" onClick={() => financeExtApi.autoMatch(recId).then(refresh)}>Auto-match</DxButton>
          <DxButton variant="primary" disabled={r?.status === "COMPLETED"} onClick={() => setConfirmComplete(true)}>Complete</DxButton>
        </div>
      </div>}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 font-semibold text-[var(--dx-text)]">Unmatched statement lines ({r?.unmatched_statement_lines?.length ?? 0})</h3>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {(r?.unmatched_statement_lines ?? []).map((s) => (
              <div key={s.id} className="rounded-md bg-[var(--dx-surface-sunken)] px-3 py-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-[var(--dx-text)]">{s.date} · {s.description ?? s.reference ?? "—"}</span>
                  <span className="dx-mono font-medium">{parseFloat(s.debit) ? `+${fmtNaira(s.debit)}` : `−${fmtNaira(s.credit)}`}</span>
                </div>
              </div>
            ))}
            {r?.unmatched_statement_lines?.length === 0 && <p className="text-[13px] text-[var(--dx-success,#10b981)]">Everything on the statement is matched.</p>}
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <DxSelect label="Adjustment" value={adj.kind} onChange={(e) => setAdj((a) => ({ ...a, kind: e.target.value }))}
              options={[{ value: "BANK_CHARGE", label: "Bank charge" }, { value: "INTEREST", label: "Interest income" }]} />
            <DxInput label="Amount" type="number" mono value={adj.amount} onChange={(e) => setAdj((a) => ({ ...a, amount: e.target.value }))} />
            <DxInput label="Date" type="date" value={adj.date} onChange={(e) => setAdj((a) => ({ ...a, date: e.target.value }))} />
            <DxButton variant="default" disabled={!adj.amount} onClick={() =>
              financeExtApi.addAdjustment(recId, { kind: adj.kind, amount: Number(adj.amount), adj_date: adj.date || undefined })
                .then(() => financeExtApi.autoMatch(recId)).then(refresh).catch((e) => toast.error(e?.response?.data?.detail ?? "Failed."))}>Book</DxButton>
          </div>
        </div>
        <div>
          <h3 className="mb-2 font-semibold text-[var(--dx-text)]">Unmatched book entries ({r?.unmatched_book_lines?.length ?? 0})</h3>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {(r?.unmatched_book_lines ?? []).map((l) => (
              <div key={l.journal_line_id} className="rounded-md bg-[var(--dx-surface-sunken)] px-3 py-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-[var(--dx-text)]">{l.date} · {l.memo ?? l.entry_no}</span>
                  <span className="dx-mono font-medium">{parseFloat(l.debit) ? `+${fmtNaira(l.debit)}` : `−${fmtNaira(l.credit)}`}</span>
                </div>
              </div>
            ))}
            {r?.unmatched_book_lines?.length === 0 && <p className="text-[13px] text-[var(--dx-success,#10b981)]">All book entries are matched.</p>}
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
    </DxPopup>
  );
}
