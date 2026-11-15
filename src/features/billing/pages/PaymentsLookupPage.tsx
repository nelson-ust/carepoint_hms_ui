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
} from "lucide-react";
import { format, isValid } from "date-fns";
import {
  DxBadge,
  DxButton,
  DxGrid,
  DxKpi,
  DxPage,
  DxPageHeader,
  DxSearchBox,
  DxSegmented,
  DxToolbar,
  DxToolbarSeparator,
  DxToolbarSpacer,
  type DxBadgeTone,
  type DxGridColumn,
} from "@/components/dx";
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

const STATUS_TABS = [
  { key: "SUCCEEDED", label: "Confirmed" },
  { key: "PENDING", label: "Pending" },
  { key: "FAILED", label: "Rejected" },
  { key: "ALL", label: "All" },
];

const STATUS_TONES: Record<string, { tone: DxBadgeTone; label: string }> = {
  SUCCEEDED: { tone: "success", label: "Confirmed" },
  PENDING: { tone: "warning", label: "Pending" },
  FAILED: { tone: "danger", label: "Rejected" },
};
function statusBadge(status: string) {
  const s = (status || "").toUpperCase();
  const m = STATUS_TONES[s];
  return <DxBadge tone={m?.tone ?? "neutral"} dot>{m?.label ?? s}</DxBadge>;
}

export function PaymentsLookupPage() {
  const toast = useToast();
  const [status, setStatus] = useState("SUCCEEDED");
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

  const columns: DxGridColumn<SubscriptionPayment>[] = [
    {
      key: "tenant",
      header: "Tenant",
      minWidth: 200,
      render: (p) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[var(--dx-radius)] bg-[var(--dx-accent-soft)] text-[var(--dx-accent)] shrink-0">
            <Building2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-[var(--dx-text)]">{p.tenant_name || `Tenant #${p.tenant_id}`}</p>
            <p className="font-mono text-[11px] text-[var(--dx-text-muted)]">Invoice #{p.invoice_id}</p>
          </div>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      width: 150,
      accessor: (p) => Number(p.amount || 0),
      render: (p) => <span className="font-mono font-medium text-[var(--dx-text)]">{money(p.amount, p.currency)}</span>,
    },
    {
      key: "receipt",
      header: "Receipt / Ref",
      minWidth: 170,
      render: (p) => (
        <div>
          <p className="flex items-center gap-1 font-medium text-[var(--dx-text)]">
            <Receipt className="h-3 w-3 text-[var(--dx-text-muted)]" />
            {p.receipt_number || "—"}
          </p>
          {p.payer_reference || p.transaction_reference ? (
            <p className="flex items-center gap-1 text-[11px] text-[var(--dx-text-muted)]">
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
      width: 150,
      render: (p) => (
        <DxBadge tone="neutral">
          <Landmark className="h-3 w-3" />
          {(p.payment_method || "MANUAL").replace(/_/g, " ")}
        </DxBadge>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 130,
      accessor: (p) => String(p.status),
      render: (p) => statusBadge(String(p.status)),
    },
    {
      key: "confirmed",
      header: "Confirmed",
      width: 170,
      accessor: (p) => p.confirmed_at || p.paid_at || "",
      render: (p) => <span className="text-[var(--dx-text-muted)]">{safeDate(p.confirmed_at || p.paid_at)}</span>,
    },
    {
      key: "proof",
      header: "Proof",
      align: "right",
      width: 100,
      render: (p) =>
        p.has_proof ? (
          <DxButton size="sm" variant="text" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => viewProof(p.id)}>
            View
          </DxButton>
        ) : (
          <span className="text-[var(--dx-text-muted)]">None</span>
        ),
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "SaaS admin" }, { label: "Payment lookup" }]}
        title="Payment lookup"
        subtitle="Search and review subscription payments received from tenants."
        actions={
          <DxButton
            leftIcon={<RefreshCw className={paymentsQuery.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />}
            onClick={() => paymentsQuery.refetch()}
          >
            Refresh
          </DxButton>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <DxKpi label="Records shown" value={totals.count} icon={Receipt} tone="accent" isLoading={paymentsQuery.isLoading} />
        <DxKpi label="Confirmed payments" value={totals.confirmedCount} icon={CheckCircle2} tone="info" isLoading={paymentsQuery.isLoading} />
        <DxKpi label="Confirmed value" value={money(totals.sum)} icon={Banknote} tone="success" isLoading={paymentsQuery.isLoading} />
      </div>

      <DxToolbar attached>
        <DxSegmented value={status} onChange={setStatus} items={STATUS_TABS} />
        <DxToolbarSeparator />
        <DxToolbarSpacer />
        <DxSearchBox onSearch={setSearch} placeholder="Search tenant, receipt or reference…" className="w-72" />
      </DxToolbar>

      <DxGrid
        attached
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
    </DxPage>
  );
}
