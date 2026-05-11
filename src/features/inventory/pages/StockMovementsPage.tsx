import { PageHeader } from "@/components/layout/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Boxes,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  Hash,
  History,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sigma,
  Sliders,
  TrendingDown,
  TrendingUp,
  Truck,
  X,
} from "lucide-react";
import {
  listInventoryMovements,
  listStockItems,
  listStores,
  MOVEMENT_TYPES,
  recordInventoryMovement,
} from "../api/inventory.api";
import type { StockItem, StockMovement, Store } from "../api/inventory.api";
import { transferStock } from "../api/stock-movements.api";
import { getStaff, staffDisplayName } from "@/features/staff/api/staff.api";
import type { Staff } from "@/features/staff/api/staff.api";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";

const movementToneStyles: Record<string, string> = {
  RECEIPT: "bg-emerald-50 text-emerald-600 border-emerald-100",
  ISSUE: "bg-amber-50 text-amber-600 border-amber-100",
  ADJUSTMENT: "bg-secondary-100 text-secondary-600 border-secondary-200",
  TRANSFER_IN: "bg-emerald-50 text-emerald-600 border-emerald-100",
  TRANSFER_OUT: "bg-amber-50 text-amber-600 border-amber-100",
  RETURN: "bg-primary-50 text-primary-600 border-primary-100",
  WASTAGE: "bg-rose-50 text-rose-600 border-rose-100",
};

const movementIcon: Record<string, typeof ArrowDownToLine> = {
  RECEIPT: ArrowDownToLine,
  ISSUE: ArrowUpFromLine,
  ADJUSTMENT: Sliders,
  TRANSFER_IN: ArrowDownToLine,
  TRANSFER_OUT: ArrowUpFromLine,
  RETURN: ArrowDownToLine,
  WASTAGE: TrendingDown,
};

function formatDateTime(value?: string) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function readStoredUserId(): number | null {
  try {
    const raw = localStorageService.get(storageKeys.user);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.id === "number" ? parsed.id : null;
  } catch {
    return null;
  }
}

type RecordForm = {
  store_id: string;
  stock_item_id: string;
  movement_type: string;
  quantity: string;
  reference_no: string;
  note: string;
  performed_by_staff_id: number | null;
};

type TransferForm = {
  from_stock_item_id: string;
  to_store_id: string;
  quantity: string;
  note: string;
  performed_by_staff_id: number | null;
};

const emptyRecord: RecordForm = {
  store_id: "",
  stock_item_id: "",
  movement_type: MOVEMENT_TYPES[0],
  quantity: "",
  reference_no: "",
  note: "",
  performed_by_staff_id: null,
};

const emptyTransfer: TransferForm = {
  from_stock_item_id: "",
  to_store_id: "",
  quantity: "",
  note: "",
  performed_by_staff_id: null,
};

