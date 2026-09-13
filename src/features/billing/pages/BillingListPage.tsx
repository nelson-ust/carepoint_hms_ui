import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Banknote, FileWarning, Plus, Receipt, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { SearchInput } from "@/components/forms/SearchInput";
import { MetricCard } from "@/components/charts/MetricCard";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { Pagination } from "@/components/data-table/Pagination";
import { useDisclosure } from "@/hooks/useDisclosure";
import { routes } from "@/config/routes";
import { formatMoney, INVOICE_STATUSES, type Invoice } from "../api/billing.api";
import { useBillingSummary, useInvoices } from "../hooks/use-billing";
import { InvoiceStatusBadge } from "../components/InvoiceStatusBadge";
import { CreateInvoiceModal } from "../components/CreateInvoiceModal";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  ...INVOICE_STATUSES.map((status) => ({
    value: status,
    label: status.replace(/_/g, " "),
  })),
];

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function BillingListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const createModal = useDisclosure();

  const filters = useMemo(
    () => ({ skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE, status: status || undefined }),
    [page, status],
  );

  const invoicesQuery = useInvoices(filters);
  const summaryQuery = useBillingSummary();

  const rows = useMemo(() => {
    const items = invoicesQuery.data?.items ?? [];
    if (!search) return items;
    const term = search.toLowerCase();
    return items.filter(
      (inv) =>
        inv.invoice_no.toLowerCase().includes(term) ||
        String(inv.patient_id).includes(term),
    );
  }, [invoicesQuery.data?.items, search]);

  const meta = invoicesQuery.data?.meta;
  const summary = summaryQuery.data;

  const columns: DataTableColumn<Invoice>[] = [
    {
      key: "invoice_no",
      header: "Invoice",
      render: (inv) => (
        <div>
          <p className="data-mono text-sm font-bold text-secondary-900">{inv.invoice_no}</p>
          <p className="mt-0.5 text-xs text-secondary-400">{formatDate(inv.invoice_date)}</p>
        </div>
      ),
    },
    {
      key: "patient_id",
      header: "Patient",
      render: (inv) => (
        <div>
          <p className="text-sm font-bold text-secondary-900">Patient #{inv.patient_id}</p>
          {inv.visit_id ? (
            <p className="mt-0.5 text-xs text-secondary-400">Visit #{inv.visit_id}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "due_date",
      header: "Due",
      render: (inv) => <span className="text-sm text-secondary-600">{formatDate(inv.due_date)}</span>,
    },
    {
      key: "total_amount",
      header: "Total",
      align: "right",
      render: (inv) => (
        <span className="data-mono text-sm font-bold text-secondary-900">
          {formatMoney(inv.total_amount)}
        </span>
      ),
    },
    {
      key: "balance_due",
      header: "Balance",
      align: "right",
      render: (inv) => (
        <span
          className={
            inv.balance_due > 0
              ? "data-mono text-sm font-bold text-rose-500"
              : "data-mono text-sm font-bold text-emerald-500"
          }
        >
          {formatMoney(inv.balance_due)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (inv) => <InvoiceStatusBadge status={inv.status} />,
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Patient Billing"
        description="Manage invoices, billing cycles, and payment charges for all clinical services."
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={createModal.open}>
            Create Invoice
          </Button>
        }
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Invoices"
          value={summary ? summary.totalInvoices.toLocaleString() : "—"}
          icon={Receipt}
          tone="primary"
          isLoading={summaryQuery.isLoading}
        />
        <MetricCard
          label="Total Collected"
          value={summary ? formatMoney(summary.totalCollected) : "—"}
          icon={Banknote}
          tone="cyan"
          isLoading={summaryQuery.isLoading}
        />
        <MetricCard
          label="Outstanding Balance"
          value={summary ? formatMoney(summary.totalOutstanding) : "—"}
          icon={Wallet}
          tone="rose"
          isLoading={summaryQuery.isLoading}
        />
        <MetricCard
          label="Overdue Invoices"
          value={summary ? summary.overdueCount.toLocaleString() : "—"}
          icon={FileWarning}
          tone="amber"
          isLoading={summaryQuery.isLoading}
        />
      </div>

      <Card padding="none">
        <div className="flex flex-wrap items-center gap-3 px-6 py-4">
          <SearchInput
            onSearch={setSearch}
            placeholder="Search invoice no. or patient…"
            className="w-72"
          />
          <Select
            aria-label="Filter by status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="w-44 py-2.5"
          />
        </div>
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(inv) => inv.id}
          isLoading={invoicesQuery.isLoading}
          error={invoicesQuery.isError ? "Failed to load invoices." : null}
          onRetry={() => invoicesQuery.refetch()}
          onRowClick={(inv) => navigate(`${routes.billing}/${inv.id}`)}
          empty={{
            icon: Receipt,
            title: "No invoices found",
            description: search
              ? "No invoices match your search on this page."
              : "Invoices will appear here once billings are issued.",
            action: (
              <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={createModal.open}>
                Create Invoice
              </Button>
            ),
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
      </Card>

      <CreateInvoiceModal
        isOpen={createModal.isOpen}
        onClose={createModal.close}
        onCreated={(invoiceId) => navigate(`${routes.billing}/${invoiceId}`)}
      />
    </div>
  );
}
