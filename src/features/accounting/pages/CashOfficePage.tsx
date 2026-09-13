import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Plus, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { MetricCard } from "@/components/charts/MetricCard";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { useToast } from "@/components/feedback/ToastProvider";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import {
  financeExtApi, fmtNaira, type CashierSession, type PettyFloat, type PettyVoucher,
} from "../api/finance-ext.api";

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

  const floatColumns: DataTableColumn<PettyFloat>[] = [
    { key: "name", header: "Float", render: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "float_amount", header: "Float", align: "right", render: (r) => fmtNaira(r.float_amount) },
    { key: "unretired_spend", header: "Unretired spend", align: "right", render: (r) => fmtNaira(r.unretired_spend) },
    { key: "cash_at_hand", header: "Cash at hand", align: "right",
      render: (r) => <span className="font-semibold">{fmtNaira(r.cash_at_hand)}</span> },
    { key: "act", header: "", align: "right", render: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setTopUpFloat(r)}>Top-up</Button>
          <Button size="sm" variant="ghost" onClick={() => setVoucherFloat(r)}>Voucher</Button>
          <Button size="sm" variant="ghost" onClick={() => setRetireTarget(r)}>
            Retire
          </Button>
        </div>) },
  ];

  const voucherColumns: DataTableColumn<PettyVoucher>[] = [
    { key: "voucher_no", header: "Voucher" },
    { key: "description", header: "Description" },
    { key: "amount", header: "Amount", align: "right", render: (r) => fmtNaira(r.amount) },
    { key: "status", header: "Status", render: (r) => (
        <Badge variant={r.status === "APPROVED" ? "soft-success" : r.status === "RETIRED" ? "secondary"
          : r.status === "REJECTED" ? "soft-danger" : "soft-warning"}>{r.status}</Badge>) },
    { key: "act", header: "", align: "right", render: (r) => r.status === "PENDING" ? (
        <div className="flex justify-end gap-1">
          <Button size="sm" onClick={() => financeExtApi.decideVoucher(r.id, true).then(invalidate)}>Approve</Button>
          <Button size="sm" variant="ghost" onClick={() => financeExtApi.decideVoucher(r.id, false).then(invalidate)}>Reject</Button>
        </div>) : null },
  ];

  const sessionColumns: DataTableColumn<CashierSession>[] = [
    { key: "id", header: "Session", render: (r) => `#${r.id}` },
    { key: "opened_at", header: "Opened", render: (r) => r.opened_at?.slice(0, 16).replace("T", " ") ?? "—" },
    { key: "takings_total", header: "Takings", align: "right", render: (r) => fmtNaira(r.takings_total) },
    { key: "expected_cash", header: "Expected cash", align: "right", render: (r) => fmtNaira(r.expected_cash) },
    { key: "variance", header: "Variance", align: "right", render: (r) => r.variance != null ? (
        <span className={parseFloat(r.variance) === 0 ? "text-success-600" : "font-semibold text-danger-600"}>
          {fmtNaira(r.variance)}</span>) : "—" },
    { key: "status", header: "Status", render: (r) => (
        <Badge variant={r.status === "OPEN" ? "soft-info" : "secondary"}>{r.status}</Badge>) },
  ];

  return (
    <div>
      <PageHeader title="Cash Office" description="Petty cash floats, vouchers and cashier shifts."
        actions={mySession.data
          ? <Button onClick={() => setCloseSession(mySession.data!)}>Close my shift</Button>
          : <div className="flex flex-wrap items-end gap-2">
              <Input label="Opening float" type="number" value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)} className="w-32" />
              <Button onClick={() => financeExtApi.openSession({ opening_float: Number(openingFloat) })
                .then(() => { toast.success("Shift opened."); invalidate(); })
                .catch((e) => toast.error(e?.response?.data?.detail ?? "Could not open the shift."))}>
                Open shift
              </Button>
            </div>} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Today's takings" icon={Coins}
          value={fmtNaira(summary.data?.takings_total)} isLoading={summary.isLoading} />
        <MetricCard label="Sessions today" icon={Wallet}
          value={summary.data?.sessions?.length ?? 0} isLoading={summary.isLoading} />
        <MetricCard label="Total variance" icon={Coins}
          value={fmtNaira(summary.data?.total_variance)} isLoading={summary.isLoading} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-secondary-900">Petty cash floats</h2>
            <Button size="sm" variant="secondary" onClick={() => setOpenFloatModal(true)}>
              <Plus className="mr-1 h-4 w-4" /> Float
            </Button>
          </div>
          <DataTable columns={floatColumns} data={floats.data} rowKey={(r) => r.id}
            isLoading={floats.isLoading}
            error={floats.isError ? "Could not load petty cash floats." : null}
            onRetry={() => floats.refetch()}
            empty={{ title: "No floats", description: "Create an imprest float for a custodian." }} />
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-lg font-semibold text-secondary-900">Vouchers</h2>
          <DataTable columns={voucherColumns} data={vouchers.data} rowKey={(r) => r.id}
            isLoading={vouchers.isLoading}
            error={vouchers.isError ? "Could not load vouchers." : null}
            onRetry={() => vouchers.refetch()}
            empty={{ title: "No vouchers" }} />
        </Card>
      </div>

      <Card className="mt-6 p-4">
        <h2 className="mb-3 text-lg font-semibold text-secondary-900">Cashier sessions (latest)</h2>
        <DataTable columns={sessionColumns} data={summary.data?.sessions} rowKey={(r) => r.id}
          isLoading={summary.isLoading} empty={{ title: "No sessions today" }} />
      </Card>

      {openFloatModal && (
        <Modal isOpen onClose={() => setOpenFloatModal(false)} title="New petty cash float"
          footer={<div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenFloatModal(false)}>Cancel</Button>
            <Button disabled={!newFloatName} onClick={() =>
              financeExtApi.createFloat({ name: newFloatName })
                .then(() => { setOpenFloatModal(false); setNewFloatName(""); invalidate(); })}>Create</Button>
          </div>}>
          <Input label="Float name" value={newFloatName}
            onChange={(e) => setNewFloatName(e.target.value)} placeholder="Front desk float" />
        </Modal>
      )}

      {topUpFloat && (
        <TopUpModal float={topUpFloat} onClose={() => setTopUpFloat(null)}
          onSaved={() => { setTopUpFloat(null); invalidate(); }} />
      )}
      {voucherFloat && (
        <VoucherModal float={voucherFloat} onClose={() => setVoucherFloat(null)}
          onSaved={() => { setVoucherFloat(null); invalidate(); }} />
      )}
      {closeSession && (
        <CloseSessionModal session={closeSession} onClose={() => setCloseSession(null)}
          onSaved={() => { setCloseSession(null); invalidate(); }} />
      )}
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
    </div>
  );
}

