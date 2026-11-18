import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, RotateCcw, Glasses, Search, UserRound, Receipt, Banknote, Package, X,
} from "lucide-react";
import {
  DxBadge, DxButton, DxGrid, DxKpi, DxPage, DxPageHeader, DxPageLoading, DxPanel,
  DxPopup, DxInput, DxSelect, DxTextarea, DxMessage, apiErrorMessage, type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { searchPatients } from "@/features/patients/api/patients.api";
import { listStores, listStockItems } from "@/features/inventory/api/inventory.api";
import type { Store, StockItem } from "@/features/inventory/api/inventory.api";
import {
  eyeApi, OPTICAL_ITEM_TYPES,
  type OpticalOrder, type OpticalItemType, type OpticalProduct,
} from "../api/eye.api";

const naira = (n?: string | number | null) => `₦ ${Number(n ?? 0).toLocaleString()}`;

const STATUS_FLOW: Record<string, string | null> = {
  PENDING: "ORDERED", ORDERED: "READY", READY: "COLLECTED", COLLECTED: null, CANCELLED: null,
};
const statusTone = (s: string): "accent" | "info" | "warning" | "success" | "neutral" =>
  s === "PENDING" ? "warning" : s === "ORDERED" ? "accent" : s === "READY" ? "info" : s === "COLLECTED" ? "success" : "neutral";

type DraftLine = { item_type: OpticalItemType; optical_product_id: number | null; stock_item_id: number | null; item_name: string; quantity: string; unit_price: string };

function PatientPicker({ value, onPick }: { value: { id: number; name: string } | null; onPick: (p: { id: number; name: string } | null) => void }) {
  const [term, setTerm] = useState("");
  const q = useQuery({ queryKey: ["patient-search", term], queryFn: () => searchPatients(term, 8), enabled: term.trim().length >= 2 });
  const items = (q.data?.items ?? []) as Array<{ id: number; first_name: string; last_name: string; hospital_number?: string }>;
  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] px-3 py-2">
        <span className="flex items-center gap-2 text-[13px] font-semibold"><UserRound className="h-4 w-4 text-[var(--dx-accent)]" />{value.name}</span>
        <DxButton size="sm" variant="text" onClick={() => onPick(null)}>Change</DxButton>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <DxInput leftIcon={<Search className="h-4 w-4 text-[var(--dx-text-faint)]" />} placeholder="Search patient by name, hospital no. or phone" value={term} onChange={(e) => setTerm(e.target.value)} />
      {term.trim().length >= 2 ? (
        <div className="max-h-48 overflow-auto rounded-md border border-[var(--dx-border)]">
          {q.isLoading ? <p className="px-3 py-3 text-[12.5px] text-[var(--dx-text-muted)]">Searching...</p>
            : items.length === 0 ? <p className="px-3 py-3 text-[12.5px] text-[var(--dx-text-muted)]">No patients found.</p>
            : items.map((p) => (
              <button key={p.id} type="button" onClick={() => onPick({ id: p.id, name: `${p.first_name} ${p.last_name}` })}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-[var(--dx-surface-hover)]">
                <span className="font-medium">{p.first_name} {p.last_name}</span>
                <span className="text-[11.5px] text-[var(--dx-text-muted)]">{p.hospital_number}</span>
              </button>
            ))}
        </div>
      ) : null}
    </div>
  );
}

