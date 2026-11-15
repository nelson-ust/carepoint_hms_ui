import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Banknote, CalendarDays, CreditCard, ExternalLink, FileWarning, Plus, Receipt, RotateCcw, Wallet, X } from "lucide-react";
import {
  DxButton,
  DxGrid,
  DxInput,
  DxKpi,
  DxMessage,
  DxPage,
  DxPageHeader,
  DxPager,
  DxSearchBox,
  DxSelect,
  DxToolbar,
  DxToolbarLabel,
  DxToolbarSeparator,
  DxToolbarSpacer,
  apiErrorMessage,
  formatDate,
  formatNaira,
  type DxGridColumn,
} from "@/components/dx";
import { useDisclosure } from "@/hooks/useDisclosure";
import { routes } from "@/config/routes";
import type { Invoice } from "../api/billing.api";
import { useBillingSummary, useInvoices } from "../hooks/use-billing";
import { InvoiceStatusBadge } from "../components/InvoiceStatusBadge";
import { CreateInvoiceModal } from "../components/CreateInvoiceModal";
import { BillingDetailPage } from "./BillingDetailPage";
import { INVOICE_STATUS_OPTIONS, canReceivePayment, inDateRange, paidToday } from "../lib/billing-view";

const PAGE_SIZE = 20;

/**
 * Cashier worklist: every invoice raised in the hospital, with the running
 * totals the cashier cares about. Opened from the queue with `?visit=<id>` it
 * narrows to that visit's bill and jumps straight to it when there is one.
 */
