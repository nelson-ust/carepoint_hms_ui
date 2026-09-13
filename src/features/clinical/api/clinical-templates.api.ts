import { apiClient } from "@/lib/api/api-client";

// Mirrors app/api/v1/endpoints/clinical_template_routes.py

export type ClinicalTemplateSection = {
  title: string;
  content: string;
};

export type ClinicalTemplate = {
  id: number;
  name: string;
  description?: string | null;
  specialty?: string | null;
  template_type: "SOAP" | "HISTORY" | "EXAMINATION" | "PROCEDURE" | "GENERAL";
  sections: ClinicalTemplateSection[];
  sections_count: number;
  usage_count: number;
  is_favorite: boolean;
  date_created?: string | null;
  updated_at?: string | null;
};

export type ClinicalTemplateStats = {
  total: number;
  commonly_used: number;
  specialties: string[];
};

export type ClinicalTemplatePayload = {
  name: string;
  description?: string | null;
  specialty?: string | null;
  template_type: string;
  sections: ClinicalTemplateSection[];
  is_favorite?: boolean;
};

const normalizeList = (data: unknown): ClinicalTemplate[] =>
  Array.isArray(data) ? (data as ClinicalTemplate[]) : [];

export const clinicalTemplatesApi = {
  list: (params?: { search?: string; specialty?: string; template_type?: string }) =>
    apiClient
      .get<ClinicalTemplate[]>("/clinical-templates", { params })
      .then((res) => normalizeList(res.data)),

  stats: () =>
    apiClient
      .get<ClinicalTemplateStats>("/clinical-templates/stats")
      .then((res) => res.data ?? { total: 0, commonly_used: 0, specialties: [] }),

  get: (id: number) =>
    apiClient.get<ClinicalTemplate>(`/clinical-templates/${id}`).then((res) => res.data),

  create: (payload: ClinicalTemplatePayload) =>
    apiClient.post<ClinicalTemplate>("/clinical-templates", payload).then((res) => res.data),

  update: (id: number, payload: Partial<ClinicalTemplatePayload>) =>
    apiClient.put<ClinicalTemplate>(`/clinical-templates/${id}`, payload).then((res) => res.data),

  remove: (id: number) => apiClient.delete(`/clinical-templates/${id}`).then(() => undefined),

  duplicate: (id: number) =>
    apiClient.post<ClinicalTemplate>(`/clinical-templates/${id}/duplicate`).then((res) => res.data),

  recordUse: (id: number) =>
    apiClient.post<ClinicalTemplate>(`/clinical-templates/${id}/use`).then((res) => res.data),
};

export const TEMPLATE_TYPES = [
  { value: "SOAP", label: "SOAP Note" },
  { value: "HISTORY", label: "History" },
  { value: "EXAMINATION", label: "Examination" },
  { value: "PROCEDURE", label: "Procedure" },
  { value: "GENERAL", label: "General" },
] as const;
