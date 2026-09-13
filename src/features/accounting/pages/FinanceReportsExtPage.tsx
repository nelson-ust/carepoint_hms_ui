import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Waves } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MetricCard } from "@/components/charts/MetricCard";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { financeExtApi, fmtNaira, downloadBlob } from "../api/finance-ext.api";
import { accountingApi } from "../api/accounting.api";
import { useToast } from "@/components/feedback/ToastProvider";

type Tab = "cashflow" | "gl" | "departmental" | "posting";

function monthStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
const today = () => new Date().toISOString().slice(0, 10);

export function FinanceReportsExtPage() {
  const toast = useToast();
  const [sweeping, setSweeping] = useState(false);
  const [tab, setTab] = useState<Tab>("cashflow");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());

  const segments = useQuery({ queryKey: ["fin", "arseg"], queryFn: financeExtApi.arSegments });
  const cashflow = useQuery({
    queryKey: ["fin", "cashflow", from, to],
    queryFn: () => financeExtApi.cashFlow(from, to),
    enabled: tab === "cashflow",
  });
  const gl = useQuery({
    queryKey: ["fin", "gl", from, to],
    queryFn: () => financeExtApi.generalLedger({ date_from: from, date_to: to }),
    enabled: tab === "gl",
  });
  const dept = useQuery({
    queryKey: ["fin", "dept", from, to],
    queryFn: () => financeExtApi.departmentalPnl(from, to),
    enabled: tab === "departmental",
  });
  const posting = useQuery({
    queryKey: ["fin", "posting"],
    queryFn: financeExtApi.postingStatus,
    enabled: tab === "posting",
  });

  const glColumns: DataTableColumn<Record<string, string | number | null>>[] = [
    { key: "date", header: "Date" },
    { key: "entry_no", header: "Entry" },
    { key: "account_code", header: "Account" },
    { key: "account_name", header: "Name" },
    { key: "description", header: "Description" },
    { key: "source", header: "Source" },
    { key: "debit", header: "Debit", align: "right",
      render: (r) => parseFloat(String(r.debit)) ? fmtNaira(String(r.debit)) : "" },
    { key: "credit", header: "Credit", align: "right",
      render: (r) => parseFloat(String(r.credit)) ? fmtNaira(String(r.credit)) : "" },
  ];

  const cf = cashflow.data;
  const section = (label: string, s?: { rows: { code: string; name: string; amount: string }[]; total: string }) => (
    <div className="mb-4">
      <div className="flex justify-between font-semibold text-secondary-900">
        <span>{label}</span><span>{fmtNaira(s?.total)}</span>
      </div>
      <div className="mt-1 space-y-0.5">
        {(s?.rows ?? []).map((r) => (
          <div key={r.code} className="flex justify-between text-sm text-secondary-600">
            <span>{r.code} · {r.name}</span><span>{fmtNaira(r.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Advanced Financial Reports"
        description="Cash flow, general ledger, departmental profitability and posting health." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="AR — patients" value={fmtNaira(segments.data?.patient_self_pay)} isLoading={segments.isLoading} />
        <MetricCard label="AR — HMO (fee-for-service)" value={fmtNaira(segments.data?.hmo_fee_for_service)} isLoading={segments.isLoading} />
        <MetricCard label="AR — capitation" value={fmtNaira(segments.data?.capitation)} isLoading={segments.isLoading} />
        <MetricCard label="Total receivables" value={fmtNaira(segments.data?.total)} isLoading={segments.isLoading} />
      </div>

      <Card className="mt-6 p-4">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex gap-1 rounded-xl bg-secondary-100 p-1">
            {([["cashflow", "Cash flow"], ["gl", "General ledger"],
               ["departmental", "Departmental P&L"], ["posting", "Posting status"]] as [Tab, string][]) 
              .map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  tab === t ? "bg-white text-secondary-900 shadow-sm" : "text-secondary-500 hover:text-secondary-800"}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            {tab === "gl" && (
              <Button variant="secondary" onClick={() =>
                financeExtApi.generalLedgerXlsx({ date_from: from, date_to: to })
                  .then((b) => downloadBlob(b, `general_ledger_${from}_${to}.xlsx`))}>
                <Download className="mr-1 h-4 w-4" /> XLSX
              </Button>
            )}
          </div>
        </div>

        {tab === "cashflow" && (
          <div className="max-w-2xl">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-secondary-900">
              <Waves className="h-5 w-5" /> Cash flow statement
            </h2>
            {section("Operating activities", cf?.operating)}
            {section("Investing activities", cf?.investing)}
            {section("Financing activities", cf?.financing)}
            <div className="mt-4 space-y-1 border-t border-secondary-200 pt-3 text-sm">
              <div className="flex justify-between font-semibold text-secondary-900">
                <span>Net cash flow</span><span>{fmtNaira(cf?.net_cash_flow)}</span>
              </div>
              <div className="flex justify-between text-secondary-600">
                <span>Opening cash</span><span>{fmtNaira(cf?.opening_cash)}</span>
              </div>
              <div className="flex justify-between font-semibold text-secondary-900">
                <span>Closing cash</span><span>{fmtNaira(cf?.closing_cash)}</span>
              </div>
            </div>
          </div>
        )}

        {tab === "gl" && (
          <DataTable columns={glColumns} data={gl.data?.rows} rowKey={(_, i) => i}
            isLoading={gl.isLoading}
            error={gl.isError ? "Could not load the general ledger." : null}
            onRetry={() => gl.refetch()}
            footer={<div className="flex justify-end gap-6 p-2 text-sm font-semibold">
              <span>Dr {fmtNaira(gl.data?.total_debit)}</span>
              <span>Cr {fmtNaira(gl.data?.total_credit)}</span>
            </div>}
            empty={{ title: "No posted lines in range" }} />
        )}

        {tab === "departmental" && (
          <DataTable
            columns={[
              { key: "cost_center", header: "Cost center" },
              { key: "revenue", header: "Revenue", align: "right", render: (r: any) => fmtNaira(r.revenue) },
              { key: "expense", header: "Expense", align: "right", render: (r: any) => fmtNaira(r.expense) },
              { key: "surplus", header: "Surplus", align: "right", render: (r: any) => (
                  <span className={parseFloat(r.surplus) >= 0 ? "text-success-600 font-semibold" : "text-danger-600 font-semibold"}>
                    {fmtNaira(r.surplus)}</span>) },
            ]}
            data={dept.data?.columns} rowKey={(_, i) => i} isLoading={dept.isLoading}
            footer={<div className="flex justify-end gap-6 p-2 text-sm font-semibold">
              <span>Revenue {fmtNaira(dept.data?.total_revenue)}</span>
              <span>Expense {fmtNaira(dept.data?.total_expense)}</span>
            </div>}
            empty={{ title: "No departmental activity",
              description: "Tag journal lines with cost centers (Settings → Cost centers) to see profitability." }} />
        )}

        {tab === "posting" && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-secondary-500">
              Pending items are money events not yet in the ledger — the sweep is idempotent and safe to run any time.
            </p>
            <Button disabled={sweeping} onClick={() => {
              setSweeping(true);
              accountingApi.autoPost()
                .then((o) => { toast.success(`Sweep complete — ${o.created} entries posted, ${o.skipped_existing} already booked.`); posting.refetch(); })
                .catch((e: any) => toast.error(e?.response?.data?.detail ?? "Sweep failed."))
                .finally(() => setSweeping(false));
            }}>
              {sweeping ? "Sweeping…" : "Run sweep now"}
            </Button>
          </div>
        )}
        {tab === "posting" && (
          <DataTable
            columns={[
              { key: "source", header: "Source" },
              { key: "total", header: "Total", align: "center" },
              { key: "swept", header: "Posted", align: "center" },
              { key: "pending", header: "Pending", align: "center",
                render: (r: any) => r.pending > 0
                  ? <span className="font-semibold text-warning-600">{r.pending}</span>
                  : <span className="text-success-600">0</span> },
            ]}
            data={posting.data?.sources} rowKey={(r: any) => r.source}
            isLoading={posting.isLoading} empty={{ title: "No posting sources" }} />
        )}
      </Card>
    </div>
  );
}
