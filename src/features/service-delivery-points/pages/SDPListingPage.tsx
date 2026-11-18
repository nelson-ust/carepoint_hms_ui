import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Plus,
  RotateCcw,
  Activity,
  Users,
  Trash2,
  Pencil,
  Power,
  MapPin,
  Search,
} from "lucide-react";
import {
  DxPage,
  DxPageHeader,
  DxPanel,
  DxBadge,
  DxButton,
  DxInput,
  DxSelect,
  DxCheckbox,
  DxPopup,
  DxMessage,
} from "@/components/dx";
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

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  ...SERVICE_POINT_TYPES.map((t) => ({ value: t, label: typeLabel(t) })),
];

export function SDPListingPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceDeliveryPoint | null>(null);
  const [toDelete, setToDelete] = useState<ServiceDeliveryPoint | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setSearch(searchInput), 250);
    return () => window.clearTimeout(id);
  }, [searchInput]);

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
      m.set(p.service_delivery_point_id, {
        waiting: p.waiting,
        serving: p.serving,
        total_today: p.total_today,
      });
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
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      setServiceDeliveryPointStatus(id, isActive),
    onSuccess: (_d, v) => {
      invalidate();
      toast.success(v.isActive ? "Point activated" : "Point deactivated");
    },
    onError: () => toast.error("Couldn't update status", "Please try again."),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteServiceDeliveryPoint(id),
    onSuccess: () => {
      invalidate();
      toast.success("Service point deleted");
    },
    onError: () => toast.error("Couldn't delete", "The point may have active queue tickets."),
  });

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (p: ServiceDeliveryPoint) => {
    setEditing(p);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteMutation.mutateAsync(toDelete.id);
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const isRefreshing = listQuery.isFetching || statsQuery.isFetching;

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Operations" }, { label: "Service Delivery Points" }]}
        title="Service Delivery Points"
        subtitle="Manage clinical service points (Triage, Lab, Pharmacy) and their associated queue prefixes."
        actions={
          <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            New service point
          </DxButton>
        }
      />

      {listQuery.isError ? (
        <DxMessage tone="danger">Failed to load service points.</DxMessage>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* KPI rail */}
        <div className="space-y-4 lg:col-span-1">
          <DxPanel>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">
              Active Points
            </p>
            <h4 className="mt-1 text-[26px] font-bold tracking-tight text-[var(--dx-text)]">
              {activeCount}
            </h4>
            <p className="mt-1 text-[11px] text-[var(--dx-text-muted)]">{sdps.length} configured</p>
          </DxPanel>
          <DxPanel>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">
              Total Queued Today
            </p>
            <h4 className="mt-1 text-[26px] font-bold tracking-tight text-[var(--dx-accent)]">
              {statsQuery.isLoading ? "—" : totalToday.toLocaleString()}
            </h4>
            <p className="mt-1 text-[11px] text-[var(--dx-text-muted)]">
              Tickets issued across all points
            </p>
          </DxPanel>
        </div>

        {/* SDP list */}
        <div className="space-y-5 lg:col-span-3">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <h3 className="flex items-center gap-2 text-[15px] font-bold text-[var(--dx-text)]">
              <Building2 className="h-5 w-5 text-[var(--dx-accent)]" />
              Operational Units
            </h3>
            <div className="flex flex-1 items-center gap-2 sm:flex-none sm:justify-end">
              <div className="flex-1 sm:w-56">
                <DxInput
                  leftIcon={<Search className="h-3.5 w-3.5" />}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search points…"
                />
              </div>
              <div className="w-40">
                <DxSelect
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  options={TYPE_OPTIONS}
                />
              </div>
              <DxButton
                icon
                title="Refresh"
                onClick={() => {
                  listQuery.refetch();
                  statsQuery.refetch();
                }}
                isLoading={isRefreshing}
              >
                <RotateCcw />
              </DxButton>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {listQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="dx-skeleton h-52 w-full" />)
            ) : filtered.length > 0 ? (
              filtered.map((sdp) => {
                const stat = statsById.get(sdp.id);
                const waiting = stat?.waiting ?? 0;
                const serving = stat?.serving ?? 0;
                return (
                  <div
                    key={sdp.id}
                    className="group relative flex flex-col rounded-lg border border-[var(--dx-border)] bg-[var(--dx-surface)] p-6 transition-colors hover:border-[var(--dx-border-strong)]"
                  >
                    <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <DxButton icon size="sm" variant="text" title="Edit" onClick={() => openEdit(sdp)}>
                        <Pencil />
                      </DxButton>
                      <DxButton
                        icon
                        size="sm"
                        variant="text"
                        title={sdp.is_active ? "Deactivate" : "Activate"}
                        disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ id: sdp.id, isActive: !sdp.is_active })}
                      >
                        <Power />
                      </DxButton>
                      <DxButton
                        icon
                        size="sm"
                        variant="outline-danger"
                        title="Delete"
                        onClick={() => setToDelete(sdp)}
                      >
                        <Trash2 />
                      </DxButton>
                    </div>

                    <div className="mb-5 flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]">
                        <Activity className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate text-[15px] font-bold text-[var(--dx-text)]">{sdp.name}</h4>
                        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">
                          {typeLabel(sdp.service_point_type)} · {sdp.code}
                        </p>
                      </div>
                    </div>

                    <div className="mb-4 flex flex-wrap items-center gap-3 text-[11px] text-[var(--dx-text-muted)]">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--dx-surface-sunken)] px-2.5 py-1 font-semibold">
                        Prefix: {sdp.queue_prefix || "—"}
                      </span>
                      {sdp.location_description ? (
                        <span className="inline-flex items-center gap-1 truncate">
                          <MapPin className="h-3.5 w-3.5" /> {sdp.location_description}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-auto flex items-center justify-between border-t border-[var(--dx-border)] pt-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-[var(--dx-text-faint)]" />
                        <span className="text-[12px] font-semibold text-[var(--dx-text-muted)]">
                          {statsQuery.isLoading ? "—" : `${waiting} waiting`}
                          {serving > 0 ? (
                            <span className="ml-1 font-medium text-[var(--dx-text-faint)]">· {serving} serving</span>
                          ) : null}
                        </span>
                      </div>
                      <DxBadge tone={sdp.is_active ? "success" : "danger"} dot>
                        {sdp.is_active ? "Operational" : "Inactive"}
                      </DxBadge>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full">
                <DxPanel>
                  <div className="py-16 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--dx-surface-sunken)]">
                      <Building2 className="h-8 w-8 text-[var(--dx-text-faint)]" />
                    </div>
                    <h4 className="text-[16px] font-bold text-[var(--dx-text)]">
                      {search || typeFilter ? "No matching points" : "No Service Points"}
                    </h4>
                    <p className="mx-auto mt-1 max-w-xs text-[13px] text-[var(--dx-text-muted)]">
                      {search || typeFilter
                        ? "Adjust your search or filter."
                        : "Create your first clinical unit to start processing patient queues."}
                    </p>
                  </div>
                </DxPanel>
              </div>
            )}
          </div>
        </div>
      </div>

      <SDPFormModal
        isOpen={modalOpen}
        point={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSaved={invalidate}
      />

      {/* Delete confirm */}
      <DxPopup
        isOpen={toDelete !== null}
        onClose={() => !deleting && setToDelete(null)}
        title="Delete service point?"
        size="sm"
        locked={deleting}
        footer={
          <>
            <DxButton onClick={() => setToDelete(null)} disabled={deleting}>
              Cancel
            </DxButton>
            <DxButton
              variant="danger"
              onClick={handleDelete}
              isLoading={deleting}
              leftIcon={<Trash2 className="h-4 w-4" />}
            >
              Delete
            </DxButton>
          </>
        }
      >
        <DxMessage tone="danger">
          {toDelete ? (
            <>
              <strong>{toDelete.name}</strong> will be removed. This can't be undone.
            </>
          ) : null}
        </DxMessage>
      </DxPopup>
    </DxPage>
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

function SDPFormModal({
  isOpen,
  point,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  point: ServiceDeliveryPoint | null;
  onClose: () => void;
  onSaved: () => void;
}) {
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

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

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
    onSuccess: () => {
      toast.success(isEdit ? "Service point updated" : "Service point created");
      onSaved();
      onClose();
    },
    onError: (err: any) => {
      const d = err?.response?.data?.detail || err?.response?.data?.message;
      toast.error("Couldn't save", typeof d === "string" ? d : "Check the fields and try again.");
    },
  });

  function submit() {
    if (!form.name.trim()) {
      toast.error("Missing name", "A name is required.");
      return;
    }
    if (!form.code.trim()) {
      toast.error("Missing code", "A unique code is required.");
      return;
    }
    if (!form.service_point_type) {
      toast.error("Missing type", "Select a service point type.");
      return;
    }
    save.mutate();
  }

  return (
    <DxPopup
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Service Point" : "New Service Point"}
      size="md"
      locked={save.isPending}
      footer={
        <>
          <DxButton onClick={onClose} disabled={save.isPending}>
            Cancel
          </DxButton>
          <DxButton variant="primary" onClick={submit} isLoading={save.isPending}>
            {isEdit ? "Save changes" : "Create point"}
          </DxButton>
        </>
      }
    >
      <div className="space-y-4">
        <DxInput
          label="Name"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Laboratory Desk"
        />
        <div className="grid grid-cols-2 gap-4">
          <DxInput
            label="Code"
            mono
            value={form.code}
            onChange={(e) => set("code", e.target.value.toUpperCase())}
            disabled={isEdit}
            hint={isEdit ? "Code can't be changed." : "Unique, e.g. LAB"}
          />
          <DxSelect
            label="Type"
            value={form.service_point_type}
            onChange={(e) => set("service_point_type", e.target.value)}
            options={SERVICE_POINT_TYPES.map((t) => ({ value: t, label: typeLabel(t) }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <DxInput
            label="Queue prefix"
            mono
            value={form.queue_prefix}
            onChange={(e) => set("queue_prefix", e.target.value.toUpperCase())}
            placeholder="e.g. LAB"
            hint="Shown on printed queue tickets."
          />
          <DxInput
            label="Location (optional)"
            value={form.location_description}
            onChange={(e) => set("location_description", e.target.value)}
            placeholder="e.g. Ground floor, Block B"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-[var(--dx-border)] px-4 py-3">
            <DxCheckbox
              label="Walk-in"
              checked={form.supports_walk_in}
              onChange={(e) => set("supports_walk_in", e.target.checked)}
            />
          </div>
          <div className="rounded-md border border-[var(--dx-border)] px-4 py-3">
            <DxCheckbox
              label="Appointments"
              checked={form.supports_appointments}
              onChange={(e) => set("supports_appointments", e.target.checked)}
            />
          </div>
          <div className="rounded-md border border-[var(--dx-border)] px-4 py-3">
            <DxCheckbox
              label="Active"
              checked={form.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
            />
          </div>
        </div>
      </div>
    </DxPopup>
  );
}
