import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Banknote, CheckCircle2, CreditCard, Download, FileText, Receipt, Wallet } from "lucide-react";
import { apiClient } from "@/lib/api/api-client";
import { apiErrorMessage } from "@/lib/api/api-error";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/feedback/ToastProvider";
import { membershipApi, formatCardMoney } from "@/features/patients/api/membership.api";
import { formatMoney, toNumber } from "../api/billing.api";
import {
  useFinalizeVisitBilling,
  useRecordVisitPayment,
  useVisitBillingSummary,
} from "../hooks/use-billing";

const METHOD_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "MOBILE_MONEY", label: "Mobile money" },
  { value: "POS", label: "POS terminal" },
  { value: "MEMBERSHIP_CARD", label: "Membership card" },
];

/**
 * Per-visit billing: itemised charges accrued as services are rendered, partial
 * payments taken during the visit, and the outstanding balance. Finalizing
 * issues the single invoice for the visit carrying all payments forward.
 */
export function VisitBillingPanel({ visitId }: { visitId: number }) {
  const toast = useToast();
  const summaryQuery = useVisitBillingSummary(visitId);
  const recordPayment = useRecordVisitPayment(visitId);
  const finalize = useFinalizeVisitBilling(visitId);

  const summary = summaryQuery.data;
  const outstanding = toNumber(summary?.outstanding);
  const total = toNumber(summary?.total_charges);
  const paid = toNumber(summary?.amount_paid);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [cardId, setCardId] = useState<string>("");

  const canPay = outstanding > 0 && summary?.status !== "INVOICED" && summary?.status !== "SETTLED";
  const alreadyInvoiced = !!summary?.invoice;
  const isCardMethod = method === "MEMBERSHIP_CARD";
  const patientId = summary?.patient_id ?? undefined;

  const cardsQuery = useQuery({
    queryKey: ["membership-cards", "patient", patientId],
    queryFn: () => membershipApi.forPatient(patientId as number),
    enabled: isCardMethod && typeof patientId === "number" && Number.isFinite(patientId),
  });

  const cards = cardsQuery.data ?? [];
  const selectedCard = useMemo(
    () => cards.find((c) => String(c.id) === cardId),
    [cards, cardId],
  );
  const selectedCardBalance = selectedCard ? toNumber(selectedCard.balance) : 0;

  const items = useMemo(() => summary?.items ?? [], [summary?.items]);
  const payments = useMemo(() => summary?.payments ?? [], [summary?.payments]);

  const handlePay = () => {
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.warning("Enter an amount", "Type the amount the patient is paying.");
      return;
    }
    if (value > outstanding) {
      toast.warning("Too much", `The outstanding balance is only ${formatMoney(outstanding)}.`);
      return;
    }
    if (isCardMethod) {
      if (!selectedCard) {
        toast.warning("Select a card", "Choose the membership card to debit.");
        return;
      }
      if (selectedCard.status !== "ACTIVE") {
        toast.warning("Card unavailable", `This card is ${selectedCard.status.toLowerCase()}.`);
        return;
      }
      if (value > selectedCardBalance) {
        toast.warning(
          "Insufficient balance",
          `Card balance is only ${formatCardMoney(selectedCardBalance)}.`,
        );
        return;
      }
    }
    recordPayment.mutate(
      {
        amount: value,
        payment_method: method,
        payment_reference: reference.trim() || undefined,
        membership_card_id: isCardMethod && selectedCard ? selectedCard.id : undefined,
      },
      {
        onSuccess: (res) => {
          const balAfter = res?.payments?.find(
            (p) => p.transaction_metadata && "card_balance_after" in p.transaction_metadata,
          );
          const remaining = balAfter?.transaction_metadata?.["card_balance_after"];
          toast.success(
            "Payment recorded",
            isCardMethod && remaining != null
              ? `${formatMoney(value)} debited. Card balance: ${formatCardMoney(String(remaining))}.`
              : `${formatMoney(value)} received.`,
          );
          setAmount("");
          setReference("");
        },
        onError: (err: any) =>
          toast.error("Payment failed", err?.response?.data?.message || "Please try again."),
      },
    );
  };

  const handleFinalize = () => {
    finalize.mutate(undefined, {
      onSuccess: (res) =>
        toast.success("Invoice issued", `${res.invoice_no} — balance ${formatMoney(res.balance_due)}.`),
      onError: (err: any) =>
        toast.error("Could not finalize", err?.response?.data?.message || "Please try again."),
    });
  };

  return (
    <Card>
      <CardHeader
        title="Visit Billing"
        description="Charges accrued this visit, payments made, and the balance outstanding."
        actions={
          summary?.status ? (
            <Badge variant={alreadyInvoiced ? "soft-success" : "soft-info"}>
              {alreadyInvoiced ? "Invoiced" : summary.status}
            </Badge>
          ) : null
        }
      />

      {summaryQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !summary || !summary.billing_id ? (
        <EmptyState
          icon={Receipt}
          title="No charges yet"
          description="Charges appear here automatically as services (consultation, lab, pharmacy, procedures) are rendered."
        />
      ) : (
        <div className="space-y-6">
          {/* Branded consolidated invoice PDF */}
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Download className="h-3.5 w-3.5" />}
              onClick={async () => {
                try {
                  const res = await apiClient.get(`/billing/visits/${visitId}/invoice.pdf`, {
                    responseType: "blob",
                  });
                  const url = URL.createObjectURL(res.data as Blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `invoice-${summary.billing_no ?? visitId}.pdf`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
                } catch (err) {
                  toast.error("Couldn't download invoice", apiErrorMessage(err));
                }
              }}
            >
              Invoice PDF
            </Button>
          </div>

          {/* Totals */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-secondary-500/5 p-4 dark:bg-white/5">
              <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">Total charges</p>
              <p className="data-mono mt-1 text-lg font-bold text-secondary-900">{formatMoney(total)}</p>
            </div>
            <div className="rounded-2xl bg-emerald-500/10 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Paid</p>
              <p className="data-mono mt-1 text-lg font-bold text-emerald-600">{formatMoney(paid)}</p>
            </div>
            <div className="rounded-2xl bg-amber-500/10 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Outstanding</p>
              <p className="data-mono mt-1 text-lg font-bold text-amber-600">{formatMoney(outstanding)}</p>
            </div>
          </div>

          {/* Unmapped-charges reconciliation warning */}
          {summary.unmapped_count && summary.unmapped_count > 0 ? (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-xs font-bold leading-relaxed">
                {summary.unmapped_count} charge{summary.unmapped_count > 1 ? "s" : ""}
                {" "}({formatMoney(toNumber(summary.unaccounted_amount))}) not yet mapped to a ledger account.
                Assign a GL account to the matching billable service so these post to finance.
              </p>
            </div>
          ) : null}

          {/* Charges */}
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-secondary-400">Charges</p>
            <ul className="divide-y divide-secondary-100 dark:divide-white/5">
              {items.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-secondary-900">{it.service_name}</p>
                    <p className="text-xs text-secondary-400">
                      {toNumber(it.quantity)} × {formatMoney(toNumber(it.unit_price))}
                      {it.service_code ? ` • ${it.service_code}` : ""}
                    </p>
                    {it.account_code ? (
                      <p className="mt-0.5 text-[11px] font-semibold text-secondary-400">
                        Ledger: <span className="data-mono">{it.account_code}</span>
                        {it.account_name ? ` — ${it.account_name}` : ""}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[11px] font-bold text-amber-600">Unmapped — no ledger account</p>
                    )}
                  </div>
                  <span className="data-mono text-sm font-bold text-secondary-900">
                    {formatMoney(toNumber(it.line_total))}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Payments made */}
          {payments.length ? (
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-secondary-400">Payments</p>
              <ul className="divide-y divide-secondary-100 dark:divide-white/5">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-4 py-2">
                    <div className="min-w-0">
                      <span className="flex items-center gap-2 text-sm text-secondary-600">
                        <Wallet className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                        {p.payment_method || "Payment"}
                        <span className="data-mono text-xs text-secondary-400">{p.payment_reference}</span>
                      </span>
                      {p.account_code ? (
                        <p className="mt-0.5 pl-5 text-[11px] font-semibold text-secondary-400">
                          Ledger: <span className="data-mono">{p.account_code}</span>
                          {p.account_name ? ` — ${p.account_name}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <span className="data-mono text-sm font-bold text-emerald-600">
                      {formatMoney(toNumber(p.amount))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Record a partial payment */}
          {canPay ? (
            <div className="rounded-2xl border border-secondary-200 p-4 dark:border-white/10">
              <p className="mb-3 text-xs font-black uppercase tracking-widest text-secondary-400">
                Record payment
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  label="Amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={String(outstanding)}
                />
                <Select
                  label="Method"
                  options={METHOD_OPTIONS}
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                />
                <Input
                  label="Reference (optional)"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Txn / receipt no."
                  disabled={isCardMethod}
                />
              </div>

              {isCardMethod ? (
                <div className="mt-3 space-y-2">
                  {cardsQuery.isLoading ? (
                    <Skeleton className="h-12 w-full" />
                  ) : cards.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-600">
                      <CreditCard className="h-4 w-4" /> This patient has no membership card. Issue or
                      fund one first.
                    </div>
                  ) : (
                    <>
                      <Select
                        label="Membership card"
                        value={cardId}
                        onChange={(e) => setCardId(e.target.value)}
                        options={[
                          { value: "", label: "Select a card…" },
                          ...cards.map((c) => ({
                            value: String(c.id),
                            label: `${c.card_number} — ${formatCardMoney(c.balance)}${
                              c.status !== "ACTIVE" ? ` (${c.status})` : ""
                            }`,
                          })),
                        ]}
                      />
                      {selectedCard ? (
                        <p
                          className={`text-xs font-semibold ${
                            selectedCardBalance < Number(amount || 0)
                              ? "text-rose-500"
                              : "text-secondary-500"
                          }`}
                        >
                          Available balance: {formatCardMoney(selectedCardBalance)}
                          {selectedCardBalance < Number(amount || 0)
                            ? " — not enough to cover this amount."
                            : ""}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setAmount(String(outstanding))}
                >
                  Full balance
                </Button>
                <Button
                  size="sm"
                  onClick={handlePay}
                  isLoading={recordPayment.isPending}
                  disabled={isCardMethod && (!selectedCard || cards.length === 0)}
                  leftIcon={
                    isCardMethod ? (
                      <CreditCard className="h-4 w-4" />
                    ) : (
                      <Banknote className="h-4 w-4" />
                    )
                  }
                >
                  {isCardMethod ? "Debit card" : "Record payment"}
                </Button>
              </div>
            </div>
          ) : outstanding <= 0 && total > 0 ? (
            <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> Fully paid
            </div>
          ) : null}

          {/* Finalize / invoice */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-secondary-100 pt-4 dark:border-white/5">
            {summary.invoice ? (
              <p className="text-xs font-semibold text-secondary-500">
                Invoice <span className="data-mono">{summary.invoice.invoice_no}</span> issued • balance{" "}
                {formatMoney(toNumber(summary.invoice.balance_due))}
              </p>
            ) : (
              <p className="text-xs text-secondary-400">
                Finalize at the end of the visit to issue the invoice for all services.
              </p>
            )}
            {!alreadyInvoiced ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleFinalize}
                isLoading={finalize.isPending}
                disabled={total <= 0}
                leftIcon={<FileText className="h-4 w-4" />}
              >
                Finalize &amp; issue invoice
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </Card>
  );
}
