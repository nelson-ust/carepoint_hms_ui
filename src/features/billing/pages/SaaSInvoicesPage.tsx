import { CreditCard, Download, FileText, RefreshCw } from "lucide-react";
import {
  DxButton,
  DxGrid,
  DxKpi,
  DxPage,
  DxPageHeader,
  DxPanel,
  formatNaira,
  formatDate,
  type DxGridColumn,
} from "@/components/dx";
import { InvoiceStatusBadge } from "../components/InvoiceStatusBadge";
import { useMySaaSInvoices } from "../hooks/use-saas-billing";
import type { SaaSInvoice } from "../api/saas-billing.api";

export function SaaSInvoicesPage() {
  const { data, isLoading, error, refetch } = useMySaaSInvoices();
  const invoices = data?.items || [];

  const balanceDue = invoices.reduce((sum, inv) => {
    const s = (inv.status || "").toUpperCase();
    if (s === "PAID" || s === "CANCELLED") return sum;
    return sum + Math.max(0, (inv.total_amount || 0) - (inv.amount_paid || 0));
  }, 0);

  const columns: DxGridColumn<SaaSInvoice>[] = [
    {
      key: "invoice_no",
      header: "Invoice",
      minWidth: 200,
      render: (inv) => (
        <div className="flex items-center gap-2.5">
          <span className="h-8 w-8 rounded-[var(--dx-radius)] bg-[var(--dx-surface-alt)] border border-[var(--dx-border)] flex items-center justify-center text-[var(--dx-text-muted)] shrink-0">
            <FileText className="h-4 w-4" />
          </span>
          <div>
            <p className="font-medium text-[var(--dx-text)]">{inv.invoice_no}</p>
            <p className="text-[11px] text-[var(--dx-text-muted)]">Due {formatDate(inv.due_date)}</p>
          </div>
        </div>
      ),
    },
    {
      key: "invoice_date",
      header: "Date",
      width: 130,
      accessor: (inv) => inv.invoice_date,
      render: (inv) => <span className="text-[var(--dx-text)]">{formatDate(inv.invoice_date)}</span>,
    },
    {
      key: "total_amount",
      header: "Amount",
      width: 160,
      align: "right",
      accessor: (inv) => inv.total_amount,
      render: (inv) => (
        <div className="text-right">
          <p className="font-mono font-medium text-[var(--dx-text)]">{formatNaira(inv.total_amount)}</p>
          {inv.amount_paid > 0 && (
            <p className="text-[11px] text-[var(--dx-success)]">Paid {formatNaira(inv.amount_paid)}</p>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 140,
      accessor: (inv) => inv.status,
      render: (inv) => <InvoiceStatusBadge status={inv.status} />,
    },
    {
      key: "actions",
      header: "Action",
      align: "right",
      width: 110,
      render: () => (
        <DxButton size="sm" variant="text" leftIcon={<Download className="h-3.5 w-3.5" />}>
          Download
        </DxButton>
      ),
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Billing" }, { label: "Subscription" }]}
        title="Subscription billing"
        subtitle="Manage your hospital's platform subscription, view invoices, and track payments."
        actions={
          <>
            <DxButton leftIcon={<Download className="h-4 w-4" />}>Export history</DxButton>
            <DxButton variant="primary" leftIcon={<CreditCard className="h-4 w-4" />}>
              Pay balance
            </DxButton>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <DxKpi label="Current plan" value="Enterprise Pro" sub="Active" icon={CreditCard} tone="accent" />
        <DxKpi
          label="Balance due"
          value={formatNaira(balanceDue)}
          icon={FileText}
          tone={balanceDue > 0 ? "danger" : "success"}
          isLoading={isLoading}
        />
        <DxKpi label="Invoices" value={invoices.length} icon={FileText} tone="info" isLoading={isLoading} />
      </div>

      <DxPanel
        title="Invoice history"
        icon={<FileText className="h-4 w-4" />}
        flush
        actions={
          <DxButton
            size="sm"
            variant="text"
            leftIcon={<RefreshCw className={isLoading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />}
            onClick={() => refetch()}
          >
            Refresh
          </DxButton>
        }
      >
        <DxGrid
          borderless
          columns={columns}
          data={invoices}
          rowKey={(inv) => inv.id}
          isLoading={isLoading}
          error={error ? "Could not load invoices." : null}
          onRetry={() => refetch()}
          empty={{ icon: FileText, title: "No invoices", description: "No invoice history found yet." }}
        />
      </DxPanel>
    </DxPage>
  );
}
