import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Ban, CheckCircle2, CreditCard, FileText, History, Printer, Receipt, RotateCcw, User } from "lucide-react";
import {
  DxBadge,
  DxButton,
  DxConfirm,
  DxForm,
  DxGrid,
  DxInput,
  DxMessage,
  DxPage,
  DxPageHeader,
  DxPageLoading,
  DxPanel,
  DxPopup,
  DxProps,
  DxSelect,
  DxStatusBadge,
  DxStatusBar,
  DxStatusItem,
  DxTextarea,
  apiErrorMessage,
  formatDate,
  formatDateTime,
  formatNaira,
  humanize,
  type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { routes } from "@/config/routes";
import { membershipApi, formatCardMoney } from "@/features/patients/api/membership.api";
import { getPatientById } from "@/features/patients/api/patients.api";
import { listPatientInsurance } from "@/features/insurance/api/insurance.api";
import { advanceVisit, getVisitDetails } from "@/features/visits/api/visits.api";
import { patientDisplayName } from "@/features/visits/lib/clinic-flow";
import { type Invoice, type InvoiceItem, type InvoicePayment } from "../api/billing.api";
import { useInvoice, useInvoicePayments, useReceivePayment, useVisitBillingSummary, useVoidInvoice } from "../hooks/use-billing";
import { InvoiceStatusBadge } from "../components/InvoiceStatusBadge";
import {
  PAYMENT_METHOD_OPTIONS,
  canReceivePayment,
  canVoidInvoice,
  chargeTotals,
  isSettled,
  paymentMethodLabel,
  splitForItem,
  visitIsClosed,
} from "../lib/billing-view";

// ============================================================
// Record payment popup
// ============================================================

/**
 * Mounted only while open so its form state resets on every open without
 * effects. Amount defaults to the outstanding balance.
 */
function RecordPaymentPopup({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const toast = useToast();
  const receivePayment = useReceivePayment();
  const [amount, setAmount] = useState(invoice.balance_due > 0 ? String(invoice.balance_due) : "");
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [cardId, setCardId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isCardMethod = method === "MEMBERSHIP_CARD";

  const cardsQuery = useQuery({
    queryKey: ["membership-cards", "patient", invoice.patient_id],
    queryFn: () => membershipApi.forPatient(invoice.patient_id),
    enabled: isCardMethod && typeof invoice.patient_id === "number",
  });
  const cards = cardsQuery.data;
  const selectedCard = useMemo(() => cards?.find((c) => String(c.id) === cardId), [cards, cardId]);
  const selectedCardBalance = selectedCard ? Number(selectedCard.balance) : 0;
  const parsedAmount = Number(amount);
  const remaining = invoice.balance_due - (Number.isFinite(parsedAmount) ? parsedAmount : 0);

  const handleSubmit = () => {
    if (!parsedAmount || parsedAmount <= 0) {
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
      if (parsedAmount > selectedCardBalance) {
        setError(`Insufficient card balance (${formatCardMoney(selectedCardBalance)}).`);
        return;
      }
    }
    setError(null);
    // POST /payments/ has no reference field of its own — the teller/POS
    // reference travels in the note so it still lands on the receipt.
    const composedNote = [reference.trim() ? `Ref: ${reference.trim()}` : null, note.trim() || null].filter(Boolean).join(" — ");
    receivePayment.mutate(
      {
        invoice_id: invoice.id,
        amount: parsedAmount,
        payment_method: method,
        membership_card_id: isCardMethod && selectedCard ? selectedCard.id : undefined,
        note: composedNote || undefined,
      },
      {
        onSuccess: (payment) => {
          toast.success("Payment recorded", `${formatNaira(payment.amount)} · ${payment.payment_reference}`);
          onClose();
        },
        onError: (err) => toast.error("Could not record payment", apiErrorMessage(err)),
      },
    );
  };

  return (
    <DxPopup
      isOpen
      onClose={onClose}
      locked={receivePayment.isPending}
      title={`Record payment — ${invoice.invoice_no}`}
      size="md"
      footer={
        <>
          <DxButton onClick={onClose} disabled={receivePayment.isPending}>
            Cancel
          </DxButton>
          <DxButton variant="primary" leftIcon={<CreditCard />} onClick={handleSubmit} isLoading={receivePayment.isPending}>
            Record payment
          </DxButton>
        </>
      }
    >
      <div className="space-y-4">
        <DxProps
          tight
          items={[
            { label: "Patient balance", value: <span className="dx-mono dx-strong">{formatNaira(invoice.balance_due)}</span> },
            {
              label: "After this payment",
              value: (
                <span className="dx-mono" style={{ color: remaining <= 0 ? "var(--dx-success)" : "var(--dx-text)" }}>
                  {formatNaira(Math.max(0, remaining))}
                  {remaining < 0 ? <span className="dx-muted"> (overpayment {formatNaira(-remaining)})</span> : null}
                </span>
              ),
            },
          ]}
        />
        <DxForm cols={2}>
          <DxInput
            label="Amount"
            required
            type="number"
            min={0}
            step="0.01"
            unit="₦"
            mono
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            error={error ?? undefined}
            autoFocus
          />
          <DxSelect
            label="Method"
            required
            options={PAYMENT_METHOD_OPTIONS}
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setError(null);
            }}
          />
          {isCardMethod ? (
            cardsQuery.isLoading ? (
              <div className="dx-skeleton h-8 dx-col-span-full" />
            ) : !cards || cards.length === 0 ? (
              <DxMessage tone="warning" className="dx-col-span-full">
                This patient has no membership card on file.
              </DxMessage>
            ) : (
              <DxSelect
                label="Membership card"
                required
                fieldClassName="dx-col-span-full"
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
                placeholder="Select a card…"
                options={cards.map((c) => ({
                  value: String(c.id),
                  label: `${c.card_number} — ${formatCardMoney(c.balance)}${c.status !== "ACTIVE" ? ` (${c.status})` : ""}`,
                }))}
                hint={selectedCard ? `Available balance: ${formatCardMoney(selectedCardBalance)}` : undefined}
                error={selectedCard && selectedCardBalance < parsedAmount ? "Card balance is below the amount entered." : undefined}
              />
            )
          ) : null}
          <DxInput
            label="Reference"
            mono
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="POS slip / transfer / teller ref"
            fieldClassName="dx-col-span-full"
          />
          <DxTextarea
            label="Note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional — e.g. POS terminal 2"
            fieldClassName="dx-col-span-full"
          />
        </DxForm>
      </div>
    </DxPopup>
  );
}

// ============================================================
// Page
// ============================================================

type ChargeRow = InvoiceItem & { covered: number | null; patient: number };

/**
 * Cashier view of one invoice: charges with the HMO / patient split, the
 * payment ledger, Record Payment, Void, Print — and once the balance clears,
 * the "end visit" hand-off that completes the cashier step of the pathway.
 */
export function BillingDetailPage(props: { visitId?: number; embedded?: boolean; invoiceId?: number } = {}) {
  const embedded = props.embedded ?? false;
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { invoiceId: invoiceIdParam } = useParams<{ invoiceId: string }>();
  const [searchParams] = useSearchParams();
  const numericId = props.invoiceId ?? (invoiceIdParam && /^\d+$/.test(invoiceIdParam) ? Number(invoiceIdParam) : undefined);

  const invoiceQuery = useInvoice(numericId);
  const paymentsQuery = useInvoicePayments(numericId);
  const voidInvoice = useVoidInvoice();

  const invoice = invoiceQuery.data;
  const visitId = invoice?.visit_id ?? undefined;
  const patientId = invoice?.patient_id;

  const visitQuery = useQuery({
    queryKey: ["visits", "detail", visitId],
    queryFn: () => getVisitDetails(visitId as number),
    enabled: typeof visitId === "number",
  });
  const chargeSheetQuery = useVisitBillingSummary(visitId);
  const patientQuery = useQuery({
    queryKey: ["patients", "detail", patientId],
    queryFn: () => getPatientById(patientId as number),
    enabled: typeof patientId === "number",
  });
  const insuranceQuery = useQuery({
    queryKey: ["patient-insurance", patientId],
    queryFn: () => listPatientInsurance(patientId as number),
    enabled: typeof patientId === "number",
  });

  const [paymentOpen, setPaymentOpen] = useState(searchParams.get("pay") === "1");
  const [voidOpen, setVoidOpen] = useState(false);
  const [endVisitOpen, setEndVisitOpen] = useState(false);

  const visit = visitQuery.data ?? null;
  const patient = patientQuery.data ?? null;
  const policy = useMemo(() => {
    const list = insuranceQuery.data ?? [];
    return list.find((p) => p.is_active !== false) ?? list[0] ?? null;
  }, [insuranceQuery.data]);

  // ---------- Charges + HMO split ----------
  const chargeRows: ChargeRow[] = useMemo(() => {
    const items = invoice?.items ?? [];
    return items.map((it) => ({ ...it, ...splitForItem(it, chargeSheetQuery.data?.items) }));
  }, [invoice?.items, chargeSheetQuery.data?.items]);
  const totals = useMemo(() => chargeTotals(invoice?.items ?? [], chargeRows), [invoice?.items, chargeRows]);
  const hasSplit = totals.covered != null;
  const coveredPct = hasSplit && totals.gross > 0 ? Math.round(((totals.covered ?? 0) / totals.gross) * 100) : null;

  // ---------- Mutations ----------
  const voidMutation = {
    run: async () => {
      if (!invoice) return;
      try {
        await voidInvoice.mutateAsync({ invoiceId: invoice.id });
        toast.success("Invoice voided", `Invoice ${invoice.invoice_no} has been voided.`);
      } catch (err) {
        toast.error("Could not void invoice", apiErrorMessage(err));
        throw err;
      }
    },
  };

  const endVisitMutation = useMutation({
    mutationFn: () => advanceVisit(visitId as number, { action: "complete", notes: "Bill settled at cashier." }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["visits"] });
      qc.invalidateQueries({ queryKey: ["queue"] });
      const nextSdp = res.visit?.current_service_delivery_point?.name;
      if (visitIsClosed(res.visit?.status) || !res.next_step) {
        toast.success("Visit completed", `${patientDisplayName(visit?.patient)} has been checked out.`);
      } else {
        toast.success("Billing step complete", `${patientDisplayName(visit?.patient)} routed to ${nextSdp ?? "the next service point"}.`);
      }
    },
    onError: (err) => {
      const msg = apiErrorMessage(err);
      if (/no clinical flow steps|flow steps/i.test(msg)) {
        toast.warning("Visit has no care pathway", "Close or route this visit from the Queue page instead.");
        return;
      }
      toast.error("Could not complete the billing step", msg);
    },
  });

  // ---------- Grids ----------
  const money = (v: number | null | undefined, strong?: boolean) => (
    <span className={strong ? "dx-mono dx-strong" : "dx-mono"}>{v == null ? "—" : formatNaira(v)}</span>
  );

  const chargeColumns: DxGridColumn<ChargeRow>[] = [
    {
      key: "service_name",
      header: "Service",
      minWidth: 220,
      wrap: true,
      render: (r) => (
        <span className="flex flex-col leading-tight">
          <span className="dx-strong">{r.service_name}</span>
          {r.service_code ? <span className="dx-mono text-[11px] text-[var(--dx-text-muted)]">{r.service_code}</span> : null}
        </span>
      ),
    },
    { key: "quantity", header: "Qty", width: 60, align: "center", render: (r) => <span className="dx-mono">{r.quantity}</span> },
    { key: "unit_price", header: "Unit price", width: 120, align: "right", render: (r) => money(r.unit_price) },
    { key: "discount_amount", header: "Discount", width: 110, align: "right", render: (r) => (r.discount_amount > 0 ? money(-r.discount_amount) : <span className="dx-muted">—</span>) },
    { key: "line_total", header: "Gross", width: 120, align: "right", render: (r) => money(r.line_total) },
    { key: "covered", header: "HMO covers", width: 120, align: "right", render: (r) => (r.covered == null ? <span className="dx-muted">—</span> : money(r.covered)) },
    { key: "patient", header: "Patient pays", width: 130, align: "right", render: (r) => money(r.patient, true) },
  ];

  const chargeSummary = invoice
    ? {
        service_name: <span className="dx-strong">Totals ({chargeRows.length} line{chargeRows.length === 1 ? "" : "s"})</span>,
        discount_amount: totals.discount > 0 ? money(-totals.discount) : null,
        line_total: money(invoice.subtotal_amount || totals.gross, true),
        covered: hasSplit ? money(totals.covered, true) : <span className="dx-muted">—</span>,
        patient: money(hasSplit ? totals.patient : invoice.total_amount, true),
      }
    : undefined;

  const paymentColumns: DxGridColumn<InvoicePayment>[] = [
    { key: "paid_at", header: "Date", width: 140, sortable: true, render: (p) => <span className="dx-mono">{formatDateTime(p.paid_at ?? p.created_at)}</span> },
    { key: "payment_method", header: "Method", width: 130, render: (p) => paymentMethodLabel(p.payment_method) },
    { key: "payment_reference", header: "Reference", minWidth: 120, render: (p) => <span className="dx-mono">{p.payment_reference}</span> },
    { key: "amount", header: "Amount", width: 120, align: "right", sortable: true, render: (p) => money(p.amount, true) },
    { key: "payment_status", header: "Status", width: 110, render: (p) => <DxStatusBadge status={p.payment_status} /> },
  ];

  // ---------- Route-level states ----------
  if (numericId === undefined) {
    if (embedded) {
      return (
        <div className="space-y-4">
          <DxMessage tone="danger" title="This reference does not point to a valid invoice." />
        </div>
      );
    }
    return (
      <DxPage>
        <DxPageHeader crumbs={[{ label: "Billing & Payment", to: routes.billing }, { label: "Invoice" }]} title="Invalid invoice reference" />
        <DxMessage tone="danger" title="This link does not point to a valid invoice." action={<DxButton size="sm" onClick={() => navigate(routes.billing)}>Back to billing</DxButton>} />
      </DxPage>
    );
  }

  if (invoiceQuery.isLoading)
    return embedded ? (
      <div className="space-y-4">
        <div className="dx-skeleton h-64 w-full" />
      </div>
    ) : (
      <DxPageLoading label="Loading invoice…" />
    );

  if (invoiceQuery.isError || !invoice) {
    if (embedded) {
      return (
        <div className="space-y-4">
          <DxMessage
            tone="danger"
            title="The invoice could not be loaded."
            action={
              <DxButton size="sm" leftIcon={<RotateCcw />} onClick={() => invoiceQuery.refetch()}>
                Retry
              </DxButton>
            }
          >
            {invoiceQuery.error ? apiErrorMessage(invoiceQuery.error) : "It may have been removed, or you may not have access."}
          </DxMessage>
        </div>
      );
    }
    return (
      <DxPage>
        <DxPageHeader crumbs={[{ label: "Billing & Payment", to: routes.billing }, { label: "Invoice" }]} title="Invoice not found" />
        <DxMessage
          tone="danger"
          title="The invoice could not be loaded."
          action={
            <span className="flex gap-2">
              <DxButton size="sm" leftIcon={<RotateCcw />} onClick={() => invoiceQuery.refetch()}>
                Retry
              </DxButton>
              <DxButton size="sm" variant="text" onClick={() => navigate(routes.billing)}>
                Back to billing
              </DxButton>
            </span>
          }
        >
          {invoiceQuery.error ? apiErrorMessage(invoiceQuery.error) : "It may have been removed, or you may not have access."}
        </DxMessage>
      </DxPage>
    );
  }

  const payable = canReceivePayment(invoice);
  const voidable = canVoidInvoice(invoice);
  const settled = isSettled(invoice);
  const visitClosed = visitIsClosed(visit?.status);
  const patientName = visit?.patient ? patientDisplayName(visit.patient) : patient ? patientDisplayName(patient) : `Patient #${invoice.patient_id}`;
  const hospitalNo = visit?.patient?.hospital_number ?? patient?.hospital_number ?? "—";
  const payerLabel = policy?.provider_name ?? (invoice.payer_id ? `Payer #${invoice.payer_id}` : patient?.payer_type ? humanize(patient.payer_type) : "Self pay");
  const balanceColor = invoice.balance_due > 0 ? "var(--dx-danger)" : "var(--dx-success)";

  const body = (
    <>
      {embedded && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="dx-mono dx-strong">{invoice.invoice_no}</span>
          <InvoiceStatusBadge status={invoice.status} />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <DxButton size="sm" leftIcon={<Printer />} onClick={() => window.print()}>
              Print
            </DxButton>
            {voidable ? (
              <DxButton size="sm" variant="outline-danger" leftIcon={<Ban />} onClick={() => setVoidOpen(true)}>
                Void
              </DxButton>
            ) : null}
            {payable ? (
              <DxButton size="sm" variant="primary" leftIcon={<CreditCard />} onClick={() => setPaymentOpen(true)}>
                Record payment
              </DxButton>
            ) : null}
          </div>
        </div>
      )}
      {!embedded && (
      <DxPageHeader
        crumbs={[{ label: "Billing & Payment", to: routes.billing }, { label: invoice.invoice_no }]}
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="dx-mono">{invoice.invoice_no}</span>
            <InvoiceStatusBadge status={invoice.status} />
          </span>
        }
        subtitle={`Issued ${formatDate(invoice.invoice_date)}${invoice.due_date ? ` · due ${formatDate(invoice.due_date)}` : ""}`}
        actions={
          <>
            <DxButton leftIcon={<Printer />} onClick={() => window.print()}>
              Print
            </DxButton>
            {voidable ? (
              <DxButton variant="outline-danger" leftIcon={<Ban />} onClick={() => setVoidOpen(true)}>
                Void
              </DxButton>
            ) : null}
            {payable ? (
              <DxButton variant="primary" leftIcon={<CreditCard />} onClick={() => setPaymentOpen(true)}>
                Record payment
              </DxButton>
            ) : null}
          </>
        }
      />
      )}

      {!embedded && settled && visitId ? (
        <DxMessage
          tone="success"
          title="Bill settled"
          action={
            visitClosed ? (
              <DxBadge tone="success">Visit {humanize(visit?.status)}</DxBadge>
            ) : (
              <DxButton
                size="sm"
                variant="primary"
                leftIcon={<CheckCircle2 />}
                onClick={() => setEndVisitOpen(true)}
                isLoading={endVisitMutation.isPending}
              >
                Complete billing step / End visit
              </DxButton>
            )
          }
        >
          {visitClosed
            ? "The patient's balance is ₦0 and the visit has already been closed."
            : "The patient's balance is ₦0. Complete the cashier step to end the visit or move it to the next service point."}
        </DxMessage>
      ) : null}

      <DxPanel title="Patient & visit" icon={<User className="h-4 w-4" />}>
        <div className="grid gap-x-8 gap-y-1 md:grid-cols-2">
          <DxProps
            tight
            items={[
              {
                label: "Patient",
                value: (
                  <Link to={routes.patientDetail.replace(":patientId", String(invoice.patient_id))} className="dx-strong hover:underline">
                    {patientName}
                  </Link>
                ),
              },
              { label: "Hospital no.", value: <span className="dx-mono">{hospitalNo}</span> },
              {
                label: "Visit",
                value: visitId ? (
                  <Link to={routes.visitDetail.replace(":visitId", String(visitId))} className="dx-mono hover:underline">
                    {visit?.visit_code ?? `#${visitId}`}
                  </Link>
                ) : (
                  <span className="dx-muted">Not linked to a visit</span>
                ),
              },
              { label: "Visit status", value: visit ? <DxStatusBadge status={visit.status} /> : "—" },
            ]}
          />
          <DxProps
            tight
            items={[
              { label: "Payer", value: payerLabel },
              { label: "Plan", value: policy?.plan_name ?? "—" },
              { label: "Policy no.", value: policy ? <span className="dx-mono">{policy.policy_number}</span> : "—" },
              {
                label: "Coverage class",
                value: patient?.patient_class ? humanize(patient.patient_class) : patient?.payer_type ? humanize(patient.payer_type) : "—",
              },
            ]}
          />
        </div>
      </DxPanel>

      <div className="grid gap-4 xl:grid-cols-12">
        <DxPanel
          className="xl:col-span-8"
          title="Charges"
          icon={<FileText className="h-4 w-4" />}
          description={
            hasSplit
              ? `HMO covers ${formatNaira(totals.covered)}${coveredPct != null ? ` (${coveredPct}%)` : ""} · patient pays ${formatNaira(totals.patient)}`
              : chargeSheetQuery.isLoading
                ? "Loading charge sheet…"
                : "No payer split on this bill — the patient is responsible for the full amount."
          }
          flush
        >
          <DxGrid
            borderless
            columns={chargeColumns}
            data={chargeRows}
            rowKey={(r) => r.id}
            summary={chargeSummary}
            empty={{ icon: Receipt, title: "No charge lines", description: "This invoice has no chargeable services." }}
          />
        </DxPanel>

        <div className="space-y-4 xl:col-span-4">
          <DxPanel title="Summary" icon={<Receipt className="h-4 w-4" />} flush>
            <DxProps
              items={[
                { label: "Total charges", value: money(invoice.subtotal_amount || totals.gross) },
                { label: "Covered by payer", value: hasSplit ? money(totals.covered) : <span className="dx-muted">—</span> },
                { label: "Discounts", value: invoice.discount_amount > 0 ? money(-invoice.discount_amount) : money(0) },
                ...(invoice.tax_amount > 0 ? [{ label: "Tax", value: money(invoice.tax_amount) }] : []),
                { label: "Invoice total", value: money(invoice.total_amount, true) },
                { label: "Amount paid", value: <span className="dx-mono" style={{ color: "var(--dx-success)" }}>{formatNaira(invoice.amount_paid)}</span> },
                {
                  label: <span className="dx-strong">Patient balance</span>,
                  value: (
                    <span className="dx-mono text-[16px] font-semibold" style={{ color: balanceColor }}>
                      {formatNaira(invoice.balance_due)}
                    </span>
                  ),
                },
              ]}
            />
            {invoice.note ? (
              <div className="border-t border-[var(--dx-border)] px-3 py-2 text-[12px] text-[var(--dx-text-muted)]">{invoice.note}</div>
            ) : null}
          </DxPanel>

          <DxPanel
            title="Payments"
            icon={<History className="h-4 w-4" />}
            flush
            actions={
              payable ? (
                <DxButton size="sm" variant="accent-text" leftIcon={<CreditCard />} onClick={() => setPaymentOpen(true)}>
                  Record payment
                </DxButton>
              ) : undefined
            }
          >
            <DxGrid
              borderless
              columns={paymentColumns}
              data={paymentsQuery.data}
              rowKey={(p) => p.id}
              isLoading={paymentsQuery.isLoading}
              error={paymentsQuery.isError ? apiErrorMessage(paymentsQuery.error, "Failed to load payments.") : null}
              onRetry={() => paymentsQuery.refetch()}
              skeletonRows={3}
              empty={{ icon: CreditCard, title: "No payments yet", description: "Payments recorded against this invoice appear here." }}
            />
          </DxPanel>
        </div>
      </div>

      <DxStatusBar>
        <DxStatusItem>
          Invoice <span className="dx-mono">{invoice.invoice_no}</span>
        </DxStatusItem>
        {invoice.billing_id ? <DxStatusItem>Billing record #{invoice.billing_id}</DxStatusItem> : null}
        <DxStatusItem>{paymentsQuery.data?.length ?? 0} payment(s)</DxStatusItem>
        {invoice.updated_at ? <DxStatusItem>Updated {formatDateTime(invoice.updated_at)}</DxStatusItem> : null}
      </DxStatusBar>

      {paymentOpen ? <RecordPaymentPopup invoice={invoice} onClose={() => setPaymentOpen(false)} /> : null}

      <DxConfirm
        isOpen={voidOpen}
        onClose={() => setVoidOpen(false)}
        onConfirm={voidMutation.run}
        title="Void this invoice?"
        tone="danger"
        description={`Invoice ${invoice.invoice_no} will be voided and can no longer receive payments. This cannot be undone.`}
        confirmLabel="Void invoice"
      />

      {!embedded && (
      <DxConfirm
        isOpen={endVisitOpen}
        onClose={() => setEndVisitOpen(false)}
        onConfirm={() => endVisitMutation.mutateAsync().then(() => undefined)}
        title="Complete the billing step?"
        tone="primary"
        description={`${patientName}'s bill is settled. The cashier step on visit ${visit?.visit_code ?? `#${visitId}`} will be marked complete; the visit ends or moves to its next service point.`}
        confirmLabel="End visit"
      />
      )}
    </>
  );

  return embedded ? <div className="space-y-4">{body}</div> : <DxPage>{body}</DxPage>;
}
