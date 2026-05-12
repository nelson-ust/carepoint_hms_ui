import { PageHeader } from "@/components/layout/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { routes } from "@/config/routes";
import {
  AlertCircle,
  Boxes,
  CalendarClock,
  CheckCircle2,
  Clock,
  Edit3,
  Filter,
  Hash,
  History,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShoppingCart,
  Sigma,
  Trash2,
  TrendingDown,
  X,
} from "lucide-react";
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

function priceFmt(value?: number) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(value);
}

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
  return (
    item.reorder_level != null &&
    item.quantity_on_hand != null &&
    item.quantity_on_hand <= item.reorder_level
  );
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
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to load stock items.");
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
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || "Failed to save stock item.");
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
    } catch (err: any) {
      showFeedback("error", err?.response?.data?.message || "Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Stock Items"
          description="Real-time view of every batch held in every store, with low-stock and expiry alerts."
        />
        <div className="flex items-center gap-3">
          <Link
            to="/inventory/stores"
            className="btn-secondary gap-2 px-5 py-3 rounded-2xl bg-white/80 border-secondary-100"
          >
            <Package className="h-4 w-4" />
            <span className="text-sm font-bold">Stores</span>
          </Link>
          <Link
            to="/inventory/movements"
            className="btn-secondary gap-2 px-5 py-3 rounded-2xl bg-white/80 border-secondary-100"
          >
            <History className="h-4 w-4" />
            <span className="text-sm font-bold">Movements</span>
          </Link>
          <button
            onClick={load}
            className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-100 hover:rotate-180 transition-transform duration-500"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={openCreate}
            className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20"
          >
            <Plus className="h-5 w-5" />
            <span className="font-bold">New Item</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`px-6 py-4 rounded-2xl border flex items-center gap-3 shadow-lg animate-fade-in ${
            feedback.tone === "success"
              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
              : "bg-rose-50 text-rose-700 border-rose-100"
          }`}
        >
          {feedback.tone === "success" ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span className="text-sm font-bold">{feedback.message}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Boxes} label="Total Items" value={stats.total} tone="primary" />
        <StatCard icon={TrendingDown} label="Low Stock" value={stats.low} tone="amber" />
        <StatCard icon={CalendarClock} label="Expiring ≤30d" value={stats.expiringSoon} tone="amber" />
        <StatCard icon={AlertCircle} label="Expired" value={stats.expired} tone="rose" />
      </div>

      {/* Filters */}
      <div className="glass-card rounded-[2rem] p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center bg-white/40 backdrop-blur-md">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU, batch, drug name..."
            className="w-full bg-white/50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
          />
        </div>
        <div className="relative">
          <Package className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400 pointer-events-none" />
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="appearance-none bg-white/80 border border-secondary-100 rounded-2xl pl-11 pr-8 py-4 text-xs font-bold uppercase tracking-widest text-secondary-700 focus:ring-2 focus:ring-primary-500/40"
          >
            <option value="">All Stores</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400 pointer-events-none" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="appearance-none bg-white/80 border border-secondary-100 rounded-2xl pl-11 pr-8 py-4 text-xs font-bold uppercase tracking-widest text-secondary-700 focus:ring-2 focus:ring-primary-500/40"
          >
            <option value="">All Types</option>
            {STOCK_ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setLowOnly((v) => !v)}
          className={`flex items-center gap-2 px-5 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest border transition-all ${
            lowOnly
              ? "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20"
              : "bg-white/80 text-secondary-600 border-secondary-100"
          }`}
        >
          <TrendingDown className="h-4 w-4" />
          Low Only
        </button>
      </div>

      {/* Table */}
      <div className="glass-card rounded-[2.5rem] overflow-hidden border border-secondary-100/50 shadow-premium bg-white/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-secondary-900/5">
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Item</th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Store</th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Quantity</th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Expiry / Batch</th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Cost</th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100/50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-8 py-6">
                      <div className="h-14 bg-secondary-100/30 rounded-2xl" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <AlertCircle className="h-12 w-12 mx-auto text-rose-500/50 mb-4" />
                    <p className="text-secondary-600 font-bold">{error}</p>
                    <button onClick={load} className="btn-primary mt-4 py-3 px-8">
                      Try Again
                    </button>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-32 text-center">
                    <div className="h-20 w-20 bg-secondary-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
                      <Boxes className="h-10 w-10 text-secondary-200" />
                    </div>
                    <h4 className="text-xl font-bold text-secondary-900">No Stock Items</h4>
                    <p className="text-sm text-secondary-500 mt-2">
                      {items.length === 0
                        ? "Stock the first item to start tracking."
                        : "No items match your filters."}
                    </p>
                    <button onClick={openCreate} className="btn-primary mt-4 inline-flex items-center gap-2 px-8 py-3">
                      <Plus className="h-4 w-4" />
                      <span>Add Item</span>
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map((it) => {
                  const expiringSoon = (() => {
                    const d = daysToExpiry(it.expiry_date);
                    return d != null && d >= 0 && d <= 30;
                  })();
                  const expired = isExpired(it.expiry_date);
                  const low = isLowStock(it);
                  return (
                    <tr 
                      key={it.id} 
                      onClick={() => navigate(routes.inventoryItems + `/${it.id}`)}
                      className="hover:bg-primary-50/30 transition-all cursor-pointer group"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md shrink-0">
                            <Boxes className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-secondary-900 truncate">
                              {it.item_name}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="inline-flex px-2 py-0.5 rounded-md bg-primary-50 text-primary-600 border border-primary-100 text-[9px] font-bold uppercase tracking-widest">
                                {it.item_type}
                              </span>
                              {it.sku && (
                                <span className="inline-flex items-center gap-1 bg-secondary-100 text-secondary-500 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold">
                                  <Hash className="h-2.5 w-2.5" />
                                  {it.sku}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <Link
                          to={`/inventory/stores`}
                          className="text-xs font-bold text-secondary-700 hover:text-primary-500 inline-flex items-center gap-1.5"
                        >
                          <Package className="h-3 w-3" />
                          {storeName(it.store_id)}
                        </Link>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-base font-black text-secondary-900">
                          {it.quantity_on_hand ?? 0}
                          {it.unit_of_measure && (
                            <span className="text-[10px] font-bold text-secondary-500 ml-1.5 uppercase tracking-widest">
                              {it.unit_of_measure}
                            </span>
                          )}
                        </p>
                        {it.reorder_level != null && (
                          <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mt-1">
                            Reorder @ {it.reorder_level}
                          </p>
                        )}
                        {low && (
                          <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100 text-[9px] font-bold uppercase tracking-widest">
                            <TrendingDown className="h-2.5 w-2.5" />
                            Low Stock
                          </span>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        {it.expiry_date ? (
                          <div className="space-y-1">
                            <div
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${
                                expired
                                  ? "bg-rose-50 text-rose-600 border-rose-100"
                                  : expiringSoon
                                  ? "bg-amber-50 text-amber-600 border-amber-100"
                                  : "bg-secondary-50 text-secondary-600 border-secondary-100"
                              }`}
                            >
                              <Clock className="h-2.5 w-2.5" />
                              {new Date(it.expiry_date).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </div>
                            {it.batch_no && (
                              <p className="text-[10px] font-mono font-bold text-secondary-400 uppercase">
                                Batch {it.batch_no}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-secondary-400 text-[11px] font-bold">No expiry</span>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-sm font-black text-secondary-900">
                          {priceFmt(it.unit_cost)}
                        </p>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/inventory/movements?item=${it.id}`}
                            className="p-2 rounded-xl hover:bg-secondary-100 text-secondary-500"
                            title="Movement history"
                          >
                            <History className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(it); }}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-600 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-primary-700 transition-all shadow-md"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDelete(it); }}
                            className="p-2 hover:bg-rose-50 text-rose-500 rounded-xl transition-all"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal.open && (
        <ItemModal
          editing={modal.editing}
          form={form}
          onChange={setForm}
          stores={stores}
          drugs={drugs}
          saving={saving}
          error={saveError}
          onClose={close}
          onSubmit={handleSave}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-5 mb-6">
              <div className="h-14 w-14 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-xl shadow-rose-500/20">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-black font-display tracking-tight">Delete Stock Item</h3>
                <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
                  This Cannot Be Undone
                </p>
              </div>
            </div>
            <p className="text-sm text-secondary-600 leading-relaxed mb-6">
              Delete <strong className="text-secondary-900">{confirmDelete.item_name}</strong>?
              Movement history will also be lost.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="flex-1 btn-secondary py-4 rounded-2xl font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-[2] py-4 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-black tracking-tight shadow-xl shadow-rose-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function ItemModal({
  editing,
  form,
  onChange,
  stores,
  drugs,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  editing: StockItem | null;
  form: ItemForm;
  onChange: (f: ItemForm) => void;
  stores: Store[];
  drugs: Drug[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6 animate-fade-in">
      <div className="bg-white rounded-[2.5rem] p-10 max-w-2xl w-full shadow-2xl relative animate-slide-up max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          disabled={saving}
          className="absolute top-6 right-6 p-3 hover:bg-secondary-50 rounded-2xl transition-all"
        >
          <X className="h-5 w-5 text-secondary-400" />
        </button>
        <div className="flex items-center gap-5 mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center shadow-xl shadow-primary-500/20">
            {editing ? <Edit3 className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
          </div>
          <div>
            <h3 className="text-xl font-black font-display tracking-tight">
              {editing ? "Edit Stock Item" : "New Stock Item"}
            </h3>
            <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
              Track A Batch In A Store
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm font-bold">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
              Store *
            </label>
            <select
              value={form.store_id}
              onChange={(e) => onChange({ ...form, store_id: e.target.value })}
              disabled={!!editing}
              className={`input-field h-12 bg-secondary-50 border-secondary-100 w-full ${
                editing ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              <option value="">Pick a store...</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
              Item Type
            </label>
            <select
              value={form.item_type}
              onChange={(e) => onChange({ ...form, item_type: e.target.value })}
              disabled={!!editing}
              className={`input-field h-12 bg-secondary-50 border-secondary-100 w-full ${
                editing ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {STOCK_ITEM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {form.item_type === "DRUG" && !editing && (
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                Linked Drug (optional)
              </label>
              <select
                value={form.drug_id}
                onChange={(e) => {
                  const drugId = e.target.value;
                  const drug = drugs.find((d) => String(d.id) === drugId);
                  onChange({
                    ...form,
                    drug_id: drugId,
                    item_name: drug?.name || form.item_name,
                    sku: drug?.sku || form.sku,
                  });
                }}
                className="input-field h-12 bg-secondary-50 border-secondary-100 w-full"
              >
                <option value="">— No drug linkage —</option>
                {drugs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.strength ? `· ${d.strength}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
              Item Name *
            </label>
            <input
              type="text"
              value={form.item_name}
              onChange={(e) => onChange({ ...form, item_name: e.target.value })}
              placeholder="Paracetamol 500mg Tablets"
              className="input-field h-12 bg-secondary-50 border-secondary-100 w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
              SKU
            </label>
            <input
              type="text"
              value={form.sku}
              onChange={(e) => onChange({ ...form, sku: e.target.value.toUpperCase() })}
              placeholder="PCM-500-T"
              className="input-field h-12 bg-secondary-50 border-secondary-100 w-full font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500 flex items-center gap-1">
              <Sigma className="h-3 w-3" /> Unit of Measure
            </label>
            <input
              type="text"
              value={form.unit_of_measure}
              onChange={(e) => onChange({ ...form, unit_of_measure: e.target.value })}
              placeholder="tabs, ml, vials"
              className="input-field h-12 bg-secondary-50 border-secondary-100 w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
              Quantity on Hand
            </label>
            <input
              type="number"
              step="any"
              value={form.quantity_on_hand}
              onChange={(e) => onChange({ ...form, quantity_on_hand: e.target.value })}
              disabled={!!editing}
              className={`input-field h-12 bg-secondary-50 border-secondary-100 w-full font-mono ${
                editing ? "opacity-60 cursor-not-allowed" : ""
              }`}
            />
            {editing && (
              <p className="text-[9px] font-bold text-secondary-400 uppercase tracking-widest">
                Use Movements to adjust quantity
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
              Reorder Level
            </label>
            <input
              type="number"
              step="any"
              value={form.reorder_level}
              onChange={(e) => onChange({ ...form, reorder_level: e.target.value })}
              placeholder="50"
              className="input-field h-12 bg-secondary-50 border-secondary-100 w-full font-mono"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500 flex items-center gap-1">
              <ShoppingCart className="h-3 w-3" /> Unit Cost (NGN)
            </label>
            <input
              type="number"
              step="any"
              value={form.unit_cost}
              onChange={(e) => onChange({ ...form, unit_cost: e.target.value })}
              placeholder="125.00"
              className="input-field h-12 bg-secondary-50 border-secondary-100 w-full font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
              Batch No.
            </label>
            <input
              type="text"
              value={form.batch_no}
              onChange={(e) => onChange({ ...form, batch_no: e.target.value })}
              placeholder="B-2026-04-A"
              className="input-field h-12 bg-secondary-50 border-secondary-100 w-full font-mono"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500 flex items-center gap-1">
              <CalendarClock className="h-3 w-3" /> Expiry Date
            </label>
            <input
              type="date"
              value={form.expiry_date}
              onChange={(e) => onChange({ ...form, expiry_date: e.target.value })}
              className="input-field h-12 bg-secondary-50 border-secondary-100 w-full font-mono"
            />
          </div>
        </div>

        <div className="pt-6 flex gap-4">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 btn-secondary py-4 rounded-2xl font-bold"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="flex-[2] btn-primary py-4 rounded-2xl font-black tracking-tight shadow-xl shadow-primary-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : editing ? "Save Changes" : "Add Item"}
          </button>
        </div>
      </div>
    </div>
  );
}

type StatTone = "primary" | "emerald" | "amber" | "rose";
const statToneStyles: Record<StatTone, string> = {
  primary: "bg-primary-50 text-primary-600 border-primary-100",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  amber: "bg-amber-50 text-amber-600 border-amber-100",
  rose: "bg-rose-50 text-rose-600 border-rose-100",
};
function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Boxes;
  label: string;
  value: number;
  tone: StatTone;
}) {
  return (
    <div className={`glass-card rounded-[2rem] p-6 border ${statToneStyles[tone]} bg-white/60 backdrop-blur-md`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</span>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-3xl font-black tracking-tight">{value}</div>
    </div>
  );
}
