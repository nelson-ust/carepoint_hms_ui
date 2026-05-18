import { PageHeader } from "@/components/layout/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Bed as BedIcon,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Eye,
  Filter,
  Hash,
  Hospital,
  ListChecks,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  Trash2,
  Users,
  Wrench,
  X,
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

const statusStyles: Record<string, string> = {
  AVAILABLE: "bg-emerald-50 text-emerald-600 border-emerald-100",
  OCCUPIED: "bg-rose-50 text-rose-600 border-rose-100",
  RESERVED: "bg-amber-50 text-amber-600 border-amber-100",
  OUT_OF_SERVICE: "bg-secondary-100 text-secondary-500 border-secondary-200",
  MAINTENANCE: "bg-secondary-100 text-secondary-500 border-secondary-200",
  CLEANING: "bg-primary-50 text-primary-600 border-primary-100",
};

const statusIcons: Record<string, typeof BedIcon> = {
  AVAILABLE: CheckCircle2,
  OCCUPIED: Users,
  RESERVED: Sparkles,
  OUT_OF_SERVICE: Settings2,
  MAINTENANCE: Wrench,
  CLEANING: Settings2,
};

const typeStyles: Record<string, string> = {
  STANDARD: "bg-secondary-100 text-secondary-600 border-secondary-200",
  SEMI_PRIVATE: "bg-primary-50 text-primary-600 border-primary-100",
  PRIVATE: "bg-emerald-50 text-emerald-600 border-emerald-100",
  ICU: "bg-rose-50 text-rose-600 border-rose-100",
  BASSINETTE: "bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100",
  PEDIATRIC: "bg-amber-50 text-amber-600 border-amber-100",
  ISOLATION: "bg-rose-50 text-rose-600 border-rose-100",
  OTHER: "bg-secondary-100 text-secondary-600 border-secondary-200",
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
      setError(err?.response?.data?.message || "Unable to load beds.");
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
        b.ward?.name?.toLowerCase().includes(q)
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
      setSaveError(err?.response?.data?.message || "Failed to save bed.");
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
      showFeedback("error", err?.response?.data?.message || "Failed to delete bed.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Beds"
          description="Configure individual beds within each ward and monitor their real-time status."
        />
        <div className="flex items-center gap-3">
          <Link
            to="/wards"
            className="btn-secondary gap-2 px-5 py-3 rounded-2xl bg-white/80 border-secondary-400"
          >
            <Hospital className="h-4 w-4" />
            <span className="text-sm font-bold">Wards</span>
          </Link>
          <Link
            to="/admissions"
            className="btn-secondary gap-2 px-5 py-3 rounded-2xl bg-white/80 border-secondary-400"
          >
            <ClipboardList className="h-4 w-4" />
            <span className="text-sm font-bold">Admissions</span>
          </Link>
          <button
            onClick={load}
            className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400 hover:rotate-180 transition-transform duration-500"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={openCreate}
            className="btn-primary gap-3 py-3 px-7 shadow-xl shadow-primary-500/20"
          >
            <Plus className="h-5 w-5" />
            <span className="font-bold">New Bed</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`px-6 py-4 rounded-2xl border flex items-center gap-3 shadow-lg animate-fade-in ${feedback.tone === "success"
              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
              : "bg-rose-50 text-rose-700 border-rose-100"
            }`}
        >
          {feedback.tone === "success" ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <span className="text-sm font-bold">{feedback.message}</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={ListChecks} label="Total Beds" value={stats.total} tone="primary" />
        <StatCard icon={CheckCircle2} label="Available" value={stats.available} tone="emerald" />
        <StatCard icon={Users} label="Occupied" value={stats.occupied} tone="rose" />
        <StatCard icon={Wrench} label="Offline" value={stats.offline} tone="amber" />
      </div>

      {/* Filters */}
      <div className="glass-card rounded-[2rem] p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center bg-white/40 backdrop-blur-md">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by bed #, type, ward, notes..."
            className="w-full bg-white/50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
          />
        </div>
        <div className="relative">
          <Hospital className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400 pointer-events-none" />
          <select
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
            className="appearance-none bg-white/80 border border-secondary-400 rounded-2xl pl-11 pr-8 py-4 text-xs font-bold uppercase tracking-widest text-secondary-700 focus:ring-2 focus:ring-primary-500/40"
          >
            <option value="">All Wards</option>
            {wards.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name ?? `Ward #${w.id}`}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400 pointer-events-none" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none bg-white/80 border border-secondary-400 rounded-2xl pl-11 pr-8 py-4 text-xs font-bold uppercase tracking-widest text-secondary-700 focus:ring-2 focus:ring-primary-500/40"
          >
            <option value="">All Statuses</option>
            {BED_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <BedIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400 pointer-events-none" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="appearance-none bg-white/80 border border-secondary-400 rounded-2xl pl-11 pr-8 py-4 text-xs font-bold uppercase tracking-widest text-secondary-700 focus:ring-2 focus:ring-primary-500/40"
          >
            <option value="">All Types</option>
            {BED_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="h-6 bg-secondary-100/60 rounded animate-pulse w-48" />
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, j) => (
                  <div
                    key={j}
                    className="rounded-2xl bg-secondary-100/30 h-32 animate-pulse"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="glass-card rounded-[2.5rem] p-16 text-center max-w-md mx-auto">
          <AlertCircle className="h-12 w-12 mx-auto text-rose-500/50 mb-4" />
          <p className="text-secondary-600 font-bold mb-4">{error}</p>
          <button onClick={load} className="btn-primary py-3 px-8">
            Try Again
          </button>
        </div>
      ) : groupedByWard.length === 0 ? (
        <div className="glass-card rounded-[2.5rem] p-16 text-center max-w-md mx-auto">
          <div className="h-20 w-20 bg-secondary-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <BedIcon className="h-10 w-10 text-secondary-200" />
          </div>
          <h4 className="text-xl font-bold text-secondary-900">No Beds</h4>
          <p className="text-sm text-secondary-500 mt-2">
            {beds.length === 0
              ? "Configure the first bed in a ward to get started."
              : "No beds match your filters."}
          </p>
          <button
            onClick={openCreate}
            className="btn-primary mt-5 inline-flex items-center gap-2 px-8 py-3"
          >
            <Plus className="h-4 w-4" />
            <span>Add Bed</span>
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedByWard.map(([wardId, list]) => {
            const ward = wards.find((w) => w.id === wardId);
            const groupAvailable = list.filter((b) => b.bed_status === "AVAILABLE").length;
            const groupOccupied = list.filter((b) => b.bed_status === "OCCUPIED").length;
            return (
              <div key={wardId}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                      <Hospital className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-secondary-900">
                        {ward?.name ?? wardName(wardId)}
                      </h3>
                      <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-widest">
                        {list.length} beds · {groupAvailable} available · {groupOccupied}{" "}
                        occupied
                      </p>
                    </div>
                  </div>
                  {ward && (
                    <Link
                      to={`/admissions?ward=${ward.id}`}
                      className="text-[11px] font-bold uppercase tracking-widest text-primary-600 hover:text-primary-700"
                    >
                      View Admissions →
                    </Link>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {list.map((b) => (
                    <BedTile
                      key={b.id}
                      bed={b}
                      onView={() => setDetailBedId(b.id)}
                      onEdit={() => openEdit(b)}
                      onDelete={() => setConfirmDelete(b)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      {modal.open && (
        <ModalShell
          title={modal.editing ? "Edit Bed" : "New Bed"}
          subtitle="Configure An Inpatient Bed"
          onClose={closeModal}
          icon={modal.editing ? Edit3 : Plus}
        >
          {saveError && (
            <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-bold">{saveError}</span>
            </div>
          )}
          <div className="space-y-5">
            <FieldLabel label="Ward *">
              <select
                value={form.ward_id}
                onChange={(e) => setForm({ ...form, ward_id: e.target.value })}
                className="input-field h-12 bg-secondary-50 border-secondary-400 w-full"
              >
                <option value="">Pick a ward...</option>
                {wards.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name ?? `Ward #${w.id}`}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Bed Number *">
              <input
                type="text"
                value={form.bed_no}
                onChange={(e) => setForm({ ...form, bed_no: e.target.value })}
                placeholder="e.g. BED-A-12"
                className="input-field h-12 bg-secondary-50 border-secondary-400 w-full font-mono"
              />
            </FieldLabel>
            <FieldLabel label="Bed Type">
              <div className="grid grid-cols-3 gap-2">
                {BED_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, bed_type: t })}
                    className={`p-2.5 rounded-xl border-2 text-[10px] font-bold uppercase tracking-widest transition-all ${form.bed_type === t
                        ? "bg-primary-500 text-white border-primary-500 shadow-md"
                        : "bg-white border-secondary-400 text-secondary-600 hover:border-primary-300"
                      }`}
                  >
                    {t.replace("_", " ")}
                  </button>
                ))}
              </div>
            </FieldLabel>
            <FieldLabel label="Status">
              <div className="grid grid-cols-3 gap-2">
                {BED_STATUSES.map((s) => {
                  const Icon = statusIcons[s] ?? BedIcon;
                  const isActive = form.bed_status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm({ ...form, bed_status: s })}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${isActive
                          ? "bg-slate-900 text-white border-slate-900 shadow-md"
                          : "bg-white border-secondary-400 text-secondary-600 hover:border-primary-300"
                        }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="text-[9px] font-bold uppercase tracking-widest">
                        {s.replace("_", " ")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </FieldLabel>
            <FieldLabel label="Notes">
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Equipment notes, restrictions, accessibility info..."
                className="input-field h-24 bg-secondary-50 border-secondary-400 w-full resize-none py-3"
              />
            </FieldLabel>
          </div>
          <div className="pt-6 flex gap-4">
            <button
              onClick={closeModal}
              disabled={saving}
              className="flex-1 btn-secondary py-4 rounded-2xl font-bold"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-[2] btn-primary py-4 rounded-2xl font-black tracking-tight shadow-xl shadow-primary-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : modal.editing ? "Save Changes" : "Add Bed"}
            </button>
          </div>
        </ModalShell>
      )}

      {/* Detail modal */}
      {detailBedId != null && (
        <ModalShell
          title={detailSummary?.bed_no ?? "Bed Detail"}
          subtitle="Status & Admission History"
          onClose={() => setDetailBedId(null)}
          icon={BedIcon}
          tone="emerald"
        >
          {loadingDetail ? (
            <div className="space-y-3">
              <div className="h-24 rounded-2xl bg-secondary-50 animate-pulse" />
              <div className="h-32 rounded-2xl bg-secondary-50 animate-pulse" />
            </div>
          ) : !detailSummary ? (
            <div className="p-6 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm font-bold">Detailed summary unavailable.</p>
            </div>
          ) : (
            <>
              {/* Identity strip */}
              <div className="p-5 rounded-2xl bg-secondary-50 border border-secondary-400 mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Hash className="h-4 w-4 text-secondary-400" />
                  <span className="font-mono font-bold text-sm text-secondary-700">
                    {detailSummary.bed_no}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {detailSummary.bed_type && (
                    <span
                      className={`px-3 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-widest ${typeStyles[detailSummary.bed_type] ?? typeStyles.OTHER
                        }`}
                    >
                      {detailSummary.bed_type.replace("_", " ")}
                    </span>
                  )}
                  <span
                    className={`px-3 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-widest ${statusStyles[detailSummary.bed_status] ?? statusStyles.AVAILABLE
                      }`}
                  >
                    {detailSummary.bed_status.replace("_", " ")}
                  </span>
                </div>
              </div>

              {detailSummary.ward && (
                <div className="mb-5 p-4 rounded-2xl bg-primary-50/50 border border-primary-100 flex items-center gap-3">
                  <Hospital className="h-5 w-5 text-primary-600" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary-600/80">
                      Ward
                    </p>
                    <p className="text-sm font-black text-primary-900">
                      {detailSummary.ward.name}
                      {detailSummary.ward.code && (
                        <span className="ml-2 text-[10px] font-mono font-bold opacity-60">
                          {detailSummary.ward.code}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {detailSummary.notes && (
                <div className="mb-5 p-4 rounded-2xl bg-amber-50/50 border border-amber-100">
                  <p className="text-xs text-secondary-700 leading-relaxed italic">
                    {detailSummary.notes}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-5">
                <SummaryStat
                  label="Total Admissions"
                  value={detailSummary.admission_count}
                  tone="primary"
                  icon={ClipboardList}
                />
                <div
                  className={`p-4 rounded-2xl border flex flex-col items-start ${detailSummary.has_active_admission
                      ? "bg-rose-50 text-rose-600 border-rose-100"
                      : "bg-emerald-50 text-emerald-600 border-emerald-100"
                    }`}
                >
                  {detailSummary.has_active_admission ? (
                    <Users className="h-4 w-4 mb-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mb-2" />
                  )}
                  <p className="text-2xl font-black tracking-tight">
                    {detailSummary.has_active_admission ? "Active" : "Free"}
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-widest opacity-80 mt-0.5">
                    Current State
                  </p>
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  onClick={() => {
                    setDetailBedId(null);
                    const bed = beds.find((x) => x.id === detailSummary.id);
                    if (bed) openEdit(bed);
                  }}
                  className="flex-1 btn-primary py-3 rounded-2xl font-bold flex items-center justify-center gap-2"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit Bed
                </button>
              </div>
            </>
          )}
        </ModalShell>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <ModalShell
          title="Delete Bed"
          subtitle="This Cannot Be Undone"
          onClose={() => !deleting && setConfirmDelete(null)}
          icon={Trash2}
          tone="rose"
        >
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-sm text-rose-700 leading-relaxed">
              Delete bed <strong>{confirmDelete.bed_no}</strong> in{" "}
              <strong>{wardName(confirmDelete.ward_id)}</strong>? Historical admission
              references to this bed will be preserved but the bed will no longer be
              available for new admissions.
            </p>
          </div>
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
              {deleting ? "Deleting..." : "Delete Bed"}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

// =====================================================================
// Sub-components
// =====================================================================

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
  const statusClass = statusStyles[status] ?? statusStyles.AVAILABLE;
  const StatusIcon = statusIcons[status] ?? BedIcon;
  const typeKey = (bed.bed_type || "STANDARD").toUpperCase();

  return (
    <div className="group relative rounded-2xl bg-white border border-secondary-400 hover:border-primary-300 hover:shadow-xl hover:shadow-primary-500/5 transition-all p-4">
      <div
        className={`absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl ${status === "AVAILABLE"
            ? "bg-emerald-500"
            : status === "OCCUPIED"
              ? "bg-rose-500"
              : status === "RESERVED"
                ? "bg-amber-500"
                : "bg-secondary-300"
          }`}
      />
      <div className="flex items-start justify-between mb-3 mt-1">
        <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
          <BedIcon className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onView}
            className="p-1 rounded-lg hover:bg-secondary-100 text-secondary-500"
            title="View"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onEdit}
            className="p-1 rounded-lg hover:bg-secondary-100 text-secondary-500"
            title="Edit"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded-lg hover:bg-rose-50 text-rose-500"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <p className="text-sm font-black text-secondary-900 font-mono truncate">
        {bed.bed_no}
      </p>
      <div className="mt-2 space-y-1.5">
        <div
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-widest ${statusClass}`}
        >
          <StatusIcon className="h-2.5 w-2.5" />
          {status.replace("_", " ")}
        </div>
        {bed.bed_type && (
          <div
            className={`inline-flex px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-widest ${typeStyles[typeKey] ?? typeStyles.OTHER
              }`}
          >
            {bed.bed_type.replace("_", " ")}
          </div>
        )}
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
  icon: typeof BedIcon;
  label: string;
  value: number;
  tone: StatTone;
}) {
  return (
    <div
      className={`glass-card rounded-[2rem] p-6 border ${statToneStyles[tone]} bg-white/60 backdrop-blur-md`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</span>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-3xl font-black tracking-tight">{value}</div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: StatTone;
  icon: typeof BedIcon;
}) {
  return (
    <div
      className={`p-4 rounded-2xl border ${statToneStyles[tone]} flex flex-col items-start`}
    >
      <Icon className="h-4 w-4 mb-2" />
      <p className="text-2xl font-black tracking-tight">{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-widest opacity-80 mt-0.5">
        {label}
      </p>
    </div>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
        {label}
      </label>
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
  tone = "primary",
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
  icon: typeof BedIcon;
  tone?: "primary" | "emerald" | "rose";
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-500 shadow-emerald-500/20"
      : tone === "rose"
        ? "bg-rose-500 shadow-rose-500/20"
        : "bg-primary-600 shadow-primary-500/20";
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6 animate-fade-in">
      <div className="bg-white rounded-[2.5rem] p-10 max-w-xl w-full shadow-2xl relative animate-slide-up max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-3 hover:bg-secondary-50 rounded-2xl transition-all"
        >
          <X className="h-5 w-5 text-secondary-400" />
        </button>
        <div className="flex items-center gap-5 mb-8">
          <div
            className={`h-14 w-14 rounded-2xl text-white flex items-center justify-center shadow-xl ${cls}`}
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
