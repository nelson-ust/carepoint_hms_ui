import { useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  Loader2,
  Upload,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/feedback/ToastProvider";
import { formatNaira, portalErrorMessage } from "../api/portal.api";
import type { ManualFundingRequest, PortalMembershipCard } from "../api/portal.api";
import {
  useFundPortalCard,
  useMyManualCardFunding,
  usePortalPaymentConfig,
  useSubmitManualCardFunding,
} from "../hooks/use-portal";

type FundMethod = "ONLINE" | "MANUAL";

interface FundCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Current card (from the dashboard) to show number + balance context. */
  card?: PortalMembershipCard | null;
}

const PAYMENT_METHODS = [
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "POS", label: "POS / Card" },
  { value: "CASH_DEPOSIT", label: "Cash deposit" },
  { value: "USSD", label: "USSD" },
  { value: "OTHER", label: "Other" },
];

const MAX_MB = 20;
const ACCEPTED = ".jpg,.jpeg,.png,.webp,.gif,.pdf";

function statusPill(status: ManualFundingRequest["status"]) {
  switch (status) {
    case "APPROVED":
      return { className: "bg-emerald-50 text-emerald-600", Icon: CheckCircle2, label: "Approved" };
    case "REJECTED":
      return { className: "bg-rose-50 text-rose-600", Icon: XCircle, label: "Rejected" };
    default:
      return { className: "bg-amber-50 text-amber-600", Icon: Clock, label: "Pending review" };
  }
}

/**
 * Fund the patient's membership card. Two options:
 *  - Online: initialize a secure gateway transaction and open the checkout.
 *  - Manual: upload proof of a bank transfer / POS payment for staff approval.
 */
