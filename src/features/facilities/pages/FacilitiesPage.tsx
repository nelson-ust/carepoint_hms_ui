import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Globe,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import {
  facilitiesApi,
  facilityStatusLabel,
  facilityTypeLabel,
  type Facility,
  type FacilityStatus,
} from "../api/facilities.api";
import { FacilityFormModal } from "../components/FacilityFormModal";

const STATUS_FILTERS: ("" | FacilityStatus)[] = [
  "",
  "ACTIVE",
  "INACTIVE",
  "UNDER_CONSTRUCTION",
  "DECOMMISSIONED",
];

function statusVariant(
  status: FacilityStatus,
): "soft-success" | "soft-warning" | "soft-danger" | "secondary" {
  switch (status) {
    case "ACTIVE":
      return "soft-success";
    case "UNDER_CONSTRUCTION":
    case "INACTIVE":
      return "soft-warning";
    case "DECOMMISSIONED":
      return "soft-danger";
    default:
      return "secondary";
  }
}

function addressLine(f: Facility): string {
  return [f.address_line_1, f.city, f.state, f.country].filter(Boolean).join(", ") || "—";
}

export function FacilitiesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | FacilityStatus>("");
  const [formFor, setFormFor] = useState<Facility | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Facility | null>(null);

  const facilitiesQuery = useQuery({
    queryKey: ["facilities", "list"],
    queryFn: facilitiesApi.list,
  });

  const facilities = facilitiesQuery.data ?? [];
  const loadError = facilitiesQuery.error
    ? apiErrorMessage(facilitiesQuery.error, "Unable to load facilities. Please retry.")
    : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return facilities.filter((f) => {
      if (statusFilter && f.status !== statusFilter) return false;
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        f.code.toLowerCase().includes(q) ||
        (f.city || "").toLowerCase().includes(q) ||
        (f.state || "").toLowerCase().includes(q)
      );
    });
  }, [facilities, search, statusFilter]);

  const activeCount = facilities.filter((f) => f.status === "ACTIVE").length;
  const retiredCount = facilities.filter((f) => f.status === "DECOMMISSIONED").length;

  const removeMut = useMutation({
    mutationFn: (id: number) => facilitiesApi.remove(id),
    onSuccess: () => {
      toast.success("Facility deleted", "The facility has been removed.");
      queryClient.invalidateQueries({ queryKey: ["facilities"] });
    },
    onError: (err) =>
      toast.error("Couldn't delete facility", apiErrorMessage(err, "Please try again.")),
  });

  const openCreate = () => {
    setFormFor(null);
    setShowForm(true);
  };
  const openEdit = (f: Facility) => {
    setFormFor(f);
    setShowForm(true);
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <PageHeader
          title="Facilities"
          description="Manage your hospital branches, clinics and service sites."
        />
        <div className="flex gap-3">
          <button
            onClick={() => facilitiesQuery.refetch()}
            className="btn-secondary rounded-2xl border-secondary-400 bg-white/80 p-4"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${facilitiesQuery.isFetching ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={openCreate}
            className="btn-primary gap-3 px-8 py-3 shadow-xl shadow-primary-500/20"
          >
            <Plus className="h-5 w-5" />
            <span className="font-bold">Add Facility</span>
          </button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="glass-card rounded-[2rem] border border-secondary-400/50 bg-white/40 p-6">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-900 text-white">
            <Building2 className="h-6 w-6" />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-secondary-400">
            Total Facilities
          </p>
          <p className="text-3xl font-black text-secondary-900">
            {facilitiesQuery.isLoading ? "…" : facilities.length}
          </p>
        </div>
        <div className="glass-card rounded-[2rem] border border-secondary-400/50 bg-white/40 p-6">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-secondary-400">Active</p>
          <p className="text-3xl font-black text-emerald-600">
            {facilitiesQuery.isLoading ? "…" : activeCount}
          </p>
        </div>
        <div className="glass-card rounded-[2rem] border border-secondary-400/50 bg-white/40 p-6">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500 text-white">
            <AlertCircle className="h-6 w-6" />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-secondary-400">
            Decommissioned
          </p>
          <p className="text-3xl font-black text-rose-500">
            {facilitiesQuery.isLoading ? "…" : retiredCount}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="group relative w-full max-w-sm">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400 transition-colors group-focus-within:text-primary-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code or city…"
            className="w-full rounded-2xl border border-secondary-400 bg-white/60 py-3 pl-12 pr-6 text-sm font-medium outline-none transition-all focus:border-primary-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "" | FacilityStatus)}
          className="rounded-2xl border border-secondary-400 bg-white/80 px-4 py-3 text-xs font-bold uppercase tracking-widest text-secondary-700 outline-none focus:border-primary-500"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s || "all"} value={s}>
              {s ? facilityStatusLabel(s) : "All statuses"}
            </option>
          ))}
        </select>
      </div>

      {loadError && (
        <div className="flex items-center justify-between gap-4 rounded-[2rem] border border-rose-100 bg-rose-50 p-6 text-rose-600">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6" />
            <p className="text-sm font-bold">{loadError}</p>
          </div>
          <button
            onClick={() => facilitiesQuery.refetch()}
            className="btn-secondary px-5 py-2 text-xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {facilitiesQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-[2.5rem] bg-white/40" />
          ))
        ) : filtered.length === 0 && !loadError ? (
          <div className="col-span-full rounded-[3rem] border-2 border-dashed border-secondary-400 bg-white/20 py-24 text-center">
            <Building2 className="mx-auto mb-4 h-12 w-12 text-secondary-200" />
            <h4 className="text-lg font-bold text-secondary-900">
              {search || statusFilter ? "No matching facilities" : "No facilities yet"}
            </h4>
            <p className="mt-2 text-sm text-secondary-400">
              {search || statusFilter
                ? "Try a different search or status filter."
                : "Add your first facility to start issuing cards and running operations."}
            </p>
            {!search && !statusFilter && (
              <button onClick={openCreate} className="btn-primary mt-6 gap-2 px-6 py-3">
                <Plus className="h-4 w-4" /> Add Facility
              </button>
            )}
          </div>
        ) : (
          filtered.map((f) => (
            <div
              key={f.id}
              className="glass-card group relative overflow-hidden rounded-[2.5rem] border border-secondary-400/50 bg-white/40 p-8 transition-all hover:bg-white/60"
            >
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary-500/5 blur-xl" />
              <div className="mb-6 flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary-900 text-white shadow-lg transition-transform group-hover:scale-110">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-secondary-900">{f.name}</h4>
                    <p className="data-mono mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-400">
                      {f.code} · {facilityTypeLabel(f.facility_type)}
                    </p>
                  </div>
                </div>
                <Badge variant={statusVariant(f.status)}>{facilityStatusLabel(f.status)}</Badge>
              </div>

              <div className="space-y-2 border-t border-secondary-400/50 pt-5 text-sm text-secondary-600">
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-secondary-400" />
                  <span className="truncate">{addressLine(f)}</span>
                </p>
                {f.phone_number ? (
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 shrink-0 text-secondary-400" />
                    <span>{f.phone_number}</span>
                  </p>
                ) : null}
                {f.email ? (
                  <p className="flex items-center gap-2">
                    <Mail className="h-4 w-4 shrink-0 text-secondary-400" />
                    <span className="truncate">{f.email}</span>
                  </p>
                ) : null}
                {f.network?.name ? (
                  <p className="flex items-center gap-2">
                    <Globe className="h-4 w-4 shrink-0 text-secondary-400" />
                    <span className="truncate">{f.network.name}</span>
                  </p>
                ) : null}
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => openEdit(f)}
                  className="flex h-10 items-center gap-2 rounded-xl bg-secondary-900 px-4 text-xs font-bold text-white transition-all hover:bg-primary-600"
                >
                  <Pencil className="h-4 w-4" /> Edit
                </button>
                <button
                  onClick={() => setDeleteTarget(f)}
                  className="flex h-10 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-xs font-bold text-rose-600 transition-all hover:bg-rose-100"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <FacilityFormModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        facility={formFor}
        onSaved={() => facilitiesQuery.refetch()}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await removeMut.mutateAsync(deleteTarget.id);
        }}
        title="Delete facility"
        description={
          deleteTarget
            ? `Delete "${deleteTarget.name}"? If it is linked to existing records you'll be asked to decommission it instead. This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete facility"
        tone="danger"
      />
    </div>
  );
}
