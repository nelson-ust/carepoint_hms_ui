import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { routes } from "@/config/routes";
import {
  AlertCircle,
  BadgeDollarSign,
  CheckCircle2,
  Minus,
  Package,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  DxPage,
  DxPageHeader,
  DxPanel,
  DxKpi,
  DxBadge,
  DxButton,
  DxInput,
  DxSelect,
  DxPopup,
  DxMessage,
  formatNaira,
} from "@/components/dx";
import { listStockItems, listStores } from "@/features/inventory/api/inventory.api";
import type { StockItem, Store } from "@/features/inventory/api/inventory.api";
import {
  createSale,
  getSalesSummary,
  SALE_PAYMENT_METHODS,
} from "../api/pharmacy.api";
import type { CreateSalePayload, Sale, SalesSummary } from "../api/pharmacy.api";
import { apiErrorMessage } from "@/lib/api/api-error";

type CartLine = {
  stock_item_id: number;
  item_name: string;
  unit_of_measure?: string;
  quantity: number;
  unit_price: number;
  max: number;
};

export function PharmacyPosPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState<string>("");
  const [items, setItems] = useState<StockItem[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [discount, setDiscount] = useState("");
  const [tax, setTax] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [note, setNote] = useState("");

  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Sale | null>(null);

  const searchRef = useRef<HTMLInputElement | null>(null);

  // ---- Data loading ----
  const loadStores = async () => {
    setLoadingStores(true);
    setError(null);
    try {
      const res = await listStores({ skip: 0, limit: 200 });
      setStores(res.items ?? []);
      if (!storeId && res.items && res.items.length > 0) {
        setStoreId(String(res.items[0].id));
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to load stores."));
    } finally {
      setLoadingStores(false);
    }
  };

  const loadItems = async (sid: string) => {
    if (!sid) {
      setItems([]);
      return;
    }
    setLoadingItems(true);
    try {
      const res = await listStockItems({ skip: 0, limit: 500, store_id: Number(sid) });
      setItems(res.items ?? []);
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to load stock for this store."));
    } finally {
      setLoadingItems(false);
    }
  };

  const loadSummary = async (sid: string) => {
    try {
      setSummary(await getSalesSummary(sid ? Number(sid) : undefined));
    } catch {
      /* summary is non-critical */
    }
  };

  useEffect(() => {
    loadStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Store changed: refresh its stock + today's figures, and drop the cart
    // (lines belong to a single store).
    setCart([]);
    loadItems(storeId);
    loadSummary(storeId);
  }, [storeId]);

  // ---- Catalog search ----
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = items.filter((it) => (it.quantity_on_hand ?? 0) > 0);
    const list = !q
      ? base
      : base.filter(
          (it) =>
            it.item_name?.toLowerCase().includes(q) ||
            it.sku?.toLowerCase().includes(q) ||
            it.drug?.name?.toLowerCase().includes(q),
        );
    return list.slice(0, 50);
  }, [items, search]);

  // ---- Cart operations ----
  const addToCart = (it: StockItem) => {
    const onHand = it.quantity_on_hand ?? 0;
    if (onHand <= 0) return;
    setCart((prev) => {
      const existing = prev.find((l) => l.stock_item_id === it.id);
      if (existing) {
        return prev.map((l) =>
          l.stock_item_id === it.id
            ? { ...l, quantity: Math.min(l.max, l.quantity + 1) }
            : l,
        );
      }
      return [
        ...prev,
        {
          stock_item_id: it.id,
          item_name: it.item_name,
          unit_of_measure: it.unit_of_measure,
          quantity: 1,
          unit_price: Number(it.unit_cost ?? 0),
          max: onHand,
        },
      ];
    });
  };

  const setLineQty = (id: number, qty: number) =>
    setCart((prev) =>
      prev.map((l) =>
        l.stock_item_id === id
          ? { ...l, quantity: Math.max(0, Math.min(l.max, qty)) }
          : l,
      ),
    );

  const stepQty = (id: number, delta: number) =>
    setCart((prev) =>
      prev.map((l) =>
        l.stock_item_id === id
          ? { ...l, quantity: Math.max(0, Math.min(l.max, l.quantity + delta)) }
          : l,
      ),
    );

  const setLinePrice = (id: number, price: number) =>
    setCart((prev) =>
      prev.map((l) => (l.stock_item_id === id ? { ...l, unit_price: Math.max(0, price) } : l)),
    );

  const removeLine = (id: number) =>
    setCart((prev) => prev.filter((l) => l.stock_item_id !== id));

  const clearCart = () => {
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setDiscount("");
    setTax("");
    setAmountPaid("");
    setNote("");
    setSaveError(null);
  };

  // ---- Totals ----
  const subtotal = useMemo(
    () => cart.reduce((sum, l) => sum + l.quantity * l.unit_price, 0),
    [cart],
  );
  const discountNum = Number(discount) || 0;
  const taxNum = Number(tax) || 0;
  const total = Math.max(0, subtotal - discountNum + taxNum);
  const paidNum = amountPaid === "" ? total : Number(amountPaid) || 0;
  const changeDue = Math.max(0, paidNum - total);
  const shortfall = Math.max(0, total - paidNum);
  const lineCount = cart.filter((l) => l.quantity > 0).length;

  // ---- Complete sale ----
  const canComplete = lineCount > 0 && total >= 0 && shortfall <= 0 && !!storeId;

  const handleComplete = async () => {
    setSaveError(null);
    const lines = cart.filter((l) => l.quantity > 0);
    if (lines.length === 0) {
      setSaveError("Add at least one item to the sale.");
      return;
    }
    if (shortfall > 0) {
      setSaveError(`Amount paid is short by ${formatNaira(shortfall)}.`);
      return;
    }
    const payload: CreateSalePayload = {
      store_id: Number(storeId),
      items: lines.map((l) => ({
        stock_item_id: l.stock_item_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
      })),
      customer_name: customerName.trim() || undefined,
      customer_phone: customerPhone.trim() || undefined,
      payment_method: paymentMethod,
      discount_amount: discountNum || undefined,
      tax_amount: taxNum || undefined,
      amount_paid: amountPaid === "" ? undefined : paidNum,
      note: note.trim() || undefined,
    };
    setSaving(true);
    try {
      const res = await createSale(payload);
      setReceipt(res.sale);
      clearCart();
      // Stock levels changed — refresh catalog + today's figures.
      loadItems(storeId);
      loadSummary(storeId);
    } catch (err) {
      setSaveError(apiErrorMessage(err, "Could not complete the sale. Please retry."));
    } finally {
      setSaving(false);
    }
  };

  const storeName = (id: number) => stores.find((s) => s.id === id)?.name ?? `Store #${id}`;

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Pharmacy" }, { label: "Point of Sale" }]}
        title="Point of Sale"
        subtitle="Ring up walk-in / over-the-counter sales straight from stock — no prescription required."
        actions={
          <>
            <Link to={routes.pharmacySales} className="dx-btn dx-btn-sm"><Receipt className="h-4 w-4" /> Sales</Link>
            <DxButton icon title="Refresh stock" onClick={() => loadItems(storeId)} isLoading={loadingItems}><RotateCcw /></DxButton>
          </>
        }
      />

      {summary ? (
        <div className="grid gap-4 md:grid-cols-3">
          <DxKpi icon={Receipt} label="Sales today" value={summary.sales_today} tone="accent" />
          <DxKpi icon={BadgeDollarSign} label="Revenue today" value={formatNaira(summary.revenue_today)} tone="success" />
          <DxKpi icon={Package} label="Items sold today" value={summary.items_sold_today} tone="neutral" />
        </div>
      ) : null}

      {error ? (
        <DxMessage tone="danger" action={<DxButton size="sm" onClick={loadStores}>Retry</DxButton>}>{error}</DxMessage>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* ---------------- Catalog + cart ---------------- */}
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-full sm:w-64">
              <DxSelect
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                aria-label="Store"
                disabled={loadingStores}
                placeholder={loadingStores ? "Loading stores…" : "Select store"}
                options={stores.map((s) => ({ value: String(s.id), label: `${s.name} (${s.code})` }))}
              />
            </div>
            <div className="w-full flex-1">
              <DxInput
                ref={searchRef}
                leftIcon={<Search className="h-3.5 w-3.5" />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search item by name, SKU or drug…"
              />
            </div>
          </div>

          {/* Catalog results */}
          <DxPanel flush>
            <div className="max-h-[320px] overflow-y-auto">
              {loadingItems ? (
                <div className="p-6 text-center text-[13px] text-[var(--dx-text-muted)]">Loading stock…</div>
              ) : results.length === 0 ? (
                <div className="p-6 text-center text-[13px] text-[var(--dx-text-muted)]">
                  {items.length === 0 ? "No stock in this store." : "No items match your search."}
                </div>
              ) : (
                <ul className="divide-y divide-[var(--dx-border)]">
                  {results.map((it) => {
                    const onHand = it.quantity_on_hand ?? 0;
                    return (
                      <li key={it.id}>
                        <button
                          type="button"
                          onClick={() => addToCart(it)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--dx-surface-sunken)]"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-semibold text-[var(--dx-text)]">{it.item_name}</div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              {it.sku ? <span className="dx-mono text-[11px] text-[var(--dx-text-muted)]">{it.sku}</span> : null}
                              <DxBadge tone={onHand <= (it.reorder_level ?? 0) ? "warning" : "neutral"} dot>
                                {onHand} {it.unit_of_measure ?? "in stock"}
                              </DxBadge>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="dx-mono text-[13px] font-semibold text-[var(--dx-text)]">{formatNaira(it.unit_cost)}</span>
                            <span className="flex h-7 w-7 items-center justify-center rounded bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]">
                              <Plus className="h-4 w-4" />
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </DxPanel>

          {/* Cart */}
          <DxPanel
            title={
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" /> Cart
                {lineCount > 0 ? <DxBadge tone="accent">{lineCount}</DxBadge> : null}
              </span>
            }
            actions={lineCount > 0 ? <DxButton size="sm" variant="outline-danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={clearCart}>Clear</DxButton> : undefined}
            flush
          >
            {cart.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-[var(--dx-text-muted)]">
                Tap items above to add them to the sale.
              </div>
            ) : (
              <div className="divide-y divide-[var(--dx-border)]">
                {cart.map((l) => (
                  <div key={l.stock_item_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-[var(--dx-text)]">{l.item_name}</div>
                      <div className="text-[11px] text-[var(--dx-text-faint)]">Max {l.max}{l.unit_of_measure ? ` ${l.unit_of_measure}` : ""}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <DxButton icon size="sm" title="Decrease" onClick={() => stepQty(l.stock_item_id, -1)}><Minus className="h-3.5 w-3.5" /></DxButton>
                      <input
                        type="number"
                        className="dx-editor h-8 w-16 text-center dx-mono"
                        value={l.quantity}
                        min={0}
                        max={l.max}
                        onChange={(e) => setLineQty(l.stock_item_id, Number(e.target.value))}
                        aria-label={`Quantity for ${l.item_name}`}
                      />
                      <DxButton icon size="sm" title="Increase" onClick={() => stepQty(l.stock_item_id, 1)}><Plus className="h-3.5 w-3.5" /></DxButton>
                    </div>
                    <div className="w-28">
                      <input
                        type="number"
                        step="any"
                        className="dx-editor h-8 w-full text-right dx-mono"
                        value={l.unit_price}
                        min={0}
                        onChange={(e) => setLinePrice(l.stock_item_id, Number(e.target.value))}
                        aria-label={`Unit price for ${l.item_name}`}
                      />
                    </div>
                    <div className="w-28 text-right dx-mono text-[13px] font-semibold text-[var(--dx-text)]">
                      {formatNaira(l.quantity * l.unit_price)}
                    </div>
                    <DxButton icon size="sm" variant="outline-danger" title="Remove" onClick={() => removeLine(l.stock_item_id)}>
                      <X className="h-3.5 w-3.5" />
                    </DxButton>
                  </div>
                ))}
              </div>
            )}
          </DxPanel>
        </div>

        {/* ---------------- Checkout ---------------- */}
        <div className="space-y-4">
          <DxPanel title={<span className="flex items-center gap-2"><UserRound className="h-4 w-4" /> Customer (optional)</span>}>
            <div className="grid gap-3">
              <DxInput label="Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Walk-in customer" />
              <DxInput label="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="080…" />
            </div>
          </DxPanel>

          <DxPanel title="Payment">
            <div className="space-y-3">
              <DxSelect
                label="Method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                options={SALE_PAYMENT_METHODS.map((m) => ({ value: m, label: m.replace(/_/g, " ") }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <DxInput label="Discount" type="number" step="any" mono value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0.00" />
                <DxInput label="Tax" type="number" step="any" mono value={tax} onChange={(e) => setTax(e.target.value)} placeholder="0.00" />
              </div>
              <DxInput
                label="Amount paid"
                type="number"
                step="any"
                mono
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder={total ? String(total.toFixed(2)) : "0.00"}
                hint="Leave blank to charge the exact total."
              />
              <DxInput label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            </div>

            <div className="mt-4 space-y-1.5 border-t border-[var(--dx-border)] pt-4 text-[13px]">
              <Row label="Subtotal" value={formatNaira(subtotal)} />
              {discountNum ? <Row label="Discount" value={`- ${formatNaira(discountNum)}`} /> : null}
              {taxNum ? <Row label="Tax" value={`+ ${formatNaira(taxNum)}`} /> : null}
              <div className="flex items-center justify-between border-t border-[var(--dx-border)] pt-2 text-[16px] font-bold text-[var(--dx-text)]">
                <span>Total</span>
                <span className="dx-mono">{formatNaira(total)}</span>
              </div>
              {shortfall > 0 ? (
                <Row label="Balance due" value={formatNaira(shortfall)} tone="danger" />
              ) : (
                <Row label="Change" value={formatNaira(changeDue)} tone="success" />
              )}
            </div>

            {saveError ? <DxMessage tone="danger" className="mt-3">{saveError}</DxMessage> : null}

            <DxButton
              variant="primary"
              className="mt-4 w-full"
              leftIcon={<CheckCircle2 className="h-4 w-4" />}
              onClick={handleComplete}
              isLoading={saving}
              disabled={!canComplete || saving}
            >
              Complete sale · {formatNaira(total)}
            </DxButton>
            {!canComplete && lineCount === 0 ? (
              <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-[var(--dx-text-faint)]">
                <AlertCircle className="h-3 w-3" /> Add items to begin
              </p>
            ) : null}
          </DxPanel>
        </div>
      </div>

      {/* ---------------- Receipt ---------------- */}
      <DxPopup
        isOpen={receipt !== null}
        onClose={() => setReceipt(null)}
        title="Sale completed"
        size="md"
        footer={<DxButton variant="primary" onClick={() => setReceipt(null)}>Done</DxButton>}
      >
        {receipt ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-[var(--dx-success-soft,var(--dx-surface-sunken))] p-4">
              <CheckCircle2 className="h-8 w-8 text-[var(--dx-success)]" />
              <div>
                <div className="dx-mono text-[15px] font-bold text-[var(--dx-text)]">{receipt.sale_no}</div>
                <div className="text-[12px] text-[var(--dx-text-muted)]">
                  {storeName(receipt.store_id)} · {receipt.payment_method.replace(/_/g, " ")}
                  {receipt.sold_at ? ` · ${new Date(receipt.sold_at).toLocaleString()}` : ""}
                </div>
              </div>
            </div>

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
              <Row label="Subtotal" value={formatNaira(receipt.subtotal)} />
              {receipt.discount_amount ? <Row label="Discount" value={`- ${formatNaira(receipt.discount_amount)}`} /> : null}
              {receipt.tax_amount ? <Row label="Tax" value={`+ ${formatNaira(receipt.tax_amount)}`} /> : null}
              <div className="flex items-center justify-between border-t border-[var(--dx-border)] pt-2 text-[15px] font-bold text-[var(--dx-text)]">
                <span>Total</span>
                <span className="dx-mono">{formatNaira(receipt.total_amount)}</span>
              </div>
              <Row label="Paid" value={formatNaira(receipt.amount_paid)} />
              <Row label="Change" value={formatNaira(receipt.change_due)} tone="success" />
            </div>

            <DxButton className="w-full" leftIcon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
              Print receipt
            </DxButton>
          </div>
        ) : null}
      </DxPopup>
    </DxPage>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
}) {
  const color =
    tone === "success"
      ? "text-[var(--dx-success)]"
      : tone === "danger"
        ? "text-[var(--dx-danger)]"
        : "text-[var(--dx-text-muted)]";
  return (
    <div className="flex items-center justify-between">
      <span className={color}>{label}</span>
      <span className={`dx-mono font-semibold ${tone ? color : "text-[var(--dx-text)]"}`}>{value}</span>
    </div>
  );
}
