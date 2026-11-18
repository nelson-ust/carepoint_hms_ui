import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, RotateCcw } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxBadge, DxButton, DxInput, DxSelect,
  DxGrid, type DxGridColumn,
} from "@/components/dx";
import { accountsApi, type Account } from "@/features/billing/api/accounts.api";
import { accountingApi } from "../api/accounting.api";

const NGN = (v: string | number) => `₦${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

type LedgerRow = {
  entry_date: string; entry_no: string; description?: string | null; memo?: string | null;
  debit: string | number; credit: string | number; running_balance: string | number;
};

export function GeneralLedgerPage() {
  const [accountId, setAccountId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const accounts = useQuery({ queryKey: ["accounts-all"], queryFn: () => accountsApi.list() });
  const ledger = useQuery({
    queryKey: ["ledger", accountId, dateFrom, dateTo],
    queryFn: () => accountingApi.ledger(Number(accountId), { date_from: dateFrom || undefined, date_to: dateTo || undefined }),
    enabled: !!accountId,
  });

  const columns: DxGridColumn<LedgerRow>[] = [
    { key: "entry_date", header: "Date", render: (r) => <span className="whitespace-nowrap">{new Date(r.entry_date).toLocaleDateString()}</span> },
    { key: "entry_no", header: "Entry", render: (r) => <span className="dx-mono text-[12px] font-semibold">{r.entry_no}</span> },
    { key: "description", header: "Description", render: (r) => <span className="block max-w-[18rem] truncate">{r.description || r.memo || "—"}</span> },
    { key: "debit", header: "Debit", align: "right", render: (r) => <span className="dx-mono">{Number(r.debit) ? NGN(r.debit) : ""}</span> },
    { key: "credit", header: "Credit", align: "right", render: (r) => <span className="dx-mono">{Number(r.credit) ? NGN(r.credit) : ""}</span> },
    { key: "running_balance", header: "Balance", align: "right", render: (r) => <span className="dx-mono font-semibold">{NGN(r.running_balance)}</span> },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Accounting" }, { label: "Ledger" }]}
        title="General Ledger"
        subtitle="Per-account transaction history with running balances — posted entries only."
        actions={<DxButton icon title="Refresh" disabled={!accountId} onClick={() => ledger.refetch()} isLoading={ledger.isFetching}><RotateCcw /></DxButton>}
      />

      <DxPanel>
        <div className="grid gap-4 sm:grid-cols-3">
          <DxSelect label="Ledger account" value={accountId} onChange={(e) => setAccountId(e.target.value)}
            options={[{ value: "", label: "Select an account…" }, ...(accounts.data ?? []).map((a: Account) => ({ value: String(a.id), label: `${a.code} · ${a.name} (${a.account_type})` }))]} />
          <DxInput label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <DxInput label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </DxPanel>

      {!accountId ? (
        <DxPanel>
          <div className="py-10 text-center text-[13px] text-[var(--dx-text-muted)]">
            <BookOpen className="mx-auto mb-3 h-8 w-8 opacity-40" />
            Choose an account to view its ledger.
          </div>
        </DxPanel>
      ) : (
        <>
          {ledger.data && (
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-semibold text-[var(--dx-text)]"><span className="dx-mono">{ledger.data.account.code}</span> · {ledger.data.account.name}</h3>
              <DxBadge tone="neutral">{ledger.data.account.type}</DxBadge>
              <DxBadge tone="info">Normal balance: {ledger.data.normal_balance}</DxBadge>
              <span className="ml-auto dx-mono text-[13px] font-bold">Closing: {NGN(ledger.data.closing_balance)}</span>
            </div>
          )}
          <DxPanel flush>
            <DxGrid<LedgerRow>
              borderless columns={columns} data={ledger.data?.items as LedgerRow[] | undefined} rowKey={(_, i) => i} isLoading={ledger.isLoading}
              empty={{ title: "No posted activity", description: "No posted activity for this account in the selected range." }}
            />
          </DxPanel>
        </>
      )}
    </DxPage>
  );
}
