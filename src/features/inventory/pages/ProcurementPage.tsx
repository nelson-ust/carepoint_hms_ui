import { PageHeader } from "@/components/layout/PageHeader";
import {
  ShoppingCart,
  Plus,
  RefreshCw,
  AlertCircle,
  Truck,
  Clock,
  Layers,
  ArrowUpRight,
  Trash2,
  Boxes,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { listDepartments, type Department } from "@/features/staff/api/staff-admin.api";
import {
  procurementApi,
  requisitionStatusStyle,
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

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Procurement & Requisitions"
          description="Manage stock requests, purchase orders, and supplier deliveries."
        />
        <div className="flex gap-3">
          <button
            onClick={load}
            className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400 transition-all active:scale-95"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={openCreate} className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
            <Plus className="h-5 w-5" />
            <span className="font-bold">Create Requisition</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* Stats */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 shadow-premium">
            <h4 className="text-[10px] font-bold text-secondary-400 uppercase tracking-[0.2em] mb-8">
              Supply Chain Health
            </h4>
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-secondary-700">Open Requisitions</span>
                  <span className="text-2xl font-black text-secondary-900">
                    {stats ? stats.open_requisitions : "—"}
                  </span>
                </div>
                <Truck className="h-8 w-8 text-secondary-200" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-secondary-700">Pending Approval</span>
                  <span className="text-2xl font-black text-amber-500">
                    {stats ? stats.pending_approval : "—"}
                  </span>
                </div>
                <Clock className="h-8 w-8 text-amber-200" />
              </div>
              <div className="pt-6 border-t border-secondary-400">
                <div className="flex items-center justify-between text-secondary-500">
                  <span className="text-[10px] font-black uppercase tracking-widest">Committed value</span>
                  <span className="text-sm font-black text-secondary-900">
                    {stats ? money(stats.total_estimated_value) : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-primary-900 text-white shadow-xl shadow-primary-900/20">
            <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
              <Boxes className="h-6 w-6" />
            </div>
            <h4 className="text-lg font-bold mb-2">Inventory Re-order</h4>
            <p className="text-sm text-primary-100 leading-relaxed mb-6">
              {stats && stats.low_stock_items > 0
                ? `${stats.low_stock_items} item${stats.low_stock_items > 1 ? "s are" : " is"} below the safety threshold and require replenishment.`
                : stats
                  ? "All tracked stock is above its re-order level."
                  : "Checking stock levels…"}
            </p>
            <button
              onClick={openCreate}
              className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 hover:translate-x-2 transition-transform"
            >
              Raise Requisition →
            </button>
          </div>
        </div>

        {/* Requisitions */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-secondary-900 flex items-center gap-3">
              <Layers className="h-5 w-5 text-primary-500" />
              Recent Requisitions
            </h3>
            <span className="text-xs font-bold text-secondary-400">
              {requisitions.length} shown{stats ? ` · ${stats.total_requisitions} total` : ""}
            </span>
          </div>

          {error && (
            <div className="p-6 rounded-[2rem] bg-rose-50 border border-rose-100 text-rose-600 flex items-center gap-4">
              <AlertCircle className="h-6 w-6" />
              <p className="text-sm font-bold">{error}</p>
            </div>
          )}

          <div className="glass-card rounded-[2.5rem] overflow-hidden border border-secondary-400/50 shadow-premium bg-white/40">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[720px]">
                <thead>
                  <tr className="bg-secondary-900/5">
                    <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Request ID</th>
                    <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Department</th>
                    <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Value</th>
                    <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500">Status</th>
                    <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-500 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-100/50">
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={5} className="px-8 py-6"><div className="h-10 bg-secondary-100/30 rounded-xl" /></td>
                      </tr>
                    ))
                  ) : requisitions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-32 text-center">
                        <ShoppingCart className="h-12 w-12 mx-auto text-secondary-200 mb-4" />
                        <h4 className="text-lg font-bold text-secondary-900">No Requisitions Found</h4>
                        <p className="text-sm text-secondary-400 mt-2">Active stock requests will appear here.</p>
                        <button onClick={openCreate} className="btn-primary mt-6 gap-2 px-6 py-3 inline-flex">
                          <Plus className="h-4 w-4" /> Create Requisition
                        </button>
                      </td>
                    </tr>
                  ) : (
                    requisitions.map((req) => (
                      <tr key={req.id} className="hover:bg-primary-50/20 transition-all group">
                        <td className="px-8 py-6">
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-secondary-900">{req.requisition_no}</span>
                            <span className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">
                              {req.created_at ? new Date(req.created_at).toLocaleDateString() : "—"}
                              {req.requested_by_name ? ` · ${req.requested_by_name}` : ""}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className="text-xs font-bold text-secondary-700 uppercase tracking-widest">
                            {req.department_name || "—"}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <span className="text-sm font-black text-secondary-900">{money(req.estimated_total)}</span>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${requisitionStatusStyle(req.status)}`}>
                            {REQUISITION_STATUS_LABEL[req.status] || req.status}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-secondary-400">
                            {req.items?.length ?? 0} item{(req.items?.length ?? 0) === 1 ? "" : "s"}
                            <ArrowUpRight className="h-4 w-4" />
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Create Requisition */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Requisition"
        size="xl"
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-black text-secondary-700">Estimated total: {money(formTotal)}</span>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={submitting}>Cancel</Button>
              <Button onClick={handleCreate} isLoading={submitting}>Create requisition</Button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Department"
              value={form.department_id}
              onChange={(e) => setForm({ ...form, department_id: e.target.value })}
            >
              <option value="">Unassigned</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
            <Input
              label="Needed by"
              type="date"
              value={form.needed_by}
              onChange={(e) => setForm({ ...form, needed_by: e.target.value })}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-secondary-500">Items</label>
              <Button size="sm" variant="ghost" leftIcon={<Plus className="h-4 w-4" />} onClick={addItem}>Add item</Button>
            </div>
            <div className="space-y-2">
              {form.items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start rounded-2xl border border-secondary-200 p-3 dark:border-white/10">
                  <input
                    className="input-field col-span-5"
                    placeholder="Item name"
                    value={it.item_name}
                    onChange={(e) => updateItem(i, { item_name: e.target.value })}
                  />
                  <input
                    className="input-field col-span-2"
                    type="number"
                    min={1}
                    placeholder="Qty"
                    value={it.quantity_requested}
                    onChange={(e) => updateItem(i, { quantity_requested: e.target.value })}
                  />
                  <input
                    className="input-field col-span-2"
                    placeholder="Unit"
                    value={it.unit_of_measure}
                    onChange={(e) => updateItem(i, { unit_of_measure: e.target.value })}
                  />
                  <input
                    className="input-field col-span-2"
                    type="number"
                    min={0}
                    placeholder="Unit price"
                    value={it.estimated_unit_price}
                    onChange={(e) => updateItem(i, { estimated_unit_price: e.target.value })}
                  />
                  <button
                    className="col-span-1 flex h-11 items-center justify-center rounded-xl text-rose-400 hover:bg-rose-50 disabled:opacity-30 dark:hover:bg-rose-500/10"
                    onClick={() => removeItem(i)}
                    disabled={form.items.length === 1}
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <Textarea
            label="Justification (optional)"
            rows={2}
            value={form.justification}
            onChange={(e) => setForm({ ...form, justification: e.target.value })}
            placeholder="Why is this requisition needed?"
          />
        </div>
      </Modal>
    </div>
  );
}
