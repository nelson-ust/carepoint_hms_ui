import { useMemo, useState } from "react";
import { Banknote, Clock, CreditCard, Plus, RotateCcw, Undo2, Wallet } from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxButton, DxBadge, DxKpi, DxInput, DxSelect, DxTextarea,
  DxPopup, DxGrid, type DxGridColumn, type DxBadgeTone,
} from "@/components/dx";
import { SearchInput } from "@/components/forms/SearchInput";
import { Pagination } from "@/components/data-table/Pagination";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { useDisclosure } from "@/hooks/useDisclosure";
import {
  formatMoney, PAYMENT_METHODS, PAYMENT_STATUSES, type Payment,
} from "../api/payments.api";
import {
  usePayments, usePaymentsSummary, useReceivePayment, useRefundPayment,
} from "../hooks/use-payments";

const PAGE_SIZE = 20;

const METHOD_OPTIONS = [
  { value: "", label: "All methods" },
  ...PAYMENT_METHODS.map((m) => ({ value: m, label: m.replace(/_/g, " ") })),
];
const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  ...PAYMENT_STATUSES.map((s) => ({ value: s, label: s })),
];

const STATUS_TONES: Record<string, DxBadgeTone> = {
  SUCCESSFUL: "success", PENDING: "warning", FAILED: "danger", REVERSED: "danger", CANCELLED: "neutral",
};
const METHOD_TONES: Record<string, DxBadgeTone> = {
  CASH: "success", CARD: "info", BANK_TRANSFER: "info", MOBILE_MONEY: "info",
  INSURANCE: "warning", LOYALTY: "neutral", WAIVER: "neutral", MEMBERSHIP_CARD: "neutral", OTHER: "neutral",
};

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function RecordPaymentModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const toast = useToast();
  const receive = useReceivePayment();
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setInvoiceId(""); setAmount(""); setMethod("CASH"); setNote(""); setError(null); onClose();
  };

  const handleSubmit = () => {
    const parsedInvoiceId = Number(invoiceId);
    const parsedAmount = Number(amount);
    if (!parsedInvoiceId || parsedInvoiceId <= 0) { setError("A valid invoice ID is required."); return; }
    if (!parsedAmount || parsedAmount <= 0) { setError("Enter an amount greater than zero."); return; }
    setError(null);
    receive.mutate(
      { invoice_id: parsedInvoiceId, amount: parsedAmount, payment_method: method, note: note.trim() || undefined },
      {
        onSuccess: (payment) => { toast.success("Payment recorded", `Reference ${payment.payment_reference}`); handleClose(); },
        onError: (err: any) => toast.error("Failed to record payment", err?.response?.data?.detail?.toString?.() ?? err?.message),
      },
    );
  };

  return (
    <DxPopup
      isOpen={isOpen}
      onClose={handleClose}
      title="Record payment"
      size="sm"
      footer={
        <>
          <DxButton variant="text" onClick={handleClose}>Cancel</DxButton>
          <DxButton variant="primary" onClick={handleSubmit} isLoading={receive.isPending} leftIcon={<CreditCard className="h-4 w-4" />}>Record payment</DxButton>
        </>
      }
    >
      <div className="space-y-4">
        <DxInput label="Invoice ID" type="number" mono min={1} value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} placeholder="e.g. 128" />
        <DxInput label="Amount" type="number" mono min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        <DxSelect label="Payment method" options={METHOD_OPTIONS.slice(1)} value={method} onChange={(e) => setMethod(e.target.value)} />
        <DxTextarea label="Note (optional)" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. POS terminal 2, teller ref…" />
        {error ? <p className="text-[12px] font-semibold text-[var(--dx-danger,#e11d48)]">{error}</p> : null}
      </div>
    </DxPopup>
  );
}