function TopUpModal({ float: f, onClose, onSaved }: {
  float: PettyFloat; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  return (
    <Modal isOpen onClose={onClose} title={`Top up ${f.name}`}
      footer={<div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={!amount} onClick={() =>
          financeExtApi.topUpFloat(f.id, { amount: Number(amount) })
            .then(onSaved).catch((e) => toast.error(e?.response?.data?.detail ?? "Failed."))}>
          Fund float
        </Button>
      </div>}>
      <Input label="Amount (₦)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <p className="mt-2 text-sm text-secondary-500">Posts Dr Petty Cash / Cr Bank (default account).</p>
    </Modal>
  );
}

function VoucherModal({ float: f, onClose, onSaved }: {
  float: PettyFloat; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({ amount: "", description: "" });
  return (
    <Modal isOpen onClose={onClose} title={`Expense voucher — ${f.name}`}
      footer={<div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={!form.amount || !form.description} onClick={() =>
          financeExtApi.createVoucher(f.id, { amount: Number(form.amount), description: form.description })
            .then(onSaved).catch((e) => toast.error(e?.response?.data?.detail ?? "Failed."))}>
          Raise voucher
        </Button>
      </div>}>
      <div className="space-y-4">
        <Input label="Amount (₦)" type="number" value={form.amount}
          onChange={(e) => setForm((x) => ({ ...x, amount: e.target.value }))} />
        <Input label="What was it spent on?" value={form.description}
          onChange={(e) => setForm((x) => ({ ...x, description: e.target.value }))} />
      </div>
    </Modal>
  );
}

function CloseSessionModal({ session, onClose, onSaved }: {
  session: CashierSession; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <Modal isOpen onClose={onClose} title={`Close shift #${session.id}`}
      footer={<div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={counted === ""} onClick={() =>
          financeExtApi.closeSession(session.id, { counted_cash: Number(counted), notes: notes || undefined })
            .then((s) => { toast.success(`Shift closed. Variance ${fmtNaira(s.variance)}.`); onSaved(); })
            .catch((e) => toast.error(e?.response?.data?.detail ?? "Failed."))}>
          Close shift
        </Button>
      </div>}>
      <div className="space-y-4">
        <div className="rounded-lg bg-secondary-50 p-3 text-sm">
          <div className="flex justify-between"><span>Opening float</span><span>{fmtNaira(session.opening_float)}</span></div>
          {Object.entries(session.takings_by_method).map(([m, v]) => (
            <div key={m} className="flex justify-between"><span>{m}</span><span>{fmtNaira(v)}</span></div>
          ))}
          <div className="mt-1 flex justify-between border-t border-secondary-200 pt-1 font-semibold">
            <span>Expected cash</span><span>{fmtNaira(session.expected_cash)}</span>
          </div>
        </div>
        <Input label="Counted cash (₦)" type="number" value={counted}
          onChange={(e) => setCounted(e.target.value)} />
        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Modal>
  );
}
