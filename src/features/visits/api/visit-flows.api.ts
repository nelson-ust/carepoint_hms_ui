import { apiClient } from "@/lib/api/api-client";
import { ServiceDeliveryPoint, PaginatedResponse, DeleteResponse } from "./visits.api";

export type TemplateStep = {
  id: number;
  template_id: number;
  service_delivery_point_id: number;
  service_delivery_point_name: string;
  step_order: number;
  notes: string | null;
  is_required?: boolean;
  service_delivery_point?: ServiceDeliveryPoint;
  created_at?: string;
  updated_at?: string;
};

export type VisitTemplate = {
  id: number;
  name: string;
  code: string;
  description?: string;
  associated_visit_flow_templates_steps: TemplateStep[];
  created_at?: string;
  updated_at?: string;
};

export type VisitStep = {
  id: number;
  visit_id: number;
  service_delivery_point_id: number;
  step_order: number;
  status: string;
  is_current: boolean;
  is_required: boolean;
  is_skipped: boolean;
  routed_by_id?: number;
  started_at?: string;
  completed_at?: string;
  notes?: string;
  service_delivery_point: ServiceDeliveryPoint;
  created_at: string;
  updated_at: string;
};

export type CreateVisitTemplatePayload = {
  name: string;
  code: string;
  description?: string;
};

export type UpdateVisitTemplatePayload = Partial<CreateVisitTemplatePayload>;

export type CreateTemplateStepPayload = {
  template_id: number;
  service_delivery_point_id: number;
  step_order: number;
  is_required?: boolean;
  notes?: string;
};

export type UpdateTemplateStepPayload = {
  service_delivery_point_id?: number;
  step_order?: number;
  is_required?: boolean;
  notes?: string;
};

export type CreateVisitStepPayload = {
  visit_id: number;
  service_delivery_point_id: number;
  step_order: number;
  status?: string;
  is_current?: boolean;
  is_required?: boolean;
  is_skipped?: boolean;
  routed_by_id?: number;
  started_at?: string;
  completed_at?: string;
  notes?: string;
};

export type UpdateVisitStepPayload = {
  service_delivery_point_id?: number;
  step_order?: number;
  status?: string;
  is_current?: boolean;
  is_required?: boolean;
  is_skipped?: boolean;
  routed_by_id?: number;
  started_at?: string;
  completed_at?: string;
  notes?: string;
};

export type CombinedCreatePayload = {
  template?: CreateVisitTemplatePayload;
  template_steps?: Omit<CreateTemplateStepPayload, "template_id">[];
  visit_id?: number;
  visit_steps?: Omit<CreateVisitStepPayload, "visit_id">[];
};

export type CombinedCreateResponse = {
  success: boolean;
  message: string;
  template?: VisitTemplate;
  created_template_steps?: TemplateStep[];
  created_visit_steps?: VisitStep[];
};

// ----- Templates -----
export async function getVisitTemplates(skip: number = 0, limit: number = 20) {
  const response = await apiClient.get<PaginatedResponse<VisitTemplate>>("/visit-flows/templates", {
    params: { skip, limit },
  });
  return response.data;
}

export async function getVisitTemplate(templateId: number) {
  const response = await apiClient.get<VisitTemplate>(`/visit-flows/templates/${templateId}`);
  return response.data;
}

export async function createVisitTemplate(payload: CreateVisitTemplatePayload) {
  const response = await apiClient.post<VisitTemplate>("/visit-flows/templates", payload);
  return response.data;
}

export async function updateVisitTemplate(id: number, payload: UpdateVisitTemplatePayload) {
  const response = await apiClient.put<VisitTemplate>(`/visit-flows/templates/${id}`, payload);
  return response.data;
}

export async function deleteVisitTemplate(id: number) {
  const response = await apiClient.delete<DeleteResponse>(`/visit-flows/templates/${id}`);
  return response.data;
}

// ----- Template Steps -----
export async function createTemplateStep(payload: CreateTemplateStepPayload) {
  const response = await apiClient.post<TemplateStep>("/visit-flows/template-steps", payload);
  return response.data;
}

export async function updateTemplateStep(id: number, payload: UpdateTemplateStepPayload) {
  const response = await apiClient.put<TemplateStep>(`/visit-flows/template-steps/${id}`, payload);
  return response.data;
}

export async function deleteTemplateStep(id: number) {
  const response = await apiClient.delete<DeleteResponse>(`/visit-flows/template-steps/${id}`);
  return response.data;
}

// ----- Visit Steps -----
export async function getVisitSteps(visitId?: number) {
  const params: Record<string, any> = {};
  if (visitId !== undefined) params.visit_id = visitId;
  const response = await apiClient.get<PaginatedResponse<VisitStep>>("/visit-flows/visit-steps", { params });
  return response.data;
}

export async function getVisitStep(visitStepId: number) {
  const response = await apiClient.get<VisitStep>(`/visit-flows/visit-steps/${visitStepId}`);
  return response.data;
}

export async function createVisitStep(payload: CreateVisitStepPayload) {
  const response = await apiClient.post<VisitStep>("/visit-flows/visit-steps", payload);
  return response.data;
}

export async function updateVisitStep(id: number, payload: UpdateVisitStepPayload) {
  const response = await apiClient.put<VisitStep>(`/visit-flows/visit-steps/${id}`, payload);
  return response.data;
}

export async function deleteVisitStep(id: number) {
  const response = await apiClient.delete<DeleteResponse>(`/visit-flows/visit-steps/${id}`);
  return response.data;
}

// ----- Combined Create -----
export async function createCombinedFlow(payload: CombinedCreatePayload) {
  const response = await apiClient.post<CombinedCreateResponse>("/visit-flows/combined-create", payload);
  return response.data;
}
