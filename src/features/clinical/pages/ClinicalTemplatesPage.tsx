import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  FileText,
  Filter,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { format, isValid } from "date-fns";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  clinicalTemplatesApi,
  TEMPLATE_TYPES,
  type ClinicalTemplate,
} from "../api/clinical-templates.api";
import { TemplateFormModal } from "../components/TemplateFormModal";

function safeDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return isValid(d) ? format(d, "MMM d, yyyy") : "—";
}

function typeLabel(value?: string): string {
  return TEMPLATE_TYPES.find((t) => t.value === value)?.label || value || "General";
}

export function ClinicalTemplatesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ClinicalTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClinicalTemplate | null>(null);
  const [previewTarget, setPreviewTarget] = useState<ClinicalTemplate | null>(null);

  const templatesQuery = useQuery({
    queryKey: ["clinical-templates", "list"],
    queryFn: () => clinicalTemplatesApi.list(),
  });
  const statsQuery = useQuery({
    queryKey: ["clinical-templates", "stats"],
    queryFn: clinicalTemplatesApi.stats,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["clinical-templates"] });

  const duplicateMut = useMutation({
    mutationFn: (id: number) => clinicalTemplatesApi.duplicate(id),
    onSuccess: (copy) => {
      toast.success("Template duplicated", `"${copy.name}" was added to the library.`);
      refresh();
    },
    onError: (err: any) =>
      toast.error("Couldn't duplicate", err?.response?.data?.message || "Please try again."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => clinicalTemplatesApi.remove(id),
    onSuccess: () => {
      toast.success("Template deleted", "It has been removed from the library.");
      refresh();
    },
    onError: (err: any) =>
      toast.error("Couldn't delete", err?.response?.data?.message || "Please try again."),
  });

  const favoriteMut = useMutation({
    mutationFn: (tpl: ClinicalTemplate) =>
      clinicalTemplatesApi.update(tpl.id, { is_favorite: !tpl.is_favorite }),
    onSuccess: refresh,
    onError: (err: any) =>
      toast.error("Couldn't update", err?.response?.data?.message || "Please try again."),
  });

  const templates = templatesQuery.data ?? [];
  const specialties = statsQuery.data?.specialties ?? [];

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (specialtyFilter && (t.specialty || "") !== specialtyFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.specialty || "").toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q)
      );
    });
  }, [templates, search, specialtyFilter]);

  const loadError = templatesQuery.error as any;
  const errorMessage = loadError
    ? !loadError?.response
      ? "Cannot reach the API server. Check that the backend is running, then retry."
      : loadError.response.status === 401 || loadError.response.status === 403
        ? loadError.response.data?.message ||
          "You don't have permission to view templates (TEMPLATE_READ required)."
        : loadError.response.data?.message || "The template service returned an error. Please retry."
    : null;

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <PageHeader
        title="Clinical Templates"
        description="Standardize consultations with reusable SOAP, history, and examination templates."
        actions={
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                templatesQuery.refetch();
                statsQuery.refetch();
              }}
              leftIcon={
                <RefreshCw className={`h-4 w-4 ${templatesQuery.isFetching ? "animate-spin" : ""}`} />
              }
            >
              Refresh
            </Button>
            <Button
              onClick={() => {
                setEditTarget(null);
                setFormOpen(true);
              }}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Create Template
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        {/* Library stats */}
        <div className="space-y-6 lg:col-span-1">
          <div className="glass-card rounded-[2.5rem] border border-secondary-400/50 bg-white/40 p-8 shadow-premium">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary-900 text-white shadow-lg">
              <Layers className="h-8 w-8" />
            </div>
            <h4 className="mb-2 text-xl font-black text-secondary-900">Standardization</h4>
            <p className="mb-8 text-xs leading-relaxed text-secondary-500">
              Using templates reduces clinical documentation time while keeping notes consistent
              across your care teams.
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-secondary-700">Total Templates</span>
                <span className="text-xl font-black text-secondary-900">
                  {statsQuery.isLoading ? "…" : statsQuery.data?.total ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-secondary-700">Commonly Used</span>
                <span className="text-xl font-black text-primary-500">
                  {statsQuery.isLoading ? "…" : statsQuery.data?.commonly_used ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-secondary-700">Specialties</span>
                <span className="text-xl font-black text-secondary-900">
                  {statsQuery.isLoading ? "…" : specialties.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Template list */}
        <div className="space-y-6 lg:col-span-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="group relative w-full max-w-sm">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400 transition-colors group-focus-within:text-primary-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates by name or specialty..."
                className="w-full rounded-2xl border border-secondary-400 bg-white/60 py-3 pl-12 pr-6 text-sm font-medium outline-none transition-all focus:border-primary-500"
              />
            </div>
            <div className="relative">
              <Filter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" />
              <select
                value={specialtyFilter}
                onChange={(e) => setSpecialtyFilter(e.target.value)}
                className="appearance-none rounded-2xl border border-secondary-400 bg-white/60 py-3 pl-11 pr-8 text-xs font-bold outline-none transition-all focus:border-primary-500"
              >
                <option value="">All Specialties</option>
                {specialties.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-center justify-between gap-4 rounded-[2rem] border border-rose-100 bg-rose-50 p-6 text-rose-600">
              <p className="text-sm font-bold">{errorMessage}</p>
              <Button variant="secondary" size="sm" onClick={() => templatesQuery.refetch()}>
                Retry
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {templatesQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-48 animate-pulse rounded-[2.5rem] bg-white/40" />
              ))
            ) : visible.length === 0 && !errorMessage ? (
              <div className="col-span-2 rounded-[3rem] border-2 border-dashed border-secondary-400 bg-white/20">
                <EmptyState
                  icon={FileText}
                  title={templates.length === 0 ? "Library is Empty" : "No matching templates"}
                  description={
                    templates.length === 0
                      ? "Create your first clinical documentation template."
                      : "Try a different search term or specialty filter."
                  }
                  action={
                    templates.length === 0 ? (
                      <Button
                        onClick={() => {
                          setEditTarget(null);
                          setFormOpen(true);
                        }}
                        leftIcon={<Plus className="h-4 w-4" />}
                      >
                        Create Template
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              visible.map((tpl) => (
                <div
                  key={tpl.id}
                  className="glass-card group relative overflow-hidden rounded-[2.5rem] border border-secondary-400/50 bg-white/40 p-8 transition-all hover:bg-white/60"
                >
                  <div className="mb-6 flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-600 shadow-sm transition-all group-hover:bg-primary-500 group-hover:text-white">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => favoriteMut.mutate(tpl)}
                        className={`rounded-xl p-2.5 transition-all hover:bg-secondary-100 ${
                          tpl.is_favorite ? "text-amber-500" : "text-secondary-400"
                        }`}
                        title={tpl.is_favorite ? "Unmark commonly used" : "Mark commonly used"}
                      >
                        <Star className={`h-4 w-4 ${tpl.is_favorite ? "fill-current" : ""}`} />
                      </button>
                      <button
                        onClick={() => duplicateMut.mutate(tpl.id)}
                        className="rounded-xl p-2.5 text-secondary-400 transition-all hover:bg-secondary-100"
                        title="Duplicate"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditTarget(tpl);
                          setFormOpen(true);
                        }}
                        className="rounded-xl p-2.5 text-secondary-400 transition-all hover:bg-secondary-100"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(tpl)}
                        className="rounded-xl p-2.5 text-secondary-400 transition-all hover:bg-rose-500/10 hover:text-rose-500"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <h4 className="mb-2 text-lg font-black text-secondary-900">{tpl.name}</h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-secondary-900 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-white">
                      {tpl.specialty || "General"}
                    </span>
                    <Badge variant="secondary">{typeLabel(tpl.template_type)}</Badge>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
                      {tpl.sections_count ?? tpl.sections?.length ?? 0} Sections
                    </span>
                  </div>
                  <div className="mt-8 flex items-center justify-between border-t border-secondary-400/50 pt-6">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">
                      Updated {safeDate(tpl.updated_at || tpl.date_created)}
                    </span>
                    <button
                      onClick={() => setPreviewTarget(tpl)}
                      className="text-xs font-black uppercase tracking-widest text-primary-600 hover:underline"
                    >
                      Preview →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Create / edit */}
      <TemplateFormModal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditTarget(null);
        }}
        template={editTarget}
      />

      {/* Preview */}
      <Modal
        isOpen={!!previewTarget}
        onClose={() => setPreviewTarget(null)}
        title={previewTarget?.name || "Template preview"}
        size="lg"
      >
        {previewTarget ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{typeLabel(previewTarget.template_type)}</Badge>
              {previewTarget.specialty ? <Badge variant="secondary">{previewTarget.specialty}</Badge> : null}
              <span className="text-xs font-medium text-secondary-400">
                Used {previewTarget.usage_count || 0} time{(previewTarget.usage_count || 0) === 1 ? "" : "s"}
              </span>
            </div>
            {previewTarget.description ? (
              <p className="text-sm font-medium text-secondary-500">{previewTarget.description}</p>
            ) : null}
            <div className="space-y-3">
              {(previewTarget.sections || []).map((s, i) => (
                <div key={i} className="rounded-2xl border border-secondary-200 p-4 dark:border-white/10">
                  <p className="mb-1 text-xs font-bold uppercase tracking-widest text-secondary-500">
                    {s.title}
                  </p>
                  <p className="whitespace-pre-wrap text-sm font-medium text-secondary-700 dark:text-secondary-200">
                    {s.content || <span className="text-secondary-300">Free text — filled during the consultation.</span>}
                  </p>
                </div>
              ))}
              {(previewTarget.sections || []).length === 0 ? (
                <p className="text-sm font-medium text-secondary-400">This template has no sections yet.</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Delete */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete this template?"
        tone="danger"
        confirmLabel="Delete template"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" will be removed from the library. Consultations already written with it are not affected.`
            : undefined
        }
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteMut.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
