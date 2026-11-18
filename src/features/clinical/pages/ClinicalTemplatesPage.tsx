import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  FileText,
  Layers,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { format, isValid } from "date-fns";
import {
  DxPage, DxPageHeader, DxPanel, DxBadge, DxButton, DxInput, DxSelect, DxMessage, DxPopup,
} from "@/components/dx";
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
    onError: (err: any) => toast.error("Couldn't duplicate", err?.response?.data?.message || "Please try again."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => clinicalTemplatesApi.remove(id),
    onSuccess: () => {
      toast.success("Template deleted", "It has been removed from the library.");
      refresh();
    },
    onError: (err: any) => toast.error("Couldn't delete", err?.response?.data?.message || "Please try again."),
  });

  const favoriteMut = useMutation({
    mutationFn: (tpl: ClinicalTemplate) => clinicalTemplatesApi.update(tpl.id, { is_favorite: !tpl.is_favorite }),
    onSuccess: refresh,
    onError: (err: any) => toast.error("Couldn't update", err?.response?.data?.message || "Please try again."),
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
        ? loadError.response.data?.message || "You don't have permission to view templates (TEMPLATE_READ required)."
        : loadError.response.data?.message || "The template service returned an error. Please retry."
    : null;

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Clinical" }, { label: "Templates" }]}
        title="Clinical Templates"
        subtitle="Standardize consultations with reusable SOAP, history, and examination templates."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={() => { templatesQuery.refetch(); statsQuery.refetch(); }} isLoading={templatesQuery.isFetching}><RotateCcw /></DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setEditTarget(null); setFormOpen(true); }}>Create template</DxButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Library stats */}
        <div className="lg:col-span-1">
          <DxPanel title="Standardization" icon={<Layers className="h-4 w-4" />}>
            <p className="mb-5 text-[12px] leading-relaxed text-[var(--dx-text-muted)]">
              Using templates reduces clinical documentation time while keeping notes consistent across your care teams.
            </p>
            <div className="space-y-3">
              {[
                { label: "Total templates", value: statsQuery.isLoading ? "…" : statsQuery.data?.total ?? 0, accent: false },
                { label: "Commonly used", value: statsQuery.isLoading ? "…" : statsQuery.data?.commonly_used ?? 0, accent: true },
                { label: "Specialties", value: statsQuery.isLoading ? "…" : specialties.length, accent: false },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] px-3 py-2">
                  <span className="text-[13px] font-medium text-[var(--dx-text-muted)]">{row.label}</span>
                  <span className="text-[18px] font-bold" style={{ color: row.accent ? "var(--dx-accent)" : "var(--dx-text)" }}>{row.value}</span>
                </div>
              ))}
            </div>
          </DxPanel>
        </div>

        {/* Template list */}
        <div className="space-y-4 lg:col-span-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full max-w-sm">
              <DxInput leftIcon={<Search className="h-3.5 w-3.5" />} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates by name or specialty…" />
            </div>
            <div className="w-full sm:w-56">
              <DxSelect value={specialtyFilter} onChange={(e) => setSpecialtyFilter(e.target.value)} aria-label="Filter by specialty"
                options={[{ value: "", label: "All specialties" }, ...specialties.map((s) => ({ value: s, label: s }))]} />
            </div>
          </div>

          {errorMessage ? (
            <DxMessage tone="danger" action={<DxButton size="sm" onClick={() => templatesQuery.refetch()}>Retry</DxButton>}>{errorMessage}</DxMessage>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {templatesQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="dx-skeleton h-44 w-full" />)
            ) : visible.length === 0 && !errorMessage ? (
              <DxPanel className="col-span-full">
                <div className="py-14 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--dx-surface-sunken)]"><FileText className="h-8 w-8 text-[var(--dx-text-faint)]" /></div>
                  <h4 className="text-[16px] font-bold text-[var(--dx-text)]">{templates.length === 0 ? "Library is empty" : "No matching templates"}</h4>
                  <p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--dx-text-muted)]">{templates.length === 0 ? "Create your first clinical documentation template." : "Try a different search term or specialty filter."}</p>
                  {templates.length === 0 ? (
                    <DxButton className="mx-auto mt-4" variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setEditTarget(null); setFormOpen(true); }}>Create template</DxButton>
                  ) : null}
                </div>
              </DxPanel>
            ) : (
              visible.map((tpl) => (
                <div key={tpl.id} className="flex flex-col rounded-lg border border-[var(--dx-border)] bg-[var(--dx-surface)] p-5 transition-colors hover:border-[var(--dx-border-strong)]">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]"><FileText className="h-5 w-5" /></div>
                    <div className="flex gap-0.5">
                      <DxButton icon size="sm" variant="text" title={tpl.is_favorite ? "Unmark commonly used" : "Mark commonly used"} onClick={() => favoriteMut.mutate(tpl)}>
                        <Star style={{ color: tpl.is_favorite ? "var(--dx-warning)" : undefined, fill: tpl.is_favorite ? "var(--dx-warning)" : "none" }} />
                      </DxButton>
                      <DxButton icon size="sm" variant="text" title="Duplicate" onClick={() => duplicateMut.mutate(tpl.id)}><Copy /></DxButton>
                      <DxButton icon size="sm" variant="text" title="Edit" onClick={() => { setEditTarget(tpl); setFormOpen(true); }}><Pencil /></DxButton>
                      <DxButton icon size="sm" variant="text" title="Delete" onClick={() => setDeleteTarget(tpl)}><Trash2 /></DxButton>
                    </div>
                  </div>
                  <h4 className="mb-2 text-[15px] font-bold text-[var(--dx-text)]">{tpl.name}</h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <DxBadge tone="accent">{tpl.specialty || "General"}</DxBadge>
                    <DxBadge tone="neutral">{typeLabel(tpl.template_type)}</DxBadge>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">{tpl.sections_count ?? tpl.sections?.length ?? 0} sections</span>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-[var(--dx-border)] pt-4">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">Updated {safeDate(tpl.updated_at || tpl.date_created)}</span>
                    <button onClick={() => setPreviewTarget(tpl)} className="text-[11px] font-semibold uppercase tracking-wide text-[var(--dx-accent)] hover:underline">Preview →</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Create / edit */}
      <TemplateFormModal isOpen={formOpen} onClose={() => { setFormOpen(false); setEditTarget(null); }} template={editTarget} />

      {/* Preview */}
      <DxPopup isOpen={!!previewTarget} onClose={() => setPreviewTarget(null)} title={previewTarget?.name || "Template preview"} size="lg">
        {previewTarget ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <DxBadge tone="neutral">{typeLabel(previewTarget.template_type)}</DxBadge>
              {previewTarget.specialty ? <DxBadge tone="accent">{previewTarget.specialty}</DxBadge> : null}
              <span className="text-[12px] text-[var(--dx-text-muted)]">Used {previewTarget.usage_count || 0} time{(previewTarget.usage_count || 0) === 1 ? "" : "s"}</span>
            </div>
            {previewTarget.description ? <p className="text-[13px] text-[var(--dx-text-muted)]">{previewTarget.description}</p> : null}
            <div className="space-y-3">
              {(previewTarget.sections || []).map((s, i) => (
                <div key={i} className="rounded-md border border-[var(--dx-border)] p-4">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">{s.title}</p>
                  <p className="whitespace-pre-wrap text-[13px] text-[var(--dx-text)]">{s.content || <span className="text-[var(--dx-text-faint)]">Free text — filled during the consultation.</span>}</p>
                </div>
              ))}
              {(previewTarget.sections || []).length === 0 ? <p className="text-[13px] text-[var(--dx-text-muted)]">This template has no sections yet.</p> : null}
            </div>
          </div>
        ) : null}
      </DxPopup>

      {/* Delete */}
      <DxPopup
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete this template?"
        locked={deleteMut.isPending}
        footer={
          <>
            <DxButton onClick={() => setDeleteTarget(null)} disabled={deleteMut.isPending}>Cancel</DxButton>
            <DxButton variant="danger" isLoading={deleteMut.isPending} leftIcon={<Trash2 className="h-4 w-4" />}
              onClick={async () => { if (!deleteTarget) return; await deleteMut.mutateAsync(deleteTarget.id); setDeleteTarget(null); }}>
              Delete template
            </DxButton>
          </>
        }
      >
        <DxMessage tone="danger">
          {deleteTarget ? `"${deleteTarget.name}" will be removed from the library. Consultations already written with it are not affected.` : ""}
        </DxMessage>
      </DxPopup>
    </DxPage>
  );
}
