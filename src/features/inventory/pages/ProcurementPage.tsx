import {
  ShoppingCart,
  Plus,
  RotateCcw,
  Truck,
  Clock,
  Layers,
  ArrowUpRight,
  Trash2,
  Boxes,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import {
  DxPage, DxPageHeader, DxPanel, DxGrid, DxBadge, DxButton, DxInput, DxSelect, DxTextarea, DxPopup, DxMessage,
  type DxGridColumn, type DxBadgeTone,
} from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { listDepartments, type Department } from "@/features/staff/api/staff-admin.api";
import {
  procurementApi,
  REQUISITION_STATUS_LABEL,
  type Requisition,
  type ProcurementStats,
} from "../api/procurement.api";

type ItemRow = {
  item_name: string;
  quantity_requested: string;
  estimated_unit_price: string;
  unit_of_measure: string;
};

const emptyItem: ItemRow = {
  item_name: "",
  quantity_requested: "1",
  estimated_unit_price: "0",
  unit_of_measure: "",
};

function money(v?: number | null): string {
  return `₦${Number(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function statusTone(status: string): DxBadgeTone {
  switch (status) {
    case "DRAFT": return "neutral";
    case "SUBMITTED": return "warning";
    case "DEPARTMENT_APPROVED": return "info";
    case "FINANCE_APPROVED":
    case "CONVERTED_TO_PO": return "success";
    case "CONVERTED_TO_RFQ": return "info";
    case "REJECTED":
    case "CANCELLED": return "danger";
    default: return "neutral";
  }
}

export function ProcurementPage() {
  const toast = useToast();
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [stats, setStats] = useState<ProcurementStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [departments, setDepartments] = useState<Department[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<{
    department_id: string;
    needed_by: string;
    justification: string;
    items: ItemRow[];
  }>({ department_id: "", needed_by: "", justification: "", items: [{ ...emptyItem }] });

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [list, statData] = await Promise.all([
        procurementApi.listRequisitions({ limit: 100 }),
        procurementApi.getStats().catch(() => null),
      ]);
      setRequisitions(list.items || []);
      if (statData) setStats(statData);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to fetch procurement requisitions."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    listDepartments({ limit: 200 }).then(setDepartments).catch(() => setDepartments([]));
  }, []);

  const formTotal = useMemo(
    () =>
      form.items.reduce(
        (sum, it) => sum + (Number(it.quantity_requested) || 0) * (Number(it.estimated_unit_price) || 0),
        0,
      ),
    [form.items],
  );

  const openCreate = () => {
    setForm({ department_id: "", needed_by: "", justification: "", items: [{ ...emptyItem }] });
    setCreateOpen(true);
  };

  const updateItem = (i: number, patch: Partial<ItemRow>) =>
    setForm((f) => ({ ...f, items: f.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }));
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { ...emptyItem }] }));
  const removeItem = (i: number) =>
    setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const handleCreate = async () => {
    const items = form.items
      .filter((it) => it.item_name.trim())
      .map((it) => ({
        item_name: it.item_name.trim(),
        quantity_requested: Math.max(1, Number(it.quantity_requested) || 0),
        estimated_unit_price: Number(it.estimated_unit_price) || 0,
        unit_of_measure: it.unit_of_measure.trim() || undefined,
      }));
    if (items.length === 0) {
      toast.error("Add at least one item", "A requisition needs at least one line item.");
      return;
    }
    setSubmitting(true);
    try {
      await procurementApi.createRequisition({
        department_id: form.department_id ? Number(form.department_id) : undefined,
        needed_by: form.needed_by || undefined,
        justification: form.justification.trim() || undefined,
        items,
      });
      toast.success("Requisition created", "The stock request has been raised as a draft.");
      setCreateOpen(false);
      load();
    } catch (err) {
      toast.error("Couldn't create requisition", apiErrorMessage(err, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const columns: DxGridColumn<Requisition>[] = [
    {
      key: "req", header: "Request ID", render: (req) => (
        <div className="flex flex-col">
          <span className="text-[13px] font-semibold text-[var(--dx-text)]">{req.requisition_no}</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">
            {req.created_at ? new Date(req.created_at).toLocaleDateString() : "—"}{req.requested_by_name ? ` · ${req.requested_by_name}` : ""}
          </span>
        </div>
      ),
    },
    { key: "dept", header: "Department", render: (req) => <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">{req.department_name || "—"}</span> },
    { key: "value", header: "Value", render: (req) => <span className="dx-mono text-[13px] font-semibold text-[var(--dx-text)]">{money(req.estimated_total)}</span> },
    { key: "status", header: "Status", render: (req) => <DxBadge tone={statusTone(req.status)}>{REQUISITION_STATUS_LABEL[req.status] || req.status}</DxBadge> },
    {
      key: "details", header: "", align: "right",
      render: (req) => <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--dx-text-muted)]">{req.items?.length ?? 0} item{(req.items?.length ?? 0) === 1 ? "" : "s"}<ArrowUpRight className="h-4 w-4" /></span>,
    },
  ];

  const numCls = "dx-editor";
  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Inventory" }, { label: "Procurement" }]}
        title="Procurement & Requisitions"
        subtitle="Manage stock requests, purchase orders, and supplier deliveries."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={load} isLoading={isLoading}><RotateCcw /></DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Create requisition</DxButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Stats */}
        <div className="space-y-4 lg:col-span-1">
          <DxPanel title="Supply Chain Health" icon={<Truck className="h-4 w-4" />}>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] px-3 py-2.5">
                <span className="flex items-center gap-2 text-[13px] font-medium text-[var(--dx-text-muted)]"><Truck className="h-4 w-4" /> Open Requisitions</span>
                <span className="text-[18px] font-bold text-[var(--dx-text)]">{stats ? stats.open_requisitions : "—"}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] px-3 py-2.5">
                <span className="flex items-center gap-2 text-[13px] font-medium text-[var(--dx-text-muted)]"><Clock className="h-4 w-4" /> Pending Approval</span>
                <span className="text-[18px] font-bold" style={{ color: "var(--dx-warning)" }}>{stats ? stats.pending_approval : "—"}</span>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--dx-border)] pt-3">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">Committed value</span>
                <span className="dx-mono text-[13px] font-bold text-[var(--dx-text)]">{stats ? money(stats.total_estimated_value) : "—"}</span>
              </div>
            </div>
          </DxPanel>

          <DxPanel>
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]"><Boxes className="h-5 w-5" /></div>
            <h4 className="text-[15px] font-bold text-[var(--dx-text)]">Inventory Re-order</h4>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--dx-text-muted)]">
              {stats && stats.low_stock_items > 0
                ? `${stats.low_stock_items} item${stats.low_stock_items > 1 ? "s are" : " is"} below the safety threshold and require replenishment.`
                : stats ? "All tracked stock is above its re-order level." : "Checking stock levels…"}
            </p>
            <DxButton className="mt-4" size="sm" variant="accent-text" onClick={openCreate}>Raise requisition →</DxButton>
          </DxPanel>
        </div>

        {/* Requisitions */}
        <div className="space-y-4 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-3 text-[16px] font-bold text-[var(--dx-text)]"><Layers className="h-5 w-5 text-[var(--dx-accent)]" /> Recent Requisitions</h3>
            <span className="text-[12px] font-semibold text-[var(--dx-text-muted)]">{requisitions.length} shown{stats ? ` · ${stats.total_requisitions} total` : ""}</span>
          </div>

          {error ? <DxMessage tone="danger" action={<DxButton size="sm" onClick={load}>Retry</DxButton>}>{error}</DxMessage> : null}

          <DxPanel flush>
            <DxGrid
              columns={columns}
              data={requisitions}
              rowKey={(r) => r.id}
              isLoading={isLoading}
              empty={{ icon: ShoppingCart, title: "No Requisitions Found", description: "Active stock requests will appear here.", action: <DxButton size="sm" variant="primary" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={openCreate}>Create requisition</DxButton> }}
            />
          </DxPanel>
        </div>
      </div>

      {/* Create Requisition */}
      <DxPopup
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Requisition"
        size="xl"
        locked={submitting}
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <span className="text-[13px] font-semibold text-[var(--dx-text)]">Estimated total: {money(formTotal)}</span>
            <div className="flex gap-3">
              <DxButton onClick={() => setCreateOpen(false)} disabled={submitting}>Cancel</DxButton>
              <DxButton variant="primary" onClick={handleCreate} isLoading={submitting}>Create requisition</DxButton>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <DxSelect label="Department" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
              <option value="">Unassigned</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </DxSelect>
            <DxInput label="Needed by" type="date" value={form.needed_by} onChange={(e) => setForm({ ...form, needed_by: e.target.value })} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="dx-field-label">Items</span>
              <DxButton size="sm" variant="accent-text" leftIcon={<Plus className="h-4 w-4" />} onClick={addItem}>Add item</DxButton>
            </div>
            <div className="space-y-2">
              {form.items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 items-start gap-2 rounded-md border border-[var(--dx-border)] p-3">
                  <input className={`${numCls} col-span-5`} placeholder="Item name" value={it.item_name} onChange={(e) => updateItem(i, { item_name: e.target.value })} />
                  <input className={`${numCls} col-span-2`} type="number" min={1} placeholder="Qty" value={it.quantity_requested} onChange={(e) => updateItem(i, { quantity_requested: e.target.value })} />
                  <input className={`${numCls} col-span-2`} placeholder="Unit" value={it.unit_of_measure} onChange={(e) => updateItem(i, { unit_of_measure: e.target.value })} />
                  <input className={`${numCls} col-span-2`} type="number" min={0} placeholder="Unit price" value={it.estimated_unit_price} onChange={(e) => updateItem(i, { estimated_unit_price: e.target.value })} />
                  <div className="col-span-1 flex justify-center">
                    <DxButton icon size="sm" variant="outline-danger" onClick={() => removeItem(i)} disabled={form.items.length === 1} title="Remove"><Trash2 /></DxButton>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DxTextarea label="Justification (optional)" rows={2} value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} placeholder="Why is this requisition needed?" />
        </div>
      </DxPopup>
    </DxPage>
  );
}
