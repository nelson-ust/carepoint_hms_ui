import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeftRight,
  Boxes,
  Hash,
  History,
  Package,
  Plus,
  RotateCcw,
  Search,
  Sliders,
  TrendingDown,
  TrendingUp,
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
  DxTextarea,
  DxPopup,
  DxMessage,
  formatDateTime,
  type DxBadgeTone,
  type DxGridColumn,
} from "@/components/dx";
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
import { apiErrorMessage } from "@/lib/api/api-error";

const INBOUND = ["RECEIPT", "TRANSFER_IN", "RETURN"];
const OUTBOUND = ["ISSUE", "TRANSFER_OUT", "WASTAGE"];

function movementTone(type: string): DxBadgeTone {
  if (INBOUND.includes(type)) return "success";
  if (OUTBOUND.includes(type)) return type === "WASTAGE" ? "danger" : "warning";
  return "neutral";
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
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to load stock movements."));
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
    const inbound = movements.filter((m) => INBOUND.includes(m.movement_type)).length;
    const outbound = movements.filter((m) => OUTBOUND.includes(m.movement_type)).length;
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
    } catch (err) {
      setRecordError(apiErrorMessage(err, "Failed to record movement."));
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
    } catch (err) {
      setTransferError(apiErrorMessage(err, "Failed to transfer stock."));
    } finally {
      setTransferSaving(false);
    }
  };

  const columns: DxGridColumn<StockMovement>[] = [
    {
      key: "movement_type",
      header: "Type",
      render: (m) => (
        <div className="space-y-1">
          <DxBadge tone={movementTone(m.movement_type)} dot>{m.movement_type.replace(/_/g, " ")}</DxBadge>
          <div className="dx-mono text-[11px] text-[var(--dx-text-faint)]">MOV-{m.id}</div>
        </div>
      ),
    },
    {
      key: "stock_item_id",
      header: "Item",
      accessor: (m) => items.find((i) => i.id === m.stock_item_id)?.item_name ?? "",
      render: (m) => {
        const sItem = items.find((i) => i.id === m.stock_item_id);
        return (
          <div className="min-w-0">
            <div className="truncate font-semibold text-[var(--dx-text)]">{sItem?.item_name ?? itemName(m.stock_item_id)}</div>
            {sItem?.sku ? (
              <span className="inline-flex items-center gap-1 dx-mono text-[11px] text-[var(--dx-text-muted)]">
                <Hash className="h-2.5 w-2.5" />
                {sItem.sku}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "store_id",
      header: "Store",
      accessor: (m) => storeName(m.store_id),
      render: (m) => (
        <span className="inline-flex items-center gap-1.5 text-[var(--dx-text-muted)]">
          <Package className="h-3 w-3" />
          {storeName(m.store_id)}
        </span>
      ),
    },
    {
      key: "quantity",
      header: "Qty",
      align: "right",
      accessor: (m) => m.quantity,
      render: (m) => {
        const outbound = OUTBOUND.includes(m.movement_type);
        return (
          <span
            className="dx-mono font-semibold"
            style={{ color: outbound ? "var(--dx-danger)" : "var(--dx-success)" }}
          >
            {outbound ? "−" : "+"}{Math.abs(m.quantity)}
          </span>
        );
      },
    },
    {
      key: "balance_after",
      header: "Balance",
      align: "right",
      accessor: (m) => m.balance_after,
      render: (m) => <span className="dx-mono text-[var(--dx-text-muted)]">{m.balance_after ?? "—"}</span>,
    },
    {
      key: "reference_no",
      header: "Reference",
      wrap: true,
      render: (m) => (
        <div className="space-y-0.5">
          {m.reference_no ? <div className="dx-mono text-[12px] text-[var(--dx-text)]">{m.reference_no}</div> : null}
          {m.note ? <div className="text-[12px] italic text-[var(--dx-text-muted)]">{m.note}</div> : null}
          {!m.reference_no && !m.note ? <span className="text-[var(--dx-text-faint)]">—</span> : null}
        </div>
      ),
    },
    {
      key: "movement_date",
      header: "Date",
      align: "right",
      accessor: (m) => m.movement_date || m.created_at,
      render: (m) => <span className="text-[var(--dx-text-muted)]">{formatDateTime(m.movement_date || m.created_at)}</span>,
    },
  ];

  const storeItems = items.filter((i) =>
    !recordForm.store_id ? false : i.store_id === Number(recordForm.store_id),
  );

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Inventory" }, { label: "Movements" }]}
        title="Stock Movements"
        subtitle="Every receipt, issue, adjustment and transfer — your complete inventory ledger."
        actions={
          <>
            <Link to="/inventory/stores" className="dx-btn dx-btn-sm"><Package className="h-4 w-4" /> Stores</Link>
            <Link to="/inventory/items" className="dx-btn dx-btn-sm"><Boxes className="h-4 w-4" /> Items</Link>
            <DxButton icon title="Refresh" onClick={load} isLoading={isLoading}><RotateCcw /></DxButton>
            <DxButton leftIcon={<ArrowLeftRight className="h-4 w-4" />} onClick={openTransfer}>Transfer</DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openRecord}>Record movement</DxButton>
          </>
        }
      />

      {feedback ? (
        <DxMessage tone={feedback.tone === "success" ? "success" : "danger"}>{feedback.message}</DxMessage>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <DxKpi icon={History} label="Total Movements" value={stats.total} tone="accent" />
        <DxKpi icon={TrendingUp} label="Inbound" value={stats.inbound} tone="success" />
        <DxKpi icon={TrendingDown} label="Outbound" value={stats.outbound} tone="warning" />
        <DxKpi icon={Sliders} label="Adjustments" value={stats.adjustments} tone="neutral" />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="w-full flex-1">
          <DxInput
            leftIcon={<Search className="h-3.5 w-3.5" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reference, note, item, SKU…"
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
        <div className="w-full md:w-48">
          <DxSelect
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by type"
            options={[{ value: "", label: "All Types" }, ...MOVEMENT_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, " ") }))]}
          />
        </div>
      </div>

      {error ? (
        <DxMessage tone="danger" action={<DxButton size="sm" onClick={load}>Retry</DxButton>}>{error}</DxMessage>
      ) : (
        <DxPanel flush>
          <DxGrid<StockMovement>
            columns={columns}
            data={filtered}
            rowKey={(m) => m.id}
            isLoading={isLoading}
            empty={{
              icon: History,
              title: "No Movements",
              description: movements.length === 0 ? "Record the first stock movement to start the ledger." : "No movements match your filters.",
              action: <DxButton size="sm" variant="primary" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={openRecord}>Record movement</DxButton>,
            }}
          />
        </DxPanel>
      )}

      {/* Record Movement */}
      <DxPopup
        isOpen={recordOpen}
        onClose={() => !recordSaving && setRecordOpen(false)}
        title="Record Stock Movement"
        size="lg"
        locked={recordSaving}
        footer={
          <>
            <DxButton onClick={() => setRecordOpen(false)} disabled={recordSaving}>Cancel</DxButton>
            <DxButton variant="primary" onClick={handleRecord} isLoading={recordSaving} leftIcon={<Plus className="h-4 w-4" />}>Record movement</DxButton>
          </>
        }
      >
        <div className="space-y-4">
          {recordError ? <DxMessage tone="danger">{recordError}</DxMessage> : null}
          <div className="grid gap-4 md:grid-cols-2">
            <DxSelect
              label="Movement type"
              required
              fieldClassName="md:col-span-2"
              value={recordForm.movement_type}
              onChange={(e) => setRecordForm({ ...recordForm, movement_type: e.target.value })}
              options={MOVEMENT_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, " ") }))}
            />
            <DxSelect
              label="Store"
              required
              value={recordForm.store_id}
              onChange={(e) => setRecordForm({ ...recordForm, store_id: e.target.value, stock_item_id: "" })}
              placeholder="Pick a store…"
              options={stores.map((s) => ({ value: String(s.id), label: s.name }))}
            />
            <DxSelect
              label="Stock item"
              required
              value={recordForm.stock_item_id}
              onChange={(e) => setRecordForm({ ...recordForm, stock_item_id: e.target.value })}
              disabled={!recordForm.store_id}
              placeholder={recordForm.store_id ? "Pick an item…" : "Pick a store first"}
              options={storeItems.map((i) => ({ value: String(i.id), label: `${i.item_name} (qty ${i.quantity_on_hand})` }))}
            />
            <DxInput
              label="Quantity"
              required
              type="number"
              step="any"
              mono
              value={recordForm.quantity}
              onChange={(e) => setRecordForm({ ...recordForm, quantity: e.target.value })}
              placeholder="50"
            />
            <DxInput
              label="Reference no."
              mono
              value={recordForm.reference_no}
              onChange={(e) => setRecordForm({ ...recordForm, reference_no: e.target.value })}
              placeholder="GRN-2026-04-001"
            />
            <DxSelect
              label="Performed by"
              fieldClassName="md:col-span-2"
              value={recordForm.performed_by_staff_id ?? ""}
              onChange={(e) => setRecordForm({ ...recordForm, performed_by_staff_id: e.target.value ? Number(e.target.value) : null })}
              options={[{ value: "", label: "Anonymous (system)" }, ...staffList.map((s) => ({ value: String(s.id), label: staffDisplayName(s) }))]}
            />
            <DxTextarea
              label="Note"
              fieldClassName="md:col-span-2"
              rows={3}
              value={recordForm.note}
              onChange={(e) => setRecordForm({ ...recordForm, note: e.target.value })}
              placeholder="Why this movement is being recorded…"
            />
          </div>
        </div>
      </DxPopup>

      {/* Transfer */}
      <DxPopup
        isOpen={transferOpen}
        onClose={() => !transferSaving && setTransferOpen(false)}
        title="Transfer Stock"
        size="md"
        locked={transferSaving}
        footer={
          <>
            <DxButton onClick={() => setTransferOpen(false)} disabled={transferSaving}>Cancel</DxButton>
            <DxButton variant="primary" onClick={handleTransfer} isLoading={transferSaving} leftIcon={<ArrowLeftRight className="h-4 w-4" />}>Transfer stock</DxButton>
          </>
        }
      >
        <div className="space-y-4">
          {transferError ? <DxMessage tone="danger">{transferError}</DxMessage> : null}
          <DxMessage tone="info">Move a batch from its current store to another. A transfer-out and a matching transfer-in are both recorded.</DxMessage>
          <DxSelect
            label="Source stock item"
            required
            value={transferForm.from_stock_item_id}
            onChange={(e) => setTransferForm({ ...transferForm, from_stock_item_id: e.target.value })}
            placeholder="Pick the source item…"
            options={items.map((i) => ({ value: String(i.id), label: `${i.item_name} · ${storeName(i.store_id)} (qty ${i.quantity_on_hand})` }))}
          />
          <DxSelect
            label="Destination store"
            required
            value={transferForm.to_store_id}
            onChange={(e) => setTransferForm({ ...transferForm, to_store_id: e.target.value })}
            placeholder="Pick the destination…"
            options={stores
              .filter((s) => {
                const from = items.find((i) => i.id === Number(transferForm.from_stock_item_id));
                return !from || s.id !== from.store_id;
              })
              .map((s) => ({ value: String(s.id), label: `${s.name} (${s.code})` }))}
          />
          <DxInput
            label="Quantity"
            required
            type="number"
            step="any"
            mono
            value={transferForm.quantity}
            onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
            placeholder="20"
          />
          <DxSelect
            label="Performed by"
            value={transferForm.performed_by_staff_id ?? ""}
            onChange={(e) => setTransferForm({ ...transferForm, performed_by_staff_id: e.target.value ? Number(e.target.value) : null })}
            options={[{ value: "", label: "Anonymous (system)" }, ...staffList.map((s) => ({ value: String(s.id), label: staffDisplayName(s) }))]}
          />
          <DxTextarea
            label="Note"
            rows={3}
            value={transferForm.note}
            onChange={(e) => setTransferForm({ ...transferForm, note: e.target.value })}
            placeholder="Reason for transfer, vehicle/courier details…"
          />
        </div>
      </DxPopup>
    </DxPage>
  );
}
