import { PageHeader } from "@/components/layout/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Bed as BedIcon,
  CheckCircle2,
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
  ShieldAlert,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  createWard,
  deleteWard,
  getWardSummary,
  listWards,
  updateWard,
  WARD_TYPES,
} from "../api/wards.api";
import type {
  CreateWardPayload,
  UpdateWardPayload,
  Ward,
  WardSummary,
} from "../api/wards.api";

type WardForm = {
  name: string;
  code: string;
  ward_type: string;
  description: string;
};

const emptyForm: WardForm = {
  name: "",
  code: "",
  ward_type: "GENERAL",
  description: "",
};

const wardTypeStyles: Record<string, string> = {
  GENERAL: "bg-primary-50 text-primary-600 border-primary-100",
  PRIVATE: "bg-emerald-50 text-emerald-600 border-emerald-100",
  ICU: "bg-rose-50 text-rose-600 border-rose-100",
  MATERNITY: "bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100",
  PEDIATRIC: "bg-amber-50 text-amber-600 border-amber-100",
  SURGICAL: "bg-secondary-100 text-secondary-700 border-secondary-200",
  ISOLATION: "bg-rose-50 text-rose-600 border-rose-100",
  OTHER: "bg-secondary-100 text-secondary-600 border-secondary-200",
};

function occupancyPercent(w: Ward | WardSummary): number {
  if (!w.total_beds || w.total_beds === 0) return 0;
  const occupied = w.occupied_beds ?? 0;
  return Math.min(100, Math.round((occupied / w.total_beds) * 100));
}

function occupancyTone(percent: number): "emerald" | "amber" | "rose" {
  if (percent >= 90) return "rose";
  if (percent >= 70) return "amber";
  return "emerald";
}