export function BillingListPage(props: { visitId?: number; embedded?: boolean } = {}) {
  const embedded = props.embedded ?? false;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const visitParam = searchParams.get("visit");
  const visitId = props.visitId ?? (visitParam && /^\d+$/.test(visitParam) ? Number(visitParam) : undefined);

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const createModal = useDisclosure();
  const [embeddedInvoiceId, setEmbeddedInvoiceId] = useState<number | null>(null);

  const filters = useMemo(
    () => ({
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      status: status || undefined,
      visit_id: visitId,
    }),
    [page, status, visitId],
  );

  const invoicesQuery = useInvoices(filters);
  const summaryQuery = useBillingSummary();

  const pageItems = invoicesQuery.data?.items;

  const rows = useMemo(() => {
    const term = search.toLowerCase();
    return (pageItems ?? []).filter((inv) => {
      // Defensive client-side narrowing in case the API ignores visit_id.
      if (visitId !== undefined && inv.visit_id !== visitId) return false;
      if (!inDateRange(inv, from, to)) return false;
      if (!term) return true;
      return (
        inv.invoice_no.toLowerCase().includes(term) ||
        String(inv.patient_id).includes(term) ||
        (inv.visit_id != null && String(inv.visit_id).includes(term))
      );
    });
  }, [pageItems, search, visitId, from, to]);

  // Queue hand-off: a single invoice for the visit → open it directly.
  const soleVisitInvoiceId =
    visitId !== undefined && invoicesQuery.isSuccess && rows.length === 1 ? rows[0].id : undefined;
  useEffect(() => {
    if (!embedded && soleVisitInvoiceId !== undefined) {
      navigate(`${routes.billing}/${soleVisitInvoiceId}`, { replace: true });
    }
  }, [embedded, soleVisitInvoiceId, navigate]);

  const clearVisitFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("visit");
    setSearchParams(next, { replace: true });
    setPage(1);
  };

  const meta = invoicesQuery.data?.meta;
  const summary = summaryQuery.data;
  const collectedToday = paidToday(pageItems ?? []);

  const openInvoice = (inv: Invoice) => navigate(`${routes.billing}/${inv.id}`);

  const columns: DxGridColumn<Invoice>[] = [
    {
      key: "invoice_no",
      header: "Invoice no.",
      width: 150,
      sortable: true,
      filter: true,
      render: (inv) => <span className="dx-mono dx-strong">{inv.invoice_no}</span>,
    },
    {
      key: "patient_id",
      header: "Patient",
      minWidth: 140,
      sortable: true,
      filter: true,
      accessor: (inv) => inv.patient_id,
      render: (inv) => (
        <span className="dx-strong">Patient #{inv.patient_id}</span>
      ),
    },
    {
      key: "visit_id",
      header: "Visit",
      width: 110,
      sortable: true,
      filter: true,
      accessor: (inv) => inv.visit_id ?? "",
      render: (inv) => (inv.visit_id ? <span className="dx-mono">Visit #{inv.visit_id}</span> : <span className="dx-muted">—</span>),
    },
    {
      key: "invoice_date",
      header: "Date",
      width: 120,
      sortable: true,
      accessor: (inv) => inv.invoice_date,
      render: (inv) => formatDate(inv.invoice_date),
    },
    {
      key: "total_amount",
      header: "Total",
      align: "right",
      width: 130,
      sortable: true,
      render: (inv) => <span className="dx-mono">{formatNaira(inv.total_amount)}</span>,
    },
    {
      key: "amount_paid",
      header: "Paid",
      align: "right",
      width: 130,
      sortable: true,
      render: (inv) => <span className="dx-mono">{formatNaira(inv.amount_paid)}</span>,
    },
    {
      key: "balance_due",
      header: "Outstanding",
      align: "right",
      width: 140,
      sortable: true,
      render: (inv) => (
        <span
          className="dx-mono font-semibold"
          style={{ color: inv.balance_due > 0 ? "var(--dx-danger)" : "var(--dx-success)" }}
        >
          {formatNaira(inv.balance_due)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 140,
      sortable: true,
      filter: { options: INVOICE_STATUS_OPTIONS },
      render: (inv) => <InvoiceStatusBadge status={inv.status} />,
    },
    {
      key: "actions",
      header: "",
      width: 170,
      align: "right",
      render: (inv) => (
        <span className="inline-flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {canReceivePayment(inv) ? (
            <DxButton size="sm" variant="accent-text" leftIcon={<CreditCard />} onClick={() => navigate(`${routes.billing}/${inv.id}?pay=1`)}>
              Record payment
            </DxButton>
          ) : null}
          <DxButton size="sm" variant="text" icon title="Open invoice" aria-label="Open invoice" onClick={() => openInvoice(inv)}>
            <ExternalLink />
          </DxButton>
        </span>
      ),
    },
  ];

  const hasLocalFilter = !!search || !!from || !!to;

  if (embedded) {
    if (visitId === undefined) {
      return (
        <div className="space-y-4">
          <DxMessage tone="warning">No visit selected.</DxMessage>
        </div>
      );
    }
    if (invoicesQuery.isLoading) {
      return (
        <div className="space-y-4">
          <div className="dx-skeleton h-48 w-full" />
        </div>
      );
    }
    if (invoicesQuery.isError) {
      return (
        <div className="space-y-4">
          <DxMessage
            tone="danger"
            title="Failed to load invoices."
            action={
              <DxButton size="sm" leftIcon={<RotateCcw />} onClick={() => invoicesQuery.refetch()}>
                Retry
              </DxButton>
            }
          >
            {apiErrorMessage(invoicesQuery.error)}
          </DxMessage>
        </div>
      );
    }
    if (rows.length === 0) {
      return (
        <div className="space-y-4">
          <DxMessage tone="info" title="No invoice for this visit">
            No invoice has been raised for this visit yet. Create one from the visit's charge sheet.
          </DxMessage>
        </div>
      );
    }
    if (rows.length === 1) {
      return (
        <div className="space-y-4">
          <BillingDetailPage embedded invoiceId={rows[0].id} />
        </div>
      );
    }
    const activeInvoiceId =
      embeddedInvoiceId != null && rows.some((r) => r.id === embeddedInvoiceId) ? embeddedInvoiceId : rows[0].id;
    return (
      <div className="space-y-4">
        <DxSelect
          aria-label="Select invoice for this visit"
          editorSize="sm"
          className="w-full sm:w-80"
          value={String(activeInvoiceId)}
          onChange={(e) => setEmbeddedInvoiceId(Number(e.target.value))}
          options={rows.map((inv) => ({
            value: String(inv.id),
            label: `${inv.invoice_no} · ${formatNaira(inv.balance_due)} due`,
          }))}
        />
        <BillingDetailPage embedded invoiceId={activeInvoiceId} />
      </div>
    );
  }

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Billing & Payment" }]}
        title="Billing & Payment"
        subtitle="Visit bills, HMO cover and patient payments across all service points."
        actions={
          <DxButton variant="primary" leftIcon={<Plus />} onClick={createModal.open}>
            Create invoice
          </DxButton>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DxKpi
          label="Invoices"
          value={summary ? summary.totalInvoices.toLocaleString() : "—"}
          sub={summary && summary.overdueCount > 0 ? `${summary.overdueCount} overdue` : "All billing records"}
          icon={Receipt}
          tone="accent"
          isLoading={summaryQuery.isLoading}
        />
        <DxKpi
          label="Outstanding"
          value={summary ? formatNaira(summary.totalOutstanding) : "—"}
          sub="Patient balances still owed"
          icon={Wallet}
          tone={summary && summary.totalOutstanding > 0 ? "danger" : "success"}
          isLoading={summaryQuery.isLoading}
        />
        <DxKpi
          label="Collected"
          value={summary ? formatNaira(summary.totalCollected) : "—"}
          sub="All payments received"
          icon={Banknote}
          tone="success"
          isLoading={summaryQuery.isLoading}
        />
        <DxKpi
          label="Paid today"
          value={invoicesQuery.isSuccess ? formatNaira(collectedToday) : "—"}
          sub="Invoices settled today on this page"
          icon={FileWarning}
          tone="info"
          isLoading={invoicesQuery.isLoading}
        />
      </div>

      {visitId !== undefined ? (
        <DxMessage
          tone="info"
          title={`Showing invoices for visit #${visitId}`}
          action={
            <DxButton size="sm" variant="text" leftIcon={<X />} onClick={clearVisitFilter}>
              Show all invoices
            </DxButton>
          }
        >
          {invoicesQuery.isSuccess && rows.length === 0
            ? "No invoice has been raised for this visit yet. Create one from the visit's charge sheet, or create an invoice here."
            : "Opened from the queue — only this visit's bill is listed."}
        </DxMessage>
      ) : null}

      <div>
        <DxToolbar attached>
          <DxSearchBox onSearch={setSearch} placeholder="Invoice no., patient or visit…" className="w-72" size="sm" />
          <DxToolbarSeparator />
          <DxSelect
            aria-label="Filter by status"
            editorSize="sm"
            className="w-44"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            options={[{ value: "", label: "All statuses" }, ...INVOICE_STATUS_OPTIONS]}
          />
          <DxToolbarSeparator />
          <DxToolbarLabel>
            <CalendarDays className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            From
          </DxToolbarLabel>
          <DxInput aria-label="From date" type="date" editorSize="sm" className="w-36" value={from} onChange={(e) => setFrom(e.target.value)} />
          <DxToolbarLabel>To</DxToolbarLabel>
          <DxInput aria-label="To date" type="date" editorSize="sm" className="w-36" value={to} onChange={(e) => setTo(e.target.value)} />
          {hasLocalFilter ? (
            <DxButton
              size="sm"
              variant="text"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
              disabled={!from && !to}
            >
              Clear dates
            </DxButton>
          ) : null}
          <DxToolbarSpacer />
          <DxButton size="sm" leftIcon={<RotateCcw />} isLoading={invoicesQuery.isFetching} onClick={() => invoicesQuery.refetch()}>
            Refresh
          </DxButton>
        </DxToolbar>
        <DxGrid
          attached
          filterRow
          columns={columns}
          data={rows}
          rowKey={(inv) => inv.id}
          isLoading={invoicesQuery.isLoading}
          error={invoicesQuery.isError ? apiErrorMessage(invoicesQuery.error, "Failed to load invoices.") : null}
          onRetry={() => invoicesQuery.refetch()}
          onRowClick={openInvoice}
          empty={{
            icon: Receipt,
            title: "No invoices found",
            description: hasLocalFilter
              ? "No invoices match the current search or date range on this page."
              : "Invoices appear here once a visit bill is finalised.",
            action: (
              <DxButton size="sm" variant="primary" leftIcon={<Plus />} onClick={createModal.open}>
                Create invoice
              </DxButton>
            ),
          }}
          footer={
            <DxPager
              page={page}
              totalPages={meta?.total_pages}
              hasNext={meta?.has_next}
              totalItems={typeof meta?.total === "number" ? meta.total : undefined}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          }
        />
      </div>

      <CreateInvoiceModal
        isOpen={createModal.isOpen}
        onClose={createModal.close}
        onCreated={(invoiceId) => navigate(`${routes.billing}/${invoiceId}`)}
      />
    </DxPage>
  );
}
