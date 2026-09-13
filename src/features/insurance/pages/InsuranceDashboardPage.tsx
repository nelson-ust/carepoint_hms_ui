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
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MetricCard } from "@/components/charts/MetricCard";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
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

  const balanceColumns: DataTableColumn<PayerBalance>[] = [
    { key: "provider_name", header: "Payer" },
    { key: "claims_outstanding", header: "Claims (FFS)", align: "right",
      render: (r) => fmtNaira(r.claims_outstanding) },
    { key: "capitation_outstanding", header: "Capitation", align: "right",
      render: (r) => fmtNaira(r.capitation_outstanding) },
    { key: "total_outstanding", header: "Total outstanding", align: "right",
      render: (r) => <span className="font-semibold">{fmtNaira(r.total_outstanding)}</span> },
  ];

  const agingRows = aging.data?.providers ?? [];
  const agingColumns: DataTableColumn<Record<string, string | number>>[] = [
    { key: "provider_name", header: "Payer" },
    { key: "0_30", header: "0–30d", align: "right", render: (r) => fmtNaira(String(r["0_30"])) },
    { key: "31_60", header: "31–60d", align: "right", render: (r) => fmtNaira(String(r["31_60"])) },
    { key: "61_90", header: "61–90d", align: "right", render: (r) => fmtNaira(String(r["61_90"])) },
    { key: "over_90", header: "90d+", align: "right",
      render: (r) => <span className="text-danger-600 font-semibold">{fmtNaira(String(r["over_90"]))}</span> },
    { key: "total", header: "Total", align: "right",
      render: (r) => <span className="font-semibold">{fmtNaira(String(r["total"]))}</span> },
  ];

  const topReasons = d?.rejection?.top_reasons ?? [];
  const expiring = d?.expiring_policies ?? [];

  return (
    <div>
      <PageHeader
        title="Insurance Dashboard"
        description="HMO receivables, claims performance and capitation at a glance."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total HMO outstanding" icon={Banknote}
          value={fmtNaira(d?.total_outstanding)} isLoading={dashboard.isLoading} />
        <MetricCard label="Claims this month" icon={FileText}
          value={`${d?.claims_this_month?.count ?? 0} · ${fmtNaira(d?.claims_this_month?.value)}`}
          isLoading={dashboard.isLoading} />
        <MetricCard label="Capitation this month" icon={ShieldCheck}
          value={`${fmtNaira(d?.capitation_this_month?.received)} / ${fmtNaira(d?.capitation_this_month?.expected)}`}
          isLoading={dashboard.isLoading} />
        <MetricCard label="Avg days to settlement" icon={Clock}
          value={d?.settlement?.avg_days_to_settlement != null
            ? Math.round(d.settlement.avg_days_to_settlement) : "—"}
          isLoading={dashboard.isLoading} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-secondary-900">Outstanding by payer</h2>
          <DataTable columns={balanceColumns} data={balances}
            rowKey={(r) => r.provider_id} isLoading={dashboard.isLoading}
            onRowClick={(r) => openPayer(r.provider_id)}
            error={dashboard.isError ? "Could not load the dashboard." : null}
            onRetry={() => dashboard.refetch()}
            empty={{ title: "Nothing outstanding", description: "No payer owes you right now." }} />
          <p className="mt-2 text-xs text-secondary-400">Click a payer to open its statement.</p>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-secondary-900">Claim aging (approved, unpaid)</h2>
          <DataTable columns={agingColumns} data={agingRows}
            rowKey={(r, i) => String(r["provider_id"] ?? i)} isLoading={aging.isLoading}
            onRowClick={(r) => openPayer(r["provider_id"] as number)}
            error={aging.isError ? "Could not load the aging report." : null}
            onRetry={() => aging.refetch()}
            empty={{ title: "No aged claims" }} />
        </Card>

        <Card className="p-6">
          <h2 className="mb-1 text-lg font-semibold text-secondary-900">
            <TrendingDown className="mr-2 inline h-5 w-5 text-danger-500" />
            Top rejection reasons
          </h2>
          <p className="mb-4 text-sm text-secondary-500">
            Rejection rate: {d?.rejection?.rejection_rate_percent
              ? `${parseFloat(d.rejection.rejection_rate_percent).toFixed(1)}%` : "—"} ·
            value {fmtNaira(d?.rejection?.rejected_value)}
          </p>
          <ul className="space-y-2">
            {topReasons.length === 0 && (
              <li className="text-sm text-secondary-500">No rejections recorded.</li>
            )}
            {topReasons.map((r: { code: string; count: number; value: string }) => (
              <li key={r.code} className="flex items-center justify-between rounded-lg bg-secondary-50 px-3 py-2">
                <span className="font-medium text-secondary-800">{r.code}</span>
                <span className="text-sm text-secondary-500">
                  {r.count}× · {fmtNaira(r.value)}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-secondary-900">
            <AlertTriangle className="mr-2 inline h-5 w-5 text-warning-500" />
            Policies expiring within 30 days
          </h2>
          <ul className="space-y-2">
            {expiring.length === 0 && (
              <li className="text-sm text-secondary-500">No policies expiring soon.</li>
            )}
            {expiring.map((e: { id: number; policy_number: string; valid_to: string }) => (
              <li key={e.id} className="flex items-center justify-between rounded-lg bg-secondary-50 px-3 py-2">
                <span className="font-medium text-secondary-800">{e.policy_number}</span>
                <Badge variant="soft-warning">expires {e.valid_to}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