export function PaymentsPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [refundTarget, setRefundTarget] = useState<Payment | null>(null);

  const recordModal = useDisclosure();
  const refundPayment = useRefundPayment();

  const filters = useMemo(
    () => ({ skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE, payment_method: method || undefined, payment_status: status || undefined }),
    [page, method, status],
  );

  const paymentsQuery = usePayments(filters);
  const summaryQuery = usePaymentsSummary();

  const rows = useMemo(() => {
    let items = paymentsQuery.data?.items ?? [];
    if (search) {
      const term = search.toLowerCase();
      items = items.filter((p) => p.payment_reference.toLowerCase().includes(term) || String(p.invoice_id).includes(term));
    }
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      items = items.filter((p) => p.paid_at && new Date(p.paid_at).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      items = items.filter((p) => p.paid_at && new Date(p.paid_at).getTime() <= to.getTime());
    }
    return items;
  }, [paymentsQuery.data?.items, search, dateFrom, dateTo]);

  const meta = paymentsQuery.data?.meta;
  const summary = summaryQuery.data;

  const handleRefund = async () => {
    if (!refundTarget) return;
    try {
      await refundPayment.mutateAsync({ paymentId: refundTarget.id });
      toast.success("Payment refunded", `Reference ${refundTarget.payment_reference} reversed.`);
      setRefundTarget(null);
    } catch (err: any) {
      toast.error("Failed to refund payment", err?.response?.data?.detail?.toString?.() ?? err?.message);
    }
  };

  const columns: DxGridColumn<Payment>[] = [
    { key: "payment_reference", header: "Reference", render: (p) => (
        <div>
          <p className="dx-mono text-[13px] font-semibold text-[var(--dx-text)]">{p.payment_reference}</p>
          <p className="mt-0.5 text-[11.5px] text-[var(--dx-text-faint)]">{formatDateTime(p.paid_at)}</p>
        </div>) },
    { key: "invoice_id", header: "Invoice", render: (p) => <span className="dx-mono text-[13px] text-[var(--dx-text-muted)]">#{p.invoice_id}</span> },
    { key: "payment_method", header: "Method", render: (p) => {
        const m = p.payment_method ?? "OTHER";
        return <DxBadge tone={METHOD_TONES[m] ?? "neutral"}>{m.replace(/_/g, " ")}</DxBadge>;
      } },
    { key: "payment_status", header: "Status", render: (p) => <DxBadge dot tone={STATUS_TONES[p.payment_status] ?? "neutral"}>{p.payment_status}</DxBadge> },
    { key: "amount", header: "Amount", align: "right", render: (p) => <span className="dx-mono font-semibold text-[var(--dx-text)]">{formatMoney(p.amount, p.currency)}</span> },
    { key: "actions", header: "", align: "right", render: (p) =>
        p.payment_status === "SUCCESSFUL" ? (
          <DxButton variant="text" size="sm" leftIcon={<Undo2 className="h-3.5 w-3.5" />} onClick={(e) => { e.stopPropagation(); setRefundTarget(p); }}>Refund</DxButton>
        ) : null },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Billing" }, { label: "Payments" }]}
        title="Payments"
        subtitle="Ledger of all payments received across invoices, with refunds and reconciliation."
        actions={<DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={recordModal.open}>Record payment</DxButton>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DxKpi label="Total payments" value={summary ? summary.totalPayments.toLocaleString() : "—"} icon={Wallet} tone="accent" isLoading={summaryQuery.isLoading} />
        <DxKpi label="Collected (successful)" value={summary ? formatMoney(summary.totalCollected) : "—"} icon={Banknote} tone="info" isLoading={summaryQuery.isLoading} />
        <DxKpi label="Pending" value={summary ? summary.pendingCount.toLocaleString() : "—"} icon={Clock} tone="warning" isLoading={summaryQuery.isLoading} />
        <DxKpi label="Reversed amount" value={summary ? formatMoney(summary.reversedAmount) : "—"} icon={RotateCcw} tone="danger" isLoading={summaryQuery.isLoading} />
      </div>

      <DxPanel flush>
        <div className="flex flex-wrap items-end gap-2 px-4 py-3">
          <SearchInput onSearch={setSearch} placeholder="Search reference or invoice…" className="w-72" />
          <DxSelect aria-label="Filter by method" options={METHOD_OPTIONS} value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }} className="w-44" />
          <DxSelect aria-label="Filter by status" options={STATUS_OPTIONS} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-40" />
          <div className="w-40"><DxInput aria-label="From date" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
          <div className="w-40"><DxInput aria-label="To date" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
        </div>
        <DxGrid<Payment>
          borderless
          columns={columns}
          data={rows}
          rowKey={(p) => p.id}
          isLoading={paymentsQuery.isLoading}
          error={paymentsQuery.isError ? "Failed to load payments." : null}
          onRetry={() => paymentsQuery.refetch()}
          empty={{
            icon: CreditCard,
            title: "No payments found",
            description: search || dateFrom || dateTo ? "No payments match your filters on this page." : "Payments will appear here as they are received.",
            action: <DxButton size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={recordModal.open}>Record payment</DxButton>,
          }}
          footer={
            <Pagination
              page={page}
              totalPages={meta?.total_pages}
              hasNext={meta?.has_next}
              totalItems={typeof meta?.total === "number" ? meta.total : undefined}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          }
        />
      </DxPanel>

      <RecordPaymentModal isOpen={recordModal.isOpen} onClose={recordModal.close} />

      <ConfirmDialog
        isOpen={refundTarget !== null}
        onClose={() => setRefundTarget(null)}
        onConfirm={handleRefund}
        title="Refund this payment?"
        tone="danger"
        description={
          refundTarget
            ? `${formatMoney(refundTarget.amount, refundTarget.currency)} (ref ${refundTarget.payment_reference}) will be reversed against invoice #${refundTarget.invoice_id}.`
            : undefined
        }
        confirmLabel="Refund"
      />
    </DxPage>
  );
}
