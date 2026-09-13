import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { subscriptionPlanApi } from "../api/subscription-plan.api";

type Phase = "verifying" | "success" | "failed";

/**
 * Flutterwave redirects the browser back here after checkout with
 * ``?status=&tx_ref=&transaction_id=`` (plus our ``tenant`` / ``invoice_id``).
 * We verify server-side and show the outcome.
 */
export function BillingCallbackPage() {
  const [params] = useSearchParams();
  const [phase, setPhase] = useState<Phase>("verifying");
  const [message, setMessage] = useState("Confirming your payment…");
  const ran = useRef(false);

  const status = params.get("status");
  const txRef = params.get("tx_ref") || undefined;
  const transactionId = params.get("transaction_id") || undefined;
  // Paystack returns ?reference= (and ?trxref=); Flutterwave returns tx_ref/transaction_id.
  const reference = params.get("reference") || params.get("trxref") || undefined;
  const gateway = params.get("gateway") || undefined;
  const invoiceId = params.get("invoice_id") ? Number(params.get("invoice_id")) : undefined;

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (status && status.toLowerCase() === "cancelled") {
      setPhase("failed");
      setMessage("The payment was cancelled. You can try again any time.");
      return;
    }

    subscriptionPlanApi
      .verifyCheckout({
        tx_ref: txRef,
        transaction_id: transactionId,
        reference,
        gateway,
        invoice_id: invoiceId,
      })
      .then((res) => {
        if (res.success) {
          setPhase("success");
          setMessage(res.message || "Payment confirmed — your subscription is active.");
        } else {
          setPhase("failed");
          setMessage(res.message || "We couldn't confirm this payment.");
        }
      })
      .catch((err) => {
        setPhase("failed");
        setMessage(
          err?.response?.data?.message ||
            "We couldn't verify this payment. If you were charged, contact support with your reference.",
        );
      });
  }, [status, txRef, transactionId, reference, gateway, invoiceId]);

  return (
    <main className="ambient-bg relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-6 dark:bg-secondary-950">
      <div className="pointer-events-none absolute -top-[10%] -left-[10%] h-[45%] w-[45%] rounded-full bg-emerald-500/10 blur-[130px]" />
      <div className="glass-card relative z-10 w-full max-w-md p-10 text-center">
        {phase === "verifying" ? (
          <>
            <Loader2 className="mx-auto h-14 w-14 animate-spin text-primary-500" />
            <h1 className="mt-6 font-display text-xl font-bold text-secondary-900">Confirming payment</h1>
          </>
        ) : phase === "success" ? (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-500 shadow-glow-sm">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="mt-6 font-display text-2xl font-bold text-secondary-900">Payment successful</h1>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-500/10 text-rose-500">
              <XCircle className="h-8 w-8" />
            </div>
            <h1 className="mt-6 font-display text-2xl font-bold text-secondary-900">Payment not confirmed</h1>
          </>
        )}
        <p className="mt-3 text-sm font-medium text-secondary-500">{message}</p>
        <Link to="/settings/plan" className="btn-primary mx-auto mt-8 inline-flex text-xs">
          Back to Plan &amp; Billing
        </Link>
      </div>
    </main>
  );
}
