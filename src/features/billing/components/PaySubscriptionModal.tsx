import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CreditCard, ExternalLink, FileUp, Landmark, UploadCloud } from "lucide-react";
import {
  DxPopup,
  DxButton,
  DxInput,
  DxTextarea,
  DxSegmented,
  DxMessage,
} from "@/components/dx";
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
  const gatewayLabel = paymentConfig.data?.gateway === "paystack" ? "Paystack" : "Flutterwave";
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
    <DxPopup
      isOpen={isOpen}
      onClose={onClose}
      title={plan ? `Pay for ${plan.name}` : "Pay for subscription"}
      size="lg"
      locked={manualSubmit.isPending}
    >
      <div className="mb-6 flex items-center justify-between rounded-md border border-[var(--dx-accent)] bg-[var(--dx-accent-soft)] px-5 py-4">
        <div>
          <span className="text-[13px] font-bold text-[var(--dx-text)]">Amount due</span>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">
            Billed {interval === "YEARLY" ? "annually" : "monthly"}
          </p>
        </div>
        <span className="text-[20px] font-bold text-[var(--dx-accent)]">{amountLabel}</span>
      </div>

      {/* Method switch */}
      <div className="mb-6">
        <DxSegmented<Method>
          ariaLabel="Payment method"
          items={[
            { key: "online", label: "Pay online", icon: <CreditCard className="h-4 w-4" /> },
            { key: "manual", label: "Bank transfer", icon: <Landmark className="h-4 w-4" /> },
          ]}
          value={method}
          onChange={setMethod}
        />
      </div>

      {method === "online" ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-md border border-[var(--dx-border)] p-4">
            <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-[var(--dx-accent)]" />
            <div>
              <p className="text-[13px] font-bold text-[var(--dx-text)]">
                Card, bank transfer or USSD via {gatewayLabel}
              </p>
              <p className="mt-1 text-[12px] font-medium text-[var(--dx-text-muted)]">
                You'll be taken to {gatewayLabel}'s secure checkout to complete payment, then returned
                here. Your subscription activates automatically on success.
              </p>
            </div>
          </div>
          {!onlineConfigured ? (
            <DxMessage tone="warning">
              Online payments aren't configured yet. Please use bank transfer below.
            </DxMessage>
          ) : null}
          <DxButton
            variant="primary"
            className="w-full"
            onClick={() => onlineCheckout.mutate()}
            isLoading={onlineCheckout.isPending}
            disabled={!onlineConfigured}
            leftIcon={<ExternalLink className="h-4 w-4" />}
          >
            Continue to secure checkout
          </DxButton>
        </div>
      ) : (
        <div className="space-y-5">
          <DxMessage tone="info">
            Paid at a bank counter or by online transfer? Enter the details and upload your receipt or
            transfer screenshot. A platform administrator will confirm it, then your subscription
            activates.
          </DxMessage>
          <div className="grid gap-4 sm:grid-cols-2">
            <DxInput label="Bank name" placeholder="e.g. First Bank" value={bank} onChange={(e) => setBank(e.target.value)} />
            <DxInput label="Account name" placeholder="Payer account name" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
          </div>
          <DxInput label="Transaction reference" placeholder="Bank/transfer reference" value={reference} onChange={(e) => setReference(e.target.value)} />
          <DxTextarea label="Note (optional)" placeholder="Anything the reviewer should know" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />

          <div>
            <label className="dx-field-label mb-1.5 block">Proof of payment</label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center gap-3 rounded-md border border-dashed border-[var(--dx-border-strong)] bg-[var(--dx-surface-sunken)] px-5 py-6 text-left transition-colors hover:border-[var(--dx-accent)]"
            >
              <UploadCloud className="h-6 w-6 text-[var(--dx-accent)]" />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-[var(--dx-text)]">
                  {fileName || "Click to upload receipt / screenshot"}
                </span>
                <span className="block text-[12px] text-[var(--dx-text-muted)]">PNG, JPG or PDF up to 20MB</span>
              </span>
              {fileName ? <FileUp className="ml-auto h-4 w-4" style={{ color: "var(--dx-success)" }} /> : null}
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
            <DxButton onClick={onClose} disabled={manualSubmit.isPending}>
              Cancel
            </DxButton>
            <DxButton
              variant="primary"
              onClick={handleManual}
              isLoading={manualSubmit.isPending}
              leftIcon={<UploadCloud className="h-4 w-4" />}
            >
              Submit for confirmation
            </DxButton>
          </div>
        </div>
      )}
    </DxPopup>
  );
}
