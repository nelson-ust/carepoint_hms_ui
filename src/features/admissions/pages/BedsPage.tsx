import {
  DxPage, DxPageHeader, DxPanel, DxKpi, DxBadge, DxButton, DxPopup,
  DxInput, DxSelect, DxMessage,
  type DxBadgeTone,
} from "@/components/dx";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Bed as BedIcon,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Eye,
  Hash,
  Hospital,
  ListChecks,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";
import {
  BED_STATUSES,
  BED_TYPES,
  createBed,
  deleteBed,
  getBedSummary,
  listBeds,
  updateBed,
} from "../api/beds.api";
import type {
  Bed,
  BedSummary,
  CreateBedPayload,
  UpdateBedPayload,
} from "../api/beds.api";
import { listWards } from "../api/wards.api";
import type { Ward } from "../api/wards.api";
import { apiErrorMessage } from "@/lib/api/api-error";

type BedForm = {
  ward_id: string;
  bed_no: string;
  bed_status: string;
  bed_type: string;
  notes: string;
};

const emptyForm: BedForm = {
  ward_id: "",
  bed_no: "",
  bed_status: "AVAILABLE",
  bed_type: "STANDARD",
  notes: "",
};

const statusIcons: Record<string, typeof BedIcon> = {
  AVAILABLE: CheckCircle2,
  OCCUPIED: Users,
  RESERVED: Sparkles,
  OUT_OF_SERVICE: Settings2,
  MAINTENANCE: Wrench,
  CLEANING: Settings2,
};

