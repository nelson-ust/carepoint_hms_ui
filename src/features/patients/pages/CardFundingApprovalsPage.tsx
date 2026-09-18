import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Landmark,
  RefreshCw,
  Search,
  UserRound,
  XCircle,
} from "lucide-react";
import { format, isValid } from "date-fns";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { MetricCard } from "@/components/charts/MetricCard";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import {
  fundingRequestsApi,
  formatCardMoney,
  type CardFundingRequest,
  type FundingRequestStatus,
} from "../api/membership.api";

const STATUS_TABS: { value: FundingRequestStatus | ""; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "", label: "All" },
];

function safeDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return isValid(d) ? format(d, "MMM d, yyyy HH:mm") : "—";
}

function statusBadge(status: FundingRequestStatus) {
  switch (status) {
    case "APPROVED":
      return <Badge variant="soft-success">Approved</Badge>;
    case "REJECTED":
      return <Badge variant="soft-danger">Rejected</Badge>;
    default:
      return <Badge variant="soft-warning">Pending</Badge>;
  }
}

export function CardFundingApprovalsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<FundingRequestStatus | "">("PENDING");
  const [search, setSearch] = useState("");
  const [rejectTarget, setRejectTarget] = useState<CardFundingRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<CardFundingRequest | null>(null);

  const requestsQuery = useQuery({
    queryKey: ["card-funding-approvals", status],
    queryFn: () => fundingRequestsApi.list(status),
    refetchInterval: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["card-funding-approvals"] });
    queryClient.invalidateQueries({ queryKey: ["membership-cards"] });
    queryClient.invalidateQueries({ queryKey: ["funding-requests"] });
  };

  const approveMut = useMutation({
    mutationFn: (id: number) => fundingRequestsApi.approve(id),
    onSuccess: () => {
      toast.success("Payment confirmed", "The patient's card wallet has been credited.");
      invalidate();
    },
    onError: (err) => toast.error("Couldn't confirm", apiErrorMessage(err, "Please try again.")),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      fundingRequestsApi.reject(id, reason),
    onSuccess: () => {
      toast.success("Request rejected", "The patient will see this payment was declined.");
      invalidate();
    },
    onError: (err) => toast.error("Couldn't reject", apiErrorMessage(err, "Please try again.")),
  });

  const viewEvidence = async (id: number) => {
    try {
      const url = await fundingRequestsApi.evidenceObjectUrl(id);
      window.open(url, "_blank", "noopener");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.error("Evidence unavailable", apiErrorMessage(err, "The file could not be loaded."));
    }
  };

  const all = requestsQuery.data ?? [];
  const requests = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (r) =>
        (r.patient_name || "").toLowerCase().includes(q) ||
        (r.card_number || "").toLowerCase().includes(q) ||
        (r.payment_reference || "").toLowerCase().includes(q) ||
        (r.depositor_name || "").toLowerCase().includes(q),
    );
  }, [all, search]);

  const totals = useMemo(() => {
    const pending = all.filter((r) => r.status === "PENDING");
    const pendingValue = pending.reduce((acc, r) => acc + Number(r.amount || 0), 0);
    return { pending: pending.length, pendingValue, shown: requests.length };
  }, [all, requests]);

  const columns: DataTableColumn<CardFundingRequest>[] = [
    {
      key: "patient",
      header: "Patient",
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10 text-primary-500">
            <UserRound className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-secondary-900">
              {r.patient_name || `Patient #${r.patient_id}`}
            </p>
            <p className="data-mono flex items-center gap-1 text-[11px] text-secondary-400">
              <CreditCard className="h-3 w-3" />
              {r.card_number || `Card #${r.membership_card_id}`}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (r) => (
        <span className="data-mono text-sm font-bold text-secondary-900">
          {formatCardMoney(r.amount)}
        </span>
      ),
    },
    {
      key: "payer",
      header: "Payer / Ref",
      render: (r) => (
        <div className="text-xs">
          <p className="font-bold text-secondary-700">{r.depositor_name || "—"}</p>
          <p className="text-secondary-400">{r.payment_reference || ""}</p>
        </div>
      ),
    },
    {
      key: "method",
      header: "Method",
      render: (r) => (
        <Badge variant="secondary">
          <Landmark className="mr-1 h-3 w-3" />
          {(r.payment_method || "MANUAL").replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "submitted",
      header: "Submitted",
      render: (r) => <span className="text-xs text-secondary-500">{safeDate(r.date_created)}</span>,
    },
    {
      key: "statusTag",
      header: "Status",
      render: (r) => statusBadge(r.status),
    },
    {
      key: "proof",
      header: "Proof",
      render: (r) =>
        r.evidence_file_name ? (
          <button
            type="button"
            className="btn-ghost inline-flex px-2.5 py-1.5 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              viewEvidence(r.id);
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
      render: (r) =>
        r.status === "PENDING" ? (
          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setConfirmTarget(r)}
              leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
            >
              Confirm
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setRejectReason("");
                setRejectTarget(r);
              }}
              leftIcon={<XCircle className="h-3.5 w-3.5" />}
            >
              Reject
            </Button>
          </div>
        ) : r.status === "REJECTED" && r.review_note ? (
          <span className="text-xs text-rose-500">{r.review_note}</span>
        ) : null,
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <PageHeader
        title="Card Funding Approvals"
        description="Review and confirm manual wallet top-ups submitted by patients from the portal."
        actions={
          <Button
            variant="ghost"
            onClick={() => requestsQuery.refetch()}
            leftIcon={<RefreshCw className={`h-4 w-4 ${requestsQuery.isFetching ? "animate-spin" : ""}`} />}
          >
            Refresh
          </Button>
        }
      />

      <div className="grid gap-6 sm:grid-cols-3">
        <MetricCard
          label="Awaiting Confirmation"
          value={totals.pending}
          icon={Clock}
          tone="amber"
          isLoading={requestsQuery.isLoading}
        />
        <MetricCard
          label="Pending Value"
          value={formatCardMoney(totals.pendingValue)}
          icon={Banknote}
          tone="primary"
          isLoading={requestsQuery.isLoading}
        />
        <MetricCard
          label="Records Shown"
          value={totals.shown}
          icon={CreditCard}
          tone="cyan"
          isLoading={requestsQuery.isLoading}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 rounded-2xl bg-secondary-100 p-1 dark:bg-white/5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value || "all"}
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
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient, card, reference…"
            className="w-full rounded-2xl border border-secondary-300 bg-white/70 py-3 pl-12 pr-4 text-sm outline-none focus:border-primary-500"
          />
        </div>
      </div>

      <Card padding="none">
        <DataTable
          columns={columns}
          data={requests}
          rowKey={(r) => r.id}
          isLoading={requestsQuery.isLoading}
          error={requestsQuery.error ? apiErrorMessage(requestsQuery.error, "Unable to load funding requests.") : null}
          onRetry={() => requestsQuery.refetch()}
          empty={{
            icon: CheckCircle2,
            title: status === "PENDING" ? "All caught up" : "No requests",
            description:
              status === "PENDING"
                ? "There are no card-funding payments awaiting confirmation right now."
                : "No card-funding requests match this view.",
          }}
        />
      </Card>

      {/* Confirm */}
      <ConfirmDialog
        isOpen={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        title="Confirm this payment?"
        tone="primary"
        confirmLabel="Confirm & credit"
        description={
          confirmTarget
            ? `Confirming ${formatCardMoney(confirmTarget.amount)} for ${
                confirmTarget.patient_name || "this patient"
              } credits card ${confirmTarget.card_number || `#${confirmTarget.membership_card_id}`} immediately. Verify the proof of payment first.`
            : undefined
        }
        onConfirm={async () => {
          if (!confirmTarget) return;
          await approveMut.mutateAsync(confirmTarget.id);
        }}
      />

      {/* Reject */}
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
          Let the patient know why this evidence was rejected so they can re-submit.
        </p>
        <Textarea
          label="Reason"
          placeholder="e.g. The uploaded receipt doesn't match the amount."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={3}
        />
      </Modal>
    </div>
  );
}
