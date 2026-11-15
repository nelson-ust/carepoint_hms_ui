import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Landmark,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { format, isValid } from "date-fns";
import {
  DxBadge,
  DxButton,
  DxConfirm,
  DxGrid,
  DxKpi,
  DxPage,
  DxPageHeader,
  DxPanel,
  DxPopup,
  DxTextarea,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiClient } from "@/lib/api/api-client";
import { subscriptionPlanApi, type SubscriptionPayment } from "../api/subscription-plan.api";

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

export function PaymentConfirmationsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<SubscriptionPayment | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<SubscriptionPayment | null>(null);

  const pendingQuery = useQuery({
    queryKey: ["subscription", "pending-payments"],
    queryFn: subscriptionPlanApi.listPendingPayments,
    refetchInterval: 60_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["subscription", "pending-payments"] });

  // Proof is behind SaaS-admin auth, so fetch it as a blob (carries the bearer
  // token via the axios interceptor) and open it in a new tab.
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

  const confirmMut = useMutation({
    mutationFn: (id: number) => subscriptionPlanApi.confirmPayment(id),
    onSuccess: (res) => {
      toast.success("Payment confirmed", res.message);
      refresh();
    },
    onError: (err: any) => toast.error("Confirm failed", err?.response?.data?.message || "Please try again."),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => subscriptionPlanApi.rejectPayment(id, reason),
    onSuccess: (res) => {
      toast.success("Payment rejected", res.message);
      refresh();
    },
    onError: (err: any) => toast.error("Reject failed", err?.response?.data?.message || "Please try again."),
  });

  const payments = pendingQuery.data ?? [];
  const totals = useMemo(() => {
    const sum = payments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const withProof = payments.filter((p) => p.has_proof).length;
    return { count: payments.length, sum, withProof };
  }, [payments]);

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
      key: "bank",
      header: "Payer",
      minWidth: 180,
      render: (p) => (
        <div>
          <p className="font-medium text-[var(--dx-text)]">{p.payer_bank_name || "—"}</p>
          <p className="text-[11px] text-[var(--dx-text-muted)]">
            {p.payer_account_name || ""} {p.payer_reference ? `· ${p.payer_reference}` : ""}
          </p>
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
      key: "submitted",
      header: "Submitted",
      width: 170,
      accessor: (p) => p.paid_at ?? "",
      render: (p) => <span className="text-[var(--dx-text-muted)]">{safeDate(p.paid_at)}</span>,
    },
    {
      key: "proof",
      header: "Proof",
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
    {
      key: "actions",
      header: "Actions",
      align: "right",
      width: 180,
      render: (p) => (
        <div className="flex items-center justify-end gap-1.5">
          <DxButton
            size="sm"
            variant="primary"
            leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
            onClick={() => setConfirmTarget(p)}
          >
            Confirm
          </DxButton>
          <DxButton
            size="sm"
            variant="outline-danger"
            leftIcon={<XCircle className="h-3.5 w-3.5" />}
            onClick={() => {
              setRejectReason("");
              setRejectTarget(p);
            }}
          >
            Reject
          </DxButton>
        </div>
      ),
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "SaaS admin" }, { label: "Payment confirmations" }]}
        title="Payment confirmations"
        subtitle="Review and confirm manual bank payments submitted by tenants."
        actions={
          <DxButton
            leftIcon={<RefreshCw className={pendingQuery.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />}
            onClick={() => pendingQuery.refetch()}
          >
            Refresh
          </DxButton>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <DxKpi label="Awaiting confirmation" value={totals.count} icon={Clock} tone="warning" isLoading={pendingQuery.isLoading} />
        <DxKpi label="Total pending value" value={money(totals.sum)} icon={Banknote} tone="accent" isLoading={pendingQuery.isLoading} />
        <DxKpi label="With proof attached" value={totals.withProof} icon={FileText} tone="info" isLoading={pendingQuery.isLoading} />
      </div>

      <DxPanel title="Pending payments" icon={<Banknote className="h-4 w-4" />} flush>
        <DxGrid
          borderless
          columns={columns}
          data={payments}
          rowKey={(p) => p.id}
          isLoading={pendingQuery.isLoading}
          error={pendingQuery.error ? "Unable to load pending payments." : null}
          onRetry={() => pendingQuery.refetch()}
          empty={{
            icon: CheckCircle2,
            title: "All caught up",
            description: "There are no manual payments awaiting confirmation right now.",
          }}
        />
      </DxPanel>

      <DxConfirm
        isOpen={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        title="Confirm this payment?"
        tone="primary"
        confirmLabel="Confirm payment"
        description={
          confirmTarget
            ? `Confirming ${money(confirmTarget.amount, confirmTarget.currency)} from ${
                confirmTarget.tenant_name || "this tenant"
              } marks invoice #${confirmTarget.invoice_id} paid and activates their subscription. Verify the proof of payment first.`
            : undefined
        }
        onConfirm={async () => {
          if (!confirmTarget) return;
          await confirmMut.mutateAsync(confirmTarget.id);
          setConfirmTarget(null);
        }}
      />

      <DxPopup
        isOpen={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Reject payment"
        size="md"
        footer={
          <>
            <DxButton onClick={() => setRejectTarget(null)} disabled={rejectMut.isPending}>
              Cancel
            </DxButton>
            <DxButton
              variant="danger"
              isLoading={rejectMut.isPending}
              onClick={async () => {
                if (!rejectTarget) return;
                await rejectMut.mutateAsync({ id: rejectTarget.id, reason: rejectReason });
                setRejectTarget(null);
              }}
            >
              Reject payment
            </DxButton>
          </>
        }
      >
        <p className="mb-3 text-[var(--dx-text-muted)]">
          Let the tenant know why this evidence was rejected so they can re-submit.
        </p>
        <DxTextarea
          label="Reason"
          placeholder="e.g. The uploaded receipt doesn't match the amount due."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={3}
        />
      </DxPopup>
    </DxPage>
  );
}
