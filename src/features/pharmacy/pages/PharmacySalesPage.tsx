import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { routes } from "@/config/routes";
import {
  BadgeDollarSign,
  Ban,
  Package,
  Receipt,
  RotateCcw,
  ShoppingCart,
} from "lucide-react";
import {
  DxPage,
  DxPageHeader,
  DxPanel,
  DxKpi,
  DxGrid,
  DxBadge,
  DxButton,
  DxInput,
  DxSelect,
  DxPopup,
  DxMessage,
  formatNaira,
  type DxGridColumn,
} from "@/components/dx";
import { listStores } from "@/features/inventory/api/inventory.api";
import type { Store } from "@/features/inventory/api/inventory.api";
import {
  getSalesSummary,
  listSales,
  voidSale,
} from "../api/pharmacy.api";
import type { Sale, SalesSummary } from "../api/pharmacy.api";
import { apiErrorMessage } from "@/lib/api/api-error";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PharmacySalesPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeFilter, setStoreFilter] = useState("");
  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [statusFilter, setStatusFilter] = useState("");

  const [sales, setSales] = useState<Sale[]>([]);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);

  const showFeedback = (tone: "success" | "error", message: string) => {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 3500);
  };

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [salesRes, storesRes, summaryRes] = await Promise.all([
        listSales({
          skip: 0,
          limit: 200,
          store_id: storeFilter ? Number(storeFilter) : undefined,
          status: statusFilter || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        }),
        stores.length === 0 ? listStores({ skip: 0, limit: 200 }) : Promise.resolve(null),
        getSalesSummary(storeFilter ? Number(storeFilter) : undefined).catch(() => null),
      ]);
      setSales(salesRes.items ?? []);
      if (storesRes) setStores(storesRes.items ?? []);
      if (summaryRes) setSummary(summaryRes);
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to load sales."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeFilter, statusFilter, dateFrom, dateTo]);

  const storeName = (id: number) => stores.find((s) => s.id === id)?.name ?? `Store #${id}`;

  const handleVoid = async () => {
    if (!voidTarget) return;
    setVoiding(true);
    try {
      const res = await voidSale(voidTarget.id, { reason: voidReason.trim() || undefined });
      setSales((prev) => prev.map((s) => (s.id === res.sale.id ? res.sale : s)));
      showFeedback("success", `Sale ${res.sale.sale_no} voided; stock restored.`);
      setVoidTarget(null);
      setVoidReason("");
      getSalesSummary(storeFilter ? Number(storeFilter) : undefined).then(setSummary).catch(() => undefined);
    } catch (err) {
      showFeedback("error", apiErrorMessage(err, "Failed to void the sale."));
    } finally {
      setVoiding(false);
    }
  };

  const grandTotal = useMemo(
    () => sales.filter((s) => s.status === "COMPLETED").reduce((sum, s) => sum + s.total_amount, 0),
    [sales],
  );

  const columns: DxGridColumn<Sale>[] = [
    {
      key: "sale_no",
      header: "Sale",
      render: (s) => (
        <div>
          <div className="dx-mono font-semibold text-[var(--dx-text)]">{s.sale_no}</div>
          <div className="text-[11px] text-[var(--dx-text-faint)]">
            {s.sold_at ? new Date(s.sold_at).toLocaleString() : "—"}
          </div>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (s) =>
        s.customer_name || s.customer_phone ? (
          <div>
            <div className="text-[var(--dx-text)]">{s.customer_name ?? "—"}</div>
            {s.customer_phone ? <div className="text-[11px] text-[var(--dx-text-muted)]">{s.customer_phone}</div> : null}
          </div>
        ) : (
          <span className="text-[var(--dx-text-faint)]">Walk-in</span>
        ),
    },
    {
      key: "store_id",
      header: "Store",
      accessor: (s) => storeName(s.store_id),
      render: (s) => (
        <span className="inline-flex items-center gap-1.5 text-[var(--dx-text-muted)]">
          <Package className="h-3 w-3" /> {storeName(s.store_id)}
        </span>
      ),
    },
    {
      key: "items",
      header: "Items",
      align: "right",
      accessor: (s) => s.items?.length ?? 0,
      render: (s) => <span className="dx-mono">{s.items?.length ?? 0}</span>,
    },
    {
      key: "payment_method",
      header: "Method",
      render: (s) => <DxBadge tone="neutral">{s.payment_method?.replace(/_/g, " ")}</DxBadge>,
    },
    {
      key: "total_amount",
      header: "Total",
      align: "right",
      accessor: (s) => s.total_amount,
      render: (s) => <span className="dx-mono font-semibold text-[var(--dx-text)]">{formatNaira(s.total_amount)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (s) => (
        <DxBadge tone={s.status === "VOIDED" ? "danger" : "success"} dot>
          {s.status}
        </DxBadge>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (s) => (
        <div className="flex items-center justify-end gap-1">
          <DxButton size="sm" leftIcon={<Receipt className="h-3.5 w-3.5" />} onClick={(e) => { e.stopPropagation(); setReceipt(s); }}>
            Receipt
          </DxButton>
          {s.status === "COMPLETED" ? (
            <DxButton
              icon
              size="sm"
              variant="outline-danger"
              title="Void sale"
              onClick={(e) => { e.stopPropagation(); setVoidTarget(s); setVoidReason(""); }}
            >
              <Ban className="h-3.5 w-3.5" />
            </DxButton>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Pharmacy" }, { label: "Sales" }]}
        title="Retail Sales"
        subtitle="Every over-the-counter sale, with receipts and voids that return stock automatically."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={load} isLoading={isLoading}><RotateCcw /></DxButton>
            <Link to={routes.pharmacyPos} className="dx-btn dx-btn-primary dx-btn-sm">
              <ShoppingCart className="h-4 w-4" /> New sale
            </Link>
          </>
        }
      />

      {feedback ? (
        <DxMessage tone={feedback.tone === "success" ? "success" : "danger"}>{feedback.message}</DxMessage>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <DxKpi icon={Receipt} label="Sales today" value={summary?.sales_today ?? "—"} tone="accent" />
        <DxKpi icon={BadgeDollarSign} label="Revenue today" value={formatNaira(summary?.revenue_today ?? 0)} tone="success" />
        <DxKpi icon={Package} label="Items sold today" value={summary?.items_sold_today ?? "—"} tone="neutral" />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="w-full md:w-52">
          <DxSelect
            label="Store"
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            options={[{ value: "", label: "All stores" }, ...stores.map((s) => ({ value: String(s.id), label: s.name }))]}
          />
        </div>
        <div className="w-full md:w-40">
          <DxInput label="From" type="date" mono value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="w-full md:w-40">
          <DxInput label="To" type="date" mono value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="w-full md:w-40">
          <DxSelect
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "", label: "All" },
              { value: "COMPLETED", label: "Completed" },
              { value: "VOIDED", label: "Voided" },
            ]}
          />
        </div>
        <div className="flex-1 text-right text-[13px] text-[var(--dx-text-muted)]">
          <span className="mr-2">Completed total in view:</span>
          <span className="dx-mono text-[15px] font-bold text-[var(--dx-text)]">{formatNaira(grandTotal)}</span>
        </div>
      </div>

      {error ? (
        <DxMessage tone="danger" action={<DxButton size="sm" onClick={load}>Retry</DxButton>}>{error}</DxMessage>
      ) : (
        <DxPanel flush>
          <DxGrid<Sale>
            columns={columns}
            data={sales}
            rowKey={(s) => s.id}
            isLoading={isLoading}
            onRowClick={(s) => setReceipt(s)}
            empty={{
              icon: Receipt,
              title: "No sales",
              description: "No sales match your filters for this period.",
              action: (
                <Link to={routes.pharmacyPos} className="dx-btn dx-btn-primary dx-btn-sm">
                  <ShoppingCart className="h-3.5 w-3.5" /> Record a sale
                </Link>
              ),
            }}
          />
        </DxPanel>
      )}

      {/* Receipt */}
      <DxPopup
        isOpen={receipt !== null}
        onClose={() => setReceipt(null)}
        title={receipt ? `Receipt · ${receipt.sale_no}` : "Receipt"}
        size="md"
        footer={<DxButton variant="primary" onClick={() => setReceipt(null)}>Close</DxButton>}
      >
        {receipt ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-[12px] text-[var(--dx-text-muted)]">
              <span>{storeName(receipt.store_id)} · {receipt.payment_method?.replace(/_/g, " ")}</span>
              <span>{receipt.sold_at ? new Date(receipt.sold_at).toLocaleString() : ""}</span>
            </div>
            {receipt.status === "VOIDED" ? (
              <DxMessage tone="danger">
                Voided{receipt.void_reason ? `: ${receipt.void_reason}` : ""}. Stock was returned.
              </DxMessage>
            ) : null}
            {receipt.customer_name || receipt.customer_phone ? (
              <div className="text-[13px] text-[var(--dx-text)]">
                {receipt.customer_name}{receipt.customer_phone ? ` · ${receipt.customer_phone}` : ""}
              </div>
            ) : null}
            <div className="overflow-hidden rounded-lg border border-[var(--dx-border)]">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[var(--dx-surface-sunken)] text-left text-[11px] uppercase tracking-wide text-[var(--dx-text-muted)]">
                    <th className="px-3 py-2 font-semibold">Item</th>
                    <th className="px-3 py-2 text-right font-semibold">Qty</th>
                    <th className="px-3 py-2 text-right font-semibold">Price</th>
                    <th className="px-3 py-2 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--dx-border)]">
                  {receipt.items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2 text-[var(--dx-text)]">{it.item_name}</td>
                      <td className="px-3 py-2 text-right dx-mono">{it.quantity}</td>
                      <td className="px-3 py-2 text-right dx-mono">{formatNaira(it.unit_price)}</td>
                      <td className="px-3 py-2 text-right dx-mono font-semibold">{formatNaira(it.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-1.5 text-[13px]">
              <SummaryRow label="Subtotal" value={formatNaira(receipt.subtotal)} />
              {receipt.discount_amount ? <SummaryRow label="Discount" value={`- ${formatNaira(receipt.discount_amount)}`} /> : null}
              {receipt.tax_amount ? <SummaryRow label="Tax" value={`+ ${formatNaira(receipt.tax_amount)}`} /> : null}
              <div className="flex items-center justify-between border-t border-[var(--dx-border)] pt-2 text-[15px] font-bold text-[var(--dx-text)]">
                <span>Total</span>
                <span className="dx-mono">{formatNaira(receipt.total_amount)}</span>
              </div>
              <SummaryRow label="Paid" value={formatNaira(receipt.amount_paid)} />
              <SummaryRow label="Change" value={formatNaira(receipt.change_due)} />
            </div>
          </div>
        ) : null}
      </DxPopup>

      {/* Void confirm */}
      <DxPopup
        isOpen={voidTarget !== null}
        onClose={() => !voiding && setVoidTarget(null)}
        title="Void sale"
        size="sm"
        locked={voiding}
        footer={
          <>
            <DxButton onClick={() => setVoidTarget(null)} disabled={voiding}>Cancel</DxButton>
            <DxButton variant="danger" onClick={handleVoid} isLoading={voiding} leftIcon={<Ban className="h-4 w-4" />}>
              Void &amp; restore stock
            </DxButton>
          </>
        }
      >
        <div className="space-y-3">
          <DxMessage tone="warning">
            {voidTarget ? (
              <>Voiding <strong>{voidTarget.sale_no}</strong> ({formatNaira(voidTarget.total_amount)}) returns its items to stock. This cannot be undone.</>
            ) : null}
          </DxMessage>
          <DxInput
            label="Reason (optional)"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="e.g. customer changed mind, wrong item"
          />
        </div>
      </DxPopup>
    </DxPage>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--dx-text-muted)]">{label}</span>
      <span className="dx-mono font-semibold text-[var(--dx-text)]">{value}</span>
    </div>
  );
}
