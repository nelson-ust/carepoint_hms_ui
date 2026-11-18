import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PiggyBank, Plus } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxBadge, DxButton, DxPopup, DxInput, DxSelect,
  DxGrid, type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { accountsApi, type Account } from "@/features/billing/api/accounts.api";
import { accountingApi, financeApi } from "../api/accounting.api";

const NGN = (v: string | number) => `₦${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function firstOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
const today = () => new Date().toISOString().slice(0, 10);

type BvaRow = { account_id: number; code: string; name: string; type: string; budget: string | number; actual: string | number; variance: string | number };

export function BudgetsPage() {
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(today());
  const [setOpen, setSetOpen] = useState(false);
  const qc = useQueryClient();

  const report = useQuery({
    queryKey: ["bva", dateFrom, dateTo],
    queryFn: () => financeApi.budgetVsActual({ date_from: dateFrom, date_to: dateTo }),
    enabled: !!dateFrom && !!dateTo,
  });

  const items = (report.data?.items ?? []) as BvaRow[];

  const columns: DxGridColumn<BvaRow>[] = [
    { key: "account", header: "Account", render: (r) => <span><span className="dx-mono font-semibold">{r.code}</span> {r.name}</span> },
    { key: "type", header: "Type", render: (r) => <DxBadge tone="neutral">{r.type}</DxBadge> },
    { key: "budget", header: "Budget", align: "right", render: (r) => <span className="dx-mono">{NGN(r.budget)}</span> },
    { key: "actual", header: "Actual", align: "right", render: (r) => <span className="dx-mono">{NGN(r.actual)}</span> },
    { key: "variance", header: "Variance", align: "right", render: (r) => {
        const variance = Number(r.variance);
        const good = r.type === "EXPENSE" ? variance >= 0 : variance <= 0;
        return <span className={`dx-mono font-semibold ${good ? "text-[var(--dx-success,#10b981)]" : "text-[var(--dx-danger,#e11d48)]"}`}>{NGN(r.variance)}</span>;
      } },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Accounting" }, { label: "Budgets" }]}
        title="Budgets"
        subtitle="Monthly budgets per account, compared against actual posted activity."
        actions={<DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setSetOpen(true)}>Set budget</DxButton>}
      />

      <DxPanel>
        <div className="grid max-w-xl gap-4 sm:grid-cols-3">
          <DxInput label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <DxInput label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </DxPanel>

      <DxPanel flush>
        <DxGrid<BvaRow>
          borderless columns={columns} data={items} rowKey={(r) => r.account_id} isLoading={report.isLoading}
          empty={{ icon: PiggyBank, title: "No budgets or activity", description: "No budgets or activity in this range yet. Set a budget to begin." }}
        />
      </DxPanel>

      <SetBudgetModal open={setOpen} onClose={() => setSetOpen(false)} onDone={() => { setSetOpen(false); qc.invalidateQueries({ queryKey: ["bva"] }); }} />
    </DxPage>
  );
}

function SetBudgetModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const now = new Date();
  const [f, setF] = useState({ account_id: "", period_code: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, amount: "" });
  const accounts = useQuery({ queryKey: ["accounts-all"], queryFn: () => accountsApi.list(), enabled: open });
  const save = useMutation({
    mutationFn: () => financeApi.upsertBudget({ account_id: Number(f.account_id), period_code: f.period_code, amount: Number(f.amount) }),
    onSuccess: () => { toast.success("Budget saved"); onDone(); },
    onError: (e: any) => toast.error("Couldn't save budget", accountingApi.errMsg(e, "")),
  });
  const accountOptions = [
    { value: "", label: "Select account…" },
    ...(accounts.data ?? []).filter((a: Account) => a.account_type === "REVENUE" || a.account_type === "EXPENSE")
      .map((a: Account) => ({ value: String(a.id), label: `${a.code} · ${a.name} (${a.account_type})` })),
  ];
  return (
    <DxPopup isOpen={open} onClose={onClose} title="Set budget" size="md">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <DxSelect label="Account" required value={f.account_id} onChange={(e) => setF({ ...f, account_id: e.target.value })} options={accountOptions} />
        <div className="grid grid-cols-2 gap-3">
          <DxInput label="Period (YYYY-MM)" required pattern="\d{4}-\d{2}" value={f.period_code} onChange={(e) => setF({ ...f, period_code: e.target.value })} />
          <DxInput label="Budget amount" type="number" mono min={0} step="0.01" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        </div>
        <div className="flex justify-end">
          <DxButton type="submit" variant="primary" isLoading={save.isPending}>Save budget</DxButton>
        </div>
      </form>
    </DxPopup>
  );
}
