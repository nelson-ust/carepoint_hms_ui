import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Building2,
  Edit3,
  GitBranch,
  Hash,
  Layers,
  ListChecks,
  ListPlus,
  MapPin,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import {
  DxPage, DxPageHeader, DxPanel, DxButton, DxBadge, DxPopup,
  DxInput, DxTextarea, DxSelect, DxCheckbox, DxMessage,
  DxStatusBar, DxStatusItem,
} from "@/components/dx";
import {
  createCombinedFlow,
  createTemplateStep,
  createVisitTemplate,
  deleteTemplateStep,
  deleteVisitTemplate,
  getVisitTemplate,
  getVisitTemplates,
  seedStandardPathway,
  updateTemplateStep,
  updateVisitTemplate,
} from "../api/visit-flows.api";
import type {
  TemplateStep,
  VisitTemplate,
} from "../api/visit-flows.api";
import { listActiveServiceDeliveryPoints } from "@/features/service-delivery-points/api/service-delivery-points.api";
import type { ServiceDeliveryPoint } from "@/features/service-delivery-points/api/service-delivery-points.api";

type TemplateForm = {
  name: string;
  code: string;
  description: string;
  is_default: boolean;
};

const emptyTemplateForm: TemplateForm = { name: "", code: "", description: "", is_default: false };

type StepForm = {
  service_delivery_point_id: string;
  step_order: string;
  is_required: boolean;
  notes: string;
};

const emptyStepForm: StepForm = {
  service_delivery_point_id: "",
  step_order: "1",
  is_required: false,
  notes: "",
};

type CombinedDraftStep = {
  service_delivery_point_id: string;
  is_required: boolean;
  notes: string;
};

type ActionKind =
  | "create-template"
  | "edit-template"
  | "create-step"
  | "edit-step"
  | "delete-template"
  | "delete-step"
  | "combined"
  | null;

