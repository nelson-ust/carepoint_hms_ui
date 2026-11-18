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
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import {
  DxPage,
  DxPageHeader,
  DxPanel,
  DxKpi,
  DxBadge,
  DxButton,
  DxInput,
  DxSelect,
  DxPopup,
  DxMessage,
  type DxBadgeTone,
} from "@/components/dx";
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

function statusTone(status: FacilityStatus): DxBadgeTone {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "UNDER_CONSTRUCTION":
    case "INACTIVE":
      return "warning";
    case "DECOMMISSIONED":
      return "danger";
    default:
      return "neutral";
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

  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await removeMut.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Operations" }, { label: "Facilities" }]}
        title="Facilities"
        subtitle="Manage your hospital branches, clinics and service sites."
        actions={
          <>
            <DxButton
              icon
              title="Refresh"
              onClick={() => facilitiesQuery.refetch()}
              isLoading={facilitiesQuery.isFetching}
            >
              <RotateCcw />
            </DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Add facility
            </DxButton>
          </>
        }
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DxKpi
          label="Total Facilities"
          value={facilitiesQuery.isLoading ? "…" : facilities.length}
          icon={Building2}
          tone="accent"
          isLoading={facilitiesQuery.isLoading}
        />
        <DxKpi
          label="Active"
          value={facilitiesQuery.isLoading ? "…" : activeCount}
          icon={CheckCircle2}
          tone="success"
          isLoading={facilitiesQuery.isLoading}
        />
        <DxKpi
          label="Decommissioned"
          value={facilitiesQuery.isLoading ? "…" : retiredCount}
          icon={AlertCircle}
          tone="danger"
          isLoading={facilitiesQuery.isLoading}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full max-w-sm">
          <DxInput
            leftIcon={<Search className="h-3.5 w-3.5" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code or city…"
          />
        </div>
        <DxSelect
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "" | FacilityStatus)}
          options={STATUS_FILTERS.map((s) => ({
            value: s,
            label: s ? facilityStatusLabel(s) : "All statuses",
          }))}
        />
      </div>

      {loadError ? (
        <DxMessage
          tone="danger"
          action={
            <DxButton size="sm" onClick={() => facilitiesQuery.refetch()}>
              Retry
            </DxButton>
          }
        >
          {loadError}
        </DxMessage>
      ) : null}

      {/* Grid */}
      {facilitiesQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="dx-skeleton h-48 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 && !loadError ? (
        <DxPanel>
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--dx-surface-sunken)]">
              <Building2 className="h-8 w-8 text-[var(--dx-text-faint)]" />
            </div>
            <h4 className="text-[16px] font-bold text-[var(--dx-text)]">
              {search || statusFilter ? "No matching facilities" : "No facilities yet"}
            </h4>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--dx-text-muted)]">
              {search || statusFilter
                ? "Try a different search or status filter."
                : "Add your first facility to start issuing cards and running operations."}
            </p>
            {!search && !statusFilter ? (
              <DxButton
                className="mx-auto mt-4"
                variant="primary"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={openCreate}
              >
                Add facility
              </DxButton>
            ) : null}
          </div>
        </DxPanel>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((f) => (
            <div
              key={f.id}
              className="flex flex-col rounded-lg border border-[var(--dx-border)] bg-[var(--dx-surface)] p-6 transition-colors hover:border-[var(--dx-border-strong)]"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-[15px] font-bold text-[var(--dx-text)]">{f.name}</h4>
                    <p className="dx-mono mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">
                      {f.code} · {facilityTypeLabel(f.facility_type)}
                    </p>
                  </div>
                </div>
                <DxBadge tone={statusTone(f.status)} dot>
                  {facilityStatusLabel(f.status)}
                </DxBadge>
              </div>

              <div className="space-y-2 border-t border-[var(--dx-border)] pt-4 text-[13px] text-[var(--dx-text-muted)]">
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-[var(--dx-text-faint)]" />
                  <span className="truncate">{addressLine(f)}</span>
                </p>
                {f.phone_number ? (
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 shrink-0 text-[var(--dx-text-faint)]" />
                    <span>{f.phone_number}</span>
                  </p>
                ) : null}
                {f.email ? (
                  <p className="flex items-center gap-2">
                    <Mail className="h-4 w-4 shrink-0 text-[var(--dx-text-faint)]" />
                    <span className="truncate">{f.email}</span>
                  </p>
                ) : null}
                {f.network?.name ? (
                  <p className="flex items-center gap-2">
                    <Globe className="h-4 w-4 shrink-0 text-[var(--dx-text-faint)]" />
                    <span className="truncate">{f.network.name}</span>
                  </p>
                ) : null}
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t border-[var(--dx-border)] pt-4">
                <DxButton size="sm" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(f)}>
                  Edit
                </DxButton>
                <DxButton
                  size="sm"
                  variant="outline-danger"
                  leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                  onClick={() => setDeleteTarget(f)}
                >
                  Delete
                </DxButton>
              </div>
            </div>
          ))}
        </div>
      )}

      <FacilityFormModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        facility={formFor}
        onSaved={() => facilitiesQuery.refetch()}
      />

      {/* Delete confirm */}
      <DxPopup
        isOpen={deleteTarget !== null}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete facility"
        size="sm"
        locked={deleting}
        footer={
          <>
            <DxButton onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </DxButton>
            <DxButton
              variant="danger"
              onClick={handleDelete}
              isLoading={deleting}
              leftIcon={<Trash2 className="h-4 w-4" />}
            >
              Delete facility
            </DxButton>
          </>
        }
      >
        <DxMessage tone="danger">
          {deleteTarget ? (
            <>
              Delete <strong>{deleteTarget.name}</strong>? If it is linked to existing records
              you'll be asked to decommission it instead. This action cannot be undone.
            </>
          ) : null}
        </DxMessage>
      </DxPopup>
    </DxPage>
  );
}
