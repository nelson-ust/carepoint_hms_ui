import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PiggyBank, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import { accountsApi, type Account } from "@/features/billing/api/accounts.api";
import { accountingApi, financeApi } from "../api/accounting.api";

const NGN = (v: string | number) => `₦${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function firstOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
const today = () => new Date().toISOString().slice(0, 10);

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

  const items = report.data?.items ?? [];

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader title="Budgets" description="Monthly budgets per account, compared against actual posted activity." />
        <Button leftIcon={<Plus className="h-5 w-5" />} onClick={() => setSetOpen(true)}>Set budget</Button>
      </div>

      <Card className="p-5">
        <div className="grid sm:grid-cols-3 gap-4 max-w-xl">
          <Input label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </Card>

      {report.isLoading ? <Skeleton className="h-40 w-full" /> : items.length === 0 ? (
        <Card className="p-10 text-center text-secondary-500">
          <PiggyBank className="h-8 w-8 mx-auto mb-3 opacity-40" />
          No budgets or activity in this range yet. Set a budget to begin.
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-secondary-50 text-secondary-500 text-[10px] uppercase tracking-widest dark:bg-white/5">
              <tr>
                <th className="text-left px-5 py-3">Account</th>
                <th className="text-left px-5 py-3">Type</th>
                <th className="text-right px-5 py-3">Budget</th>
                <th className="text-right px-5 py-3">Actual</th>
                <th className="text-right px-5 py-3">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100 dark:divide-white/5">
              {items.map((r) => {
                const variance = Number(r.variance);
                const good = r.type === "EXPENSE" ? variance >= 0 : variance <= 0;
                return (
                  <tr key={r.account_id}>
                    <td className="px-5 py-2.5"><span className="data-mono font-bold">{r.code}</span> {r.name}</td>
                    <td className="px-5 py-2.5"><Badge variant="secondary">{r.type}</Badge></td>
                    <td className="px-5 py-2.5 text-right data-mono">{NGN(r.budget)}</td>
                    <td className="px-5 py-2.5 text-right data-mono">{NGN(r.actual)}</td>
                    <td className={`px-5 py-2.5 text-right data-mono font-bold ${good ? "text-emerald-600" : "text-rose-600"}`}>
                      {NGN(r.variance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <SetBudgetModal open={setOpen} onClose={() => setSetOpen(false)}
        onDone={() => { setSetOpen(false); qc.invalidateQueries({ queryKey: ["bva"] }); }} />
    </div>
  );
}

function SetBudgetModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const now = new Date();
  const [f, setF] = useState({
    account_id: "", period_code: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, amount: "",
  });
  const accounts = useQuery({ queryKey: ["accounts-all"], queryFn: () => accountsApi.list(), enabled: open });
  const save = useMutation({
    mutationFn: () => financeApi.upsertBudget({
      account_id: Number(f.account_id), period_code: f.period_code, amount: Number(f.amount),
    }),
    onSuccess: () => { toast.success("Budget saved"); onDone(); },
    onError: (e: any) => toast.error("Couldn't save budget", accountingApi.errMsg(e, "")),
  });
  return (
    <Modal isOpen={open} onClose={onClose} title="Set budget">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Select label="Account" required value={f.account_id} onChange={(e) => setF({ ...f, account_id: e.target.value })}>
          <option value="">Select account…</option>
          {(accounts.data ?? []).filter((a: Account) => a.account_type === "REVENUE" || a.account_type === "EXPENSE")
            .map((a: Account) => <option key={a.id} value={a.id}>{a.code} · {a.name} ({a.account_type})</option>)}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Period (YYYY-MM)" required pattern="\d{4}-\d{2}" value={f.period_code}
            onChange={(e) => setF({ ...f, period_code: e.target.value })} />
          <Input label="Budget amount" type="number" min={0} step="0.01" required value={f.amount}
            onChange={(e) => setF({ ...f, amount: e.target.value })} />
        </div>
        <Button type="submit" isLoading={save.isPending}>Save budget</Button>
      </form>
    </Modal>
  );
}
