import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Ban,
  CreditCard,
  History,
  Receipt,
  RotateCcw,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, CardSkeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { useDisclosure } from "@/hooks/useDisclosure";
import { routes } from "@/config/routes";
import { membershipApi, formatCardMoney } from "@/features/patients/api/membership.api";
import {
  formatMoney,
  type Invoice,
  type InvoiceItem,
  type InvoicePayment,
} from "../api/billing.api";
import {
  useInvoice,
  useInvoicePayments,
  useReceivePayment,
  useVoidInvoice,
} from "../hooks/use-billing";
import { InvoiceStatusBadge } from "../components/InvoiceStatusBadge";

const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "POS", label: "POS Terminal" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "MOBILE_MONEY", label: "Mobile Money" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "LOYALTY", label: "Loyalty" },
  { value: "WAIVER", label: "Waiver" },
  { value: "MEMBERSHIP_CARD", label: "Membership Card" },
  { value: "OTHER", label: "Other" },
];

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const PAYMENT_STATUS_VARIANT: Record<string, "soft-success" | "soft-warning" | "soft-danger" | "secondary"> = {
  SUCCESSFUL: "soft-success",
  PENDING: "soft-warning",
  FAILED: "soft-danger",
  REVERSED: "soft-danger",
  CANCELLED: "secondary",
};

