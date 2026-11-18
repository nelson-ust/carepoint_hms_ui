import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Plus, Wallet } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxButton, DxBadge, DxKpi, DxInput, DxPopup,
  DxGrid, type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { financeExtApi, fmtNaira, type CashierSession, type PettyFloat, type PettyVoucher } from "../api/finance-ext.api";

export function CashOfficePage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [voucherFloat, setVoucherFloat] = useState<PettyFloat | null>(null);
  const [topUpFloat, setTopUpFloat] = useState<PettyFloat | null>(null);
  const [newFloatName, setNewFloatName] = useState("");
  const [openFloatModal, setOpenFloatModal] = useState(false);
  const [closeSession, setCloseSession] = useState<CashierSession | null>(null);
  const [retireTarget, setRetireTarget] = useState<PettyFloat | null>(null);
  const [openingFloat, setOpeningFloat] = useState("0");

  const floats = useQuery({ queryKey: ["fin", "floats"], queryFn: financeExtApi.listFloats });
  const vouchers = useQuery({ queryKey: ["fin", "vouchers"], queryFn: () => financeExtApi.listVouchers() });
  const mySession = useQuery({ queryKey: ["fin", "mysession"], queryFn: financeExtApi.mySession });
  const summary = useQuery({ queryKey: ["fin", "dailySummary"], queryFn: () => financeExtApi.dailySummary() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["fin"] });

  const floatColumns: DxGridColumn<PettyFloat>[] = [
    { key: "name", header: "Float", render: (r) => <span className="font-semibold text-[var(--dx-text)]">{r.name}</span> },
    { key: "float_amount", header: "Float", align: "right", render: (r) => <span className="dx-mono">{fmtNaira(r.float_amount)}</span> },
    { key: "unretired_spend", header: "Unretired spend", align: "right", render: (r) => <span className="dx-mono">{fmtNaira(r.unretired_spend)}</span> },
    { key: "cash_at_hand", header: "Cash at hand", align: "right", render: (r) => <span className="dx-mono font-semibold">{fmtNaira(r.cash_at_hand)}</span> },
    { key: "act", header: "", align: "right", render: (r) => (
        <div className="flex justify-end gap-1">
          <DxButton size="sm" variant="text" onClick={() => setTopUpFloat(r)}>Top-up</DxButton>
          <DxButton size="sm" variant="text" onClick={() => setVoucherFloat(r)}>Voucher</DxButton>
          <DxButton size="sm" variant="text" onClick={() => setRetireTarget(r)}>Retire</DxButton>
        </div>) },
  ];

  const voucherColumns: DxGridColumn<PettyVoucher>[] = [
    { key: "voucher_no", header: "Voucher" },
    { key: "description", header: "Description" },
    { key: "amount", header: "Amount", align: "right", render: (r) => <span className="dx-mono">{fmtNaira(r.amount)}</span> },
    { key: "status", header: "Status", render: (r) => (
        <DxBadge tone={r.status === "APPROVED" ? "success" : r.status === "RETIRED" ? "neutral" : r.status === "REJECTED" ? "danger" : "warning"}>{r.status}</DxBadge>) },
    { key: "act", header: "", align: "right", render: (r) => r.status === "PENDING" ? (
        <div className="flex justify-end gap-1">
          <DxButton size="sm" variant="primary" onClick={() => financeExtApi.decideVoucher(r.id, true).then(invalidate)}>Approve</DxButton>
          <DxButton size="sm" variant="text" onClick={() => financeExtApi.decideVoucher(r.id, false).then(invalidate)}>Reject</DxButton>
        </div>) : null },
  ];

  const sessionColumns: DxGridColumn<CashierSession>[] = [
    { key: "id", header: "Session", render: (r) => `#${r.id}` },
    { key: "opened_at", header: "Opened", render: (r) => r.opened_at?.slice(0, 16).replace("T", " ") ?? "—" },
    { key: "takings_total", header: "Takings", align: "right", render: (r) => <span className="dx-mono">{fmtNaira(r.takings_total)}</span> },
    { key: "expected_cash", header: "Expected cash", align: "right", render: (r) => <span className="dx-mono">{fmtNaira(r.expected_cash)}</span> },
    { key: "variance", header: "Variance", align: "right", render: (r) => r.variance != null ? (
        <span className={`dx-mono ${parseFloat(r.variance) === 0 ? "text-[var(--dx-success,#10b981)]" : "font-semibold text-[var(--dx-danger,#e11d48)]"}`}>{fmtNaira(r.variance)}</span>) : "—" },
    { key: "status", header: "Status", render: (r) => <DxBadge tone={r.status === "OPEN" ? "info" : "neutral"}>{r.status}</DxBadge> },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Accounting" }, { label: "Cash Office" }]}
        title="Cash Office"
        subtitle="Petty cash floats, vouchers and cashier shifts."
        actions={mySession.data
          ? <DxButton variant="primary" onClick={() => setCloseSession(mySession.data!)}>Close my shift</DxButton>
          : <div className="flex flex-wrap items-end gap-2">
              <DxInput label="Opening float" type="number" mono value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} className="w-32" />
              <DxButton variant="primary" onClick={() => financeExtApi.openSession({ opening_float: Number(openingFloat) })
                .then(() => { toast.success("Shift opened."); invalidate(); })
                .catch((e) => toast.error(e?.response?.data?.detail ?? "Could not open the shift."))}>Open shift</DxButton>
            </div>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <DxKpi label="Today's takings" icon={Coins} tone="accent" value={fmtNaira(summary.data?.takings_total)} isLoading={summary.isLoading} />
        <DxKpi label="Sessions today" icon={Wallet} tone="info" value={summary.data?.sessions?.length ?? 0} isLoading={summary.isLoading} />
        <DxKpi label="Total variance" icon={Coins} tone="warning" value={fmtNaira(summary.data?.total_variance)} isLoading={summary.isLoading} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <DxPanel title="Petty cash floats" flush actions={<DxButton size="sm" variant="default" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpenFloatModal(true)}>Float</DxButton>}>
          <DxGrid<PettyFloat>
            borderless columns={floatColumns} data={floats.data} rowKey={(r) => r.id} isLoading={floats.isLoading}
            error={floats.isError ? "Could not load petty cash floats." : null}
            onRetry={() => floats.refetch()}
            empty={{ title: "No floats", description: "Create an imprest float for a custodian." }}
          />
        </DxPanel>

        <DxPanel title="Vouchers" flush>
          <DxGrid<PettyVoucher>
            borderless columns={voucherColumns} data={vouchers.data} rowKey={(r) => r.id} isLoading={vouchers.isLoading}
            error={vouchers.isError ? "Could not load vouchers." : null}
            onRetry={() => vouchers.refetch()}
            empty={{ title: "No vouchers" }}
          />
        </DxPanel>
      </div>

      <DxPanel title="Cashier sessions (latest)" flush>
        <DxGrid<CashierSession>
          borderless columns={sessionColumns} data={summary.data?.sessions} rowKey={(r) => r.id} isLoading={summary.isLoading} empty={{ title: "No sessions today" }}
        />
      </DxPanel>

      {openFloatModal && (
        <DxPopup isOpen onClose={() => setOpenFloatModal(false)} title="New petty cash float" size="sm"
          footer={<>
            <DxButton variant="text" onClick={() => setOpenFloatModal(false)}>Cancel</DxButton>
            <DxButton variant="primary" disabled={!newFloatName} onClick={() =>
              financeExtApi.createFloat({ name: newFloatName }).then(() => { setOpenFloatModal(false); setNewFloatName(""); invalidate(); })}>Create</DxButton>
          </>}>
          <DxInput label="Float name" value={newFloatName} onChange={(e) => setNewFloatName(e.target.value)} placeholder="Front desk float" />
        </DxPopup>
      )}

      {topUpFloat && <TopUpModal float={topUpFloat} onClose={() => setTopUpFloat(null)} onSaved={() => { setTopUpFloat(null); invalidate(); }} />}
      {voucherFloat && <VoucherModal float={voucherFloat} onClose={() => setVoucherFloat(null)} onSaved={() => { setVoucherFloat(null); invalidate(); }} />}
      {closeSession && <CloseSessionModal session={closeSession} onClose={() => setCloseSession(null)} onSaved={() => { setCloseSession(null); invalidate(); }} />}

      <ConfirmDialog
        isOpen={retireTarget !== null}
        onClose={() => setRetireTarget(null)}
        tone="primary"
        title="Retire approved vouchers?"
        description={retireTarget
          ? `Every APPROVED voucher on "${retireTarget.name}" (unretired spend ${fmtNaira(retireTarget.unretired_spend)}) will post to its expense account and the float balance will drop. Corrections after this are by reversal only.`
          : undefined}
        confirmLabel="Retire & post"
        onConfirm={async () => {
          if (!retireTarget) return;
          try {
            const out: any = await financeExtApi.retireFloat(retireTarget.id);
            toast.success(`Retired ${out.retired_vouchers} vouchers · replenish ${fmtNaira(out.replenishment_due)}.`);
            setRetireTarget(null);
            invalidate();
          } catch (e: any) {
            toast.error(e?.response?.data?.detail ?? "Nothing to retire.");
          }
        }}
      />
    </DxPage>
  );
}

