import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { accountsApi, type Account } from "@/features/billing/api/accounts.api";
import { accountingApi } from "../api/accounting.api";

const NGN = (v: string | number) =>
  `₦${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export function GeneralLedgerPage() {
  const [accountId, setAccountId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const accounts = useQuery({ queryKey: ["accounts-all"], queryFn: () => accountsApi.list() });
  const ledger = useQuery({
    queryKey: ["ledger", accountId, dateFrom, dateTo],
    queryFn: () => accountingApi.ledger(Number(accountId), {
      date_from: dateFrom || undefined, date_to: dateTo || undefined,
    }),
    enabled: !!accountId,
  });

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader title="General Ledger" description="Per-account transaction history with running balances — posted entries only." />
        <button onClick={() => ledger.refetch()} disabled={!accountId} className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400" title="Refresh">
          <RefreshCw className={`h-4 w-4 ${ledger.isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      <Card className="p-5">
        <div className="grid sm:grid-cols-3 gap-4">
          <Select label="Ledger account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Select an account…</option>
            {(accounts.data ?? []).map((a: Account) => (
              <option key={a.id} value={a.id}>{a.code} · {a.name} ({a.account_type})</option>
            ))}
          </Select>
          <Input label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </Card>

      {!accountId ? (
        <Card className="p-10 text-center text-secondary-500">
          <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-40" />
          Choose an account to view its ledger.
        </Card>
      ) : ledger.isLoading ? <Skeleton className="h-48 w-full" /> : ledger.data ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-bold">
              <span className="data-mono">{ledger.data.account.code}</span> · {ledger.data.account.name}
            </h3>
            <Badge variant="secondary">{ledger.data.account.type}</Badge>
            <Badge variant="soft-info">Normal balance: {ledger.data.normal_balance}</Badge>
            <span className="ml-auto text-sm font-black data-mono">Closing: {NGN(ledger.data.closing_balance)}</span>
          </div>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-secondary-50 text-secondary-500 text-[10px] uppercase tracking-widest dark:bg-white/5">
                <tr>
                  <th className="text-left px-5 py-3">Date</th>
                  <th className="text-left px-5 py-3">Entry</th>
                  <th className="text-left px-5 py-3">Description</th>
                  <th className="text-right px-5 py-3">Debit</th>
                  <th className="text-right px-5 py-3">Credit</th>
                  <th className="text-right px-5 py-3">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100 dark:divide-white/5">
                {ledger.data.items.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-secondary-400">No posted activity for this account in the selected range.</td></tr>
                ) : ledger.data.items.map((r, i) => (
                  <tr key={i} className="hover:bg-secondary-50/60 dark:hover:bg-white/5">
                    <td className="px-5 py-2.5 whitespace-nowrap">{new Date(r.entry_date).toLocaleDateString()}</td>
                    <td className="px-5 py-2.5 data-mono text-xs font-bold">{r.entry_no}</td>
                    <td className="px-5 py-2.5 max-w-[18rem] truncate">{r.description || r.memo || "—"}</td>
                    <td className="px-5 py-2.5 text-right data-mono">{Number(r.debit) ? NGN(r.debit) : ""}</td>
                    <td className="px-5 py-2.5 text-right data-mono">{Number(r.credit) ? NGN(r.credit) : ""}</td>
                    <td className="px-5 py-2.5 text-right data-mono font-bold">{NGN(r.running_balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      ) : null}
    </div>
  );
}
