import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Plus, Star, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit "${template?.name}"` : "Create clinical template"}
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIsFavorite((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
              isFavorite ? "bg-amber-500/15 text-amber-500" : "text-secondary-400 hover:bg-secondary-100 dark:hover:bg-white/5"
            }`}
          >
            <Star className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
            {isFavorite ? "Marked as commonly used" : "Mark as commonly used"}
          </button>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} isLoading={save.isPending} disabled={!canSave}>
              {isEdit ? "Save changes" : "Create template"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Template name"
            placeholder="e.g. Adult Malaria Follow-up"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Specialty (optional)"
            placeholder="e.g. Internal Medicine"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Template type"
            value={templateType}
            onChange={(e) => handleTypeChange(e.target.value)}
            options={TEMPLATE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          />
          <Input
            label="Description (optional)"
            placeholder="When should clinicians reach for this?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-widest text-secondary-500">
              Sections
            </label>
            <button
              type="button"
              onClick={() => setSections((prev) => [...prev, { title: "", content: "" }])}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-500 hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Add section
            </button>
          </div>
          <div className="space-y-3">
            {sections.map((section, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-secondary-200 p-4 dark:border-white/10"
              >
                <div className="mb-2 flex items-center gap-2">
                  <GripVertical className="h-4 w-4 shrink-0 text-secondary-300" />
                  <input
                    value={section.title}
                    onChange={(e) => updateSection(idx, { title: e.target.value })}
                    placeholder={`Section ${idx + 1} title`}
                    className="w-full bg-transparent text-sm font-bold text-secondary-900 outline-none placeholder:text-secondary-300"
                  />
                  <button
                    type="button"
                    onClick={() => removeSection(idx)}
                    className="rounded-lg p-1.5 text-secondary-300 transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                    aria-label="Remove section"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <textarea
                  value={section.content}
                  onChange={(e) => updateSection(idx, { content: e.target.value })}
                  placeholder="Pre-filled text or prompts for the clinician…"
                  rows={2}
                  className="w-full resize-y rounded-xl bg-secondary-50 px-3 py-2 text-sm font-medium text-secondary-700 outline-none placeholder:text-secondary-300 dark:bg-white/5 dark:text-secondary-200"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
