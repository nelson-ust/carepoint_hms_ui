import { PageHeader } from "@/components/layout/PageHeader";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Building2,
  CheckCircle2,
  ClipboardList,
  Copy,
  Edit3,
  FileText,
  GitBranch,
  Hash,
  Layers,
  ListChecks,
  ListPlus,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import {
  createCombinedFlow,
  createTemplateStep,
  createVisitTemplate,
  deleteTemplateStep,
  deleteVisitTemplate,
  getVisitTemplate,
  getVisitTemplates,
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
};

const emptyTemplateForm: TemplateForm = { name: "", code: "", description: "" };

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
  const [activeTemplateId, setActiveTemplateId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
        setActiveTemplateId(items[0].id);
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

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <PageHeader
          title="Care Pathway Orchestration"
          description="Design clinical visit flow templates that map a patient's journey through service delivery points."
        />
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={load}
            className="btn-secondary p-4 rounded-2xl bg-white/80 border-secondary-400 hover:rotate-180 transition-transform duration-500"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={openCombined}
            className="btn-secondary gap-2 px-5 py-3 rounded-2xl bg-white/80 border-secondary-400"
          >
            <Wand2 className="h-4 w-4" />
            <span className="text-sm font-bold">Pathway Wizard</span>
          </button>
          <button
            onClick={openCreateTemplate}
            className="btn-primary gap-3 py-3 px-7 shadow-xl shadow-primary-500/20"
          >
            <Plus className="h-5 w-5" />
            <span className="font-bold">New Template</span>
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

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Templates list */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-card rounded-[2.5rem] p-6 bg-white/50 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-black flex items-center gap-2">
                <Layers className="h-4 w-4 text-secondary-500" />
                Pathway Templates
              </h3>
              <span className="px-2.5 py-1 rounded-lg bg-secondary-100 text-secondary-600 text-[10px] font-bold uppercase tracking-widest">
                {templates.length}
              </span>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates..."
                className="w-full bg-white/70 border border-secondary-400 rounded-xl pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary-500/40 transition-all"
              />
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-2xl bg-secondary-100/40 animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-center">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p className="text-xs font-bold">{error}</p>
                <button onClick={load} className="text-xs font-bold underline mt-2">
                  Retry
                </button>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="py-8 text-center">
                <GitBranch className="h-10 w-10 mx-auto text-secondary-200 mb-3" />
                <p className="text-xs text-secondary-500 font-bold">
                  {templates.length === 0
                    ? "Design your first care pathway."
                    : "No templates match your search."}
                </p>
                {templates.length === 0 && (
                  <button
                    onClick={openCombined}
                    className="btn-primary mt-4 gap-2 px-4 py-2 text-xs"
                  >
                    <Wand2 className="h-3 w-3" />
                    Use Pathway Wizard
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                {filteredTemplates.map((t) => {
                  const stepCount = Array.isArray(t.associated_visit_flow_templates_steps)
                    ? t.associated_visit_flow_templates_steps.length
                    : 0;
                  const isActive = t.id === activeTemplateId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTemplateId(t.id)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all ${isActive
                          ? "bg-primary-500 text-white border-primary-500 shadow-md shadow-primary-500/20"
                          : "bg-white border-secondary-400 hover:border-primary-200"
                        }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${isActive
                              ? "bg-white/20 text-white"
                              : "bg-secondary-100 text-secondary-500"
                            }`}
                        >
                          <Hash className="h-2.5 w-2.5" />
                          {t.code}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? "text-white/70" : "text-secondary-400"
                            }`}
                        >
                          {stepCount} step{stepCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      <p className="text-sm font-black">{t.name}</p>
                      {t.description && (
                        <p
                          className={`text-[11px] mt-1 line-clamp-2 ${isActive ? "text-white/70" : "text-secondary-500"
                            }`}
                        >
                          {t.description}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Builder */}
        <div className="lg:col-span-8 space-y-6">
          {!activeTemplate ? (
            <div className="glass-card rounded-[3rem] p-16 text-center bg-white/50">
              <div className="h-20 w-20 mx-auto bg-secondary-50 rounded-3xl flex items-center justify-center mb-4">
                <GitBranch className="h-10 w-10 text-secondary-200" />
              </div>
              <h3 className="text-xl font-bold text-secondary-900">No Template Selected</h3>
              <p className="text-sm text-secondary-500 mt-2 max-w-md mx-auto">
                Pick a template on the left to manage its checkpoints, or create a new one
                to design a fresh patient pathway.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <button onClick={openCreateTemplate} className="btn-primary gap-2 px-6 py-3">
                  <Plus className="h-4 w-4" />
                  <span>New Template</span>
                </button>
                <button onClick={openCombined} className="btn-secondary gap-2 px-6 py-3">
                  <Wand2 className="h-4 w-4" />
                  <span>Wizard</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Template header */}
              <div className="glass-card rounded-[2.5rem] p-8 bg-white/80 shadow-premium">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md">
                      <GitBranch className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black font-display tracking-tight">
                        {activeTemplate.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 bg-secondary-100 text-secondary-600 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold">
                          <Hash className="h-2.5 w-2.5" />
                          {activeTemplate.code}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-50 text-primary-600 border border-primary-100 text-[10px] font-bold uppercase tracking-widest">
                          <ListChecks className="h-3 w-3" />
                          {sortedSteps.length} Checkpoint
                          {sortedSteps.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={openEditTemplate}
                      className="btn-secondary gap-2 px-4 py-2.5 text-xs"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={openDeleteTemplate}
                      className="p-2.5 rounded-xl hover:bg-rose-50 text-rose-500"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {activeTemplate.description && (
                  <p className="text-sm text-secondary-600 mt-4 leading-relaxed">
                    {activeTemplate.description}
                  </p>
                )}
              </div>

              {/* Steps builder */}
              <div className="glass-card rounded-[2.5rem] p-8 bg-white/80 shadow-premium">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-black flex items-center gap-2">
                    <ListChecks className="h-5 w-5 text-secondary-500" />
                    Checkpoints
                  </h3>
                  <button
                    onClick={openCreateStep}
                    disabled={sdps.length === 0}
                    className="btn-primary gap-2 px-5 py-2.5 text-xs disabled:opacity-50"
                  >
                    <ListPlus className="h-3.5 w-3.5" />
                    <span>Add Step</span>
                  </button>
                </div>

                {sdps.length === 0 && (
                  <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-center gap-3">
                    <ShieldAlert className="h-5 w-5 text-amber-600" />
                    <p className="text-xs text-amber-700 font-bold">
                      No active service delivery points. Configure them first to add steps.
                    </p>
                  </div>
                )}

                {sortedSteps.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="h-14 w-14 mx-auto bg-secondary-50 rounded-3xl flex items-center justify-center mb-3">
                      <Sparkles className="h-7 w-7 text-secondary-300" />
                    </div>
                    <p className="text-sm text-secondary-500 font-bold">
                      No checkpoints yet — add the first stage of this pathway.
                    </p>
                    {sdps.length > 0 && (
                      <button
                        onClick={openCreateStep}
                        className="btn-primary mt-4 gap-2 px-5 py-2.5 text-xs"
                      >
                        <ListPlus className="h-3.5 w-3.5" />
                        <span>Add First Step</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-[39px] top-10 bottom-10 w-0.5 bg-gradient-to-b from-primary-500/20 via-primary-500 to-primary-500/20" />
                    <div className="space-y-4">
                      {sortedSteps.map((step, idx) => {
                        const sdp = step.service_delivery_point;
                        const sdpType = sdp?.service_point_type;
                        const isFirst = idx === 0;
                        const isLast = idx === sortedSteps.length - 1;
                        const isReordering = reorderingStepId === step.id;
                        return (
                          <div key={step.id} className="flex items-start gap-6 relative">
                            <div className="h-20 w-20 rounded-[2rem] bg-primary-500 text-white flex flex-col items-center justify-center shadow-md shadow-primary-500/20 z-10 shrink-0">
                              <span className="text-[8px] font-bold uppercase tracking-widest opacity-70">
                                Step
                              </span>
                              <span className="text-2xl font-black">{step.step_order}</span>
                            </div>
                            <div className="flex-1 p-6 rounded-[2rem] bg-white border border-secondary-400 hover:border-primary-300 transition-all">
                              <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <div className="h-10 w-10 rounded-xl bg-secondary-100 text-secondary-600 flex items-center justify-center">
                                    <Building2 className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-black text-secondary-900">
                                      {sdp?.name ?? sdpName(step.service_delivery_point_id)}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      {sdp?.code && (
                                        <span className="inline-flex items-center gap-1 bg-secondary-100 text-secondary-500 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold">
                                          <Hash className="h-2.5 w-2.5" />
                                          {sdp.code}
                                        </span>
                                      )}
                                      {sdpType && (
                                        <span className="inline-flex px-2 py-0.5 rounded-md bg-primary-50 text-primary-600 border border-primary-100 text-[9px] font-bold uppercase tracking-widest">
                                          {sdpType}
                                        </span>
                                      )}
                                      {step.is_required && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-100 text-[9px] font-bold uppercase tracking-widest">
                                          <ShieldAlert className="h-2.5 w-2.5" />
                                          Required
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleReorderStep(step, "up")}
                                    disabled={isFirst || isReordering}
                                    className="p-2 rounded-lg hover:bg-secondary-100 text-secondary-500 disabled:opacity-30"
                                    title="Move up"
                                  >
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleReorderStep(step, "down")}
                                    disabled={isLast || isReordering}
                                    className="p-2 rounded-lg hover:bg-secondary-100 text-secondary-500 disabled:opacity-30"
                                    title="Move down"
                                  >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => openEditStep(step)}
                                    className="p-2 rounded-lg hover:bg-secondary-100 text-secondary-500"
                                    title="Edit"
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => openDeleteStep(step)}
                                    className="p-2 rounded-lg hover:bg-rose-50 text-rose-500"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                              {sdp?.location_description && (
                                <p className="text-[11px] font-bold text-secondary-400 flex items-center gap-1.5 mt-2">
                                  <MapPin className="h-3 w-3" />
                                  {sdp.location_description}
                                </p>
                              )}
                              {step.notes && (
                                <p className="text-[11px] text-secondary-600 mt-3 italic bg-secondary-50 rounded-xl px-3 py-2 border border-secondary-400">
                                  {step.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* MODALS */}

      {(actionKind === "create-template" || actionKind === "edit-template") && (
        <Modal
          title={actionKind === "edit-template" ? "Edit Template" : "New Template"}
          subtitle="Define A Care Pathway Shell"
          icon={actionKind === "edit-template" ? Edit3 : Plus}
          onClose={closeAction}
        >
          {actionError && <ErrorBanner message={actionError} />}
          <div className="space-y-5">
            <Field
              label="Name *"
              value={templateForm.name}
              onChange={(v) => setTemplateForm({ ...templateForm, name: v })}
              placeholder="Standard Outpatient Flow"
            />
            <Field
              label="Code *"
              value={templateForm.code}
              onChange={(v) => setTemplateForm({ ...templateForm, code: v.toUpperCase() })}
              placeholder="OPD_STD"
              mono
              disabled={actionKind === "edit-template"}
              hint={actionKind === "edit-template" ? "Code cannot be changed after creation" : undefined}
            />
            <FieldLabel label="Description">
              <textarea
                value={templateForm.description}
                onChange={(e) =>
                  setTemplateForm({ ...templateForm, description: e.target.value })
                }
                placeholder="Briefly describe the clinical workflow..."
                className="input-field h-24 bg-secondary-50 border-secondary-400 w-full resize-none py-3"
              />
            </FieldLabel>
          </div>
          <ModalActions
            onClose={closeAction}
            onSubmit={handleSaveTemplate}
            pending={actionPending}
            submitLabel={actionKind === "edit-template" ? "Save Changes" : "Create Template"}
            submitIcon={Save}
          />
        </Modal>
      )}

      {(actionKind === "create-step" || actionKind === "edit-step") && activeTemplate && (
        <Modal
          title={actionKind === "edit-step" ? "Edit Checkpoint" : "Add Checkpoint"}
          subtitle="Configure A Stop On The Patient Pathway"
          icon={actionKind === "edit-step" ? Edit3 : ListPlus}
          onClose={closeAction}
        >
          {actionError && <ErrorBanner message={actionError} />}
          <div className="space-y-5">
            <FieldLabel label="Service Delivery Point *">
              <select
                value={stepForm.service_delivery_point_id}
                onChange={(e) =>
                  setStepForm({ ...stepForm, service_delivery_point_id: e.target.value })
                }
                className="input-field h-12 bg-secondary-50 border-secondary-400 w-full"
              >
                <option value="">Pick a service point...</option>
                {sdps.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code}) · {s.service_point_type}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <Field
              label="Step Order"
              value={stepForm.step_order}
              onChange={(v) => setStepForm({ ...stepForm, step_order: v })}
              placeholder="1"
              type="number"
              mono
            />
            <ToggleSwitch
              label="Required Checkpoint"
              hint="Patient must complete this step before moving on"
              value={stepForm.is_required}
              onChange={(v) => setStepForm({ ...stepForm, is_required: v })}
            />
            <FieldLabel label="Notes">
              <textarea
                value={stepForm.notes}
                onChange={(e) => setStepForm({ ...stepForm, notes: e.target.value })}
                placeholder="Operating notes for the staff at this stage..."
                className="input-field h-20 bg-secondary-50 border-secondary-400 w-full resize-none py-3"
              />
            </FieldLabel>
          </div>
          <ModalActions
            onClose={closeAction}
            onSubmit={handleSaveStep}
            pending={actionPending}
            submitLabel={actionKind === "edit-step" ? "Save Changes" : "Add Step"}
            submitIcon={Save}
          />
        </Modal>
      )}

      {actionKind === "delete-template" && activeTemplate && (
        <Modal
          title="Delete Template"
          subtitle="This Cannot Be Undone"
          icon={Trash2}
          tone="rose"
          onClose={closeAction}
        >
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-sm text-rose-700 leading-relaxed">
              Delete <strong>{activeTemplate.name}</strong> (
              <span className="font-mono">{activeTemplate.code}</span>)? Active visits
              already linked to this template will not be affected, but it will no longer
              be available for new visits.
            </p>
          </div>
          <ModalActions
            onClose={closeAction}
            onSubmit={handleDeleteTemplate}
            pending={actionPending}
            submitLabel="Delete Template"
            submitIcon={Trash2}
            tone="rose"
          />
        </Modal>
      )}

      {actionKind === "delete-step" && stepUnderEdit && (
        <Modal
          title="Remove Checkpoint"
          subtitle="This Cannot Be Undone"
          icon={Trash2}
          tone="rose"
          onClose={closeAction}
        >
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-sm text-rose-700 leading-relaxed">
              Remove step <strong>{stepUnderEdit.step_order}</strong> (
              {stepUnderEdit.service_delivery_point?.name ?? `SDP #${stepUnderEdit.service_delivery_point_id}`}
              ) from this template?
            </p>
          </div>
          <ModalActions
            onClose={closeAction}
            onSubmit={handleDeleteStep}
            pending={actionPending}
            submitLabel="Remove Step"
            submitIcon={Trash2}
            tone="rose"
          />
        </Modal>
      )}

      {actionKind === "combined" && (
        <Modal
          title="Pathway Wizard"
          subtitle="Build A Template With Its Checkpoints In One Shot"
          icon={Wand2}
          onClose={closeAction}
          tone="emerald"
        >
          {actionError && <ErrorBanner message={actionError} />}
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Name *"
                value={combinedTemplate.name}
                onChange={(v) => setCombinedTemplate({ ...combinedTemplate, name: v })}
                placeholder="Maternity Antenatal Flow"
              />
              <Field
                label="Code *"
                value={combinedTemplate.code}
                onChange={(v) =>
                  setCombinedTemplate({ ...combinedTemplate, code: v.toUpperCase() })
                }
                placeholder="MAT_ANC"
                mono
              />
            </div>
            <FieldLabel label="Description">
              <textarea
                value={combinedTemplate.description}
                onChange={(e) =>
                  setCombinedTemplate({ ...combinedTemplate, description: e.target.value })
                }
                placeholder="What this pathway is for..."
                className="input-field h-20 bg-secondary-50 border-secondary-400 w-full resize-none py-3"
              />
            </FieldLabel>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-secondary-500 flex items-center gap-1">
                  <ListChecks className="h-3 w-3" /> Checkpoints
                </h4>
                <button
                  onClick={() =>
                    setCombinedSteps((prev) => [
                      ...prev,
                      { service_delivery_point_id: "", is_required: false, notes: "" },
                    ])
                  }
                  className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Add Step
                </button>
              </div>
              {combinedSteps.map((s, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-secondary-400 p-4 bg-secondary-50/50 space-y-3 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
                      Step {idx + 1}
                    </span>
                    {combinedSteps.length > 1 && (
                      <button
                        onClick={() =>
                          setCombinedSteps((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="p-1 rounded-lg hover:bg-rose-50 text-rose-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <select
                    value={s.service_delivery_point_id}
                    onChange={(e) =>
                      setCombinedSteps((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, service_delivery_point_id: e.target.value } : row,
                        ),
                      )
                    }
                    className="input-field h-11 bg-white border-secondary-400 w-full text-xs"
                  >
                    <option value="">Pick a service point...</option>
                    {sdps.map((sdp) => (
                      <option key={sdp.id} value={sdp.id}>
                        {sdp.name} ({sdp.code})
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setCombinedSteps((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, is_required: !row.is_required } : row,
                          ),
                        )
                      }
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${s.is_required
                          ? "bg-rose-50 border-rose-200 text-rose-600"
                          : "bg-secondary-100 border-secondary-200 text-secondary-500"
                        }`}
                    >
                      <ShieldAlert className="h-3 w-3" />
                      {s.is_required ? "Required" : "Optional"}
                    </button>
                    <input
                      type="text"
                      value={s.notes}
                      onChange={(e) =>
                        setCombinedSteps((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, notes: e.target.value } : row,
                          ),
                        )
                      }
                      placeholder="Notes for staff at this stage..."
                      className="flex-1 input-field h-11 bg-white border-secondary-400 text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <ModalActions
            onClose={closeAction}
            onSubmit={handleCombinedCreate}
            pending={actionPending}
            submitLabel="Create Pathway"
            submitIcon={Wand2}
            tone="emerald"
          />
          <p className="mt-4 text-[10px] text-secondary-400 font-bold uppercase tracking-[0.25em] flex items-center gap-1.5">
            <Copy className="h-3 w-3" />
            Steps are auto-numbered in the order shown above
          </p>
        </Modal>
      )}
    </div>
  );
}

// =====================================================================
// Reusable Subcomponents
// =====================================================================

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3">
      <AlertCircle className="h-5 w-5" />
      <span className="text-sm font-bold">{message}</span>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-widest text-secondary-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  mono,
  disabled,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <FieldLabel label={label}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`input-field h-12 bg-secondary-50 border-secondary-400 w-full ${mono ? "font-mono" : ""
          } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      />
      {hint && (
        <p className="text-[9px] font-bold uppercase tracking-widest text-secondary-400">
          {hint}
        </p>
      )}
    </FieldLabel>
  );
}

function ToggleSwitch({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${value
          ? "bg-rose-50 border-rose-200 text-rose-700"
          : "bg-secondary-50 border-secondary-400 text-secondary-500"
        }`}
    >
      <div className="text-left flex items-center gap-3">
        <ShieldAlert
          className={`h-4 w-4 ${value ? "text-rose-600" : "text-secondary-400"}`}
        />
        <div>
          <p className="text-xs font-bold uppercase tracking-widest">{label}</p>
          <p className="text-[10px] font-bold opacity-70 mt-0.5">{hint}</p>
        </div>
      </div>
      <div
        className={`h-6 w-12 rounded-full p-0.5 transition-all ${value ? "bg-rose-500" : "bg-secondary-200"
          }`}
      >
        <div
          className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-6" : ""
            }`}
        />
      </div>
    </button>
  );
}

function ModalActions({
  onClose,
  onSubmit,
  pending,
  submitLabel,
  submitIcon: Icon,
  tone = "primary",
}: {
  onClose: () => void;
  onSubmit: () => void;
  pending: boolean;
  submitLabel: string;
  submitIcon: typeof Save;
  tone?: "primary" | "emerald" | "rose";
}) {
  const cls =
    tone === "rose"
      ? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20"
      : tone === "emerald"
        ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
        : "bg-primary-500 hover:bg-primary-600 shadow-primary-500/20";
  return (
    <div className="pt-6 flex gap-4">
      <button
        onClick={onClose}
        disabled={pending}
        className="flex-1 btn-secondary py-4 rounded-2xl font-bold disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        onClick={onSubmit}
        disabled={pending}
        className={`flex-[2] py-4 rounded-2xl text-white font-black tracking-tight shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 ${cls}`}
      >
        <Icon className="h-4 w-4" />
        {pending ? "Working..." : submitLabel}
      </button>
    </div>
  );
}

function Modal({
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
  icon: typeof Save;
  tone?: "primary" | "emerald" | "rose";
}) {
  const cls =
    tone === "rose"
      ? "bg-rose-500 shadow-rose-500/20"
      : tone === "emerald"
        ? "bg-emerald-500 shadow-emerald-500/20"
        : "bg-primary-600 shadow-primary-500/20";
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-6 animate-fade-in">
      <div className="bg-white rounded-[2.5rem] p-10 max-w-2xl w-full shadow-2xl relative animate-slide-up max-h-[90vh] overflow-y-auto">
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

// Suppress unused-import lints — these icons are reserved for future detail panels
void ClipboardList;
void FileText;