function TopUpModal({ float: f, onClose, onSaved }: { float: PettyFloat; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  return (
    <DxPopup isOpen onClose={onClose} title={`Top up ${f.name}`} size="sm"
      footer={<>
        <DxButton variant="text" onClick={onClose}>Cancel</DxButton>
        <DxButton variant="primary" disabled={!amount} onClick={() => financeExtApi.topUpFloat(f.id, { amount: Number(amount) }).then(onSaved).catch((e) => toast.error(e?.response?.data?.detail ?? "Failed."))}>Fund float</DxButton>
      </>}>
      <DxInput label="Amount (₦)" type="number" mono value={amount} onChange={(e) => setAmount(e.target.value)} />
      <p className="mt-2 text-[13px] text-[var(--dx-text-muted)]">Posts Dr Petty Cash / Cr Bank (default account).</p>
    </DxPopup>
  );
}

function VoucherModal({ float: f, onClose, onSaved }: { float: PettyFloat; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ amount: "", description: "" });
  return (
    <DxPopup isOpen onClose={onClose} title={`Expense voucher — ${f.name}`} size="sm"
      footer={<>
        <DxButton variant="text" onClick={onClose}>Cancel</DxButton>
        <DxButton variant="primary" disabled={!form.amount || !form.description} onClick={() => financeExtApi.createVoucher(f.id, { amount: Number(form.amount), description: form.description }).then(onSaved).catch((e) => toast.error(e?.response?.data?.detail ?? "Failed."))}>Raise voucher</DxButton>
      </>}>
      <div className="space-y-4">
        <DxInput label="Amount (₦)" type="number" mono value={form.amount} onChange={(e) => setForm((x) => ({ ...x, amount: e.target.value }))} />
        <DxInput label="What was it spent on?" value={form.description} onChange={(e) => setForm((x) => ({ ...x, description: e.target.value }))} />
      </div>
    </DxPopup>
  );
}