export function StockMovementsPage() {
  const [searchParams] = useSearchParams();
  const initialStore = searchParams.get("store") ?? "";
  const initialItem = searchParams.get("item") ?? "";

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    { tone: "success" | "error"; message: string } | null
  >(null);

  const [search, setSearch] = useState(initialItem);
  const [storeFilter, setStoreFilter] = useState(initialStore);
  const [typeFilter, setTypeFilter] = useState("");

  const [recordOpen, setRecordOpen] = useState(false);
  const [recordForm, setRecordForm] = useState<RecordForm>(emptyRecord);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordSaving, setRecordSaving] = useState(false);

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState<TransferForm>(emptyTransfer);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferSaving, setTransferSaving] = useState(false);

  const showFeedback = (tone: "success" | "error", message: string) => {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 3500);
  };

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [movRes, storesRes, itemsRes, staffRes] = await Promise.all([
        listInventoryMovements({
          skip: 0,
          limit: 200,
          store_id: storeFilter ? Number(storeFilter) : undefined,
        }),
        listStores({ skip: 0, limit: 200 }),
        listStockItems({ skip: 0, limit: 500 }),
        getStaff(0, 200).catch(() => [] as Staff[]),
      ]);
      setMovements(movRes.items ?? []);
      setStores(storesRes.items ?? []);
      setItems(itemsRes.items ?? []);
      setStaffList(Array.isArray(staffRes) ? staffRes : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to load stock movements.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeFilter]);

  // Default the staff IDs to logged-in user when staff list loads
  useEffect(() => {
    const userId = readStoredUserId();
    if (userId == null) return;
    const match = staffList.find((s) => s.user_id === userId);
    if (!match) return;
    setRecordForm((prev) =>
      prev.performed_by_staff_id == null ? { ...prev, performed_by_staff_id: match.id } : prev,
    );
    setTransferForm((prev) =>
      prev.performed_by_staff_id == null ? { ...prev, performed_by_staff_id: match.id } : prev,
    );
  }, [staffList]);

  const itemName = (id: number) =>
    items.find((i) => i.id === id)?.item_name ?? `Item #${id}`;
  const storeName = (id: number) =>
    stores.find((s) => s.id === id)?.name ?? `Store #${id}`;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return movements.filter((m) => {
      if (typeFilter && m.movement_type !== typeFilter) return false;
      if (!q) return true;
      const sItem = items.find((i) => i.id === m.stock_item_id);
      return (
        m.reference_no?.toLowerCase().includes(q) ||
        m.note?.toLowerCase().includes(q) ||
        sItem?.item_name?.toLowerCase().includes(q) ||
        sItem?.sku?.toLowerCase().includes(q) ||
        String(m.id).includes(q)
      );
    });
  }, [movements, search, typeFilter, items]);

  const stats = useMemo(() => {
    const total = movements.length;
    const inbound = movements.filter((m) =>
      ["RECEIPT", "TRANSFER_IN", "RETURN"].includes(m.movement_type),
    ).length;
    const outbound = movements.filter((m) =>
      ["ISSUE", "TRANSFER_OUT", "WASTAGE"].includes(m.movement_type),
    ).length;
    const adjustments = movements.filter((m) => m.movement_type === "ADJUSTMENT").length;
    return { total, inbound, outbound, adjustments };
  }, [movements]);

  // ----- Record movement -----
  const openRecord = () => {
    setRecordForm({
      ...emptyRecord,
      store_id: storeFilter || (stores[0] ? String(stores[0].id) : ""),
      performed_by_staff_id: recordForm.performed_by_staff_id,
    });
    setRecordError(null);
    setRecordOpen(true);
  };

  const handleRecord = async () => {
    if (!recordForm.store_id || !recordForm.stock_item_id) {
      setRecordError("Pick a store and a stock item.");
      return;
    }
    if (!recordForm.quantity || Number.isNaN(Number(recordForm.quantity))) {
      setRecordError("Quantity must be a number.");
      return;
    }
    setRecordSaving(true);
    setRecordError(null);
    try {
      const res = await recordInventoryMovement({
        store_id: Number(recordForm.store_id),
        stock_item_id: Number(recordForm.stock_item_id),
        movement_type: recordForm.movement_type,
        quantity: Number(recordForm.quantity),
        reference_no: recordForm.reference_no.trim() || undefined,
        note: recordForm.note.trim() || undefined,
        performed_by_staff_id: recordForm.performed_by_staff_id ?? undefined,
      });
      setMovements((prev) => [res.movement, ...prev]);
      showFeedback("success", res.message || "Movement recorded.");
      setRecordOpen(false);
      // Refresh items so new quantities show in the picker
      const itemsRes = await listStockItems({ skip: 0, limit: 500 });
      setItems(itemsRes.items ?? []);
    } catch (err: any) {
      setRecordError(err?.response?.data?.message || "Failed to record movement.");
    } finally {
      setRecordSaving(false);
    }
  };

  // ----- Transfer -----
  const openTransfer = () => {
    setTransferForm({ ...emptyTransfer, performed_by_staff_id: transferForm.performed_by_staff_id });
    setTransferError(null);
    setTransferOpen(true);
  };

  const handleTransfer = async () => {
    if (!transferForm.from_stock_item_id || !transferForm.to_store_id) {
      setTransferError("Pick the source item and destination store.");
      return;
    }
    if (!transferForm.quantity || Number.isNaN(Number(transferForm.quantity))) {
      setTransferError("Quantity must be a number.");
      return;
    }
    setTransferSaving(true);
    setTransferError(null);
    try {
      const res = await transferStock({
        from_stock_item_id: Number(transferForm.from_stock_item_id),
        to_store_id: Number(transferForm.to_store_id),
        quantity: Number(transferForm.quantity),
        note: transferForm.note.trim() || undefined,
        performed_by_staff_id: transferForm.performed_by_staff_id ?? undefined,
      });
      if (res.movement) setMovements((prev) => [res.movement, ...prev]);
      showFeedback("success", res.message || "Stock transferred.");
      setTransferOpen(false);
      // Reload movements + items to capture both transfer-out & transfer-in entries
      load();
    } catch (err: any) {
      setTransferError(err?.response?.data?.message || "Failed to transfer stock.");
    } finally {
      setTransferSaving(false);
    }
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Stock Movements"
          description="Every receipt, issue, adjustment and transfer — your complete inventory ledger."
        />
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            to="/inventory/stores"
            className="btn-secondary gap-2 px-5 py-3 rounded-2xl bg-white/80 border-secondary-100"
          >
            <Package className="h-4 w-4" />
            <span className="text-sm font-bold">Stores</span>
          </Link>
          <Link
            to="/inventory/items"
            className="btn-secondary gap-2 px-5 py-3 rounded-2xl bg-white/80 border-secondary-100"
          >
            <Boxes className="h-4 w-4" />
            <span className="text-sm font-bold">Items</span>
          </Link>
          <button
            onClick={load}
            className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-100 hover:rotate-180 transition-transform duration-500"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={openTransfer}
            className="btn-secondary gap-2 px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-500/20"
          >
            <ArrowLeftRight className="h-4 w-4" />
            <span className="font-bold text-sm">Transfer</span>
          </button>
          <button
            onClick={openRecord}
            className="btn-primary gap-3 py-3 px-7 shadow-xl shadow-primary-500/20"
          >
            <Plus className="h-5 w-5" />
            <span className="font-bold">Record Movement</span>
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

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={History} label="Total Movements" value={stats.total} tone="primary" />
        <StatCard icon={TrendingUp} label="Inbound" value={stats.inbound} tone="emerald" />
        <StatCard icon={TrendingDown} label="Outbound" value={stats.outbound} tone="amber" />
        <StatCard icon={Sliders} label="Adjustments" value={stats.adjustments} tone="rose" />
      </div>

      {/* Filters */}
      <div className="glass-card rounded-[2rem] p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center bg-white/40 backdrop-blur-md">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reference, note, item, SKU..."
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
            {MOVEMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-[2.5rem] overflow-hidden border border-secondary-100/50 shadow-premium bg-white/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-secondary-900/5">
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Type</th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Item</th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Store</th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Qty</th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Balance</th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500">Reference</th>
                <th className="px-8 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100/50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-8 py-6">
                      <div className="h-14 bg-secondary-100/30 rounded-2xl" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center">
                    <AlertCircle className="h-12 w-12 mx-auto text-rose-500/50 mb-4" />
                    <p className="text-secondary-600 font-bold">{error}</p>
                    <button onClick={load} className="btn-primary mt-4 py-3 px-8">
                      Try Again
                    </button>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-8 py-32 text-center">
                    <div className="h-20 w-20 bg-secondary-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
                      <History className="h-10 w-10 text-secondary-200" />
                    </div>
                    <h4 className="text-xl font-bold text-secondary-900">No Movements</h4>
                    <p className="text-sm text-secondary-500 mt-2">
                      {movements.length === 0
                        ? "Record the first stock movement to start the ledger."
                        : "No movements match your filters."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const Icon = movementIcon[m.movement_type] ?? History;
                  const cls = movementToneStyles[m.movement_type] ?? movementToneStyles.ADJUSTMENT;
                  const sItem = items.find((i) => i.id === m.stock_item_id);
                  return (
                    <tr key={m.id} className="hover:bg-primary-50/30 transition-all">
                      <td className="px-8 py-6">
                        <span
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest ${cls}`}
                        >
                          <Icon className="h-3 w-3" />
                          {m.movement_type.replace("_", " ")}
                        </span>
                        <p className="text-[10px] font-mono font-bold text-secondary-400 uppercase tracking-widest mt-1.5">
                          MOV-{m.id}
                        </p>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-sm font-bold text-secondary-900 truncate max-w-xs">
                          {sItem?.item_name ?? itemName(m.stock_item_id)}
                        </p>
                        {sItem?.sku && (
                          <span className="inline-flex items-center gap-1 mt-1 bg-secondary-100 text-secondary-500 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold">
                            <Hash className="h-2.5 w-2.5" />
                            {sItem.sku}
                          </span>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-secondary-100 text-secondary-600 text-[10px] font-bold uppercase tracking-widest">
                          <Package className="h-3 w-3" />
                          {storeName(m.store_id)}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-base font-black text-secondary-900 font-mono">
                          {["ISSUE", "TRANSFER_OUT", "WASTAGE"].includes(m.movement_type) ? "−" : "+"}
                          {Math.abs(m.quantity)}
                        </p>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-sm font-bold text-secondary-700 font-mono">
                          {m.balance_after ?? "—"}
                        </p>
                      </td>
                      <td className="px-8 py-6">
                        <div className="space-y-1">
                          {m.reference_no && (
                            <p className="text-[11px] font-mono font-bold text-secondary-700">
                              {m.reference_no}
                            </p>
                          )}
                          {m.note && (
                            <p className="text-[11px] text-secondary-500 italic max-w-xs truncate">
                              {m.note}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-secondary-500">
                          <Clock className="h-3 w-3" />
                          {formatDateTime(m.movement_date || m.created_at)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Movement Modal */}
      {recordOpen && (
        <ModalShell
          title="Record Stock Movement"
          subtitle="Log A Receipt, Issue, Adjustment Or Wastage"
          onClose={() => !recordSaving && setRecordOpen(false)}
          icon={Plus}
        >
          {recordError && (
            <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-bold">{recordError}</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                Movement Type *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {MOVEMENT_TYPES.map((t) => {
                  const Icon = movementIcon[t] ?? Sliders;
                  const isActive = recordForm.movement_type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setRecordForm({ ...recordForm, movement_type: t })}
                      className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border-2 transition-all ${
                        isActive
                          ? "bg-primary-500 text-white border-primary-500 shadow-md shadow-primary-500/20"
                          : "bg-white border-secondary-100 text-secondary-500 hover:border-primary-300"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-[9px] font-bold uppercase tracking-widest">
                        {t.replace("_", " ")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                Store *
              </label>
              <select
                value={recordForm.store_id}
                onChange={(e) =>
                  setRecordForm({ ...recordForm, store_id: e.target.value, stock_item_id: "" })
                }
                className="input-field h-12 bg-secondary-50 border-secondary-100 w-full"
              >
                <option value="">Pick a store...</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                Stock Item *
              </label>
              <select
                value={recordForm.stock_item_id}
                onChange={(e) =>
                  setRecordForm({ ...recordForm, stock_item_id: e.target.value })
                }
                className="input-field h-12 bg-secondary-50 border-secondary-100 w-full"
                disabled={!recordForm.store_id}
              >
                <option value="">Pick an item...</option>
                {items
                  .filter((i) =>
                    !recordForm.store_id ? false : i.store_id === Number(recordForm.store_id),
                  )
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.item_name} (qty {i.quantity_on_hand})
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500 flex items-center gap-1">
                <Sigma className="h-3 w-3" /> Quantity *
              </label>
              <input
                type="number"
                step="any"
                value={recordForm.quantity}
                onChange={(e) => setRecordForm({ ...recordForm, quantity: e.target.value })}
                placeholder="50"
                className="input-field h-12 bg-secondary-50 border-secondary-100 w-full font-mono"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                Reference No.
              </label>
              <input
                type="text"
                value={recordForm.reference_no}
                onChange={(e) =>
                  setRecordForm({ ...recordForm, reference_no: e.target.value })
                }
                placeholder="GRN-2026-04-001"
                className="input-field h-12 bg-secondary-50 border-secondary-100 w-full font-mono"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                Performed By
              </label>
              <select
                value={recordForm.performed_by_staff_id ?? ""}
                onChange={(e) =>
                  setRecordForm({
                    ...recordForm,
                    performed_by_staff_id: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="input-field h-12 bg-secondary-50 border-secondary-100 w-full"
              >
                <option value="">Anonymous (system)</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {staffDisplayName(s)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500 flex items-center gap-1">
                <FileText className="h-3 w-3" /> Note
              </label>
              <textarea
                value={recordForm.note}
                onChange={(e) => setRecordForm({ ...recordForm, note: e.target.value })}
                placeholder="Why this movement is being recorded..."
                className="input-field h-24 bg-secondary-50 border-secondary-100 w-full resize-none py-3"
              />
            </div>
          </div>

          <div className="pt-6 flex gap-4">
            <button
              onClick={() => setRecordOpen(false)}
              disabled={recordSaving}
              className="flex-1 btn-secondary py-4 rounded-2xl font-bold"
            >
              Cancel
            </button>
            <button
              onClick={handleRecord}
              disabled={recordSaving}
              className="flex-[2] btn-primary py-4 rounded-2xl font-black tracking-tight shadow-xl shadow-primary-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {recordSaving ? "Recording..." : "Record Movement"}
            </button>
          </div>
        </ModalShell>
      )}

      {/* Transfer Modal */}
      {transferOpen && (
        <ModalShell
          title="Transfer Stock"
          subtitle="Move A Batch Between Stores"
          onClose={() => !transferSaving && setTransferOpen(false)}
          icon={ArrowLeftRight}
          tone="amber"
        >
          {transferError && (
            <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-bold">{transferError}</span>
            </div>
          )}
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500 flex items-center gap-1">
                <ArrowUpFromLine className="h-3 w-3" /> Source Stock Item *
              </label>
              <select
                value={transferForm.from_stock_item_id}
                onChange={(e) =>
                  setTransferForm({ ...transferForm, from_stock_item_id: e.target.value })
                }
                className="input-field h-12 bg-secondary-50 border-secondary-100 w-full"
              >
                <option value="">Pick the source item...</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.item_name} · {storeName(i.store_id)} (qty {i.quantity_on_hand})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500 flex items-center gap-1">
                <ArrowDownToLine className="h-3 w-3" /> Destination Store *
              </label>
              <select
                value={transferForm.to_store_id}
                onChange={(e) =>
                  setTransferForm({ ...transferForm, to_store_id: e.target.value })
                }
                className="input-field h-12 bg-secondary-50 border-secondary-100 w-full"
              >
                <option value="">Pick the destination...</option>
                {stores
                  .filter((s) => {
                    const from = items.find(
                      (i) => i.id === Number(transferForm.from_stock_item_id),
                    );
                    return !from || s.id !== from.store_id;
                  })
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500 flex items-center gap-1">
                <Sigma className="h-3 w-3" /> Quantity *
              </label>
              <input
                type="number"
                step="any"
                value={transferForm.quantity}
                onChange={(e) =>
                  setTransferForm({ ...transferForm, quantity: e.target.value })
                }
                placeholder="20"
                className="input-field h-12 bg-secondary-50 border-secondary-100 w-full font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                Performed By
              </label>
              <select
                value={transferForm.performed_by_staff_id ?? ""}
                onChange={(e) =>
                  setTransferForm({
                    ...transferForm,
                    performed_by_staff_id: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="input-field h-12 bg-secondary-50 border-secondary-100 w-full"
              >
                <option value="">Anonymous (system)</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {staffDisplayName(s)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500 flex items-center gap-1">
                <Truck className="h-3 w-3" /> Note
              </label>
              <textarea
                value={transferForm.note}
                onChange={(e) => setTransferForm({ ...transferForm, note: e.target.value })}
                placeholder="Reason for transfer, vehicle/courier details..."
                className="input-field h-24 bg-secondary-50 border-secondary-100 w-full resize-none py-3"
              />
            </div>
          </div>

          <div className="pt-6 flex gap-4">
            <button
              onClick={() => setTransferOpen(false)}
              disabled={transferSaving}
              className="flex-1 btn-secondary py-4 rounded-2xl font-bold"
            >
              Cancel
            </button>
            <button
              onClick={handleTransfer}
              disabled={transferSaving}
              className="flex-[2] py-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black tracking-tight shadow-xl shadow-amber-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <ArrowLeftRight className="h-4 w-4" />
              {transferSaving ? "Transferring..." : "Transfer Stock"}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

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
  icon: typeof History;
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

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  icon: Icon,
  tone = "primary",
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
  icon: typeof Plus;
  tone?: "primary" | "amber";
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6 animate-fade-in">
      <div className="bg-white rounded-[2.5rem] p-10 max-w-2xl w-full shadow-2xl relative animate-slide-up max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-3 hover:bg-secondary-50 rounded-2xl transition-all"
        >
          <X className="h-5 w-5 text-secondary-400" />
        </button>
        <div className="flex items-center gap-5 mb-8">
          <div
            className={`h-14 w-14 rounded-2xl text-white flex items-center justify-center shadow-xl ${
              tone === "amber" ? "bg-amber-500 shadow-amber-500/20" : "bg-primary-600 shadow-primary-500/20"
            }`}
          >
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-black font-display tracking-tight">{title}</h3>
            <p className="text-secondary-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
              {subtitle}
            </p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
