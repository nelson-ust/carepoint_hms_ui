import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Plus,
  RefreshCw,
  Activity,
  Users,
  Trash2,
  Pencil,
  Power,
  MapPin,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { SearchInput } from "@/components/forms/SearchInput";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  listServiceDeliveryPoints,
  createServiceDeliveryPoint,
  updateServiceDeliveryPoint,
  setServiceDeliveryPointStatus,
  deleteServiceDeliveryPoint,
  getSdpQueueStats,
  type ServiceDeliveryPoint,
  type CreateServiceDeliveryPointPayload,
} from "../api/service-delivery-points.api";

const SERVICE_POINT_TYPES = [
  "REGISTRATION",
  "INSURANCE_CONFIRMATION",
  "TRIAGE",
  "CLINIC",
  "LABORATORY",
  "RADIOLOGY",
  "PHARMACY",
  "CASHIER",
  "WARD",
  "THEATRE",
  "EMERGENCY",
  "PROCEDURE_ROOM",
  "OTHER",
];

function typeLabel(t?: string | null): string {
  if (!t) return "—";
  return t
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const TYPE_OPTIONS = [{ value: "", label: "All types" }, ...SERVICE_POINT_TYPES.map((t) => ({ value: t, label: typeLabel(t) }))];

export function SDPListingPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceDeliveryPoint | null>(null);
  const [toDelete, setToDelete] = useState<ServiceDeliveryPoint | null>(null);

  const listQuery = useQuery({
    queryKey: ["service-delivery-points", "list"],
    queryFn: () => listServiceDeliveryPoints({ limit: 200 }),
  });
  const statsQuery = useQuery({
    queryKey: ["service-delivery-points", "queue-stats"],
    queryFn: () => getSdpQueueStats(),
    refetchInterval: 60000,
  });

  const sdps = listQuery.data?.items ?? [];
  const statsById = useMemo(() => {
    const m = new Map<number, { waiting: number; serving: number; total_today: number }>();
    for (const p of statsQuery.data?.points ?? []) {
      m.set(p.service_delivery_point_id, { waiting: p.waiting, serving: p.serving, total_today: p.total_today });
    }
    return m;
  }, [statsQuery.data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sdps.filter((p) => {
      if (typeFilter && p.service_point_type !== typeFilter) return false;
      if (!term) return true;
      return (
        p.name?.toLowerCase().includes(term) ||
        p.code?.toLowerCase().includes(term) ||
        p.service_point_type?.toLowerCase().includes(term) ||
        (p.location_description ?? "").toLowerCase().includes(term)
      );
    });
  }, [sdps, search, typeFilter]);

  const activeCount = sdps.filter((p) => p.is_active).length;
  const totalToday = statsQuery.data?.total_today ?? 0;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["service-delivery-points"] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => setServiceDeliveryPointStatus(id, isActive),
    onSuccess: (_d, v) => { invalidate(); toast.success(v.isActive ? "Point activated" : "Point deactivated"); },
    onError: () => toast.error("Couldn't update status", "Please try again."),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteServiceDeliveryPoint(id),
    onSuccess: () => { invalidate(); toast.success("Service point deleted"); },
    onError: () => toast.error("Couldn't delete", "The point may have active queue tickets."),
  });

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (p: ServiceDeliveryPoint) => { setEditing(p); setModalOpen(true); };

  const isRefreshing = listQuery.isFetching || statsQuery.isFetching;

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Service Delivery Points"
          description="Manage clinical service points (Triage, Lab, Pharmacy) and their associated queue prefixes."
        />
        <button onClick={openCreate} className="btn-primary gap-3 py-3 px-8 shadow-xl shadow-primary-500/20">
          <Plus className="h-5 w-5" />
          <span className="font-bold">New Service Point</span>
        </button>
      </div>

      {listQuery.isError && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center gap-3">
          <Building2 className="h-5 w-5" /><p className="text-sm font-bold">Failed to load service points.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* KPI Cards */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-card rounded-[2rem] p-6 border border-secondary-400/50 bg-white/40 shadow-premium">
            <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-2">Active Points</p>
            <h4 className="text-2xl font-black text-secondary-900">{activeCount}</h4>
            <p className="mt-1 text-[11px] text-secondary-400">{sdps.length} configured</p>
          </div>
          <div className="glass-card rounded-[2rem] p-6 border border-secondary-400/50 bg-white/40 shadow-premium">
            <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mb-2">Total Queued Today</p>
            <h4 className="text-2xl font-black text-primary-600">{statsQuery.isLoading ? "—" : totalToday.toLocaleString()}</h4>
            <p className="mt-1 text-[11px] text-secondary-400">Tickets issued across all points</p>
          </div>
        </div>

        {/* SDP List */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-secondary-900 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary-500" />
              Operational Units
            </h3>
            <div className="flex flex-1 sm:flex-none items-center gap-2 sm:justify-end">
              <SearchInput className="flex-1 sm:w-56" placeholder="Search points…" onSearch={setSearch} />
              <div className="w-40">
                <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} options={TYPE_OPTIONS} />
              </div>
              <button
                onClick={() => { listQuery.refetch(); statsQuery.refetch(); }}
                className="btn-secondary p-2.5 rounded-xl"
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {listQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
            ) : filtered.length > 0 ? (
              filtered.map((sdp) => {
                const stat = statsById.get(sdp.id);
                const waiting = stat?.waiting ?? 0;
                const serving = stat?.serving ?? 0;
                return (
                  <div key={sdp.id} className="glass-card rounded-[2.5rem] p-8 border border-secondary-400/50 bg-white/40 hover:bg-white/60 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(sdp)}
                        className="p-2 hover:bg-primary-50 text-secondary-400 hover:text-primary-600 rounded-xl"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => statusMutation.mutate({ id: sdp.id, isActive: !sdp.is_active })}
                        className="p-2 hover:bg-amber-50 text-secondary-400 hover:text-amber-600 rounded-xl"
                        title={sdp.is_active ? "Deactivate" : "Activate"}
                        disabled={statusMutation.isPending}
                      >
                        <Power className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setToDelete(sdp)}
                        className="p-2 hover:bg-rose-50 text-secondary-400 hover:text-rose-500 rounded-xl"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-5 mb-6">
                      <div className="h-14 w-14 rounded-2xl bg-secondary-900 text-white flex items-center justify-center shadow-lg shadow-secondary-900/10">
                        <Activity className="h-7 w-7" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-lg font-black text-secondary-900 truncate">{sdp.name}</h4>
                        <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest mt-1">
                          {typeLabel(sdp.service_point_type)} · {sdp.code}
                        </p>
                      </div>
                    </div>

                    <div className="mb-4 flex flex-wrap items-center gap-3 text-[11px] text-secondary-500">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary-500/5 px-2.5 py-1 font-bold">
                        Prefix: {sdp.queue_prefix || "—"}
                      </span>
                      {sdp.location_description ? (
                        <span className="inline-flex items-center gap-1 truncate">
                          <MapPin className="h-3.5 w-3.5" /> {sdp.location_description}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-secondary-100">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-secondary-400" />
                        <span className="text-xs font-bold text-secondary-600">
                          {statsQuery.isLoading ? "—" : `${waiting} waiting`}
                          {serving > 0 ? <span className="ml-1 font-medium text-secondary-400">· {serving} serving</span> : null}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${sdp.is_active ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                        {sdp.is_active ? "OPERATIONAL" : "INACTIVE"}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full py-24 text-center bg-white/20 rounded-[3rem] border-2 border-dashed border-secondary-400">
                <Building2 className="h-16 w-16 mx-auto text-secondary-100 mb-6" />
                <h4 className="text-xl font-bold text-secondary-900">
                  {search || typeFilter ? "No matching points" : "No Service Points"}
                </h4>
                <p className="text-secondary-500 mt-2 max-w-xs mx-auto">
                  {search || typeFilter
                    ? "Adjust your search or filter."
                    : "Create your first clinical unit to start processing patient queues."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <SDPFormModal
        isOpen={modalOpen}
        point={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSaved={invalidate}
      />

      <ConfirmDialog
        isOpen={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => { if (toDelete) deleteMutation.mutate(toDelete.id); }}
        title="Delete service point?"
        description={toDelete ? `"${toDelete.name}" will be removed. This can't be undone.` : undefined}
        confirmLabel="Delete"
        tone="danger"
      />
    </div>
  );
}

type FormState = {
  name: string;
  code: string;
  service_point_type: string;
  queue_prefix: string;
  location_description: string;
  supports_appointments: boolean;
  supports_walk_in: boolean;
  is_active: boolean;
};

const emptyForm: FormState = {
  name: "",
  code: "",
  service_point_type: "REGISTRATION",
  queue_prefix: "",
  location_description: "",
  supports_appointments: true,
  supports_walk_in: true,
  is_active: true,
};

function SDPFormModal({ isOpen, point, onClose, onSaved }: { isOpen: boolean; point: ServiceDeliveryPoint | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const isEdit = point !== null;
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    if (point) {
      setForm({
        name: point.name ?? "",
        code: point.code ?? "",
        service_point_type: point.service_point_type ?? "REGISTRATION",
        queue_prefix: point.queue_prefix ?? "",
        location_description: point.location_description ?? "",
        supports_appointments: !!point.supports_appointments,
        supports_walk_in: !!point.supports_walk_in,
        is_active: !!point.is_active,
      });
    } else {
      setForm(emptyForm);
    }
  }, [point, isOpen]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => {
      const payload: CreateServiceDeliveryPointPayload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        service_point_type: form.service_point_type,
        queue_prefix: form.queue_prefix.trim().toUpperCase() || undefined,
        location_description: form.location_description.trim() || undefined,
        supports_appointments: form.supports_appointments,
        supports_walk_in: form.supports_walk_in,
        is_active: form.is_active,
      };
      return isEdit
        ? updateServiceDeliveryPoint(point!.id, payload)
        : createServiceDeliveryPoint(payload);
    },
    onSuccess: () => { toast.success(isEdit ? "Service point updated" : "Service point created"); onSaved(); onClose(); },
    onError: (err: any) => {
      const d = err?.response?.data?.detail || err?.response?.data?.message;
      toast.error("Couldn't save", typeof d === "string" ? d : "Check the fields and try again.");
    },
  });

  function submit() {
    if (!form.name.trim()) { toast.error("Missing name", "A name is required."); return; }
    if (!form.code.trim()) { toast.error("Missing code", "A unique code is required."); return; }
    if (!form.service_point_type) { toast.error("Missing type", "Select a service point type."); return; }
    save.mutate();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Service Point" : "New Service Point"}
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} isLoading={save.isPending}>{isEdit ? "Save changes" : "Create point"}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label="Name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Laboratory Desk" />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Code"
            value={form.code}
            onChange={(e) => set("code", e.target.value.toUpperCase())}
            disabled={isEdit}
            hint={isEdit ? "Code can't be changed." : "Unique, e.g. LAB"}
          />
          <Select
            label="Type"
            value={form.service_point_type}
            onChange={(e) => set("service_point_type", e.target.value)}
            options={SERVICE_POINT_TYPES.map((t) => ({ value: t, label: typeLabel(t) }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Queue prefix" value={form.queue_prefix} onChange={(e) => set("queue_prefix", e.target.value.toUpperCase())} placeholder="e.g. LAB" hint="Shown on printed queue tickets." />
          <Input label="Location (optional)" value={form.location_description} onChange={(e) => set("location_description", e.target.value)} placeholder="e.g. Ground floor, Block B" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex items-center gap-2 rounded-2xl border border-secondary-200 px-4 py-3 text-sm font-semibold text-secondary-700 cursor-pointer">
            <input type="checkbox" checked={form.supports_walk_in} onChange={(e) => set("supports_walk_in", e.target.checked)} />
            Walk-in
          </label>
          <label className="flex items-center gap-2 rounded-2xl border border-secondary-200 px-4 py-3 text-sm font-semibold text-secondary-700 cursor-pointer">
            <input type="checkbox" checked={form.supports_appointments} onChange={(e) => set("supports_appointments", e.target.checked)} />
            Appointments
          </label>
          <label className="flex items-center gap-2 rounded-2xl border border-secondary-200 px-4 py-3 text-sm font-semibold text-secondary-700 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} />
            Active
          </label>
        </div>
      </div>
    </Modal>
  );
}