function CloseSessionModal({ session, onClose, onSaved }: { session: CashierSession; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <DxPopup isOpen onClose={onClose} title={`Close shift #${session.id}`} size="sm"
      footer={<>
        <DxButton variant="text" onClick={onClose}>Cancel</DxButton>
        <DxButton variant="primary" disabled={counted === ""} onClick={() =>
          financeExtApi.closeSession(session.id, { counted_cash: Number(counted), notes: notes || undefined })
            .then((s) => { toast.success(`Shift closed. Variance ${fmtNaira(s.variance)}.`); onSaved(); })
            .catch((e) => toast.error(e?.response?.data?.detail ?? "Failed."))}>Close shift</DxButton>
      </>}>
      <div className="space-y-4">
        <div className="rounded-md bg-[var(--dx-surface-sunken)] p-3 text-[13px]">
          <div className="flex justify-between"><span className="text-[var(--dx-text-muted)]">Opening float</span><span className="dx-mono">{fmtNaira(session.opening_float)}</span></div>
          {Object.entries(session.takings_by_method).map(([m, v]) => (
            <div key={m} className="flex justify-between"><span className="text-[var(--dx-text-muted)]">{m}</span><span className="dx-mono">{fmtNaira(v)}</span></div>
          ))}
          <div className="mt-1 flex justify-between border-t border-[var(--dx-border)] pt-1 font-semibold">
            <span className="text-[var(--dx-text)]">Expected cash</span><span className="dx-mono">{fmtNaira(session.expected_cash)}</span>
          </div>
        </div>
        <DxInput label="Counted cash (₦)" type="number" mono value={counted} onChange={(e) => setCounted(e.target.value)} />
        <DxInput label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </DxPopup>
  );
}
