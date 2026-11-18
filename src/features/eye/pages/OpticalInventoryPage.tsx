import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, RotateCcw, Boxes, Search, Package, AlertTriangle, PackagePlus, X, Pencil,
} from "lucide-react";
import {
  DxBadge, DxButton, DxGrid, DxKpi, DxPage, DxPageHeader, DxPageLoading, DxPanel,
  DxPopup, DxInput, DxSelect, DxTextarea, DxCheckbox, apiErrorMessage, type DxGridColumn,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  eyeApi, OPTICAL_CATEGORIES,
  type OpticalProduct, type OpticalProductCategory,
} from "../api/eye.api";

const naira = (n?: string | number | null) => `₦ ${Number(n ?? 0).toLocaleString()}`;
const CATEGORY_LABEL: Record<OpticalProductCategory, string> = {
  FRAME: "Frame", LENS: "Lens", CONTACT_LENS: "Contact lens",
  SOLUTION: "Solution", ACCESSORY: "Accessory", OTHER: "Other",
};
const catTone = (c: string): "accent" | "info" | "success" | "warning" | "neutral" =>
  c === "FRAME" ? "accent" : c === "LENS" ? "info" : c === "CONTACT_LENS" ? "success" : "neutral";

type FormState = {
  id?: number; category: OpticalProductCategory; name: string; brand: string; sku: string;
  spec: string; unit_cost: string; sell_price: string; quantity_on_hand: string;
  reorder_level: string; is_active: boolean; note: string;
};
const EMPTY: FormState = {
  category: "FRAME", name: "", brand: "", sku: "", spec: "", unit_cost: "",
  sell_price: "", quantity_on_hand: "", reorder_level: "", is_active: true, note: "",
};

