import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { routes } from "@/config/routes";
import {
  AlertTriangle,
  Banknote,
  Clock,
  FileText,
  ShieldCheck,
  TrendingDown,
} from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxBadge, DxKpi, DxGrid, type DxGridColumn,
} from "@/components/dx";
import { hmoApi, fmtNaira, type PayerBalance } from "../api/hmo.api";

export function InsuranceDashboardPage() {
  const navigate = useNavigate();
  const openPayer = (providerId: number | string | undefined, tab = "statement") => {
    if (providerId != null) navigate(`${routes.insurancePayers}?payer=${providerId}&tab=${tab}`);
  };
  const dashboard = useQuery({ queryKey: ["hmo", "dashboard"], queryFn: hmoApi.dashboard });
  const aging = useQuery({ queryKey: ["hmo", "aging"], queryFn: () => hmoApi.claimAging() });

  const d = dashboard.data;
  const balances: PayerBalance[] = d?.outstanding_by_payer ?? [];

  const balanceColumns: DxGridColumn<PayerBalance>[] = [
    { key: "provider_name", header: "Payer" },
    { key: "claims_outstanding", header: "Claims (FFS)", align: "right", render: (r) => <span className="dx-mono">{fmtNaira(r.claims_outstanding)}</span> },
    { key: "capitation_outstanding", header: "Capitation", align: "right", render: (r) => <span className="dx-mono">{fmtNaira(r.capitation_outstanding)}</span> },
    { key: "total_outstanding", header: "Total outstanding", align: "right", render: (r) => <span className="dx-mono font-semibold">{fmtNaira(r.total_outstanding)}</span> },
  ];

  const agingRows = aging.data?.providers ?? [];
  const agingColumns: DxGridColumn<Record<string, string | number>>[] = [
    { key: "provider_name", header: "Payer" },
    { key: "0_30", header: "0–30d", align: "right", render: (r) => <span className="dx-mono">{fmtNaira(String(r["0_30"]))}</span> },
    { key: "31_60", header: "31–60d", align: "right", render: (r) => <span className="dx-mono">{fmtNaira(String(r["31_60"]))}</span> },
    { key: "61_90", header: "61–90d", align: "right", render: (r) => <span className="dx-mono">{fmtNaira(String(r["61_90"]))}</span> },
    { key: "over_90", header: "90d+", align: "right", render: (r) => <span className="dx-mono font-semibold text-[var(--dx-danger,#e11d48)]">{fmtNaira(String(r["over_90"]))}</span> },
    { key: "total", header: "Total", align: "right", render: (r) => <span className="dx-mono font-semibold">{fmtNaira(String(r["total"]))}</span> },
  ];

  const topReasons = d?.rejection?.top_reasons ?? [];
  const expiring = d?.expiring_policies ?? [];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Insurance" }, { label: "Dashboard" }]}
        title="Insurance Dashboard"
        subtitle="HMO receivables, claims performance and capitation at a glance."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DxKpi label="Total HMO outstanding" icon={Banknote} tone="accent"
          value={fmtNaira(d?.total_outstanding)} isLoading={dashboard.isLoading} />
        <DxKpi label="Claims this month" icon={FileText} tone="info"
          value={`${d?.claims_this_month?.count ?? 0} · ${fmtNaira(d?.claims_this_month?.value)}`}
          isLoading={dashboard.isLoading} />
        <DxKpi label="Capitation this month" icon={ShieldCheck} tone="success"
          value={`${fmtNaira(d?.capitation_this_month?.received)} / ${fmtNaira(d?.capitation_this_month?.expected)}`}
          isLoading={dashboard.isLoading} />
        <DxKpi label="Avg days to settlement" icon={Clock} tone="neutral"
          value={d?.settlement?.avg_days_to_settlement != null ? Math.round(d.settlement.avg_days_to_settlement) : "—"}
          isLoading={dashboard.isLoading} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <DxPanel title="Outstanding by payer" flush>
          <DxGrid<PayerBalance>
            borderless columns={balanceColumns} data={balances} rowKey={(r) => r.provider_id}
            isLoading={dashboard.isLoading}
            error={dashboard.isError ? "Could not load the dashboard." : null}
            onRetry={() => dashboard.refetch()}
            onRowClick={(r) => openPayer(r.provider_id)}
            empty={{ title: "Nothing outstanding", description: "No payer owes you right now." }}
          />
        </DxPanel>

        <DxPanel title="Claim aging (approved, unpaid)" flush>
          <DxGrid<Record<string, string | number>>
            borderless columns={agingColumns} data={agingRows}
            rowKey={(r, i) => String(r["provider_id"] ?? i)} isLoading={aging.isLoading}
            error={aging.isError ? "Could not load the aging report." : null}
            onRetry={() => aging.refetch()}
            onRowClick={(r) => openPayer(r["provider_id"] as number)}
            empty={{ title: "No aged claims" }}
          />
        </DxPanel>

        <DxPanel
          title="Top rejection reasons"
          icon={<TrendingDown className="h-4 w-4 text-[var(--dx-danger,#e11d48)]" />}
        >
          <p className="mb-3 text-[12.5px] text-[var(--dx-text-muted)]">
            Rejection rate: {d?.rejection?.rejection_rate_percent ? `${parseFloat(d.rejection.rejection_rate_percent).toFixed(1)}%` : "—"} ·
            value {fmtNaira(d?.rejection?.rejected_value)}
          </p>
          <ul className="space-y-2">
            {topReasons.length === 0 && <li className="text-[13px] text-[var(--dx-text-muted)]">No rejections recorded.</li>}
            {topReasons.map((r: { code: string; count: number; value: string }) => (
              <li key={r.code} className="flex items-center justify-between rounded-md bg-[var(--dx-surface-sunken)] px-3 py-2">
                <span className="font-medium text-[var(--dx-text)]">{r.code}</span>
                <span className="text-[12.5px] text-[var(--dx-text-muted)]">{r.count}× · {fmtNaira(r.value)}</span>
              </li>
            ))}
          </ul>
        </DxPanel>

        <DxPanel
          title="Policies expiring within 30 days"
          icon={<AlertTriangle className="h-4 w-4 text-[var(--dx-warning,#d97706)]" />}
        >
          <ul className="space-y-2">
            {expiring.length === 0 && <li className="text-[13px] text-[var(--dx-text-muted)]">No policies expiring soon.</li>}
            {expiring.map((e: { id: number; policy_number: string; valid_to: string }) => (
              <li key={e.id} className="flex items-center justify-between rounded-md bg-[var(--dx-surface-sunken)] px-3 py-2">
                <span className="font-medium text-[var(--dx-text)]">{e.policy_number}</span>
                <DxBadge tone="warning">expires {e.valid_to}</DxBadge>
              </li>
            ))}
          </ul>
        </DxPanel>
      </div>
    </DxPage>
  );
}
