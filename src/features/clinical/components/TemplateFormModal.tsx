import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Plus, Star, Trash2 } from "lucide-react";
import { DxPopup, DxButton, DxInput, DxSelect, DxTextarea } from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import {
  clinicalTemplatesApi,
  TEMPLATE_TYPES,
  type ClinicalTemplate,
  type ClinicalTemplateSection,
} from "../api/clinical-templates.api";

const DEFAULT_SECTIONS: Record<string, ClinicalTemplateSection[]> = {
  SOAP: [
    { title: "Subjective", content: "" },
    { title: "Objective", content: "" },
    { title: "Assessment", content: "" },
    { title: "Plan", content: "" },
  ],
  HISTORY: [
    { title: "Presenting Complaint", content: "" },
    { title: "History of Presenting Complaint", content: "" },
    { title: "Past Medical History", content: "" },
    { title: "Drug History & Allergies", content: "" },
    { title: "Family & Social History", content: "" },
  ],
  EXAMINATION: [
    { title: "General Examination", content: "" },
    { title: "Systemic Examination", content: "" },
    { title: "Findings", content: "" },
  ],
  PROCEDURE: [
    { title: "Indication", content: "" },
    { title: "Procedure Notes", content: "" },
    { title: "Post-procedure Plan", content: "" },
  ],
  GENERAL: [{ title: "Notes", content: "" }],
};

export function TemplateFormModal({
  isOpen,
  onClose,
  template,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** When set, the modal edits this template; otherwise it creates one. */
  template: ClinicalTemplate | null;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!template;

  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [description, setDescription] = useState("");
  const [templateType, setTemplateType] = useState("SOAP");
  const [isFavorite, setIsFavorite] = useState(false);
  const [sections, setSections] = useState<ClinicalTemplateSection[]>(DEFAULT_SECTIONS.SOAP);

  useEffect(() => {
    if (!isOpen) return;
    if (template) {
      setName(template.name);
      setSpecialty(template.specialty || "");
      setDescription(template.description || "");
      setTemplateType(template.template_type || "SOAP");
      setIsFavorite(!!template.is_favorite);
      setSections(template.sections?.length ? template.sections : DEFAULT_SECTIONS.GENERAL);
    } else {
      setName("");
      setSpecialty("");
      setDescription("");
      setTemplateType("SOAP");
      setIsFavorite(false);
      setSections(DEFAULT_SECTIONS.SOAP);
    }
  }, [isOpen, template]);

  const handleTypeChange = (next: string) => {
    setTemplateType(next);
    // Only swap in the scaffold if the user hasn't written anything yet.
    const untouched = sections.every((s) => !s.content.trim());
    if (!isEdit && untouched) setSections(DEFAULT_SECTIONS[next] ?? DEFAULT_SECTIONS.GENERAL);
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["clinical-templates"] });
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        specialty: specialty.trim() || null,
        description: description.trim() || null,
        template_type: templateType,
        sections: sections.filter((s) => s.title.trim()),
        is_favorite: isFavorite,
      };
      return isEdit
        ? clinicalTemplatesApi.update(template!.id, payload)
        : clinicalTemplatesApi.create(payload);
    },
    onSuccess: () => {
      toast.success(
        isEdit ? "Template updated" : "Template created",
        isEdit ? "Your changes have been saved." : "It's now available to all clinicians.",
      );
      refresh();
      onClose();
    },
    onError: (err: any) =>
      toast.error("Couldn't save template", err?.response?.data?.message || "Please check the details and try again."),
  });

  const updateSection = (idx: number, patch: Partial<ClinicalTemplateSection>) =>
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const removeSection = (idx: number) => setSections((prev) => prev.filter((_, i) => i !== idx));

  const canSave = name.trim().length > 0 && sections.some((s) => s.title.trim());

  return (
    <DxPopup
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit "${template?.name}"` : "Create clinical template"}
      size="lg"
      locked={save.isPending}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIsFavorite((v) => !v)}
            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors"
            style={
              isFavorite
                ? { background: "var(--dx-warning-soft)", color: "var(--dx-warning)" }
                : { color: "var(--dx-text-muted)" }
            }
          >
            <Star className="h-4 w-4" style={{ fill: isFavorite ? "currentColor" : "none" }} />
            {isFavorite ? "Marked as commonly used" : "Mark as commonly used"}
          </button>
          <div className="flex gap-2">
            <DxButton onClick={onClose} disabled={save.isPending}>Cancel</DxButton>
            <DxButton variant="primary" onClick={() => save.mutate()} isLoading={save.isPending} disabled={!canSave}>
              {isEdit ? "Save changes" : "Create template"}
            </DxButton>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <DxInput label="Template name" placeholder="e.g. Adult Malaria Follow-up" value={name} onChange={(e) => setName(e.target.value)} />
          <DxInput label="Specialty (optional)" placeholder="e.g. Internal Medicine" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <DxSelect label="Template type" value={templateType} onChange={(e) => handleTypeChange(e.target.value)}
            options={TEMPLATE_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
          <DxInput label="Description (optional)" placeholder="When should clinicians reach for this?" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="dx-field-label">Sections</span>
            <DxButton size="sm" variant="accent-text" leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setSections((prev) => [...prev, { title: "", content: "" }])}>
              Add section
            </DxButton>
          </div>
          <div className="space-y-3">
            {sections.map((section, idx) => (
              <div key={idx} className="rounded-md border border-[var(--dx-border)] bg-[var(--dx-surface)] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <GripVertical className="h-4 w-4 shrink-0 text-[var(--dx-text-faint)]" />
                  <input
                    value={section.title}
                    onChange={(e) => updateSection(idx, { title: e.target.value })}
                    placeholder={`Section ${idx + 1} title`}
                    className="dx-editor flex-1 border-0 bg-transparent px-0 font-semibold shadow-none focus:ring-0"
                  />
                  <DxButton icon size="sm" variant="outline-danger" title="Remove section" onClick={() => removeSection(idx)}>
                    <Trash2 />
                  </DxButton>
                </div>
                <textarea
                  value={section.content}
                  onChange={(e) => updateSection(idx, { content: e.target.value })}
                  placeholder="Pre-filled text or prompts for the clinician…"
                  rows={2}
                  className="dx-editor w-full resize-y"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </DxPopup>
  );
}
