import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Waves } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxButton, DxKpi, DxInput, DxTabs, DxGrid, type DxGridColumn,
} from "@/components/dx";
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
  const cashflow = useQuery({ queryKey: ["fin", "cashflow", from, to], queryFn: () => financeExtApi.cashFlow(from, to), enabled: tab === "cashflow" });
  const gl = useQuery({ queryKey: ["fin", "gl", from, to], queryFn: () => financeExtApi.generalLedger({ date_from: from, date_to: to }), enabled: tab === "gl" });
  const dept = useQuery({ queryKey: ["fin", "dept", from, to], queryFn: () => financeExtApi.departmentalPnl(from, to), enabled: tab === "departmental" });
  const posting = useQuery({ queryKey: ["fin", "posting"], queryFn: financeExtApi.postingStatus, enabled: tab === "posting" });

  const glColumns: DxGridColumn<Record<string, string | number | null>>[] = [
    { key: "date", header: "Date" },
    { key: "entry_no", header: "Entry" },
    { key: "account_code", header: "Account" },
    { key: "account_name", header: "Name" },
    { key: "description", header: "Description" },
    { key: "source", header: "Source" },
    { key: "debit", header: "Debit", align: "right", render: (r) => <span className="dx-mono">{parseFloat(String(r.debit)) ? fmtNaira(String(r.debit)) : ""}</span> },
    { key: "credit", header: "Credit", align: "right", render: (r) => <span className="dx-mono">{parseFloat(String(r.credit)) ? fmtNaira(String(r.credit)) : ""}</span> },
  ];

  const cf = cashflow.data;
  const section = (label: string, s?: { rows: { code: string; name: string; amount: string }[]; total: string }) => (
    <div className="mb-4">
      <div className="flex justify-between font-semibold text-[var(--dx-text)]">
        <span>{label}</span><span className="dx-mono">{fmtNaira(s?.total)}</span>
      </div>
      <div className="mt-1 space-y-0.5">
        {(s?.rows ?? []).map((r) => (
          <div key={r.code} className="flex justify-between text-[13px] text-[var(--dx-text-muted)]">
            <span>{r.code} · {r.name}</span><span className="dx-mono">{fmtNaira(r.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Accounting" }, { label: "Reports+" }]}
        title="Advanced Financial Reports"
        subtitle="Cash flow, general ledger, departmental profitability and posting health."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DxKpi label="AR — patients" tone="accent" value={fmtNaira(segments.data?.patient_self_pay)} isLoading={segments.isLoading} />
        <DxKpi label="AR — HMO (fee-for-service)" tone="info" value={fmtNaira(segments.data?.hmo_fee_for_service)} isLoading={segments.isLoading} />
        <DxKpi label="AR — capitation" tone="warning" value={fmtNaira(segments.data?.capitation)} isLoading={segments.isLoading} />
        <DxKpi label="Total receivables" tone="success" value={fmtNaira(segments.data?.total)} isLoading={segments.isLoading} />
      </div>

      <DxPanel>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <DxTabs<Tab>
            value={tab}
            onChange={setTab}
            items={[
              { key: "cashflow", label: "Cash flow" },
              { key: "gl", label: "General ledger" },
              { key: "departmental", label: "Departmental P&L" },
              { key: "posting", label: "Posting status" },
            ]}
          />
          <div className="flex items-end gap-2">
            <DxInput label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <DxInput label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            {tab === "gl" && (
              <DxButton variant="default" leftIcon={<Download className="h-4 w-4" />} onClick={() =>
                financeExtApi.generalLedgerXlsx({ date_from: from, date_to: to }).then((b) => downloadBlob(b, `general_ledger_${from}_${to}.xlsx`))}>XLSX</DxButton>
            )}
          </div>
        </div>

        {tab === "cashflow" && (
          <div className="max-w-2xl">
            <h2 className="mb-4 flex items-center gap-2 text-[16px] font-semibold text-[var(--dx-text)]"><Waves className="h-5 w-5" /> Cash flow statement</h2>
            {section("Operating activities", cf?.operating)}
            {section("Investing activities", cf?.investing)}
            {section("Financing activities", cf?.financing)}
            <div className="mt-4 space-y-1 border-t border-[var(--dx-border)] pt-3 text-[13px]">
              <div className="flex justify-between font-semibold text-[var(--dx-text)]"><span>Net cash flow</span><span className="dx-mono">{fmtNaira(cf?.net_cash_flow)}</span></div>
              <div className="flex justify-between text-[var(--dx-text-muted)]"><span>Opening cash</span><span className="dx-mono">{fmtNaira(cf?.opening_cash)}</span></div>
              <div className="flex justify-between font-semibold text-[var(--dx-text)]"><span>Closing cash</span><span className="dx-mono">{fmtNaira(cf?.closing_cash)}</span></div>
            </div>
          </div>
        )}

        {tab === "gl" && (
          <DxGrid<Record<string, string | number | null>>
            borderless columns={glColumns} data={gl.data?.rows} rowKey={(_, i) => i} isLoading={gl.isLoading}
            error={gl.isError ? "Could not load the general ledger." : null}
            onRetry={() => gl.refetch()}
            footer={<div className="flex justify-end gap-6 p-2 text-[13px] font-semibold"><span className="dx-mono">Dr {fmtNaira(gl.data?.total_debit)}</span><span className="dx-mono">Cr {fmtNaira(gl.data?.total_credit)}</span></div>}
            empty={{ title: "No posted lines in range" }}
          />
        )}

        {tab === "departmental" && (
          <DxGrid<any>
            borderless
            columns={[
              { key: "cost_center", header: "Cost center" },
              { key: "revenue", header: "Revenue", align: "right", render: (r: any) => <span className="dx-mono">{fmtNaira(r.revenue)}</span> },
              { key: "expense", header: "Expense", align: "right", render: (r: any) => <span className="dx-mono">{fmtNaira(r.expense)}</span> },
              { key: "surplus", header: "Surplus", align: "right", render: (r: any) => <span className={`dx-mono font-semibold ${parseFloat(r.surplus) >= 0 ? "text-[var(--dx-success,#10b981)]" : "text-[var(--dx-danger,#e11d48)]"}`}>{fmtNaira(r.surplus)}</span> },
            ]}
            data={dept.data?.columns} rowKey={(_, i) => i} isLoading={dept.isLoading}
            footer={<div className="flex justify-end gap-6 p-2 text-[13px] font-semibold"><span className="dx-mono">Revenue {fmtNaira(dept.data?.total_revenue)}</span><span className="dx-mono">Expense {fmtNaira(dept.data?.total_expense)}</span></div>}
            empty={{ title: "No departmental activity", description: "Tag journal lines with cost centers (Settings → Cost centers) to see profitability." }}
          />
        )}

        {tab === "posting" && (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] text-[var(--dx-text-muted)]">Pending items are money events not yet in the ledger — the sweep is idempotent and safe to run any time.</p>
              <DxButton variant="primary" disabled={sweeping} isLoading={sweeping} onClick={() => {
                setSweeping(true);
                accountingApi.autoPost()
                  .then((o) => { toast.success(`Sweep complete — ${o.created} entries posted, ${o.skipped_existing} already booked.`); posting.refetch(); })
                  .catch((e: any) => toast.error(e?.response?.data?.detail ?? "Sweep failed."))
                  .finally(() => setSweeping(false));
              }}>Run sweep now</DxButton>
            </div>
            <DxGrid<any>
              borderless
              columns={[
                { key: "source", header: "Source" },
                { key: "total", header: "Total", align: "center" },
                { key: "swept", header: "Posted", align: "center" },
                { key: "pending", header: "Pending", align: "center", render: (r: any) => r.pending > 0 ? <span className="font-semibold text-[var(--dx-warning,#d97706)]">{r.pending}</span> : <span className="text-[var(--dx-success,#10b981)]">0</span> },
              ]}
              data={posting.data?.sources} rowKey={(r: any) => r.source} isLoading={posting.isLoading} empty={{ title: "No posting sources" }}
            />
          </>
        )}
      </DxPanel>
    </DxPage>
  );
}
