import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import {
  Banknote,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Paperclip,
  UserRound,
  XCircle,
} from "lucide-react";
import { DxPopup, DxButton, DxBadge, DxTabs, type DxBadgeTone } from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import {
  fundingRequestsApi,
  formatCardMoney,
  type CardFundingRequest,
  type FundingRequestStatus,
} from "../api/membership.api";

const STATUS_TABS: { key: FundingRequestStatus | ""; label: string }[] = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "", label: "All" },
];

function safeDateTime(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return isValid(d) ? format(d, "MMM d, yyyy • h:mm a") : "—";
}

function statusMeta(status: FundingRequestStatus): { tone: DxBadgeTone; Icon: typeof CheckCircle2 } {
  switch (status) {
    case "APPROVED":
      return { tone: "success", Icon: CheckCircle2 };
    case "REJECTED":
      return { tone: "danger", Icon: XCircle };
    default:
      return { tone: "warning", Icon: Clock };
  }
}

function RequestCard({
  req,
  onChanged,
}: {
  req: CardFundingRequest;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const meta = statusMeta(req.status);

  const approve = useMutation({
    mutationFn: () => fundingRequestsApi.approve(req.id),
    onSuccess: () => {
      toast.success("Funding approved", `${formatCardMoney(req.amount)} credited to the card.`);
      onChanged();
    },
    onError: (err) => toast.error("Couldn't approve", apiErrorMessage(err, "Please try again.")),
  });

  const reject = useMutation({
    mutationFn: () => {
      const reason = window.prompt("Reason for rejecting this request? (optional)") ?? undefined;
      return fundingRequestsApi.reject(req.id, reason);
    },
    onSuccess: () => {
      toast.success("Request rejected", "The patient will see this request was declined.");
      onChanged();
    },
    onError: (err) => toast.error("Couldn't reject", apiErrorMessage(err, "Please try again.")),
  });

  async function viewEvidence() {
    try {
      setLoadingEvidence(true);
      const url = await fundingRequestsApi.evidenceObjectUrl(req.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error("Evidence unavailable", apiErrorMessage(err, "The file could not be loaded."));
    } finally {
      setLoadingEvidence(false);
    }
  }

  const isPending = req.status === "PENDING";

  return (
    <div className="rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]">
            <UserRound className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[14px] font-semibold text-[var(--dx-text)]">{req.patient_name || `Patient #${req.patient_id}`}</p>
            <p className="dx-mono text-[11px] uppercase tracking-widest text-[var(--dx-text-muted)]">{req.card_number || `Card #${req.membership_card_id}`}</p>
          </div>
        </div>
        <DxBadge tone={meta.tone}><meta.Icon className="mr-1 inline h-3 w-3" />{req.status}</DxBadge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">Amount</p>
          <p className="font-bold text-[var(--dx-accent)]">{formatCardMoney(req.amount)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">Method</p>
          <p className="font-semibold text-[var(--dx-text)]">{req.payment_method}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">Reference</p>
          <p className="truncate font-semibold text-[var(--dx-text)]">{req.payment_reference || "—"}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">Submitted</p>
          <p className="font-semibold text-[var(--dx-text)]">{safeDateTime(req.date_created)}</p>
        </div>
      </div>

      {req.depositor_name || req.note ? (
        <div className="mt-3 space-y-1 rounded-md bg-[var(--dx-surface-sunken)] p-3 text-[12px] text-[var(--dx-text-muted)]">
          {req.depositor_name ? <p><span className="font-semibold text-[var(--dx-text)]">Depositor:</span> {req.depositor_name}</p> : null}
          {req.note ? <p><span className="font-semibold text-[var(--dx-text)]">Note:</span> {req.note}</p> : null}
        </div>
      ) : null}

      {req.status === "REJECTED" && req.review_note ? (
        <p className="mt-2 text-[12px] font-medium text-[var(--dx-danger)]">Reason: {req.review_note}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <DxButton size="sm" onClick={viewEvidence} isLoading={loadingEvidence} leftIcon={<Paperclip className="h-4 w-4" />}>View evidence</DxButton>
        {isPending ? (
          <div className="flex gap-2">
            <DxButton variant="outline-danger" size="sm" onClick={() => reject.mutate()} isLoading={reject.isPending} leftIcon={<XCircle className="h-4 w-4" />}>Reject</DxButton>
            <DxButton variant="primary" size="sm" onClick={() => approve.mutate()} isLoading={approve.isPending} leftIcon={<CheckCircle2 className="h-4 w-4" />}>Approve &amp; credit</DxButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function FundingRequestsModal({
  isOpen,
  onClose,
  onChanged,
}: {
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<FundingRequestStatus | "">("PENDING");

  const query = useQuery({
    queryKey: ["funding-requests", status],
    queryFn: () => fundingRequestsApi.list(status),
    enabled: isOpen,
  });

  const requests = query.data ?? [];

  const refresh = () => {
    query.refetch();
    queryClient.invalidateQueries({ queryKey: ["membership-cards"] });
    onChanged();
  };

  return (
    <DxPopup isOpen={isOpen} onClose={onClose} title="Manual funding requests" size="xl">
      <div className="space-y-5">
        <DxTabs items={STATUS_TABS} value={status} onChange={setStatus} />

        {query.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[var(--dx-text-muted)]">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading requests…
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-md border border-dashed border-[var(--dx-border-strong)] py-16 text-center">
            <Banknote className="mx-auto mb-3 h-10 w-10 text-[var(--dx-text-faint)]" />
            <p className="text-[13px] font-semibold text-[var(--dx-text)]">No {status ? status.toLowerCase() : ""} requests</p>
            <p className="mt-1 text-[12px] text-[var(--dx-text-muted)]">Patient-submitted manual card top-ups will appear here for review.</p>
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {requests.map((req) => (
              <RequestCard key={req.id} req={req} onChanged={refresh} />
            ))}
          </div>
        )}

        <p className="flex items-center gap-2 text-[11px] text-[var(--dx-text-muted)]">
          <FileText className="h-3.5 w-3.5" />
          Approving a request instantly credits the patient's wallet and records a transaction.
        </p>
      </div>
    </DxPopup>
  );
}