export function FundCardModal({ isOpen, onClose, card }: FundCardModalProps) {
  const toast = useToast();
  const fundOnline = useFundPortalCard();
  const submitManual = useSubmitManualCardFunding();
  const myRequests = useMyManualCardFunding();
  const paymentConfig = usePortalPaymentConfig();
  // Default to enabled while the config loads so the UI never flickers closed.
  const onlineEnabled = paymentConfig.data?.online_enabled !== false;

  const [method, setMethod] = useState<FundMethod>("ONLINE");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [depositor, setDepositor] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;

  const pendingRequests = useMemo(
    () => (myRequests.data ?? []).filter((r) => r.status === "PENDING"),
    [myRequests.data],
  );

  // When the online gateway isn't configured, force the manual method so the
  // patient always has a working way to fund their card.
  useEffect(() => {
    if (isOpen && !onlineEnabled) setMethod("MANUAL");
  }, [isOpen, onlineEnabled]);

  function resetAll() {
    setMethod(onlineEnabled ? "ONLINE" : "MANUAL");
    setAmount("");
    setPaymentMethod("BANK_TRANSFER");
    setReference("");
    setDepositor("");
    setNote("");
    setFile(null);
    setFileError(null);
  }

  function handleClose() {
    resetAll();
    onClose();
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFileError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setFileError(`File is too large. Maximum size is ${MAX_MB}MB.`);
      setFile(null);
      return;
    }
    setFile(f);
  }

  function submitOnline() {
    if (!amountValid) return;
    fundOnline.mutate(
      { amount: amountNum },
      {
        onSuccess: (tx) => {
          toast.success(
            "Payment started",
            `Reference ${tx.reference}. Complete the payment in the secure window.`,
          );
          if (tx.authorization_url) {
            window.open(tx.authorization_url, "_blank", "noopener,noreferrer");
          }
          handleClose();
        },
        onError: (err) =>
          toast.error(
            "Could not start payment",
            portalErrorMessage(err, "Please try again in a moment."),
          ),
      },
    );
  }

  function submitManualPayment() {
    if (!amountValid) return;
    if (!file) {
      setFileError("Please attach your proof of payment.");
      return;
    }
    submitManual.mutate(
      {
        amount: amountNum,
        payment_method: paymentMethod,
        payment_reference: reference || null,
        depositor_name: depositor || null,
        note: note || null,
        evidence: file,
      },
      {
        onSuccess: () => {
          toast.success(
            "Request submitted",
            "We received your payment evidence. Your card will be funded once the hospital confirms it.",
          );
          setAmount("");
          setReference("");
          setDepositor("");
          setNote("");
          setFile(null);
          myRequests.refetch();
        },
        onError: (err) =>
          toast.error(
            "Could not submit request",
            portalErrorMessage(err, "Please try again in a moment."),
          ),
      },
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Fund my card" size="md">
      <div className="space-y-6">
        {card ? (
          <div className="glass-card flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500">
                <CreditCard className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="data-mono text-sm font-bold text-secondary-900">
                  {card.card_number}
                </p>
                <p className="text-xs text-secondary-400">Membership card</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">
                Balance
              </p>
              <p className="data-mono text-sm font-bold text-secondary-900">
                {formatNaira(card.balance)}
              </p>
            </div>
          </div>
        ) : null}

        {/* Method chooser */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-secondary-500">
            Choose how to pay
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onlineEnabled && setMethod("ONLINE")}
              disabled={!onlineEnabled}
              className={`flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-all ${
                !onlineEnabled
                  ? "cursor-not-allowed border-secondary-200 opacity-60"
                  : method === "ONLINE"
                  ? "border-primary-500 bg-primary-500/5 ring-1 ring-primary-500/30"
                  : "border-secondary-200 hover:border-primary-300"
              }`}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600">
                <ExternalLink className="h-4 w-4" />
              </span>
              <span className="mt-1 text-sm font-bold text-secondary-900">Pay online</span>
              <span className="text-[11px] leading-tight text-secondary-400">
                {onlineEnabled
                  ? "Instant payment via secure gateway (card, transfer, USSD)."
                  : "Currently unavailable — please use manual payment."}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMethod("MANUAL")}
              className={`flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-all ${
                method === "MANUAL"
                  ? "border-primary-500 bg-primary-500/5 ring-1 ring-primary-500/30"
                  : "border-secondary-200 hover:border-primary-300"
              }`}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600">
                <Banknote className="h-4 w-4" />
              </span>
              <span className="mt-1 text-sm font-bold text-secondary-900">Manual payment</span>
              <span className="text-[11px] leading-tight text-secondary-400">
                Upload proof of a bank transfer/POS payment for confirmation.
              </span>
            </button>
          </div>
        </div>

        {/* Amount — shared by both methods */}
        <Input
          label="Amount (NGN)"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          placeholder="e.g. 5000"
          leftIcon={<Wallet className="h-4 w-4" />}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={amount !== "" && !amountValid ? "Enter a valid amount" : undefined}
        />

        {method === "ONLINE" ? (
          <>
            <p className="text-xs text-secondary-400">
              You will be redirected to a secure payment window to complete the transaction.
              Your balance updates automatically once payment is confirmed.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={submitOnline}
                disabled={!amountValid}
                isLoading={fundOnline.isPending}
                leftIcon={<ExternalLink className="h-4 w-4" />}
              >
                Continue to payment
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Payment method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                options={PAYMENT_METHODS}
              />
              <Input
                label="Payment reference (optional)"
                placeholder="e.g. transfer/teller no."
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
            <Input
              label="Depositor name (optional)"
              placeholder="Name on the payment"
              value={depositor}
              onChange={(e) => setDepositor(e.target.value)}
            />

            {/* Evidence upload */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-secondary-500">
                Proof of payment *
              </label>
              {file ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-secondary-200 bg-white/60 p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600">
                      <FileText className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-secondary-900">
                        {file.name}
                      </p>
                      <p className="text-[11px] text-secondary-400">
                        {(file.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary-400 hover:bg-rose-50 hover:text-rose-500"
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-secondary-300 bg-white/40 px-4 py-8 text-center transition-colors hover:border-primary-400 hover:bg-primary-500/5"
                >
                  <Upload className="h-6 w-6 text-secondary-400" />
                  <span className="text-sm font-semibold text-secondary-700">
                    Tap to upload receipt
                  </span>
                  <span className="text-[11px] text-secondary-400">
                    JPG, PNG, or PDF · up to {MAX_MB}MB
                  </span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={onPickFile}
              />
              {fileError ? (
                <p className="mt-1.5 text-xs font-medium text-rose-500">{fileError}</p>
              ) : null}
            </div>

            <Input
              label="Note (optional)"
              placeholder="Anything the hospital should know"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            {/* Pending requests context */}
            {pendingRequests.length > 0 ? (
              <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-600">
                  <Clock className="h-3.5 w-3.5" /> Awaiting confirmation
                </p>
                <div className="space-y-2">
                  {pendingRequests.slice(0, 3).map((r) => {
                    const pill = statusPill(r.status);
                    return (
                      <div
                        key={r.id}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="font-semibold text-secondary-800">
                          {formatNaira(r.amount)}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${pill.className}`}
                        >
                          <pill.Icon className="h-3 w-3" /> {pill.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={submitManualPayment}
                disabled={!amountValid || !file}
                isLoading={submitManual.isPending}
                leftIcon={<Upload className="h-4 w-4" />}
              >
                Submit for confirmation
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
