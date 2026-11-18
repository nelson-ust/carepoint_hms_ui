import {
  DxPage, DxPageHeader, DxPanel, DxKpi, DxBadge, DxButton, DxPopup,
  DxInput, DxSelect, DxMessage,
  type DxBadgeTone,
} from "@/components/dx";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bed as BedIcon,
  CheckCircle2,
  Edit3,
  Eye,
  Hash,
  Hospital,
  ListChecks,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { apiErrorMessage } from "@/lib/api/api-error";
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
      setError(apiErrorMessage(err, "Unable to load wards. Please retry."));
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
      setSaveError(apiErrorMessage(err, "Failed to save ward. Please check the details and retry."));
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
      showFeedback("error", apiErrorMessage(err, "Failed to delete ward."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Wards" }]}
        title="Wards"
        subtitle="Manage hospital wards and view live bed occupancy across every unit."
        actions={
          <>
            <Link to="/admissions" className="dx-btn"><BedIcon /> Admissions</Link>
            <DxButton icon title="Refresh" onClick={load} isLoading={isLoading}><RefreshCw /></DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New ward</DxButton>
          </>
        }
      />

      {feedback ? <DxMessage tone={feedback.tone === "success" ? "success" : "danger"}>{feedback.message}</DxMessage> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <DxKpi label="Wards" value={stats.total} icon={Hospital} tone="accent" />
        <DxKpi label="Total beds" value={stats.totalBeds} icon={BedIcon} tone="info" />
        <DxKpi label="Available beds" value={stats.availableBeds} icon={CheckCircle2} tone="success" />
        <DxKpi label="Active admissions" value={stats.activeAdmissions} icon={Users} tone="warning" />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <DxInput leftIcon={<Search className="h-3.5 w-3.5" />} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, code, type, or description…" />
        </div>
        <div className="w-full md:w-56">
          <DxSelect value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter by ward type"
            options={[{ value: "", label: "All ward types" }, ...WARD_TYPES.map((t) => ({ value: t, label: t }))]} />
        </div>
      </div>

      {/* Cards grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="dx-skeleton h-56 w-full" />)}
        </div>
      ) : error ? (
        <DxPanel>
          <div className="py-12 text-center">
            <p className="mb-4 text-[13px] text-[var(--dx-danger)]">{error}</p>
            <DxButton className="mx-auto" variant="primary" onClick={load}>Try again</DxButton>
          </div>
        </DxPanel>
      ) : filtered.length === 0 ? (
        <DxPanel>
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--dx-surface-sunken)]"><Hospital className="h-8 w-8 text-[var(--dx-text-faint)]" /></div>
            <h4 className="text-[17px] font-bold text-[var(--dx-text)]">No wards</h4>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--dx-text-muted)]">{wards.length === 0 ? "Create your first ward to start managing inpatient beds." : "No wards match your filters."}</p>
            <DxButton className="mx-auto mt-4" variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add ward</DxButton>
          </div>
        </DxPanel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((w) => (
            <WardCard key={w.id} ward={w} summary={summaryById.get(w.id)} onView={() => setDetailWardId(w.id)} onEdit={() => openEdit(w)} onDelete={() => setConfirmDelete(w)} />
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      {modal.open ? (
        <ModalShell title={modal.editing ? "Edit ward" : "New ward"} subtitle="Configure an inpatient unit" onClose={closeModal} icon={modal.editing ? Edit3 : Plus}>
          {saveError ? <DxMessage tone="danger" className="mb-4">{saveError}</DxMessage> : null}
          <div className="space-y-4">
            <Field label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. Maternity Wing A" />
            <Field label="Code *" value={form.code} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} placeholder="MAT-A" mono disabled={!!modal.editing} hint={modal.editing ? "Code is immutable after creation" : undefined} />
            <div className="dx-field">
              <label className="dx-field-label">Ward type</label>
              <div className="grid grid-cols-3 gap-2">
                {WARD_TYPES.map((t) => {
                  const active = form.ward_type === t;
                  return (
                    <button key={t} type="button" onClick={() => setForm({ ...form, ward_type: t })}
                      className="rounded-md border px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors"
                      style={{ borderColor: active ? "var(--dx-accent)" : "var(--dx-border)", background: active ? "var(--dx-accent)" : "var(--dx-surface)", color: active ? "#fff" : "var(--dx-text-muted)" }}>
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="dx-field">
              <label className="dx-field-label">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What this ward is used for, capacity notes, restrictions…" className="dx-editor w-full" rows={3} />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2 border-t border-[var(--dx-border)] pt-4">
            <DxButton onClick={closeModal} disabled={saving}>Cancel</DxButton>
            <DxButton variant="primary" leftIcon={<Save className="h-4 w-4" />} isLoading={saving} onClick={handleSave}>{modal.editing ? "Save changes" : "Create ward"}</DxButton>
          </div>
        </ModalShell>
      ) : null}

      {/* Detail modal */}
      {detailWardId != null ? (
        <ModalShell title={detailSummary?.name ?? "Ward detail"} subtitle="Live occupancy & admission stats" onClose={() => setDetailWardId(null)} icon={Hospital} tone="emerald">
          {loadingDetail ? (
            <div className="space-y-3"><div className="dx-skeleton h-24 w-full" /><div className="dx-skeleton h-32 w-full" /></div>
          ) : !detailSummary ? (
            <DxMessage tone="danger">Detailed summary unavailable.</DxMessage>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] p-4">
                <div className="flex items-center gap-3"><Hash className="h-4 w-4 text-[var(--dx-text-muted)]" /><span className="dx-mono text-[13px] font-semibold text-[var(--dx-text)]">{detailSummary.code}</span></div>
                {detailSummary.ward_type ? <DxBadge tone={wardTypeTone(detailSummary.ward_type)}>{detailSummary.ward_type}</DxBadge> : null}
              </div>
              {detailSummary.description ? (
                <div className="mb-4 rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] p-3"><p className="text-[12px] italic leading-relaxed text-[var(--dx-text-muted)]">{detailSummary.description}</p></div>
              ) : null}
              <div className="mb-4 grid grid-cols-3 gap-3">
                <SummaryStat label="Total beds" value={detailSummary.total_beds} tone="info" icon={BedIcon} />
                <SummaryStat label="Available" value={detailSummary.available_beds} tone="success" icon={CheckCircle2} />
                <SummaryStat label="Occupied" value={detailSummary.occupied_beds} tone="danger" icon={Users} />
              </div>
              <div className="mb-4 grid grid-cols-2 gap-3">
                <SummaryStat label="Total admissions" value={detailSummary.total_admissions} tone="info" icon={ListChecks} />
                <SummaryStat label="Active admissions" value={detailSummary.active_admissions} tone="warning" icon={Users} />
              </div>
              <div className="rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">Occupancy</span>
                  <span className="text-[13px] font-bold text-[var(--dx-text)]">{occupancyPercent(detailSummary)}%</span>
                </div>
                <OccupancyBar percent={occupancyPercent(detailSummary)} />
              </div>
              <div className="mt-6 grid grid-cols-3 gap-2">
                <Link to={`/beds?ward=${detailSummary.id}`} className="dx-btn justify-center"><BedIcon /> Manage beds</Link>
                <Link to={`/admissions?ward=${detailSummary.id}`} className="dx-btn justify-center"><ListChecks /> Admissions</Link>
                <DxButton variant="primary" className="justify-center" leftIcon={<Edit3 className="h-4 w-4" />} onClick={() => { const ward = wards.find((w) => w.id === detailWardId); if (ward) { setDetailWardId(null); openEdit(ward); } }}>Edit</DxButton>
              </div>
            </>
          )}
        </ModalShell>
      ) : null}

      {/* Delete confirm */}
      {confirmDelete ? (
        <ModalShell title="Delete ward" subtitle="This cannot be undone" onClose={() => !deleting && setConfirmDelete(null)} icon={Trash2} tone="rose">
          <DxMessage tone="danger" className="mb-4">
            Delete <strong>{confirmDelete.name}</strong> (<span className="dx-mono">{confirmDelete.code}</span>)? Beds and active admissions linked to this ward may be affected.
          </DxMessage>
          <div className="flex justify-end gap-2">
            <DxButton onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancel</DxButton>
            <DxButton variant="danger" leftIcon={<Trash2 className="h-4 w-4" />} isLoading={deleting} onClick={handleDelete}>Delete ward</DxButton>
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

function wardTypeTone(type: string): DxBadgeTone {
  switch ((type || "").toUpperCase()) {
    case "GENERAL":
      return "info";
    case "PRIVATE":
      return "success";
    case "ICU":
    case "ISOLATION":
      return "danger";
    case "MATERNITY":
      return "accent";
    case "PEDIATRIC":
      return "warning";
    default:
      return "neutral";
  }
}

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

  return (
    <div className="rounded-lg border border-[var(--dx-border)] bg-[var(--dx-surface)] p-5 shadow-[var(--dx-shadow)] transition-colors hover:border-[var(--dx-border-strong)]">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--dx-accent)] text-white"><Hospital className="h-6 w-6" /></div>
        <div className="flex items-center gap-0.5">
          <DxButton icon size="sm" variant="text" title="View detail" onClick={onView}><Eye /></DxButton>
          <DxButton icon size="sm" variant="text" title="Edit" onClick={onEdit}><Edit3 /></DxButton>
          <DxButton icon size="sm" variant="text" title="Delete" onClick={onDelete}><Trash2 /></DxButton>
        </div>
      </div>

      <h3 className="mb-2 text-[16px] font-bold text-[var(--dx-text)]">{ward.name}</h3>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 dx-mono text-[11px] font-semibold text-[var(--dx-text-muted)]"><Hash className="h-2.5 w-2.5" />{ward.code}</span>
        {ward.ward_type ? <DxBadge tone={wardTypeTone(ward.ward_type)}>{ward.ward_type}</DxBadge> : null}
      </div>

      {ward.description ? <p className="mb-4 line-clamp-2 text-[12px] leading-relaxed text-[var(--dx-text-muted)]">{ward.description}</p> : null}

      {totalBeds > 0 ? (
        <>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">Occupancy</span>
            <span className="text-[12px] font-bold text-[var(--dx-text)]">{percent}%</span>
          </div>
          <OccupancyBar percent={percent} />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MicroStat label="Beds" value={totalBeds} tone="info" />
            <MicroStat label="Free" value={available} tone="success" />
            <MicroStat label="Active" value={active} tone={tone === "rose" ? "danger" : tone === "amber" ? "warning" : "success"} />
          </div>
        </>
      ) : (
        <p className="pt-3 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--dx-text-faint)]">Bed data unavailable</p>
      )}
    </div>
  );
}

function OccupancyBar({ percent }: { percent: number }) {
  const tone = occupancyTone(percent);
  const color = tone === "rose" ? "var(--dx-danger)" : tone === "amber" ? "var(--dx-warning)" : "var(--dx-success)";
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[var(--dx-border)]">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, background: color }} />
    </div>
  );
}

const statToneColor: Record<StatTone, string> = {
  info: "var(--dx-info)",
  success: "var(--dx-success)",
  warning: "var(--dx-warning)",
  danger: "var(--dx-danger)",
};

function MicroStat({ label, value, tone }: { label: string; value: number; tone: StatTone }) {
  return (
    <div className="rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] px-2 py-1.5 text-center">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">{label}</p>
      <p className="dx-mono mt-0.5 text-[13px] font-bold" style={{ color: statToneColor[tone] }}>{value}</p>
    </div>
  );
}

function SummaryStat({ label, value, tone, icon: Icon }: { label: string; value: number; tone: StatTone; icon: typeof BedIcon }) {
  return (
    <div className="flex flex-col items-start rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface)] p-3">
      <Icon className="mb-2 h-4 w-4" style={{ color: statToneColor[tone] }} />
      <p className="text-[20px] font-bold text-[var(--dx-text)]">{value}</p>
      <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">{label}</p>
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
    <DxInput label={label} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} mono={mono} disabled={disabled} hint={hint} />
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
  icon: typeof Hospital;
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