export function BedsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialWard = searchParams.get("ward") ?? "";

  const [beds, setBeds] = useState<Bed[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    { tone: "success" | "error"; message: string } | null
  >(null);

  const [search, setSearch] = useState("");
  const [wardFilter, setWardFilter] = useState(initialWard);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [modal, setModal] = useState<{ open: boolean; editing: Bed | null }>({
    open: false,
    editing: null,
  });
  const [form, setForm] = useState<BedForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [detailBedId, setDetailBedId] = useState<number | null>(null);
  const [detailSummary, setDetailSummary] = useState<BedSummary | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<Bed | null>(null);
  const [deleting, setDeleting] = useState(false);

  const showFeedback = (tone: "success" | "error", message: string) => {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 3500);
  };

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [bedsRes, wardsRes] = await Promise.all([
        listBeds({
          skip: 0,
          limit: 1000,
          ward_id: wardFilter ? Number(wardFilter) : undefined,
          bed_status: statusFilter || undefined,
        }),
        listWards({ skip: 0, limit: 200 }).catch(() => null),
      ]);
      setBeds(bedsRes.items ?? []);
      setWards(wardsRes?.items ?? []);
    } catch (err: any) {
      setError(apiErrorMessage(err, "Unable to load beds. Please retry."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // sync wardFilter to URL
    if (wardFilter) {
      setSearchParams({ ward: wardFilter }, { replace: true });
    } else {
      searchParams.delete("ward");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wardFilter, statusFilter]);

  useEffect(() => {
    if (detailBedId == null) {
      setDetailSummary(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingDetail(true);
      try {
        const summary = await getBedSummary(detailBedId);
        if (!cancelled) setDetailSummary(summary);
      } catch {
        if (!cancelled) setDetailSummary(null);
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailBedId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return beds.filter((b) => {
      if (typeFilter && (b.bed_type || "") !== typeFilter) return false;
      if (!q) return true;
      return (
        b.bed_no?.toLowerCase().includes(q) ||
        b.bed_status?.toLowerCase().includes(q) ||
        b.bed_type?.toLowerCase().includes(q) ||
        b.notes?.toLowerCase().includes(q) ||
        b.ward?.name?.toLowerCase().includes(q) ||
        b.ward_name?.toLowerCase().includes(q) ||
        b.ward_code?.toLowerCase().includes(q)
      );
    });
  }, [beds, search, typeFilter]);

  const stats = useMemo(() => {
    const total = beds.length;
    const available = beds.filter((b) => b.bed_status === "AVAILABLE").length;
    const occupied = beds.filter((b) => b.bed_status === "OCCUPIED").length;
    const offline = beds.filter((b) =>
      ["OUT_OF_SERVICE", "MAINTENANCE", "CLEANING"].includes(b.bed_status),
    ).length;
    return { total, available, occupied, offline };
  }, [beds]);

  const wardName = (id: number) =>
    wards.find((w) => w.id === id)?.name ?? `Ward #${id}`;

  // Group beds by ward for the canvas-style display
  const groupedByWard = useMemo(() => {
    const map = new Map<number, Bed[]>();
    filtered.forEach((b) => {
      const arr = map.get(b.ward_id) ?? [];
      arr.push(b);
      map.set(b.ward_id, arr);
    });
    return Array.from(map.entries()).sort((a, b) => {
      const aName = wardName(a[0]);
      const bName = wardName(b[0]);
      return aName.localeCompare(bName);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, wards]);

  const openCreate = () => {
    setModal({ open: true, editing: null });
    setForm({
      ...emptyForm,
      ward_id: wardFilter || (wards[0] ? String(wards[0].id) : ""),
    });
    setSaveError(null);
  };

  const openEdit = (b: Bed) => {
    setModal({ open: true, editing: b });
    setForm({
      ward_id: String(b.ward_id),
      bed_no: b.bed_no ?? "",
      bed_status: b.bed_status ?? "AVAILABLE",
      bed_type: b.bed_type ?? "STANDARD",
      notes: b.notes ?? "",
    });
    setSaveError(null);
  };

  const closeModal = () => {
    if (saving) return;
    setModal({ open: false, editing: null });
  };

  const handleSave = async () => {
    if (!form.ward_id) {
      setSaveError("Pick a ward.");
      return;
    }
    if (!form.bed_no.trim()) {
      setSaveError("Bed number is required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      if (modal.editing) {
        const payload: UpdateBedPayload = {
          ward_id: Number(form.ward_id),
          bed_no: form.bed_no.trim(),
          bed_status: form.bed_status,
          bed_type: form.bed_type,
          notes: form.notes.trim() || undefined,
        };
        const updated = await updateBed(modal.editing.id, payload);
        setBeds((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
        showFeedback("success", "Bed updated.");
      } else {
        const payload: CreateBedPayload = {
          ward_id: Number(form.ward_id),
          bed_no: form.bed_no.trim(),
          bed_status: form.bed_status,
          bed_type: form.bed_type,
          notes: form.notes.trim() || undefined,
        };
        const created = await createBed(payload);
        setBeds((prev) =>
          [...prev, created].sort((a, b) => {
            if (a.ward_id !== b.ward_id) return a.ward_id - b.ward_id;
            return a.bed_no.localeCompare(b.bed_no);
          }),
        );
        showFeedback("success", "Bed added.");
      }
      setModal({ open: false, editing: null });
    } catch (err: any) {
      setSaveError(apiErrorMessage(err, "Failed to save bed. Please check the details and retry."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await deleteBed(confirmDelete.id);
      setBeds((prev) => prev.filter((b) => b.id !== confirmDelete.id));
      showFeedback("success", res.message || "Bed deleted.");
      setConfirmDelete(null);
    } catch (err: any) {
      showFeedback("error", apiErrorMessage(err, "Failed to delete bed."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Beds" }]}
        title="Beds"
        subtitle="Configure individual beds within each ward and monitor their real-time status."
        actions={
          <>
            <Link to="/wards" className="dx-btn"><Hospital /> Wards</Link>
            <Link to="/admissions" className="dx-btn"><ClipboardList /> Admissions</Link>
            <DxButton icon title="Refresh" onClick={load} isLoading={isLoading}><RefreshCw /></DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New bed</DxButton>
          </>
        }
      />

      {feedback ? <DxMessage tone={feedback.tone === "success" ? "success" : "danger"}>{feedback.message}</DxMessage> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <DxKpi label="Total beds" value={stats.total} icon={ListChecks} tone="accent" />
        <DxKpi label="Available" value={stats.available} icon={CheckCircle2} tone="success" />
        <DxKpi label="Occupied" value={stats.occupied} icon={Users} tone="danger" />
        <DxKpi label="Offline" value={stats.offline} icon={Wrench} tone="warning" />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <DxInput leftIcon={<Search className="h-3.5 w-3.5" />} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by bed #, type, ward, notes…" />
        </div>
        <div className="w-full md:w-44">
          <DxSelect value={wardFilter} onChange={(e) => setWardFilter(e.target.value)} aria-label="Filter by ward"
            options={[{ value: "", label: "All wards" }, ...wards.map((w) => ({ value: String(w.id), label: w.name ?? `Ward #${w.id}` }))]} />
        </div>
        <div className="w-full md:w-44">
          <DxSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status"
            options={[{ value: "", label: "All statuses" }, ...BED_STATUSES.map((s) => ({ value: s, label: s.replace("_", " ") }))]} />
        </div>
        <div className="w-full md:w-44">
          <DxSelect value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter by type"
            options={[{ value: "", label: "All types" }, ...BED_TYPES.map((t) => ({ value: t, label: t.replace("_", " ") }))]} />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="dx-skeleton h-6 w-48" />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
                {Array.from({ length: 6 }).map((_, j) => <div key={j} className="dx-skeleton h-32 w-full" />)}
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <DxPanel>
          <div className="py-12 text-center">
            <p className="mb-4 text-[13px] text-[var(--dx-danger)]">{error}</p>
            <DxButton className="mx-auto" variant="primary" onClick={load}>Try again</DxButton>
          </div>
        </DxPanel>
      ) : groupedByWard.length === 0 ? (
        <DxPanel>
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--dx-surface-sunken)]"><BedIcon className="h-8 w-8 text-[var(--dx-text-faint)]" /></div>
            <h4 className="text-[17px] font-bold text-[var(--dx-text)]">No beds</h4>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--dx-text-muted)]">{beds.length === 0 ? "Configure the first bed in a ward to get started." : "No beds match your filters."}</p>
            <DxButton className="mx-auto mt-4" variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add bed</DxButton>
          </div>
        </DxPanel>
      ) : (
        <div className="space-y-8">
          {groupedByWard.map(([wardId, list]) => {
            const ward = wards.find((w) => w.id === wardId);
            const groupAvailable = list.filter((b) => b.bed_status === "AVAILABLE").length;
            const groupOccupied = list.filter((b) => b.bed_status === "OCCUPIED").length;
            return (
              <div key={wardId}>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--dx-accent)] text-white"><Hospital className="h-5 w-5" /></div>
                    <div>
                      <h3 className="text-[16px] font-bold text-[var(--dx-text)]">{ward?.name ?? wardName(wardId)}</h3>
                      <p className="text-[11px] font-medium text-[var(--dx-text-muted)]">{list.length} beds · {groupAvailable} available · {groupOccupied} occupied</p>
                    </div>
                  </div>
                  {ward ? <Link to={`/admissions?ward=${ward.id}`} className="text-[11px] font-semibold uppercase tracking-wide text-[var(--dx-accent)] hover:underline">View admissions →</Link> : null}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {list.map((b) => (
                    <BedTile key={b.id} bed={b} onView={() => setDetailBedId(b.id)} onEdit={() => openEdit(b)} onDelete={() => setConfirmDelete(b)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      {modal.open ? (
        <ModalShell title={modal.editing ? "Edit bed" : "New bed"} subtitle="Configure an inpatient bed" onClose={closeModal} icon={modal.editing ? Edit3 : Plus}>
          {saveError ? <DxMessage tone="danger" className="mb-4">{saveError}</DxMessage> : null}
          <div className="space-y-4">
            <FieldLabel label="Ward *">
              <select value={form.ward_id} onChange={(e) => setForm({ ...form, ward_id: e.target.value })} className="dx-editor w-full">
                <option value="">Pick a ward…</option>
                {wards.map((w) => (<option key={w.id} value={w.id}>{w.name ?? `Ward #${w.id}`}</option>))}
              </select>
            </FieldLabel>
            <FieldLabel label="Bed number *">
              <input type="text" value={form.bed_no} onChange={(e) => setForm({ ...form, bed_no: e.target.value })} placeholder="e.g. BED-A-12" className="dx-editor w-full dx-mono" />
            </FieldLabel>
            <FieldLabel label="Bed type">
              <div className="grid grid-cols-3 gap-2">
                {BED_TYPES.map((t) => {
                  const active = form.bed_type === t;
                  return (
                    <button key={t} type="button" onClick={() => setForm({ ...form, bed_type: t })}
                      className="rounded-md border px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors"
                      style={{ borderColor: active ? "var(--dx-accent)" : "var(--dx-border)", background: active ? "var(--dx-accent)" : "var(--dx-surface)", color: active ? "#fff" : "var(--dx-text-muted)" }}>
                      {t.replace("_", " ")}
                    </button>
                  );
                })}
              </div>
            </FieldLabel>
            <FieldLabel label="Status">
              <div className="grid grid-cols-3 gap-2">
                {BED_STATUSES.map((s) => {
                  const Icon = statusIcons[s] ?? BedIcon;
                  const active = form.bed_status === s;
                  return (
                    <button key={s} type="button" onClick={() => setForm({ ...form, bed_status: s })}
                      className="flex flex-col items-center gap-1 rounded-md border px-3 py-2.5 transition-colors"
                      style={{ borderColor: active ? "var(--dx-accent)" : "var(--dx-border)", background: active ? "var(--dx-accent)" : "var(--dx-surface)", color: active ? "#fff" : "var(--dx-text-muted)" }}>
                      <Icon className="h-3.5 w-3.5" />
                      <span className="text-[9px] font-semibold uppercase tracking-wide">{s.replace("_", " ")}</span>
                    </button>
                  );
                })}
              </div>
            </FieldLabel>
            <FieldLabel label="Notes">
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Equipment notes, restrictions, accessibility info…" className="dx-editor w-full" rows={3} />
            </FieldLabel>
          </div>
          <div className="mt-6 flex justify-end gap-2 border-t border-[var(--dx-border)] pt-4">
            <DxButton onClick={closeModal} disabled={saving}>Cancel</DxButton>
            <DxButton variant="primary" leftIcon={<Save className="h-4 w-4" />} isLoading={saving} onClick={handleSave}>{modal.editing ? "Save changes" : "Add bed"}</DxButton>
          </div>
        </ModalShell>
      ) : null}

      {/* Detail modal */}
      {detailBedId != null ? (
        <ModalShell title={detailSummary?.bed_no ?? "Bed detail"} subtitle="Status & admission history" onClose={() => setDetailBedId(null)} icon={BedIcon} tone="emerald">
          {loadingDetail ? (
            <div className="space-y-3"><div className="dx-skeleton h-24 w-full" /><div className="dx-skeleton h-32 w-full" /></div>
          ) : !detailSummary ? (
            <DxMessage tone="danger">Detailed summary unavailable.</DxMessage>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] p-4">
                <div className="flex items-center gap-3"><Hash className="h-4 w-4 text-[var(--dx-text-muted)]" /><span className="dx-mono text-[13px] font-semibold text-[var(--dx-text)]">{detailSummary.bed_no}</span></div>
                <div className="flex flex-wrap items-center gap-2">
                  {detailSummary.bed_type ? <DxBadge tone={bedTypeTone(detailSummary.bed_type)}>{detailSummary.bed_type.replace("_", " ")}</DxBadge> : null}
                  <DxBadge tone={bedStatusTone(detailSummary.bed_status)}>{detailSummary.bed_status.replace("_", " ")}</DxBadge>
                </div>
              </div>

              {detailSummary.ward ? (
                <div className="mb-4 flex items-center gap-3 rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] p-3">
                  <Hospital className="h-5 w-5 text-[var(--dx-accent)]" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">Ward</p>
                    <p className="text-[13px] font-semibold text-[var(--dx-text)]">{detailSummary.ward.name}{detailSummary.ward.code ? <span className="ml-2 dx-mono text-[11px] text-[var(--dx-text-muted)]">{detailSummary.ward.code}</span> : null}</p>
                  </div>
                </div>
              ) : null}

              {detailSummary.notes ? (
                <div className="mb-4 rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] p-3"><p className="text-[12px] italic leading-relaxed text-[var(--dx-text-muted)]">{detailSummary.notes}</p></div>
              ) : null}

              <div className="mb-4 grid grid-cols-2 gap-3">
                <SummaryStat label="Total admissions" value={detailSummary.admission_count} tone="info" icon={ClipboardList} />
                <div className="flex flex-col items-start rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface)] p-3">
                  {detailSummary.has_active_admission ? <Users className="mb-2 h-4 w-4 text-[var(--dx-danger)]" /> : <CheckCircle2 className="mb-2 h-4 w-4 text-[var(--dx-success)]" />}
                  <p className="text-[18px] font-bold" style={{ color: detailSummary.has_active_admission ? "var(--dx-danger)" : "var(--dx-success)" }}>{detailSummary.has_active_admission ? "Active" : "Free"}</p>
                  <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">Current state</p>
                </div>
              </div>

              <div className="mt-2 flex">
                <DxButton variant="primary" className="w-full justify-center" leftIcon={<Edit3 className="h-4 w-4" />} onClick={() => { setDetailBedId(null); const bed = beds.find((x) => x.id === detailSummary.id); if (bed) openEdit(bed); }}>Edit bed</DxButton>
              </div>
            </>
          )}
        </ModalShell>
      ) : null}

      {/* Delete confirm */}
      {confirmDelete ? (
        <ModalShell title="Delete bed" subtitle="This cannot be undone" onClose={() => !deleting && setConfirmDelete(null)} icon={Trash2} tone="rose">
          <DxMessage tone="danger" className="mb-4">
            Delete bed <strong>{confirmDelete.bed_no}</strong> in <strong>{wardName(confirmDelete.ward_id)}</strong>? Historical admission references to this bed will be preserved but the bed will no longer be available for new admissions.
          </DxMessage>
          <div className="flex justify-end gap-2">
            <DxButton onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancel</DxButton>
            <DxButton variant="danger" leftIcon={<Trash2 className="h-4 w-4" />} isLoading={deleting} onClick={handleDelete}>Delete bed</DxButton>
          </div>
        </ModalShell>
      ) : null}
    </DxPage>
  );
}

// =====================================================================
// Sub-components
// =====================================================================

type StatTone = "info" | "success" | "warning" | "danger";

function bedStatusTone(status: string): DxBadgeTone {
  switch ((status || "").toUpperCase()) {
    case "AVAILABLE":
      return "success";
    case "OCCUPIED":
      return "danger";
    case "RESERVED":
      return "warning";
    case "CLEANING":
      return "info";
    default:
      return "neutral";
  }
}

function bedTypeTone(type: string): DxBadgeTone {
  switch ((type || "").toUpperCase()) {
    case "SEMI_PRIVATE":
      return "info";
    case "PRIVATE":
      return "success";
    case "ICU":
    case "ISOLATION":
      return "danger";
    case "BASSINETTE":
      return "accent";
    case "PEDIATRIC":
      return "warning";
    default:
      return "neutral";
  }
}

function BedTile({
  bed,
  onView,
  onEdit,
  onDelete,
}: {
  bed: Bed;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = (bed.bed_status || "AVAILABLE").toUpperCase();
  const StatusIcon = statusIcons[status] ?? BedIcon;
  const barColor =
    status === "AVAILABLE" ? "var(--dx-success)" :
    status === "OCCUPIED" ? "var(--dx-danger)" :
    status === "RESERVED" ? "var(--dx-warning)" : "var(--dx-border-strong)";

  return (
    <div className="group relative rounded-lg border border-[var(--dx-border)] bg-[var(--dx-surface)] p-4 transition-colors hover:border-[var(--dx-border-strong)]">
      <div className="absolute left-0 right-0 top-0 h-1.5 rounded-t-lg" style={{ background: barColor }} />
      <div className="mb-3 mt-1 flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--dx-accent)] text-white"><BedIcon className="h-4 w-4" /></div>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <DxButton icon size="sm" variant="text" title="View" onClick={onView}><Eye /></DxButton>
          <DxButton icon size="sm" variant="text" title="Edit" onClick={onEdit}><Edit3 /></DxButton>
          <DxButton icon size="sm" variant="text" title="Delete" onClick={onDelete}><Trash2 /></DxButton>
        </div>
      </div>
      <p className="dx-mono truncate text-[13px] font-bold text-[var(--dx-text)]">{bed.bed_no}</p>
      <div className="mt-2 flex flex-col items-start gap-1.5">
        <DxBadge tone={bedStatusTone(status)}><StatusIcon className="mr-1 inline h-2.5 w-2.5" />{status.replace("_", " ")}</DxBadge>
        {bed.bed_type ? <DxBadge tone={bedTypeTone(bed.bed_type)}>{bed.bed_type.replace("_", " ")}</DxBadge> : null}
      </div>
    </div>
  );
}

const statToneColor: Record<StatTone, string> = {
  info: "var(--dx-info)",
  success: "var(--dx-success)",
  warning: "var(--dx-warning)",
  danger: "var(--dx-danger)",
};

function SummaryStat({ label, value, tone, icon: Icon }: { label: string; value: number; tone: StatTone; icon: typeof BedIcon }) {
  return (
    <div className="flex flex-col items-start rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface)] p-3">
      <Icon className="mb-2 h-4 w-4" style={{ color: statToneColor[tone] }} />
      <p className="text-[20px] font-bold text-[var(--dx-text)]">{value}</p>
      <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">{label}</p>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="dx-field">
      <label className="dx-field-label">{label}</label>
      {children}
    </div>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
  icon: typeof BedIcon;
  tone?: "primary" | "emerald" | "rose";
}) {
  return (
    <DxPopup
      isOpen
      onClose={onClose}
      size="md"
      title={
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]"><Icon className="h-5 w-5" /></span>
          <span className="flex flex-col">
            <span className="text-[15px] font-bold text-[var(--dx-text)]">{title}</span>
            <span className="text-[11px] font-normal text-[var(--dx-text-muted)]">{subtitle}</span>
          </span>
        </span>
      }
    >
      {children}
    </DxPopup>
  );
}
