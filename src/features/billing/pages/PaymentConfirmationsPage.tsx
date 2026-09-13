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
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MetricCard } from "@/components/charts/MetricCard";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
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
    refetchInterval: 30_000,
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
            <p className="truncate text-sm font-bold text-secondary-900">{p.tenant_name || `Tenant #${p.tenant_id}`}</p>
            <p className="data-mono text-[11px] text-secondary-400">Invoice #{p.invoice_id}</p>
          </div>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (p) => <span className="data-mono text-sm font-bold text-secondary-900">{money(p.amount, p.currency)}</span>,
    },
    {
      key: "bank",
      header: "Payer",
      render: (p) => (
        <div className="text-xs">
          <p className="font-bold text-secondary-700">{p.payer_bank_name || "—"}</p>
          <p className="text-secondary-400">{p.payer_account_name || ""} {p.payer_reference ? `· ${p.payer_reference}` : ""}</p>
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
      key: "submitted",
      header: "Submitted",
      render: (p) => <span className="text-xs text-secondary-500">{safeDate(p.paid_at)}</span>,
    },
    {
      key: "proof",
      header: "Proof",
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
    {
      key: "actions",
      header: "",
      align: "right",
      render: (p) => (
        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setConfirmTarget(p)}
            leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
          >
            Confirm
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              setRejectReason("");
              setRejectTarget(p);
            }}
            leftIcon={<XCircle className="h-3.5 w-3.5" />}
          >
            Reject
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <PageHeader
        title="Payment Confirmations"
        description="Review and confirm manual bank payments submitted by tenants."
        actions={
          <Button
            variant="ghost"
            onClick={() => pendingQuery.refetch()}
            leftIcon={<RefreshCw className={`h-4 w-4 ${pendingQuery.isFetching ? "animate-spin" : ""}`} />}
          >
            Refresh
          </Button>
        }
      />

      <div className="grid gap-6 sm:grid-cols-3">
        <MetricCard label="Awaiting Confirmation" value={totals.count} icon={Clock} tone="amber" isLoading={pendingQuery.isLoading} />
        <MetricCard label="Total Pending Value" value={money(totals.sum)} icon={Banknote} tone="primary" isLoading={pendingQuery.isLoading} />
        <MetricCard label="With Proof Attached" value={totals.withProof} icon={FileText} tone="cyan" isLoading={pendingQuery.isLoading} />
      </div>

      <Card padding="none">
        <DataTable
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
      </Card>

      <ConfirmDialog
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
        }}
      />

      <Modal
        isOpen={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Reject payment"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setRejectTarget(null)} disabled={rejectMut.isPending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={rejectMut.isPending}
              onClick={async () => {
                if (!rejectTarget) return;
                await rejectMut.mutateAsync({ id: rejectTarget.id, reason: rejectReason });
                setRejectTarget(null);
              }}
            >
              Reject payment
            </Button>
          </div>
        }
      >
        <p className="mb-4 text-sm font-medium text-secondary-600">
          Let the tenant know why this evidence was rejected so they can re-submit.
        </p>
        <Textarea
          label="Reason"
          placeholder="e.g. The uploaded receipt doesn't match the amount due."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={3}
        />
      </Modal>
    </div>
  );
}
