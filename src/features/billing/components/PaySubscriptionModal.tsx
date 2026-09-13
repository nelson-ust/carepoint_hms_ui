import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CreditCard, ExternalLink, FileUp, Landmark, UploadCloud } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  subscriptionPlanApi,
  formatPlanPrice,
  planAmount,
  type BillingInterval,
  type PlanCatalogEntry,
} from "../api/subscription-plan.api";

type Method = "online" | "manual";

export function PaySubscriptionModal({
  isOpen,
  onClose,
  plan,
  interval = "MONTHLY",
}: {
  isOpen: boolean;
  onClose: () => void;
  /** The plan being paid for (drives the amount + optional plan switch). */
  plan: PlanCatalogEntry | null;
  /** Billing cycle being paid for (monthly or annual). */
  interval?: BillingInterval;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<Method>("online");
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("");

  const [bank, setBank] = useState("");
  const [accountName, setAccountName] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const paymentConfig = useQuery({
    queryKey: ["subscription", "payment-config"],
    queryFn: subscriptionPlanApi.getPaymentConfig,
    staleTime: 5 * 60 * 1000,
  });
  const gatewayLabel =
    paymentConfig.data?.gateway === "paystack" ? "Paystack" : "Flutterwave";
  const onlineConfigured = paymentConfig.data ? paymentConfig.data.configured : true;

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["subscription"] });
    queryClient.invalidateQueries({ queryKey: ["tenant-modules", "me"] });
  };

  const onlineCheckout = useMutation({
    mutationFn: () => subscriptionPlanApi.startCheckout(plan?.code, interval),
    onSuccess: (res) => {
      if (res.payment_link) {
        // Hand off to the platform gateway's hosted checkout (Flutterwave/Paystack).
        window.location.assign(res.payment_link);
      } else {
        toast.error("Checkout unavailable", res.message || "No payment link was returned.");
      }
    },
    onError: (err: any) => {
      toast.error(
        "Could not start online payment",
        err?.response?.data?.message || "Please try manual bank payment instead.",
      );
    },
  });

  const manualSubmit = useMutation({
    mutationFn: (form: FormData) => subscriptionPlanApi.submitManualPayment(form),
    onSuccess: (res) => {
      toast.success("Evidence submitted", res.message);
      refreshAll();
      onClose();
    },
    onError: (err: any) => {
      toast.error("Submission failed", err?.response?.data?.message || "Please check the details and try again.");
    },
  });

  const handleManual = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.warning("Proof required", "Attach a receipt or transfer screenshot before submitting.");
      return;
    }
    if (!plan) return;
    const form = new FormData();
    form.append("amount", String(planAmount(plan, interval)));
    form.append("payment_method", "BANK_TRANSFER");
    form.append("plan_code", plan.code);
    form.append("billing_interval", interval);
    if (bank) form.append("payer_bank_name", bank);
    if (accountName) form.append("payer_account_name", accountName);
    if (reference) form.append("payer_reference", reference);
    if (note) form.append("notes", note);
    form.append("proof", file);
    manualSubmit.mutate(form);
  };

  const amountLabel = plan ? formatPlanPrice(plan, interval) : "—";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={plan ? `Pay for ${plan.name}` : "Pay for subscription"}
      size="lg"
    >
      <div className="mb-6 flex items-center justify-between rounded-2xl bg-primary-500/10 px-5 py-4">
        <div>
          <span className="text-sm font-bold text-secondary-700 dark:text-secondary-200">Amount due</span>
          <p className="text-[11px] font-bold uppercase tracking-widest text-secondary-400">
            Billed {interval === "YEARLY" ? "annually" : "monthly"}
          </p>
        </div>
        <span className="font-display text-xl font-bold text-gradient">{amountLabel}</span>
      </div>

      {/* Method switch */}
      <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-secondary-100 p-1 dark:bg-white/5">
        <button
          onClick={() => setMethod("online")}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${
            method === "online"
              ? "bg-white text-primary-600 shadow-sm dark:bg-secondary-900 dark:text-primary-300"
              : "text-secondary-500"
          }`}
        >
          <CreditCard className="h-4 w-4" /> Pay online
        </button>
        <button
          onClick={() => setMethod("manual")}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${
            method === "manual"
              ? "bg-white text-primary-600 shadow-sm dark:bg-secondary-900 dark:text-primary-300"
              : "text-secondary-500"
          }`}
        >
          <Landmark className="h-4 w-4" /> Bank transfer
        </button>
      </div>

      {method === "online" ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl border border-secondary-200 p-4 dark:border-white/10">
            <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-primary-500" />
            <div>
              <p className="text-sm font-bold text-secondary-900">
                Card, bank transfer or USSD via {gatewayLabel}
              </p>
              <p className="mt-1 text-xs font-medium text-secondary-500">
                You'll be taken to {gatewayLabel}'s secure checkout to complete payment, then
                returned here. Your subscription activates automatically on success.
              </p>
            </div>
          </div>
          {!onlineConfigured ? (
            <p className="text-xs font-semibold text-amber-600">
              Online payments aren't configured yet. Please use bank transfer below.
            </p>
          ) : null}
          <Button
            className="w-full"
            onClick={() => onlineCheckout.mutate()}
            isLoading={onlineCheckout.isPending}
            disabled={!onlineConfigured}
            leftIcon={<ExternalLink className="h-4 w-4" />}
          >
            Continue to secure checkout
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-4">
            <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-cyan-500" />
            <p className="text-xs font-medium leading-relaxed text-secondary-600">
              Paid at a bank counter or by online transfer? Enter the details and upload your receipt or
              transfer screenshot. A platform administrator will confirm it, then your subscription activates.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Bank name" placeholder="e.g. First Bank" value={bank} onChange={(e) => setBank(e.target.value)} />
            <Input label="Account name" placeholder="Payer account name" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
          </div>
          <Input label="Transaction reference" placeholder="Bank/transfer reference" value={reference} onChange={(e) => setReference(e.target.value)} />
          <Textarea label="Note (optional)" placeholder="Anything the reviewer should know" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-secondary-500">
              Proof of payment
            </label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-secondary-300 bg-secondary-50 px-5 py-6 text-left transition-colors hover:border-primary-400 dark:border-white/15 dark:bg-white/5"
            >
              <UploadCloud className="h-6 w-6 text-primary-500" />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-secondary-900">
                  {fileName || "Click to upload receipt / screenshot"}
                </span>
                <span className="block text-xs text-secondary-400">PNG, JPG or PDF up to 20MB</span>
              </span>
              {fileName ? <FileUp className="ml-auto h-4 w-4 text-emerald-500" /> : null}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,application/pdf"
              className="hidden"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose} disabled={manualSubmit.isPending}>
              Cancel
            </Button>
            <Button onClick={handleManual} isLoading={manualSubmit.isPending} leftIcon={<UploadCloud className="h-4 w-4" />}>
              Submit for confirmation
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