export function OpticalInventoryPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [receive, setReceive] = useState<OpticalProduct | null>(null);
  const [receiveQty, setReceiveQty] = useState("");
  const [receiveNote, setReceiveNote] = useState("");

  const productsQ = useQuery({
    queryKey: ["eye", "optical-products", search, category, lowOnly],
    queryFn: () => eyeApi.listProducts({
      search: search || undefined, category: category || undefined,
      low_stock: lowOnly || undefined, limit: 500,
    }),
  });
  const products = useMemo(() => productsQ.data?.items ?? [], [productsQ.data]);

  const kpis = useMemo(() => {
    const lowStock = products.filter((p) => p.is_low_stock).length;
    const value = products.reduce((s, p) => s + Number(p.quantity_on_hand || 0) * Number(p.sell_price || 0), 0);
    const units = products.reduce((s, p) => s + Number(p.quantity_on_hand || 0), 0);
    return { total: products.length, lowStock, value, units };
  }, [products]);

  const save = useMutation({
    mutationFn: (f: FormState) => {
      const body = {
        category: f.category, name: f.name.trim(), brand: f.brand || null, sku: f.sku || null,
        spec: f.spec || null,
        unit_cost: f.unit_cost === "" ? null : Number(f.unit_cost),
        sell_price: Number(f.sell_price || 0),
        reorder_level: f.reorder_level === "" ? null : Number(f.reorder_level),
        is_active: f.is_active, note: f.note || null,
      };
      return f.id
        ? eyeApi.updateProduct(f.id, body)
        : eyeApi.createProduct({ ...body, quantity_on_hand: Number(f.quantity_on_hand || 0) });
    },
    onSuccess: () => {
      toast.success(form?.id ? "Product updated." : "Product added.");
      qc.invalidateQueries({ queryKey: ["eye", "optical-products"] });
      setForm(null);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const adjust = useMutation({
    mutationFn: ({ id, delta, note }: { id: number; delta: number; note?: string }) =>
      eyeApi.adjustProductStock(id, delta, note),
    onSuccess: () => {
      toast.success("Stock updated.");
      qc.invalidateQueries({ queryKey: ["eye", "optical-products"] });
      setReceive(null); setReceiveQty(""); setReceiveNote("");
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const retire = useMutation({
    mutationFn: (id: number) => eyeApi.deleteProduct(id),
    onSuccess: () => { toast.success("Product retired."); qc.invalidateQueries({ queryKey: ["eye", "optical-products"] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const columns: DxGridColumn<OpticalProduct>[] = [
    { key: "name", header: "Product", render: (p) => (
      <div className="min-w-0">
        <div className="truncate font-semibold text-[var(--dx-text)]">{p.name}</div>
        <div className="text-[11.5px] text-[var(--dx-text-muted)]">{[p.brand, p.spec].filter(Boolean).join(" · ") || p.sku || "—"}</div>
      </div>
    ) },
    { key: "category", header: "Category", render: (p) => <DxBadge tone={catTone(p.category)}>{CATEGORY_LABEL[p.category]}</DxBadge> },
    { key: "quantity_on_hand", header: "In stock", align: "right", render: (p) => (
      <span className="inline-flex items-center gap-1.5">
        <span className="dx-mono font-semibold">{Number(p.quantity_on_hand)}</span>
        {p.is_low_stock ? <DxBadge tone="warning" dot>low</DxBadge> : null}
      </span>
    ) },
    { key: "reorder_level", header: "Reorder", align: "right", render: (p) => <span className="dx-mono text-[var(--dx-text-muted)]">{p.reorder_level != null ? Number(p.reorder_level) : "—"}</span> },
    { key: "sell_price", header: "Sell price", align: "right", render: (p) => <span className="dx-mono font-semibold">{naira(p.sell_price)}</span> },
    { key: "is_active", header: "Status", render: (p) => p.is_active ? <DxBadge tone="success" dot>Active</DxBadge> : <DxBadge tone="neutral">Retired</DxBadge> },
    { key: "actions", header: "", align: "right", render: (p) => (
      <div className="flex items-center justify-end gap-1">
        <DxButton size="sm" variant="text" leftIcon={<PackagePlus className="h-3.5 w-3.5" />} onClick={(e) => { e.stopPropagation(); setReceive(p); }}>Receive</DxButton>
        <DxButton icon size="sm" variant="text" title="Edit" onClick={(e) => { e.stopPropagation(); setForm({
          id: p.id, category: p.category, name: p.name, brand: p.brand ?? "", sku: p.sku ?? "",
          spec: p.spec ?? "", unit_cost: p.unit_cost ?? "", sell_price: p.sell_price ?? "",
          quantity_on_hand: p.quantity_on_hand ?? "", reorder_level: p.reorder_level ?? "",
          is_active: p.is_active, note: p.note ?? "",
        }); }}><Pencil className="h-3.5 w-3.5" /></DxButton>
      </div>
    ) },
  ];

  if (productsQ.isLoading) return <DxPageLoading label="Loading optical inventory..." />;

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Eye Clinic" }, { label: "Optical Inventory" }]}
        title="Optical Inventory"
        subtitle="Frames, lenses and optical products held by the clinic — stock levels, reorder points and pricing that feed dispensing."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={() => productsQ.refetch()} isLoading={productsQ.isFetching}><RotateCcw /></DxButton>
            <DxButton variant="primary" onClick={() => setForm({ ...EMPTY })}><Plus /> Add product</DxButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <DxKpi label="Products" value={kpis.total} icon={Boxes} tone="accent" />
        <DxKpi label="Units in stock" value={kpis.units} icon={Package} tone="info" />
        <DxKpi label="Low on stock" value={kpis.lowStock} icon={AlertTriangle} tone={kpis.lowStock ? "warning" : "neutral"} sub="at or below reorder" />
        <DxKpi label="Stock value" value={naira(kpis.value)} icon={Package} tone="success" sub="at sell price" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72">
          <DxInput leftIcon={<Search className="h-4 w-4 text-[var(--dx-text-faint)]" />} placeholder="Search by name, brand or SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="w-full sm:w-52">
          <DxSelect value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category"
            options={[{ value: "", label: "All categories" }, ...OPTICAL_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))]} />
        </div>
        <DxCheckbox checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} label="Low stock only" />
      </div>

      <DxPanel title="Products" icon={<Boxes />} flush>
        <DxGrid<OpticalProduct>
          borderless columns={columns} data={products} rowKey={(p) => p.id} onRowClick={(p) => setReceive(p)}
          empty={{ icon: Boxes, title: "No optical products", description: "Add frames, lenses and optical products to start tracking stock." }}
        />
      </DxPanel>

      {/* Add / edit product */}
      <DxPopup
        isOpen={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? "Edit product" : "Add optical product"}
        size="md"
        footer={
          <>
            <DxButton variant="text" onClick={() => setForm(null)}>Cancel</DxButton>
            <DxButton variant="primary" disabled={!form?.name.trim()} isLoading={save.isPending} onClick={() => form && save.mutate(form)}>
              {form?.id ? "Save changes" : "Add product"}
            </DxButton>
          </>
        }
      >
        {form ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <DxSelect label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as OpticalProductCategory })}
                options={OPTICAL_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))} />
              <DxInput label="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="e.g. Ray-Ban" />
            </div>
            <DxInput label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Aviator Classic metal frame" />
            <div className="grid gap-3 sm:grid-cols-2">
              <DxInput label="SKU / code" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="optional" />
              <DxInput label="Spec" value={form.spec} onChange={(e) => setForm({ ...form, spec: e.target.value })} placeholder="e.g. 1.56 AR, 52mm" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <DxInput label="Unit cost (₦)" type="number" step="any" mono value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} placeholder="0.00" />
              <DxInput label="Sell price (₦)" type="number" step="any" mono value={form.sell_price} onChange={(e) => setForm({ ...form, sell_price: e.target.value })} placeholder="0.00" />
              <DxInput label="Reorder level" type="number" step="any" mono value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} placeholder="e.g. 3" />
            </div>
            {!form.id ? (
              <DxInput label="Opening quantity" type="number" step="any" mono value={form.quantity_on_hand} onChange={(e) => setForm({ ...form, quantity_on_hand: e.target.value })} placeholder="0" />
            ) : null}
            <DxTextarea label="Note" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <div className="flex items-center justify-between">
              <DxCheckbox checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} label="Active (available for dispensing)" />
              {form.id ? (
                <DxButton variant="outline-danger" size="sm" leftIcon={<X className="h-3.5 w-3.5" />} isLoading={retire.isPending}
                  onClick={() => { if (form.id) { retire.mutate(form.id); setForm(null); } }}>Retire</DxButton>
              ) : null}
            </div>
          </div>
        ) : null}
      </DxPopup>

      {/* Receive / adjust stock */}
      <DxPopup
        isOpen={receive !== null}
        onClose={() => { setReceive(null); setReceiveQty(""); setReceiveNote(""); }}
        title={receive ? `Adjust stock · ${receive.name}` : "Adjust stock"}
        size="sm"
        footer={
          <>
            <DxButton variant="text" onClick={() => { setReceive(null); setReceiveQty(""); setReceiveNote(""); }}>Cancel</DxButton>
            <DxButton variant="primary" disabled={!receiveQty || Number(receiveQty) === 0} isLoading={adjust.isPending}
              onClick={() => receive && adjust.mutate({ id: receive.id, delta: Number(receiveQty), note: receiveNote || undefined })}>
              Apply
            </DxButton>
          </>
        }
      >
        {receive ? (
          <div className="space-y-3">
            <div className="rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] px-3 py-2 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-[var(--dx-text-muted)]">Current on hand</span>
                <span className="dx-mono font-semibold">{Number(receive.quantity_on_hand)}</span>
              </div>
            </div>
            <DxInput label="Quantity change" type="number" step="any" mono value={receiveQty} onChange={(e) => setReceiveQty(e.target.value)}
              placeholder="e.g. 10 to receive, -2 to write off" />
            <div className="flex flex-wrap gap-1.5">
              {[1, 5, 10, 25].map((n) => (
                <DxButton key={n} size="sm" variant="default" onClick={() => setReceiveQty(String(n))}>+{n}</DxButton>
              ))}
            </div>
            <DxTextarea label="Note" rows={2} value={receiveNote} onChange={(e) => setReceiveNote(e.target.value)} placeholder="e.g. Delivery from supplier / stock count correction" />
          </div>
        ) : null}
      </DxPopup>
    </DxPage>
  );
}