export function OpticalOrdersPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<OpticalOrder | null>(null);

  // create-order form
  const [patient, setPatient] = useState<{ id: number; name: string } | null>(null);
  const [storeId, setStoreId] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [discount, setDiscount] = useState("");
  const [note, setNote] = useState("");

  const ordersQ = useQuery({
    queryKey: ["eye", "orders", statusFilter],
    queryFn: () => eyeApi.listOrders({ status: statusFilter || undefined, limit: 200 }),
  });
  const storesQ = useQuery({ queryKey: ["inventory", "stores", "optical"], queryFn: () => listStores({ limit: 200 }) });
  const stockQ = useQuery({
    queryKey: ["inventory", "stock", "optical", storeId],
    queryFn: () => listStockItems({ store_id: Number(storeId), limit: 500 }),
    enabled: !!storeId,
  });
  const productsQ = useQuery({
    queryKey: ["eye", "optical-products", "active"],
    queryFn: () => eyeApi.listProducts({ active_only: true, limit: 500 }),
  });

  const orders = useMemo(() => ordersQ.data?.items ?? [], [ordersQ.data]);
  const stores: Store[] = storesQ.data?.items ?? [];
  const stock: StockItem[] = stockQ.data?.items ?? [];
  const products: OpticalProduct[] = useMemo(() => productsQ.data?.items ?? [], [productsQ.data]);

  const kpis = useMemo(() => ({
    open: orders.filter((o) => ["PENDING", "ORDERED", "READY"].includes(o.status)).length,
    ready: orders.filter((o) => o.status === "READY").length,
    collected: orders.filter((o) => o.status === "COLLECTED").length,
  }), [orders]);

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0),
    [lines],
  );
  const total = Math.max(0, subtotal - (Number(discount) || 0));

  const resetForm = () => { setPatient(null); setStoreId(""); setLines([]); setDiscount(""); setNote(""); };

  const addLine = (l: DraftLine) => setLines((prev) => [...prev, l]);
  const addStockLine = (itemId: string) => {
    const it = stock.find((s) => String(s.id) === itemId);
    if (!it) return;
    addLine({ item_type: "FRAME", optical_product_id: null, stock_item_id: it.id, item_name: it.item_name, quantity: "1", unit_price: String(it.unit_cost ?? 0) });
  };
  const addProductLine = (pid: string) => {
    const it = products.find((p) => String(p.id) === pid);
    if (!it) return;
    const t: OpticalItemType = it.category === "FRAME" ? "FRAME" : it.category === "LENS" ? "LENS" : "OTHER";
    addLine({ item_type: t, optical_product_id: it.id, stock_item_id: null, item_name: it.name, quantity: "1", unit_price: String(it.sell_price ?? 0) });
  };
  const updateLine = (i: number, patch: Partial<DraftLine>) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  const create = useMutation({
    mutationFn: () => eyeApi.createOrder({
      patient_id: patient!.id,
      discount_amount: discount ? Number(discount) : 0,
      note: note || null,
      items: lines.map((l) => ({
        item_type: l.item_type, optical_product_id: l.optical_product_id, stock_item_id: l.stock_item_id,
        item_name: l.item_name, quantity: Number(l.quantity) || 1, unit_price: Number(l.unit_price) || 0,
      })),
    }),
    onSuccess: (o) => { toast.success(`Order ${o.order_no} created.`); qc.invalidateQueries({ queryKey: ["eye", "orders"] }); setOpen(false); resetForm(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const advance = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => eyeApi.setOrderStatus(id, status),
    onSuccess: (o) => { toast.success(`Order marked ${o.status}.`); qc.invalidateQueries({ queryKey: ["eye", "orders"] }); setDetail(o); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const bill = useMutation({
    mutationFn: (id: number) => eyeApi.billOrder(id),
    onSuccess: (res) => { toast.success(res.message || "Order billed."); qc.invalidateQueries({ queryKey: ["eye", "orders"] }); setDetail(res.data.order); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const columns: DxGridColumn<OpticalOrder>[] = [
    { key: "order_no", header: "Order", render: (o) => (
      <div><div className="dx-mono font-semibold text-[var(--dx-text)]">{o.order_no}</div>
        <div className="text-[11px] text-[var(--dx-text-faint)]">{o.created_at ? new Date(o.created_at).toLocaleDateString() : ""}</div></div>
    ) },
    { key: "patient", header: "Patient", render: (o) => (
      <div className="min-w-0"><div className="truncate font-semibold">{o.patient?.name}</div>
        <div className="text-[11.5px] text-[var(--dx-text-muted)]">{o.patient?.hospital_number}</div></div>
    ) },
    { key: "items", header: "Items", align: "right", render: (o) => o.items?.length ?? 0 },
    { key: "total_amount", header: "Total", align: "right", render: (o) => <span className="dx-mono font-semibold">{naira(o.total_amount)}</span> },
    { key: "status", header: "Status", render: (o) => (
      <span className="inline-flex items-center gap-1.5">
        <DxBadge tone={statusTone(o.status)} dot>{o.status}</DxBadge>
        {o.is_billed ? <DxBadge tone="info">Billed</DxBadge> : null}
      </span>
    ) },
    { key: "actions", header: "", align: "right", render: (o) => (
      <DxButton size="sm" variant="text" onClick={() => setDetail(o)}>Open</DxButton>
    ) },
  ];

  if (ordersQ.isLoading) return <DxPageLoading label="Loading optical orders..." />;

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Eye Clinic" }, { label: "Optical Dispensing" }]}
        title="Optical Dispensing"
        subtitle="Frames, lenses and coatings dispensed to patients — from order through collection and billing."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={() => ordersQ.refetch()} isLoading={ordersQ.isFetching}><RotateCcw /></DxButton>
            <DxButton variant="primary" onClick={() => setOpen(true)}><Plus /> New order</DxButton>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <DxKpi label="Open orders" value={kpis.open} icon={Glasses} tone="accent" sub="in progress" />
        <DxKpi label="Ready for collection" value={kpis.ready} icon={Package} tone="info" />
        <DxKpi label="Collected" value={kpis.collected} icon={Receipt} tone="success" />
      </div>

      <div className="w-full md:w-56">
        <DxSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status"
          options={[{ value: "", label: "All statuses" }, ...["PENDING", "ORDERED", "READY", "COLLECTED", "CANCELLED"].map((s) => ({ value: s, label: s }))]} />
      </div>

      <DxPanel title="Dispensing orders" icon={<Glasses />} flush>
        <DxGrid<OpticalOrder>
          borderless columns={columns} data={orders} rowKey={(o) => o.id} onRowClick={(o) => setDetail(o)}
          empty={{ icon: Glasses, title: "No optical orders", description: "Create a dispensing order to get started." }}
        />
      </DxPanel>

      {/* Create order */}
      <DxPopup
        isOpen={open}
        onClose={() => { setOpen(false); resetForm(); }}
        title="New optical order"
        size="lg"
        footer={
          <>
            <DxButton variant="text" onClick={() => { setOpen(false); resetForm(); }}>Cancel</DxButton>
            <DxButton variant="primary" disabled={!patient || lines.length === 0} isLoading={create.isPending} onClick={() => create.mutate()}>
              Create order · {naira(total)}
            </DxButton>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--dx-text-muted)]">Patient</label>
            <PatientPicker value={patient} onPick={setPatient} />
          </div>

          <div>
            <DxSelect label="Add from optical inventory" value="" onChange={(e) => addProductLine(e.target.value)}
              placeholder={products.length ? "Pick a frame/lens from clinic stock…" : "No optical products yet — add them under Optical Inventory"}
              disabled={!products.length}
              options={products.map((pr) => ({ value: String(pr.id), label: `${pr.name}${pr.brand ? ` — ${pr.brand}` : ""} · ${naira(pr.sell_price)} (${Number(pr.quantity_on_hand)} in stock)` }))} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DxSelect label="Or add from shared inventory — store" value={storeId} onChange={(e) => setStoreId(e.target.value)}
              placeholder="Pick a store (optional)"
              options={[{ value: "", label: "— No store —" }, ...stores.map((s) => ({ value: String(s.id), label: s.name }))]} />
            <DxSelect label="Stock item" value="" onChange={(e) => addStockLine(e.target.value)} disabled={!storeId}
              placeholder={storeId ? "Pick to add a frame/lens…" : "Select a store first"}
              options={stock.map((s) => ({ value: String(s.id), label: `${s.item_name} — ${naira(s.unit_cost)} (${s.quantity_on_hand} in stock)` }))} />
          </div>

          <div className="rounded-md border border-[var(--dx-border)]">
            <div className="flex items-center justify-between border-b border-[var(--dx-border)] px-3 py-2">
              <span className="text-[12px] font-semibold text-[var(--dx-text-muted)]">Items</span>
              <DxButton size="sm" variant="text" onClick={() => addLine({ item_type: "LENS", optical_product_id: null, stock_item_id: null, item_name: "", quantity: "1", unit_price: "" })}>
                <Plus className="h-3.5 w-3.5" /> Add line
              </DxButton>
            </div>
            {lines.length === 0 ? (
              <p className="px-3 py-4 text-center text-[12.5px] text-[var(--dx-text-muted)]">Add a frame, lens or service — from stock above or a custom line.</p>
            ) : (
              <div className="divide-y divide-[var(--dx-border)]">
                {lines.map((l, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <select className="dx-editor h-8 w-28" value={l.item_type} onChange={(e) => updateLine(i, { item_type: e.target.value as OpticalItemType })} aria-label="Type">
                      {OPTICAL_ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input className="dx-editor h-8 min-w-0 flex-1" placeholder="Item name" value={l.item_name} onChange={(e) => updateLine(i, { item_name: e.target.value })} aria-label="Item name" />
                    <input className="dx-editor h-8 w-16 text-center dx-mono" type="number" min={0} value={l.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} aria-label="Qty" />
                    <input className="dx-editor h-8 w-24 text-right dx-mono" type="number" step="any" min={0} placeholder="Price" value={l.unit_price} onChange={(e) => updateLine(i, { unit_price: e.target.value })} aria-label="Price" />
                    {l.optical_product_id ? <DxBadge tone="accent" dot>inventory</DxBadge> : l.stock_item_id ? <DxBadge tone="neutral" dot>stock</DxBadge> : null}
                    <DxButton icon size="sm" variant="outline-danger" title="Remove" onClick={() => removeLine(i)}><X className="h-3.5 w-3.5" /></DxButton>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DxInput label="Discount (₦)" type="number" step="any" mono value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0.00" />
            <div className="flex items-end justify-end">
              <div className="text-right">
                <div className="text-[11px] text-[var(--dx-text-muted)]">Subtotal {naira(subtotal)}</div>
                <div className="text-[18px] font-bold text-[var(--dx-text)]">Total {naira(total)}</div>
              </div>
            </div>
          </div>
          <DxTextarea label="Note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Frame reserved; ready in 3 days" />
        </div>
      </DxPopup>

      {/* Order detail */}
      <DxPopup
        isOpen={detail !== null}
        onClose={() => setDetail(null)}
        title={detail ? `Order ${detail.order_no}` : "Order"}
        size="md"
        footer={<DxButton variant="text" onClick={() => setDetail(null)}>Close</DxButton>}
      >
        {detail ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-[var(--dx-text)]">{detail.patient?.name}</div>
                <div className="text-[12px] text-[var(--dx-text-muted)]">{detail.patient?.hospital_number}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <DxBadge tone={statusTone(detail.status)} dot>{detail.status}</DxBadge>
                {detail.is_billed ? <DxBadge tone="info">Billed</DxBadge> : null}
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
                  {detail.items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2"><span className="text-[11px] text-[var(--dx-text-faint)]">{it.item_type}</span> · {it.item_name}</td>
                      <td className="px-3 py-2 text-right dx-mono">{Number(it.quantity)}</td>
                      <td className="px-3 py-2 text-right dx-mono">{naira(it.unit_price)}</td>
                      <td className="px-3 py-2 text-right dx-mono font-semibold">{naira(it.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1 text-[13px]">
              <div className="flex justify-between text-[var(--dx-text-muted)]"><span>Subtotal</span><span className="dx-mono">{naira(detail.subtotal)}</span></div>
              {Number(detail.discount_amount) ? <div className="flex justify-between text-[var(--dx-text-muted)]"><span>Discount</span><span className="dx-mono">- {naira(detail.discount_amount)}</span></div> : null}
              <div className="flex justify-between border-t border-[var(--dx-border)] pt-1.5 text-[15px] font-bold text-[var(--dx-text)]"><span>Total</span><span className="dx-mono">{naira(detail.total_amount)}</span></div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--dx-border)] pt-3">
              {STATUS_FLOW[detail.status] ? (
                <DxButton variant="primary" isLoading={advance.isPending} onClick={() => advance.mutate({ id: detail.id, status: STATUS_FLOW[detail.status]! })}>
                  Mark {STATUS_FLOW[detail.status]}
                </DxButton>
              ) : null}
              {detail.status !== "CANCELLED" && detail.status !== "COLLECTED" ? (
                <DxButton variant="outline-danger" onClick={() => advance.mutate({ id: detail.id, status: "CANCELLED" })}>Cancel order</DxButton>
              ) : null}
              <div className="flex-1" />
              {!detail.is_billed ? (
                <DxButton leftIcon={<Banknote className="h-4 w-4" />} isLoading={bill.isPending}
                  title={detail.visit_id ? "Bill to the visit charge sheet" : "Link to a visit to enable billing"}
                  onClick={() => bill.mutate(detail.id)}>
                  Bill order
                </DxButton>
              ) : null}
            </div>
            {!detail.visit_id ? <DxMessage tone="info">Link this order to a visit to post its charges to billing.</DxMessage> : null}
          </div>
        ) : null}
      </DxPopup>
    </DxPage>
  );
}