export function VisitFlowManagementPage() {
  const [templates, setTemplates] = useState<VisitTemplate[]>([]);
  const [sdps, setSdps] = useState<ServiceDeliveryPoint[]>([]);
  const [searchParams] = useSearchParams();
  const wantedTemplateId = Number(searchParams.get("template")) || null;
  const wantedCode = searchParams.get("code");
  const [activeTemplateId, setActiveTemplateId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    { tone: "success" | "error"; message: string } | null
  >(null);

  const [search, setSearch] = useState("");

  const [actionKind, setActionKind] = useState<ActionKind>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [stepUnderEdit, setStepUnderEdit] = useState<TemplateStep | null>(null);
  const [reorderingStepId, setReorderingStepId] = useState<number | null>(null);

  const [templateForm, setTemplateForm] = useState<TemplateForm>(emptyTemplateForm);
  const [stepForm, setStepForm] = useState<StepForm>(emptyStepForm);
  const [combinedTemplate, setCombinedTemplate] = useState<TemplateForm>(emptyTemplateForm);
  const [combinedSteps, setCombinedSteps] = useState<CombinedDraftStep[]>([
    { service_delivery_point_id: "", is_required: true, notes: "" },
  ]);

  const showFeedback = (tone: "success" | "error", message: string) => {
    setFeedback({ tone, message });
    window.setTimeout(() => setFeedback(null), 3500);
  };

  const handleSeedStandard = async () => {
    if (
      !confirm(
        "Create the standard outpatient pathway (Registration → Triage → Consultation → Laboratory → Radiology → Pharmacy → Billing) from your configured service points?",
      )
    )
      return;
    setIsSeeding(true);
    try {
      const result = await seedStandardPathway();
      await load();
      let msg = result.message;
      if (result.skipped_types?.length) {
        msg += `\n\nSkipped (no service point configured): ${result.skipped_types.join(", ")}.`;
      }
      alert(msg);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Unable to seed the standard pathway.");
    } finally {
      setIsSeeding(false);
    }
  };

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [tmplRes, sdpRes] = await Promise.all([
        getVisitTemplates(),
        listActiveServiceDeliveryPoints({ skip: 0, limit: 200 }).catch(() => null),
      ]);
      const items = Array.isArray(tmplRes.items) ? tmplRes.items : [];
      setTemplates(items);
      setSdps(sdpRes?.items ?? []);
      if (activeTemplateId == null && items.length > 0) {
        const preferred =
          (wantedCode ? items.find((t) => t.code === wantedCode) : undefined) ??
          (wantedTemplateId ? items.find((t) => t.id === wantedTemplateId) : undefined) ??
          items[0];
        setActiveTemplateId(preferred.id);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to load visit flow templates.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) ||
        t.code?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q),
    );
  }, [templates, search]);

  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === activeTemplateId) ?? null,
    [templates, activeTemplateId],
  );

  const sortedSteps = useMemo(() => {
    if (!activeTemplate) return [] as TemplateStep[];
    const items = Array.isArray(activeTemplate.associated_visit_flow_templates_steps)
      ? activeTemplate.associated_visit_flow_templates_steps
      : [];
    return [...items].sort((a, b) => a.step_order - b.step_order);
  }, [activeTemplate]);

  const sdpName = (id: number) =>
    sdps.find((s) => s.id === id)?.name ?? `SDP #${id}`;

  const refreshTemplate = async (templateId: number) => {
    try {
      const fresh = await getVisitTemplate(templateId);
      setTemplates((prev) => prev.map((t) => (t.id === fresh.id ? fresh : t)));
    } catch {
      load();
    }
  };

  const closeActionForce = () => {
    setActionKind(null);
    setStepUnderEdit(null);
    setActionError(null);
  };

  const closeAction = () => {
    if (actionPending) return;
    closeActionForce();
  };

  const openCreateTemplate = () => {
    setActionKind("create-template");
    setTemplateForm(emptyTemplateForm);
    setActionError(null);
  };

  const openEditTemplate = () => {
    if (!activeTemplate) return;
    setActionKind("edit-template");
    setTemplateForm({
      name: activeTemplate.name ?? "",
      code: activeTemplate.code ?? "",
      description: activeTemplate.description ?? "",
      is_default: !!activeTemplate.is_default,
    });
    setActionError(null);
  };

  const openDeleteTemplate = () => {
    if (!activeTemplate) return;
    setActionKind("delete-template");
    setActionError(null);
  };

  const openCreateStep = () => {
    if (!activeTemplate) return;
    setActionKind("create-step");
    const nextOrder = sortedSteps.length
      ? Math.max(...sortedSteps.map((s) => s.step_order)) + 1
      : 1;
    setStepForm({
      ...emptyStepForm,
      step_order: String(nextOrder),
      service_delivery_point_id: sdps[0] ? String(sdps[0].id) : "",
    });
    setActionError(null);
  };

  const openEditStep = (step: TemplateStep) => {
    setActionKind("edit-step");
    setStepUnderEdit(step);
    setStepForm({
      service_delivery_point_id: String(step.service_delivery_point_id),
      step_order: String(step.step_order),
      is_required: !!step.is_required,
      notes: step.notes ?? "",
    });
    setActionError(null);
  };

  const openDeleteStep = (step: TemplateStep) => {
    setActionKind("delete-step");
    setStepUnderEdit(step);
    setActionError(null);
  };

  const openCombined = () => {
    setActionKind("combined");
    setCombinedTemplate(emptyTemplateForm);
    setCombinedSteps([{ service_delivery_point_id: "", is_required: true, notes: "" }]);
    setActionError(null);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim() || !templateForm.code.trim()) {
      setActionError("Name and code are required.");
      return;
    }
    setActionPending(true);
    setActionError(null);
    try {
      if (actionKind === "edit-template" && activeTemplate) {
        const updated = await updateVisitTemplate(activeTemplate.id, {
          name: templateForm.name.trim(),
          code: templateForm.code.trim().toUpperCase(),
          description: templateForm.description.trim() || undefined,
          is_default: templateForm.is_default,
        });
        setTemplates((prev) =>
          prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)),
        );
        showFeedback("success", "Template updated.");
      } else {
        const created = await createVisitTemplate({
          name: templateForm.name.trim(),
          code: templateForm.code.trim().toUpperCase(),
          description: templateForm.description.trim() || undefined,
          is_default: templateForm.is_default,
        });
        setTemplates((prev) => [...prev, created]);
        setActiveTemplateId(created.id);
        showFeedback("success", "Template created.");
      }
      closeActionForce();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || "Failed to save template.");
    } finally {
      setActionPending(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!activeTemplate) return;
    setActionPending(true);
    setActionError(null);
    try {
      await deleteVisitTemplate(activeTemplate.id);
      setTemplates((prev) => {
        const next = prev.filter((t) => t.id !== activeTemplate.id);
        setActiveTemplateId(next[0]?.id ?? null);
        return next;
      });
      showFeedback("success", "Template deleted.");
      closeActionForce();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || "Failed to delete template.");
    } finally {
      setActionPending(false);
    }
  };

  const handleSaveStep = async () => {
    if (!activeTemplate) return;
    if (!stepForm.service_delivery_point_id) {
      setActionError("Pick a service point.");
      return;
    }
    const stepOrder = Number(stepForm.step_order);
    if (Number.isNaN(stepOrder) || stepOrder < 1) {
      setActionError("Step order must be a positive number.");
      return;
    }
    setActionPending(true);
    setActionError(null);
    try {
      if (actionKind === "edit-step" && stepUnderEdit) {
        await updateTemplateStep(stepUnderEdit.id, {
          service_delivery_point_id: Number(stepForm.service_delivery_point_id),
          step_order: stepOrder,
          is_required: stepForm.is_required,
          notes: stepForm.notes.trim() || undefined,
        });
      } else {
        await createTemplateStep({
          template_id: activeTemplate.id,
          service_delivery_point_id: Number(stepForm.service_delivery_point_id),
          step_order: stepOrder,
          is_required: stepForm.is_required,
          notes: stepForm.notes.trim() || undefined,
        });
      }
      await refreshTemplate(activeTemplate.id);
      showFeedback("success", actionKind === "edit-step" ? "Step updated." : "Step added.");
      closeActionForce();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || "Failed to save step.");
    } finally {
      setActionPending(false);
    }
  };

  const handleDeleteStep = async () => {
    if (!activeTemplate || !stepUnderEdit) return;
    setActionPending(true);
    setActionError(null);
    try {
      await deleteTemplateStep(stepUnderEdit.id);
      await refreshTemplate(activeTemplate.id);
      showFeedback("success", "Step removed.");
      closeActionForce();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || "Failed to remove step.");
    } finally {
      setActionPending(false);
    }
  };

  const handleReorderStep = async (step: TemplateStep, direction: "up" | "down") => {
    if (!activeTemplate) return;
    const idx = sortedSteps.findIndex((s) => s.id === step.id);
    const swapWith = direction === "up" ? sortedSteps[idx - 1] : sortedSteps[idx + 1];
    if (!swapWith) return;
    setReorderingStepId(step.id);
    try {
      // Use a temporary unique step_order during the swap to avoid backend
      // uniqueness collisions on (template_id, step_order).
      const tempOrder = Math.max(...sortedSteps.map((s) => s.step_order)) + 100;
      await updateTemplateStep(step.id, { step_order: tempOrder });
      await updateTemplateStep(swapWith.id, { step_order: step.step_order });
      await updateTemplateStep(step.id, { step_order: swapWith.step_order });
      await refreshTemplate(activeTemplate.id);
    } catch (err: any) {
      showFeedback("error", err?.response?.data?.message || "Failed to reorder step.");
    } finally {
      setReorderingStepId(null);
    }
  };

  const handleCombinedCreate = async () => {
    if (!combinedTemplate.name.trim() || !combinedTemplate.code.trim()) {
      setActionError("Template name and code are required.");
      return;
    }
    const validSteps = combinedSteps.filter((s) => s.service_delivery_point_id);
    if (validSteps.length === 0) {
      setActionError("Add at least one step with a service point.");
      return;
    }
    setActionPending(true);
    setActionError(null);
    try {
      const result = await createCombinedFlow({
        template: {
          name: combinedTemplate.name.trim(),
          code: combinedTemplate.code.trim().toUpperCase(),
          description: combinedTemplate.description.trim() || undefined,
        },
        template_steps: validSteps.map((s, idx) => ({
          service_delivery_point_id: Number(s.service_delivery_point_id),
          step_order: idx + 1,
          is_required: s.is_required,
          notes: s.notes.trim() || undefined,
        })),
      });
      if (result.template) {
        setTemplates((prev) => [...prev, result.template!]);
        setActiveTemplateId(result.template.id);
        await refreshTemplate(result.template.id);
      }
      showFeedback("success", result.message || "Pathway created.");
      closeActionForce();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || "Failed to create pathway.");
    } finally {
      setActionPending(false);
    }
  };

  const sdpOptions = sdps.map((s) => ({ value: String(s.id), label: `${s.name} (${s.code}) · ${s.service_point_type}` }));

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Visits" }, { label: "Care pathways" }]}
        title="Care Pathway Orchestration"
        subtitle="Design clinical visit-flow templates that map a patient's journey through service delivery points."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={load} isLoading={isLoading}><RotateCcw /></DxButton>
            <DxButton leftIcon={<Sparkles className="h-4 w-4" />} isLoading={isSeeding} onClick={handleSeedStandard} title="Create the standard outpatient pathway from your service points">
              {isSeeding ? "Seeding…" : "Seed standard pathway"}
            </DxButton>
            <DxButton leftIcon={<Wand2 className="h-4 w-4" />} onClick={openCombined}>Pathway wizard</DxButton>
            <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreateTemplate}>New template</DxButton>
          </>
        }
      />

      <DxStatusBar>
        <DxStatusItem icon={<Layers className="h-3.5 w-3.5" />}>{templates.length} template{templates.length === 1 ? "" : "s"}</DxStatusItem>
        <DxStatusItem icon={<Building2 className="h-3.5 w-3.5" />}>{sdps.length} active service point{sdps.length === 1 ? "" : "s"}</DxStatusItem>
        {activeTemplate ? <DxStatusItem icon={<ListChecks className="h-3.5 w-3.5" />}>{sortedSteps.length} checkpoint{sortedSteps.length === 1 ? "" : "s"} in view</DxStatusItem> : null}
      </DxStatusBar>

      {feedback ? (
        <DxMessage tone={feedback.tone === "success" ? "success" : "danger"}>{feedback.message}</DxMessage>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Templates list */}
        <div className="lg:col-span-4">
          <DxPanel
            title="Pathway templates"
            icon={<Layers className="h-4 w-4" />}
            actions={<DxBadge tone="neutral">{templates.length}</DxBadge>}
          >
            <div className="space-y-3">
              <DxInput leftIcon={<Search className="h-3.5 w-3.5" />} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates…" />

              {isLoading ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="dx-skeleton h-16 w-full" />)}</div>
              ) : error ? (
                <DxMessage tone="danger" action={<DxButton size="sm" onClick={load}>Retry</DxButton>}>{error}</DxMessage>
              ) : filteredTemplates.length === 0 ? (
                <div className="py-8 text-center">
                  <GitBranch className="mx-auto mb-3 h-9 w-9 text-[var(--dx-text-faint)]" />
                  <p className="text-[12.5px] font-medium text-[var(--dx-text-muted)]">
                    {templates.length === 0 ? "Design your first care pathway." : "No templates match your search."}
                  </p>
                  {templates.length === 0 ? (
                    <DxButton className="mx-auto mt-4" size="sm" variant="primary" leftIcon={<Wand2 className="h-3.5 w-3.5" />} onClick={openCombined}>Use pathway wizard</DxButton>
                  ) : null}
                </div>
              ) : (
                <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                  {filteredTemplates.map((t) => {
                    const stepCount = Array.isArray(t.associated_visit_flow_templates_steps) ? t.associated_visit_flow_templates_steps.length : 0;
                    const isActive = t.id === activeTemplateId;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setActiveTemplateId(t.id)}
                        className="w-full rounded-md border p-3 text-left transition-colors"
                        style={{
                          borderColor: isActive ? "var(--dx-accent)" : "var(--dx-border)",
                          background: isActive ? "var(--dx-accent-soft)" : "var(--dx-surface)",
                        }}
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 dx-mono text-[11px] font-semibold text-[var(--dx-text-muted)]">
                            <Hash className="h-2.5 w-2.5" />{t.code}
                          </span>
                          <span className="flex items-center gap-1.5">
                            {t.is_default ? <DxBadge tone="success">Default</DxBadge> : null}
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">{stepCount} step{stepCount === 1 ? "" : "s"}</span>
                          </span>
                        </div>
                        <p className="text-[13.5px] font-semibold text-[var(--dx-text)]">{t.name}</p>
                        {t.description ? <p className="mt-0.5 line-clamp-2 text-[11.5px] text-[var(--dx-text-muted)]">{t.description}</p> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </DxPanel>
        </div>

        {/* Builder */}
        <div className="space-y-4 lg:col-span-8">
          {!activeTemplate ? (
            <DxPanel>
              <div className="py-16 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--dx-surface-sunken)]">
                  <GitBranch className="h-8 w-8 text-[var(--dx-text-faint)]" />
                </div>
                <h3 className="text-[17px] font-bold text-[var(--dx-text)]">No template selected</h3>
                <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--dx-text-muted)]">
                  Pick a template on the left to manage its checkpoints, or create a new one to design a fresh patient pathway.
                </p>
                <div className="mt-5 flex items-center justify-center gap-2">
                  <DxButton variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreateTemplate}>New template</DxButton>
                  <DxButton leftIcon={<Wand2 className="h-4 w-4" />} onClick={openCombined}>Wizard</DxButton>
                </div>
              </div>
            </DxPanel>
          ) : (
            <>
              {/* Template header */}
              <DxPanel>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--dx-accent)] text-white">
                      <GitBranch className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-[20px] font-bold text-[var(--dx-text)]">{activeTemplate.name}</h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 dx-mono text-[11px] font-semibold text-[var(--dx-text-muted)]"><Hash className="h-2.5 w-2.5" />{activeTemplate.code}</span>
                        <DxBadge tone="accent"><ListChecks className="mr-1 inline h-3 w-3" />{sortedSteps.length} checkpoint{sortedSteps.length === 1 ? "" : "s"}</DxBadge>
                        {activeTemplate.is_default ? <DxBadge tone="success">Default</DxBadge> : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DxButton size="sm" leftIcon={<Edit3 className="h-3.5 w-3.5" />} onClick={openEditTemplate}>Edit</DxButton>
                    <DxButton size="sm" icon variant="outline-danger" title="Delete" onClick={openDeleteTemplate}><Trash2 /></DxButton>
                  </div>
                </div>
                {activeTemplate.description ? <p className="mt-4 text-[13px] leading-relaxed text-[var(--dx-text-muted)]">{activeTemplate.description}</p> : null}
              </DxPanel>

              {/* Steps builder */}
              <DxPanel
                title="Checkpoints"
                icon={<ListChecks className="h-4 w-4" />}
                actions={<DxButton size="sm" variant="primary" leftIcon={<ListPlus className="h-3.5 w-3.5" />} disabled={sdps.length === 0} onClick={openCreateStep}>Add step</DxButton>}
              >
                {sdps.length === 0 ? (
                  <DxMessage tone="warning" className="mb-4">No active service delivery points. Configure them first to add steps.</DxMessage>
                ) : null}

                {sortedSteps.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--dx-surface-sunken)]">
                      <Sparkles className="h-6 w-6 text-[var(--dx-text-faint)]" />
                    </div>
                    <p className="text-[13px] font-medium text-[var(--dx-text-muted)]">No checkpoints yet — add the first stage of this pathway.</p>
                    {sdps.length > 0 ? <DxButton className="mx-auto mt-4" size="sm" variant="primary" leftIcon={<ListPlus className="h-3.5 w-3.5" />} onClick={openCreateStep}>Add first step</DxButton> : null}
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute bottom-8 left-[27px] top-8 w-px bg-[var(--dx-border-strong)]" />
                    <div className="space-y-3">
                      {sortedSteps.map((step, idx) => {
                        const sdp = step.service_delivery_point;
                        const sdpType = sdp?.service_point_type;
                        const isFirst = idx === 0;
                        const isLast = idx === sortedSteps.length - 1;
                        const isReordering = reorderingStepId === step.id;
                        return (
                          <div key={step.id} className="relative flex items-start gap-4">
                            <div className="z-10 flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-[var(--dx-accent)] text-white">
                              <span className="text-[7px] font-semibold uppercase tracking-wide opacity-80">Step</span>
                              <span className="text-[18px] font-bold leading-none">{step.step_order}</span>
                            </div>
                            <div className="flex-1 rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface)] p-4">
                              <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--dx-surface-sunken)] text-[var(--dx-text-muted)]">
                                    <Building2 className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="text-[13.5px] font-semibold text-[var(--dx-text)]">{sdp?.name ?? sdpName(step.service_delivery_point_id)}</p>
                                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                      {sdp?.code ? <span className="inline-flex items-center gap-1 dx-mono text-[10px] font-semibold text-[var(--dx-text-muted)]"><Hash className="h-2.5 w-2.5" />{sdp.code}</span> : null}
                                      {sdpType ? <DxBadge tone="info">{sdpType}</DxBadge> : null}
                                      {step.is_required ? <DxBadge tone="danger"><ShieldAlert className="mr-1 inline h-2.5 w-2.5" />Required</DxBadge> : null}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-0.5">
                                  <DxButton icon size="sm" variant="text" title="Move up" disabled={isFirst || isReordering} onClick={() => handleReorderStep(step, "up")}><ArrowUp /></DxButton>
                                  <DxButton icon size="sm" variant="text" title="Move down" disabled={isLast || isReordering} onClick={() => handleReorderStep(step, "down")}><ArrowDown /></DxButton>
                                  <DxButton icon size="sm" variant="text" title="Edit" onClick={() => openEditStep(step)}><Edit3 /></DxButton>
                                  <DxButton icon size="sm" variant="text" title="Delete" onClick={() => openDeleteStep(step)}><Trash2 /></DxButton>
                                </div>
                              </div>
                              {sdp?.location_description ? (
                                <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[var(--dx-text-muted)]"><MapPin className="h-3 w-3" />{sdp.location_description}</p>
                              ) : null}
                              {step.notes ? (
                                <p className="mt-2 rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] px-3 py-2 text-[11.5px] italic text-[var(--dx-text-muted)]">{step.notes}</p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </DxPanel>
            </>
          )}
        </div>
      </div>

      {/* ───── Template create / edit ───── */}
      <DxPopup
        isOpen={actionKind === "create-template" || actionKind === "edit-template"}
        onClose={closeAction}
        title={actionKind === "edit-template" ? "Edit template" : "New template"}
        locked={actionPending}
        footer={
          <>
            <DxButton onClick={closeAction} disabled={actionPending}>Cancel</DxButton>
            <DxButton variant="primary" isLoading={actionPending} onClick={handleSaveTemplate}>{actionKind === "edit-template" ? "Save changes" : "Create template"}</DxButton>
          </>
        }
      >
        {actionError ? <DxMessage tone="danger" className="mb-4">{actionError}</DxMessage> : null}
        <div className="space-y-4">
          <DxInput label="Name" required value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="Standard Outpatient Flow" />
          <DxInput label="Code" required mono value={templateForm.code} onChange={(e) => setTemplateForm({ ...templateForm, code: e.target.value.toUpperCase() })} placeholder="OPD_STD"
            disabled={actionKind === "edit-template"} hint={actionKind === "edit-template" ? "Code can't be changed after creation." : undefined} />
          <DxTextarea label="Description" rows={3} value={templateForm.description} onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })} placeholder="Briefly describe the clinical workflow…" />
          <DxCheckbox label="Set as the hospital's default care pathway" checked={templateForm.is_default} onChange={(e) => setTemplateForm({ ...templateForm, is_default: e.target.checked })} />
        </div>
      </DxPopup>

      {/* ───── Step create / edit ───── */}
      <DxPopup
        isOpen={(actionKind === "create-step" || actionKind === "edit-step") && !!activeTemplate}
        onClose={closeAction}
        title={actionKind === "edit-step" ? "Edit checkpoint" : "Add checkpoint"}
        locked={actionPending}
        footer={
          <>
            <DxButton onClick={closeAction} disabled={actionPending}>Cancel</DxButton>
            <DxButton variant="primary" isLoading={actionPending} onClick={handleSaveStep}>{actionKind === "edit-step" ? "Save changes" : "Add step"}</DxButton>
          </>
        }
      >
        {actionError ? <DxMessage tone="danger" className="mb-4">{actionError}</DxMessage> : null}
        <div className="space-y-4">
          <DxSelect label="Service delivery point" required value={stepForm.service_delivery_point_id}
            onChange={(e) => setStepForm({ ...stepForm, service_delivery_point_id: e.target.value })}
            placeholder="Pick a service point…" options={sdpOptions} />
          <DxInput label="Step order" type="number" mono value={stepForm.step_order} onChange={(e) => setStepForm({ ...stepForm, step_order: e.target.value })} placeholder="1" />
          <DxCheckbox label="Required checkpoint" description="Patient must complete this step before moving on." checked={stepForm.is_required} onChange={(e) => setStepForm({ ...stepForm, is_required: e.target.checked })} />
          <DxTextarea label="Notes" rows={2} value={stepForm.notes} onChange={(e) => setStepForm({ ...stepForm, notes: e.target.value })} placeholder="Operating notes for the staff at this stage…" />
        </div>
      </DxPopup>

      {/* ───── Delete template ───── */}
      <DxPopup
        isOpen={actionKind === "delete-template" && !!activeTemplate}
        onClose={closeAction}
        title="Delete template"
        locked={actionPending}
        footer={
          <>
            <DxButton onClick={closeAction} disabled={actionPending}>Cancel</DxButton>
            <DxButton variant="danger" leftIcon={<Trash2 className="h-4 w-4" />} isLoading={actionPending} onClick={handleDeleteTemplate}>Delete template</DxButton>
          </>
        }
      >
        <DxMessage tone="danger" title="This cannot be undone">
          Delete <strong>{activeTemplate?.name}</strong> (<span className="dx-mono">{activeTemplate?.code}</span>)? Active visits already linked to this template will not be affected, but it will no longer be available for new visits.
        </DxMessage>
      </DxPopup>

      {/* ───── Delete step ───── */}
      <DxPopup
        isOpen={actionKind === "delete-step" && !!stepUnderEdit}
        onClose={closeAction}
        title="Remove checkpoint"
        locked={actionPending}
        footer={
          <>
            <DxButton onClick={closeAction} disabled={actionPending}>Cancel</DxButton>
            <DxButton variant="danger" leftIcon={<Trash2 className="h-4 w-4" />} isLoading={actionPending} onClick={handleDeleteStep}>Remove step</DxButton>
          </>
        }
      >
        <DxMessage tone="danger" title="This cannot be undone">
          Remove step <strong>{stepUnderEdit?.step_order}</strong> ({stepUnderEdit?.service_delivery_point?.name ?? `SDP #${stepUnderEdit?.service_delivery_point_id}`}) from this template?
        </DxMessage>
      </DxPopup>

      {/* ───── Pathway wizard (combined) ───── */}
      <DxPopup
        isOpen={actionKind === "combined"}
        onClose={closeAction}
        title="Pathway wizard"
        size="lg"
        locked={actionPending}
        footer={
          <>
            <DxButton onClick={closeAction} disabled={actionPending}>Cancel</DxButton>
            <DxButton variant="primary" leftIcon={<Wand2 className="h-4 w-4" />} isLoading={actionPending} onClick={handleCombinedCreate}>Create pathway</DxButton>
          </>
        }
      >
        {actionError ? <DxMessage tone="danger" className="mb-4">{actionError}</DxMessage> : null}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <DxInput label="Name" required value={combinedTemplate.name} onChange={(e) => setCombinedTemplate({ ...combinedTemplate, name: e.target.value })} placeholder="Maternity Antenatal Flow" />
            <DxInput label="Code" required mono value={combinedTemplate.code} onChange={(e) => setCombinedTemplate({ ...combinedTemplate, code: e.target.value.toUpperCase() })} placeholder="MAT_ANC" />
          </div>
          <DxTextarea label="Description" rows={2} value={combinedTemplate.description} onChange={(e) => setCombinedTemplate({ ...combinedTemplate, description: e.target.value })} placeholder="What this pathway is for…" />
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]"><ListChecks className="h-3 w-3" /> Checkpoints</h4>
              <DxButton size="sm" variant="text" leftIcon={<Plus className="h-3 w-3" />} onClick={() => setCombinedSteps((prev) => [...prev, { service_delivery_point_id: "", is_required: false, notes: "" }])}>Add step</DxButton>
            </div>
            {combinedSteps.map((s, idx) => (
              <div key={idx} className="space-y-2.5 rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface-sunken)] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--dx-text-muted)]">Step {idx + 1}</span>
                  {combinedSteps.length > 1 ? (
                    <DxButton icon size="sm" variant="text" title="Remove" onClick={() => setCombinedSteps((prev) => prev.filter((_, i) => i !== idx))}><Trash2 /></DxButton>
                  ) : null}
                </div>
                <DxSelect value={s.service_delivery_point_id} placeholder="Pick a service point…"
                  options={sdps.map((sdp) => ({ value: String(sdp.id), label: `${sdp.name} (${sdp.code})` }))}
                  onChange={(e) => setCombinedSteps((prev) => prev.map((row, i) => (i === idx ? { ...row, service_delivery_point_id: e.target.value } : row)))} />
                <div className="flex items-center gap-3">
                  <DxCheckbox label="Required" checked={s.is_required}
                    onChange={() => setCombinedSteps((prev) => prev.map((row, i) => (i === idx ? { ...row, is_required: !row.is_required } : row)))} />
                  <div className="flex-1">
                    <DxInput value={s.notes} placeholder="Notes for staff at this stage…"
                      onChange={(e) => setCombinedSteps((prev) => prev.map((row, i) => (i === idx ? { ...row, notes: e.target.value } : row)))} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="flex items-center gap-1.5 text-[11px] text-[var(--dx-text-muted)]"><AlertCircle className="h-3 w-3" /> Steps are auto-numbered in the order shown above.</p>
        </div>
      </DxPopup>
    </DxPage>
  );
}
