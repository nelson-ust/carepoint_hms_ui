import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { routes } from "@/config/routes";
import {
  AlertCircle,
  Boxes,
  CalendarClock,
  Edit3,
  Hash,
  History,
  Package,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  TrendingDown,
  Upload,
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
import {
  createStockItem,
  deleteStockItem,
  listStockItems,
  listStores,
  STOCK_ITEM_TYPES,
  updateStockItem,
} from "../api/inventory.api";
import type {
  CreateStockItemPayload,
  StockItem,
  Store,
  UpdateStockItemPayload,
} from "../api/inventory.api";
import { listDrugs } from "@/features/drugs/api/drugs.api";
import type { Drug } from "@/features/drugs/api/drugs.api";
import { apiErrorMessage } from "@/lib/api/api-error";
import { BulkUploadModal } from "../components/BulkUploadModal";

type ItemForm = {
  store_id: string;
  drug_id: string;
  item_type: string;
  item_name: string;
  sku: string;
  unit_of_measure: string;
  quantity_on_hand: string;
  reorder_level: string;
  unit_cost: string;
  expiry_date: string;
  batch_no: string;
};

const emptyForm: ItemForm = {
  store_id: "",
  drug_id: "",
  item_type: "DRUG",
  item_name: "",
  sku: "",
  unit_of_measure: "",
  quantity_on_hand: "0",
  reorder_level: "",
  unit_cost: "",
  expiry_date: "",
  batch_no: "",
};

function isExpired(date?: string): boolean {
  if (!date) return false;
  return new Date(date).getTime() < Date.now();
}

function daysToExpiry(date?: string): number | null {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function isLowStock(item: StockItem): boolean {
  // Store-level reorder wins; otherwise fall back to the linked drug's default.
  const threshold = item.effective_reorder_level ?? item.reorder_level;
  return (
    threshold != null &&
    item.quantity_on_hand != null &&
    item.quantity_on_hand <= threshold
  );
}

function expiryTone(date?: string): "neutral" | "warning" | "danger" {
  if (!date) return "neutral";
  if (isExpired(date)) return "danger";
  const d = daysToExpiry(date);
  return d != null && d >= 0 && d <= 30 ? "warning" : "neutral";
}

export function StockItemsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStore = searchParams.get("store") ?? "";

  const [items, setItems] = useState<StockItem[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    { tone: "success" | "error"; message: string } | null
  >(null);

  const [search, setSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState(initialStore);
  const [typeFilter, setTypeFilter] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const [modal, setModal] = useState<{ open: boolean; editing: StockItem | null }>({
    open: false,
    editing: null,
  });
  const [form, setForm] = useState<ItemForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<StockItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [showBulkUpload, setShowBulkUpload] = useState(false);

  const showFeedback = (tone: "success" | "error", message: string) => {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 3500);
  };

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [itemsRes, storesRes, drugsRes] = await Promise.all([
        listStockItems({
          skip: 0,
          limit: 500,
          store_id: storeFilter ? Number(storeFilter) : undefined,
        }),
        listStores({ skip: 0, limit: 200 }),
        listDrugs({ skip: 0, limit: 500 }).catch(() => null),
      ]);
      setItems(itemsRes.items ?? []);
      setStores(storesRes.items ?? []);
      setDrugs(drugsRes?.items ?? []);
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to load stock items. Please retry."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // sync the store filter to the URL so deep-links from StoresPage stick
    if (storeFilter) {
      setSearchParams({ store: storeFilter }, { replace: true });
    } else {
      searchParams.delete("store");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeFilter]);

  // Deep link from the Drugs page: /inventory/items?drug_id=123 opens the
  // create modal pre-linked to that formulary drug (no re-typing).
  useEffect(() => {
    const drugParam = searchParams.get("drug_id");
    if (!drugParam || drugs.length === 0) return;
    const drug = drugs.find((d) => String(d.id) === drugParam);
    if (drug) {
      openCreateForDrug(drug, searchParams.get("store") || undefined);
      searchParams.delete("drug_id");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drugs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (typeFilter && it.item_type !== typeFilter) return false;
      if (lowOnly && !isLowStock(it)) return false;
      if (!q) return true;
      return (
        it.item_name?.toLowerCase().includes(q) ||
        it.sku?.toLowerCase().includes(q) ||
        it.batch_no?.toLowerCase().includes(q) ||
        it.drug?.name?.toLowerCase().includes(q)
      );
    });
  }, [items, search, typeFilter, lowOnly]);

  const stats = useMemo(() => {
    const total = items.length;
    const low = items.filter(isLowStock).length;
    const expiringSoon = items.filter((it) => {
      const d = daysToExpiry(it.expiry_date);
      return d != null && d >= 0 && d <= 30;
    }).length;
    const expired = items.filter((it) => isExpired(it.expiry_date)).length;
    return { total, low, expiringSoon, expired };
  }, [items]);

  const storeName = (id: number) => stores.find((s) => s.id === id)?.name ?? `Store #${id}`;

  // ----- Modal -----
  const openCreateForDrug = (drug: Drug, storeId?: string) => {
    setModal({ open: true, editing: null });
    setForm({
      ...emptyForm,
      store_id: storeId || storeFilter || (stores[0] ? String(stores[0].id) : ""),
      item_type: "DRUG",
      drug_id: String(drug.id),
      item_name: drug.name ?? "",
      sku: drug.sku ?? "",
      unit_of_measure: drug.dosage_form ?? "",
      reorder_level: drug.reorder_level != null ? String(drug.reorder_level) : "",
    });
    setSaveError(null);
  };
  const openCreate = () => {
    setModal({ open: true, editing: null });
    setForm({
      ...emptyForm,
      store_id: storeFilter || (stores[0] ? String(stores[0].id) : ""),
    });
    setSaveError(null);
  };
  const openEdit = (it: StockItem) => {
    setModal({ open: true, editing: it });
    setForm({
      store_id: String(it.store_id),
      drug_id: it.drug_id != null ? String(it.drug_id) : "",
      item_type: it.item_type ?? "DRUG",
      item_name: it.item_name ?? "",
      sku: it.sku ?? "",
      unit_of_measure: it.unit_of_measure ?? "",
      quantity_on_hand: String(it.quantity_on_hand ?? 0),
      reorder_level: it.reorder_level != null ? String(it.reorder_level) : "",
      unit_cost: it.unit_cost != null ? String(it.unit_cost) : "",
      expiry_date: it.expiry_date ? it.expiry_date.slice(0, 10) : "",
      batch_no: it.batch_no ?? "",
    });
    setSaveError(null);
  };
  const close = () => {
    if (saving) return;
    setModal({ open: false, editing: null });
  };

  const handleSave = async () => {
    if (!form.store_id) {
      setSaveError("Pick a store.");
      return;
    }
    if (!form.item_name.trim()) {
      setSaveError("Item name is required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      if (modal.editing) {
        const payload: UpdateStockItemPayload = {
          item_name: form.item_name.trim(),
          sku: form.sku.trim() || undefined,
          unit_of_measure: form.unit_of_measure.trim() || undefined,
          reorder_level: form.reorder_level ? Number(form.reorder_level) : undefined,
          unit_cost: form.unit_cost ? Number(form.unit_cost) : undefined,
          expiry_date: form.expiry_date
            ? new Date(form.expiry_date).toISOString()
            : undefined,
          batch_no: form.batch_no.trim() || undefined,
        };
        const res = await updateStockItem(modal.editing.id, payload);
        setItems((prev) => prev.map((x) => (x.id === res.stock_item.id ? res.stock_item : x)));
      } else {
        const payload: CreateStockItemPayload = {
          store_id: Number(form.store_id),
          drug_id: form.drug_id ? Number(form.drug_id) : undefined,
          item_type: form.item_type,
          item_name: form.item_name.trim(),
          sku: form.sku.trim() || undefined,
          unit_of_measure: form.unit_of_measure.trim() || undefined,
          quantity_on_hand: Number(form.quantity_on_hand) || 0,
          reorder_level: form.reorder_level ? Number(form.reorder_level) : undefined,
          unit_cost: form.unit_cost ? Number(form.unit_cost) : undefined,
          expiry_date: form.expiry_date
            ? new Date(form.expiry_date).toISOString()
            : undefined,
          batch_no: form.batch_no.trim() || undefined,
        };
        const res = await createStockItem(payload);
        setItems((prev) => [res.stock_item, ...prev]);
      }
      showFeedback("success", "Stock item saved.");
      setModal({ open: false, editing: null });
    } catch (err) {
      setSaveError(apiErrorMessage(err, "Failed to save stock item. Please check the details and retry."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteStockItem(confirmDelete.id);
      setItems((prev) => prev.filter((x) => x.id !== confirmDelete.id));
      showFeedback("success", "Stock item removed.");
      setConfirmDelete(null);
    } catch (err) {
      showFeedback("error", apiErrorMessage(err, "Failed to delete."));
    } finally {
      setDeleting(false);
    }
  };

  const columns: DxGridColumn<StockItem>[] = [
    {
      key: "item_name",
      header: "Item",
      render: (it) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]">
            <Boxes className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold text-[var(--dx-text)]">{it.item_name}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <DxBadge tone="neutral">{it.item_type}</DxBadge>
              {it.sku ? (
                <span className="inline-flex items-center gap-1 dx-mono text-[11px] text-[var(--dx-text-muted)]">
                  <Hash className="h-2.5 w-2.5" />
                  {it.sku}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "store_id",
      header: "Store",
      accessor: (it) => storeName(it.store_id),
      render: (it) => (
        <span className="inline-flex items-center gap-1.5 text-[var(--dx-text-muted)]">
          <Package className="h-3 w-3" />
          {storeName(it.store_id)}
        </span>
      ),
    },
    {
      key: "quantity_on_hand",
      header: "Quantity",
      align: "right",
      accessor: (it) => it.quantity_on_hand ?? 0,
      render: (it) => {
        const low = isLowStock(it);
        return (
          <div className="flex flex-col items-end">
            <span className="dx-mono font-semibold text-[var(--dx-text)]">
              {it.quantity_on_hand ?? 0}
              {it.unit_of_measure ? (
                <span className="ml-1 text-[11px] text-[var(--dx-text-muted)]">{it.unit_of_measure}</span>
              ) : null}
            </span>
            {it.reorder_level != null ? (
              <span className="text-[11px] text-[var(--dx-text-faint)]">Reorder @ {it.reorder_level}</span>
            ) : null}
            {low ? (
              <DxBadge tone="warning" className="mt-1" dot>Low stock</DxBadge>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "expiry_date",
      header: "Expiry / Batch",
      accessor: (it) => it.expiry_date ?? "",
      render: (it) =>
        it.expiry_date ? (
          <div className="space-y-1">
            <DxBadge tone={expiryTone(it.expiry_date)} dot>
              {new Date(it.expiry_date).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </DxBadge>
            {it.batch_no ? (
              <div className="dx-mono text-[11px] text-[var(--dx-text-faint)]">Batch {it.batch_no}</div>
            ) : null}
          </div>
        ) : (
          <span className="text-[var(--dx-text-faint)]">No expiry</span>
        ),
    },
    {
      key: "unit_cost",
      header: "Cost",
      align: "right",
      accessor: (it) => it.unit_cost ?? 0,
      render: (it) => <span className="dx-mono font-semibold text-[var(--dx-text)]">{formatNaira(it.unit_cost)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (it) => (
        <div className="flex items-center justify-end gap-1">
          <Link
            to={`/inventory/movements?item=${it.id}`}
            className="dx-btn dx-btn-sm"
            title="Movement history"
            onClick={(e) => e.stopPropagation()}
          >
            <History className="h-3.5 w-3.5" />
          </Link>
          <DxButton size="sm" leftIcon={<Edit3 className="h-3.5 w-3.5" />} onClick={(e) => { e.stopPropagation(); openEdit(it); }}>Edit</DxButton>
          <DxButton
            icon
            size="sm"
            variant="outline-danger"
            title="Delete"
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(it); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </DxButton>
        </div>
      ),
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Inventory" }, { label: "Stock Items" }]}
        title="Stock Items"
        subtitle="Real-time view of every batch held in every store, with low-stock and expiry alerts."
        actions={
          <>
            <Link to="/inventory/stores" className="dx-btn dx-btn-sm"><Package className="h-4 w-4" /> Stores</Link>
            <Link to="/inventory/movements" className="dx-btn dx-btn-sm"><History className="h-4 w-4" /> Movements</Link>
            <DxButton icon title="Refresh" onClick={load} isLoading={isLoading}><RotateCcw /></DxButton>
            <DxButton leftIcon={<Upload className="h-4 w-4" />} onClick={() => setShowBulkUpload(true)}>Bulk upload</DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New item</DxButton>
          </>
        }
      />

      <BulkUploadModal
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        onImported={load}
      />

      {feedback ? (
        <DxMessage tone={feedback.tone === "success" ? "success" : "danger"}>{feedback.message}</DxMessage>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <DxKpi icon={Boxes} label="Total Items" value={stats.total} tone="accent" />
        <DxKpi icon={TrendingDown} label="Low Stock" value={stats.low} tone="warning" />
        <DxKpi icon={CalendarClock} label="Expiring ≤30d" value={stats.expiringSoon} tone="warning" />
        <DxKpi icon={AlertCircle} label="Expired" value={stats.expired} tone="danger" />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="w-full flex-1">
          <DxInput
            leftIcon={<Search className="h-3.5 w-3.5" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU, batch, drug name…"
          />
        </div>
        <div className="w-full md:w-52">
          <DxSelect
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            aria-label="Filter by store"
            options={[{ value: "", label: "All Stores" }, ...stores.map((s) => ({ value: String(s.id), label: s.name }))]}
          />
        </div>
        <div className="w-full md:w-44">
          <DxSelect
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by type"
            options={[{ value: "", label: "All Types" }, ...STOCK_ITEM_TYPES.map((t) => ({ value: t, label: t }))]}
          />
        </div>
        <DxButton
          variant={lowOnly ? "primary" : "default"}
          leftIcon={<TrendingDown className="h-4 w-4" />}
          onClick={() => setLowOnly((v) => !v)}
        >
          Low only
        </DxButton>
      </div>

      {error ? (
        <DxMessage tone="danger" action={<DxButton size="sm" onClick={load}>Retry</DxButton>}>{error}</DxMessage>
      ) : (
        <DxPanel flush>
          <DxGrid<StockItem>
            columns={columns}
            data={filtered}
            rowKey={(it) => it.id}
            isLoading={isLoading}
            onRowClick={(it) => navigate(routes.inventoryItems + `/${it.id}`)}
            empty={{
              icon: Boxes,
              title: "No Stock Items",
              description: items.length === 0 ? "Stock the first item to start tracking." : "No items match your filters.",
              action: <DxButton size="sm" variant="primary" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={openCreate}>Add item</DxButton>,
            }}
          />
        </DxPanel>
      )}

      {/* Create / edit */}
      <DxPopup
        isOpen={modal.open}
        onClose={close}
        title={modal.editing ? "Edit Stock Item" : "New Stock Item"}
        size="lg"
        locked={saving}
        footer={
          <>
            <DxButton onClick={close} disabled={saving}>Cancel</DxButton>
            <DxButton variant="primary" onClick={handleSave} isLoading={saving} leftIcon={<Plus className="h-4 w-4" />}>
              {modal.editing ? "Save changes" : "Add item"}
            </DxButton>
          </>
        }
      >
        <div className="space-y-4">
          {saveError ? <DxMessage tone="danger">{saveError}</DxMessage> : null}
          <div className="grid gap-4 md:grid-cols-2">
            <DxSelect
              label="Store"
              required
              value={form.store_id}
              onChange={(e) => setForm({ ...form, store_id: e.target.value })}
              disabled={!!modal.editing}
              placeholder="Pick a store…"
              options={stores.map((s) => ({ value: String(s.id), label: `${s.name} (${s.code})` }))}
            />
            <DxSelect
              label="Item type"
              value={form.item_type}
              onChange={(e) => setForm({ ...form, item_type: e.target.value })}
              disabled={!!modal.editing}
              options={STOCK_ITEM_TYPES.map((t) => ({ value: t, label: t }))}
            />

            {form.item_type === "DRUG" ? (
              <DxSelect
                label="Linked drug (recommended)"
                fieldClassName="md:col-span-2"
                value={form.drug_id}
                hint="Name, SKU & unit are taken from the drug — keeping the formulary the single source of truth."
                onChange={(e) => {
                  const drugId = e.target.value;
                  const drug = drugs.find((d) => String(d.id) === drugId);
                  if (drug) {
                    setForm({
                      ...form,
                      drug_id: drugId,
                      item_name: drug.name || form.item_name,
                      sku: drug.sku || form.sku,
                      unit_of_measure: drug.dosage_form || form.unit_of_measure,
                      reorder_level:
                        form.reorder_level ||
                        (drug.reorder_level != null ? String(drug.reorder_level) : form.reorder_level),
                    });
                  } else {
                    setForm({ ...form, drug_id: "" });
                  }
                }}
                options={[
                  { value: "", label: "— No drug linkage —" },
                  ...drugs.map((d) => ({ value: String(d.id), label: `${d.name}${d.strength ? ` · ${d.strength}` : ""}` })),
                ]}
              />
            ) : null}

            <DxInput
              label="Item name"
              required
              fieldClassName="md:col-span-2"
              value={form.item_name}
              onChange={(e) => setForm({ ...form, item_name: e.target.value })}
              placeholder="Paracetamol 500mg Tablets"
              readOnly={!!form.drug_id}
            />

            <DxInput
              label="SKU"
              mono
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })}
              placeholder="PCM-500-T"
              readOnly={!!form.drug_id}
            />
            <DxInput
              label="Unit of measure"
              value={form.unit_of_measure}
              onChange={(e) => setForm({ ...form, unit_of_measure: e.target.value })}
              placeholder="tabs, ml, vials"
              readOnly={!!form.drug_id}
            />

            <DxInput
              label="Quantity on hand"
              type="number"
              step="any"
              mono
              value={form.quantity_on_hand}
              onChange={(e) => setForm({ ...form, quantity_on_hand: e.target.value })}
              disabled={!!modal.editing}
              hint={modal.editing ? "Use Movements to adjust quantity" : undefined}
            />
            <DxInput
              label="Reorder level"
              type="number"
              step="any"
              mono
              value={form.reorder_level}
              onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
              placeholder="50"
            />

            <DxInput
              label="Unit cost (NGN)"
              type="number"
              step="any"
              mono
              value={form.unit_cost}
              onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
              placeholder="125.00"
            />
            <DxInput
              label="Batch no."
              mono
              value={form.batch_no}
              onChange={(e) => setForm({ ...form, batch_no: e.target.value })}
              placeholder="B-2026-04-A"
            />

            <DxInput
              label="Expiry date"
              type="date"
              mono
              fieldClassName="md:col-span-2"
              value={form.expiry_date}
              onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
            />
          </div>
        </div>
      </DxPopup>

      {/* Delete confirm */}
      <DxPopup
        isOpen={confirmDelete !== null}
        onClose={() => !deleting && setConfirmDelete(null)}
        title="Delete Stock Item"
        size="sm"
        locked={deleting}
        footer={
          <>
            <DxButton onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancel</DxButton>
            <DxButton variant="danger" onClick={handleDelete} isLoading={deleting}>Delete item</DxButton>
          </>
        }
      >
        <DxMessage tone="danger">
          {confirmDelete ? <>Delete <strong>{confirmDelete.item_name}</strong>? Its movement history will also be lost. This cannot be undone.</> : null}
        </DxMessage>
      </DxPopup>
    </DxPage>
  );
}
