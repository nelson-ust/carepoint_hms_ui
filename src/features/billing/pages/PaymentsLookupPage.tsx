import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  Building2,
  CheckCircle2,
  Download,
  Hash,
  Landmark,
  Receipt,
  RefreshCw,
  Search,
} from "lucide-react";
import { format, isValid } from "date-fns";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MetricCard } from "@/components/charts/MetricCard";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiClient } from "@/lib/api/api-client";
import { apiErrorMessage } from "@/lib/api/api-error";
import { subscriptionPlanApi, type SubscriptionPayment } from "../api/subscription-plan.api";

/** Turn a failed payments query into an actionable message. */
function paymentsLoadError(err: unknown): string {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === 404) {
    return "Payments endpoint not found. The API server needs to be restarted to load this feature.";
  }
  if (status === 401 || status === 403) {
    return "You don't have permission to view platform payments. Sign in as a platform administrator.";
  }
  return apiErrorMessage(err, "Unable to load payments.");
}

function money(v: string | number, currency = "NGN"): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

function safeDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return isValid(d) ? format(d, "MMM d, yyyy HH:mm") : "—";
}

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "SUCCEEDED", label: "Confirmed" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Rejected" },
  { value: "ALL", label: "All" },
];

function statusBadge(status: string) {
  const s = status.toUpperCase();
  if (s === "SUCCEEDED") return <Badge variant="soft-success">Confirmed</Badge>;
  if (s === "PENDING") return <Badge variant="soft-warning">Pending</Badge>;
  if (s === "FAILED") return <Badge variant="soft-danger">Rejected</Badge>;
  return <Badge variant="secondary">{s}</Badge>;
}

export function PaymentsLookupPage() {
  const toast = useToast();
  const [status, setStatus] = useState("SUCCEEDED");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const paymentsQuery = useQuery({
    queryKey: ["subscription", "payments-lookup", status, search],
    queryFn: () =>
      subscriptionPlanApi.listPayments({
        payment_status: status,
        search: search.trim() || undefined,
        limit: 500,
      }),
  });

  const payments = paymentsQuery.data ?? [];

  const totals = useMemo(() => {
    const confirmed = payments.filter((p) => String(p.status).toUpperCase() === "SUCCEEDED");
    const sum = confirmed.reduce((acc, p) => acc + Number(p.amount || 0), 0);
    return { count: payments.length, confirmedCount: confirmed.length, sum };
  }, [payments]);

  // Proof is behind SaaS-admin auth, so fetch it as a blob and open it.
  const viewProof = async (paymentId: number) => {
    try {
      const res = await apiClient.get(`/subscription-billing/payments/${paymentId}/proof`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data as Blob);
      window.open(url, "_blank", "noopener");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error("Couldn't open proof", "The evidence file may be missing.");
    }
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const columns: DataTableColumn<SubscriptionPayment>[] = [
    {
      key: "tenant",
      header: "Tenant",
      render: (p) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10 text-primary-500">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-secondary-900">
              {p.tenant_name || `Tenant #${p.tenant_id}`}
            </p>
            <p className="data-mono text-[11px] text-secondary-400">Invoice #{p.invoice_id}</p>
          </div>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (p) => (
        <span className="data-mono text-sm font-bold text-secondary-900">{money(p.amount, p.currency)}</span>
      ),
    },
    {
      key: "receipt",
      header: "Receipt / Ref",
      render: (p) => (
        <div className="text-xs">
          <p className="flex items-center gap-1 font-bold text-secondary-700">
            <Receipt className="h-3 w-3 text-secondary-400" />
            {p.receipt_number || "—"}
          </p>
          {p.payer_reference || p.transaction_reference ? (
            <p className="flex items-center gap-1 text-secondary-400">
              <Hash className="h-3 w-3" />
              {p.payer_reference || p.transaction_reference}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "method",
      header: "Method",
      render: (p) => (
        <Badge variant="secondary">
          <Landmark className="mr-1 h-3 w-3" />
          {(p.payment_method || "MANUAL").replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (p) => statusBadge(String(p.status)),
    },
    {
      key: "confirmed",
      header: "Confirmed",
      render: (p) => (
        <span className="text-xs text-secondary-500">{safeDate(p.confirmed_at || p.paid_at)}</span>
      ),
    },
    {
      key: "proof",
      header: "Proof",
      align: "right",
      render: (p) =>
        p.has_proof ? (
          <button
            type="button"
            className="btn-ghost inline-flex px-2.5 py-1.5 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              viewProof(p.id);
            }}
          >
            <Download className="h-3.5 w-3.5" /> View
          </button>
        ) : (
          <span className="text-xs text-secondary-400">None</span>
        ),
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <PageHeader
        title="Payment Lookup"
        description="Search and review subscription payments received from tenants."
        actions={
          <Button
            variant="ghost"
            onClick={() => paymentsQuery.refetch()}
            leftIcon={<RefreshCw className={`h-4 w-4 ${paymentsQuery.isFetching ? "animate-spin" : ""}`} />}
          >
            Refresh
          </Button>
        }
      />

      <div className="grid gap-6 sm:grid-cols-3">
        <MetricCard
          label="Records Shown"
          value={totals.count}
          icon={Receipt}
          tone="primary"
          isLoading={paymentsQuery.isLoading}
        />
        <MetricCard
          label="Confirmed Payments"
          value={totals.confirmedCount}
          icon={CheckCircle2}
          tone="violet"
          isLoading={paymentsQuery.isLoading}
        />
        <MetricCard
          label="Confirmed Value"
          value={money(totals.sum)}
          icon={Banknote}
          tone="cyan"
          isLoading={paymentsQuery.isLoading}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 rounded-2xl bg-secondary-100 p-1 dark:bg-white/5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={`rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all ${
                status === tab.value
                  ? "bg-white text-primary-600 shadow-sm dark:bg-secondary-800"
                  : "text-secondary-500 hover:text-secondary-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <form onSubmit={submitSearch} className="relative w-full max-w-sm">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search tenant, receipt or reference…"
            className="w-full rounded-2xl border border-secondary-300 bg-white/70 py-3 pl-12 pr-24 text-sm outline-none focus:border-primary-500"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-primary-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-primary-600"
          >
            Search
          </button>
        </form>
      </div>

      <Card padding="none">
        <DataTable
          columns={columns}
          data={payments}
          rowKey={(p) => p.id}
          isLoading={paymentsQuery.isLoading}
          error={paymentsQuery.error ? paymentsLoadError(paymentsQuery.error) : null}
          onRetry={() => paymentsQuery.refetch()}
          empty={{
            icon: Receipt,
            title: search ? "No matching payments" : "No payments found",
            description: search
              ? "Try a different tenant name, receipt number, or reference."
              : "Confirmed subscription payments will appear here.",
          }}
        />
      </Card>
    </div>
  );
}