export function WardsBedsPage() {
  const [wards, setWards] = useState<Ward[]>([]);
  const [summaryById, setSummaryById] = useState<Map<number, WardSummary>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    { tone: "success" | "error"; message: string } | null
  >(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // Create/Edit modal
  const [modal, setModal] = useState<{ open: boolean; editing: Ward | null }>({
    open: false,
    editing: null,
  });
  const [form, setForm] = useState<WardForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Detail modal (ward summary)
  const [detailWardId, setDetailWardId] = useState<number | null>(null);
  const [detailSummary, setDetailSummary] = useState<WardSummary | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState<Ward | null>(null);
  const [deleting, setDeleting] = useState(false);

  const showFeedback = (tone: "success" | "error", message: string) => {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 3500);
  };

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await listWards({ skip: 0, limit: 200 });
      const items = res.items ?? [];
      setWards(items);

      // Best-effort: pull summaries in parallel so cards show occupancy.
      // We swallow individual failures so a single bad ward doesn't block the list.
      const summaries = await Promise.all(
        items.map((w) =>
          getWardSummary(w.id).then(
            (s) => [w.id, s] as const,
            () => null,
          ),
        ),
      );
      const map = new Map<number, WardSummary>();
      summaries.forEach((s) => {
        if (s) map.set(s[0], s[1]);
      });
      setSummaryById(map);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to load wards.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Pull summary when detail modal opens
  useEffect(() => {
    if (detailWardId == null) {
      setDetailSummary(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingDetail(true);
      try {
        const summary = await getWardSummary(detailWardId);
        if (!cancelled) setDetailSummary(summary);
      } catch (err) {
        if (!cancelled) setDetailSummary(null);
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailWardId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return wards.filter((w) => {
      if (typeFilter && (w.ward_type || "") !== typeFilter) return false;
      if (!q) return true;
      return (
        w.name?.toLowerCase().includes(q) ||
        w.code?.toLowerCase().includes(q) ||
        w.description?.toLowerCase().includes(q) ||
        w.ward_type?.toLowerCase().includes(q)
      );
    });
  }, [wards, search, typeFilter]);

  const stats = useMemo(() => {
    const total = wards.length;
    let totalBeds = 0;
    let availableBeds = 0;
    let activeAdmissions = 0;
    summaryById.forEach((s) => {
      totalBeds += s.total_beds ?? 0;
      availableBeds += s.available_beds ?? 0;
      activeAdmissions += s.active_admissions ?? 0;
    });
    return { total, totalBeds, availableBeds, activeAdmissions };
  }, [wards, summaryById]);

  const openCreate = () => {
    setModal({ open: true, editing: null });
    setForm(emptyForm);
    setSaveError(null);
  };

  const openEdit = (w: Ward) => {
    setModal({ open: true, editing: w });
    setForm({
      name: w.name ?? "",
      code: w.code ?? "",
      ward_type: w.ward_type ?? "GENERAL",
      description: w.description ?? "",
    });
    setSaveError(null);
  };

  const closeModal = () => {
    if (saving) return;
    setModal({ open: false, editing: null });
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      setSaveError("Name and code are required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      if (modal.editing) {
        const payload: UpdateWardPayload = {
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          ward_type: form.ward_type || undefined,
          description: form.description.trim() || undefined,
        };
        const updated = await updateWard(modal.editing.id, payload);
        setWards((prev) => prev.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)));
        showFeedback("success", "Ward updated.");
      } else {
        const payload: CreateWardPayload = {
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          ward_type: form.ward_type || undefined,
          description: form.description.trim() || undefined,
        };
        const created = await createWard(payload);
        setWards((prev) =>
          [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
        );
        showFeedback("success", "Ward created.");
      }
      setModal({ open: false, editing: null });
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || "Failed to save ward.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await deleteWard(confirmDelete.id);
      setWards((prev) => prev.filter((w) => w.id !== confirmDelete.id));
      summaryById.delete(confirmDelete.id);
      setSummaryById(new Map(summaryById));
      showFeedback("success", res.message || "Ward deleted.");
      setConfirmDelete(null);
    } catch (err: any) {
      showFeedback("error", err?.response?.data?.message || "Failed to delete ward.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Wards"
          description="Manage hospital wards and view live bed occupancy across every unit."
        />
        <div className="flex items-center gap-3">
          <Link
            to="/admissions"
            className="btn-secondary gap-2 px-5 py-3 rounded-2xl bg-white/80 border-secondary-400"
          >
            <BedIcon className="h-4 w-4" />
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
            <span className="font-bold">New Ward</span>
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
        <StatCard icon={Hospital} label="Wards" value={stats.total} tone="primary" />
        <StatCard icon={BedIcon} label="Total Beds" value={stats.totalBeds} tone="primary" />
        <StatCard icon={CheckCircle2} label="Available Beds" value={stats.availableBeds} tone="emerald" />
        <StatCard icon={Users} label="Active Admissions" value={stats.activeAdmissions} tone="amber" />
      </div>

      {/* Filters */}
      <div className="glass-card rounded-[2rem] p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center bg-white/40 backdrop-blur-md">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code, type, or description..."
            className="w-full bg-white/50 border-none rounded-2xl pl-14 pr-6 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400 pointer-events-none" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="appearance-none bg-white/80 border border-secondary-400 rounded-2xl pl-11 pr-8 py-4 text-xs font-bold uppercase tracking-widest text-secondary-700 focus:ring-2 focus:ring-primary-500/40"
          >
            <option value="">All Ward Types</option>
            {WARD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cards grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card rounded-[2rem] h-56 animate-pulse bg-white/40" />
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
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-[2.5rem] p-16 text-center max-w-md mx-auto">
          <div className="h-20 w-20 bg-secondary-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Hospital className="h-10 w-10 text-secondary-200" />
          </div>
          <h4 className="text-xl font-bold text-secondary-900">No Wards</h4>
          <p className="text-sm text-secondary-500 mt-2">
            {wards.length === 0
              ? "Create your first ward to start managing inpatient beds."
              : "No wards match your filters."}
          </p>
          <button onClick={openCreate} className="btn-primary mt-5 inline-flex items-center gap-2 px-8 py-3">
            <Plus className="h-4 w-4" />
            <span>Add Ward</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((w) => (
            <WardCard
              key={w.id}
              ward={w}
              summary={summaryById.get(w.id)}
              onView={() => setDetailWardId(w.id)}
              onEdit={() => openEdit(w)}
              onDelete={() => setConfirmDelete(w)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      {modal.open && (
        <ModalShell
          title={modal.editing ? "Edit Ward" : "New Ward"}
          subtitle="Configure An Inpatient Unit"
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
            <Field
              label="Name *"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              placeholder="e.g. Maternity Wing A"
            />
            <Field
              label="Code *"
              value={form.code}
              onChange={(v) => setForm({ ...form, code: v.toUpperCase() })}
              placeholder="MAT-A"
              mono
              disabled={!!modal.editing}
              hint={modal.editing ? "Code is immutable after creation" : undefined}
            />
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                Ward Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {WARD_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, ward_type: t })}
                    className={`p-2.5 rounded-xl border-2 text-[10px] font-bold uppercase tracking-widest transition-all ${form.ward_type === t
                        ? "bg-primary-500 text-white border-primary-500 shadow-md"
                        : "bg-white border-secondary-400 text-secondary-600 hover:border-primary-300"
                      }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What this ward is used for, capacity notes, restrictions..."
                className="input-field h-24 bg-secondary-50 border-secondary-400 w-full resize-none py-3"
              />
            </div>
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
              {saving ? "Saving..." : modal.editing ? "Save Changes" : "Create Ward"}
            </button>
          </div>
        </ModalShell>
      )}

      {/* Detail modal */}
      {detailWardId != null && (
        <ModalShell
          title={detailSummary?.name ?? "Ward Detail"}
          subtitle="Live Occupancy & Admission Stats"
          onClose={() => setDetailWardId(null)}
          icon={Hospital}
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
              {/* Header info */}
              <div className="p-5 rounded-2xl bg-secondary-50 border border-secondary-400 mb-5 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <Hash className="h-4 w-4 text-secondary-400" />
                  <span className="font-mono font-bold text-sm text-secondary-700">
                    {detailSummary.code}
                  </span>
                </div>
                {detailSummary.ward_type && (
                  <span
                    className={`px-3 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-widest ${wardTypeStyles[detailSummary.ward_type] ?? wardTypeStyles.OTHER
                      }`}
                  >
                    {detailSummary.ward_type}
                  </span>
                )}
              </div>

              {detailSummary.description && (
                <div className="mb-5 p-4 rounded-2xl bg-amber-50/50 border border-amber-100">
                  <p className="text-xs text-secondary-700 leading-relaxed italic">
                    {detailSummary.description}
                  </p>
                </div>
              )}

              {/* Bed stats */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <SummaryStat
                  label="Total Beds"
                  value={detailSummary.total_beds}
                  tone="primary"
                  icon={BedIcon}
                />
                <SummaryStat
                  label="Available"
                  value={detailSummary.available_beds}
                  tone="emerald"
                  icon={CheckCircle2}
                />
                <SummaryStat
                  label="Occupied"
                  value={detailSummary.occupied_beds}
                  tone="rose"
                  icon={Users}
                />
              </div>

              {/* Admission stats */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <SummaryStat
                  label="Total Admissions"
                  value={detailSummary.total_admissions}
                  tone="primary"
                  icon={ListChecks}
                />
                <SummaryStat
                  label="Active Admissions"
                  value={detailSummary.active_admissions}
                  tone="amber"
                  icon={Users}
                />
              </div>

              {/* Occupancy bar */}
              <div className="rounded-2xl bg-secondary-50 border border-secondary-400 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                    Occupancy
                  </span>
                  <span className="text-sm font-black text-secondary-900">
                    {occupancyPercent(detailSummary)}%
                  </span>
                </div>
                <OccupancyBar percent={occupancyPercent(detailSummary)} />
              </div>

              <div className="pt-6 grid grid-cols-3 gap-3">
                <Link
                  to={`/beds?ward=${detailSummary.id}`}
                  className="btn-secondary py-3 rounded-2xl font-bold flex items-center justify-center gap-2"
                >
                  <BedIcon className="h-4 w-4" />
                  Manage Beds
                </Link>
                <Link
                  to={`/admissions?ward=${detailSummary.id}`}
                  className="btn-secondary py-3 rounded-2xl font-bold flex items-center justify-center gap-2"
                >
                  <ListChecks className="h-4 w-4" />
                  Admissions
                </Link>
                <button
                  onClick={() => {
                    const ward = wards.find((w) => w.id === detailWardId);
                    if (ward) {
                      setDetailWardId(null);
                      openEdit(ward);
                    }
                  }}
                  className="btn-primary py-3 rounded-2xl font-bold flex items-center justify-center gap-2"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </button>
              </div>
            </>
          )}
        </ModalShell>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <ModalShell
          title="Delete Ward"
          subtitle="This Cannot Be Undone"
          onClose={() => !deleting && setConfirmDelete(null)}
          icon={Trash2}
          tone="rose"
        >
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-sm text-rose-700 leading-relaxed">
              Delete <strong className="text-rose-900">{confirmDelete.name}</strong> (
              <span className="font-mono">{confirmDelete.code}</span>)? Beds and active
              admissions linked to this ward may be affected.
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
              {deleting ? "Deleting..." : "Delete Ward"}
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

function WardCard({
  ward,
  summary,
  onView,
  onEdit,
  onDelete,
}: {
  ward: Ward;
  summary?: WardSummary;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const data = summary ?? ward;
  const totalBeds = data.total_beds ?? 0;
  const occupied = data.occupied_beds ?? 0;
  const available = data.available_beds ?? totalBeds - occupied;
  const active = data.active_admissions ?? 0;
  const percent = occupancyPercent(data);
  const tone = occupancyTone(percent);

  const typeKey = (ward.ward_type || "OTHER").toUpperCase();
  const typeClass = wardTypeStyles[typeKey] ?? wardTypeStyles.OTHER;

  return (
    <div className="glass-card rounded-[2rem] p-7 bg-white border border-secondary-400 hover:border-primary-300 hover:shadow-xl hover:shadow-primary-500/5 transition-all">
      <div className="flex items-start justify-between mb-5">
        <div className="h-14 w-14 rounded-[1.25rem] bg-slate-900 text-white flex items-center justify-center shadow-md">
          <Hospital className="h-7 w-7" />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onView}
            className="p-2 rounded-xl hover:bg-secondary-100 text-secondary-500"
            title="View detail"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={onEdit}
            className="p-2 rounded-xl hover:bg-secondary-100 text-secondary-500"
            title="Edit"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-xl hover:bg-rose-50 text-rose-500"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <h3 className="text-lg font-black text-secondary-900 mb-2">{ward.name}</h3>
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <span className="inline-flex items-center gap-1 bg-secondary-100 text-secondary-600 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold">
          <Hash className="h-2.5 w-2.5" />
          {ward.code}
        </span>
        {ward.ward_type && (
          <span
            className={`inline-flex px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-widest ${typeClass}`}
          >
            {ward.ward_type}
          </span>
        )}
      </div>

      {ward.description && (
        <p className="text-xs text-secondary-500 leading-relaxed line-clamp-2 mb-5">
          {ward.description}
        </p>
      )}

      {/* Occupancy bar */}
      {totalBeds > 0 ? (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
              Occupancy
            </span>
            <span className="text-xs font-black text-secondary-900">{percent}%</span>
          </div>
          <OccupancyBar percent={percent} />
          <div className="grid grid-cols-3 gap-2 mt-4">
            <MicroStat label="Beds" value={totalBeds} tone="primary" />
            <MicroStat label="Free" value={available} tone="emerald" />
            <MicroStat label="Active" value={active} tone={tone} />
          </div>
        </>
      ) : (
        <p className="text-[11px] font-bold text-secondary-400 uppercase tracking-widest text-center pt-3">
          Bed data unavailable
        </p>
      )}
    </div>
  );
}

function OccupancyBar({ percent }: { percent: number }) {
  const tone = occupancyTone(percent);
  const cls =
    tone === "rose"
      ? "bg-gradient-to-r from-rose-400 to-rose-500"
      : tone === "amber"
        ? "bg-gradient-to-r from-amber-400 to-amber-500"
        : "bg-gradient-to-r from-emerald-400 to-emerald-500";
  return (
    <div className="h-2 rounded-full bg-secondary-100 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${cls}`}
        style={{ width: `${percent}%` }}
      />
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

function MicroStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: StatTone;
}) {
  return (
    <div
      className={`px-2 py-1.5 rounded-lg text-center border ${statToneStyles[tone]}`}
    >
      <p className="text-[9px] font-bold uppercase tracking-widest opacity-80">{label}</p>
      <p className="text-sm font-black mt-0.5 font-mono">{value}</p>
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

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Hospital;
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
  disabled,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`input-field h-12 bg-secondary-50 border-secondary-400 w-full ${mono ? "font-mono" : ""
          } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      />
      {hint && (
        <p className="text-[9px] font-bold uppercase tracking-widest text-secondary-400">{hint}</p>
      )}
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
  icon: typeof Hospital;
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
