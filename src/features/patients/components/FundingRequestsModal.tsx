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
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
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

function safeDateTime(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return isValid(d) ? format(d, "MMM d, yyyy • h:mm a") : "—";
}

function statusBadge(status: FundingRequestStatus) {
  switch (status) {
    case "APPROVED":
      return { className: "bg-emerald-50 text-emerald-600 border-emerald-100", Icon: CheckCircle2 };
    case "REJECTED":
      return { className: "bg-rose-50 text-rose-600 border-rose-100", Icon: XCircle };
    default:
      return { className: "bg-amber-50 text-amber-600 border-amber-100", Icon: Clock };
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
  const badge = statusBadge(req.status);

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
    <div className="rounded-2xl border border-secondary-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary-900 text-white">
            <UserRound className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-secondary-900">
              {req.patient_name || `Patient #${req.patient_id}`}
            </p>
            <p className="data-mono text-[11px] uppercase tracking-widest text-secondary-400">
              {req.card_number || `Card #${req.membership_card_id}`}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${badge.className}`}
        >
          <badge.Icon className="h-3 w-3" /> {req.status}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">Amount</p>
          <p className="font-black text-primary-600">{formatCardMoney(req.amount)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">Method</p>
          <p className="font-semibold text-secondary-800">{req.payment_method}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">Reference</p>
          <p className="truncate font-semibold text-secondary-800">{req.payment_reference || "—"}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">Submitted</p>
          <p className="font-semibold text-secondary-800">{safeDateTime(req.date_created)}</p>
        </div>
      </div>

      {req.depositor_name || req.note ? (
        <div className="mt-3 space-y-1 rounded-xl bg-secondary-50 p-3 text-xs text-secondary-600 dark:bg-white/5">
          {req.depositor_name ? (
            <p>
              <span className="font-bold">Depositor:</span> {req.depositor_name}
            </p>
          ) : null}
          {req.note ? (
            <p>
              <span className="font-bold">Note:</span> {req.note}
            </p>
          ) : null}
        </div>
      ) : null}

      {req.status === "REJECTED" && req.review_note ? (
        <p className="mt-2 text-xs font-medium text-rose-500">Reason: {req.review_note}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={viewEvidence}
          isLoading={loadingEvidence}
          leftIcon={<Paperclip className="h-4 w-4" />}
        >
          View evidence
        </Button>
        {isPending ? (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => reject.mutate()}
              isLoading={reject.isPending}
              leftIcon={<XCircle className="h-4 w-4" />}
            >
              Reject
            </Button>
            <Button
              size="sm"
              onClick={() => approve.mutate()}
              isLoading={approve.isPending}
              leftIcon={<CheckCircle2 className="h-4 w-4" />}
            >
              Approve & credit
            </Button>
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
    <Modal isOpen={isOpen} onClose={onClose} title="Manual funding requests" size="xl">
      <div className="space-y-5">
        <div className="flex items-center gap-2 rounded-2xl bg-secondary-100 p-1 dark:bg-white/5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value || "all"}
              onClick={() => setStatus(tab.value)}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-widest transition-all ${
                status === tab.value
                  ? "bg-white text-primary-600 shadow-sm dark:bg-secondary-800"
                  : "text-secondary-500 hover:text-secondary-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {query.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-secondary-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading requests…
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-secondary-300 py-16 text-center">
            <Banknote className="mx-auto mb-3 h-10 w-10 text-secondary-300" />
            <p className="text-sm font-bold text-secondary-700">No {status ? status.toLowerCase() : ""} requests</p>
            <p className="mt-1 text-xs text-secondary-400">
              Patient-submitted manual card top-ups will appear here for review.
            </p>
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {requests.map((req) => (
              <RequestCard key={req.id} req={req} onChanged={refresh} />
            ))}
          </div>
        )}

        <p className="flex items-center gap-2 text-[11px] text-secondary-400">
          <FileText className="h-3.5 w-3.5" />
          Approving a request instantly credits the patient's wallet and records a transaction.
        </p>
      </div>
    </Modal>
  );
}