function RecordPaymentModal({
  invoice,
  isOpen,
  onClose,
}: {
  invoice: Invoice;
  isOpen: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const receivePayment = useReceivePayment();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [note, setNote] = useState("");
  const [cardId, setCardId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isCardMethod = method === "MEMBERSHIP_CARD";

  const cardsQuery = useQuery({
    queryKey: ["membership-cards", "patient", invoice.patient_id],
    queryFn: () => membershipApi.forPatient(invoice.patient_id),
    enabled: isCardMethod && typeof invoice.patient_id === "number",
  });
  const cards = cardsQuery.data ?? [];
  const selectedCard = useMemo(
    () => cards.find((c) => String(c.id) === cardId),
    [cards, cardId],
  );
  const selectedCardBalance = selectedCard ? Number(selectedCard.balance) : 0;

  const handleClose = () => {
    setAmount("");
    setMethod("CASH");
    setNote("");
    setCardId("");
    setError(null);
    onClose();
  };

  const handleSubmit = () => {
    const parsed = Number(amount);
    if (!parsed || parsed <= 0) {
      setError("Enter a payment amount greater than zero.");
      return;
    }
    if (isCardMethod) {
      if (!selectedCard) {
        setError("Select the membership card to debit.");
        return;
      }
      if (selectedCard.status !== "ACTIVE") {
        setError(`This card is ${selectedCard.status.toLowerCase()} and cannot be used.`);
        return;
      }
      if (parsed > selectedCardBalance) {
        setError(`Insufficient card balance (${formatCardMoney(selectedCardBalance)}).`);
        return;
      }
    }
    setError(null);
    receivePayment.mutate(
      {
        invoice_id: invoice.id,
        amount: parsed,
        payment_method: method,
        membership_card_id: isCardMethod && selectedCard ? selectedCard.id : undefined,
        note: note.trim() || undefined,
      },
      {
        onSuccess: (payment) => {
          toast.success("Payment recorded", `Reference ${payment.payment_reference}`);
          handleClose();
        },
        onError: (err: any) => {
          toast.error(
            "Failed to record payment",
            err?.response?.data?.detail?.toString?.() ??
              err?.response?.data?.message ??
              err?.message,
          );
        },
      },
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Record Payment — ${invoice.invoice_no}`}
      size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={receivePayment.isPending}
            leftIcon={<CreditCard className="h-4 w-4" />}
          >
            Record Payment
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="glass-card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">
            Balance Due
          </p>
          <p className="data-mono mt-1 text-2xl font-bold text-secondary-900">
            {formatMoney(invoice.balance_due)}
          </p>
        </div>
        <Input
          label="Amount"
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          error={error ?? undefined}
        />
        <Select
          label="Payment Method"
          options={PAYMENT_METHOD_OPTIONS}
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        />
        {isCardMethod ? (
          cardsQuery.isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : cards.length === 0 ? (
            <div className="rounded-xl bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-600">
              This patient has no membership card on file.
            </div>
          ) : (
            <div className="space-y-1.5">
              <Select
                label="Membership Card"
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
                </p>
              ) : null}
            </div>
          )
        ) : null}
        <Textarea
          label="Note (optional)"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. POS terminal 2, teller ref…"
        />
      </div>
    </Modal>
  );
}

export function BillingDetailPage() {
  const navigate = useNavigate();
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const numericId = invoiceId && /^\d+$/.test(invoiceId) ? Number(invoiceId) : undefined;

  const invoiceQuery = useInvoice(numericId);
  const paymentsQuery = useInvoicePayments(numericId);
  const voidInvoice = useVoidInvoice();
  const toast = useToast();

  const paymentModal = useDisclosure();
  const voidDialog = useDisclosure();

  const invoice = invoiceQuery.data;

  const itemColumns: DataTableColumn<InvoiceItem>[] = [
    {
      key: "service_name",
      header: "Description",
      render: (item) => (
        <div>
          <p className="text-sm font-bold text-secondary-900">{item.service_name}</p>
          {item.service_code ? (
            <p className="data-mono mt-0.5 text-xs text-secondary-400">{item.service_code}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "quantity",
      header: "Qty",
      align: "center",
      render: (item) => <span className="data-mono text-sm">{item.quantity}</span>,
    },
    {
      key: "unit_price",
      header: "Unit Price",
      align: "right",
      render: (item) => <span className="data-mono text-sm">{formatMoney(item.unit_price)}</span>,
    },
    {
      key: "discount_amount",
      header: "Discount",
      align: "right",
      render: (item) => (
        <span className="data-mono text-sm text-secondary-500">
          {item.discount_amount > 0 ? `-${formatMoney(item.discount_amount)}` : "—"}
        </span>
      ),
    },
    {
      key: "line_total",
      header: "Line Total",
      align: "right",
      render: (item) => (
        <span className="data-mono text-sm font-bold text-secondary-900">
          {formatMoney(item.line_total)}
        </span>
      ),
    },
  ];

  const paymentColumns: DataTableColumn<InvoicePayment>[] = [
    {
      key: "payment_reference",
      header: "Reference",
      render: (p) => (
        <span className="data-mono text-sm font-bold text-secondary-900">
          {p.payment_reference}
        </span>
      ),
    },
    {
      key: "payment_method",
      header: "Method",
      render: (p) => (
        <span className="text-sm text-secondary-600">
          {(p.payment_method ?? "—").replace(/_/g, " ")}
        </span>
      ),
    },
    {
      key: "paid_at",
      header: "Paid At",
      render: (p) => (
        <span className="text-sm text-secondary-600">{formatDateTime(p.paid_at)}</span>
      ),
    },
    {
      key: "payment_status",
      header: "Status",
      render: (p) => (
        <Badge variant={PAYMENT_STATUS_VARIANT[p.payment_status] ?? "secondary"}>
          {p.payment_status}
        </Badge>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (p) => (
        <span className="data-mono text-sm font-bold text-secondary-900">
          {formatMoney(p.amount, p.currency)}
        </span>
      ),
    },
  ];

  const canReceivePayment =
    invoice && invoice.balance_due > 0 && ["ISSUED", "PARTIALLY_PAID"].includes(invoice.status);
  const canVoid = invoice && !["VOIDED", "CANCELLED", "PAID"].includes(invoice.status);

  const handleVoid = async () => {
    if (!invoice) return;
    try {
      await voidInvoice.mutateAsync({ invoiceId: invoice.id });
      toast.success("Invoice voided", `Invoice ${invoice.invoice_no} has been voided.`);
    } catch (err: any) {
      toast.error(
        "Failed to void invoice",
        err?.response?.data?.detail?.toString?.() ?? err?.message,
      );
    }
  };

  if (numericId === undefined) {
    return (
      <div className="space-y-8 animate-fade-in">
        <EmptyState
          icon={Receipt}
          title="Invalid invoice reference"
          description="This link does not point to a valid invoice."
          action={
            <Button variant="secondary" onClick={() => navigate(routes.billing)}>
              Back to Billing
            </Button>
          }
        />
      </div>
    );
  }

  if (invoiceQuery.isLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <Skeleton className="h-10 w-72" />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (invoiceQuery.isError || !invoice) {
    return (
      <div className="space-y-8 animate-fade-in">
        <EmptyState
          icon={Receipt}
          title="Invoice not found"
          description="The invoice could not be loaded. It may have been removed, or you may not have access."
          action={
            <div className="flex gap-3">
              <Button
                variant="secondary"
                leftIcon={<RotateCcw className="h-4 w-4" />}
                onClick={() => invoiceQuery.refetch()}
              >
                Retry
              </Button>
              <Button variant="ghost" onClick={() => navigate(routes.billing)}>
                Back to Billing
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        eyebrow={
          <button
            type="button"
            onClick={() => navigate(routes.billing)}
            className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-secondary-400 transition-colors hover:text-secondary-900 dark:hover:text-secondary-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Invoices
          </button>
        }
        title={`Invoice ${invoice.invoice_no}`}
        description="Detailed breakdown of clinical charges and payment history."
        actions={
          <>
            {canVoid ? (
              <Button
                variant="danger"
                leftIcon={<Ban className="h-4 w-4" />}
                onClick={voidDialog.open}
              >
                Void
              </Button>
            ) : null}
            {canReceivePayment ? (
              <Button leftIcon={<CreditCard className="h-4 w-4" />} onClick={paymentModal.open}>
                Record Payment
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Card padding="none">
            <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-secondary-400">
                  Billed To
                </p>
                <p className="mt-1 text-lg font-bold text-secondary-900">
                  Patient #{invoice.patient_id}
                </p>
                {invoice.visit_id ? (
                  <p className="text-sm text-secondary-500">Visit #{invoice.visit_id}</p>
                ) : null}
              </div>
              <div className="text-right">
                <InvoiceStatusBadge status={invoice.status} />
                <p className="mt-3 text-xs text-secondary-400">
                  Issued {formatDate(invoice.invoice_date)}
                </p>
                <p className="text-xs text-secondary-400">Due {formatDate(invoice.due_date)}</p>
              </div>
            </div>
            <div className="mt-4">
              <DataTable
                columns={itemColumns}
                data={invoice.items}
                rowKey={(item) => item.id}
                empty={{
                  icon: Receipt,
                  title: "No line items",
                  description: "This invoice has no charge lines.",
                }}
              />
            </div>
            <div className="flex justify-end border-t border-secondary-100 px-6 py-6 dark:border-white/5">
              <dl className="w-72 space-y-3">
                <div className="flex justify-between text-sm font-medium text-secondary-500">
                  <dt>Subtotal</dt>
                  <dd className="data-mono">{formatMoney(invoice.subtotal_amount)}</dd>
                </div>
                <div className="flex justify-between text-sm font-medium text-secondary-500">
                  <dt>Discount</dt>
                  <dd className="data-mono">
                    {invoice.discount_amount > 0
                      ? `-${formatMoney(invoice.discount_amount)}`
                      : formatMoney(0)}
                  </dd>
                </div>
                <div className="flex justify-between text-sm font-medium text-secondary-500">
                  <dt>Tax</dt>
                  <dd className="data-mono">{formatMoney(invoice.tax_amount)}</dd>
                </div>
                <div className="flex justify-between border-t border-secondary-100 pt-3 text-base font-bold text-secondary-900 dark:border-white/5">
                  <dt>Total</dt>
                  <dd className="data-mono">{formatMoney(invoice.total_amount)}</dd>
                </div>
                <div className="flex justify-between text-sm font-medium text-emerald-500">
                  <dt>Paid</dt>
                  <dd className="data-mono">{formatMoney(invoice.amount_paid)}</dd>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <dt className="text-secondary-900">Balance Due</dt>
                  <dd
                    className={
                      invoice.balance_due > 0
                        ? "data-mono text-rose-500"
                        : "data-mono text-emerald-500"
                    }
                  >
                    {formatMoney(invoice.balance_due)}
                  </dd>
                </div>
              </dl>
            </div>
          </Card>

          <Card padding="none">
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary-500" />
                  Payment History
                </span>
              }
              description="All payments received against this invoice."
              className="px-6 pt-6"
            />
            <DataTable
              columns={paymentColumns}
              data={paymentsQuery.data}
              rowKey={(p) => p.id}
              isLoading={paymentsQuery.isLoading}
              error={paymentsQuery.isError ? "Failed to load payments." : null}
              onRetry={() => paymentsQuery.refetch()}
              skeletonRows={3}
              empty={{
                icon: CreditCard,
                title: "No payments yet",
                description: "Payments recorded against this invoice will appear here.",
                action: canReceivePayment ? (
                  <Button
                    size="sm"
                    leftIcon={<CreditCard className="h-3.5 w-3.5" />}
                    onClick={paymentModal.open}
                  >
                    Record Payment
                  </Button>
                ) : undefined,
              }}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Summary" />
            <dl className="space-y-4">
              <div>
                <dt className="text-[10px] font-black uppercase tracking-widest text-secondary-400">
                  Invoice No.
                </dt>
                <dd className="data-mono mt-1 text-sm font-bold text-secondary-900">
                  {invoice.invoice_no}
                </dd>
              </div>
              {invoice.billing_id ? (
                <div>
                  <dt className="text-[10px] font-black uppercase tracking-widest text-secondary-400">
                    Billing Record
                  </dt>
                  <dd className="data-mono mt-1 text-sm font-bold text-secondary-900">
                    #{invoice.billing_id}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-[10px] font-black uppercase tracking-widest text-secondary-400">
                  Payments Recorded
                </dt>
                <dd className="data-mono mt-1 text-sm font-bold text-secondary-900">
                  {paymentsQuery.data?.length ?? 0}
                </dd>
              </div>
              {invoice.note ? (
                <div>
                  <dt className="text-[10px] font-black uppercase tracking-widest text-secondary-400">
                    Note
                  </dt>
                  <dd className="mt-1 text-sm text-secondary-600">{invoice.note}</dd>
                </div>
              ) : null}
            </dl>
          </Card>
        </div>
      </div>

      <RecordPaymentModal
        invoice={invoice}
        isOpen={paymentModal.isOpen}
        onClose={paymentModal.close}
      />

      <ConfirmDialog
        isOpen={voidDialog.isOpen}
        onClose={voidDialog.close}
        onConfirm={handleVoid}
        title="Void this invoice?"
        tone="danger"
        description={`Invoice ${invoice.invoice_no} will be voided. This cannot be undone.`}
        confirmLabel="Void Invoice"
      />
    </div>
  );
}
