import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote, CheckCircle2, Clock, CreditCard, Download, Landmark, RotateCcw, Search,
  UserRound, XCircle,
} from "lucide-react";
import { format, isValid } from "date-fns";
import {
  DxPage, DxPageHeader, DxPanel, DxBadge, DxButton, DxKpi, DxInput, DxTextarea, DxPopup,
  DxTabs, DxGrid, type DxGridColumn,
} from "@/components/dx";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import {
  fundingRequestsApi, formatCardMoney,
  type CardFundingRequest, type FundingRequestStatus,
} from "../api/membership.api";

type StatusTab = FundingRequestStatus | "";
const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "", label: "All" },
];

function safeDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return isValid(d) ? format(d, "MMM d, yyyy HH:mm") : "—";
}

function statusBadge(status: FundingRequestStatus) {
  switch (status) {
    case "APPROVED": return <DxBadge tone="success" dot>Approved</DxBadge>;
    case "REJECTED": return <DxBadge tone="danger" dot>Rejected</DxBadge>;
    default: return <DxBadge tone="warning" dot>Pending</DxBadge>;
  }
}

export function CardFundingApprovalsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusTab>("PENDING");
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
    onSuccess: () => { toast.success("Payment confirmed", "The patient's card wallet has been credited."); invalidate(); },
    onError: (err) => toast.error("Couldn't confirm", apiErrorMessage(err, "Please try again.")),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => fundingRequestsApi.reject(id, reason),
    onSuccess: () => { toast.success("Request rejected", "The patient will see this payment was declined."); invalidate(); },
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

  const columns: DxGridColumn<CardFundingRequest>[] = [
    { key: "patient", header: "Patient", render: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]">
            <UserRound className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[var(--dx-text)]">{r.patient_name || `Patient #${r.patient_id}`}</p>
            <p className="dx-mono flex items-center gap-1 text-[11px] text-[var(--dx-text-faint)]">
              <CreditCard className="h-3 w-3" />{r.card_number || `Card #${r.membership_card_id}`}
            </p>
          </div>
        </div>) },
    { key: "amount", header: "Amount", align: "right", render: (r) => <span className="dx-mono font-semibold text-[var(--dx-text)]">{formatCardMoney(r.amount)}</span> },
    { key: "payer", header: "Payer / Ref", render: (r) => (
        <div className="text-[12px]">
          <p className="font-semibold text-[var(--dx-text)]">{r.depositor_name || "—"}</p>
          <p className="text-[var(--dx-text-muted)]">{r.payment_reference || ""}</p>
        </div>) },
    { key: "method", header: "Method", render: (r) => (
        <DxBadge tone="neutral"><Landmark className="mr-1 h-3 w-3" />{(r.payment_method || "MANUAL").replace(/_/g, " ")}</DxBadge>) },
    { key: "submitted", header: "Submitted", render: (r) => <span className="text-[12px] text-[var(--dx-text-muted)]">{safeDate(r.date_created)}</span> },
    { key: "statusTag", header: "Status", render: (r) => statusBadge(r.status) },
    { key: "proof", header: "Proof", render: (r) =>
        r.evidence_file_name ? (
          <DxButton size="sm" variant="text" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={(e) => { e.stopPropagation(); viewEvidence(r.id); }}>View</DxButton>
        ) : <span className="text-[12px] text-[var(--dx-text-faint)]">None</span> },
    { key: "actions", header: "", align: "right", render: (r) =>
        r.status === "PENDING" ? (
          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <DxButton variant="primary" size="sm" onClick={() => setConfirmTarget(r)} leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}>Confirm</DxButton>
            <DxButton variant="danger" size="sm" onClick={() => { setRejectReason(""); setRejectTarget(r); }} leftIcon={<XCircle className="h-3.5 w-3.5" />}>Reject</DxButton>
          </div>
        ) : r.status === "REJECTED" && r.review_note ? (
          <span className="text-[12px] text-[var(--dx-danger,#e11d48)]">{r.review_note}</span>
        ) : null },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Patients" }, { label: "Card Funding" }]}
        title="Card Funding Approvals"
        subtitle="Review and confirm manual wallet top-ups submitted by patients from the portal."
        actions={
          <DxButton icon title="Refresh" onClick={() => requestsQuery.refetch()} isLoading={requestsQuery.isFetching}>
            <RotateCcw />
          </DxButton>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <DxKpi label="Awaiting confirmation" value={totals.pending} icon={Clock} tone="warning" isLoading={requestsQuery.isLoading} />
        <DxKpi label="Pending value" value={formatCardMoney(totals.pendingValue)} icon={Banknote} tone="accent" isLoading={requestsQuery.isLoading} />
        <DxKpi label="Records shown" value={totals.shown} icon={CreditCard} tone="info" isLoading={requestsQuery.isLoading} />
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <DxTabs<StatusTab>
          value={status}
          onChange={setStatus}
          items={STATUS_TABS.map((t) => ({ key: t.key, label: t.label }))}
        />
        <div className="w-full max-w-sm">
          <DxInput leftIcon={<Search className="h-4 w-4 text-[var(--dx-text-faint)]" />} placeholder="Search patient, card, reference…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <DxPanel flush>
        <DxGrid<CardFundingRequest>
          borderless columns={columns} data={requests} rowKey={(r) => r.id}
          isLoading={requestsQuery.isLoading}
          error={requestsQuery.error ? apiErrorMessage(requestsQuery.error, "Unable to load funding requests.") : null}
          onRetry={() => requestsQuery.refetch()}
          empty={{
            icon: CheckCircle2,
            title: status === "PENDING" ? "All caught up" : "No requests",
            description: status === "PENDING"
              ? "There are no card-funding payments awaiting confirmation right now."
              : "No card-funding requests match this view.",
          }}
        />
      </DxPanel>

      <ConfirmDialog
        isOpen={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        title="Confirm this payment?"
        tone="primary"
        confirmLabel="Confirm & credit"
        description={
          confirmTarget
            ? `Confirming ${formatCardMoney(confirmTarget.amount)} for ${confirmTarget.patient_name || "this patient"} credits card ${confirmTarget.card_number || `#${confirmTarget.membership_card_id}`} immediately. Verify the proof of payment first.`
            : undefined
        }
        onConfirm={async () => { if (!confirmTarget) return; await approveMut.mutateAsync(confirmTarget.id); }}
      />

      <DxPopup
        isOpen={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Reject payment"
        size="md"
        footer={
          <>
            <DxButton variant="text" onClick={() => setRejectTarget(null)} disabled={rejectMut.isPending}>Cancel</DxButton>
            <DxButton variant="danger" isLoading={rejectMut.isPending}
              onClick={async () => { if (!rejectTarget) return; await rejectMut.mutateAsync({ id: rejectTarget.id, reason: rejectReason }); setRejectTarget(null); }}>
              Reject payment
            </DxButton>
          </>
        }
      >
        <p className="mb-4 text-[13px] text-[var(--dx-text-muted)]">
          Let the patient know why this evidence was rejected so they can re-submit.
        </p>
        <DxTextarea label="Reason" placeholder="e.g. The uploaded receipt doesn't match the amount." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
      </DxPopup>
    </DxPage>
  );
}
