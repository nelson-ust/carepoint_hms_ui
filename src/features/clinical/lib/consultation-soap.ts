import type { Consultation } from "@/features/consultations/api/consultations.api";
import { localStorageService, storageKeys } from "@/lib/storage/local-storage";
import type { ClinicalTemplate } from "../api/clinical-templates.api";

// ============================================================
// SOAP form model
// ============================================================

export type SoapTextKey = "subjective_note" | "objective_note" | "assessment_note" | "plan_note";

export type SoapForm = Record<SoapTextKey, string> & {
  recommends_admission: boolean;
  admission_recommendation_note: string;
};

export const SOAP_TEXT_KEYS: SoapTextKey[] = ["subjective_note", "objective_note", "assessment_note", "plan_note"];

export const SOAP_LABELS: Record<SoapTextKey, string> = {
  subjective_note: "Subjective",
  objective_note: "Objective",
  assessment_note: "Assessment",
  plan_note: "Plan",
};

export const EMPTY_SOAP: SoapForm = {
  subjective_note: "",
  objective_note: "",
  assessment_note: "",
  plan_note: "",
  recommends_admission: false,
  admission_recommendation_note: "",
};

export function soapFromConsultation(c?: Consultation | null): SoapForm {
  if (!c) return EMPTY_SOAP;
  return {
    subjective_note: c.subjective_note ?? "",
    objective_note: c.objective_note ?? "",
    assessment_note: c.assessment_note ?? "",
    plan_note: c.plan_note ?? "",
    recommends_admission: c.recommends_admission ?? false,
    admission_recommendation_note: c.admission_recommendation_note ?? "",
  };
}

/** Logged-in user id from local storage (used to default the clinician picker). */
export function readStoredUserId(): number | null {
  try {
    const raw = localStorageService.get(storageKeys.user);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: unknown };
    return typeof parsed?.id === "number" ? parsed.id : null;
  } catch {
    return null;
  }
}

export function sortConsultations(items: Consultation[]): Consultation[] {
  return [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// ============================================================
// Clinical template → SOAP mapping
// ============================================================

/** Match a template section title onto a SOAP field (case-insensitive contains). */
export function soapKeyForSection(title: string | null | undefined): SoapTextKey | null {
  const t = String(title ?? "").toLowerCase();
  if (t.includes("subject")) return "subjective_note";
  if (t.includes("object")) return "objective_note";
  if (t.includes("assess")) return "assessment_note";
  if (t.includes("plan")) return "plan_note";
  return null;
}

export type TemplateMapping = {
  /** Content per matched SOAP field (several sections for one field are joined). */
  fields: Partial<Record<SoapTextKey, string>>;
  /** Unmatched sections, rendered as "Title:\ncontent" and appended to Plan. */
  planAppend: string[];
};

export function mapTemplateToSoap(template: ClinicalTemplate): TemplateMapping {
  const fields: Partial<Record<SoapTextKey, string>> = {};
  const planAppend: string[] = [];
  for (const section of template.sections ?? []) {
    const content = String(section.content ?? "").trim();
    if (!content) continue;
    const key = soapKeyForSection(section.title);
    if (key) {
      fields[key] = fields[key] ? `${fields[key]}\n\n${content}` : content;
    } else {
      const title = String(section.title ?? "").trim() || "Section";
      planAppend.push(`${title}:\n${content}`);
    }
  }
  return { fields, planAppend };
}

const joinBlocks = (...parts: Array<string | undefined>) => parts.map((p) => (p ?? "").trim()).filter(Boolean).join("\n\n");

export type TemplateApplyResult = {
  /** Form with empty fields filled and unmatched sections appended to Plan. */
  next: SoapForm;
  /** Fields that already held text and were therefore left untouched. */
  conflicts: SoapTextKey[];
};

/**
 * Fill empty SOAP fields from the mapping, leave non-empty ones alone (reported
 * as conflicts) and append unmatched sections to Plan.
 */
export function applyTemplateMapping(soap: SoapForm, mapping: TemplateMapping): TemplateApplyResult {
  const next: SoapForm = { ...soap };
  const conflicts: SoapTextKey[] = [];
  for (const key of SOAP_TEXT_KEYS) {
    const incoming = mapping.fields[key];
    if (!incoming) continue;
    if (soap[key].trim()) conflicts.push(key);
    else next[key] = incoming;
  }
  if (mapping.planAppend.length) next.plan_note = joinBlocks(next.plan_note, ...mapping.planAppend);
  return { next, conflicts };
}

/** Replace the conflicting fields with the template content (Plan keeps the appended extras). */
export function overwriteTemplateConflicts(soap: SoapForm, mapping: TemplateMapping, conflicts: SoapTextKey[]): SoapForm {
  const next: SoapForm = { ...soap };
  for (const key of conflicts) {
    const incoming = mapping.fields[key];
    if (!incoming) continue;
    next[key] = key === "plan_note" ? joinBlocks(incoming, ...mapping.planAppend) : incoming;
  }
  return next;
}

export function soapIsEqual(a: SoapForm, b: SoapForm): boolean {
  return (
    SOAP_TEXT_KEYS.every((k) => a[k] === b[k]) &&
    a.recommends_admission === b.recommends_admission &&
    a.admission_recommendation_note === b.admission_recommendation_note
  );
}
