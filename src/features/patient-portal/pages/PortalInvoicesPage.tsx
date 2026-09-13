import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Receipt, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  downloadPortalInvoice,
  getPortalInvoices,
  portalErrorMessage,
  type PortalInvoice,
} from "../api/portal.api";

const STATUS_META: Record<PortalInvoice["payment_status"], { label: string; variant: any }> = {
  PAID: { label: "Paid", variant: "soft-success" },
  PARTIALLY_PAID: { label: "Partially paid", variant: "soft-warning" },
  UNPAID: { label: "Unpaid", variant: "soft-danger" },
};

const money = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmt(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

/** Patient portal — invoices across every visit with PDF downloads. */
export function PortalInvoicesPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | PortalInvoice["payment_status"]>("");
  const [downloading, setDownloading] = useState<number | null>(null);

  const invoicesQuery = useQuery({
    queryKey: ["portal", "invoices"],
    queryFn: getPortalInvoices,
    refetchInterval: 60_000,
  });
  const invoices = invoicesQuery.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((i) => {
      if (statusFilter && i.payment_status !== statusFilter) return false;
      if (!q) return true;
      return `${i.billing_no ?? ""} ${i.invoice_no ?? ""} ${i.visit_number ?? ""} ${fmt(i.visit_date)}`
        .toLowerCase().includes(q);
    });
  }, [invoices, search, statusFilter]);

  const outstandingTotal = invoices.reduce((t, i) => t + Number(i.outstanding || 0), 0);

  const download = async (inv: PortalInvoice) => {
    setDownloading(inv.visit_id);
    try {
      await downloadPortalInvoice(inv.visit_id, inv.billing_no ?? String(inv.visit_id));
      toast.success("Invoice downloaded");
    } catch (err) {
      toast.error("Couldn't download", portalErrorMessage(err, "Please try again."));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-secondary-900">Invoices</h1>
          <p className="mt-1 text-sm text-secondary-500">
            Your bills across every visit — view, download and track payments.
          </p>
        </div>
        {outstandingTotal > 0 && (
          <div className="rounded-2xl bg-rose-50 px-4 py-2.5 text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">Outstanding</p>
            <p className="data-mono text-lg font-black text-rose-600">₦{money.format(outstandingTotal)}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[14rem]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice, visit or date…"
            className="input-field pl-10 w-full" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
          className="input-field w-44">
          <option value="">All statuses</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIALLY_PAID">Partially paid</option>
          <option value="PAID">Paid</option>
        </select>
      </div>

      {invoicesQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-3xl" />)}
        </div>
      ) : invoicesQuery.isError ? (
        <div className="rounded-3xl border border-rose-100 bg-rose-50 p-6 text-sm font-semibold text-rose-600">
          {portalErrorMessage(invoicesQuery.error, "We couldn't load your invoices — please retry.")}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-secondary-100 bg-white p-12 text-center">
          <Receipt className="mx-auto mb-3 h-10 w-10 text-secondary-200" />
          <p className="font-bold text-secondary-900">
            {invoices.length === 0 ? "No invoices yet" : "No matches"}
          </p>
          <p className="mt-1 text-sm text-secondary-400">
            {invoices.length === 0
              ? "Invoices appear here as soon as the hospital bills a visit."
              : "Adjust your search or filter to see more."}
          </p>
        </div>
      ) : (
        filtered.map((inv) => {
          const meta = STATUS_META[inv.payment_status];
          return (
            <div key={inv.visit_id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-secondary-100 bg-white p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="data-mono text-sm font-black text-secondary-900">
                    {inv.invoice_no || inv.billing_no || `Visit ${inv.visit_number ?? inv.visit_id}`}
                  </p>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-secondary-400">
                  {inv.visit_number ? `Visit ${inv.visit_number} · ` : ""}{fmt(inv.visit_date)}
                  {inv.payments_count > 0 ? ` · ${inv.payments_count} payment${inv.payments_count === 1 ? "" : "s"}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-5">
                <div className="text-right">
                  <p className="data-mono text-sm font-black text-secondary-900">₦{money.format(Number(inv.total))}</p>
                  {Number(inv.outstanding) > 0 ? (
                    <p className="data-mono text-xs font-bold text-rose-500">₦{money.format(Number(inv.outstanding))} due</p>
                  ) : (
                    <p className="text-xs font-bold text-emerald-600">Settled</p>
                  )}
                </div>
                <Button size="sm" variant="secondary" leftIcon={<Download className="h-3.5 w-3.5" />}
                  isLoading={downloading === inv.visit_id}
                  onClick={() => download(inv)}>
                  PDF
                </Button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
